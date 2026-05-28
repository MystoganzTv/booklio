/**
 * Deep link utilities for Booklio.
 *
 * iOS Camera app does NOT open custom URL schemes (booklio://) directly —
 * it only handles http:// and https://.  Universal Links (https://) need an
 * apple-app-site-association file on a server you control, which is the
 * production solution.
 *
 * For DEVELOPMENT / TESTFLIGHT you can share the Expo development client link
 * which uses the exp+booklio:// scheme recognized by the Expo Go / dev-client:
 *
 *   exp+booklio://expo-development-client/?url=...
 *
 * For an App Store build, replace with the App Store URL:
 *   https://apps.apple.com/app/booklio/idXXXXXXXXXX
 *
 * The QR code in the second screenshot shows "No usable data found" because
 * the QR content was a bare booklio:// URL.  Use one of the links below.
 */

/** EAS project ID from app.json */
const EAS_PROJECT_ID = "280cde91-ff6e-4e44-8ceb-53eed6ce39b0";

/**
 * Deep link to open Booklio in the installed app.
 * Works when the app is already installed via TestFlight or App Store.
 */
export const BOOKLIO_SCHEME_URL = "booklio://";

/**
 * Expo development client link — use this for QR codes during development.
 * Requires the Expo Go or a custom dev-client to be installed.
 */
export const BOOKLIO_EXPO_QR_URL = `exp+booklio://expo-development-client/?appId=com.mystodev.booklio`;

/**
 * App Store link — replace id placeholder once the app is published.
 * This is the URL to use in QR codes for production.
 */
export const BOOKLIO_APP_STORE_URL = "https://apps.apple.com/app/booklio/idPENDING";

/**
 * Returns the correct share URL based on build environment.
 *
 * - Development / Expo Go  →  exp+booklio:// link
 * - Production             →  App Store URL (or Universal Link once configured)
 */
export function getShareUrl(): string {
  // In Expo SDK, __DEV__ is true for Metro/Expo Go builds
  if (__DEV__) {
    return BOOKLIO_EXPO_QR_URL;
  }
  return BOOKLIO_APP_STORE_URL;
}
