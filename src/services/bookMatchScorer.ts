/**
 * Book Intelligence Engine — match scoring.
 *
 * Scores a candidate work/edition against the search query on a 0–100 scale.
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
 */

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

  // ── Title similarity (+25) ──
  if (query.title) {
    const qTokens = tokenize(query.title);
    const mTokens = tokenize(edition.title ?? "");
    score += Math.round(overlapCoeff(qTokens, mTokens) * 25);
  }

  // ── Author similarity (+25) ──
  if (query.author && workContext?.authors?.length) {
    const qTokens = tokenize(query.author);
    const allAuthorTokens = workContext.authors.flatMap((a) => tokenize(a));
    score += Math.round(overlapCoeff(qTokens, allAuthorTokens) * 25);
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

  // For text queries, also boost based on work-level title/author
  let workBoost = 0;
  if (!query.isbn13) {
    if (query.title) {
      const qTokens = tokenize(query.title);
      const wTokens = tokenize(work.title);
      workBoost += Math.round(overlapCoeff(qTokens, wTokens) * 10);
    }
    if (query.author && work.authors.length) {
      const qTokens = tokenize(query.author);
      const allAuthorTokens = work.authors.flatMap((a) => tokenize(a));
      workBoost += Math.round(overlapCoeff(qTokens, allAuthorTokens) * 10);
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

// ─── Re-export confidence helper ─────────────────────────────────────────────

export { confidenceFromScore };
