/**
 * Book Intelligence Engine — match scoring.
 *
 * Scores a candidate work/edition against the search query on a 0–100 scale.
 * This score is used for within-bucket secondary sorting and confidence display.
 * Primary ranking is handled by the aggregator's bucket + gbRank system.
 *
 * Scoring weights:
 *   Exact ISBN match          → 100 (short-circuits everything else)
 *   Same normalized ISBN      → 100
 *   Title similarity          →  25 pts  (token overlap)
 *   Author similarity         →  25 pts  (token overlap across all authors)
 *   Same work ID              →  40 pts  (Open Library workKey match)
 *   Language match            →  10 pts
 *   Publisher / year match    →   5 pts
 *   Cover available           →   5 pts
 *   Series detected           →   5 pts
 *
 * The raw total is capped at 100.
 *
 * Confidence labels:
 *   90–100 → "high"
 *   70–89  → "good"
 *   50–69  → "possible"
 *   < 50   → "review"
 *
 * ─── Search bucket constants ───────────────────────────────────────────────────
 * The aggregator uses these to enforce hierarchical ranking across result types.
 * A higher bucket ALWAYS beats a lower bucket regardless of score.
 *
 *   BUCKET_ISBN              = 1000  ISBN exact match
 *   BUCKET_EXACT_TITLE       =  490  Primary title search results (intitle:)
 *   BUCKET_TRANSLATION       =  480  Translated-title expansion results
 *   BUCKET_AUTHOR            =  300  Author search results
 *   BUCKET_FUZZY             =  100  OL-only or unranked fallback results
 */

// ─── Bucket constants (exported for aggregator use) ───────────────────────────

export const BUCKET_ISBN        = 1000;
export const BUCKET_EXACT_TITLE =  490;
export const BUCKET_TRANSLATION =  480;
export const BUCKET_AUTHOR      =  300;
export const BUCKET_FUZZY       =  100;

import { BookEdition, BookWork, MatchConfidence, confidenceFromScore } from "../types/bookMetadata";
import { isSameLanguage, languageCode } from "../utils/languageUtils";

// ─── Token helpers ────────────────────────────────────────────────────────────

/**
 * Tokenize a string for similarity matching:
 * - lowercase
 * - NFD normalize + strip combining marks (diacritic insensitive)
 * - replace non-alphanumeric with spaces
 * - drop tokens shorter than 2 characters and common stop-words
 */
const STOP_WORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "by", "and", "or",
  "de", "el", "la", "los", "las", "le", "les", "un", "une", "des",
  "das", "der", "die", "il", "lo", "gli",
]);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/** Overlap coefficient: |A ∩ B| / |A|  (how much of A is covered by B) */
function overlapCoeff(a: string[], b: string[]): number {
  if (a.length === 0) return 0;
  const setB = new Set(b);
  const hits = a.filter((t) => setB.has(t)).length;
  return hits / a.length;
}

/**
 * Generate bigrams from a string for fuzzy matching.
 * "fourth" → ["fo", "ou", "ur", "rt", "th"]
 */
function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    out.add(s.slice(i, i + 2));
  }
  return out;
}

/**
 * Dice coefficient between two strings: 2 * |bigrams(a) ∩ bigrams(b)| / (|bigrams(a)| + |bigrams(b)|)
 * Returns 0–1. Handles typos, missing accents, partial words.
 *
 * Examples:
 *   dice("fourth", "fourth")   → 1.0
 *   dice("fourth", "four")     → 0.6
 *   dice("yarros", "yarros")   → 1.0
 *   dice("rebeca", "rebecca")  → 0.73
 */
export function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const ba = bigrams(a);
  const bb = bigrams(b);
  let intersection = 0;
  for (const bg of ba) {
    if (bb.has(bg)) intersection++;
  }
  return (2 * intersection) / (ba.size + bb.size);
}

/**
 * Fuzzy token overlap: like overlapCoeff but each query token is matched
 * against all candidate tokens using bigram dice ≥ threshold.
 * Handles typos like "rebeca" → "rebecca", "four wing" → "fourth wing".
 */
export function fuzzyOverlapCoeff(
  queryTokens: string[],
  candidateTokens: string[],
  threshold = 0.75
): number {
  if (!queryTokens.length || !candidateTokens.length) return 0;
  let hits = 0;
  for (const qt of queryTokens) {
    const best = Math.max(...candidateTokens.map((ct) => dice(qt, ct)));
    if (best >= threshold) hits++;
  }
  return hits / queryTokens.length;
}

// ─── Query shape ──────────────────────────────────────────────────────────────

export interface ScoringQuery {
  /** Normalized ISBN-13 we're searching for */
  isbn13?: string;
  title?: string;
  author?: string;
  /** Expected language code (ISO 639-1) */
  languageCode?: string;
  /** Open Library work key we already know */
  workKey?: string;
  publisher?: string;
  /** Publication year (4 digits) */
  publishedYear?: number;
}

// ─── Edition scorer ───────────────────────────────────────────────────────────

/**
 * Score a single BookEdition against the query.
 *
 * Returns a score in [0, 100].
 */
export function scoreEdition(
  edition: Omit<BookEdition, "score">,
  query: ScoringQuery,
  workContext?: { workKey?: string; authors?: string[]; seriesName?: string }
): number {
  // ── Exact ISBN short-circuit ──
  if (query.isbn13 && edition.isbn13) {
    if (edition.isbn13 === query.isbn13 || edition.isbn10 === query.isbn13) {
      return 100;
    }
    // ISBN present but doesn't match — penalize heavily
    // (still count completeness from the work context below)
    return scoreCompleteness(edition);
  }

  let score = 0;

  // ── Title similarity (+25, fuzzy) ──
  if (query.title) {
    const qTokens = tokenize(query.title);
    const mTokens = tokenize(edition.title ?? "");
    // Use max of exact overlap and fuzzy overlap so typos still score well
    const exact = overlapCoeff(qTokens, mTokens);
    const fuzzy = fuzzyOverlapCoeff(qTokens, mTokens);
    score += Math.round(Math.max(exact, fuzzy) * 25);
  }

  // ── Author similarity (+25, fuzzy) ──
  if (query.author && workContext?.authors?.length) {
    const qTokens = tokenize(query.author);
    const allAuthorTokens = workContext.authors.flatMap((a) => tokenize(a));
    const exact = overlapCoeff(qTokens, allAuthorTokens);
    const fuzzy = fuzzyOverlapCoeff(qTokens, allAuthorTokens);
    score += Math.round(Math.max(exact, fuzzy) * 25);
  }

  // ── Same work ID (+40) ──
  if (
    query.workKey &&
    workContext?.workKey &&
    query.workKey === workContext.workKey
  ) {
    score += 40;
  }

  // ── Language match (+10) ──
  if (query.languageCode && edition.languageCode) {
    if (
      isSameLanguage(query.languageCode, edition.languageCode) ||
      languageCode(query.languageCode) === edition.languageCode
    ) {
      score += 10;
    }
  }

  // ── Publisher / year match (+5) ──
  let pubMatch = false;
  if (query.publisher && edition.publisher) {
    const qPub = tokenize(query.publisher);
    const mPub = tokenize(edition.publisher);
    if (qPub.length && mPub.length && overlapCoeff(qPub, mPub) > 0.4) {
      pubMatch = true;
    }
  }
  if (!pubMatch && query.publishedYear && edition.publishedYear) {
    pubMatch = Math.abs(query.publishedYear - edition.publishedYear) <= 1;
  }
  if (pubMatch) score += 5;

  // ── Cover available (+5) ──
  if (edition.coverUrl) score += 5;

  // ── Series detected (+5) ──
  if (workContext?.seriesName) score += 5;

  return Math.min(score, 100);
}

// ─── Work scorer ──────────────────────────────────────────────────────────────

/**
 * Score a BookWork against the query using its best edition and metadata.
 *
 * Returns { score, confidence }.
 */
export function scoreWork(
  work: Omit<BookWork, "score" | "confidence" | "bestEdition">,
  bestEdition: Omit<BookEdition, "score">,
  query: ScoringQuery
): { score: number; confidence: MatchConfidence } {
  const editionScore = scoreEdition(bestEdition, query, {
    workKey: work.workKey,
    authors: work.authors,
    seriesName: work.seriesName,
  });

  // For text queries, also boost based on work-level title/author (fuzzy)
  let workBoost = 0;
  if (!query.isbn13) {
    if (query.title) {
      const qTokens = tokenize(query.title);
      const wTokens = tokenize(work.title);
      const exact = overlapCoeff(qTokens, wTokens);
      const fuzzy = fuzzyOverlapCoeff(qTokens, wTokens);
      const titleScore = Math.max(exact, fuzzy);
      workBoost += Math.round(titleScore * 10);
    }
    if (query.author && work.authors.length) {
      const qTokens = tokenize(query.author);
      const allAuthorTokens = work.authors.flatMap((a) => tokenize(a));
      const exact = overlapCoeff(qTokens, allAuthorTokens);
      const fuzzy = fuzzyOverlapCoeff(qTokens, allAuthorTokens);
      workBoost += Math.round(Math.max(exact, fuzzy) * 10);
    }
  }

  const total = Math.min(editionScore + workBoost, 100);
  return { score: total, confidence: confidenceFromScore(total) };
}

// ─── Completeness bonus ───────────────────────────────────────────────────────

/**
 * Completeness-only score for when the ISBN is present but doesn't match
 * (or we want to rank how "rich" an edition record is).
 */
export function scoreCompleteness(edition: Omit<BookEdition, "score">): number {
  let score = 0;
  if (edition.coverUrl) score += 5;
  if (edition.publisher) score += 3;
  if (edition.pageCount) score += 3;
  if (edition.publishedDate) score += 2;
  if (edition.format) score += 2;
  return score;
}

// ─── Intent-aware display ranking ────────────────────────────────────────────

/**
 * Score a work for DISPLAY ORDER within a search bucket.
 *
 * This is separate from scoreWork/scoreEdition, which measure metadata quality.
 * intentRankScore measures relevance to what the user actually typed.
 *
 * For "author" intent (query = "Dan Brown"):
 *   +80  if work is authored by the queried person
 *   −50  if work title contains the query (book ABOUT the author, not BY them)
 *         catches biographies even when Google's author metadata is wrong
 *
 * For "title" intent (query = "Fourth Wing"):
 *   +80  if work title closely matches the query
 *
 * Quality signals (both intents):
 *   +8   cover available
 *   +4   has page count (real book, not stub)
 *
 * gbRank is used as tiebreaker in the aggregator after this score.
 */
export function intentRankScore(
  work: Pick<BookWork, "title" | "authors"> & {
    bestEdition?: Pick<BookEdition, "coverUrl" | "pageCount">;
  },
  query: string,
  intent: "author" | "title"
): number {
  const queryTokens = tokenize(query);
  let score = 0;

  if (intent === "author") {
    const authorTokens = work.authors.flatMap((a) => tokenize(a));
    const authorMatch = authorTokens.length > 0
      ? fuzzyOverlapCoeff(queryTokens, authorTokens, 0.75)
      : 0;
    score += Math.round(authorMatch * 80);

    // If the title itself mentions the queried name, this is likely a book
    // ABOUT the author (biography, companion, guide), not BY them.
    // Penalise strongly — lower even than works with no author match.
    const titleTokens = tokenize(work.title);
    const titleMentionsAuthor = fuzzyOverlapCoeff(queryTokens, titleTokens, 0.75) >= 0.35;
    if (titleMentionsAuthor) score -= 50;

  } else {
    const titleTokens = tokenize(work.title);
    const titleMatch = fuzzyOverlapCoeff(queryTokens, titleTokens, 0.75);
    score += Math.round(titleMatch * 80);
  }

  if (work.bestEdition?.coverUrl) score += 8;
  if ((work.bestEdition?.pageCount ?? 0) > 50) score += 4;

  return score;
}

// ─── Re-export confidence helper ─────────────────────────────────────────────

export { confidenceFromScore };
