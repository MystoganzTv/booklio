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
  lookupByIsbn as knownLookupByIsbn,
  lookupByTitle as knownLookupByTitle,
  inferSeriesData,
  getOriginalTitle,
} from "../utils/knownWorks";
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

// ─── Known-works enrichment ───────────────────────────────────────────────────

/**
 * Enrich a BookWork with series/translation data from the local known-works catalog.
 * Called after every API lookup — fills gaps the APIs often miss.
 */
function enrichWorkFromCatalog(work: BookWork): BookWork {
  // Already has series — only fill if missing
  const needsSeries = !work.seriesName;
  const needsOriginalTitle = false; // could add a field later

  if (!needsSeries) return work;

  // Try by title first
  const byTitle = knownLookupByTitle(work.title);
  if (byTitle?.seriesName) {
    return {
      ...work,
      seriesName: byTitle.seriesName,
      seriesOrder: byTitle.seriesOrder,
    };
  }

  // Try by best edition ISBN
  const isbn = work.bestEdition?.isbn13 ?? work.bestEdition?.isbn10;
  if (isbn) {
    const byIsbn = knownLookupByIsbn(isbn);
    if (byIsbn?.seriesName) {
      return {
        ...work,
        seriesName: byIsbn.seriesName,
        seriesOrder: byIsbn.seriesOrder,
        // Also store original title via description tag if it was translated
        description: work.description ??
          (byIsbn.originalTitle !== work.title
            ? `Originally published as: ${byIsbn.originalTitle}`
            : undefined),
      };
    }
  }

  // Try author + title matching
  if (work.authors.length) {
    const inferred = inferSeriesData(work.title, work.authors[0]!);
    if (inferred) {
      return { ...work, seriesName: inferred.seriesName, seriesOrder: inferred.seriesOrder };
    }
  }

  return work;
}

// ─── ISBN lookup ──────────────────────────────────────────────────────────────

/**
 * Full ISBN lookup pipeline — with cascading fallbacks.
 *
 * Pipeline:
 *   1. Check local known-works catalog (instant, offline)
 *   2. Parallel: Google Books ISBN + Open Library ISBN
 *   3. If GB/OL return nothing: try ISBN-10 variant (for 979-prefixed ISBNs)
 *   4. If still nothing: fall back to title/author search using catalog data
 *   5. Enrich found work with series/translation data from catalog
 *
 * Returns a WorkLookupResult. Never returns null work if the ISBN is a
 * known book in the catalog.
 */
export async function lookupByIsbn(rawIsbn: string): Promise<WorkLookupResult> {
  const parsed = parseIsbn(rawIsbn);
  if (!parsed) return { work: null, works: [], flatEditions: [], isbnMatch: false };

  const { isbn13, isbn10 } = parsed;
  const query: ScoringQuery = { isbn13 };

  // ── Step 1: Check known-works catalog ──────────────────────────────────────
  const knownMeta = knownLookupByIsbn(isbn13);

  // ── Step 2: Parallel fetch from both API sources ───────────────────────────
  const [olResult, gbEditions] = await Promise.allSettled([
    olFetchEditionByIsbn(isbn13, query),
    gbFetchByIsbn(isbn13),
  ]);

  const olEdition = olResult.status === "fulfilled" ? olResult.value : null;
  let gbEditionList = gbEditions.status === "fulfilled" ? gbEditions.value : [];

  // ── Step 3: If APIs returned nothing, try ISBN-10 variant ─────────────────
  if (!olEdition && !gbEditionList.length && isbn10) {
    const [olFallback, gbFallback] = await Promise.allSettled([
      olFetchEditionByIsbn(isbn10, query),
      gbFetchByIsbn(isbn10),
    ]);
    const olFallbackEdition = olFallback.status === "fulfilled" ? olFallback.value : null;
    if (olFallbackEdition) {
      // Use ISBN-10 result but tag it with our ISBN-13
      olFallbackEdition.edition.isbn13 = isbn13;
    }
    gbEditionList = gbFallback.status === "fulfilled" ? gbFallback.value : [];
    if (gbEditionList[0]) gbEditionList[0].isbn13 = isbn13;
  }

  const initialEditions: BookEdition[] = [
    ...(olEdition ? [olEdition.edition] : []),
    ...gbEditionList,
  ];

  // ── Step 4: If still nothing, fall back to catalog-driven title search ─────
  if (!initialEditions.length) {
    if (knownMeta) {
      // We know what this ISBN is — search by original title
      const fallbackResult = await lookupByQuery(
        knownMeta.originalTitle,
        knownMeta.author
      );
      if (fallbackResult.work) {
        const enriched = enrichWorkFromCatalog(fallbackResult.work);
        // Apply catalog series data (highly reliable)
        const finalWork: BookWork = {
          ...enriched,
          seriesName: knownMeta.seriesName ?? enriched.seriesName,
          seriesOrder: knownMeta.seriesOrder ?? enriched.seriesOrder,
        };
        return {
          work: finalWork,
          works: [finalWork],
          flatEditions: fallbackResult.flatEditions,
          isbnMatch: true, // we confirmed via catalog
        };
      }
    }
    return { work: null, works: [], flatEditions: [], isbnMatch: false };
  }

  // ── Step 5: Fetch OL work metadata + all editions ─────────────────────────
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

  // ── Step 6: Merge all editions ─────────────────────────────────────────────
  const allEditions = dedupeEditions([...initialEditions, ...workEditions]);

  // ── Step 7: Build work ─────────────────────────────────────────────────────
  const title = workMeta?.title ?? initialEditions[0]?.title ?? "Unknown";

  // Fill authors from catalog if APIs didn't return them
  const resolvedAuthors = authorNames.length
    ? authorNames
    : knownMeta?.author
      ? [knownMeta.author]
      : [];

  const partialWork: Omit<BookWork, "score" | "confidence" | "bestEdition" | "editions"> = {
    workKey,
    title,
    subtitle: workMeta?.subtitle,
    authors: resolvedAuthors,
    description: workMeta?.description,
    genres: workMeta?.genres ?? [],
    editionCount: allEditions.length,
    canonicalLanguageCode: allEditions[0]?.languageCode,
    canonicalLanguage: allEditions[0]?.language,
    // Seed series from catalog — APIs rarely return this for non-English editions
    seriesName: knownMeta?.seriesName,
    seriesOrder: knownMeta?.seriesOrder,
  };

  let work = buildWork(partialWork, allEditions, query);

  // ── Step 8: Enrich with catalog data ───────────────────────────────────────
  work = enrichWorkFromCatalog(work);

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

  // ── Translation-aware query expansion ─────────────────────────────────────
  // If the query is a known translated title (e.g. "Alas de sangre"),
  // also search by the original English title ("Fourth Wing") in parallel.
  let searchTitle = title;
  let extraSearchTitle: string | null = null;

  if (resolvedMode !== "author") {
    const originalTitle = getOriginalTitle(title);
    if (originalTitle) extraSearchTitle = originalTitle;

    // Also check if catalog knows the author for this title
    const knownMeta = knownLookupByTitle(title);
    if (knownMeta && !author) {
      author = knownMeta.author;
    }
  }

  // In author mode `title` contains the author name; adjust the scoring query accordingly.
  const query: ScoringQuery = resolvedMode === "author"
    ? { author: title }
    : { title, author };

  // ── Parallel fetch — original title + translated title ────────────────────
  const fetchPromises: Promise<Parameters<typeof Promise.allSettled>[0] extends ReadonlyArray<infer T> ? T : never>[] = [
    gbFetchByQuery(searchTitle, author, query, resolvedMode),
    olFetchByQuery(searchTitle, author, query, resolvedMode),
  ];
  if (extraSearchTitle) {
    const extraQuery: ScoringQuery = { title: extraSearchTitle, author };
    fetchPromises.push(
      gbFetchByQuery(extraSearchTitle, author, extraQuery, resolvedMode),
      olFetchByQuery(extraSearchTitle, author, extraQuery, resolvedMode),
    );
  }

  const allSettled = await Promise.allSettled(fetchPromises);
  const [gbResults, olResults, gbExtra, olExtra] = allSettled;

  const gbWorks_ = [
    ...(gbResults?.status === "fulfilled" ? gbResults.value : []),
    ...(gbExtra?.status === "fulfilled" ? gbExtra.value : []),
  ];
  const olWorks_ = [
    ...(olResults?.status === "fulfilled" ? olResults.value : []),
    ...(olExtra?.status === "fulfilled" ? olExtra.value : []),
  ];

  // Re-assign to satisfy remaining code
  const [gbResults2, olResults2] = [
    { status: "fulfilled" as const, value: gbWorks_ },
    { status: "fulfilled" as const, value: olWorks_ },
  ];

  const gbWorks = gbResults2.value;
  const olWorks = olResults2.value;

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
  let sorted = candidates.sort((a, b) => b.score - a.score);

  // Enrich top results with catalog data (series, translation)
  sorted = sorted.map((w) => enrichWorkFromCatalog(w));

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
