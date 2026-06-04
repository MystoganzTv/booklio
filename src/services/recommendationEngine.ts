import { Book } from "../types/models";
import { fetchByKeyword, GenreBookResult } from "./googleBooksProvider";
import { TasteAnchorBook, UserTasteProfile } from "./userTasteProfile";

export type RecommendationSectionKind =
  | "because-you-read"
  | "more-from-author"
  | "continue-series"
  | "popular-in-genre"
  | "short-reads";

export type RecommendationSectionSpec = {
  id: string;
  kind: RecommendationSectionKind;
  title: string;
  subtitle: string;
  query: string;
  focusGenre?: string;
  focusAuthor?: string;
  focusSeries?: string;
  anchorBook?: TasteAnchorBook;
};

export type PersonalizedRecommendationSection = RecommendationSectionSpec & {
  books: GenreBookResult[];
};

type LibraryIndex = {
  isbnSet: Set<string>;
  normalizedTitleSet: Set<string>;
};

const BROAD_GENRE_PATTERN = /\b(fiction|literature|books?|novels?|adventure|classics?)\b/i;
const COLLECTION_PATTERN = /\b(box\s*set|boxed\s*set|collection|omnibus|anthology|year'?s?\s+best|best american)\b/i;
const LOW_SIGNAL_PATTERN = /\b(workbook|summary|study guide|companion|analysis|guide|manual|encyclopedia|dictionary|textbook|catalog|handbook|reader's guide|reading group)\b/i;
const SERIAL_PUBLICATION_PATTERN = /\b(magazine|review|journal|weekly|quarterly|annual|yearbook|digest|bulletin|gazette|courier|chronicle|times|herald|tribune)\b/i;
const GENERIC_TITLE_PATTERN = /\b(bestsellers?|publishers?'?\s*weekly|guide to|popular fiction since|book of the month|year in review)\b/i;
const STORY_COLLECTION_PATTERN = /\b(short stories|collected stories|selected stories|stories under|complete stories|complete works|complete poems)\b/i;
const GENERIC_AUTHOR_PATTERN = /^(unknown author|various writers|various authors|anonymous|multiple authors?)$/i;
// Reject anything that smells like non-fiction non-narrative (cycling guides, travel guides, etc.)
const NON_FICTION_JUNK_PATTERN = /\b(bike ride|cycling|cookbook|recipe|workout|fitness|diet|investing|tax|legal|medical|travel guide|field guide|bird guide)\b/i;

const GENRE_QUERY_MAP: Record<string, string> = {
  "Science Fiction": "science fiction novels",
  "Fantasy": "fantasy novels",
  "Mystery": "mystery thriller novels",
  "Thriller": "thriller novels",
  "Romance": "romance novels",
  "Horror": "horror novels",
  "Historical Fiction": "historical fiction novels",
  "Biography": "biography memoir",
  "Personal Growth": "self help personal growth books",
  "Young Adult": "young adult novels",
  "Adventure": "adventure fiction novels",
};

// Maps genre → Google Books subject: operator value
const GENRE_TO_GB_SUBJECT: Record<string, string> = {
  "Science Fiction":    "science+fiction",
  "Fantasy":            "fantasy",
  "Mystery":            "mystery",
  "Thriller":           "thriller",
  "Romance":            "romance",
  "Horror":             "horror",
  "Historical Fiction": "historical+fiction",
  "Adventure":          "adventure",
  "Young Adult":        "young+adult",
  "Biography":          "biography",
  "Personal Growth":    "self+help",
  "Literary Fiction":   "literary+fiction",
};

/** Build a subject:-anchored query that forces Google Books to stay in the right category */
function subjectQuery(genre: string | undefined, extra?: string): string {
  const subject = genre ? (GENRE_TO_GB_SUBJECT[genre] ?? encodeURIComponent(genre.toLowerCase())) : "fiction";
  return extra ? `subject:${subject} ${extra}` : `subject:${subject}`;
}

function normalizeText(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function editorialGenreQuery(genre: string | undefined): string {
  if (!genre) return "fiction novels";
  return GENRE_QUERY_MAP[genre] ?? `${genre} novels`;
}

function pickRepresentativeGenre(candidates: Array<string | undefined>): string | undefined {
  const normalized = candidates.map((genre) => genre?.trim()).filter(Boolean) as string[];
  return normalized.find((genre) => !BROAD_GENRE_PATTERN.test(genre)) ?? normalized[0];
}

export function buildLibraryIndex(books: Book[]): LibraryIndex {
  return {
    isbnSet: new Set(books.map((book) => book.isbn).filter(Boolean)),
    normalizedTitleSet: new Set(books.map((book) => normalizeText(book.title)).filter(Boolean)),
  };
}

export function buildRecommendationSectionSpecs(profile: UserTasteProfile): RecommendationSectionSpec[] {
  const sections: RecommendationSectionSpec[] = [];
  const topGenre = pickRepresentativeGenre(profile.topGenres.map((entry) => entry.genre));
  const secondGenre = profile.topGenres[1]?.genre;
  const topAuthor = profile.topAuthors[0]?.author;
  const topSeries = profile.topSeries[0]?.series;
  const anchorBook = profile.anchorBooks[0];

  // Only recommend "Because you read X" if the user has actually read or is reading that book.
  // Showing it for books that are merely "owned" is misleading and confusing.
  const readAnchorBook = profile.anchorBooks.find(
    (book) => book.status === "read" || book.status === "reading"
  );
  if (readAnchorBook) {
    const anchorGenre = pickRepresentativeGenre([
      ...readAnchorBook.genres,
      topGenre,
      profile.topGenres[1]?.genre,
    ]) ?? "Science Fiction";
    sections.push({
      id: "because-you-read",
      kind: "because-you-read",
      title: `Because you read ${readAnchorBook.title}`,
      subtitle: "A nearby lane based on one of your strongest books.",
      query: `inauthor:"${readAnchorBook.authorName}" ${subjectQuery(anchorGenre)}`,
      focusGenre: anchorGenre,
      anchorBook: readAnchorBook,
    });
  }

  // Only recommend "More from author" if that author has at least one read/reading book.
  const readAuthor = profile.anchorBooks
    .filter((book) => book.status === "read" || book.status === "reading")
    .map((book) => book.authorName)
    .find(Boolean);
  if (readAuthor) {
    sections.push({
      id: "more-from-author",
      kind: "more-from-author",
      title: `More from ${readAuthor}`,
      subtitle: "You keep coming back to this author.",
      query: `inauthor:"${readAuthor}"`,
      focusAuthor: readAuthor,
    });
  }

  if (topSeries) {
    sections.push({
      id: "continue-series",
      kind: "continue-series",
      title: `Continue ${topSeries}`,
      subtitle: "Stay inside a world you already started.",
      query: `intitle:"${topSeries}" subject:fiction`,
      focusSeries: topSeries,
    });
  }

  if (topGenre) {
    sections.push({
      id: "popular-in-genre",
      kind: "popular-in-genre",
      title: `Popular in ${topGenre}`,
      subtitle: "A strong match for your reading taste.",
      // subject: forces Google Books to the right category — no more cycling books in Adventure
      query: subjectQuery(topGenre),
      focusGenre: topGenre,
    });
  }

  if (secondGenre && profile.readingVelocity.sessionsPerWeek <= 4) {
    sections.push({
      id: "short-reads",
      kind: "short-reads",
      title: "Quick wins for your pace",
      subtitle: "Shorter books that fit your current rhythm.",
      query: subjectQuery(secondGenre),
      focusGenre: secondGenre,
    });
  }

  return sections.slice(0, 4);
}

export function hasUsableCatalogCover(book: GenreBookResult): boolean {
  const url = book.coverUrl?.toLowerCase() ?? "";
  if (!url) return false;
  return !(
    url.includes("image_not_available") ||
    url.includes("no_image") ||
    url.includes("nocover") ||
    url.includes("placeholder")
  );
}

export function isHighSignalCatalogBook(
  book: GenreBookResult,
  options?: { allowShort?: boolean }
): boolean {
  const primaryAuthor = (book.authors[0] ?? "").trim();
  const searchable = normalizeText(`${book.title} ${book.description ?? ""} ${book.genres.join(" ")} ${book.authors.join(" ")}`);
  const pageFloor = options?.allowShort ? 48 : 80;
  // Raise the bar vs. the old threshold of 50 ratings.
  // Books with text-page scans instead of real covers tend to be obscure titles with <200 ratings.
  const hasQualitySignal =
    (book.ratingsCount ?? 0) >= 200 ||
    ((book.averageRating ?? 0) >= 3.8 && (book.ratingsCount ?? 0) >= 20) ||
    ((book.publishedYear ?? 0) >= 2018 && (book.ratingsCount ?? 0) >= 10);

  if (!hasUsableCatalogCover(book)) return false;
  if (!primaryAuthor || GENERIC_AUTHOR_PATTERN.test(primaryAuthor)) return false;
  if ((book.pageCount ?? 0) > 0 && (book.pageCount ?? 0) < pageFloor) return false;
  // Hard reject: old periodicals / digitized ephemera (no real book published before 1950 belongs in modern recs)
  const year = book.publishedYear ?? 0;
  if (year > 0 && year < 1950) return false;
  if (COLLECTION_PATTERN.test(book.title)) return false;
  if (LOW_SIGNAL_PATTERN.test(book.title) || LOW_SIGNAL_PATTERN.test(searchable)) return false;
  if (SERIAL_PUBLICATION_PATTERN.test(book.title) || SERIAL_PUBLICATION_PATTERN.test(searchable)) return false;
  if (GENERIC_TITLE_PATTERN.test(book.title)) return false;
  if (STORY_COLLECTION_PATTERN.test(book.title)) return false;
  if (NON_FICTION_JUNK_PATTERN.test(book.title)) return false;
  if (!hasQualitySignal) return false;

  return true;
}

function baseQualityScore(book: GenreBookResult): number {
  let score = 0;

  if (!hasUsableCatalogCover(book)) score -= 120;
  else score += 35;

  if (COLLECTION_PATTERN.test(book.title)) score -= 80;
  if (LOW_SIGNAL_PATTERN.test(book.title)) score -= 80;
  if (SERIAL_PUBLICATION_PATTERN.test(book.title)) score -= 120;
  if (GENERIC_TITLE_PATTERN.test(book.title)) score -= 90;
  if (STORY_COLLECTION_PATTERN.test(book.title)) score -= 85;
  if (NON_FICTION_JUNK_PATTERN.test(book.title)) score -= 90;
  if (!book.authors[0] || GENERIC_AUTHOR_PATTERN.test(book.authors[0])) score -= 90;
  // Penalize very old items (pre-1950) even if they somehow slipped through
  const bookYear = book.publishedYear ?? 0;
  if (bookYear > 0 && bookYear < 1950) score -= 200;

  const ratingsCount = book.ratingsCount ?? 0;
  if (ratingsCount >= 100000) score += 55;
  else if (ratingsCount >= 25000) score += 42;
  else if (ratingsCount >= 5000) score += 32;
  else if (ratingsCount >= 1000) score += 22;
  else if (ratingsCount >= 100) score += 12;

  score += Math.round((book.averageRating ?? 0) * 6);

  const year = book.publishedYear ?? 0;
  if (year >= 2024) score += 12;
  else if (year >= 2020) score += 10;
  else if (year >= 2015) score += 7;
  else if (year >= 2005) score += 4;

  return score;
}

function sectionScore(
  book: GenreBookResult,
  profile: UserTasteProfile,
  section: RecommendationSectionSpec
): number {
  let score = baseQualityScore(book);
  const searchable = normalizeText(`${book.title} ${book.description ?? ""} ${book.genres.join(" ")} ${book.authors.join(" ")}`);
  const normalizedAuthor = normalizeText(book.authors[0] ?? "");

  if (section.focusAuthor && normalizedAuthor.includes(normalizeText(section.focusAuthor))) {
    score += 80;
  }

  if (section.focusSeries && searchable.includes(normalizeText(section.focusSeries))) {
    score += 65;
  }

  if (section.focusGenre) {
    const wantedGenre = normalizeText(section.focusGenre);
    if (book.genres.some((genre) => normalizeText(genre).includes(wantedGenre) || wantedGenre.includes(normalizeText(genre)))) {
      score += 45;
    } else if (searchable.includes(wantedGenre)) {
      score += 24;
    }
  }

  if (section.anchorBook) {
    const anchorGenres = section.anchorBook.genres.map((genre) => normalizeText(genre)).filter(Boolean);
    const overlap = anchorGenres.filter((genre) => searchable.includes(genre)).length;
    score += overlap * 18;
    if (normalizedAuthor.includes(normalizeText(section.anchorBook.authorName))) {
      score += 12;
    }
  }

  for (const topGenre of profile.topGenres.slice(0, 3)) {
    const normalizedGenre = normalizeText(topGenre.genre);
    if (searchable.includes(normalizedGenre)) score += Math.round(topGenre.weight * 2.5);
  }

  for (const topAuthor of profile.topAuthors.slice(0, 3)) {
    const normalizedTopAuthor = normalizeText(topAuthor.author);
    if (normalizedAuthor.includes(normalizedTopAuthor)) score += Math.round(topAuthor.weight * 2.5);
  }

  const preferredLanguage = profile.preferredLanguages[0]?.language;
  if (preferredLanguage && normalizeText(book.language).includes(normalizeText(preferredLanguage))) {
    score += 8;
  }

  if (section.kind === "short-reads" && (book.pageCount ?? 999) <= 320) {
    score += 24;
  }

  return score;
}

export function filterAndRankRecommendationCandidates(
  candidates: GenreBookResult[],
  profile: UserTasteProfile,
  section: RecommendationSectionSpec,
  libraryIndex: LibraryIndex
): GenreBookResult[] {
  const ranked = candidates
    .filter((book) => isHighSignalCatalogBook(book, { allowShort: section.kind === "short-reads" }))
    .filter((book) => !libraryIndex.isbnSet.has(book.isbn13 ?? ""))
    .filter((book) => !libraryIndex.normalizedTitleSet.has(normalizeText(book.title)))
    .map((book) => ({ book, score: sectionScore(book, profile, section) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (b.book.ratingsCount ?? 0) - (a.book.ratingsCount ?? 0))
    .map((entry) => entry.book);

  return ranked.filter((book, index, all) => all.findIndex((candidate) => candidate.id === book.id) === index);
}

export async function buildPersonalizedRecommendationSections(
  profile: UserTasteProfile,
  libraryIndex: LibraryIndex,
  options?: {
    specs?: RecommendationSectionSpec[];
    fetchLimit?: number;
    booksPerSection?: number;
    minBooksPerSection?: number;
  }
): Promise<PersonalizedRecommendationSection[]> {
  const specs = options?.specs ?? buildRecommendationSectionSpecs(profile);
  if (!specs.length) return [];

  const fetchLimit = options?.fetchLimit ?? 30;
  const booksPerSection = options?.booksPerSection ?? 6;
  const minBooksPerSection = options?.minBooksPerSection ?? 3;

  const sections = await Promise.all(
    specs.map(async (section) => {
      const { books } = await fetchByKeyword(section.query, 0, fetchLimit);
      return {
        ...section,
        books: filterAndRankRecommendationCandidates(books, profile, section, libraryIndex).slice(0, booksPerSection),
      };
    })
  );

  return sections.filter((section) => section.books.length >= minBooksPerSection);
}
