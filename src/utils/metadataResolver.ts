/**
 * metadataResolver — unified book-metadata resolution.
 *
 * Replaces the old sequential waterfall (OL → OL → OL → patch with GB) with:
 *   1. PARALLEL fan-out to every source (Google Books + Open Library + the
 *      curated knownWorks catalog), with a hard time budget.
 *   2. FIELD-LEVEL SCORING — each field of the final result is picked from the
 *      best candidate (synopsis: length × language match; cover: language +
 *      source quality; title: localized when a language is requested), instead
 *      of "first non-null source wins".
 *   3. CACHE — results are cached for 7 days (AsyncStorage), so re-fetching a
 *      book is instant and saves API quota.
 *
 * `resolveBookMetadata` in utils/bookMetadata.ts delegates here, so every
 * caller (EditBook fetch, Find synopsis, enrichBookInput) gets this for free.
 */
import { fetchByKeyword, GenreBookResult } from "../services/googleBooksProvider";
import {
  BookEditionOption,
  BookMetadata,
  fetchBookMetadataByIsbn,
  fetchBookMetadataByTitleAuthor,
  fetchEditionOptionsByWorkKey,
  normalizeIsbn,
} from "./bookMetadata";
import { HOURS, readCache, writeCache } from "./discoverCache";
import { getTitleVariants } from "./knownWorks";
import { logMergeRejection } from "./metadataMergePolicy";
import { languageCode, languageDisplayName } from "./languageUtils";

export type ResolveInput = {
  isbn?: string;
  title?: string;
  authorName?: string;
  workKey?: string;
  /** Preferred edition language, e.g. "Spanish". */
  language?: string;
};

type SourceTag = "gb-isbn" | "gb-lang" | "gb-title" | "ol-isbn" | "ol-search";

type Candidate = BookMetadata & {
  _src: SourceTag;
  _langMatch: boolean;
};

const TIME_BUDGET_MS = 8_000;
const CACHE_TTL = 7 * 24 * HOURS;

// ─── helpers ──────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

const norm = (value?: string) => (value ?? "").trim().toLowerCase();

function gbToMetadata(book: GenreBookResult): BookMetadata {
  return {
    title: book.title,
    authorName: book.authors[0],
    isbn: book.isbn13,
    pages: book.pageCount,
    genre: book.genres?.length ? book.genres : undefined,
    publishedDate: book.publishedYear ? String(book.publishedYear) : undefined,
    language: book.language,
    publisher: book.publisher,
    synopsis: book.description,
    coverImageUri: book.coverUrl,
  };
}

function tag(meta: BookMetadata | undefined, src: SourceTag, wantedLang?: string): Candidate[] {
  if (!meta) return [];
  return [{
    ...meta,
    _src: src,
    _langMatch: Boolean(wantedLang && norm(meta.language) === wantedLang),
  }];
}

function tagGb(books: GenreBookResult[], src: SourceTag, wantedLang?: string, limit = 4): Candidate[] {
  return books.slice(0, limit).map((book) => ({
    ...gbToMetadata(book),
    _src: src,
    _langMatch: Boolean(wantedLang && norm(book.language) === wantedLang),
  }));
}

/** Source trust order for tie-breaks: exact-ISBN sources beat searches. */
const SRC_RANK: Record<SourceTag, number> = {
  "gb-isbn": 5,
  "ol-isbn": 4,
  "gb-lang": 3,
  "gb-title": 2,
  "ol-search": 1,
};

// ─── resolver ─────────────────────────────────────────────────────────────────

export async function resolveMetadata(input: ResolveInput): Promise<BookMetadata | undefined> {
  const cleanIsbn = normalizeIsbn(input.isbn);
  const title = input.title?.trim() ?? "";
  const author = input.authorName?.trim() ?? "";
  const wantedLang = norm(input.language) || undefined;
  const wantedCode = languageCode(input.language);

  if (!cleanIsbn && !title) return undefined;

  // ── Cache ──────────────────────────────────────────────────────────────────
  const cacheKey = `meta-${cleanIsbn || `${norm(title)}|${norm(author)}`}-${wantedCode ?? "any"}`;
  const cached = await readCache<BookMetadata>(cacheKey, CACHE_TTL);
  if (cached?.title) return cached;

  // ── Parallel fan-out ───────────────────────────────────────────────────────
  const authorPart = author ? ` inauthor:"${author}"` : "";
  const jobs: Array<Promise<Candidate[]>> = [];

  if (cleanIsbn.length >= 10) {
    // GB by ISBN — when the user holds e.g. the Spanish edition, this single
    // call returns the localized title + description directly.
    jobs.push(
      withTimeout(fetchByKeyword(`isbn:${cleanIsbn}`, 0, 5, undefined, false), TIME_BUDGET_MS)
        .then(({ books }) => tagGb(books, "gb-isbn", wantedLang)).catch(() => [])
    );
    // OL by ISBN — best source for workKey/editionKey/publisher.
    jobs.push(
      withTimeout(fetchBookMetadataByIsbn(cleanIsbn), TIME_BUDGET_MS)
        .then((meta) => tag(meta, "ol-isbn", wantedLang)).catch(() => [])
    );
  }

  if (title) {
    // GB by title (+author), unrestricted — strongest general base.
    jobs.push(
      withTimeout(fetchByKeyword(`intitle:"${title}"${authorPart}`, 0, 8, undefined, false), TIME_BUDGET_MS)
        .then(({ books }) => tagGb(books, "gb-title", wantedLang)).catch(() => [])
    );
    // OL search — work-level data (workKey, series, author canonical name).
    jobs.push(
      withTimeout(fetchBookMetadataByTitleAuthor(title, author), TIME_BUDGET_MS)
        .then((meta) => tag(meta, "ol-search", wantedLang)).catch(() => [])
    );

    if (wantedCode) {
      // GB language-restricted — the original title sometimes matches
      // (e.g. "Red Rising" kept in French editions).
      jobs.push(
        withTimeout(fetchByKeyword(`intitle:"${title}"${authorPart}`, 0, 8, wantedCode, false), TIME_BUDGET_MS)
          .then(({ books }) => tagGb(books, "gb-lang", wantedLang)).catch(() => [])
      );
      // knownWorks translated titles ("Alas de sangre" for "Fourth Wing"…).
      for (const variant of getTitleVariants(title)) {
        if (norm(variant) === norm(title)) continue;
        jobs.push(
          withTimeout(fetchByKeyword(`intitle:"${variant}"${authorPart}`, 0, 6, wantedCode, false), TIME_BUDGET_MS)
            .then(({ books }) => tagGb(books, "gb-lang", wantedLang)).catch(() => [])
        );
      }
    }
  }

  const settled = await Promise.allSettled(jobs);
  const candidates: Candidate[] = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (!candidates.length) return undefined;

  // ── Field-level composition (STRICT language policy) ─────────────────────
  // With a selected language, language-locked fields (title, synopsis, cover,
  // ISBN, publisher, dates, pages) may ONLY come from candidates in that
  // language. No silent fallback to another language — missing means empty.
  const byRank = [...candidates].sort((a, b) => SRC_RANK[b._src] - SRC_RANK[a._src]);
  const strict = Boolean(wantedLang);
  const lockedPool = strict ? byRank.filter((cand) => cand._langMatch) : byRank;

  const pick = <K extends keyof BookMetadata>(
    key: K,
    pool: Candidate[],
    valid: (v: BookMetadata[K]) => boolean = (v) => v != null && v !== ""
  ): BookMetadata[K] | undefined => {
    for (const candidate of pool) {
      const value = candidate[key];
      if (valid(value)) return value;
    }
    return undefined;
  };

  /** Locked-field pick: language-matching candidates only; log when a value
   *  existed in another language but was rejected by the policy. */
  const pickLocked = <K extends keyof BookMetadata>(
    key: K,
    valid: (v: BookMetadata[K]) => boolean = (v) => v != null && v !== ""
  ): BookMetadata[K] | undefined => {
    const value = pick(key, lockedPool, valid);
    if (value === undefined && strict && pick(key, byRank, valid) !== undefined) {
      logMergeRejection(String(key), "language_mismatch");
    }
    return value;
  };

  // Synopsis: among language-allowed candidates, prefer the longest real text.
  const synopsisPool = lockedPool
    .filter((cand) => (cand.synopsis?.trim().length ?? 0) > 40)
    .sort((a, b) => (b.synopsis?.length ?? 0) - (a.synopsis?.length ?? 0));
  if (strict && !synopsisPool.length &&
      candidates.some((cand) => (cand.synopsis?.trim().length ?? 0) > 40)) {
    logMergeRejection("synopsis", "language_mismatch");
  }

  const result: BookMetadata = {
    // Locked fields — selected-language candidates only
    title: pickLocked("title"),
    isbn: pickLocked("isbn") ?? (strict ? undefined : cleanIsbn || undefined),
    pages: pickLocked("pages", (v) => typeof v === "number" && v > 0),
    publisher: pickLocked("publisher"),
    publishedDate: pickLocked("publishedDate"),
    language: pickLocked("language"),
    synopsis: synopsisPool[0]?.synopsis,
    coverImageUri: pickLocked("coverImageUri"),
    editionKey: pickLocked("editionKey"),
    // Structural fields — language-agnostic by policy
    authorName: pick("authorName", byRank),
    genre: pick("genre", byRank, (v) => Array.isArray(v) && v.length > 0),
    workKey: input.workKey ?? pick("workKey", byRank),
    editionCount: pick("editionCount", byRank, (v) => typeof v === "number" && v > 0),
    format: pick("format", byRank),
    isBestseller: pick("isBestseller", byRank, (v) => v === true),
    tags: pick("tags", byRank, (v) => Array.isArray(v) && v.length > 0),
  };

  // Only cache successes. When a language was requested, only cache results
  // that actually landed in that language — otherwise a transient miss (e.g.
  // one timed-out call) would pin the wrong-language result for 7 days.
  const cacheable = Boolean(result.title) && (!wantedLang || norm(result.language) === wantedLang);
  if (cacheable) void writeCache(cacheKey, result);
  return result.title ? result : undefined;
}


// ─── Edition discovery ────────────────────────────────────────────────────────

export type FindEditionsOpts = {
  /** Open Library work key — unlocks the editions-of-this-work fallback. */
  workKey?: string;
  /** Current edition ISBN — logged for diagnosis. */
  isbn?: string;
  limit?: number;
};

const logSearch = (msg: string) => {
  if (__DEV__) console.log(`[EDITION_SWITCH_SEARCH] ${msg}`);
};

/** Keep only editions in the wanted language; dedupe; rank by usefulness. */
function filterAndRankEditions(
  all: GenreBookResult[],
  wanted: string,
  limit: number
): GenreBookResult[] {
  const seen = new Set<string>();
  const out: GenreBookResult[] = [];
  for (const book of all) {
    // STRICT: never offer an edition in another language (rule: no silent
    // English when the user asked for Spanish).
    if (norm(book.language) !== wanted) continue;
    const key = book.isbn13 ?? book.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(book);
  }
  // Rank: synopsis available > cover available > popularity.
  out.sort((a, b) =>
    (Number((b.description?.length ?? 0) > 40) - Number((a.description?.length ?? 0) > 40)) ||
    (Number(Boolean(b.coverUrl)) - Number(Boolean(a.coverUrl))) ||
    ((b.ratingsCount ?? 0) - (a.ratingsCount ?? 0))
  );
  return out.slice(0, limit);
}

/** Open Library edition record → catalog candidate shape. */
function olEditionToCandidate(option: BookEditionOption, authorName?: string): GenreBookResult {
  const cleanIsbn = (option.isbn ?? "").replace(/\D/g, "");
  return {
    id: option.editionKey ?? option.id,
    title: option.title,
    authors: authorName?.trim() ? [authorName.trim()] : [],
    isbn13: cleanIsbn.length === 13 ? cleanIsbn : undefined,
    coverUrl: option.coverImageUri,
    publishedYear: option.publishedDate ? Number(option.publishedDate.match(/\d{4}/)?.[0]) || undefined : undefined,
    pageCount: option.pages,
    description: undefined, // OL editions endpoint carries no description
    genres: [],
    language: option.language ? languageDisplayName(option.language) : undefined,
    publisher: option.publisher,
    googleBooksId: "",
  };
}

/**
 * Find catalog editions of a book (or other books by the author) in a given
 * language. Used by the EditBook language picker: the user chooses the actual
 * edition — title, ISBN, cover, and synopsis all switch together.
 *
 * Search ladder (stops at the first stage that yields candidates):
 *   1. Google Books: title (+ knownWorks variants) + author + langRestrict,
 *      plus a broad author sweep (surfaces translated titles we don't know).
 *   2. Open Library: editions of THIS work (by workKey, resolved via OL search
 *      when missing) filtered by language — works even when GB indexes the
 *      translation poorly.
 *   3. Google Books re-query with the translated titles stage 2 discovered
 *      (richer records: descriptions, ratings).
 */
export async function findEditionsInLanguage(
  title: string,
  authorName: string | undefined,
  language: string,
  opts: FindEditionsOpts = {}
): Promise<GenreBookResult[]> {
  const limit = opts.limit ?? 12;
  const code = languageCode(language);
  const wanted = norm(language);
  logSearch(
    `requestedLanguage=${language} (code=${code ?? "?"}) title="${title}" author="${authorName ?? ""}" ` +
    `workKey=${opts.workKey ?? "-"} isbn=${opts.isbn ?? "-"}`
  );
  if (!title.trim() || !code) {
    logSearch(`aborted: ${!title.trim() ? "empty title" : `unknown language "${language}"`}`);
    return [];
  }

  // ── Stage 1: Google Books ──────────────────────────────────────────────────
  const authorPart = authorName?.trim() ? ` inauthor:"${authorName.trim()}"` : "";
  const queries = [
    `intitle:"${title}"${authorPart}`,
    ...getTitleVariants(title)
      .filter((variant) => norm(variant) !== norm(title))
      .map((variant) => `intitle:"${variant}"${authorPart}`),
    `${title}${authorPart}`,
  ];
  // Broad author sweep last — surfaces the translated title even when we
  // don't know it ("Amanecer rojo" from inauthor:"Pierce Brown" + es).
  if (authorName?.trim()) queries.push(`inauthor:"${authorName.trim()}"`);

  const settled = await Promise.allSettled(
    queries.map((query) =>
      withTimeout(fetchByKeyword(query, 0, 20, code, false), TIME_BUDGET_MS)
        .then(({ books }) => {
          logSearch(`gb query=${JSON.stringify(query)} langRestrict=${code} -> ${books.length} raw`);
          return books;
        })
        .catch((err) => {
          logSearch(`gb query=${JSON.stringify(query)} FAILED (${err?.message ?? "error"})`);
          return [] as GenreBookResult[];
        })
    )
  );
  const gbAll = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  let out = filterAndRankEditions(gbAll, wanted, limit);
  logSearch(`stage1 google-books: ${gbAll.length} raw -> ${out.length} in ${language}`);
  if (out.length) return out;

  // ── Stage 2: Open Library editions of this work ────────────────────────────
  let workKey = opts.workKey;
  if (!workKey) {
    try {
      const meta = await withTimeout(fetchBookMetadataByTitleAuthor(title, authorName ?? ""), TIME_BUDGET_MS);
      workKey = meta?.workKey;
      logSearch(`ol work lookup "${title}" -> workKey=${workKey ?? "none"}`);
    } catch {
      logSearch("ol work lookup FAILED");
    }
  }
  let olCandidates: GenreBookResult[] = [];
  if (workKey) {
    try {
      const editions = await withTimeout(fetchEditionOptionsByWorkKey(workKey, 40), TIME_BUDGET_MS);
      olCandidates = editions
        .map((option) => olEditionToCandidate(option, authorName))
        .filter((candidate) => norm(candidate.language) === wanted);
      logSearch(`stage2 open-library workKey=${workKey}: ${editions.length} editions -> ${olCandidates.length} in ${language}`);
    } catch {
      logSearch(`stage2 open-library workKey=${workKey}: FAILED`);
    }
  } else {
    logSearch("stage2 skipped: no workKey");
  }

  // ── Stage 3: GB re-query with the translated titles OL discovered ──────────
  // OL edition records carry no synopsis/ratings; once we KNOW the translated
  // title, Google Books usually has the richer record for it.
  const translatedTitles = [...new Set(
    olCandidates.map((candidate) => candidate.title.trim()).filter((v) => v && norm(v) !== norm(title))
  )].slice(0, 3);
  let gbRequery: GenreBookResult[] = [];
  if (translatedTitles.length) {
    const requerySettled = await Promise.allSettled(
      translatedTitles.map((translated) =>
        withTimeout(fetchByKeyword(`intitle:"${translated}"${authorPart}`, 0, 10, code, false), TIME_BUDGET_MS)
          .then(({ books }) => {
            logSearch(`stage3 gb requery intitle="${translated}" -> ${books.length} raw`);
            return books;
          })
          .catch(() => [] as GenreBookResult[])
      )
    );
    gbRequery = requerySettled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  }

  // GB re-query results first (they carry descriptions), then bare OL editions.
  out = filterAndRankEditions([...gbRequery, ...olCandidates], wanted, limit);
  logSearch(`final: ${out.length} candidate(s) in ${language}${out.length === 0 ? " — NO EDITION FOUND, caller must show explicit failure" : ""}`);
  return out;
}
