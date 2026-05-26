import { NewBookInput } from "../types/models";
import { openLibraryUrl } from "./openLibrary";

export type SearchMode = "general" | "author";

export const OPEN_LIBRARY_PAGE_SIZE = 50;

type OpenLibraryIsbnResponse = {
  key?: string;
  title?: string;
  subtitle?: string;
  authors?: { key: string }[];
  works?: { key: string }[];
  covers?: number[];
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  subjects?: string[];
  description?: string | { value?: string };
  isbn_13?: string[];
  isbn_10?: string[];
  physical_format?: string;
  languages?: { key?: string }[];
};

type OpenLibrarySearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  first_publish_year?: number;
  publisher?: string[];
  number_of_pages_median?: number;
  subject?: string[];
  language?: string[];
  edition_count?: number;
};

type OpenLibrarySearchResponse = {
  numFound?: number;
  docs?: OpenLibrarySearchDoc[];
};

type OpenLibraryWorkResponse = {
  key?: string;
  title?: string;
  description?: string | { value?: string };
  first_publish_date?: string;
  subjects?: string[];
  covers?: number[];
};

type OpenLibraryEditionEntry = {
  key?: string;
  title?: string;
  subtitle?: string;
  isbn_13?: string[];
  isbn_10?: string[];
  number_of_pages?: number;
  publish_date?: string;
  publishers?: string[];
  languages?: { key?: string }[];
  covers?: number[];
  physical_format?: string;
};

type OpenLibraryEditionsResponse = {
  size?: number;
  entries?: OpenLibraryEditionEntry[];
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
  workKey?: string;
  editionKey?: string;
  editionCount?: number;
  format?: NewBookInput["format"];
};

export type BookEditionOption = {
  id: string;
  editionKey?: string;
  title: string;
  label: string;
  isbn?: string;
  language?: string;
  publisher?: string;
  publishedDate?: string;
  pages?: number;
  format?: NewBookInput["format"];
  coverImageUri?: string;
  patch: Partial<NewBookInput>;
};

export const coverUrl = (coverId?: number) => (coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined);

const languageMap: Record<string, string> = {
  eng: "English",
  spa: "Spanish",
  fre: "French",
  fra: "French",
  ger: "German",
  deu: "German",
  ita: "Italian",
  por: "Portuguese",
  rus: "Russian",
  jpn: "Japanese",
  chi: "Chinese",
  zho: "Chinese",
  kor: "Korean",
  ara: "Arabic",
  nld: "Dutch",
  dut: "Dutch",
  swe: "Swedish",
  pol: "Polish",
  tur: "Turkish"
};

const readDescription = (description?: string | { value?: string }) => {
  if (!description) return undefined;
  return typeof description === "string" ? description : description.value;
};

const mapLanguageKey = (value?: string) => {
  if (!value) return undefined;
  const code = value.split("/").pop()?.toLowerCase() ?? "";
  return languageMap[code] ?? code.toUpperCase();
};

const mapSearchLanguage = (values?: string[]) => {
  if (!values?.length) return undefined;
  return mapLanguageKey(values[0]);
};

const mapPhysicalFormat = (value?: string): NewBookInput["format"] | undefined => {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return undefined;
  if (normalized.includes("audio")) return "audiobook";
  if (normalized.includes("kindle") || normalized.includes("ebook") || normalized.includes("e-book")) return "kindle";
  return "physical";
};

const formatEditionLabel = (parts: Array<string | undefined>) =>
  parts.filter(Boolean).join(" · ");

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

async function fetchWorkMetadata(workKey?: string): Promise<BookMetadata | undefined> {
  if (!workKey) return undefined;
  try {
    const response = await fetch(openLibraryUrl(`${workKey}.json`));
    if (!response.ok) return undefined;
    const data = (await response.json()) as OpenLibraryWorkResponse;
    return {
      title: data.title,
      synopsis: readDescription(data.description),
      genre: data.subjects?.slice(0, 4),
      publishedDate: data.first_publish_date,
      coverImageUri: coverUrl(data.covers?.[0]),
      workKey: data.key ?? workKey
    };
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
    const workKey = data.works?.[0]?.key;
    const workMeta = await fetchWorkMetadata(workKey);

    return mergeBookMetadata(
      {
        title: data.title,
        authorName,
        isbn: data.isbn_13?.[0] ?? data.isbn_10?.[0] ?? cleanIsbn,
        pages: data.number_of_pages,
        genre: data.subjects?.slice(0, 4),
        publisher: data.publishers?.[0],
        publishedDate: data.publish_date,
        language: mapLanguageKey(data.languages?.[0]?.key) ?? "English",
        synopsis: readDescription(data.description),
        coverImageUri: coverUrl(data.covers?.[0]),
        workKey,
        editionKey: data.key,
        format: mapPhysicalFormat(data.physical_format)
      },
      workMeta
    );
  } catch {
    return undefined;
  }
}

export async function searchBookMetadata(
  query: string,
  mode: SearchMode = "general",
  offset = 0
): Promise<{ results: NewBookInput[]; total: number }> {
  const fields = "key,title,author_name,isbn,cover_i,first_publish_year,publisher,number_of_pages_median,subject,language,edition_count";
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

  const workMeta = await fetchWorkMetadata(first.workKey);

  return mergeBookMetadata(
    {
      title: first.title,
      authorName: first.authorName,
      isbn: first.isbn,
      pages: first.pages,
      genre: first.genre,
      publisher: first.publisher,
      publishedDate: first.publishedDate,
      language: first.language,
      synopsis: first.synopsis,
      coverImageUri: first.coverImageUri,
      workKey: first.workKey,
      editionCount: first.editionCount
    },
    workMeta
  );
}

export async function fetchEditionOptionsByWorkKey(workKey?: string, limit = 6): Promise<BookEditionOption[]> {
  if (!workKey) return [];
  try {
    const response = await fetch(openLibraryUrl(`${workKey}/editions.json?limit=${Math.max(limit, 6)}`));
    if (!response.ok) return [];
    const data = (await response.json()) as OpenLibraryEditionsResponse;
    const dedupe = new Set<string>();

    return (data.entries ?? [])
      .map((entry) => {
        const isbn = entry.isbn_13?.[0] ?? entry.isbn_10?.[0];
        const language = mapLanguageKey(entry.languages?.[0]?.key);
        const format = mapPhysicalFormat(entry.physical_format);
        const publishedDate = entry.publish_date;
        const publisher = entry.publishers?.[0];
        const label = formatEditionLabel([
          language,
          format ? format.charAt(0).toUpperCase() + format.slice(1) : undefined,
          publishedDate?.slice(0, 4),
          publisher
        ]);
        const key = [isbn, language, format, publishedDate, publisher].filter(Boolean).join("|");

        return {
          id: entry.key ?? key,
          editionKey: entry.key,
          title: entry.title ?? "Edition",
          label: label || "Edition details pending",
          isbn,
          language,
          publisher,
          publishedDate,
          pages: entry.number_of_pages,
          format,
          coverImageUri: coverUrl(entry.covers?.[0]),
          patch: {
            editionKey: entry.key,
            isbn,
            language,
            publisher,
            publishedDate,
            pages: entry.number_of_pages,
            coverImageUri: coverUrl(entry.covers?.[0]),
            format
          }
        } satisfies BookEditionOption;
      })
      .filter((option) => {
        if (!option.id || dedupe.has(option.id)) return false;
        dedupe.add(option.id);
        return true;
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function resolveBookMetadata(input: {
  isbn?: string;
  title?: string;
  authorName?: string;
  workKey?: string;
}): Promise<BookMetadata | undefined> {
  const cleanIsbn = normalizeIsbn(input.isbn);
  const isbnMeta = cleanIsbn.length >= 10 ? await fetchBookMetadataByIsbn(cleanIsbn) : undefined;
  const resolvedTitle = input.title?.trim() || isbnMeta?.title || "";
  const resolvedAuthor = input.authorName?.trim() || isbnMeta?.authorName || "";
  const searchMeta = resolvedTitle ? await fetchBookMetadataByTitleAuthor(resolvedTitle, resolvedAuthor) : undefined;
  const workMeta = await fetchWorkMetadata(input.workKey ?? isbnMeta?.workKey ?? searchMeta?.workKey);

  return mergeBookMetadata(mergeBookMetadata(isbnMeta, searchMeta), workMeta)
    ?? mergeBookMetadata(mergeBookMetadata(searchMeta, workMeta), isbnMeta);
}

export async function enrichBookInput(input: NewBookInput): Promise<NewBookInput> {
  const metadata = await resolveBookMetadata({
    isbn: input.isbn,
    title: input.title,
    authorName: input.authorName,
    workKey: input.workKey
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
    format: metadata.format,
    workKey: metadata.workKey,
    editionKey: metadata.editionKey,
    editionCount: metadata.editionCount,
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
    coverImageUri: shouldUseMetadataValue(input.coverImageUri, metadata.coverImageUri) ? metadata.coverImageUri ?? input.coverImageUri : input.coverImageUri,
    format: input.format ?? metadata.format,
    workKey: input.workKey ?? metadata.workKey,
    editionKey: input.editionKey ?? metadata.editionKey,
    editionCount: input.editionCount ?? metadata.editionCount
  };
}

export function applyEditionOptionToBookInput(input: NewBookInput, option?: BookEditionOption): NewBookInput {
  if (!option) return input;
  return {
    ...input,
    ...option.patch,
    title: input.title,
    authorName: input.authorName,
    source: input.source,
    ownership: input.ownership,
    wishlist: input.wishlist,
    wantToBuy: input.wantToBuy,
    workKey: input.workKey,
    editionCount: input.editionCount
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
  if (original.language !== updated.language) changes.push("language");
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
    coverImageUri: primary?.coverImageUri ?? secondary?.coverImageUri,
    workKey: primary?.workKey ?? secondary?.workKey,
    editionKey: primary?.editionKey ?? secondary?.editionKey,
    editionCount: primary?.editionCount ?? secondary?.editionCount,
    format: primary?.format ?? secondary?.format
  };
}

function mapSearchDocToBookInput(doc: OpenLibrarySearchDoc): NewBookInput {
  return {
    title: doc.title ?? "Untitled Book",
    authorName: doc.author_name?.[0] ?? "Unknown Author",
    isbn: doc.isbn?.[0],
    pages: doc.number_of_pages_median,
    genre: doc.subject?.slice(0, 3) ?? ["Uncategorized"],
    publisher: doc.publisher?.[0],
    publishedDate: doc.first_publish_year ? `${doc.first_publish_year}-01-01` : undefined,
    language: mapSearchLanguage(doc.language) ?? "English",
    synopsis: undefined,
    coverImageUri: coverUrl(doc.cover_i),
    workKey: doc.key?.startsWith("/works/") ? doc.key : undefined,
    editionCount: doc.edition_count,
    source: "search",
    ownership: "owned"
  };
}

function shouldUseMetadataValue(current?: string, incoming?: string) {
  if (!incoming?.trim()) return false;
  return isPlaceholderText(current);
}

function shouldUseNumericMetadata(current?: number, incoming?: number) {
  if (!incoming || incoming <= 0) return false;
  return !current || current <= 0;
}

function shouldUseGenreMetadata(current?: string[], incoming?: string[]) {
  if (!incoming?.length) return false;
  return isPlaceholderGenreList(current);
}

function shouldUseSynopsis(current?: string, incoming?: string) {
  if (!incoming?.trim()) return false;
  return isPlaceholderText(current) || (current?.trim().length ?? 0) < 40;
}
