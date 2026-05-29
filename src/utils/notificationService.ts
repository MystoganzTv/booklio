/**
 * Booklio notification service — local daily reading reminders.
 *
 * Uses expo-notifications for scheduling. Push tokens are NOT needed;
 * these are all local (device-only) notifications.
 *
 * Storage key: @booklio/notificationPrefs
 * Schema: { enabled: boolean; hour: number; minute: number }
 */
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFS_KEY = "@booklio/notificationPrefs";
const CHANNEL_ID = "booklio-reading-reminder";
const NOTIFICATION_ID = "daily-reading-reminder";

export type NotificationPrefs = {
  enabled: boolean;
  hour: number;   // 0–23
  minute: number; // 0–59
};

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  hour: 20,
  minute: 0,
};

// ─── Prefs persistence ────────────────────────────────────────────────────────

export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotificationPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// ─── Permission ───────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function getNotificationPermissionStatus(): Promise<"granted" | "denied" | "undetermined"> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

// ─── Android channel setup ────────────────────────────────────────────────────

export async function ensureNotificationChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Daily Reading Reminder",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#14B8A6",
    sound: "default",
  });
}

// ─── Schedule / cancel ────────────────────────────────────────────────────────

/** Schedule (or re-schedule) the daily reading reminder for the given time. */
export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  // Cancel any existing instance first
  await cancelDailyReminder();

  // Pick a random message each scheduling cycle
  const messages = [
    { title: "📚 Time to read!", body: "Your reading streak is waiting. Open a book." },
    { title: "📖 Reading time", body: "A few pages a day builds a library of a lifetime." },
    { title: "📚 Don't break the streak!", body: "Log a session and keep your momentum going." },
    { title: "📖 Booklio reminder", body: "Your current book is waiting for you." },
  ];
  const msg = messages[Math.floor(Math.random() * messages.length)];

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: msg.title,
      body: msg.body,
      sound: "default",
      data: { type: "daily-reading-reminder" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

/** Cancel the standing daily reminder. */
export async function cancelDailyReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {
    // May throw if notification doesn't exist — safe to ignore
  }
}

// ─── Toggle helper (used by Settings) ────────────────────────────────────────

/**
 * Enable or disable the daily reminder.
 * Returns the resulting prefs (useful if permission was denied).
 */
export async function setReminderEnabled(
  enabled: boolean,
  hour = DEFAULT_PREFS.hour,
  minute = DEFAULT_PREFS.minute
): Promise<{ prefs: NotificationPrefs; permissionGranted: boolean }> {
  if (enabled) {
    const granted = await requestNotificationPermission();
    if (!granted) {
      return { prefs: { enabled: false, hour, minute }, permissionGranted: false };
    }
    await ensureNotificationChannel();
    await scheduleDailyReminder(hour, minute);
    const prefs: NotificationPrefs = { enabled: true, hour, minute };
    await saveNotificationPrefs(prefs);
    return { prefs, permissionGranted: true };
  } else {
    await cancelDailyReminder();
    const prefs: NotificationPrefs = { enabled: false, hour, minute };
    await saveNotificationPrefs(prefs);
    return { prefs, permissionGranted: true };
  }
}

// ─── Format helper ────────────────────────────────────────────────────────────

/** Format hour+minute as "8:00 PM" / "20:00" depending on locale preference. */
export function formatReminderTime(hour: number, minute: number): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
