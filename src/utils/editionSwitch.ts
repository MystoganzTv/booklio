/**
 * editionSwitch — pure helper for switching a book to another edition
 * (typically another language) of the SAME work.
 *
 * THE RULE (root cause of the "Spanish language, English cover" bug):
 * edition-locked fields switch TOGETHER. If the selected edition doesn't
 * provide a field, it becomes EMPTY — it is never inherited from the
 * previous edition. Empty cover renders the branded gradient; empty
 * synopsis enables "Find synopsis"; empty ISBN is honest.
 *
 * Work identity vs edition identity:
 *   - workKey is WORK-level → preserved by the caller (same logical book).
 *   - editionKey/ISBN are EDITION-level → replaced or cleared, never stale.
 *   - book id + userStatus (progress, status, rating, notes, quotes, tags)
 *     are USER-level → this helper never touches them by construction.
 */
import { GenreBookResult } from "../services/googleBooksProvider";
import { languageCode } from "./languageUtils";

export type EditionSwitchPatch = {
  language: string;
  /** ISO 639-1 code derived from `language` — kept in sync BY CONSTRUCTION
   *  (a "Spanish" book with languageCode "en" is a data-integrity bug). */
  languageCode: string | undefined;
  title: string;
  /** ISBN-13 of the selected edition, or "" — never the previous edition's. */
  isbn13: string;
  /** Always "" — an ISBN-10 from another edition is wrong by definition. */
  isbn10: "";
  /** Cover of the selected edition, or "" (gradient fallback). */
  coverImageUri: string;
  /** Page count as string for form state, or "" when unknown. */
  pages: string;
  publisher: string;
  /** Year as string, or "". */
  publishedDate: string;
  /** Synopsis when the edition carries a real one, else "" (backfill async). */
  synopsis: string;
  /** True when synopsis is empty and the caller should backfill in-language. */
  needsSynopsisBackfill: boolean;
  /** Stale pointer to the previous edition — always cleared on switch. */
  editionKey: undefined;
};

export function buildEditionSwitchPatch(
  candidate: GenreBookResult,
  fallbackLanguage: string
): EditionSwitchPatch {
  const synopsis = (candidate.description?.trim().length ?? 0) > 40
    ? candidate.description!.trim()
    : "";
  const language = candidate.language ?? fallbackLanguage;

  return {
    language,
    languageCode: languageCode(language),
    title: candidate.title,
    isbn13: candidate.isbn13 ?? "",
    isbn10: "",
    coverImageUri: candidate.coverUrl ?? "",
    pages: candidate.pageCount && candidate.pageCount > 0 ? String(candidate.pageCount) : "",
    publisher: candidate.publisher ?? "",
    publishedDate: candidate.publishedYear ? String(candidate.publishedYear) : "",
    synopsis,
    needsSynopsisBackfill: synopsis === "",
    editionKey: undefined,
  };
}
