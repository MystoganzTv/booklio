/**
 * Book Intelligence Engine — Google Books provider.
 *
 * Exposes three query modes:
 *   fetchByIsbn(isbn13)          — Look up a specific edition by ISBN
 *   fetchByGoogleId(id, query)   — Fetch volumes related to a known Google ID
 *   fetchByQuery(title, author)  — Full-text search
 *
 * All return BookEdition[] normalized to the shared metadata schema.
 */

import { BookEdition, BookWork, EditionFormat } from "../types/bookMetadata";
import { normalizeLanguage } from "../utils/languageUtils";
import { normalizeBookGenres } from "../utils/genres";
import { scoreEdition, ScoringQuery } from "./bookMatchScorer";

// ─── Constants ────────────────────────────────────────────────────────────────

const GB_BASE = "https://www.googleapis.com/books/v1/volumes";
const GB_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY ?? "";
const MAX_RESULTS_ISBN = 5;
const MAX_RESULTS_QUERY = 15;

// ─── Raw API types ─────────────────────────────────────────────────────────────

interface GBIndustryIdentifier {
  type: "ISBN_10" | "ISBN_13" | string;
  identifier: string;
}

interface GBImageLinks {
  thumbnail?: string;
  smallThumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
}

interface GBVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  industryIdentifiers?: GBIndustryIdentifier[];
  pageCount?: number;
  categories?: string[];
  language?: string;
  imageLinks?: GBImageLinks;
  seriesInfo?: { bookDisplayNumber?: string; volumeSeries?: { seriesId?: string; seriesBookType?: string; orderNumber?: number }[] };
  printType?: string;
  averageRating?: number;
  ratingsCount?: number;
}

interface GBVolume {
  id: string;
  volumeInfo: GBVolumeInfo;
}

interface GBResponse {
  totalItems?: number;
  items?: GBVolume[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function apiKey(): string {
  return GB_API_KEY ? `&key=${GB_API_KEY}` : "";
}

function gbCoverUrl(links?: GBImageLinks): string | undefined {
  const raw =
    links?.medium ??
    links?.large ??
    links?.thumbnail ??
    links?.small ??
    links?.smallThumbnail;
  if (!raw) return undefined;
  return raw
    .replace(/^http:\/\//, "https://")
    .replace(/&zoom=\d/, "&zoom=2");
}

function parsePublishedYear(date?: string): number | undefined {
  if (!date) return undefined;
  const year = parseInt(date.slice(0, 4), 10);
  return isNaN(year) ? undefined : year;
}

function normalizeFormat(printType?: string): EditionFormat | undefined {
  if (!printType) return undefined;
  switch (printType.toLowerCase()) {
    case "book": return "paperback";
    case "magazine": return "other";
    default: return "other";
  }
}

// ─── Volume → BookEdition ─────────────────────────────────────────────────────

function volumeToEdition(
  vol: GBVolume,
  query: ScoringQuery,
  workContext?: { workKey?: string; authors?: string[]; seriesName?: string }
): BookEdition {
  const info = vol.volumeInfo;
  const isbn13 = info.industryIdentifiers?.find((x) => x.type === "ISBN_13")?.identifier;
  const isbn10 = info.industryIdentifiers?.find((x) => x.type === "ISBN_10")?.identifier;
  const lang = normalizeLanguage(info.language);
  const publishedYear = parsePublishedYear(info.publishedDate);

  const partial: Omit<BookEdition, "score"> = {
    id: `gb:${vol.id}`,
    isbn13,
    isbn10,
    googleBooksId: vol.id,
    source: "google-books",
    title: info.title ?? "Untitled",
    subtitle: info.subtitle,
    languageCode: lang?.code ?? "en",
    language: lang?.name ?? "English",
    publisher: info.publisher,
    publishedDate: info.publishedDate,
    publishedYear,
    pageCount: info.pageCount,
    format: normalizeFormat(info.printType),
    coverUrl: gbCoverUrl(info.imageLinks),
  };

  const score = scoreEdition(partial, query, workContext);
  return { ...partial, score };
}

// ─── Volume → BookWork ────────────────────────────────────────────────────────

export function volumeToWork(vol: GBVolume, query: ScoringQuery): {
  work: Omit<BookWork, "score" | "confidence" | "bestEdition" | "editions">;
  edition: BookEdition;
} {
  const info = vol.volumeInfo;
  const seriesVol = info.seriesInfo?.volumeSeries?.[0];
  const edition = volumeToEdition(vol, query);

  const work: Omit<BookWork, "score" | "confidence" | "bestEdition" | "editions"> = {
    googleBooksId: vol.id,
    title: info.title ?? "Untitled",
    subtitle: info.subtitle,
    authors: info.authors ?? [],
    description: info.description,
    genres: normalizeBookGenres(info.categories, info.description),
    seriesName: seriesVol ? `Series ${seriesVol.seriesId ?? ""}` : undefined,
    seriesOrder: seriesVol?.orderNumber,
    canonicalLanguageCode: edition.languageCode,
    canonicalLanguage: edition.language,
    averageRating: info.averageRating,
    ratingsCount: info.ratingsCount,
  };

  return { work, edition };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch editions for a specific ISBN-13.
 */
export async function fetchByIsbn(isbn13: string): Promise<BookEdition[]> {
  try {
    const url = `${GB_BASE}?q=isbn:${isbn13}&maxResults=${MAX_RESULTS_ISBN}${apiKey()}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as GBResponse;
    const query: ScoringQuery = { isbn13 };
    return (data.items ?? []).map((vol) => volumeToEdition(vol, query));
  } catch {
    return [];
  }
}

/**
 * Fetch all volumes from a Google Books series/work by querying the title.
 * Used to enrich a known work with more editions from Google Books.
 */
export async function fetchByTitle(
  title: string,
  author?: string
): Promise<BookEdition[]> {
  try {
    const authorPart = author
      ? `+inauthor:${encodeURIComponent(author)}`
      : "";
    const url = `${GB_BASE}?q=intitle:${encodeURIComponent(title)}${authorPart}&maxResults=${MAX_RESULTS_QUERY}${apiKey()}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as GBResponse;
    const query: ScoringQuery = { title, author };
    return (data.items ?? []).map((vol) => volumeToEdition(vol, query));
  } catch {
    return [];
  }
}

// ─── Genre → Google Books subject map ────────────────────────────────────────

const GENRE_TO_SUBJECT: Record<string, string> = {
  "Fantasy":            "fantasy",
  "Science Fiction":    "science+fiction",
  "Mystery":            "mystery",
  "Thriller":           "thriller",
  "Romance":            "romance",
  "Horror":             "horror",
  "Historical Fiction": "historical+fiction",
  "Adventure":          "adventure",
  "Literary Fiction":   "literary+fiction",
  "Young Adult":        "young+adult",
  "Children's":         "juvenile+fiction",
  "Biography":          "biography",
  "Nonfiction":         "nonfiction",
  "History":            "history",
  "Personal Growth":    "self+help",
  "Poetry":             "poetry",
  "Comics":             "comics",
};

export interface GenreBookResult {
  id: string;
  title: string;
  authors: string[];
  isbn13?: string;
  coverUrl?: string;
  publishedYear?: number;
  pageCount?: number;
  description?: string;
  genres: string[];
  language?: string;
  googleBooksId: string;
  averageRating?: number;
  ratingsCount?: number;
}

/**
 * Fetch books from Google Books for a given genre/subject.
 * Returns paginated results — call with increasing startIndex for more.
 */
export async function fetchByGenre(
  genre: string,
  startIndex = 0,
  maxResults = 40
): Promise<{ books: GenreBookResult[]; totalItems: number }> {
  try {
    const subject = GENRE_TO_SUBJECT[genre] ?? encodeURIComponent(genre.toLowerCase());
    const url = `${GB_BASE}?q=subject:${subject}&startIndex=${startIndex}&maxResults=${maxResults}&orderBy=relevance&printType=books${apiKey()}`;
    const res = await fetch(url);
    if (!res.ok) return { books: [], totalItems: 0 };
    const data = (await res.json()) as GBResponse;

    const books: GenreBookResult[] = (data.items ?? [])
      // Require at least a thumbnail — books with no imageLinks will render as blank squares
      .filter((vol) => vol.volumeInfo.title && (vol.volumeInfo.imageLinks?.thumbnail ?? vol.volumeInfo.imageLinks?.smallThumbnail))
      .map((vol): GenreBookResult => {
        const info = vol.volumeInfo;
        const isbn13 = info.industryIdentifiers?.find((x) => x.type === "ISBN_13")?.identifier;
        const lang = normalizeLanguage(info.language);
        return {
          id: `gb:${vol.id}`,
          title: info.title ?? "Untitled",
          authors: info.authors ?? [],
          isbn13,
          coverUrl: gbCoverUrl(info.imageLinks),
          publishedYear: parsePublishedYear(info.publishedDate),
          pageCount: info.pageCount,
          description: info.description,
          genres: normalizeBookGenres(info.categories),
          language: lang?.name,
          googleBooksId: vol.id,
          averageRating: info.averageRating,
          ratingsCount: info.ratingsCount,
        };
      });

    return { books, totalItems: data.totalItems ?? 0 };
  } catch {
    return { books: [], totalItems: 0 };
  }
}

/**
 * Free-text keyword catalog search — used by Discover moods and search bar.
 * Unlike fetchByGenre (subject:X), this searches across all fields.
 */
export async function fetchByKeyword(
  query: string,
  startIndex = 0,
  maxResults = 40
): Promise<{ books: GenreBookResult[]; totalItems: number }> {
  try {
    const url = `${GB_BASE}?q=${encodeURIComponent(query)}&startIndex=${startIndex}&maxResults=${maxResults}&orderBy=relevance&printType=books${apiKey()}`;
    const res = await fetch(url);
    if (!res.ok) return { books: [], totalItems: 0 };
    const data = (await res.json()) as GBResponse;

    const books: GenreBookResult[] = (data.items ?? [])
      // Require at least a thumbnail — books with no imageLinks will render as blank squares
      .filter((vol) => vol.volumeInfo.title && (vol.volumeInfo.imageLinks?.thumbnail ?? vol.volumeInfo.imageLinks?.smallThumbnail))
      .map((vol): GenreBookResult => {
        const info = vol.volumeInfo;
        const isbn13 = info.industryIdentifiers?.find((x) => x.type === "ISBN_13")?.identifier;
        const lang = normalizeLanguage(info.language);
        return {
          id: `gb:${vol.id}`,
          title: info.title ?? "Untitled",
          authors: info.authors ?? [],
          isbn13,
          coverUrl: gbCoverUrl(info.imageLinks),
          publishedYear: parsePublishedYear(info.publishedDate),
          pageCount: info.pageCount,
          description: info.description,
          genres: normalizeBookGenres(info.categories),
          language: lang?.name,
          googleBooksId: vol.id,
          averageRating: info.averageRating,
          ratingsCount: info.ratingsCount,
        };
      });

    return { books, totalItems: data.totalItems ?? 0 };
  } catch {
    return { books: [], totalItems: 0 };
  }
}

/**
 * Full-text search: returns BookWork-shaped results.
 *
 * Each Google Books volume is treated as a potential work (since Google Books
 * doesn't have a native "work" concept separate from volumes).
 *
 * For title/general mode we use per-word `intitle:` prefixes so Google only
 * returns volumes where those words appear in the title — much better precision
 * than a plain free-text query. Author mode uses `inauthor:` as before.
 *
 * Returns `gbRank` (0-based position in Google's response) so the aggregator
 * can preserve Google's own relevance ordering within a bucket.
 */
export async function fetchWorksByQuery(
  title: string,
  author?: string,
  query?: ScoringQuery,
  mode: "title" | "author" | "general" = "general"
): Promise<Array<{
  work: Omit<BookWork, "score" | "confidence" | "bestEdition" | "editions">;
  edition: BookEdition;
  gbRank: number;
}>> {
  try {
    let queryStr: string;
    if (mode === "author") {
      // Author search: inauthor:Dan+inauthor:Brown
      // Using one inauthor: token per word (instead of a quoted phrase) lets
      // Google do its own normalization — so "rebeca yarros" still finds
      // "Rebecca Yarros", and "dan brown" finds "Dan Brown".
      // A quoted phrase like inauthor:"rebeca yarros" returns 0 on any typo.
      const tokens = title.trim().split(/\s+/).filter(Boolean);
      queryStr = tokens.map((t) => `inauthor:${encodeURIComponent(t)}`).join("+");
    } else {
      // Title search: intitle:The%20Secret%20of%20Secrets
      // Single intitle: with the full phrase; %20 for spaces.
      const encodedTitle = encodeURIComponent(title.trim());
      const authorPart = author
        ? `+inauthor:${encodeURIComponent(author.trim())}`
        : "";
      queryStr = `intitle:${encodedTitle}${authorPart}`;
    }

    // Author queries fetch more results so users get the full catalog.
    const maxResults = mode === "author" ? 40 : MAX_RESULTS_QUERY;
    const url = `${GB_BASE}?q=${queryStr}&maxResults=${maxResults}${apiKey()}`;

    // ── DEBUG: log the exact URL and raw results ──────────────────────────────
    console.log(`[GB] mode=${mode} url=${url.replace(/key=[^&]+/, "key=REDACTED")}`);

    const res = await fetch(url);
    if (!res.ok) {
      console.log(`[GB] HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as GBResponse;
    const items = data.items ?? [];
    console.log(`[GB] raw results: ${items.length}`);
    items.forEach((vol, i) => {
      console.log(`  [${i}] "${vol.volumeInfo.title}" — authors: ${JSON.stringify(vol.volumeInfo.authors ?? [])}`);
    });

    const q: ScoringQuery = query ?? { title, author };
    return items.map((vol, idx) => ({
      ...volumeToWork(vol, q),
      gbRank: idx,
    }));
  } catch (err) {
    console.log("[GB] fetch error:", err);
    return [];
  }
}
