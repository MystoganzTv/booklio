/**
 * recencyPolicy — age rules for Discover / recommendations (NOT search).
 *
 * Problem: catalog queries surface 1900s editions in recommendation rails.
 * Rules (BOOKLIZ roadmap follow-up):
 *   - default sections:        exclude < 1990; strongly prefer last ~25 years
 *   - "new releases":          only the last 3 years
 *   - classics sections:       old books explicitly welcome
 *   - series continuation:     age never blocks the next volume
 *   - search:                  NEVER filtered by age (user intent wins)
 * Unknown years are allowed (never punish missing metadata) but get no boost.
 */

export type RecommendationContext =
  | "default"
  | "new-releases"
  | "classics"
  | "series-continuation"
  | "search";

export const DEFAULT_MIN_YEAR = 1990;
export const NEW_RELEASE_WINDOW_YEARS = 3;
export const MODERN_WINDOW_YEARS = 25;

export type AgeOptions = {
  /** The book continues a series the user is reading — age never blocks it. */
  knownSeriesContinuation?: boolean;
  /** Canonical work the engine deliberately wants to surface (curated/structural). */
  isCanonicalWork?: boolean;
};

/**
 * May a book of this publication year appear in this context?
 * `undefined` year is always allowed — missing metadata is not a crime.
 */
export function allowsByAge(
  publishedYear: number | undefined,
  context: RecommendationContext,
  options: AgeOptions = {},
  nowYear: number = new Date().getFullYear()
): boolean {
  if (context === "search") return true;                 // user intent wins
  if (context === "classics") return true;               // old is the point
  if (context === "series-continuation") return true;    // never break a saga
  if (options.knownSeriesContinuation || options.isCanonicalWork) return true;
  if (publishedYear === undefined || publishedYear <= 0) return true; // unknown ≠ excluded

  if (context === "new-releases") {
    return publishedYear >= nowYear - NEW_RELEASE_WINDOW_YEARS;
  }
  // default
  return publishedYear >= DEFAULT_MIN_YEAR;
}

/**
 * Additive score for recommendation ranking: modern books float up.
 * 0 for unknown years (no boost, no penalty).
 */
export function agePreferenceScore(
  publishedYear: number | undefined,
  nowYear: number = new Date().getFullYear()
): number {
  if (publishedYear === undefined || publishedYear <= 0) return 0;
  const age = nowYear - publishedYear;
  if (age < 0) return 10;                 // upcoming/this year
  if (age <= 2) return 12;
  if (age <= 5) return 10;
  if (age <= 10) return 8;
  if (age <= MODERN_WINDOW_YEARS) return 5;
  if (publishedYear >= DEFAULT_MIN_YEAR) return 2;
  return -10;                             // pre-1990: heavy ranking penalty
}
