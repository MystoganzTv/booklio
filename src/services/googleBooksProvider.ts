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
    genres: normalizeBookGenres(info.categories),
    seriesName: seriesVol ? `Series ${seriesVol.seriesId ?? ""}` : undefined,
    seriesOrder: seriesVol?.orderNumber,
    canonicalLanguageCode: edition.languageCode,
    canonicalLanguage: edition.language,
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
      .filter((vol) => vol.volumeInfo.title)
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
      .filter((vol) => vol.volumeInfo.title)
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
 */
export async function fetchWorksByQuery(
  title: string,
  author?: string,
  query?: ScoringQuery,
  mode: "title" | "author" | "general" = "general"
): Promise<Array<{
  work: Omit<BookWork, "score" | "confidence" | "bestEdition" | "editions">;
  edition: BookEdition;
}>> {
  try {
    let queryStr: string;
    if (mode === "author") {
      // Pure author search — "inauthor:" scopes the query to the author field only
      queryStr = `inauthor:${encodeURIComponent(title)}`;
    } else {
      // Title / general search — plain q= lets Google rank by relevance across all fields.
      // Using intitle: was too strict and caused "Dan Brown Companion"-style false positives.
      const authorPart = author ? `+inauthor:${encodeURIComponent(author)}` : "";
      queryStr = `${encodeURIComponent(title)}${authorPart}`;
    }
    const url = `${GB_BASE}?q=${queryStr}&maxResults=${MAX_RESULTS_QUERY}${apiKey()}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as GBResponse;
    const q: ScoringQuery = query ?? { title, author };
    return (data.items ?? []).map((vol) => volumeToWork(vol, q));
  } catch {
    return [];
  }
}
