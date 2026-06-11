/**
 * metadataMergePolicy — the single source of truth for how book metadata may
 * be merged, shared by BOTH pipelines:
 *
 *   • utils/metadataResolver.ts        (EditBook fetch, Find synopsis, Add enrichment)
 *   • services/bookMetadataAggregator  (Add tab search / ISBN scan)
 *
 * Rules it enforces:
 *   1. LANGUAGE LOCK — when an edition language is selected, language-locked
 *      fields (title, synopsis, cover, ISBN, publisher, dates, pages) may ONLY
 *      come from candidates in that language. Never silently fall back.
 *   2. NO FABRICATED VISIBLE METADATA — curated sources (knownWorks) may only
 *      contribute structural data (workKey, canonical/translated titles,
 *      series name/order). Never synopsis, ratings, pages, publisher,
 *      publication dates, or covers.
 *   3. Rejections are logged in dev:
 *      [MERGE_POLICY] rejected field="synopsis" reason="language_mismatch"
 */
import { isSameLanguage } from "./languageUtils";

/** Fields tied to a specific edition's language — locked when a language is selected. */
const LANGUAGE_LOCKED_FIELDS = new Set([
  "title",
  "synopsis",
  "description",
  "coverImageUri",
  "coverUrl",
  "isbn",
  "isbn13",
  "isbn10",
  "publisher",
  "publishedDate",
  "publishedYear",
  "pages",
  "pageCount",
  "editionKey",
  "language",
]);

/** User-visible metadata that curated/structural sources must never fabricate. */
const VISIBLE_METADATA_FIELDS = new Set([
  "synopsis",
  "description",
  "coverImageUri",
  "coverUrl",
  "pages",
  "pageCount",
  "publisher",
  "publishedDate",
  "publishedYear",
  "averageRating",
  "ratingsCount",
]);

export function isVisibleMetadataField(field: string): boolean {
  return VISIBLE_METADATA_FIELDS.has(field);
}

export function isLanguageLockedField(field: string): boolean {
  return LANGUAGE_LOCKED_FIELDS.has(field);
}

export function logMergeRejection(field: string, reason: string): void {
  if (__DEV__) console.log(`[MERGE_POLICY] rejected field="${field}" reason="${reason}"`);
}

/**
 * May `field` from a candidate in `candidateLanguage` be used for a book whose
 * selected language is `selectedLanguage`?
 *
 * - No selected language → anything goes (no lock active).
 * - Structural fields → always allowed.
 * - Locked field + unknown candidate language → REJECTED (strict: we can't
 *   prove it matches, so we don't mix).
 * - Locked field + known language → allowed only when languages match.
 */
export function canUseFieldForLanguage(
  field: string,
  candidateLanguage: string | undefined,
  selectedLanguage: string | undefined
): boolean {
  if (!selectedLanguage?.trim()) return true;
  if (!isLanguageLockedField(field)) return true;
  if (!candidateLanguage?.trim()) {
    logMergeRejection(field, "candidate_language_unknown");
    return false;
  }
  if (isSameLanguage(candidateLanguage, selectedLanguage)) return true;
  logMergeRejection(field, "language_mismatch");
  return false;
}

/**
 * Merge `candidate` into `base`, filling ONLY empty fields, and ONLY when the
 * language policy allows it. Never overwrites non-empty base values (rule:
 * user-confirmed data is never clobbered automatically).
 */
export function mergeMetadataSafely<T extends Record<string, unknown>>(
  base: T,
  candidate: Partial<T>,
  selectedLanguage: string | undefined,
  candidateLanguage: string | undefined
): T {
  const out: Record<string, unknown> = { ...base };
  for (const [field, value] of Object.entries(candidate)) {
    if (value == null || value === "") continue;
    const current = out[field];
    const isEmpty =
      current == null ||
      current === "" ||
      (Array.isArray(current) && current.length === 0);
    if (!isEmpty) continue; // never overwrite confirmed data
    if (!canUseFieldForLanguage(field, candidateLanguage, selectedLanguage)) continue;
    out[field] = value;
  }
  return out as T;
}

/**
 * Strip every user-visible metadata field from a curated-source record
 * (knownWorks). What survives is structural only: workKey, titles/aliases,
 * series name/order, author.
 */
export function stripFabricatedVisibleFields<T extends Record<string, unknown>>(
  candidate: T,
  source = "knownWorks"
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(candidate)) {
    if (isVisibleMetadataField(field)) {
      logMergeRejection(field, `${source}_visible_metadata_blocked`);
      continue;
    }
    out[field] = value;
  }
  return out as Partial<T>;
}
