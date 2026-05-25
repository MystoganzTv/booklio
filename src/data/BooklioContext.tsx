import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { authors as authorSeed, books as bookSeed, readingSessions as sessionSeed, recommendations, series, userProfile } from "./mockData";
import { Author, Book, NewBookInput, NewReadingSessionInput, ReadingSession } from "../types/models";

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
  pagesRead: number;
  minutesRead: number;
  totalSessions: number;
  averagePagesPerSession: number;
  averageMinutesPerSession: number;
  averageRating: number;
  currentStreak: number;
  longestStreak: number;
  bestReadingDay: string;
  longestSession?: ReadingSession;
  monthly: MonthBucket[];
  genreCounts: { label: string; value: number }[];
  authorCounts: { label: string; value: number }[];
  statusCounts: { label: string; value: number }[];
  speedOverTime: { label: string; value: number }[];
  mostActiveDays: { label: string; value: number }[];
};

type BooklioContextValue = {
  authors: Author[];
  books: Book[];
  readingSessions: ReadingSession[];
  recommendations: typeof recommendations;
  series: typeof series;
  userProfile: typeof userProfile;
  addBook: (input: NewBookInput) => Book;
  addReadingSession: (input: NewReadingSessionInput) => ReadingSession;
  getAuthor: (authorId: string) => Author | undefined;
  getBook: (bookId: string) => Book | undefined;
  getBookStats: (bookId: string) => BookStats;
  getSessionsForBook: (bookId: string) => ReadingSession[];
  overallStats: OverallStats;
};

const BooklioContext = createContext<BooklioContextValue | null>(null);
const STORAGE_KEY = "booklio:v1";

type PersistedBooklioState = {
  authors: Author[];
  books: Book[];
  readingSessions: ReadingSession[];
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
  const today = new Date("2026-05-24T00:00:00");
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

const colorsFromSource = (source: NewBookInput["source"]) => {
  if (source === "isbn") return { start: "#0F172A", end: "#14B8A6" };
  if (source === "photo") return { start: "#14B8A6", end: "#FFC857" };
  if (source === "search") return { start: "#FFC857", end: "#FF7A59" };
  return { start: "#7FB069", end: "#F3E9D2" };
};

const buildOverallStats = (books: Book[], sessions: ReadingSession[], authors: Author[]): OverallStats => {
  const totalBooksRead = books.filter((book) => book.userStatus.status === "read").length;
  const booksReadThisYear = books.filter((book) => book.userStatus.finishDate && sameYear(book.userStatus.finishDate, 2026)).length;
  const pagesRead = sessions.reduce((sum, session) => sum + session.pagesRead, 0);
  const minutesRead = sessions.reduce((sum, session) => sum + session.minutesRead, 0);
  const totalSessions = sessions.length;
  const rated = books.filter((book) => typeof book.userStatus.rating === "number");
  const averageRating = rated.length
    ? Number((rated.reduce((sum, book) => sum + (book.userStatus.rating ?? 0), 0) / rated.length).toFixed(1))
    : 0;
  const { currentStreak, longestStreak } = calculateStreaks(sessions);

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
    { label: "Owned", value: books.filter((book) => book.userStatus.ownership === "owned").length },
    { label: "Wishlist", value: books.filter((book) => book.userStatus.wishlist).length },
    { label: "Want to Buy", value: books.filter((book) => book.userStatus.wantToBuy).length },
    { label: "DNF", value: books.filter((book) => book.userStatus.status === "dnf").length }
  ];

  const weekdayMap = sessions.reduce<Record<string, number>>((acc, session) => {
    const weekday = formatWeekday(session.date);
    acc[weekday] = (acc[weekday] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalBooksRead,
    booksReadThisYear,
    pagesRead,
    minutesRead,
    totalSessions,
    averagePagesPerSession: totalSessions ? Math.round(pagesRead / totalSessions) : 0,
    averageMinutesPerSession: totalSessions ? Math.round(minutesRead / totalSessions) : 0,
    averageRating,
    currentStreak,
    longestStreak,
    bestReadingDay,
    longestSession,
    monthly: Object.values(monthlyMap),
    genreCounts: Object.entries(genreMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    authorCounts: Object.entries(authorMap)
      .map(([authorId, value]) => ({ label: authors.find((author) => author.id === authorId)?.name ?? authorId, value }))
      .sort((a, b) => b.value - a.value),
    statusCounts,
    speedOverTime: [...sessions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((session) => ({ label: formatMonth(session.date), value: Math.round(session.pagesPerHour) })),
    mostActiveDays: Object.entries(weekdayMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  };
};

export function BooklioProvider({ children }: PropsWithChildren) {
  const [authors, setAuthors] = useState<Author[]>(authorSeed);
  const [books, setBooks] = useState<Book[]>(bookSeed);
  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>(sessionSeed);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!saved || !mounted) {
          return;
        }

        const parsed = JSON.parse(saved) as PersistedBooklioState;
        setAuthors(parsed.authors?.length ? parsed.authors : authorSeed);
        setBooks(parsed.books?.length ? parsed.books : bookSeed);
        setReadingSessions(parsed.readingSessions?.length ? parsed.readingSessions : sessionSeed);
      } catch (error) {
        console.warn("Booklio could not hydrate local library", error);
      } finally {
        if (mounted) {
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
      const state: PersistedBooklioState = { authors, books, readingSessions };
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.warn("Booklio could not persist local library", error);
      }
    };

    persist();
  }, [authors, books, hydrated, readingSessions]);

  const value = useMemo<BooklioContextValue>(() => {
    const getBook = (bookId: string) => books.find((book) => book.id === bookId);
    const getAuthor = (authorId: string) => authors.find((author) => author.id === authorId);
    const getSessionsForBook = (bookId: string) =>
      readingSessions.filter((session) => session.bookId === bookId).sort((a, b) => b.date.localeCompare(a.date));
    const getBookStats = (bookId: string) => getBookStatsFromSessions(getSessionsForBook(bookId));

    const addReadingSession = (input: NewReadingSessionInput) => {
      const pagesRead = Math.max(0, input.endPage - input.startPage + 1);
      const pagesPerHour = input.minutesRead > 0 ? Number(((pagesRead / input.minutesRead) * 60).toFixed(1)) : 0;
      const session: ReadingSession = {
        ...input,
        id: `rs-${Date.now()}`,
        pagesRead,
        pagesPerHour
      };

      setReadingSessions((current) => [session, ...current]);
      setBooks((current) =>
        current.map((book) => {
          if (book.id !== input.bookId) {
            return book;
          }
          const progressPercent = Math.min(100, Math.round((input.endPage / book.pages) * 100));
          return {
            ...book,
            userStatus: {
              ...book.userStatus,
              status: progressPercent >= 100 ? "read" : "reading",
              progressPercent,
              startDate: book.userStatus.startDate ?? input.date,
              finishDate: progressPercent >= 100 ? input.date : book.userStatus.finishDate
            }
          };
        })
      );

      return session;
    };

    const addBook = (input: NewBookInput) => {
      const authorName = input.authorName.trim() || "Autor por identificar";
      const existingAuthor = authors.find((author) => author.name.toLowerCase() === authorName.toLowerCase());
      const authorId = existingAuthor?.id ?? `a-${slugify(authorName)}-${Date.now()}`;

      if (!existingAuthor) {
        setAuthors((current) => [
          ...current,
          {
            id: authorId,
            name: authorName,
            bio: "Autor agregado desde Booklio. Listo para enriquecer metadata cuando conectemos una API de libros.",
            favoriteGenres: input.genre ?? ["Por clasificar"]
          }
        ]);
      }

      const book: Book = {
        id: `b-${slugify(input.title || "captured-book")}-${Date.now()}`,
        title: input.title.trim() || "Libro sin titulo",
        authorId,
        synopsis:
          input.synopsis ??
          `Libro agregado por ${input.source === "isbn" ? "escaneo ISBN" : input.source === "photo" ? "foto de portada" : "entrada manual"}. Metadata pendiente de confirmar.`,
        genre: input.genre?.length ? input.genre : ["Por clasificar"],
        pages: input.pages ?? 320,
        publishedDate: input.publishedDate ?? "2026-01-01",
        publisher: input.publisher ?? "Editorial por confirmar",
        language: input.language ?? "English",
        isbn: input.isbn ?? "ISBN pendiente",
        format: "physical",
        coverGradient: [colorsFromSource(input.source).start, colorsFromSource(input.source).end],
        coverImageUri: input.coverImageUri,
        userStatus: {
          status: "want-to-read",
          ownership: input.ownership ?? "owned",
          wishlist: input.wishlist ?? false,
          wantToBuy: input.wantToBuy ?? false,
          progressPercent: 0,
          notes: `Agregado desde flujo de ${input.source}.`,
          favoriteQuotes: []
        }
      };

      setBooks((current) => [book, ...current]);
      return book;
    };

    return {
      authors,
      books,
      readingSessions: [...readingSessions].sort((a, b) => b.date.localeCompare(a.date)),
      recommendations,
      series,
      userProfile,
      addBook,
      addReadingSession,
      getAuthor,
      getBook,
      getBookStats,
      getSessionsForBook,
      overallStats: buildOverallStats(books, readingSessions, authors)
    };
  }, [authors, books, readingSessions]);

  return <BooklioContext.Provider value={value}>{children}</BooklioContext.Provider>;
}

export const useBooklio = () => {
  const context = useContext(BooklioContext);
  if (!context) {
    throw new Error("useBooklio must be used inside BooklioProvider");
  }
  return context;
};
