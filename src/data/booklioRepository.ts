import AsyncStorage from "@react-native-async-storage/async-storage";
import { Author, Book, ReadingSession, UserProfile } from "../types/models";

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
  remoteEnabled
});

export class LocalFirstBooklioRepository implements BooklioRepository {
  private status: RepositoryStatus;

  constructor(
    private readonly storage = AsyncStorage,
    private readonly storageKey = STORAGE_KEY,
    private readonly remoteBaseUrl = process.env.EXPO_PUBLIC_BOOKLIO_API_BASE_URL?.trim()
  ) {
    this.status = createBaseStatus(Boolean(this.remoteBaseUrl));
  }

  async load() {
    this.status = { ...this.status, syncState: "loading", lastError: undefined };

    try {
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

      if (this.remoteBaseUrl) {
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
