import AsyncStorage from "@react-native-async-storage/async-storage";
import { Author, Book, ReadingSession, Review, UserList, UserProfile } from "../types/models";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export type PersistedBooklizState = {
  authors: Author[];
  books: Book[];
  readingSessions: ReadingSession[];
  reviews: Review[];
  userLists: UserList[];
  userProfile: UserProfile;
};

export type BooklizSnapshot = PersistedBooklizState & {
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

export interface BooklizRepository {
  load(): Promise<BooklizSnapshot | null>;
  save(snapshot: BooklizSnapshot): Promise<void>;
  getStatus(): RepositoryStatus;
}

const STORAGE_KEY = "booklio:v2";
const SNAPSHOT_VERSION = 2;

type RemotePayload = {
  snapshot?: BooklizSnapshot | null;
};

const createBaseStatus = (remoteEnabled: boolean): RepositoryStatus => ({
  mode: remoteEnabled ? "remote-cache" : "local-cache",
  syncState: "idle",
  remoteEnabled,
  cloudSignedIn: false
});

export class LocalFirstBooklizRepository implements BooklizRepository {
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

      const parsed = JSON.parse(raw) as Partial<BooklizSnapshot> | PersistedBooklizState;
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

  async save(snapshot: BooklizSnapshot) {
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

      const payload = (await response.json()) as RemotePayload | BooklizSnapshot | null;
      const snapshot = isRemotePayload(payload) ? payload.snapshot ?? null : payload;
      return normalizeSnapshot(snapshot);
  }

  private async saveRemote(snapshot: BooklizSnapshot) {
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

    const [{ data: profileRow, error: profileError }, { data: authorRows, error: authorsError }, { data: bookRows, error: booksError }, { data: sessionRows, error: readingSessionsError }, { data: reviewRows, error: reviewsError }, { data: listRows, error: listsError }] = await Promise.all([
      supabase.from("booklio_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("booklio_authors").select("*").eq("user_id", userId),
      supabase.from("booklio_books").select("*").eq("user_id", userId),
      supabase.from("booklio_reading_sessions").select("*").eq("user_id", userId),
      supabase.from("booklio_reviews").select("*").eq("user_id", userId),
      supabase.from("booklio_user_lists").select("*").eq("user_id", userId)
    ]);

    const firstError = profileError ?? authorsError ?? booksError ?? readingSessionsError ?? reviewsError ?? listsError;
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
      readingSessions: (sessionRows ?? []).map(mapSessionRowToReadingSession),
      reviews: (reviewRows ?? []).map(mapReviewRowToReview),
      userLists: (listRows ?? []).map(mapListRowToUserList)
    });
  }

  private async saveSupabase(snapshot: BooklizSnapshot) {
    if (!supabase) return;

    const userId = await this.getSupabaseUserId();
    if (!userId) return;

    // ─── Strategy: upsert-first, then prune orphans ───────────────────────────
    //
    // Old approach (delete → insert) had a data-loss window: if the network
    // dropped after the DELETE but before INSERTs completed, Supabase rows
    // were gone (local AsyncStorage was safe, but cloud was empty until next sync).
    //
    // New approach:
    //   1. Upsert all current rows  → adds new rows, updates changed rows, never deletes
    //   2. Delete orphans           → removes rows whose IDs are no longer in the snapshot
    //
    // If step 2 fails, we have stale rows in Supabase but zero missing data.
    // The next successful save will clean them up.

    // Profile — one row per user, upsert on user_id
    const { error: profileError } = await supabase
      .from("booklio_profiles")
      .upsert(mapProfileToRow(userId, snapshot.userProfile), { onConflict: "user_id" });
    if (profileError) throw new Error(`Supabase profile sync failed: ${profileError.message}`);

    // Authors
    const authorPayload = snapshot.authors.map((a) => mapAuthorToRow(userId, a));
    if (authorPayload.length) {
      const { error } = await supabase.from("booklio_authors").upsert(authorPayload, { onConflict: "id" });
      if (error) throw new Error(`Supabase author sync failed: ${error.message}`);
    }
    await pruneOrphans("booklio_authors", userId, snapshot.authors.map((a) => a.id));

    // Books
    const bookPayload = snapshot.books.map((b) => mapBookToRow(userId, b));
    if (bookPayload.length) {
      const { error } = await supabase.from("booklio_books").upsert(bookPayload, { onConflict: "id" });
      if (error) throw new Error(`Supabase book sync failed: ${error.message}`);
    }
    await pruneOrphans("booklio_books", userId, snapshot.books.map((b) => b.id));

    // Reading sessions
    const sessionPayload = snapshot.readingSessions.map((s) => mapReadingSessionToRow(userId, s));
    if (sessionPayload.length) {
      const { error } = await supabase.from("booklio_reading_sessions").upsert(sessionPayload, { onConflict: "id" });
      if (error) throw new Error(`Supabase reading session sync failed: ${error.message}`);
    }
    await pruneOrphans("booklio_reading_sessions", userId, snapshot.readingSessions.map((s) => s.id));

    // Reviews
    const reviewPayload = (snapshot.reviews ?? []).map((r) => mapReviewToRow(userId, r));
    if (reviewPayload.length) {
      const { error } = await supabase.from("booklio_reviews").upsert(reviewPayload, { onConflict: "id" });
      if (error) throw new Error(`Supabase review sync failed: ${error.message}`);
    }
    await pruneOrphans("booklio_reviews", userId, (snapshot.reviews ?? []).map((r) => r.id));

    // User lists
    const listPayload = (snapshot.userLists ?? []).map((l) => mapUserListToRow(userId, l));
    if (listPayload.length) {
      const { error } = await supabase.from("booklio_user_lists").upsert(listPayload, { onConflict: "id" });
      if (error) throw new Error(`Supabase user list sync failed: ${error.message}`);
    }
    await pruneOrphans("booklio_user_lists", userId, (snapshot.userLists ?? []).map((l) => l.id));
  }

  private async getSupabaseUserId() {
    if (!supabase) return null;
    const {
      data: { session }
    } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  }
}

export const createBooklizSnapshot = (state: PersistedBooklizState): BooklizSnapshot => ({
  ...state,
  version: SNAPSHOT_VERSION,
  updatedAt: new Date().toISOString()
});

function normalizeSnapshot(snapshot?: Partial<BooklizSnapshot> | PersistedBooklizState | null): BooklizSnapshot | null {
  if (!snapshot) return null;
  if (!Array.isArray(snapshot.authors) || !Array.isArray(snapshot.books) || !Array.isArray(snapshot.readingSessions) || !snapshot.userProfile) {
    return null;
  }

  return {
    authors: snapshot.authors,
    books: snapshot.books,
    readingSessions: snapshot.readingSessions,
    reviews: Array.isArray((snapshot as any).reviews) ? (snapshot as any).reviews : [],
    userLists: Array.isArray((snapshot as any).userLists) ? (snapshot as any).userLists : [],
    userProfile: snapshot.userProfile,
    version: "version" in snapshot && typeof snapshot.version === "number" ? snapshot.version : SNAPSHOT_VERSION,
    updatedAt:
      "updatedAt" in snapshot && typeof snapshot.updatedAt === "string"
        ? snapshot.updatedAt
        : new Date().toISOString()
  };
}

/**
 * Delete rows in `table` for `userId` whose `id` is NOT in `keepIds`.
 * If `keepIds` is empty, deletes all rows for the user (entity was fully cleared).
 * Errors here are non-fatal — stale rows are harmless and will be pruned next sync.
 */
async function pruneOrphans(table: string, userId: string, keepIds: string[]): Promise<void> {
  if (!supabase) return;
  try {
    if (keepIds.length === 0) {
      await supabase.from(table).delete().eq("user_id", userId);
    } else {
      await supabase.from(table).delete().eq("user_id", userId).not("id", "in", `(${keepIds.join(",")})`);
    }
  } catch {
    // Non-fatal: stale orphan rows will be pruned on the next successful save.
  }
}

function isRemotePayload(payload: RemotePayload | BooklizSnapshot | null): payload is RemotePayload {
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
  work_key?: string | null;
  edition_key?: string | null;
  language_code?: string | null;
  co_author_names?: string[] | null;
  co_author_ids?: string[] | null;
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
    work_key: book.workKey,
    edition_key: book.editionKey,
    language_code: book.languageCode,
    co_author_names: book.coAuthorNames ?? null,
    co_author_ids: book.coAuthorIds ?? null,
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
    workKey: row.work_key ?? undefined,
    editionKey: row.edition_key ?? undefined,
    languageCode: row.language_code ?? undefined,
    coAuthorNames: row.co_author_names ?? undefined,
    coAuthorIds: row.co_author_ids ?? undefined,
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

type ReviewRow = {
  user_id: string;
  id: string;
  book_id: string;
  rating: number;
  title: string;
  body: string;
  created_at: string;
};

function mapReviewToRow(userId: string, review: Review): ReviewRow {
  return {
    user_id: userId,
    id: review.id,
    book_id: review.bookId,
    rating: review.rating,
    title: review.title,
    body: review.body,
    created_at: review.createdAt
  };
}

function mapReviewRowToReview(row: ReviewRow): Review {
  return {
    id: row.id,
    bookId: row.book_id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    createdAt: row.created_at
  };
}

type UserListRow = {
  user_id: string;
  id: string;
  name: string;
  emoji?: string | null;
  book_ids: string[];
  created_at: string;
  updated_at: string;
};

function mapUserListToRow(userId: string, list: UserList): UserListRow {
  return {
    user_id: userId,
    id: list.id,
    name: list.name,
    emoji: list.emoji,
    book_ids: list.bookIds,
    created_at: list.createdAt,
    updated_at: list.updatedAt
  };
}

function mapListRowToUserList(row: UserListRow): UserList {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji ?? undefined,
    bookIds: row.book_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
