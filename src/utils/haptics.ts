/**
 * Haptic feedback helpers — safe wrappers around expo-haptics.
 *
 * Loaded lazily inside try/catch so the app never crashes if the native
 * module isn't linked yet (e.g. before running `npx pod-install` on iOS).
 * Every helper silently no-ops in that case.
 */
import { Platform } from "react-native";

type HapticsModule = typeof import("expo-haptics");

let haptics: HapticsModule | null | undefined;

function getHaptics(): HapticsModule | null {
  if (haptics !== undefined) return haptics;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    haptics = require("expo-haptics") as HapticsModule;
  } catch {
    haptics = null;
  }
  return haptics;
}

function safe(fn: (h: HapticsModule) => Promise<void>) {
  if (Platform.OS === "web") return;
  const h = getHaptics();
  if (!h) return;
  try {
    void fn(h).catch(() => {});
  } catch {
    // native module not linked — ignore
  }
}

/** Light tap — selections, toggles, chips. */
export const hapticLight = () => safe((h) => h.impactAsync(h.ImpactFeedbackStyle.Light));

/** Medium tap — primary buttons, sheet confirms. */
export const hapticMedium = () => safe((h) => h.impactAsync(h.ImpactFeedbackStyle.Medium));

/** Success notification — book added, session saved, achievement. */
export const hapticSuccess = () => safe((h) => h.notificationAsync(h.NotificationFeedbackType.Success));

/** Warning notification — destructive confirms, errors. */
export const hapticWarning = () => safe((h) => h.notificationAsync(h.NotificationFeedbackType.Warning));
