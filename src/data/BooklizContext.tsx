import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearQueue, enqueue, hasPendingOperations, isOnline } from "../utils/offlineQueue";
import { authors as authorSeed, books as bookSeed, readingSessions as sessionSeed, series, userProfile } from "./mockData";
import {
  BooklizRepository,
  createBooklizSnapshot,
  LocalFirstBooklizRepository,
  PersistedBooklizState,
  RepositoryStatus
} from "./booklizRepository";
import {
  Achievement,
  Author,
  Book,
  CoreTrackingStatus,
  NewBookInput,
  NewReadingSessionInput,
  Recommendation,
  ReadingSession,
  Review,
  UpdateBookInput,
  UpdateUserProfileInput,
  UserList,
  UserProfile
} from "../types/models";
import { buildInitials, clearPersistedConnectedAccount, ConnectedAccount, persistConnectedAccount, readPersistedConnectedAccount } from "../utils/googleAuth";
import { buildBookSpecificRecommendations, buildGlobalRecommendations } from "../utils/recommendationEngine";
import { supabase } from "../lib/supabase";
import { normalizeBookGenres } from "../utils/genres";
import { computeReadingIdentity, loadStoredIdentity, ReadingIdentity, storeIdentity } from "../utils/readingIdentity";

type MonthBucket = {
  label: string;
  pages: number;
  minutes: number;
  sessions: number;
  booksFinished: number;
};

type BookStats = {
  totalSessions: number;
  totalMinutes: number;
  totalPages: number;
  averagePagesPerSession: number;
  averageMinutesPerSession: number;
  averageSpeed: number;
  longestSession?: ReadingSession;
  latestSessions: ReadingSession[];
};

type OverallStats = {
  totalBooksRead: number;
  booksReadThisYear: number;
  rereadsCompleted: number;
  activeRereads: number;
  pagesRead: number;
  minutesRead: number;
  totalSessions: number;
  averagePagesPerSession: number;
  averageMinutesPerSession: number;
  averageRating: number;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  averageSessionEnjoyment: number;
  averageBookLength: number;
  booksTracked: number;
  ownedCount: number;
  wishlistCount: number;
  wantToBuyCount: number;
  activeSeriesCount: number;
  completedSeriesCount: number;
  bestReadingDay: string;
  longestSession?: ReadingSession;
  monthly: MonthBucket[];
  genreCounts: { label: string; value: number }[];
  authorCounts: { label: string; value: number }[];
  statusCounts: { label: string; value: number }[];
  formatCounts: { label: string; value: number }[];
  locationCounts: { label: string; value: number }[];
  speedOverTime: { label: string; value: number }[];
  mostActiveDays: { label: string; value: number }[];
};

type BooklizContextValue = {
  authors: Author[];
  books: Book[];
  readingSessions: ReadingSession[];
  reviews: Review[];
  userLists: UserList[];
  recommendations: Recommendation[];
  series: typeof series;
  userProfile: UserProfile;
  repositoryStatus: RepositoryStatus;
  onboardingComplete: boolean;
  completeOnboarding: (name: string, genres: string[]) => Promise<void>;
  resetApp: () => Promise<void>;
  clearLibrary: () => Promise<void>;
  connectIdentityAccount: (account: ConnectedAccount) => Promise<void>;
  disconnectIdentityAccount: () => Promise<void>;
  addBook: (input: NewBookInput) => Book;
  findDuplicateBook: (input: NewBookInput) => Book | null;
  addReadingSession: (input: NewReadingSessionInput) => ReadingSession;
  updateReadingSession: (sessionId: string, input: NewReadingSessionInput) => ReadingSession | undefined;
  deleteReadingSession: (sessionId: string) => void;
  deleteBook: (bookId: string) => void;
  updateBook: (bookId: string, input: UpdateBookInput) => void;
  updateBookStatus: (bookId: string, status: CoreTrackingStatus, rating?: number) => void;
  updateBookFormat: (bookId: string, format: Book["format"]) => void;
  updateBookSynopsis: (bookId: string, synopsis: string) => void;
  updateUserProfile: (input: UpdateUserProfileInput) => void;
  getAuthor: (authorId: string) => Author | undefined;
  getBook: (bookId: string) => Book | undefined;
  getReadingSession: (sessionId: string) => ReadingSession | undefined;
  getReviewForBook: (bookId: string) => Review | undefined;
  addReview: (review: Omit<Review, "id" | "createdAt">) => Review;
  updateReview: (reviewId: string, review: Omit<Review, "id" | "createdAt">) => void;
  deleteReview: (reviewId: string) => void;
  createUserList: (name: string, emoji?: string) => UserList;
  renameUserList: (listId: string, name: string, emoji?: string) => void;
  deleteUserList: (listId: string) => void;
  addBookToList: (listId: string, bookId: string) => void;
  removeBookFromList: (listId: string, bookId: string) => void;
  getBookStats: (bookId: string) => BookStats;
  getSessionsForBook: (bookId: string) => ReadingSession[];
  getRecommendationsForBook: (bookId: string, limit?: number) => Recommendation[];
  overallStats: OverallStats;
  seriesJustCompleted: { seriesId: string; seriesName: string } | null;
  clearSeriesCompletion: () => void;
  /** Phase 1 — on-device reader profile. Null until first computation. */
  readingIdentity: ReadingIdentity | null;
};

const BooklizContext = createContext<BooklizContextValue | null>(null);

const rereadAchievement: Achievement = {
  id: "ach-rereader",
  title: "Old Favorite",
  description: "Reread a book.",
  flavour: "Because some stories only get better the second time.",
  unlocked: false,
  progress: 0,
  goal: 1,
  category: "reading" as const,
  tier: "bronze" as const,
  icon: "📚"
};

/**
 * Migrate persisted achievements against the current seed.
 * Keeps the user's progress/unlock state, but always uses the seed's
 * static fields (icon, tier, title, description, flavour, goal, category).
 * New achievements in the seed are added with their default state.
 */
const migrateAchievements = (
  persisted: Record<string, unknown>[],
  seed: Achievement[]
): Achievement[] =>
  seed.map((seedAch) => {
    const saved = persisted?.find((a) => a.id === seedAch.id) as Record<string, unknown> | undefined;
    if (!saved) return seedAch;
    const progress = typeof saved.progress === "number" ? saved.progress : seedAch.progress;
    const unlocked = Boolean(saved.unlocked ?? seedAch.unlocked) || progress >= seedAch.goal;
    return {
      ...seedAch,                                    // fresh: icon, tier, title, description, flavour, goal, category
      unlocked,
      unlockedAt: (saved.unlockedAt as string | undefined) ?? seedAch.unlockedAt,
      progress
    };
  });

const mergeSeedBookMetadata = (books: Book[]) =>
  books.map((book) => {
    const seedMatch = bookSeed.find((seed) => seed.id === book.id || (seed.isbn && seed.isbn === book.isbn));
    if (!seedMatch) {
      return normalizeReadState(book);
    }

    return normalizeReadState({
      ...seedMatch,
      ...book,
      coverImageUri: book.coverImageUri ?? seedMatch.coverImageUri,
      coverGradient: book.coverGradient?.length ? book.coverGradient : seedMatch.coverGradient,
      synopsis: book.synopsis || seedMatch.synopsis,
      publisher: book.publisher || seedMatch.publisher,
      userStatus: {
        ...seedMatch.userStatus,
        ...book.userStatus
      }
    });
  });

/** Coarse format family — print / digital / audio. Same book in a different
 * family is a separate copy, not a duplicate. */
const formatGroupOf = (format?: string): "print" | "digital" | "audio" => {
  if (format === "audiobook") return "audio";
  if (format === "kindle" || format === "ebook") return "digital";
  return "print";
};

const normalizeReadState = (book: Book): Book => {
  const readCount = book.userStatus.readCount ?? (book.userStatus.status === "read" ? 1 : 0);
  const isRereading = book.userStatus.isRereading ?? (book.userStatus.status === "reading" && readCount > 0);
  const currentReadNumber =
    book.userStatus.currentReadNumber ??
    (book.userStatus.status === "reading" ? Math.max(1, readCount + 1) : readCount > 0 ? readCount : undefined);

  return {
    ...book,
    genre: normalizeBookGenres(book.genre),
    userStatus: {
      ...book.userStatus,
      readCount,
      currentReadNumber,
      isRereading
    }
  };
};

const normalizeLocation = (value?: string) => value?.trim().toLowerCase() ?? "";

const enrichProfileAchievements = (
  profile: UserProfile,
  books: Book[],
  sessions: ReadingSession[],
  reviews: Review[]
): UserProfile => {
  const today = new Date().toISOString().slice(0, 10);
  const completedBooks = books.filter((book) => book.userStatus.status === "read");
  const completedReadInstances = completedBooks.reduce(
    (sum, book) => sum + Math.max(1, book.userStatus.readCount ?? 1),
    0
  );
  const totalPagesCompleted = completedBooks.reduce(
    (sum, book) => sum + book.pages * Math.max(1, book.userStatus.readCount ?? 1),
    0
  );
  const totalPagesRead = Math.max(
    sessions.reduce((sum, session) => sum + session.pagesRead, 0),
    totalPagesCompleted
  );
  const rereadProgress = books.filter((book) => (book.userStatus.readCount ?? 0) > 1 || book.userStatus.isRereading).length;
  const distinctGenresRead = new Set(
    completedBooks.flatMap((book) => normalizeBookGenres(book.genre).map((genre) => genre.toLowerCase()))
  );
  const fantasyCount = completedBooks.filter((book) => normalizeBookGenres(book.genre).some((genre) => genre.toLowerCase().includes("fantasy"))).length;
  const scifiCount = completedBooks.filter((book) => normalizeBookGenres(book.genre).some((genre) => {
    const lowered = genre.toLowerCase();
    return lowered.includes("science fiction") || lowered.includes("sci-fi");
  })).length;
  const romanceCount = completedBooks.filter((book) => normalizeBookGenres(book.genre).some((genre) => genre.toLowerCase().includes("romance"))).length;
  const mysteryCount = completedBooks.filter((book) => normalizeBookGenres(book.genre).some((genre) => {
    const lowered = genre.toLowerCase();
    return lowered.includes("mystery") || lowered.includes("thriller") || lowered.includes("crime");
  })).length;
  const completedSeriesMap = completedBooks.reduce<Record<string, number>>((acc, book) => {
    if (!book.seriesId) return acc;
    acc[book.seriesId] = (acc[book.seriesId] ?? 0) + 1;
    return acc;
  }, {});
  const trackedSeriesMap = books.reduce<Record<string, number>>((acc, book) => {
    if (!book.seriesId) return acc;
    acc[book.seriesId] = (acc[book.seriesId] ?? 0) + 1;
    return acc;
  }, {});
  const completedSeriesCount = Object.keys(trackedSeriesMap).filter((seriesId) => {
    const trackedCount = trackedSeriesMap[seriesId] ?? 0;
    const completedCount = completedSeriesMap[seriesId] ?? 0;
    return trackedCount > 0 && trackedCount === completedCount;
  }).length;
  const quoteCount =
    books.reduce((sum, book) => sum + book.userStatus.favoriteQuotes.length, 0) +
    sessions.filter((session) => session.favoriteQuote?.trim()).length;
  const noteCount =
    books.filter((book) => book.userStatus.notes.trim()).length +
    sessions.filter((session) => session.notes.trim()).length;
  const wishlistCount = books.filter((book) => book.userStatus.wishlist).length;
  const audiobookCount = completedBooks.filter((book) => book.format === "audiobook").length;
  const digitalCount = completedBooks.filter((book) => book.format === "kindle").length;
  const bigBookCount = completedBooks.filter((book) => book.pages >= 700).length;
  const whaleCount = completedBooks.filter((book) => book.pages >= 1000).length;
  const uniqueLocations = new Set(
    sessions
      .map((session) => normalizeLocation(session.location))
      .filter(Boolean)
  );
  const hasTravelLocation = Array.from(uniqueLocations).some((location) =>
    ["travel", "airport", "plane", "flight", "train", "commute", "hotel"].some((token) => location.includes(token))
  );
  const hasCoffeeLocation = Array.from(uniqueLocations).some((location) =>
    ["cafe", "coffee", "coffee shop"].some((token) => location.includes(token))
  );
  const hasHomeLocation = Array.from(uniqueLocations).some((location) =>
    ["home", "bedroom", "bed", "sofa", "couch"].some((token) => location.includes(token))
  );
  const hasParkLocation = Array.from(uniqueLocations).some((location) =>
    ["park", "outside", "garden", "beach"].some((token) => location.includes(token))
  );
  const { currentStreak, longestStreak } = calculateStreaks(sessions);
  const longestSingleDayMinutes = Object.values(
    sessions.reduce<Record<string, number>>((acc, session) => {
      acc[session.date] = (acc[session.date] ?? 0) + session.minutesRead;
      return acc;
    }, {})
  ).reduce((max, minutes) => Math.max(max, minutes), 0);
  const averagePagesPerHour =
    sessions.length > 0
      ? Math.round(
          sessions.reduce((sum, session) => sum + session.pagesPerHour, 0) / sessions.length
        )
      : 0;
  const booksReadThisYear = completedBooks.filter(
    (book) => book.userStatus.finishDate && sameYear(book.userStatus.finishDate, new Date().getFullYear())
  ).length;

  const progressById: Record<string, number> = {
    "ach-1-book": completedReadInstances,
    "ach-10-books": completedReadInstances,
    "ach-50-books": completedReadInstances,
    "ach-100-books": completedReadInstances,
    "ach-1k-pages": totalPagesRead,
    "ach-saga-1": completedSeriesCount,
    "ach-fantasy": fantasyCount,
    "ach-scifi": scifiCount,
    "ach-romance": romanceCount,
    "ach-mystery": mysteryCount,
    "ach-around-world": 0,
    "ach-genre-5": distinctGenresRead.size,
    "ach-first-review": reviews.length,
    "ach-quote-collector": quoteCount,
    "ach-deep-thinker": noteCount,
    "ach-goal-hit": booksReadThisYear,
    "ach-epic-saga-master": completedSeriesCount,
    "ach-daily": currentStreak,
    "ach-streak-30": longestStreak,
    "ach-marathon": longestSingleDayMinutes,
    "ach-cozy-reader": sessions.some((session) => {
      const mood = session.mood.toLowerCase();
      const location = normalizeLocation(session.location);
      return mood.includes("cozy") || mood.includes("rain") || location.includes("bed") || location.includes("sofa");
    }) ? 1 : 0,
    "ach-midnight": 0,
    "ach-night-reading": 0,
    "ach-early-bird": 0,
    "ach-speed-55": averagePagesPerHour,
    "ach-collector": books.length,
    "ach-book-hunter": wishlistCount,
    "ach-audiobook": audiobookCount,
    "ach-digital": digitalCount,
    "ach-big-book": bigBookCount,
    "ach-night-owl": 0,
    "ach-whale-reader": whaleCount,
    "ach-library-builder": books.length,
    "ach-legend-reader": completedReadInstances,
    "ach-reading-places": uniqueLocations.size,
    "ach-traveller-reader": hasTravelLocation ? 1 : 0,
    "ach-coffee-shop": hasCoffeeLocation ? 1 : 0,
    "ach-home-reader": hasHomeLocation ? 1 : 0,
    "ach-park-reader": hasParkLocation ? 1 : 0,
    "ach-sessions-50": sessions.length,
    "ach-rereader": rereadProgress
  };

  const achievementMap = new Map(
    [...profile.achievements, rereadAchievement].map((achievement) => [achievement.id, achievement])
  );

  const achievements = Array.from(achievementMap.values()).map((achievement) => {
    const progress = progressById[achievement.id] ?? achievement.progress ?? 0;
    const goal = achievement.id === "ach-goal-hit" ? Math.max(1, profile.yearlyGoal) : achievement.goal;
    const unlocked = progress >= goal;
    return {
      ...achievement,
      goal,
      progress,
      unlocked,
      unlockedAt: unlocked ? achievement.unlockedAt ?? today : undefined
    };
  });

  return {
    ...profile,
    achievements
  };
};

const sameYear = (date: string, year: number) => new Date(date).getFullYear() === year;

const formatMonth = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString("en-US", { month: "short" });
};

const formatWeekday = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString("en-US", { weekday: "short" });
};

const formatLabel = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const daysBetween = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86400000);

const calculateStreaks = (sessions: ReadingSession[]) => {
  const uniqueDates = Array.from(new Set(sessions.map((session) => session.date))).sort().reverse();
  if (uniqueDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let longestStreak = 1;
  let running = 1;
  for (let index = 1; index < uniqueDates.length; index += 1) {
    const previous = new Date(`${uniqueDates[index - 1]}T00:00:00`);
    const current = new Date(`${uniqueDates[index]}T00:00:00`);
    if (daysBetween(previous, current) === 1) {
      running += 1;
      longestStreak = Math.max(longestStreak, running);
    } else {
      running = 1;
    }
  }

  const newest = new Date(`${uniqueDates[0]}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let currentStreak = daysBetween(today, newest) <= 1 ? 1 : 0;
  for (let index = 1; currentStreak > 0 && index < uniqueDates.length; index += 1) {
    const previous = new Date(`${uniqueDates[index - 1]}T00:00:00`);
    const current = new Date(`${uniqueDates[index]}T00:00:00`);
    if (daysBetween(previous, current) === 1) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak };
};

const getBookStatsFromSessions = (sessions: ReadingSession[]): BookStats => {
  const totalSessions = sessions.length;
  const totalMinutes = sessions.reduce((sum, session) => sum + session.minutesRead, 0);
  const totalPages = sessions.reduce((sum, session) => sum + session.pagesRead, 0);
  const longestSession = sessions.reduce<ReadingSession | undefined>(
    (longest, session) => (!longest || session.minutesRead > longest.minutesRead ? session : longest),
    undefined
  );

  return {
    totalSessions,
    totalMinutes,
    totalPages,
    averagePagesPerSession: totalSessions ? Math.round(totalPages / totalSessions) : 0,
    averageMinutesPerSession: totalSessions ? Math.round(totalMinutes / totalSessions) : 0,
    averageSpeed: totalMinutes ? Math.round((totalPages / totalMinutes) * 60) : 0,
    longestSession,
    latestSessions: [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  };
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const buildAuthorId = (name: string) => `a-${slugify(name)}-${Date.now()}`;

const normalizeIsbn = (value?: string) => value?.replace(/[^0-9X]/gi, "").toUpperCase() ?? "";
const normalizeTitle = (value?: string) => value?.trim().toLowerCase() ?? "";
const normalizeAuthorName = (value?: string) => value?.trim().toLowerCase() ?? "";

const colorsFromSource = (source: NewBookInput["source"]) => {
  if (source === "isbn") return { start: "#0F172A", end: "#14B8A6" };
  if (source === "photo") return { start: "#14B8A6", end: "#FFC857" };
  if (source === "search") return { start: "#FFC857", end: "#FF7A59" };
  return { start: "#7FB069", end: "#F3E9D2" };
};

const toSessionRecord = (session: NewReadingSessionInput): ReadingSession => {
  const pagesRead = Math.max(0, session.endPage - session.startPage + 1);
  const pagesPerHour = session.minutesRead > 0 ? Number(((pagesRead / session.minutesRead) * 60).toFixed(1)) : 0;

  return {
    ...session,
    id: `rs-${Date.now()}`,
    pagesRead,
    pagesPerHour
  };
};

const buildUpdatedSession = (sessionId: string, input: NewReadingSessionInput): ReadingSession => {
  const pagesRead = Math.max(0, input.endPage - input.startPage + 1);
  const pagesPerHour = input.minutesRead > 0 ? Number(((pagesRead / input.minutesRead) * 60).toFixed(1)) : 0;

  return {
    ...input,
    id: sessionId,
    pagesRead,
    pagesPerHour
  };
};

const syncBookWithSessions = (book: Book, sessions: ReadingSession[]) => {
  if (!sessions.length) {
    return book;
  }

  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const firstSession = sorted[0];
  const latestSession = sorted[sorted.length - 1];
  const latestProgress = Math.min(100, Math.round((latestSession.endPage / (book.pages || 1)) * 100));
  const completed = latestProgress >= 100;

  return normalizeReadState({
    ...book,
    userStatus: {
      ...book.userStatus,
      status: completed ? "read" : "reading",
      progressPercent: latestProgress,
      startDate: firstSession.date,
      finishDate: completed ? latestSession.date : undefined,
      ...(completed
        ? {
            readCount: Math.max(1, book.userStatus.readCount ?? 0),
            currentReadNumber: Math.max(1, book.userStatus.readCount ?? 1),
            isRereading: false
          }
        : {})
    }
  });
};

const buildOverallStats = (books: Book[], sessions: ReadingSession[], authors: Author[]): OverallStats => {
  const totalBooksRead = books.filter((book) => book.userStatus.status === "read").length;
  const booksReadThisYear = books.filter((book) => book.userStatus.finishDate && sameYear(book.userStatus.finishDate, new Date().getFullYear())).length;
  const rereadsCompleted = books.reduce((sum, book) => sum + Math.max(0, (book.userStatus.readCount ?? 0) - 1), 0);
  const activeRereads = books.filter((book) => book.userStatus.isRereading).length;
  const booksTracked = books.length;
  const pagesRead = sessions.reduce((sum, session) => sum + session.pagesRead, 0);
  const minutesRead = sessions.reduce((sum, session) => sum + session.minutesRead, 0);
  const totalSessions = sessions.length;
  const averageSessionEnjoyment = totalSessions
    ? Number((sessions.reduce((sum, session) => sum + session.enjoymentRating, 0) / totalSessions).toFixed(1))
    : 0;
  const averageBookLength = booksTracked
    ? Math.round(books.reduce((sum, book) => sum + book.pages, 0) / booksTracked)
    : 0;
  const rated = books.filter((book) => typeof book.userStatus.rating === "number");
  const averageRating = rated.length
    ? Number((rated.reduce((sum, book) => sum + (book.userStatus.rating ?? 0), 0) / rated.length).toFixed(1))
    : 0;
  const { currentStreak, longestStreak } = calculateStreaks(sessions);
  const completionRate = booksTracked ? Math.round((totalBooksRead / booksTracked) * 100) : 0;
  const ownedCount = books.filter((book) => book.userStatus.ownership === "owned").length;
  const wishlistCount = books.filter((book) => book.userStatus.wishlist).length;
  const wantToBuyCount = books.filter((book) => book.userStatus.wantToBuy).length;

  const byDate = sessions.reduce<Record<string, number>>((acc, session) => {
    acc[session.date] = (acc[session.date] ?? 0) + session.pagesRead;
    return acc;
  }, {});
  const bestReadingDay = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No sessions yet";
  const longestSession = sessions.reduce<ReadingSession | undefined>(
    (longest, session) => (!longest || session.minutesRead > longest.minutesRead ? session : longest),
    undefined
  );

  const monthlyMap = sessions.reduce<Record<string, MonthBucket>>((acc, session) => {
    const label = formatMonth(session.date);
    acc[label] = acc[label] ?? { label, pages: 0, minutes: 0, sessions: 0, booksFinished: 0 };
    acc[label].pages += session.pagesRead;
    acc[label].minutes += session.minutesRead;
    acc[label].sessions += 1;
    return acc;
  }, {});
  books.forEach((book) => {
    if (book.userStatus.finishDate) {
      const label = formatMonth(book.userStatus.finishDate);
      monthlyMap[label] = monthlyMap[label] ?? { label, pages: 0, minutes: 0, sessions: 0, booksFinished: 0 };
      monthlyMap[label].booksFinished += 1;
    }
  });

  const genreMap = books
    .filter((book) => book.userStatus.status === "read" || book.userStatus.status === "reading")
    .flatMap((book) => normalizeBookGenres(book.genre))
    .reduce<Record<string, number>>((acc, genre) => {
      acc[genre] = (acc[genre] ?? 0) + 1;
      return acc;
    }, {});

  const authorMap = books
    .filter((book) => book.userStatus.status === "read" || book.userStatus.status === "reading")
    .reduce<Record<string, number>>((acc, book) => {
      acc[book.authorId] = (acc[book.authorId] ?? 0) + 1;
      return acc;
    }, {});

  const statusCounts = [
    { label: "Owned", value: ownedCount },
    { label: "Wishlist", value: wishlistCount },
    { label: "Want to Buy", value: wantToBuyCount },
    { label: "Unfinished", value: books.filter((book) => book.userStatus.status === "dnf").length }
  ];

  const weekdayMap = sessions.reduce<Record<string, number>>((acc, session) => {
    const weekday = formatWeekday(session.date);
    acc[weekday] = (acc[weekday] ?? 0) + 1;
    return acc;
  }, {});
  const locationMap = sessions.reduce<Record<string, number>>((acc, session) => {
    acc[session.location] = (acc[session.location] ?? 0) + 1;
    return acc;
  }, {});
  const formatMap = sessions.reduce<Record<string, number>>((acc, session) => {
    acc[session.format] = (acc[session.format] ?? 0) + 1;
    return acc;
  }, {});
  const seriesProgressMap = books.reduce<Record<string, { total: number; finished: number; active: boolean }>>((acc, book) => {
    if (!book.seriesId) return acc;
    acc[book.seriesId] = acc[book.seriesId] ?? { total: 0, finished: 0, active: false };
    acc[book.seriesId].total += 1;
    if (book.userStatus.status === "read") acc[book.seriesId].finished += 1;
    if (book.userStatus.status === "reading") acc[book.seriesId].active = true;
    return acc;
  }, {});
  const completedSeriesCount = Object.values(seriesProgressMap).filter((entry) => entry.total > 0 && entry.finished === entry.total).length;
  const activeSeriesCount = Object.values(seriesProgressMap).filter((entry) => entry.active).length;

  return {
    totalBooksRead,
    booksReadThisYear,
    rereadsCompleted,
    activeRereads,
    booksTracked,
    pagesRead,
    minutesRead,
    totalSessions,
    averagePagesPerSession: totalSessions ? Math.round(pagesRead / totalSessions) : 0,
    averageMinutesPerSession: totalSessions ? Math.round(minutesRead / totalSessions) : 0,
    averageRating,
    averageSessionEnjoyment,
    averageBookLength,
    currentStreak,
    longestStreak,
    completionRate,
    ownedCount,
    wishlistCount,
    wantToBuyCount,
    activeSeriesCount,
    completedSeriesCount,
    bestReadingDay,
    longestSession,
    monthly: Object.values(monthlyMap),
    genreCounts: Object.entries(genreMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    authorCounts: Object.entries(authorMap)
      .map(([authorId, value]) => ({ label: authors.find((author) => author.id === authorId)?.name ?? authorId, value }))
      .sort((a, b) => b.value - a.value),
    statusCounts,
    formatCounts: Object.entries(formatMap).map(([label, value]) => ({ label: formatLabel(label), value })).sort((a, b) => b.value - a.value),
    locationCounts: Object.entries(locationMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    speedOverTime: [...sessions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((session) => ({ label: formatMonth(session.date), value: Math.round(session.pagesPerHour) })),
    mostActiveDays: Object.entries(weekdayMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  };
};

export function BooklizProvider({ children }: PropsWithChildren) {
  const repositoryRef = useRef<BooklizRepository>(new LocalFirstBooklizRepository());
  const [authors, setAuthors] = useState<Author[]>(authorSeed);
  const [books, setBooks] = useState<Book[]>(() => bookSeed.map(normalizeReadState));
  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>(sessionSeed);
  const [profile, setProfile] = useState<UserProfile>(userProfile);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userLists, setUserLists] = useState<UserList[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [repositoryStatus, setRepositoryStatus] = useState<RepositoryStatus>(repositoryRef.current.getStatus());
  const [seriesJustCompleted, setSeriesJustCompleted] = useState<{ seriesId: string; seriesName: string } | null>(null);
  const [readingIdentity, setReadingIdentity] = useState<ReadingIdentity | null>(null);
  const resolvedProfile = useMemo(
    () => enrichProfileAchievements(profile, books, readingSessions, reviews),
    [books, profile, readingSessions, reviews]
  );

  // Track the latest persisted state in a ref so the AppState effect (which
  // only depends on `hydrated`) can access fresh data without re-subscribing.
  const latestStateRef = useRef<PersistedBooklizState>({
    authors, books, readingSessions, reviews, userLists, userProfile: resolvedProfile,
  });
  useEffect(() => {
    latestStateRef.current = { authors, books, readingSessions, reviews, userLists, userProfile: resolvedProfile };
  }, [authors, books, readingSessions, reviews, userLists, resolvedProfile]);

  // ── Reading identity (Phase 1, BOOKLIZ_PLATFORM_ROADMAP.md) ────────────────
  // Local-first: load the cached identity instantly on mount…
  useEffect(() => {
    let mounted = true;
    void loadStoredIdentity().then((cached) => {
      if (mounted && cached) setReadingIdentity(cached);
    });
    return () => { mounted = false; };
  }, []);

  // …then recompute (debounced 5s) whenever the underlying data changes.
  // Pure on-device reduction — no network, works fully offline.
  useEffect(() => {
    if (!hydrated) return; // don't compute over seed data before hydration
    const timer = setTimeout(() => {
      try {
        const identity = computeReadingIdentity({ authors, books, readingSessions, reviews });
        setReadingIdentity(identity);
        void storeIdentity(identity);
        if (__DEV__) console.log("[IDENTITY]", JSON.stringify(identity, null, 2));
      } catch {
        // identity is a derived nicety — never let it break the app
      }
    }, 5_000);
    return () => clearTimeout(timer);
  }, [hydrated, authors, books, readingSessions, reviews]);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const snapshot = await repositoryRef.current.load();
        if (mounted) {
          setRepositoryStatus(repositoryRef.current.getStatus());
        }

        if (!snapshot || !mounted) {
          return;
        }

        const parsed = snapshot as PersistedBooklizState;
        // ?? only falls back when the field is null/undefined (missing from old snapshots).
        // An intentionally-empty [] after a reset is preserved as-is, preventing
        // mock seed data from reappearing on the next launch.
        setAuthors(parsed.authors ?? authorSeed);
        setBooks(
          parsed.books !== undefined
            ? (parsed.books.length ? mergeSeedBookMetadata(parsed.books) : [])
            : bookSeed.map(normalizeReadState)
        );
        setReadingSessions(parsed.readingSessions ?? sessionSeed);
        if (Array.isArray(parsed.reviews)) {
          setReviews(parsed.reviews);
        }
        if (Array.isArray(parsed.userLists)) {
          setUserLists(parsed.userLists);
        }
        if (parsed.userProfile?.id) {
          const persistedAccount = await readPersistedConnectedAccount();
          const migratedAchievements = migrateAchievements(
            (parsed.userProfile.achievements as unknown as Record<string, unknown>[]) ?? [],
            userProfile.achievements
          );
          setProfile({
            ...userProfile,
            ...parsed.userProfile,
            ...(persistedAccount
              ? {
                  name: persistedAccount.name,
                  avatarInitials: buildInitials(persistedAccount.name, persistedAccount.email),
                  avatarUri: persistedAccount.picture,
                  email: persistedAccount.email,
                  authProvider: persistedAccount.provider
                }
              : {}),
            achievements: migratedAchievements
          });
        } else {
          setProfile(userProfile);
        }
        // Onboarding flag (stored separately from the main library snapshot)
        const onboardingFlag = await AsyncStorage.getItem("@bookliz/onboardingComplete");
        if (mounted && onboardingFlag === "true") {
          setOnboardingComplete(true);
        }
      } catch (error) {
        console.warn("Booklio could not hydrate local library", error);
      } finally {
        if (mounted) {
          setRepositoryStatus(repositoryRef.current.getStatus());
          setHydrated(true);
        }
      }
    };

    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  // Flush offline queue when app returns to foreground and network is available.
  // The repository does a full delete + re-insert on every save(), so one call
  // covers all pending operations regardless of type — no need for per-op replay.
  useEffect(() => {
    if (!hydrated) return;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void (async () => {
          const online = await isOnline();
          if (!online) return;
          const pending = await hasPendingOperations();
          if (!pending) return;
          try {
            await repositoryRef.current.save(createBooklizSnapshot(latestStateRef.current));
            await clearQueue();
            if (__DEV__) console.log("[Booklio] Offline queue flushed via full Supabase sync.");
          } catch (err) {
            console.warn("[Booklio] Could not flush offline queue", err);
          }
        })();
      }
    });
    return () => subscription.remove();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !supabase) {
      return;
    }

    const subscription = supabase.auth.onAuthStateChange(async (event) => {
      if (!["SIGNED_IN", "SIGNED_OUT", "INITIAL_SESSION", "TOKEN_REFRESHED"].includes(event)) {
        return;
      }

      try {
        const snapshot = await repositoryRef.current.load();
        setRepositoryStatus(repositoryRef.current.getStatus());

        if (!snapshot) {
          return;
        }

        const parsed = snapshot as PersistedBooklizState;
        // ?? only falls back when the field is null/undefined (missing from old snapshots).
        // An intentionally-empty [] after a reset is preserved as-is, preventing
        // mock seed data from reappearing on the next launch.
        setAuthors(parsed.authors ?? authorSeed);
        setBooks(
          parsed.books !== undefined
            ? (parsed.books.length ? mergeSeedBookMetadata(parsed.books) : [])
            : bookSeed.map(normalizeReadState)
        );
        setReadingSessions(parsed.readingSessions ?? sessionSeed);

        if (parsed.userProfile?.id) {
          const persistedAccount = await readPersistedConnectedAccount();
          const migratedAchievements = migrateAchievements(
            (parsed.userProfile.achievements as unknown as Record<string, unknown>[]) ?? [],
            userProfile.achievements
          );
          setProfile({
            ...userProfile,
            ...parsed.userProfile,
            ...(persistedAccount
              ? {
                  name: persistedAccount.name,
                  avatarInitials: buildInitials(persistedAccount.name, persistedAccount.email),
                  avatarUri: persistedAccount.picture,
                  email: persistedAccount.email,
                  authProvider: persistedAccount.provider
                }
              : {}),
            achievements: migratedAchievements
          });
        }
      } catch (error) {
        console.warn("Booklio could not refresh after auth change", error);
        setRepositoryStatus(repositoryRef.current.getStatus());
      }
    });

    return () => {
      subscription.data.subscription.unsubscribe();
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const persist = async () => {
      const state: PersistedBooklizState = { authors, books, readingSessions, reviews, userLists, userProfile: resolvedProfile };
      try {
        await repositoryRef.current.save(createBooklizSnapshot(state));
        setRepositoryStatus(repositoryRef.current.getStatus());
      } catch (error) {
        console.warn("Booklio could not persist local library", error);
        // Queue a full sync marker so the AppState listener retries when back online.
        // AsyncStorage was already written successfully — this only covers the
        // Supabase / remote sync portion that failed.
        void enqueue("upsert_profile", { reason: "full_sync_needed", timestamp: Date.now() });
        setRepositoryStatus(repositoryRef.current.getStatus());
      }
    };

    persist();
  }, [authors, books, hydrated, readingSessions, resolvedProfile, reviews]);

  const value = useMemo<BooklizContextValue>(() => {
    const getBook = (bookId: string) => books.find((book) => book.id === bookId);
    const getAuthor = (authorId: string) => authors.find((author) => author.id === authorId);
    const getReadingSession = (sessionId: string) => readingSessions.find((session) => session.id === sessionId);
    const getSessionsForBook = (bookId: string) =>
      readingSessions.filter((session) => session.bookId === bookId).sort((a, b) => b.date.localeCompare(a.date));
    const getBookStats = (bookId: string) => getBookStatsFromSessions(getSessionsForBook(bookId));
    const recommendationList = buildGlobalRecommendations(books, readingSessions, authors);
    const getRecommendationsForBook = (bookId: string, limit = 4) => {
      const book = getBook(bookId);
      if (!book) return [];
      return buildBookSpecificRecommendations(book, books, readingSessions, authors, limit);
    };

    const addReadingSession = (input: NewReadingSessionInput) => {
      const session = toSessionRecord(input);
      const nextBookSessions = [...readingSessions.filter((current) => current.bookId === input.bookId), session];

      setReadingSessions((current) => [session, ...current]);
      setBooks((current) =>
        current.map((book) => {
          if (book.id !== input.bookId) {
            return book;
          }

          const syncedBook = syncBookWithSessions(book, nextBookSessions);
          if (syncedBook.userStatus.status !== "read") {
            return syncedBook;
          }

          const readCount = book.userStatus.readCount ?? (book.userStatus.status === "read" ? 1 : 0);
          const nextReadCount = readCount + 1;

          return normalizeReadState({
            ...syncedBook,
            userStatus: {
              ...syncedBook.userStatus,
              readCount: nextReadCount,
              currentReadNumber: nextReadCount,
              isRereading: false
            }
          });
        })
      );

      return session;
    };

    const updateReadingSession = (sessionId: string, input: NewReadingSessionInput) => {
      const existingSession = getReadingSession(sessionId);
      if (!existingSession) {
        return undefined;
      }

      const updatedSession = buildUpdatedSession(sessionId, input);
      const nextSessions = readingSessions.map((session) => (session.id === sessionId ? updatedSession : session));
      const touchedBookIds = Array.from(new Set([existingSession.bookId, updatedSession.bookId]));

      setReadingSessions(nextSessions);
      setBooks((current) =>
        current.map((book) => {
          if (!touchedBookIds.includes(book.id)) {
            return book;
          }

          const sessionsForBook = nextSessions.filter((session) => session.bookId === book.id);
          return syncBookWithSessions(book, sessionsForBook);
        })
      );

      return updatedSession;
    };

    const deleteReadingSession = (sessionId: string) => {
      const existingSession = getReadingSession(sessionId);
      if (!existingSession) {
        return;
      }

      const nextSessions = readingSessions.filter((session) => session.id !== sessionId);
      setReadingSessions(nextSessions);
      setBooks((current) =>
        current.map((book) => {
          if (book.id !== existingSession.bookId) {
            return book;
          }

          const sessionsForBook = nextSessions.filter((session) => session.bookId === book.id);
          return syncBookWithSessions(book, sessionsForBook);
        })
      );
    };

    const deleteBook = (bookId: string) => {
      const existingBook = getBook(bookId);
      if (!existingBook) {
        return;
      }

      const remainingBooks = books.filter((book) => book.id !== bookId);
      const remainingAuthorIds = new Set(remainingBooks.map((book) => book.authorId));

      setBooks(remainingBooks);
      setReadingSessions((current) => current.filter((session) => session.bookId !== bookId));
      setReviews((current) => current.filter((review) => review.bookId !== bookId));
      setProfile((current) => ({
        ...current,
        topBookIds: current.topBookIds.filter((id) => id !== bookId)
      }));

      if (!remainingAuthorIds.has(existingBook.authorId)) {
        setAuthors((current) => current.filter((author) => author.id !== existingBook.authorId));
      }
    };

    /** Returns the existing book if input is a true duplicate (same ISBN or title+author, same language). */
    const findDuplicateBook = (input: NewBookInput): Book | null => {
      const normalizedIsbn = normalizeIsbn(input.isbn);
      const normalizedTitle = normalizeTitle(input.title);
      const normalizedAuthor = normalizeAuthorName(input.authorName.trim() || "");
      const incomingLang = (input.language ?? "").toLowerCase().trim();
      return books.find((candidate) => {
        const candidateAuthor = authors.find((a) => a.id === candidate.authorId)?.name ?? "";
        const candidateLang = (candidate.language ?? "").toLowerCase().trim();
        const sameLanguage = !incomingLang || !candidateLang || incomingLang === candidateLang;
        const sameIsbn = Boolean(normalizedIsbn && normalizeIsbn(candidate.isbn) === normalizedIsbn);
        const sameTitleAndAuthor = Boolean(
          normalizedTitle &&
          normalizeTitle(candidate.title) === normalizedTitle &&
          normalizeAuthorName(candidateAuthor) === normalizedAuthor
        );
        const sameFormat = formatGroupOf(input.format) === formatGroupOf(candidate.format);
        return (sameIsbn || sameTitleAndAuthor) && sameLanguage && sameFormat;
      }) ?? null;
    };

    const addBook = (input: NewBookInput) => {
      const authorName = input.authorName.trim() || "Author to identify";
      const existingAuthor = authors.find((author) => author.name.toLowerCase() === authorName.toLowerCase());
      const authorId = existingAuthor?.id ?? buildAuthorId(authorName);
      const normalizedIncomingIsbn = normalizeIsbn(input.isbn);
      const normalizedIncomingTitle = normalizeTitle(input.title);
      const normalizedIncomingAuthor = normalizeAuthorName(authorName);

      const incomingLang = (input.language ?? "").toLowerCase().trim();
      const existingBook = books.find((candidate) => {
        const candidateAuthor = authors.find((author) => author.id === candidate.authorId)?.name ?? "";
        const candidateLang = (candidate.language ?? "").toLowerCase().trim();
        // Language guard: only treat as duplicate if languages match (or one is unset)
        const sameLanguage = !incomingLang || !candidateLang || incomingLang === candidateLang;
        const sameIsbn = normalizedIncomingIsbn && normalizeIsbn(candidate.isbn) === normalizedIncomingIsbn;
        const sameTitleAndAuthor =
          normalizedIncomingTitle &&
          normalizeTitle(candidate.title) === normalizedIncomingTitle &&
          normalizeAuthorName(candidateAuthor) === normalizedIncomingAuthor;
        // Same ISBN in a different language or format family = a different copy
        const sameFormat = formatGroupOf(input.format) === formatGroupOf(candidate.format);
        return (sameIsbn || sameTitleAndAuthor) && sameLanguage && sameFormat;
      });

      // Co-authors become REAL Author entities (created or reused), not just
      // display strings — same treatment as the primary author.
      const coAuthorNames = (input.coAuthorNames ?? [])
        .map((name) => name.trim())
        .filter((name) => name && name.toLowerCase() !== authorName.toLowerCase());
      const authorsToCreate: Author[] = [];
      if (!existingAuthor) {
        authorsToCreate.push({
          id: authorId,
          name: authorName,
          bio: "", // never fabricate visible metadata
          favoriteGenres: normalizeBookGenres(input.genre)
        });
      }
      const coAuthorIds = coAuthorNames.map((name) => {
        const existing = authors.find((a) => a.name.toLowerCase() === name.toLowerCase())
          ?? authorsToCreate.find((a) => a.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing.id;
        const id = buildAuthorId(name);
        authorsToCreate.push({ id, name, bio: "", favoriteGenres: [] });
        return id;
      });
      if (authorsToCreate.length) {
        setAuthors((current) => [...current, ...authorsToCreate]);
      }

      if (existingBook) {
        const mergedBook: Book = normalizeReadState({
          ...existingBook,
          title: input.title.trim() || existingBook.title,
          authorId,
          coAuthorNames: coAuthorNames.length ? coAuthorNames : existingBook.coAuthorNames,
          coAuthorIds: coAuthorIds.length ? coAuthorIds : existingBook.coAuthorIds,
          synopsis: input.synopsis?.trim() || existingBook.synopsis,
          genre: input.genre?.length ? normalizeBookGenres(input.genre) : normalizeBookGenres(existingBook.genre),
          pages: input.pages ?? existingBook.pages,
          publishedDate: input.publishedDate ?? existingBook.publishedDate,
          publisher: input.publisher ?? existingBook.publisher,
          language: input.language ?? existingBook.language,
          isbn: input.isbn ?? existingBook.isbn,
          format: input.format ?? existingBook.format,
          coverImageUri: input.coverImageUri ?? existingBook.coverImageUri,
          coverGradient: existingBook.coverGradient,
          isBestseller: input.isBestseller ?? existingBook.isBestseller,
          tags: Array.from(new Set([...(existingBook.tags ?? []), ...(input.tags ?? [])])),
          workKey: input.workKey ?? existingBook.workKey,
          editionKey: input.editionKey ?? existingBook.editionKey,
          languageCode: input.languageCode ?? existingBook.languageCode,
          userStatus: {
            ...existingBook.userStatus,
            ownership: input.ownership ?? existingBook.userStatus.ownership,
            wishlist: input.wishlist ?? existingBook.userStatus.wishlist,
            wantToBuy: input.wantToBuy ?? existingBook.userStatus.wantToBuy,
          }
        });

        setBooks((current) =>
          current.map((book) => (book.id === existingBook.id ? mergedBook : book))
        );
        return mergedBook;
      }

      const book: Book = {
        id: `b-${slugify(input.title || "captured-book")}-${Date.now()}`,
        title: input.title.trim() || "Untitled Book",
        authorId,
        coAuthorNames: coAuthorNames.length ? coAuthorNames : undefined,
        coAuthorIds: coAuthorIds.length ? coAuthorIds : undefined,
        synopsis: input.synopsis ?? "", // "" = unknown, UI offers "Find synopsis"
        genre: normalizeBookGenres(input.genre),
        // 0 / "" = unknown — never fabricate metadata the source didn't provide.
        pages: input.pages ?? 0,
        publishedDate: input.publishedDate ?? "",
        publisher: input.publisher ?? "",
        language: input.language ?? "English",
        isbn: input.isbn ?? "",
        format: input.format ?? "physical",
        coverGradient: [colorsFromSource(input.source).start, colorsFromSource(input.source).end],
        coverImageUri: input.coverImageUri,
        isBestseller: input.isBestseller,
        workKey: input.workKey,
        editionKey: input.editionKey,
        languageCode: input.languageCode,
        tags: input.tags ?? [],
          userStatus: {
            status: "want-to-read",
            ownership: input.ownership ?? "owned",
            wishlist: input.wishlist ?? false,
            wantToBuy: input.wantToBuy ?? false,
            readCount: 0,
            progressPercent: 0,
            notes: "", // no auto-generated notes — the Notes section stays clean
            favoriteQuotes: []
        }
      };

      setBooks((current) => [book, ...current]);
      return book;
    };

    const updateBookFormat = (bookId: string, format: Book["format"]) => {
      setBooks((current) => current.map((b) => (b.id === bookId ? { ...b, format } : b)));
    };

    const updateBookSynopsis = (bookId: string, synopsis: string) => {
      setBooks((current) => current.map((b) => (b.id === bookId ? { ...b, synopsis } : b)));
    };

    const updateBookStatus = (bookId: string, newStatus: CoreTrackingStatus, rating?: number) => {
      const today = new Date().toISOString().slice(0, 10);

      // Detect series completion: if this book is the last unread book in a series
      if (newStatus === "read") {
        const targetBook = books.find((b) => b.id === bookId);
        if (targetBook?.seriesId && targetBook.userStatus.status !== "read") {
          const seriesBooks = books.filter((b) => b.seriesId === targetBook.seriesId);
          const allOthersRead = seriesBooks.every(
            (b) => b.id === bookId || b.userStatus.status === "read"
          );
          if (allOthersRead && seriesBooks.length > 1) {
            const saga = series.find((s) => s.id === targetBook.seriesId);
            setSeriesJustCompleted({
              seriesId: targetBook.seriesId,
              seriesName: saga?.name ?? "Series",
            });
          }
        }
      }

      setBooks((current) =>
        current.map((book) => {
          if (book.id !== bookId) return book;
          const readCount = book.userStatus.readCount ?? (book.userStatus.status === "read" ? 1 : 0);
          const shouldStartReread =
            newStatus === "reading" &&
            book.userStatus.status !== "reading" &&
            readCount > 0;
          const completedReadCount = book.userStatus.isRereading
            ? Math.max(readCount + 1, book.userStatus.currentReadNumber ?? readCount + 1)
            : Math.max(1, readCount);
          return {
            ...book,
            userStatus: {
              ...book.userStatus,
              status: newStatus,
              ...(rating !== undefined ? { rating } : {}),
              // Wishlist: book is desired but not owned
              ...(newStatus === "wishlist"
                ? { wishlist: true, ownership: "not-owned" as const, wantToBuy: false }
                : { wishlist: false }),
              ...(newStatus === "reading"
                ? shouldStartReread
                  ? {
                      startDate: today,
                      finishDate: undefined,
                      progressPercent: 0,
                      currentReadNumber: readCount + 1,
                      isRereading: true
                    }
                  : !book.userStatus.startDate
                    ? { startDate: today }
                    : {}
                : {}),
              ...(newStatus === "read"
                ? {
                    progressPercent: 100,
                    finishDate: book.userStatus.finishDate ?? today,
                    readCount: completedReadCount,
                    currentReadNumber: completedReadCount,
                    isRereading: false
                  }
                : {})
            }
          };
        })
      );
    };

    const updateBook = (bookId: string, input: UpdateBookInput) => {
      const authorName = input.authorName.trim() || "Author to identify";
      const existingAuthorId = authors.find((author) => author.name.toLowerCase() === authorName.toLowerCase())?.id;
      const authorId = existingAuthorId ?? buildAuthorId(authorName);

      if (!existingAuthorId) {
        setAuthors((current) => [
          ...current,
          {
            id: authorId,
            name: authorName,
            bio: "Author added from Booklio. Ready to be enriched when we connect a live books API.",
            favoriteGenres: normalizeBookGenres(input.genre)
          }
        ]);
      }

      setBooks((current) =>
        current.map((book) => {
          if (book.id !== bookId) return book;
          return normalizeReadState({
            ...book,
            title: input.title.trim() || book.title,
            authorId,
            synopsis: input.synopsis.trim() || "No synopsis yet.",
            genre: normalizeBookGenres(input.genre),
            pages: input.pages > 0 ? input.pages : book.pages,
            publishedDate: input.publishedDate.trim() || book.publishedDate,
            publisher: input.publisher.trim() || "Publisher pending confirmation",
            language: input.language.trim() || "English",
            isbn: input.isbn.trim() || "ISBN pending",
            format: input.format,
            coverImageUri: input.coverImageUri?.trim() || undefined,
            seriesName: input.seriesName?.trim() || undefined,
            seriesNumber: input.seriesNumber,
            isBestseller: input.isBestseller,
            isSequel: input.seriesNumber !== undefined ? input.seriesNumber > 1 : input.isSequel,
            tags: input.tags,
            userStatus: {
              ...book.userStatus,
              status: input.status,
              ownership: input.ownership,
              wishlist: input.wishlist,
              wantToBuy: input.wantToBuy,
              rating: input.rating,
              personalRanking: input.personalRanking,
              startDate: input.startDate?.trim() || undefined,
              finishDate: input.finishDate?.trim() || undefined,
              progressPercent: Math.min(100, Math.max(0, input.progressPercent)),
              notes: input.notes,
              favoriteQuotes: input.favoriteQuotes
            }
          });
        })
      );
    };

    const updateUserProfile = (input: UpdateUserProfileInput) => {
      setProfile((current) => ({
        ...current,
        name: input.name.trim() || current.name,
        avatarInitials: input.avatarInitials.trim().slice(0, 3).toUpperCase() || current.avatarInitials,
        avatarUri: input.avatarUri ?? current.avatarUri,
        email: input.email ?? current.email,
        authProvider: input.authProvider ?? current.authProvider,
        readingLevel: input.readingLevel?.trim() || current.readingLevel,
        yearlyGoal: input.yearlyGoal > 0 ? input.yearlyGoal : current.yearlyGoal,
        favoriteAuthors: input.favoriteAuthors.length ? input.favoriteAuthors : current.favoriteAuthors,
        favoriteGenres: input.favoriteGenres.length ? input.favoriteGenres : current.favoriteGenres
      }));
    };

    const getReviewForBook = (bookId: string) => reviews.find((r) => r.bookId === bookId);

    const addReview = (input: Omit<Review, "id" | "createdAt">): Review => {
      const review: Review = {
        ...input,
        id: `rev-${Date.now()}`,
        createdAt: new Date().toISOString().slice(0, 10)
      };
      setReviews((prev) => [review, ...prev.filter((r) => r.bookId !== input.bookId)]);
      return review;
    };

    const updateReview = (reviewId: string, input: Omit<Review, "id" | "createdAt">) => {
      setReviews((prev) =>
        prev.map((r) => r.id === reviewId ? { ...r, ...input } : r)
      );
    };

    const deleteReview = (reviewId: string) => {
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    };

    const createUserList = (name: string, emoji?: string): UserList => {
      const now = new Date().toISOString();
      const list: UserList = { id: `list-${Date.now()}`, name: name.trim(), emoji, bookIds: [], createdAt: now, updatedAt: now };
      setUserLists((prev) => [...prev, list]);
      return list;
    };

    const renameUserList = (listId: string, name: string, emoji?: string) => {
      setUserLists((prev) =>
        prev.map((l) => l.id === listId ? { ...l, name: name.trim(), emoji, updatedAt: new Date().toISOString() } : l)
      );
    };

    const deleteUserList = (listId: string) => {
      setUserLists((prev) => prev.filter((l) => l.id !== listId));
    };

    const addBookToList = (listId: string, bookId: string) => {
      setUserLists((prev) =>
        prev.map((l) =>
          l.id === listId && !l.bookIds.includes(bookId)
            ? { ...l, bookIds: [...l.bookIds, bookId], updatedAt: new Date().toISOString() }
            : l
        )
      );
    };

    const removeBookFromList = (listId: string, bookId: string) => {
      setUserLists((prev) =>
        prev.map((l) =>
          l.id === listId
            ? { ...l, bookIds: l.bookIds.filter((id) => id !== bookId), updatedAt: new Date().toISOString() }
            : l
        )
      );
    };

    const completeOnboarding = async (name: string, genres: string[]) => {
      const trimmedName = name.trim() || "Reader";
      const initials = buildInitials(trimmedName, undefined);
      // Wipe all seed/demo data so new users start with a clean library
      setAuthors([]);
      setBooks([]);
      setReadingSessions([]);
      setReviews([]);
      setUserLists([]);
      setProfile((prev) => ({
        ...prev,
        name: trimmedName,
        avatarInitials: initials,
        favoriteGenres: genres.length ? genres : prev.favoriteGenres,
        readingLevel: ""   // Always start with auto-computed title; no custom override for new accounts
      }));
      await AsyncStorage.setItem("@bookliz/onboardingComplete", "true");
      setOnboardingComplete(true);
    };

    const resetApp = async () => {
      // 1. Prevent the persist effect from re-saving while we wipe
      setHydrated(false);
      // 2. Reset all React state FIRST so the persist snapshot is empty
      setAuthors([]);
      setBooks([]);
      setReadingSessions([]);
      setReviews([]);
      setUserLists([]);
      setProfile(userProfile);
      setOnboardingComplete(false);
      // 3. Wipe AsyncStorage
      await AsyncStorage.multiRemove([
        "bookliz:v2",
        "@bookliz/onboardingComplete",
        "bookliz_connected_account",
        "bookliz_google_account"
      ]);
      // 4. Sign out from Supabase if active
      try {
        const { supabase: sb } = await import("../lib/supabase");
        if (sb) await sb.auth.signOut();
      } catch (_) { /* ignore */ }
      // 5. Re-enable persistence (with clean state)
      setHydrated(true);
    };

    /** Clear all library data (books, sessions, reviews, lists) but keep account + settings. */
    const clearLibrary = async () => {
      setHydrated(false);
      setAuthors([]);
      setBooks([]);
      setReadingSessions([]);
      setReviews([]);
      setUserLists([]);
      // Persist a snapshot with empty library but keep profile intact
      await AsyncStorage.setItem(
        "bookliz:v2",
        JSON.stringify({ authors: [], books: [], readingSessions: [], reviews: [], userLists: [], userProfile: latestStateRef.current.userProfile })
      );
      setHydrated(true);
    };

    const connectIdentityAccount = async (account: ConnectedAccount) => {
      await persistConnectedAccount(account);
      setProfile((current) => ({
        ...current,
        name: account.name || current.name,
        avatarInitials: buildInitials(account.name, account.email ?? current.email),
        avatarUri: account.picture ?? current.avatarUri,
        email: account.email ?? current.email,
        authProvider: account.provider
      }));
    };

    const disconnectIdentityAccount = async () => {
      await clearPersistedConnectedAccount();
      setProfile((current) => ({
        ...current,
        avatarUri: undefined,
        email: undefined,
        authProvider: undefined
      }));
    };

    return {
      authors,
      books,
      readingSessions: [...readingSessions].sort((a, b) => b.date.localeCompare(a.date)),
      reviews,
      userLists,
      recommendations: recommendationList,
      series,
      userProfile: resolvedProfile,
      repositoryStatus,
      onboardingComplete,
      completeOnboarding,
      resetApp,
      clearLibrary,
      connectIdentityAccount,
      disconnectIdentityAccount,
      addBook,
      findDuplicateBook,
      addReadingSession,
      updateReadingSession,
      deleteReadingSession,
      deleteBook,
      updateBook,
      updateBookStatus,
      updateBookFormat,
      updateBookSynopsis,
      updateUserProfile,
      getAuthor,
      getBook,
      getReadingSession,
      getReviewForBook,
      addReview,
      updateReview,
      deleteReview,
      createUserList,
      renameUserList,
      deleteUserList,
      addBookToList,
      removeBookFromList,
      getBookStats,
      getSessionsForBook,
      getRecommendationsForBook,
      overallStats: buildOverallStats(books, readingSessions, authors),
      seriesJustCompleted,
      clearSeriesCompletion: () => setSeriesJustCompleted(null),
      readingIdentity
    };
  }, [authors, books, onboardingComplete, readingSessions, readingIdentity, repositoryStatus, resolvedProfile, reviews, seriesJustCompleted, userLists]);

  if (!hydrated) return null;

  return <BooklizContext.Provider value={value}>{children}</BooklizContext.Provider>;
}

export const useBookliz = () => {
  const context = useContext(BooklizContext);
  if (!context) {
    throw new Error("useBookliz must be used inside BooklizProvider");
  }
  return context;
};
