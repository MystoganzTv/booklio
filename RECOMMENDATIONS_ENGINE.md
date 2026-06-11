# Bookliz — Recommendations Engine v2 (Design)

*Status: DESIGN — not implemented. Companion to BOOKLIO_PRODUCT_BIBLE.md.*
*Foundation already shipped: `metadataResolver` (parallel, language-strict), `metadataMergePolicy` (no fabrication, language lock), `userTasteProfile`, `discoverCache`.*

---

## 1. Goal

Replace the current heuristic sections ("Picked for you" = genre/author keyword
queries) with a real engine that answers: **"given everything Bookliz knows
about this reader, what should they read next, and why?"** — explainable,
language-aware, and honest (no fabricated reasons).

## 2. Principles (inherited, non-negotiable)

1. **No hardcoded books.** knownWorks may only contribute structure (series,
   aliases). Candidates come from live catalogs.
2. **Language lock.** Recommendations are presented in the reader's edition
   language when available; metadata shown follows `metadataMergePolicy`.
3. **Explainable.** Every recommendation carries a *true* reason derived from
   real signals ("Terminaste la saga Empyrean", "5★ a dos thrillers de ritmo
   rápido"), never invented copy.
4. **Local-first.** Stage 1–3 run on-device. The optional LLM stage degrades
   gracefully to Stage 3 output when offline/quota-limited.

## 3. Pipeline (4 stages)

```
SIGNALS ─→ CANDIDATES ─→ SCORING ─→ (optional) LLM RE-RANK ─→ sections
```

### Stage 1 — Signals (on-device, pure)
Extend `userTasteProfile` into a versioned `TasteVector`:
- **Explicit**: ratings (5★ books weigh ×3), favorite genres/authors from
  profile, lists the user curates.
- **Behavioral**: completion rate per genre (finishing > adding), reading
  velocity per genre, abandonments (DNF = strong negative signal for that
  genre/author), re-reads (strongest positive), session recency decay
  (half-life ~90 days).
- **Structural**: open series (next unread volume = near-certain candidate),
  format preference (audio vs print per genre), language distribution.
- Output: weighted maps `{genre→w}`, `{author→w}`, `{series→progress}`,
  `negatives: {genre/author→w}`, plus `anchorBooks` (top 5 by composite).

### Stage 2 — Candidate generation (network, cached)
For each signal family, generate live catalog queries through ONE shared
gateway (`fetchByKeyword` with langRestrict from the user's dominant language):
- `continue-series`: knownWorks/series structure → exact next volumes.
- `more-from-author`: top weighted authors → `inauthor:` sweeps.
- `genre-frontier`: top genres × recency (`subject:X`, sorted by our scorer).
- `anchor-similarity`: for each anchor book, GB "related" via shared
  categories + same-shelf authors.
- Dedup against library (`buildLibraryIndex`) and against negatives.
- Cache per-spec 12h in `discoverCache` (already the pattern in Discover).

### Stage 3 — Deterministic scoring (on-device)
`score(candidate) = Σ signal_match × weight − penalties`
- signal_match: genre overlap (specific genres only — generic "Fiction"
  excluded, rule already shipped in recommendationEngine), author match,
  series continuation (max boost), language match.
- quality prior: ratingsCount/avgRating buckets (reuse `browseScoreForMatch`
  curve), cover present, recency.
- penalties: DNF-adjacent signals, already-recommended-recently (memory of
  shown recs, AsyncStorage ring buffer), supplementary material patterns.
- Output: ranked list with a `reason: ReasonCode` + the raw evidence — the UI
  renders reason strings via i18n, never free text from data.

### Stage 4 — Optional LLM re-rank (server / API key)
Input: top ~30 candidates (title/author/genres/our-score/evidence) + compact
TasteVector summary. NEVER raw user notes without consent.
Output: re-ordered ids + one-line *grounded* rationale constrained to the
provided evidence (prompt forbids inventing facts; rationale templated client-
side when the model output fails validation).
Transport: small edge function (Supabase Edge) so the API key never ships in
the app. Hard timeout 3s → fall back to Stage 3 order silently.

## 4. Surfaces

- **Discover "Picked for you"**: top sections by spec score (replaces current
  keyword heuristics; same UI components, no redesign needed).
- **BookDetail "Similar"**: anchor-similarity scoped to the open book.
- **Home "Up next"**: single best `continue-series`/`anchor` candidate.

## 5. Data & privacy

- TasteVector computed and stored locally (AsyncStorage, versioned key).
- LLM stage sends only derived aggregates + catalog candidates; documented in
  the in-app Privacy Policy (a new section will be added when implemented).

## 6. Implementation plan (3 sessions, incremental)

1. **S1**: `tasteVector.ts` (pure, unit-tested — jest infra ready) +
   candidate gateway with cache. Ship behind existing Discover UI.
2. **S2**: deterministic scorer + reason codes + i18n reason strings +
   shown-recs memory. Replace Discover sections.
3. **S3**: edge function + LLM re-rank with validation/fallback + privacy
   policy update.

## 7. Open questions for product owner

- Should DNF penalize the *author* or only the *book's subgenre*?
- "Up next" on Home: one card or a small carousel?
- LLM provider/budget for Stage 4 (Claude Haiku via edge function is the
  cheapest fit for re-rank + one-liners).
