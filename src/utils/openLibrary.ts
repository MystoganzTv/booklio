import { Platform } from "react-native";

const WEB_PROXY_BASE = "http://127.0.0.1:8788";
const OPEN_LIBRARY_BASE = "https://openlibrary.org";

export const openLibraryBaseUrl = Platform.OS === "web" ? WEB_PROXY_BASE : OPEN_LIBRARY_BASE;

export const openLibraryUrl = (path: string) => `${openLibraryBaseUrl}${path}`;
