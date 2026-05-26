import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const STORAGE_KEY = "booklio:google-account";

export type GoogleAccount = {
  id: string;
  email: string;
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

export async function persistGoogleAccount(account: GoogleAccount) {
  const value = JSON.stringify(account);
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(STORAGE_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, value);
}

export async function readPersistedGoogleAccount() {
  const raw = Platform.OS === "web"
    ? await AsyncStorage.getItem(STORAGE_KEY)
    : await SecureStore.getItemAsync(STORAGE_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as GoogleAccount;
  } catch {
    return null;
  }
}

export async function clearPersistedGoogleAccount() {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
