import AsyncStorage from "@react-native-async-storage/async-storage";
import { Author, Book, ReadingSession, UserProfile } from "../types/models";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export type PersistedBooklioState = {
  authors: Author[];
  books: Book[];
  readingSessions: ReadingSession[];
  userProfile: UserProfile;
};

export type BooklioSnapshot = PersistedBooklioState & {
  version: number;
  updatedAt: string;
};

export type RepositorySyncState = "idle" | "loading" | "saving" | "synced" | "error";

export type RepositoryStatus = {
  mode: "local-cache" | "remote-cache";
  syncState: RepositorySyncState;
  lastSavedAt?: string;
  lastLoadedAt?: string;
  lastError?: string;
  remoteEnabled: boolean;
  cloudSignedIn: boolean;
};

export interface BooklioRepository {
  load(): Promise<BooklioSnapshot | null>;
  save(snapshot: BooklioSnapshot): Promise<void>;
  getStatus(): RepositoryStatus;
}

const STORAGE_KEY = "booklio:v2";
const SNAPSHOT_VERSION = 2;

type RemotePayload = {
  snapshot?: BooklioSnapshot | null;
};

const createBaseStatus = (remoteEnabled: boolean): RepositoryStatus => ({
  mode: remoteEnabled ? "remote-cache" : "local-cache",
  syncState: "idle",
  remoteEnabled,
  cloudSignedIn: false
});

export class LocalFirstBooklioRepository implements BooklioRepository {
  private status: RepositoryStatus;

  constructor(
    private readonly storage = AsyncStorage,
    private readonly storageKey = STORAGE_KEY,
    private readonly remoteBaseUrl = process.env.EXPO_PUBLIC_BOOKLIO_API_BASE_URL?.trim()
  ) {
    this.status = createBaseStatus(Boolean(this.remoteBaseUrl || isSupabaseConfigured));
  }

  async load() {
    this.status = { ...this.status, syncState: "loading", lastError: undefined };

    try {
      if (supabase) {
        const userId = await this.getSupabaseUserId();
        this.status = { ...this.status, cloudSignedIn: Boolean(userId) };
        const supabaseSnapshot = await this.loadSupabase();
        if (supabaseSnapshot) {
          await this.storage.setItem(this.storageKey, JSON.stringify(supabaseSnapshot));
          this.status = {
            ...this.status,
            syncState: "synced",
            lastLoadedAt: new Date().toISOString(),
            lastSavedAt: supabaseSnapshot.updatedAt,
            lastError: undefined
          };
          return supabaseSnapshot;
        }
      }

      if (this.remoteBaseUrl) {
        const remoteSnapshot = await this.loadRemote();
        if (remoteSnapshot) {
          await this.storage.setItem(this.storageKey, JSON.stringify(remoteSnapshot));
          this.status = {
            ...this.status,
            syncState: "synced",
            lastLoadedAt: new Date().toISOString(),
            lastSavedAt: remoteSnapshot.updatedAt,
            lastError: undefined
          };
          return remoteSnapshot;
        }
      }

      const raw = await this.storage.getItem(this.storageKey);
      if (!raw) {
        this.status = {
          ...this.status,
          syncState: "synced",
          lastLoadedAt: new Date().toISOString(),
          lastError: undefined
        };
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<BooklioSnapshot> | PersistedBooklioState;
      const snapshot = normalizeSnapshot(parsed);
      if (!snapshot) {
        this.status = {
          ...this.status,
          syncState: "synced",
          lastLoadedAt: new Date().toISOString(),
          lastError: undefined
        };
        return null;
      }
      this.status = {
        ...this.status,
        syncState: "synced",
        lastLoadedAt: new Date().toISOString(),
        lastSavedAt: snapshot.updatedAt,
        lastError: undefined
      };
      return snapshot;
    } catch (error) {
      this.status = {
        ...this.status,
        syncState: "error",
        lastError: error instanceof Error ? error.message : "Failed to load Booklio data."
      };
      return null;
    }
  }

  async save(snapshot: BooklioSnapshot) {
    this.status = { ...this.status, syncState: "saving", lastError: undefined };

    try {
      const normalized = normalizeSnapshot(snapshot);
      if (!normalized) {
        throw new Error("Booklio snapshot is invalid and could not be saved.");
      }
      await this.storage.setItem(this.storageKey, JSON.stringify(normalized));

      if (supabase) {
        const userId = await this.getSupabaseUserId();
        this.status = { ...this.status, cloudSignedIn: Boolean(userId) };
        await this.saveSupabase(normalized);
      } else if (this.remoteBaseUrl) {
        await this.saveRemote(normalized);
      }

      this.status = {
        ...this.status,
        syncState: "synced",
        lastSavedAt: normalized.updatedAt,
        lastError: undefined
      };
    } catch (error) {
      this.status = {
        ...this.status,
        syncState: "error",
        lastError: error instanceof Error ? error.message : "Failed to save Booklio data."
      };
      throw error;
    }
  }

  getStatus() {
    return this.status;
  }

  private async loadRemote() {
    if (!this.remoteBaseUrl) return null;

    const response = await fetch(`${this.remoteBaseUrl.replace(/\/$/, "")}/booklio/snapshot`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`Remote load failed with ${response.status}`);
    }

      const payload = (await response.json()) as RemotePayload | BooklioSnapshot | null;
      const snapshot = isRemotePayload(payload) ? payload.snapshot ?? null : payload;
      return normalizeSnapshot(snapshot);
  }

  private async saveRemote(snapshot: BooklioSnapshot) {
    if (!this.remoteBaseUrl) return;

    const response = await fetch(`${this.remoteBaseUrl.replace(/\/$/, "")}/booklio/snapshot`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ snapshot })
    });

    if (!response.ok) {
      throw new Error(`Remote save failed with ${response.status}`);
    }
  }

  private async loadSupabase() {
    if (!supabase) return null;

    const userId = await this.getSupabaseUserId();
    if (!userId) {
      return null;
    }

    const [{ data: profileRow, error: profileError }, { data: authorRows, error: authorsError }, { data: bookRows, error: booksError }, { data: sessionRows, error: readingSessionsError }] = await Promise.all([
      supabase.from("booklio_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("booklio_authors").select("*").eq("user_id", userId),
      supabase.from("booklio_books").select("*").eq("user_id", userId),
      supabase.from("booklio_reading_sessions").select("*").eq("user_id", userId)
    ]);

    const firstError = profileError ?? authorsError ?? booksError ?? readingSessionsError;
    if (firstError) {
      throw new Error(`Supabase load failed: ${firstError.message}`);
    }

    if (!profileRow) {
      return null;
    }

    return normalizeSnapshot({
      version: SNAPSHOT_VERSION,
      updatedAt: profileRow.updated_at ?? new Date().toISOString(),
      userProfile: mapProfileRowToProfile(profileRow),
      authors: (authorRows ?? []).map(mapAuthorRowToAuthor),
      books: (bookRows ?? []).map(mapBookRowToBook),
      readingSessions: (sessionRows ?? []).map(mapSessionRowToReadingSession)
    });
  }

  private async saveSupabase(snapshot: BooklioSnapshot) {
    if (!supabase) return;

    const userId = await this.getSupabaseUserId();
    if (!userId) {
      return;
    }

    const profilePayload = mapProfileToRow(userId, snapshot.userProfile);
    const authorPayload = snapshot.authors.map((author) => mapAuthorToRow(userId, author));
    const bookPayload = snapshot.books.map((book) => mapBookToRow(userId, book));
    const sessionPayload = snapshot.readingSessions.map((readingSession) => mapReadingSessionToRow(userId, readingSession));

    const { error: profileError } = await supabase.from("booklio_profiles").upsert(profilePayload);
    if (profileError) {
      throw new Error(`Supabase profile sync failed: ${profileError.message}`);
    }

    const { error: deleteSessionsError } = await supabase.from("booklio_reading_sessions").delete().eq("user_id", userId);
    if (deleteSessionsError) {
      throw new Error(`Supabase session cleanup failed: ${deleteSessionsError.message}`);
    }

    const { error: deleteBooksError } = await supabase.from("booklio_books").delete().eq("user_id", userId);
    if (deleteBooksError) {
      throw new Error(`Supabase book cleanup failed: ${deleteBooksError.message}`);
    }

    const { error: deleteAuthorsError } = await supabase.from("booklio_authors").delete().eq("user_id", userId);
    if (deleteAuthorsError) {
      throw new Error(`Supabase author cleanup failed: ${deleteAuthorsError.message}`);
    }

    if (authorPayload.length) {
      const { error } = await supabase.from("booklio_authors").insert(authorPayload);
      if (error) {
        throw new Error(`Supabase author sync failed: ${error.message}`);
      }
    }

    if (bookPayload.length) {
      const { error } = await supabase.from("booklio_books").insert(bookPayload);
      if (error) {
        throw new Error(`Supabase book sync failed: ${error.message}`);
      }
    }

    if (sessionPayload.length) {
      const { error } = await supabase.from("booklio_reading_sessions").insert(sessionPayload);
      if (error) {
        throw new Error(`Supabase reading session sync failed: ${error.message}`);
      }
    }
  }

  private async getSupabaseUserId() {
    if (!supabase) return null;
    const {
      data: { session }
    } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  }
}

export const createBooklioSnapshot = (state: PersistedBooklioState): BooklioSnapshot => ({
  ...state,
  version: SNAPSHOT_VERSION,
  updatedAt: new Date().toISOString()
});

function normalizeSnapshot(snapshot?: Partial<BooklioSnapshot> | PersistedBooklioState | null): BooklioSnapshot | null {
  if (!snapshot) return null;
  if (!Array.isArray(snapshot.authors) || !Array.isArray(snapshot.books) || !Array.isArray(snapshot.readingSessions) || !snapshot.userProfile) {
    return null;
  }

  return {
    authors: snapshot.authors,
    books: snapshot.books,
    readingSessions: snapshot.readingSessions,
    userProfile: snapshot.userProfile,
    version: "version" in snapshot && typeof snapshot.version === "number" ? snapshot.version : SNAPSHOT_VERSION,
    updatedAt:
      "updatedAt" in snapshot && typeof snapshot.updatedAt === "string"
        ? snapshot.updatedAt
        : new Date().toISOString()
  };
}

function isRemotePayload(payload: RemotePayload | BooklioSnapshot | null): payload is RemotePayload {
  return Boolean(payload && typeof payload === "object" && "snapshot" in payload);
}

type ProfileRow = {
  user_id: string;
  name: string;
  avatar_initials: string;
  avatar_uri?: string | null;
  email?: string | null;
  auth_provider?: string | null;
  reading_level: string;
  yearly_goal: number;
  favorite_authors: string[] | null;
  favorite_genres: string[] | null;
  top_book_ids: string[] | null;
  achievements: UserProfile["achievements"] | null;
  updated_at?: string | null;
};

type AuthorRow = {
  id: string;
  name: string;
  bio: string;
  favorite_genres: string[] | null;
};

type BookRow = {
  id: string;
  title: string;
  author_id: string;
  series_id?: string | null;
  series_name?: string | null;
  series_number?: number | null;
  saga_order?: number | null;
  release_order?: number | null;
  synopsis: string;
  genre: string[] | null;
  pages: number;
  published_date: string;
  publisher: string;
  language: string;
  isbn: string;
  format: Book["format"];
  cover_gradient: string[] | null;
  cover_image_uri?: string | null;
  upcoming_release_date?: string | null;
  is_bestseller?: boolean | null;
  is_sequel?: boolean | null;
  tags: string[] | null;
  user_status: Book["userStatus"];
};

type ReadingSessionRow = {
  id: string;
  book_id: string;
  date: string;
  start_page: number;
  end_page: number;
  pages_read: number;
  minutes_read: number;
  location: string;
  mood: string;
  format: ReadingSession["format"];
  notes: string;
  favorite_quote?: string | null;
  difficulty: ReadingSession["difficulty"];
  enjoyment_rating: number;
  pages_per_hour: number;
};

function mapProfileToRow(userId: string, profile: UserProfile): ProfileRow {
  return {
    user_id: userId,
    name: profile.name,
    avatar_initials: profile.avatarInitials,
    avatar_uri: profile.avatarUri,
    email: profile.email,
    auth_provider: profile.authProvider,
    reading_level: profile.readingLevel,
    yearly_goal: profile.yearlyGoal,
    favorite_authors: profile.favoriteAuthors,
    favorite_genres: profile.favoriteGenres,
    top_book_ids: profile.topBookIds,
    achievements: profile.achievements
  };
}

function mapProfileRowToProfile(row: ProfileRow): UserProfile {
  return {
    id: row.user_id,
    name: row.name,
    avatarInitials: row.avatar_initials,
    avatarUri: row.avatar_uri ?? undefined,
    email: row.email ?? undefined,
    authProvider: row.auth_provider === "google" || row.auth_provider === "apple" ? row.auth_provider : undefined,
    readingLevel: row.reading_level,
    yearlyGoal: row.yearly_goal,
    favoriteAuthors: row.favorite_authors ?? [],
    favoriteGenres: row.favorite_genres ?? [],
    topBookIds: row.top_book_ids ?? [],
    achievements: row.achievements ?? []
  };
}

function mapAuthorToRow(userId: string, author: Author) {
  return {
    user_id: userId,
    id: author.id,
    name: author.name,
    bio: author.bio,
    favorite_genres: author.favoriteGenres
  };
}

function mapAuthorRowToAuthor(row: AuthorRow): Author {
  return {
    id: row.id,
    name: row.name,
    bio: row.bio,
    favoriteGenres: row.favorite_genres ?? []
  };
}

function mapBookToRow(userId: string, book: Book) {
  return {
    user_id: userId,
    id: book.id,
    title: book.title,
    author_id: book.authorId,
    series_id: book.seriesId,
    series_name: book.seriesName,
    series_number: book.seriesNumber,
    saga_order: book.sagaOrder,
    release_order: book.releaseOrder,
    synopsis: book.synopsis,
    genre: book.genre,
    pages: book.pages,
    published_date: book.publishedDate,
    publisher: book.publisher,
    language: book.language,
    isbn: book.isbn,
    format: book.format,
    cover_gradient: book.coverGradient,
    cover_image_uri: book.coverImageUri,
    upcoming_release_date: book.upcomingReleaseDate,
    is_bestseller: book.isBestseller,
    is_sequel: book.isSequel,
    tags: book.tags ?? [],
    user_status: book.userStatus
  };
}

function mapBookRowToBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    authorId: row.author_id,
    seriesId: row.series_id ?? undefined,
    seriesName: row.series_name ?? undefined,
    seriesNumber: row.series_number ?? undefined,
    sagaOrder: row.saga_order ?? undefined,
    releaseOrder: row.release_order ?? undefined,
    synopsis: row.synopsis,
    genre: row.genre ?? [],
    pages: row.pages,
    publishedDate: row.published_date,
    publisher: row.publisher,
    language: row.language,
    isbn: row.isbn,
    format: row.format,
    coverGradient: (row.cover_gradient as Book["coverGradient"]) ?? ["#0F172A", "#14B8A6"],
    coverImageUri: row.cover_image_uri ?? undefined,
    upcomingReleaseDate: row.upcoming_release_date ?? undefined,
    isBestseller: row.is_bestseller ?? undefined,
    isSequel: row.is_sequel ?? undefined,
    tags: row.tags ?? [],
    userStatus: row.user_status
  };
}

function mapReadingSessionToRow(userId: string, session: ReadingSession) {
  return {
    user_id: userId,
    id: session.id,
    book_id: session.bookId,
    date: session.date,
    start_page: session.startPage,
    end_page: session.endPage,
    pages_read: session.pagesRead,
    minutes_read: session.minutesRead,
    location: session.location,
    mood: session.mood,
    format: session.format,
    notes: session.notes,
    favorite_quote: session.favoriteQuote,
    difficulty: session.difficulty,
    enjoyment_rating: session.enjoymentRating,
    pages_per_hour: session.pagesPerHour
  };
}

function mapSessionRowToReadingSession(row: ReadingSessionRow): ReadingSession {
  return {
    id: row.id,
    bookId: row.book_id,
    date: row.date,
    startPage: row.start_page,
    endPage: row.end_page,
    pagesRead: row.pages_read,
    minutesRead: row.minutes_read,
    location: row.location,
    mood: row.mood,
    format: row.format,
    notes: row.notes,
    favoriteQuote: row.favorite_quote ?? undefined,
    difficulty: row.difficulty,
    enjoymentRating: row.enjoyment_rating,
    pagesPerHour: row.pages_per_hour
  };
}
