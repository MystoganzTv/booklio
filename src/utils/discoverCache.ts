/**
 * discoverCache — tiny AsyncStorage cache for Discover's network sections.
 *
 * Cold-opening Discover used to refetch everything (6+ requests before pixels).
 * Now cached results render instantly and refresh only after their TTL expires.
 * Cache keys include a version so shape changes never break old payloads.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

// v2: invalidates entries cached before the strict language policy existed —
// those could carry mixed-language fields (the ES/EN inconsistency bug).
const VERSION = "v2";

type CacheEnvelope<T> = {
  savedAt: number;
  data: T;
};

export async function readCache<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`@bookliz/cache/${VERSION}/${key}`);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (!envelope?.savedAt || Date.now() - envelope.savedAt > ttlMs) return null;
    return envelope.data;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = { savedAt: Date.now(), data };
    await AsyncStorage.setItem(`@bookliz/cache/${VERSION}/${key}`, JSON.stringify(envelope));
  } catch {
    // cache writes are best-effort
  }
}

/**
 * Drop every cached Discover payload. Called on account reset — cached
 * recommendation sections are derived from the previous reader's taste and must
 * not survive into a fresh account.
 */
export async function clearDiscoverCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith("@bookliz/cache/"));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    // best-effort
  }
}

export const HOURS = 60 * 60 * 1000;
