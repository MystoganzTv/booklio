# Bookliz Platform Roadmap — From Library App to Reading Intelligence

*Status: ARCHITECTURE DESIGN — nothing here is implemented yet.*
*Companions: BOOKLIO_PRODUCT_BIBLE.md (vision) · RECOMMENDATIONS_ENGINE.md (Phase 2 detail).*
*Author constraint inherited from the metadata policy: no fabricated data, language-locked metadata, local-first always.*

---

## 0. Supabase Architecture Review (current state, audited from code)

### 0.1 What exists today

All sync flows through `LocalFirstBooklizRepository` (src/data/booklizRepository.ts):
**full-snapshot** upsert + orphan-prune per table, cloud-load on app start when
signed in, retries via `offlineQueue`. Auth: Google/Apple → `supabase.auth.signInWithIdToken`.

| Table | Key columns (from mappers) | Notes |
|---|---|---|
| `booklio_profiles` | user_id PK, name, avatar, email, auth_provider, reading_level, yearly_goal, favorite_authors[], favorite_genres[], top_book_ids[], achievements jsonb | 1 row/user |
| `booklio_authors` | user_id, id, name, bio, favorite_genres[] | **per-user** author entities |
| `booklio_books` | user_id, id, title, author_id, series_*, synopsis, genre[], pages, published_date, publisher, language, isbn, format, cover_*, tags[], work_key, edition_key, language_code, co_author_names[], co_author_ids[], user_status jsonb | user_status embeds status/rating/progress/notes/quotes |
| `booklio_reading_sessions` | user_id, id, book_id, date, start/end_page, pages_read, minutes_read, location, mood, format, notes, favorite_quote, difficulty, enjoyment_rating, pages_per_hour | the analytics goldmine |
| `booklio_reviews` | user_id, id, book_id, rating, title, body, created_at | private today |
| `booklio_user_lists` | user_id, id, name, emoji, book_ids[], timestamps | |

### 0.2 The two structural gaps (everything below hangs on these)

**GAP 1 — No canonical book identity.**
Every user's `booklio_books.id` is private (`b-<slug>-<timestamp>`). My
"Amanecer rojo" and your "Red Rising" are unrelated rows. Community
intelligence ("4.8★ from 45,000 readers", trending, similar-taste) is
**mathematically impossible** without a shared `work_id` that clusters
editions/translations of the same work across users. This is the single most
important schema addition in this document.

**GAP 2 — Snapshot sync destroys history.**
Full upsert + prune is correct for "my current library", but wrong for
intelligence: delete a book and its rating vanishes from existence. Community
signals must be **append-only events**, emitted separately from the snapshot,
surviving library edits. (Also: snapshot sync scales O(library) per save —
fine for libraries, unacceptable as an event log.)

> Rule of thumb adopted below: **snapshot = state, events = history.**
> Never mix them.

---

## 1. Phase 1 — User Reading Identity  · *BUILD NOW · complexity: S*

### Where it's computed: on-device. Where it's stored: locally + 1 cloud row.

The identity is a deterministic function of data the device already has
(books, sessions, reviews). Computing it server-side would break local-first
and add zero accuracy. The cloud copy exists only for cross-device restore and
as input to future server-side features.

### Model — `ReadingIdentity` (extends the TasteVector of RECOMMENDATIONS_ENGINE.md)

```ts
type ReadingIdentity = {
  version: 1;                       // schema version for safe migration
  computedAt: string;               // ISO
  // Weighted, decayed signals (half-life ~90 days on behavioral inputs)
  genres:    { name: string; weight: number }[];   // specific genres only — never "Fiction"
  authors:   { name: string; authorId?: string; weight: number }[];
  series:    { name: string; progress: number; completed: boolean; weight: number }[];
  formats:   { format: "print" | "digital" | "audio"; share: number }[];
  languages: { language: string; share: number }[];
  negatives: { kind: "genre" | "author"; name: string; weight: number }[];  // DNF-driven
  pace: {
    pagesPerHourPrint?: number;
    pagesPerHourDigital?: number;
    minutesPerSessionAvg: number;
    sessionsPerWeek: number;
    preferredSessionLength: "short" | "medium" | "long";
    typicalBookLength: number;       // median pages of finished books
  };
  habits: {
    currentStreak: number;
    longestStreak: number;
    finishRate: number;              // finished / (finished + dnf)
    mostActiveDay: string;
    favoriteLocation?: string;       // from session.location
  };
  // Human-readable, GENERATED FROM THE WEIGHTS via i18n templates — never free text:
  // "Epic fantasy · Sci-fi · Fast-paced thrillers" (top-3 genres by weight)
  summaryKeys: string[];             // i18n keys + params, rendered client-side
};
```

**Signal weighting (the part that makes it feel smart):**
finished ×3 · rated 5★ ×3 · re-read ×4 · reading-now ×2 · added ×1 ·
DNF → negative ×2 on that genre/author · review written ×1.5 ·
all behavioral weights decay with 90-day half-life so the identity *evolves*
("Enrique was into self-help in 2025, lives in romantasy now").

### Storage

```sql
create table booklio_reading_identity (
  user_id uuid primary key references auth.users,
  identity jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);
-- RLS: user reads/writes own row only.
```

One row, jsonb, synced piggy-backing the existing snapshot save (add to
repository like the profile row). **No new sync machinery.**

### Recompute triggers (on-device)
Debounced (5s) after: addBook, status change, session saved, review saved,
deleteBook. Cost is trivial (pure reduction over local arrays — same shape as
the existing `overallStats` memo).

---

## 2. Phase 2 — Intelligent Recommendations  · *BUILD NOW (S1–S2), LATER (S3) · complexity: M*

Fully specified in **RECOMMENDATIONS_ENGINE.md** (signals → candidate
generation → deterministic explainable scoring → optional LLM re-rank).
Phase 1's `ReadingIdentity` **is** the signal stage. What this roadmap adds:

### Section → signal mapping (the product sections requested)

| Section | Source | Needs community data? |
|---|---|---|
| Because you loved *X* | anchorBooks (top-weighted 5★/re-read) → catalog similarity | no |
| Continue your favorite series | `series[]` with progress < 100% → exact next volume | no |
| More from authors you love | `authors[]` top-N → `inauthor:` sweeps | no |
| New releases matching your taste | genre+author queries sorted by pub date (catalog) | no |
| Short books for your time | `pace.preferredSessionLength` + pageCount filter | no |
| Long immersive books | inverse of above, gated on `typicalBookLength` | no |
| Best audiobooks for your commute | `formats.audio.share` high → format-filtered candidates | no |
| Hidden gems in your genres | genre candidates with **Bookliz** rating high + count low | **yes → Phase 3** |
| Readers with similar taste enjoyed | identity-vector similarity between users | **yes → Phase 3** |

First seven sections ship with zero server work. The last two are unlocked by
Phase 3 — design them now, build them when the data exists.

### Scoring (already designed; summary)
`score = Σ(genre·author·series·language·format matches × identity weights)
+ quality prior (ratings curve, recency, cover) − penalties (DNF-adjacent,
recently shown, supplementary material)`. Every result carries a `ReasonCode`
+ evidence → UI renders i18n strings. **No fabricated copy, ever.**

---

## 3. Phase 3 — Bookliz Community Data  · *START COLLECTING NOW, SURFACE LATER · complexity: M (collection) + M (aggregation)*

**The strategic move: the data moat compounds. Start emitting events in the
next release even though no screen shows them for months.** Every week of
delay is lost ratings you can never recover.

### 3.1 Canonical works (fixes GAP 1)

```sql
create table bookliz_works (
  work_id uuid primary key default gen_random_uuid(),
  cluster_keys text[] not null,   -- isbn13s + OL work_keys + gb volume ids seen for this work
  canonical_title text not null,
  canonical_author text not null,
  language_editions jsonb,        -- { "en": {title, isbn}, "es": {title, isbn}, ... }
  created_at timestamptz default now()
);
create index on bookliz_works using gin (cluster_keys);
```

Clustering strategy (server-side, in an edge function the client calls when
emitting an event): look up by any cluster_key (isbn13 → work_key → normalized
title+author); on miss, create. The client already produces all keys via the
metadata resolver. Translations cluster naturally because OL work_keys and our
edition switching keep the chain (Amanecer rojo isbn ↔ Red Rising work_key).
*This is the only genuinely tricky engineering in the whole roadmap.*

### 3.2 Signal events (fixes GAP 2)

```sql
create table bookliz_events (
  event_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  work_id uuid not null references bookliz_works,
  kind text not null check (kind in ('rated','finished','dnf','added','review_published')),
  value numeric,                  -- rating 1–5 for 'rated'; null otherwise
  language text,                  -- edition language of the user's copy
  country text,                   -- coarse, from locale — for "popular in Spain"
  created_at timestamptz default now(),
  unique (user_id, work_id, kind) -- one rating per user per work (upsert on re-rate)
);
```

Client emits through the **existing offlineQueue** (it was built for exactly
this). Anonymous-mode users emit nothing (no auth → no events) — honest and
privacy-clean.

### 3.3 Aggregates (what screens read)

```sql
create materialized view bookliz_work_stats as
select work_id,
       avg(value) filter (where kind='rated')        as avg_rating,
       count(*)   filter (where kind='rated')        as rating_count,
       count(*)   filter (where kind='finished')     as finish_count,
       count(*)   filter (where kind='dnf')          as dnf_count,
       count(*)   filter (where kind='review_published') as review_count
from bookliz_events group by work_id;
```

- **Trending** = finish/rated events with exponential time-decay (7-day),
  computed by a scheduled job into a small `bookliz_trending` table
  (overall + per genre + per language/country).
- **Hidden gems** = avg_rating ≥ 4.3 AND rating_count between 5 and 200.
- **Most loved** = Wilson score (avg + count), not raw average — honest with
  small samples.

**Honesty rule enforced in product:** community numbers render only above a
minimum sample (e.g. rating_count ≥ 5 shows "4.6★ · 12 readers"; below that
the UI shows nothing). The "45,000 Bookliz readers" claim is earned, never
blended with external ratings.

### 3.4 Similar readers (unlocks the last Phase 2 section)
Identity vectors are already in `booklio_reading_identity` (jsonb). A daily
job computes per-user top-K neighbors (cosine over genre/author weight maps —
trivial at <100K users; pgvector if it ever matters). Output:
`bookliz_taste_neighbors(user_id, neighbor_ids uuid[], updated_at)`.
"Readers with similar taste enjoyed" = top works from neighbors' 5★ events
minus my library. **Build LATER — meaningless below ~1K active users.**

---

## 4. Phase 4 — Reading Analytics  · *BUILD NOW (it's 80% done) · complexity: S*

**Audit finding: the data and most calculations already exist on-device** —
`overallStats` in BooklizContext computes pages/minutes/streaks/genre counts/
format counts/monthly buckets/speed-over-time today. Phase 4 is mostly:

1. **New derived metrics** (pure functions over existing sessions):
   speed-per-format ("you read faster in audiobooks") = pages_per_hour grouped
   by session.format; average book length of *finished* books; genre-of-the-
   year; per-month page totals (bucket exists).
2. **History durability**: sessions sync already; add a tiny local
   `monthly_rollups` (AsyncStorage) so year-in-review survives even if a user
   prunes old sessions. *No new Supabase table needed* — sessions table IS the
   history for signed-in users; compute rollups on device.
3. **Presentation**: a "Reading Wrapped" style screen + insight cards rendered
   from i18n templates with computed params. Insights only state what the data
   proves (same no-fabrication mandate).

Server-side analytics: **NEVER** (for personal stats). It's private data, the
device has it, and local-first means the plane-mode user still gets their
stats.

---

## 5. Phase 5 — Social  · *LATER/MUCH LATER · complexity: L*

What it would take (analysis only):

- **Public surface split**: today every table is private-RLS. Social requires
  an explicit *public* layer: `bookliz_public_profiles` (opt-in, display name,
  identity summary, favorite shelf) and `published_reviews` (a review becomes
  public by *copying* into a public table keyed by work_id — never by
  loosening RLS on the private one).
- **Follows**: `bookliz_follows(follower_id, followed_id)` — trivial table,
  non-trivial product (feeds, notifications, blocking, moderation).
- **Activity**: pull-based feed (query follows' recent public events) is fine
  to ~10K users; no fan-out infrastructure until proven need.
- **Book clubs / shared lists**: `bookliz_clubs`, membership, and a shared
  list = user_list with club_id — reuses the list model.
- **Hard prerequisites before any of it**: moderation tooling, report flow,
  blocking, and a privacy-policy revision. This is why it's LATER: the cost is
  not the tables, it's the responsibility.

---

## 6. Compute vs Cache vs Store — the decision table

| Data | Where computed | Stored | Cached |
|---|---|---|---|
| Reading identity | device (debounced) | local + 1 cloud jsonb row | n/a |
| Personal analytics | device on demand | sessions (already synced) | memoized in context |
| Recommendation sections | device (candidates via catalog APIs) | no | discoverCache 12h (exists) |
| Catalog metadata | device via resolver | no | resolver cache 7d (exists) |
| Community aggregates | **server** (pg_cron) | events (append-only) | materialized view, refreshed daily |
| Trending | server job | bookliz_trending | client caches 6–12h |
| Taste neighbors | server job (daily) | neighbors table | client caches 24h |

## 7. Background jobs (all server-side, all simple)

1. `refresh materialized view bookliz_work_stats` — pg_cron, daily (hourly later).
2. Trending decay recompute → `bookliz_trending` — pg_cron, daily.
3. Taste-neighbor batch — pg_cron, daily, **only after Phase 3 has users**.
4. Works-cluster maintenance (merge duplicate works flagged by key overlap) — weekly.

No queues, no workers, no Redis. Postgres + pg_cron + one edge function
(work resolution + event ingest) carries this to six figures of users.

## 8. Priority order & sizing

| # | What | Phase | Size | When |
|---|---|---|---|---|
| 1 | `ReadingIdentity` on-device + cloud row | 1 | S (1 session) | **NOW** |
| 2 | Recs S1–S2: candidate gateway + scorer behind Discover | 2 | M (2 sessions) | **NOW** |
| 3 | `bookliz_works` + `bookliz_events` + ingest edge fn + client emitter | 3 | M (2 sessions) | **NOW** (collect silently) |
| 4 | Analytics insights screen (data exists) | 4 | S (1 session) | **NOW/next** |
| 5 | work_stats view + trending job + "Bookliz rating" UI (gated by sample size) | 3 | S–M | LATER (when events ≥ threshold) |
| 6 | Hidden gems + community sections in Discover | 2+3 | S | LATER |
| 7 | LLM re-rank via edge function (Recs S3) | 2 | M | LATER |
| 8 | Taste neighbors + "similar readers" | 3 | M | LATER (≥1K users) |
| 9 | Social layer | 5 | L | MUCH LATER |
| — | Server-side personal analytics | 4 | — | **NEVER** |
| — | Blending external ratings into "Bookliz rating" | 3 | — | **NEVER** |
| — | Rewriting snapshot sync | 0 | — | **NEVER** (extend, don't replace) |

## 9. Data flow (target architecture)

```
                         ON DEVICE (always works offline)
  ┌──────────────────────────────────────────────────────────────┐
  │ library/sessions/reviews ──► ReadingIdentity (debounced)     │
  │        │                          │                          │
  │        │                          ▼                          │
  │        │                  Recs engine S1–S2 ──► Discover     │
  │        │                  (catalog APIs + discoverCache)     │
  │        ▼                                                     │
  │ snapshot save ─────────────► offlineQueue ──┐                │
  │ rating/finish/dnf events ──► offlineQueue ──┤                │
  └─────────────────────────────────────────────┼────────────────┘
                                                ▼ (signed-in only)
                         SUPABASE
  ┌──────────────────────────────────────────────────────────────┐
  │ booklio_* tables (state snapshot, RLS per user)              │
  │ booklio_reading_identity (1 jsonb row)                       │
  │ edge fn: resolve work_id ──► bookliz_works                   │
  │                          └─► bookliz_events (append-only)    │
  │ pg_cron: work_stats ▪ trending ▪ neighbors                   │
  │      └────► read-only aggregates served to all clients       │
  └──────────────────────────────────────────────────────────────┘
```

## 10. Open product decisions (need the owner)

1. Anonymous users: prompt to sign in *when* they rate ("your rating counts
   toward the Bookliz score"), or stay silent until they choose cloud sync?
2. Country granularity for community stats: locale-level only (privacy-light)?
3. Does a DNF event affect the public work stats (visible dnf_count), or is
   DNF a private-only signal? (StoryGraph shows it; Goodreads doesn't.)
4. Minimum sample to display a Bookliz rating: 5, 10, 25 readers?
