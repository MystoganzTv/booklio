/**
 * Book Intelligence Engine — metadata aggregator.
 *
 * Orchestrates Google Books and Open Library to produce unified BookWork results.
 *
 * Lookup order for ISBN queries:
 *   1. Open Library edition by ISBN   (gets workKey + author keys)
 *   2. Google Books by ISBN           (gets cover, description, extra fields)
 *   3. Open Library work metadata     (title, description, canonical genres)
 *   4. Open Library work editions     (all language/format editions)
 *   5. Merge + score + group
 *
 * Lookup order for text queries:
 *   1. Google Books title+author      (parallel with step 2)
 *   2. Open Library search            (parallel with step 1)
 *   3. Merge works by title similarity
 *   4. Score + sort
 *
 * The aggregator never auto-adds a book — it only returns ranked candidates.
 * The calling UI must require user confirmation before creating a Book record.
 */

import { BookEdition, BookWork, EditionGroup, WorkLookupResult, confidenceFromScore } from "../types/bookMetadata";
import { parseIsbn } from "../utils/isbnUtils";
import { normalizeLanguage, isPriorityLanguage, PRIORITY_LANGUAGE_CODES } from "../utils/languageUtils";
import { ScoringQuery, scoreEdition, scoreWork, tokenize } from "./bookMatchScorer";
import {
  fetchByIsbn as gbFetchByIsbn,
  fetchWorksByQuery as gbFetchByQuery,
  volumeToWork as gbVolumeToWork,
} from "./googleBooksProvider";
import {
  fetchEditionByIsbn as olFetchEditionByIsbn,
  fetchWork as olFetchWork,
  fetchWorkEditions as olFetchWorkEditions,
  fetchWorksByQuery as olFetchByQuery,
  resolveAuthorNames as olResolveAuthors,
} from "./openLibraryProvider";

// ─── Query intent detection ───────────────────────────────────────────────────

const TITLE_STARTERS = new Set([
  "the", "a", "an", "el", "la", "los", "las", "le", "les",
  "der", "die", "das", "un", "une", "una", "i", "o",
]);

/**
 * Heuristic: does the raw query look like a person's name (→ author search)
 * or a book title / keyword (→ general search)?
 *
 * Rules:
 * - Single word                     → general (likely a title like "Dune")
 * - > 3 words                       → general (too long for a name)
 * - Contains digits                 → general (ISBN-like, year, etc.)
 * - Starts with an article          → general ("The Da Vinci Code")
 * - Contains & : — – ,              → general (subtitle punctuation)
 * - 2–3 words, all start uppercase  → author  ("Dan Brown", "J.K. Rowling")
 */
export function detectQueryIntent(query: string): "author" | "general" {
  const words = query.trim().split(/\s+/);

  if (words.length < 2 || words.length > 3) return "general";
  if (/\d/.test(query)) return "general";
  if (TITLE_STARTERS.has(words[0]!.toLowerCase())) return "general";
  if (/[&:—–,]/.test(query)) return "general";

  const isNameLike = (w: string) =>
    /^[A-ZÁÉÍÓÚÑÜÀÈÌÒÙÂÊÎÔÛÃÕ][a-zA-ZÁÉÍÓÚÑÜÀÈÌÒÙÂÊÎÔÛÃÕáéíóúñüàèìòùâêîôûãõ'-]+$/.test(w) ||
    /^[A-Z]\.$/.test(w) ||        // single initial "J."
    /^[A-Z]\.[A-Z]\.$/.test(w);   // double initial "J.K."

  return words.every(isNameLike) ? "author" : "general";
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/** Stable key for deduplicating editions */
function editionKey(e: BookEdition): string {
  return e.isbn13 ?? e.isbn10 ?? `${e.languageCode}-${e.publisher ?? "?"}-${e.publishedYear ?? "?"}`;
}

/** Merge two editions: keep higher score, steal cover from the other */
function mergeEditions(a: BookEdition, b: BookEdition): BookEdition {
  const winner = a.score >= b.score ? a : b;
  const loser = a.score >= b.score ? b : a;
  return {
    ...winner,
    coverUrl: winner.coverUrl ?? loser.coverUrl,
    isbn13: winner.isbn13 ?? loser.isbn13,
    isbn10: winner.isbn10 ?? loser.isbn10,
    publisher: winner.publisher ?? loser.publisher,
    pageCount: winner.pageCount ?? loser.pageCount,
    format: winner.format ?? loser.format,
    publishedDate: winner.publishedDate ?? loser.publishedDate,
    publishedYear: winner.publishedYear ?? loser.publishedYear,
  };
}

function dedupeEditions(editions: BookEdition[]): BookEdition[] {
  const map = new Map<string, BookEdition>();
  for (const e of editions) {
    const key = editionKey(e);
    const existing = map.get(key);
    map.set(key, existing ? mergeEditions(existing, e) : e);
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

// ─── Edition grouping ─────────────────────────────────────────────────────────

/**
 * Group editions by language, prioritizing the 7 supported languages first.
 */
export function groupEditionsByLanguage(editions: BookEdition[]): EditionGroup[] {
  const byLang = new Map<string, BookEdition[]>();
  for (const e of editions) {
    const existing = byLang.get(e.languageCode) ?? [];
    existing.push(e);
    byLang.set(e.languageCode, existing);
  }

  const groups: EditionGroup[] = [];
  for (const [code, eds] of byLang.entries()) {
    const sorted = [...eds].sort((a, b) => b.score - a.score);
    const lang = normalizeLanguage(code);
    groups.push({
      languageCode: code,
      language: lang?.name ?? code,
      isPriority: isPriorityLanguage(code),
      editions: sorted,
      bestEdition: sorted[0]!,
    });
  }

  // Sort: priority languages first (in defined order), then alphabetical
  const priorityOrder = PRIORITY_LANGUAGE_CODES as readonly string[];
  return groups.sort((a, b) => {
    const ai = priorityOrder.indexOf(a.languageCode);
    const bi = priorityOrder.indexOf(b.languageCode);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.language.localeCompare(b.language);
  });
}

// ─── Best edition selection ───────────────────────────────────────────────────

function pickBestEdition(editions: BookEdition[]): BookEdition {
  if (!editions.length) {
    // Synthetic empty edition as fallback
    return {
      id: "empty",
      source: "open-library",
      title: "Unknown",
      languageCode: "en",
      language: "English",
      score: 0,
    };
  }
  // Prefer high score + cover + complete metadata
  return [...editions].sort((a, b) => {
    const coverA = a.coverUrl ? 1 : 0;
    const coverB = b.coverUrl ? 1 : 0;
    const completeA = (a.publisher ? 1 : 0) + (a.pageCount ? 1 : 0) + (a.publishedDate ? 1 : 0);
    const completeB = (b.publisher ? 1 : 0) + (b.pageCount ? 1 : 0) + (b.publishedDate ? 1 : 0);
    const scoreA = a.score + coverA * 3 + completeA;
    const scoreB = b.score + coverB * 3 + completeB;
    return scoreB - scoreA;
  })[0]!;
}

// ─── Build BookWork ───────────────────────────────────────────────────────────

function buildWork(
  partialWork: Omit<BookWork, "score" | "confidence" | "bestEdition" | "editions">,
  editions: BookEdition[],
  query: ScoringQuery
): BookWork {
  const deduped = dedupeEditions(editions);
  const best = pickBestEdition(deduped);
  const { score, confidence } = scoreWork({ ...partialWork, editions: deduped }, best, query);
  return {
    ...partialWork,
    editions: deduped,
    bestEdition: best,
    score,
    confidence,
  };
}

// ─── ISBN lookup ──────────────────────────────────────────────────────────────

/**
 * Full ISBN lookup pipeline.
 *
 * Returns a WorkLookupResult with the matched work and all its editions.
 * Confidence 95+ means the book can be auto-added without user confirmation
 * (but the UI should still show the match for review).
 */
export async function lookupByIsbn(rawIsbn: string): Promise<WorkLookupResult> {
  const parsed = parseIsbn(rawIsbn);
  if (!parsed) return { work: null, works: [], flatEditions: [], isbnMatch: false };

  const { isbn13 } = parsed;
  const query: ScoringQuery = { isbn13 };

  // Step 1: Fetch from both sources in parallel
  const [olResult, gbEditions] = await Promise.allSettled([
    olFetchEditionByIsbn(isbn13, query),
    gbFetchByIsbn(isbn13),
  ]);

  const olEdition = olResult.status === "fulfilled" ? olResult.value : null;
  const gbEditionList = gbEditions.status === "fulfilled" ? gbEditions.value : [];

  // Step 2: Build initial edition list
  const initialEditions: BookEdition[] = [
    ...(olEdition ? [olEdition.edition] : []),
    ...gbEditionList,
  ];

  if (!initialEditions.length) {
    return { work: null, works: [], flatEditions: [], isbnMatch: false };
  }

  // Step 3: If we have an OL work key, fetch work metadata + all editions
  const workKey = olEdition?.workKey;
  let authorNames: string[] = [];
  let workMeta: Awaited<ReturnType<typeof olFetchWork>> = null;
  let workEditions: BookEdition[] = [];

  if (workKey) {
    const [meta, editionsFetched, authors] = await Promise.allSettled([
      olFetchWork(workKey),
      olFetchWorkEditions(workKey, query, { workKey, authors: [] }),
      olResolveAuthors(olEdition?.authorKeys ?? []),
    ]);
    workMeta = meta.status === "fulfilled" ? meta.value : null;
    workEditions = editionsFetched.status === "fulfilled" ? editionsFetched.value : [];
    authorNames = authors.status === "fulfilled" ? authors.value : [];
  }

  // Step 4: Merge all editions
  const allEditions = dedupeEditions([
    ...initialEditions,
    ...workEditions,
  ]);

  // Step 5: Build work
  const title = workMeta?.title ?? initialEditions[0]?.title ?? "Unknown";
  const partialWork: Omit<BookWork, "score" | "confidence" | "bestEdition" | "editions"> = {
    workKey,
    title,
    subtitle: workMeta?.subtitle,
    authors: authorNames.length ? authorNames : [],
    description: workMeta?.description,
    genres: workMeta?.genres ?? [],
    editionCount: allEditions.length,
    canonicalLanguageCode: allEditions[0]?.languageCode,
    canonicalLanguage: allEditions[0]?.language,
  };

  const work = buildWork(partialWork, allEditions, query);

  return {
    work,
    works: [work],
    flatEditions: allEditions,
    isbnMatch: true,
  };
}

// ─── Text query lookup ────────────────────────────────────────────────────────

/**
 * Full text query lookup: title + optional author.
 *
 * Fetches from both Google Books and Open Library in parallel, then merges
 * works by title similarity.
 */
export async function lookupByQuery(
  title: string,
  author?: string,
  mode: "title" | "author" | "general" | "auto" = "auto"
): Promise<WorkLookupResult> {
  // Resolve "auto" → detect from the query text itself
  const resolvedMode: "author" | "general" =
    mode === "auto" ? detectQueryIntent(title) :
    mode === "title" ? "general" : mode;

  // In author mode `title` contains the author name; adjust the scoring query accordingly.
  const query: ScoringQuery = resolvedMode === "author"
    ? { author: title }
    : { title, author };

  const [gbResults, olResults] = await Promise.allSettled([
    gbFetchByQuery(title, author, query, resolvedMode),
    olFetchByQuery(title, author, query, resolvedMode),
  ]);

  const gbWorks =
    gbResults.status === "fulfilled" ? gbResults.value : [];
  const olWorks =
    olResults.status === "fulfilled" ? olResults.value : [];

  // Build work candidates
  const candidates: BookWork[] = [];

  // Open Library works
  for (const { partialWork, bestEdition } of olWorks) {
    const editionScore = scoreEdition(bestEdition, query, {
      workKey: partialWork.workKey,
      authors: partialWork.authors,
    });
    const scoredEdition: BookEdition = { ...bestEdition, score: editionScore };
    const work = buildWork(partialWork, [scoredEdition], query);
    candidates.push(work);
  }

  // Google Books works — merge with OL works that share the same title
  for (const { work: partialWork, edition } of gbWorks) {
    const qTitleTokens = tokenize(title);
    const wTitleTokens = tokenize(partialWork.title);
    const overlap = qTitleTokens.filter((t) => wTitleTokens.includes(t)).length;
    const similarity = qTitleTokens.length ? overlap / qTitleTokens.length : 0;

    // Try to merge with existing OL work if title matches well
    const existingIdx = candidates.findIndex((c) => {
      const cTokens = tokenize(c.title);
      const hits = wTitleTokens.filter((t) => cTokens.includes(t)).length;
      return Math.max(wTitleTokens.length, cTokens.length) > 0 &&
        hits / Math.max(wTitleTokens.length, cTokens.length) >= 0.7;
    });

    if (existingIdx !== -1 && similarity >= 0.5) {
      // Merge edition into existing work
      const existing = candidates[existingIdx]!;
      const mergedEditions = dedupeEditions([...existing.editions, edition]);
      const best = pickBestEdition(mergedEditions);
      const { score, confidence } = scoreWork(existing, best, query);
      candidates[existingIdx] = {
        ...existing,
        // Fill missing metadata from GB
        description: existing.description ?? partialWork.description,
        genres: existing.genres.length ? existing.genres : partialWork.genres,
        editions: mergedEditions,
        bestEdition: best,
        score,
        confidence,
      };
    } else {
      // New work from Google Books
      const work = buildWork(partialWork, [edition], query);
      candidates.push(work);
    }
  }

  // Sort by score descending
  const sorted = candidates.sort((a, b) => b.score - a.score);
  const flatEditions = dedupeEditions(sorted.flatMap((w) => w.editions));

  return {
    work: sorted[0] ?? null,
    works: sorted,
    flatEditions,
    isbnMatch: false,
  };
}

// ─── Fetch all editions ───────────────────────────────────────────────────────

/**
 * Fetch all editions for a known work key (for the EditionsSheet).
 * Re-uses the OL editions endpoint.
 */
export async function fetchAllEditions(
  workKey: string,
  query: ScoringQuery,
  workContext?: { authors?: string[]; seriesName?: string }
): Promise<{ editions: BookEdition[]; groups: EditionGroup[] }> {
  const editions = await olFetchWorkEditions(workKey, query, { workKey, ...workContext });
  const deduped = dedupeEditions(editions);
  const groups = groupEditionsByLanguage(deduped);
  return { editions: deduped, groups };
}

// ─── Convert to NewBookInput ──────────────────────────────────────────────────

import { NewBookInput } from "../types/models";

/**
 * Convert a BookWork + chosen edition into the NewBookInput shape for addBook().
 */
export function workEditionToNewBookInput(
  work: BookWork,
  edition: BookEdition,
  source: NewBookInput["source"] = "search"
): NewBookInput {
  return {
    title: edition.title ?? work.title,
    authorName: work.authors[0] ?? "Unknown Author",
    isbn: edition.isbn13 ?? edition.isbn10,
    pages: edition.pageCount,
    genre: work.genres,
    publisher: edition.publisher,
    publishedDate: edition.publishedDate,
    language: edition.language ?? "English",
    synopsis: work.description,
    coverImageUri: edition.coverUrl,
    workKey: work.workKey,
    editionKey: edition.editionKey,
    editionCount: work.editionCount,
    isBestseller: undefined,
    tags: [],
    source,
    ownership: "owned",
    wishlist: false,
    wantToBuy: false,
  };
}
