import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authors as authorSeed, books as bookSeed, readingSessions as sessionSeed, series, userProfile } from "./mockData";
import {
  BooklioRepository,
  createBooklioSnapshot,
  LocalFirstBooklioRepository,
  PersistedBooklioState,
  RepositoryStatus
} from "./booklioRepository";
import {
  Achievement,
  Author,
  Book,
  CoreTrackingStatus,
  NewBookInput,
  NewReadingSessionInput,
  Recommendation,
  ReadingSession,
  UpdateBookInput,
  UpdateUserProfileInput,
  UserProfile
} from "../types/models";
import { buildInitials, clearPersistedGoogleAccount, GoogleAccount, persistGoogleAccount, readPersistedGoogleAccount } from "../utils/googleAuth";
import { buildBookSpecificRecommendations, buildGlobalRecommendations } from "../utils/recommendationEngine";

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

type BooklioContextValue = {
  authors: Author[];
  books: Book[];
  readingSessions: ReadingSession[];
  recommendations: Recommendation[];
  series: typeof series;
  userProfile: UserProfile;
  repositoryStatus: RepositoryStatus;
  connectGoogleAccount: (account: GoogleAccount) => Promise<void>;
  disconnectGoogleAccount: () => Promise<void>;
  addBook: (input: NewBookInput) => Book;
  addReadingSession: (input: NewReadingSessionInput) => ReadingSession;
  updateReadingSession: (sessionId: string, input: NewReadingSessionInput) => ReadingSession | undefined;
  deleteReadingSession: (sessionId: string) => void;
  updateBook: (bookId: string, input: UpdateBookInput) => void;
  updateBookStatus: (bookId: string, status: CoreTrackingStatus, rating?: number) => void;
  updateUserProfile: (input: UpdateUserProfileInput) => void;
  getAuthor: (authorId: string) => Author | undefined;
  getBook: (bookId: string) => Book | undefined;
  getReadingSession: (sessionId: string) => ReadingSession | undefined;
  getBookStats: (bookId: string) => BookStats;
  getSessionsForBook: (bookId: string) => ReadingSession[];
  getRecommendationsForBook: (bookId: string, limit?: number) => Recommendation[];
  overallStats: OverallStats;
};

const BooklioContext = createContext<BooklioContextValue | null>(null);

const rereadAchievement = {
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

const normalizeReadState = (book: Book): Book => {
  const readCount = book.userStatus.readCount ?? (book.userStatus.status === "read" ? 1 : 0);
  const isRereading = book.userStatus.isRereading ?? (book.userStatus.status === "reading" && readCount > 0);
  const currentReadNumber =
    book.userStatus.currentReadNumber ??
    (book.userStatus.status === "reading" ? Math.max(1, readCount + 1) : readCount > 0 ? readCount : undefined);

  return {
    ...book,
    userStatus: {
      ...book.userStatus,
      readCount,
      currentReadNumber,
      isRereading
    }
  };
};

const enrichProfileAchievements = (profile: UserProfile, books: Book[], sessions: ReadingSession[]): UserProfile => {
  const rereadProgress = books.filter((book) => (book.userStatus.readCount ?? 0) > 1 || book.userStatus.isRereading).length;
  const achievementMap = new Map(
    [...profile.achievements, rereadAchievement].map((achievement) => [achievement.id, achievement])
  );

  achievementMap.set("ach-rereader", {
    ...(achievementMap.get("ach-rereader") ?? rereadAchievement),
    progress: rereadProgress,
    unlocked: rereadProgress >= 1
  });
  achievementMap.set("ach-sessions-50", {
    ...(achievementMap.get("ach-sessions-50") ?? {
      id: "ach-sessions-50",
      title: "Fifty Sessions",
      description: "Log 50 reading sessions.",
      flavour: "Consistency is a superpower. You have it.",
      unlocked: false,
      progress: 0,
      goal: 50,
      category: "habit" as const,
      tier: "silver" as const,
      icon: "📅"
    }),
    progress: sessions.length,
    unlocked: sessions.length >= 50
  });

  return {
    ...profile,
    achievements: Array.from(achievementMap.values())
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
  const latestProgress = Math.min(100, Math.round((latestSession.endPage / book.pages) * 100));
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
    .flatMap((book) => book.genre)
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

export function BooklioProvider({ children }: PropsWithChildren) {
  const repositoryRef = useRef<BooklioRepository>(new LocalFirstBooklioRepository());
  const [authors, setAuthors] = useState<Author[]>(authorSeed);
  const [books, setBooks] = useState<Book[]>(() => bookSeed.map(normalizeReadState));
  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>(sessionSeed);
  const [profile, setProfile] = useState<UserProfile>(userProfile);
  const [hydrated, setHydrated] = useState(false);
  const [repositoryStatus, setRepositoryStatus] = useState<RepositoryStatus>(repositoryRef.current.getStatus());
  const resolvedProfile = useMemo(
    () => enrichProfileAchievements(profile, books, readingSessions),
    [books, profile, readingSessions]
  );

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

        const parsed = snapshot as PersistedBooklioState;
        setAuthors(parsed.authors?.length ? parsed.authors : authorSeed);
        setBooks(parsed.books?.length ? mergeSeedBookMetadata(parsed.books) : bookSeed.map(normalizeReadState));
        setReadingSessions(parsed.readingSessions?.length ? parsed.readingSessions : sessionSeed);
        if (parsed.userProfile?.id) {
          const persistedGoogle = await readPersistedGoogleAccount();
          const migratedAchievements = migrateAchievements(
            (parsed.userProfile.achievements as unknown as Record<string, unknown>[]) ?? [],
            userProfile.achievements
          );
          setProfile({
            ...userProfile,
            ...parsed.userProfile,
            ...(persistedGoogle
              ? {
                  name: persistedGoogle.name,
                  avatarInitials: buildInitials(persistedGoogle.name, persistedGoogle.email),
                  avatarUri: persistedGoogle.picture,
                  email: persistedGoogle.email,
                  authProvider: "google" as const
                }
              : {}),
            achievements: migratedAchievements
          });
        } else {
          setProfile(userProfile);
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

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const persist = async () => {
      const state: PersistedBooklioState = { authors, books, readingSessions, userProfile: resolvedProfile };
      try {
        await repositoryRef.current.save(createBooklioSnapshot(state));
        setRepositoryStatus(repositoryRef.current.getStatus());
      } catch (error) {
        console.warn("Booklio could not persist local library", error);
        setRepositoryStatus(repositoryRef.current.getStatus());
      }
    };

    persist();
  }, [authors, books, hydrated, readingSessions, resolvedProfile]);

  const value = useMemo<BooklioContextValue>(() => {
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

    const addBook = (input: NewBookInput) => {
      const authorName = input.authorName.trim() || "Author to identify";
      const existingAuthor = authors.find((author) => author.name.toLowerCase() === authorName.toLowerCase());
      const authorId = existingAuthor?.id ?? buildAuthorId(authorName);

      if (!existingAuthor) {
        setAuthors((current) => [
          ...current,
          {
            id: authorId,
            name: authorName,
            bio: "Author added from Booklio. Ready to be enriched when we connect a live books API.",
            favoriteGenres: input.genre ?? ["Uncategorized"]
          }
        ]);
      }

      const book: Book = {
        id: `b-${slugify(input.title || "captured-book")}-${Date.now()}`,
        title: input.title.trim() || "Untitled Book",
        authorId,
        synopsis:
          input.synopsis ??
          `Book added from ${input.source === "isbn" ? "ISBN scan" : input.source === "photo" ? "cover photo" : input.source === "search" ? "book search" : "manual entry"}. Metadata is ready for review.`,
        genre: input.genre?.length ? input.genre : ["Uncategorized"],
        pages: input.pages ?? 320,
        publishedDate: input.publishedDate ?? "2026-01-01",
        publisher: input.publisher ?? "Publisher pending confirmation",
        language: input.language ?? "English",
        isbn: input.isbn ?? "ISBN pending",
        format: input.format ?? "physical",
        coverGradient: [colorsFromSource(input.source).start, colorsFromSource(input.source).end],
        coverImageUri: input.coverImageUri,
          userStatus: {
            status: "want-to-read",
            ownership: input.ownership ?? "owned",
            wishlist: input.wishlist ?? false,
            wantToBuy: input.wantToBuy ?? false,
            readCount: 0,
            progressPercent: 0,
            notes: `Added through the ${input.source} flow.`,
            favoriteQuotes: []
        }
      };

      setBooks((current) => [book, ...current]);
      return book;
    };

    const updateBookStatus = (bookId: string, newStatus: CoreTrackingStatus, rating?: number) => {
      const today = new Date().toISOString().slice(0, 10);
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
            favoriteGenres: input.genre.length ? input.genre : ["Uncategorized"]
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
            genre: input.genre.length ? input.genre : ["Uncategorized"],
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
        readingLevel: input.readingLevel.trim() || current.readingLevel,
        yearlyGoal: input.yearlyGoal > 0 ? input.yearlyGoal : current.yearlyGoal,
        favoriteAuthors: input.favoriteAuthors.length ? input.favoriteAuthors : current.favoriteAuthors,
        favoriteGenres: input.favoriteGenres.length ? input.favoriteGenres : current.favoriteGenres
      }));
    };

    const connectGoogleAccount = async (account: GoogleAccount) => {
      await persistGoogleAccount(account);
      setProfile((current) => ({
        ...current,
        name: account.name || current.name,
        avatarInitials: buildInitials(account.name, account.email),
        avatarUri: account.picture,
        email: account.email,
        authProvider: "google"
      }));
    };

    const disconnectGoogleAccount = async () => {
      await clearPersistedGoogleAccount();
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
      recommendations: recommendationList,
      series,
      userProfile: resolvedProfile,
      repositoryStatus,
      connectGoogleAccount,
      disconnectGoogleAccount,
      addBook,
      addReadingSession,
      updateReadingSession,
      deleteReadingSession,
      updateBook,
      updateBookStatus,
      updateUserProfile,
      getAuthor,
      getBook,
      getReadingSession,
      getBookStats,
      getSessionsForBook,
      getRecommendationsForBook,
      overallStats: buildOverallStats(books, readingSessions, authors)
    };
  }, [authors, books, readingSessions, repositoryStatus, resolvedProfile]);

  if (!hydrated) return null;

  return <BooklioContext.Provider value={value}>{children}</BooklioContext.Provider>;
}

export const useBooklio = () => {
  const context = useContext(BooklioContext);
  if (!context) {
    throw new Error("useBooklio must be used inside BooklioProvider");
  }
  return context;
};
