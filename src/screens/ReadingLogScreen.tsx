import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SessionRow } from "../components/SessionRow";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

export function ReadingLogScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "ReadingLog">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getBook, getBookStats, overallStats, readingSessions } = useBooklio();

  const bookId = route.params?.bookId;
  const book = bookId ? getBook(bookId) : undefined;
  const sessions = bookId
    ? readingSessions.filter((s) => s.bookId === bookId)
    : readingSessions;

  const stats = bookId ? getBookStats(bookId) : undefined;
  const totalSessions = stats?.totalSessions ?? overallStats.totalSessions;
  const totalPages   = stats?.totalPages   ?? overallStats.pagesRead;
  const totalMinutes = stats?.totalMinutes ?? overallStats.minutesRead;
  const avgSpeed     = stats?.averageSpeed ?? Math.round(overallStats.pagesRead / Math.max(1, overallStats.minutesRead / 60));

  // Calendar: highlight days that have a session this month
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const activeDays = new Set(
    sessions
      .filter((s) => {
        const d = new Date(`${s.date}T00:00:00`);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .map((s) => new Date(`${s.date}T00:00:00`).getDate())
  );

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Reading Log</Text>
          <Text style={styles.title}>{book ? book.title : "All sessions"}</Text>
        </View>
        <Pressable
          style={styles.logButton}
          onPress={() => navigation.navigate("AddReadingSession", { bookId })}
        >
          <Text style={styles.logButtonText}>+ Log</Text>
        </Pressable>
      </View>

      {/* Stats strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{totalSessions}</Text>
          <Text style={styles.statLbl}>sessions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{totalPages.toLocaleString()}</Text>
          <Text style={styles.statLbl}>pages</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{Math.round(totalMinutes / 60)}h</Text>
          <Text style={styles.statLbl}>hours read</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{avgSpeed}</Text>
          <Text style={styles.statLbl}>pp/h avg</Text>
        </View>
      </View>

      {/* Calendar — current month */}
      <View style={styles.calendarCard}>
        <Text style={styles.calendarTitle}>
          {now.toLocaleString("en-US", { month: "long" })} · {activeDays.size} days active
        </Text>
        <View style={styles.calendarGrid}>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
            <View
              key={day}
              style={[styles.dayDot, activeDays.has(day) && styles.dayDotActive]}
            >
              <Text style={[styles.dayText, activeDays.has(day) && styles.dayTextActive]}>
                {day}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Sessions list */}
      <SectionHeader title="Sessions" />
      {sessions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No sessions logged yet.</Text>
          <Pressable
            style={styles.emptyButton}
            onPress={() => navigation.navigate("AddReadingSession", { bookId })}
          >
            <Text style={styles.emptyButtonText}>Log your first session</Text>
          </Pressable>
        </View>
      ) : (
        sessions.map((session) => (
          <SessionRow
            key={session.id}
            bookTitle={getBook(session.bookId)?.title ?? "Unknown book"}
            session={session}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md
  },
  eyebrow: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    textTransform: "uppercase"
  },
  title: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
    marginTop: 2,
    maxWidth: 240
  },
  logButton: {
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  logButtonText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  statsStrip: {
    ...shadows.card,
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  statItem: {
    alignItems: "center",
    flex: 1
  },
  statVal: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "900"
  },
  statLbl: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center"
  },
  statDivider: {
    backgroundColor: colors.border,
    height: 28,
    width: 1
  },
  calendarCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  calendarTitle: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: spacing.sm
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  dayDot: {
    alignItems: "center",
    backgroundColor: "#EEE7DB",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  dayDotActive: {
    backgroundColor: colors.teal
  },
  dayText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800"
  },
  dayTextActive: {
    color: colors.card
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14
  },
  emptyButton: {
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10
  },
  emptyButtonText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  }
});
