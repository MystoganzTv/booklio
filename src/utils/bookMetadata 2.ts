import { NewBookInput } from "../types/models";
import { openLibraryUrl } from "./openLibrary";

export type SearchMode = "general" | "author";

export const OPEN_LIBRARY_PAGE_SIZE = 50;

type OpenLibraryIsbnResponse = {
  title?: string;
  authors?: { key: string }[];
  covers?: number[];
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  subjects?: string[];
  description?: string | { value?: string };
  isbn_13?: string[];
  isbn_10?: string[];
};

type OpenLibrarySearchDoc = {
  title?: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  first_publish_year?: number;
  publisher?: string[];
  number_of_pages_median?: number;
  subject?: string[];
};

type OpenLibrarySearchResponse = {
  numFound?: number;
  docs?: OpenLibrarySearchDoc[];
};

export type BookMetadata = {
  title?: string;
  authorName?: string;
  isbn?: string;
  pages?: number;
  genre?: string[];
  publisher?: string;
  publishedDate?: string;
  language?: string;
  synopsis?: string;
  coverImageUri?: string;
};

export const coverUrl = (coverId?: number) => (coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined);

const readDescription = (description?: string | { value?: string }) => {
  if (!description) return undefined;
  return typeof description === "string" ? description : description.value;
};

export const normalizeIsbn = (isbn?: string) => isbn?.replace(/[^0-9X]/gi, "") ?? "";

export const isPlaceholderText = (value?: string) => {
  const normalized = value?.trim().toLowerCase() ?? "";
  return (
    !normalized ||
    normalized.includes("pending") ||
    normalized.includes("unknown") ||
    normalized === "uncategorized" ||
    normalized.includes("open library") ||
    normalized.includes("metadata") ||
    normalized.includes("author to identify") ||
    normalized.startsWith("isbn book ") ||
    normalized === "untitled book" ||
    normalized === "new book"
  );
};

export const isPlaceholderGenreList = (genre?: string[]) =>
  !genre?.length || (genre.length === 1 && genre[0]?.trim().toLowerCase() === "uncategorized");

export const canFetchMetadata = (input: { isbn?: string; title?: string; authorName?: string }) => {
  const cleanIsbn = normalizeIsbn(input.isbn);
  return cleanIsbn.length >= 10 || Boolean(input.title?.trim());
};

async function fetchAuthorName(authorKey?: string) {
  if (!authorKey) return undefined;
  try {
    const response = await fetch(openLibraryUrl(`${authorKey}.json`));
    if (!response.ok) return undefined;
    const data = (await response.json()) as { name?: string };
    return data.name;
  } catch {
    return undefined;
  }
}

export async function fetchBookMetadataByIsbn(isbn: string): Promise<BookMetadata | undefined> {
  const cleanIsbn = normalizeIsbn(isbn);
  if (cleanIsbn.length < 10) return undefined;

  try {
    const response = await fetch(openLibraryUrl(`/isbn/${cleanIsbn}.json`));
    if (!response.ok) return undefined;
    const data = (await response.json()) as OpenLibraryIsbnResponse;
    const authorName = await fetchAuthorName(data.authors?.[0]?.key);

    return {
      title: data.title,
      authorName,
      isbn: data.isbn_13?.[0] ?? data.isbn_10?.[0] ?? cleanIsbn,
      pages: data.number_of_pages,
      genre: data.subjects?.slice(0, 4),
      publisher: data.publishers?.[0],
      publishedDate: data.publish_date,
      language: "English",
      synopsis: readDescription(data.description),
      coverImageUri: coverUrl(data.covers?.[0])
    };
  } catch {
    return undefined;
  }
}

export async function searchBookMetadata(
  query: string,
  mode: SearchMode = "general",
  offset = 0
): Promise<{ results: NewBookInput[]; total: number }> {
  const fields = "title,author_name,isbn,cover_i,first_publish_year,publisher,number_of_pages_median,subject";
  const limit = mode === "author" ? OPEN_LIBRARY_PAGE_SIZE : 25;
  const param = mode === "author"
    ? `author=${encodeURIComponent(query)}`
    : `q=${encodeURIComponent(query)}`;

  const response = await fetch(openLibraryUrl(`/search.json?${param}&limit=${limit}&offset=${offset}&fields=${fields}`));
  if (!response.ok) return { results: [], total: 0 };

  const data = (await response.json()) as OpenLibrarySearchResponse;
  const results = (data.docs ?? [])
    .filter((doc) => doc.title && doc.author_name?.[0])
    .map((doc) => mapSearchDocToBookInput(doc));

  return { results, total: data.numFound ?? results.length };
}

export async function fetchBookMetadataByTitleAuthor(title: string, authorName = ""): Promise<BookMetadata | undefined> {
  const query = `${title} ${authorName}`.trim();
  if (!query) return undefined;

  const { results } = await searchBookMetadata(query, "general", 0);
  const first = results[0];
  if (!first) return undefined;

  return {
    title: first.title,
    authorName: first.authorName,
    isbn: first.isbn,
    pages: first.pages,
    genre: first.genre,
    publisher: first.publisher,
    publishedDate: first.publishedDate,
    language: first.language,
    synopsis: first.synopsis,
    coverImageUri: first.coverImageUri
  };
}

export async function resolveBookMetadata(input: {
  isbn?: string;
  title?: string;
  authorName?: string;
}): Promise<BookMetadata | undefined> {
  const cleanIsbn = normalizeIsbn(input.isbn);
  const isbnMeta = cleanIsbn.length >= 10 ? await fetchBookMetadataByIsbn(cleanIsbn) : undefined;
  const resolvedTitle = input.title?.trim() || isbnMeta?.title || "";
  const resolvedAuthor = input.authorName?.trim() || isbnMeta?.authorName || "";
  const searchMeta = resolvedTitle ? await fetchBookMetadataByTitleAuthor(resolvedTitle, resolvedAuthor) : undefined;

  return mergeBookMetadata(isbnMeta, searchMeta) ?? mergeBookMetadata(searchMeta, isbnMeta);
}

export async function enrichBookInput(input: NewBookInput): Promise<NewBookInput> {
  const metadata = await resolveBookMetadata({
    isbn: input.isbn,
    title: input.title,
    authorName: input.authorName
  });

  return metadata ? applyMetadataToBookInput(input, metadata) : input;
}

export function metadataToBookInput(
  metadata: BookMetadata,
  source: NewBookInput["source"],
  overrides: Partial<NewBookInput> = {}
): NewBookInput {
  return {
    title: metadata.title ?? "Untitled Book",
    authorName: metadata.authorName ?? "Author to identify",
    isbn: metadata.isbn,
    pages: metadata.pages,
    genre: metadata.genre ?? ["Uncategorized"],
    publisher: metadata.publisher,
    publishedDate: metadata.publishedDate,
    language: metadata.language ?? "English",
    synopsis: metadata.synopsis ?? "Metadata imported from Open Library.",
    coverImageUri: metadata.coverImageUri,
    source,
    ownership: "owned",
    ...overrides
  };
}

export function applyMetadataToBookInput(input: NewBookInput, metadata: BookMetadata): NewBookInput {
  return {
    ...input,
    title: shouldUseMetadataValue(input.title, metadata.title) ? metadata.title ?? input.title : input.title,
    authorName: shouldUseMetadataValue(input.authorName, metadata.authorName) ? metadata.authorName ?? input.authorName : input.authorName,
    isbn: shouldUseMetadataValue(input.isbn, metadata.isbn) ? metadata.isbn ?? input.isbn : input.isbn,
    pages: shouldUseNumericMetadata(input.pages, metadata.pages) ? metadata.pages : input.pages,
    genre: shouldUseGenreMetadata(input.genre, metadata.genre) ? metadata.genre : input.genre,
    publisher: shouldUseMetadataValue(input.publisher, metadata.publisher) ? metadata.publisher ?? input.publisher : input.publisher,
    publishedDate: shouldUseMetadataValue(input.publishedDate, metadata.publishedDate) ? metadata.publishedDate ?? input.publishedDate : input.publishedDate,
    language: shouldUseMetadataValue(input.language, metadata.language) ? metadata.language ?? input.language : input.language,
    synopsis: shouldUseSynopsis(input.synopsis, metadata.synopsis) ? metadata.synopsis ?? input.synopsis : input.synopsis,
    coverImageUri: shouldUseMetadataValue(input.coverImageUri, metadata.coverImageUri) ? metadata.coverImageUri ?? input.coverImageUri : input.coverImageUri
  };
}

export function summarizeMetadataChanges(original: NewBookInput, updated: NewBookInput) {
  const changes: string[] = [];
  if (original.title !== updated.title) changes.push("title");
  if (original.authorName !== updated.authorName) changes.push("author");
  if (original.isbn !== updated.isbn) changes.push("ISBN");
  if (original.pages !== updated.pages) changes.push("pages");
  if ((original.genre ?? []).join("|") !== (updated.genre ?? []).join("|")) changes.push("genres");
  if (original.publisher !== updated.publisher) changes.push("publisher");
  if (original.publishedDate !== updated.publishedDate) changes.push("published date");
  if (original.synopsis !== updated.synopsis) changes.push("synopsis");
  if (original.coverImageUri !== updated.coverImageUri) changes.push("cover image");
  return changes;
}

export function mergeBookMetadata(
  primary?: BookMetadata,
  secondary?: BookMetadata
): BookMetadata | undefined {
  if (!primary && !secondary) return undefined;
  return {
    title: primary?.title ?? secondary?.title,
    authorName: primary?.authorName ?? secondary?.authorName,
    isbn: primary?.isbn ?? secondary?.isbn,
    pages: primary?.pages ?? secondary?.pages,
    genre: primary?.genre ?? secondary?.genre,
    publisher: primary?.publisher ?? secondary?.publisher,
    publishedDate: primary?.publishedDate ?? secondary?.publishedDate,
    language: primary?.language ?? secondary?.language,
    synopsis: primary?.synopsis ?? secondary?.synopsis,
    coverImageUri: primary?.coverImageUri ?? secondary?.coverImageUri
  };
}

function mapSearchDocToBookInput(doc: OpenLibrarySearchDoc): NewBookInput {
  return {
    title: doc.title ?? "Untitled Book",
    authorName: doc.author_name?.[0] ?? "Author to identify",
    isbn: doc.isbn?.[0],
    pages: doc.number_of_pages_median,
    genre: doc.subject?.slice(0, 3) ?? ["Uncategorized"],
    publisher: doc.publisher?.[0],
    publishedDate: doc.first_publish_year ? `${doc.first_publish_year}-01-01` : undefined,
    language: "English",
    synopsis: undefined,
    coverImageUri: coverUrl(doc.cover_i),
    source: "search",
    ownership: "owned"
  };
}

function shouldUseMetadataValue(current?: string, incoming?: string) {
  return Boolean(incoming?.trim()) && isPlaceholderText(current);
}

function shouldUseNumericMetadata(current?: number, incoming?: number) {
  return Boolean(incoming && incoming > 0) && (!current || current <= 0);
}

function shouldUseGenreMetadata(current?: string[], incoming?: string[]) {
  return Boolean(incoming?.length) && isPlaceholderGenreList(current);
}

function shouldUseSynopsis(current?: string, incoming?: string) {
  return Boolean(incoming && incoming.length > 30) && (isPlaceholderText(current) || (current?.length ?? 0) < 60);
}
