/**
 * identityRecommendations — Phase 2 S1 (RECOMMENDATIONS_ENGINE.md).
 *
 * Deterministic Discover sections derived from the on-device ReadingIdentity:
 * no community data, no events, no LLM — identity signals + live catalog
 * candidates + recencyPolicy. Every recommendation carries a ReasonCode; the
 * UI renders reasons/titles from i18n keys (no fabricated copy, ever).
 *
 * Section construction is PURE (buildIdentitySectionSpecs + filters/ranking,
 * unit-tested); only fetchIdentitySections touches the network.
 */
import { fetchByKeyword, GenreBookResult } from "./googleBooksProvider";
import { ReadingIdentity } from "../utils/readingIdentity";
import { languageCode } from "../utils/languageUtils";
import { normalizeBookGenres } from "../utils/genres";
import {
  agePreferenceScore,
  allowsByAge,
  RecommendationContext,
} from "../utils/recencyPolicy";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReasonCode =
  | "author-loved"
  | "series-continue"
  | "genre-match"
  | "new-release"
  | "short-read"
  | "long-immersive";

export type IdentitySectionSpec = {
  id: string;
  reason: ReasonCode;
  /** i18n keys — the UI renders t(titleKey, params). Never free text. */
  titleKey: string;
  subtitleKey: string;
  params: Record<string, string | number>;
  query: string;
  /** ISO 639-1 restriction for genre-driven sections (reader's top language). */
  langCode?: string;
  context: RecommendationContext;
  pageFilter?: { max?: number; min?: number };
};

export type IdentityRecommendation = GenreBookResult & { reason: ReasonCode };

export type IdentitySection = IdentitySectionSpec & {
  books: IdentityRecommendation[];
};

const MIN_AUTHOR_WEIGHT = 40;
const MIN_GENRE_WEIGHT = 40;
const SHORT_READ_MAX_PAGES = 320;
const LONG_READ_MIN_PAGES = 500;
const BOOKS_PER_SECTION = 8;
const MIN_BOOKS_PER_SECTION = 2;
const FETCH_TIMEOUT_MS = 8_000;

// ─── Spec generation (pure, deterministic) ────────────────────────────────────

export function buildIdentitySectionSpecs(identity: ReadingIdentity): IdentitySectionSpec[] {
  const specs: IdentitySectionSpec[] = [];
  const topLangCode = languageCode(identity.languages[0]?.language);

  // 1. More from authors you love (top 2, strong signal only)
  for (const author of identity.authors.filter((a) => a.weight >= MIN_AUTHOR_WEIGHT).slice(0, 2)) {
    specs.push({
      id: `author-${author.name}`,
      reason: "author-loved",
      titleKey: "recs.moreFromAuthor",
      subtitleKey: "recs.moreFromAuthorSub",
      params: { author: author.name },
      query: `inauthor:"${author.name}"`,
      context: "default",
    });
  }

  // 2. Continue your series (open series, by engagement weight)
  for (const series of identity.series.filter((s) => !s.completed && s.progress < 100).slice(0, 2)) {
    specs.push({
      id: `series-${series.name}`,
      reason: "series-continue",
      titleKey: "recs.continueSeries",
      subtitleKey: "recs.continueSeriesSub",
      params: { series: series.name },
      query: `"${series.name}"`,
      langCode: topLangCode,
      context: "series-continuation", // age never blocks the next volume
    });
  }

  // 3. Books matching your favorite genres (top 2)
  const topGenres = identity.genres.filter((g) => g.weight >= MIN_GENRE_WEIGHT);
  for (const genre of topGenres.slice(0, 2)) {
    specs.push({
      id: `genre-${genre.name}`,
      reason: "genre-match",
      titleKey: "recs.genreMatch",
      subtitleKey: "recs.genreMatchSub",
      params: { genre: genre.name },
      query: `subject:"${genre.name}"`,
      langCode: topLangCode,
      context: "default",
    });
  }

  // 4. New releases matching your taste (top genre, last 3 years)
  if (topGenres[0]) {
    specs.push({
      id: `new-${topGenres[0].name}`,
      reason: "new-release",
      titleKey: "recs.newReleases",
      subtitleKey: "recs.newReleasesSub",
      params: { genre: topGenres[0].name },
      query: `subject:"${topGenres[0].name}"`,
      langCode: topLangCode,
      context: "new-releases",
    });
  }

  // 5. Short books for your time (only when the pace signal says so)
  if (topGenres[0] && (identity.pace.preferredSessionLength === "short" || identity.pace.sessionsPerWeek < 3)) {
    specs.push({
      id: "short-reads",
      reason: "short-read",
      titleKey: "recs.shortReads",
      subtitleKey: "recs.shortReadsSub",
      params: { genre: topGenres[0].name },
      query: `subject:"${topGenres[0].name}"`,
      langCode: topLangCode,
      context: "default",
      pageFilter: { max: SHORT_READ_MAX_PAGES },
    });
  }

  // 6. Long immersive books (readers who already live in long sessions/books)
  if (topGenres[0] && (identity.pace.preferredSessionLength === "long" || (identity.pace.typicalBookLength ?? 0) >= 450)) {
    specs.push({
      id: "long-reads",
      reason: "long-immersive",
      titleKey: "recs.longReads",
      subtitleKey: "recs.longReadsSub",
      params: { genre: topGenres[0].name },
      query: `subject:"${topGenres[0].name}"`,
      langCode: topLangCode,
      context: "default",
      pageFilter: { min: LONG_READ_MIN_PAGES },
    });
  }

  return specs;
}

// ─── Candidate filtering & ranking (pure) ─────────────────────────────────────

const norm = (v?: string) => (v ?? "").trim().toLowerCase();

export type LibraryIndexLike = {
  isbnSet: Set<string>;
  normalizedTitleSet: Set<string>;
};

const normalizeTitleForIndex = (title: string) =>
  title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/** Does this candidate survive identity negatives + recency + page filters? */
export function passesIdentityFilters(
  book: GenreBookResult,
  identity: ReadingIdentity,
  spec: IdentitySectionSpec,
  library: LibraryIndexLike,
  nowYear: number = new Date().getFullYear()
): boolean {
  // Library dedupe — never recommend what's already on the shelf
  if (book.isbn13 && library.isbnSet.has(book.isbn13)) return false;
  if (library.normalizedTitleSet.has(normalizeTitleForIndex(book.title))) return false;

  // Recency policy — old books never appear in default sections
  if (!allowsByAge(book.publishedYear, spec.context, {}, nowYear)) return false;

  // Negative signals — DNF-repelled genres/authors are excluded everywhere
  const candidateGenres = normalizeBookGenres(book.genres).map(norm);
  for (const negative of identity.negatives) {
    if (negative.kind === "genre" && candidateGenres.includes(norm(negative.name))) return false;
    if (negative.kind === "author" && book.authors.some((a) => norm(a) === norm(negative.name))) return false;
  }

  // Page-length sections
  if (spec.pageFilter?.max && (book.pageCount ?? Number.MAX_SAFE_INTEGER) > spec.pageFilter.max) return false;
  if (spec.pageFilter?.min && (book.pageCount ?? 0) < spec.pageFilter.min) return false;

  return true;
}

/** Deterministic ranking: language fit, recency preference, quality priors. */
export function rankCandidate(
  book: GenreBookResult,
  identity: ReadingIdentity,
  nowYear: number = new Date().getFullYear()
): number {
  let score = agePreferenceScore(book.publishedYear, nowYear);
  score += book.coverUrl ? 8 : -20;
  const ratings = book.ratingsCount ?? 0;
  if (ratings >= 10000) score += 14;
  else if (ratings >= 1000) score += 10;
  else if (ratings >= 100) score += 6;
  score += Math.round((book.averageRating ?? 0) * 2);
  const topLang = norm(identity.languages[0]?.language);
  if (topLang && norm(book.language) === topLang) score += 6;
  return score;
}

// ─── Fetch (the only networked part) ─────────────────────────────────────────

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

export async function fetchIdentitySections(
  identity: ReadingIdentity,
  library: LibraryIndexLike,
  nowYear: number = new Date().getFullYear()
): Promise<IdentitySection[]> {
  const specs = buildIdentitySectionSpecs(identity);
  if (!specs.length) return [];

  const settled = await Promise.allSettled(
    specs.map(async (spec) => {
      const { books } = await withTimeout(
        fetchByKeyword(spec.query, 0, 30, spec.langCode),
        FETCH_TIMEOUT_MS
      );
      const seen = new Set<string>();
      const ranked = books
        .filter((b) => passesIdentityFilters(b, identity, spec, library, nowYear))
        .filter((b) => {
          const key = b.isbn13 ?? b.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => rankCandidate(b, identity, nowYear) - rankCandidate(a, identity, nowYear))
        .slice(0, BOOKS_PER_SECTION)
        .map((b): IdentityRecommendation => ({ ...b, reason: spec.reason }));
      return { ...spec, books: ranked } as IdentitySection;
    })
  );

  return settled
    .flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
    .filter((section) => section.books.length >= MIN_BOOKS_PER_SECTION);
}
