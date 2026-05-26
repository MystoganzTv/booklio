import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const STORAGE_KEY = "booklio_connected_account";
const LEGACY_STORAGE_KEY = "booklio_google_account";

export type ConnectedAccountProvider = "google" | "apple";

export type ConnectedAccount = {
  id: string;
  provider: ConnectedAccountProvider;
  email?: string;
  name: string;
  picture?: string;
  givenName?: string;
  familyName?: string;
};

type GoogleAuthExtra = {
  webClientId?: string;
  iosClientId?: string;
  androidClientId?: string;
};

export function getGoogleAuthConfig() {
  const config = (Constants.expoConfig?.extra?.googleAuth ?? {}) as GoogleAuthExtra;
  return {
    webClientId: config.webClientId,
    iosClientId: config.iosClientId ?? config.webClientId,
    androidClientId: config.androidClientId ?? config.webClientId
  };
}

export function buildInitials(name: string, email?: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  if (words[0]?.length) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (email?.slice(0, 2) ?? "BK").toUpperCase();
}

export function buildAppleDisplayName({
  fullName,
  fallbackName,
  fallbackEmail
}: {
  fullName?: { givenName?: string | null; familyName?: string | null } | null;
  fallbackName?: string;
  fallbackEmail?: string;
}) {
  const parts = [fullName?.givenName, fullName?.familyName].filter(Boolean);
  if (parts.length) {
    return parts.join(" ");
  }

  if (fallbackName?.trim()) {
    return fallbackName.trim();
  }

  if (fallbackEmail?.trim()) {
    return fallbackEmail.trim();
  }

  return "Booklio Reader";
}

export async function persistConnectedAccount(account: ConnectedAccount) {
  const value = JSON.stringify(account);
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(STORAGE_KEY, value);
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, value);
}

export async function readPersistedConnectedAccount() {
  try {
    if (Platform.OS === "web") {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as ConnectedAccount;
      }

      const legacyRaw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacyRaw) return null;

      const parsed = JSON.parse(legacyRaw) as ConnectedAccount | Omit<ConnectedAccount, "provider">;
      const normalized = "provider" in parsed ? parsed : { ...parsed, provider: "google" as const };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
      return normalized;
    }

    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConnectedAccount | Omit<ConnectedAccount, "provider">;
    return "provider" in parsed ? parsed : { ...parsed, provider: "google" as const };
  } catch {
    return null;
  }
}

export async function clearPersistedConnectedAccount() {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
