import { Author, Book, ReadingSession, UserProfile } from "../types/models";

export type WeightedGenre = { genre: string; weight: number };
export type WeightedAuthor = { author: string; weight: number };
export type WeightedSeries = { series: string; weight: number };
export type WeightedFormat = { format: string; weight: number };
export type WeightedLanguage = { language: string; weight: number };

export type TasteAnchorBook = {
  bookId: string;
  title: string;
  authorName: string;
  genres: string[];
  seriesName?: string;
  rating?: number;
  status: Book["userStatus"]["status"];
};

export type UserTasteProfile = {
  topGenres: WeightedGenre[];
  topAuthors: WeightedAuthor[];
  topSeries: WeightedSeries[];
  preferredFormats: WeightedFormat[];
  preferredLanguages: WeightedLanguage[];
  completedBooks: string[];
  likedBooks: string[];
  dislikedBooks: string[];
  readingVelocity: {
    sessionsPerWeek: number;
    pagesPerWeek: number;
    minutesPerWeek: number;
  };
  discoverySeeds: string[];
  anchorBooks: TasteAnchorBook[];
};

type BuilderInput = {
  authors: Author[];
  books: Book[];
  readingSessions: ReadingSession[];
  userProfile: UserProfile;
};

function addWeight(map: Map<string, number>, key: string | undefined, weight: number) {
  const normalized = key?.trim();
  if (!normalized) return;
  map.set(normalized, (map.get(normalized) ?? 0) + weight);
}

function rankMap<T extends string>(
  map: Map<string, number>,
  key: "genre" | "author" | "series" | "format" | "language",
  limit: number
): Array<Record<typeof key, T> & { weight: number }> {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, weight]) => ({ [key]: label as T, weight } as Record<typeof key, T> & { weight: number }));
}

function getStatusWeight(book: Book): number {
  switch (book.userStatus.status) {
    case "read":
      return 5;
    case "reading":
      return 4;
    case "want-to-read":
      return 2.5;
    case "wishlist":
      return 2;
    case "want-to-buy":
      return 1.5;
    case "dnf":
      return -2;
    default:
      return 1;
  }
}

function getBookAffinity(book: Book): number {
  let score = getStatusWeight(book);

  if ((book.userStatus.rating ?? 0) >= 4.5) score += 3;
  else if ((book.userStatus.rating ?? 0) >= 4) score += 2;
  else if ((book.userStatus.rating ?? 0) >= 3) score += 1;
  else if ((book.userStatus.rating ?? 0) > 0 && (book.userStatus.rating ?? 0) <= 2) score -= 2;

  if (book.userStatus.status === "reading" && book.userStatus.progressPercent >= 35) score += 1.5;
  if (book.userStatus.wishlist) score += 1;
  if (book.userStatus.wantToBuy) score += 1;
  if (book.userStatus.readCount && book.userStatus.readCount > 1) score += Math.min(3, book.userStatus.readCount - 1);

  return score;
}

export function buildUserTasteProfile({
  authors,
  books,
  readingSessions,
  userProfile,
}: BuilderInput): UserTasteProfile {
  const authorNameById = new Map(authors.map((author) => [author.id, author.name]));
  const genreWeights = new Map<string, number>();
  const authorWeights = new Map<string, number>();
  const seriesWeights = new Map<string, number>();
  const formatWeights = new Map<string, number>();
  const languageWeights = new Map<string, number>();

  const completedBooks = books.filter((book) => book.userStatus.status === "read").map((book) => book.id);
  const likedBooks = books
    .filter((book) => book.userStatus.status === "read" && (book.userStatus.rating ?? 0) >= 4)
    .map((book) => book.id);
  const dislikedBooks = books
    .filter((book) => book.userStatus.status === "dnf" || ((book.userStatus.rating ?? 0) > 0 && (book.userStatus.rating ?? 0) <= 2))
    .map((book) => book.id);

  const anchorBooks = [...books]
    .sort((a, b) => getBookAffinity(b) - getBookAffinity(a))
    .slice(0, 8)
    .map((book) => ({
      bookId: book.id,
      title: book.title,
      authorName: authorNameById.get(book.authorId) ?? "Unknown Author",
      genres: book.genre ?? [],
      seriesName: book.seriesName,
      rating: book.userStatus.rating,
      status: book.userStatus.status,
    }));

  for (const book of books) {
    const affinity = getBookAffinity(book);
    const authorName = authorNameById.get(book.authorId);

    for (const genre of book.genre ?? []) {
      addWeight(genreWeights, genre, affinity);
    }
    addWeight(authorWeights, authorName, affinity);
    addWeight(seriesWeights, book.seriesName, affinity);
    addWeight(formatWeights, book.format, affinity);
    addWeight(languageWeights, book.language, affinity);
  }

  for (const genre of userProfile.favoriteGenres) {
    addWeight(genreWeights, genre, 6);
  }

  for (const author of userProfile.favoriteAuthors) {
    addWeight(authorWeights, author, 6);
  }

  const recentWindowStart = new Date();
  recentWindowStart.setDate(recentWindowStart.getDate() - 28);
  const recentSessions = readingSessions.filter((session) => new Date(session.date) >= recentWindowStart);
  const sessionsPerWeek = Number((recentSessions.length / 4).toFixed(1));
  const pagesPerWeek = Math.round(recentSessions.reduce((sum, session) => sum + session.pagesRead, 0) / 4);
  const minutesPerWeek = Math.round(recentSessions.reduce((sum, session) => sum + session.minutesRead, 0) / 4);

  const topGenres = rankMap<string>(genreWeights, "genre", 5);
  const topAuthors = rankMap<string>(authorWeights, "author", 5);
  const topSeries = rankMap<string>(seriesWeights, "series", 4);
  const preferredFormats = rankMap<string>(formatWeights, "format", 4);
  const preferredLanguages = rankMap<string>(languageWeights, "language", 3);

  const discoverySeeds = Array.from(
    new Set([
      ...topGenres.map((entry) => entry.genre),
      ...topAuthors.map((entry) => entry.author),
      ...topSeries.map((entry) => entry.series),
      ...anchorBooks.slice(0, 3).map((book) => book.title),
    ].filter(Boolean))
  ).slice(0, 12);

  return {
    topGenres,
    topAuthors,
    topSeries,
    preferredFormats,
    preferredLanguages,
    completedBooks,
    likedBooks,
    dislikedBooks,
    readingVelocity: {
      sessionsPerWeek,
      pagesPerWeek,
      minutesPerWeek,
    },
    discoverySeeds,
    anchorBooks,
  };
}
