/**
 * readingIdentity — Phase 1 of the platform roadmap (BOOKLIZ_PLATFORM_ROADMAP.md).
 *
 * A deterministic, ON-DEVICE reduction of the user's real reading data into a
 * compact "who is this reader" profile. Local-first: computed from local state,
 * persisted in AsyncStorage. The (already prepared) Supabase row is an optional
 * cross-device copy — the feature never depends on the cloud.
 *
 * Honesty rules (inherited from metadataMergePolicy):
 *   - Derived ONLY from real signals (books, sessions, reviews). No fabrication.
 *   - Generic genres ("Fiction", "General"…) never count as taste.
 *   - summaryKeys are i18n keys + params — the UI renders them; nothing here
 *     produces free-form prose.
 *
 * Signal weights (see roadmap §1): finished ×3 · re-read ×4 · reading ×2 ·
 * added ×1 · 5★ +2 · 4★ +1 · review +1.5 · DNF → negative ×2 on its
 * specific genres/author. Behavioral recency decays with a 90-day half-life.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Author, Book, ReadingSession, Review } from "../types/models";
import { normalizeBookGenres } from "./genres";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IdentitySummaryKey = {
  key: string;
  params?: Record<string, string | number>;
};

export type ReadingIdentity = {
  version: 1;
  computedAt: string;
  /** 0–100 relative weights, specific genres only, descending. */
  genres: { name: string; weight: number }[];
  authors: { name: string; authorId?: string; weight: number }[];
  series: { name: string; progress: number; completed: boolean; weight: number }[];
  formats: { format: "print" | "digital" | "audio"; share: number }[];
  languages: { language: string; share: number }[];
  negatives: { kind: "genre" | "author"; name: string; weight: number }[];
  pace: {
    pagesPerHourPrint?: number;
    pagesPerHourDigital?: number;
    minutesPerSessionAvg: number;
    sessionsPerWeek: number;
    preferredSessionLength: "short" | "medium" | "long";
    typicalBookLength?: number;
  };
  habits: {
    currentStreak: number;
    longestStreak: number;
    finishRate: number;
    mostActiveDay?: string;
    favoriteLocation?: string;
  };
  summaryKeys: IdentitySummaryKey[];
};

export type IdentityInput = {
  books: Book[];
  authors: Author[];
  readingSessions: ReadingSession[];
  reviews: Review[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const READING_IDENTITY_KEY = "@bookliz/reading-identity/v1";
const STORAGE_KEY = READING_IDENTITY_KEY;
const HALF_LIFE_DAYS = 90;
const MIN_DECAY = 0.15;          // old loves never fully vanish
const UNKNOWN_RECENCY = 0.6;     // books without any date: neutral-ish

/** Genres too broad to describe taste — compared accent-stripped + lowercased. */
const GENERIC_GENRES = new Set([
  "fiction", "ficcion", "ficciones", "nonfiction", "non-fiction", "no ficcion",
  "general", "uncategorized", "books", "literature", "literatura", "adult",
  "juvenile fiction", "young adult", "young adult fiction",
  "literary collections", "novela", "novelas",
]);

const stripAccents = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Canonical taste genres for a book:
 * 1. normalizeBookGenres maps raw API categories (incl. Spanish + accents +
 *    "Body, Mind & Spirit" -> Spirituality) — this also canonicalizes legacy
 *    library books stored before the rules existed.
 * 2. Generic catch-alls are then excluded — they say nothing about taste.
 */
const specificGenres = (genres: string[]) =>
  normalizeBookGenres(genres)
    .map((g) => g.trim())
    .filter((g) => g && !GENERIC_GENRES.has(stripAccents(g.toLowerCase())));

export const formatFamilyOf = (format?: string): "print" | "digital" | "audio" => {
  if (format === "audiobook") return "audio";
  if (format === "kindle" || format === "ebook") return "digital";
  return "print";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dayDiff = (iso: string, now: number) => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, (now - t) / 86_400_000) : undefined;
};

/** 0.5^(days/90), floored — undefined date → neutral factor. */
const decayFor = (iso: string | undefined, now: number): number => {
  if (!iso) return UNKNOWN_RECENCY;
  const days = dayDiff(iso, now);
  if (days === undefined) return UNKNOWN_RECENCY;
  return Math.max(MIN_DECAY, Math.pow(0.5, days / HALF_LIFE_DAYS));
};

const median = (values: number[]): number | undefined => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** Scale a weight map to 0–100 relative to its max, sorted descending. */
const normalize = (map: Map<string, number>, limit: number) => {
  const entries = [...map.entries()].filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] ?? 0;
  return entries.slice(0, limit).map(([name, w]) => ({
    name,
    weight: max > 0 ? Math.round((w / max) * 100) : 0,
  }));
};

// ─── Core computation (pure) ──────────────────────────────────────────────────

export function computeReadingIdentity(input: IdentityInput, nowMs: number = Date.now()): ReadingIdentity {
  const { books, authors, readingSessions, reviews } = input;
  const authorName = (id: string) => authors.find((a) => a.id === id)?.name;
  const reviewedBookIds = new Set(reviews.map((r) => r.bookId));

  const genreW = new Map<string, number>();
  const authorW = new Map<string, number>();
  const authorIds = new Map<string, string>(); // name -> id
  const langCount = new Map<string, number>();
  const negGenre = new Map<string, number>();
  const negAuthor = new Map<string, number>();
  const formatCount = new Map<"print" | "digital" | "audio", number>();

  let finished = 0;
  let dnf = 0;

  for (const book of books) {
    const s = book.userStatus;
    const isRead = s.status === "read";
    const isDnf = s.status === "dnf";
    const isReading = s.status === "reading";
    const reread = (s.readCount ?? 0) > 1;
    if (isRead) finished += 1;
    if (isDnf) dnf += 1;

    const decay = decayFor(s.finishDate ?? s.startDate, nowMs);
    const lang = book.language?.trim();
    if (lang) langCount.set(lang, (langCount.get(lang) ?? 0) + 1);
    const family = formatFamilyOf(book.format);
    formatCount.set(family, (formatCount.get(family) ?? 0) + 1);

    if (isDnf) {
      // Negative signal: this genre/author actively repelled the reader.
      for (const g of specificGenres(book.genre)) {
        negGenre.set(g, (negGenre.get(g) ?? 0) + 2 * decay);
      }
      const name = authorName(book.authorId);
      if (name) negAuthor.set(name, (negAuthor.get(name) ?? 0) + 2 * decay);
      continue; // DNF contributes nothing positive
    }

    let w = 1;                                  // added
    if (isReading) w = 2;
    if (isRead) w = 3;
    if (reread) w = 4;
    if (s.rating === 5) w += 2;
    else if (s.rating === 4) w += 1;
    if (reviewedBookIds.has(book.id)) w += 1.5;
    w *= decay;

    for (const g of specificGenres(book.genre)) {
      genreW.set(g, (genreW.get(g) ?? 0) + w);
    }
    const names = [authorName(book.authorId), ...(book.coAuthorIds ?? []).map(authorName)]
      .filter((n): n is string => Boolean(n));
    for (const name of names) {
      authorW.set(name, (authorW.get(name) ?? 0) + w);
      if (!authorIds.has(name)) {
        const entity = authors.find((a) => a.name === name);
        if (entity) authorIds.set(name, entity.id);
      }
    }
  }

  // ── Series progress ─────────────────────────────────────────────────────────
  const seriesMap = new Map<string, { total: number; read: number; weight: number }>();
  for (const book of books) {
    const name = book.seriesName?.trim();
    if (!name) continue;
    const entry = seriesMap.get(name) ?? { total: 0, read: 0, weight: 0 };
    entry.total += 1;
    if (book.userStatus.status === "read") entry.read += 1;
    entry.weight += book.userStatus.status === "read" ? 3 : book.userStatus.status === "reading" ? 2 : 1;
    seriesMap.set(name, entry);
  }
  const series = [...seriesMap.entries()]
    .map(([name, e]) => ({
      name,
      progress: e.total > 0 ? Math.round((e.read / e.total) * 100) : 0,
      completed: e.total > 0 && e.read === e.total,
      weight: e.weight,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8);

  // ── Pace (from real sessions only) ──────────────────────────────────────────
  const pph = (family: "print" | "digital") =>
    readingSessions
      .filter((x) => formatFamilyOf(x.format) === family && (x.pagesPerHour ?? 0) > 0)
      .map((x) => x.pagesPerHour);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : undefined);

  const minutes = readingSessions.map((x) => x.minutesRead).filter((m) => m > 0);
  const minutesAvg = avg(minutes) ?? 0;
  const recentCutoff = nowMs - 28 * 86_400_000;
  const recentSessions = readingSessions.filter((x) => {
    const t = new Date(x.date).getTime();
    return Number.isFinite(t) && t >= recentCutoff;
  });
  const sessionsPerWeek = Math.round((recentSessions.length / 4) * 10) / 10;

  const pace: ReadingIdentity["pace"] = {
    pagesPerHourPrint: avg(pph("print")),
    pagesPerHourDigital: avg(pph("digital")),
    minutesPerSessionAvg: minutesAvg,
    sessionsPerWeek,
    preferredSessionLength: minutesAvg < 20 ? "short" : minutesAvg < 45 ? "medium" : "long",
    typicalBookLength: median(
      books.filter((b) => b.userStatus.status === "read" && b.pages > 0).map((b) => b.pages)
    ),
  };

  // ── Habits ──────────────────────────────────────────────────────────────────
  const days = [...new Set(readingSessions.map((x) => x.date.slice(0, 10)))].sort();
  let longestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    if (prev && new Date(d).getTime() - new Date(prev).getTime() === 86_400_000) run += 1;
    else run = 1;
    longestStreak = Math.max(longestStreak, run);
    prev = d;
  }
  const todayStr = new Date(nowMs).toISOString().slice(0, 10);
  let currentStreak = 0;
  {
    const daySet = new Set(days);
    let cursor = new Date(nowMs);
    // streak counts today if logged, otherwise from yesterday backwards
    if (!daySet.has(todayStr)) cursor = new Date(nowMs - 86_400_000);
    while (daySet.has(cursor.toISOString().slice(0, 10))) {
      currentStreak += 1;
      cursor = new Date(cursor.getTime() - 86_400_000);
    }
  }

  const weekdayCount = new Map<string, number>();
  for (const x of readingSessions) {
    const t = new Date(x.date);
    if (!Number.isFinite(t.getTime())) continue;
    const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][t.getDay()]!;
    weekdayCount.set(day, (weekdayCount.get(day) ?? 0) + 1);
  }
  const mostActiveDay = [...weekdayCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const locationCount = new Map<string, number>();
  for (const x of readingSessions) {
    const loc = x.location?.trim();
    if (!loc || loc === "—") continue;
    locationCount.set(loc, (locationCount.get(loc) ?? 0) + 1);
  }
  const favoriteLocation = [...locationCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const habits: ReadingIdentity["habits"] = {
    currentStreak,
    longestStreak,
    finishRate: finished + dnf > 0 ? Math.round((finished / (finished + dnf)) * 100) / 100 : 1,
    mostActiveDay,
    favoriteLocation,
  };

  // ── Shares ──────────────────────────────────────────────────────────────────
  const totalBooks = books.length || 1;
  const formats = (["print", "digital", "audio"] as const)
    .map((format) => ({ format, share: Math.round(((formatCount.get(format) ?? 0) / totalBooks) * 100) / 100 }))
    .filter((f) => f.share > 0)
    .sort((a, b) => b.share - a.share);
  const languages = [...langCount.entries()]
    .map(([language, n]) => ({ language, share: Math.round((n / totalBooks) * 100) / 100 }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 4);

  const genres = normalize(genreW, 8);
  const authorsRanked = normalize(authorW, 8).map((a) => ({
    ...a, authorId: authorIds.get(a.name),
  }));
  const negatives = [
    ...normalize(negGenre, 4).map((n) => ({ kind: "genre" as const, ...n })),
    ...normalize(negAuthor, 4).map((n) => ({ kind: "author" as const, ...n })),
  ];

  // ── Summary keys (i18n — rendered by the UI, never free text) ──────────────
  const summaryKeys: IdentitySummaryKey[] = [];
  if (genres.length >= 1) {
    summaryKeys.push({
      key: "identity.topGenres",
      params: { a: genres[0]!.name, b: genres[1]?.name ?? "", c: genres[2]?.name ?? "" },
    });
  }
  if (authorsRanked[0] && authorsRanked[0].weight >= 50) {
    summaryKeys.push({ key: "identity.topAuthor", params: { author: authorsRanked[0].name } });
  }
  const dominantFormat = formats[0];
  if (dominantFormat && dominantFormat.share >= 0.5 && dominantFormat.format !== "print") {
    summaryKeys.push({ key: `identity.format.${dominantFormat.format}` });
  }
  summaryKeys.push({ key: `identity.pace.${pace.preferredSessionLength}` });

  return {
    version: 1,
    computedAt: new Date(nowMs).toISOString(),
    genres,
    authors: authorsRanked,
    series,
    formats,
    languages,
    negatives,
    pace,
    habits,
    summaryKeys,
  };
}

// ─── Local persistence (AsyncStorage — the source of truth) ──────────────────

export async function loadStoredIdentity(): Promise<ReadingIdentity | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReadingIdentity;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export async function storeIdentity(identity: ReadingIdentity): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // best-effort — identity is recomputable from local data at any time
  }
}
