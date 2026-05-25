import { useNavigation, useRoute } from "@react-navigation/native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BarChart } from "../components/BarChart";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SessionRow } from "../components/SessionRow";
import { StatCard } from "../components/StatCard";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

export function ReadingLogScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "ReadingLog">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getBook, getBookStats, overallStats, readingSessions } = useBooklio();
  const bookId = route.params?.bookId;
  const book = bookId ? getBook(bookId) : undefined;
  const sessions = bookId ? readingSessions.filter((session) => session.bookId === bookId) : readingSessions;
  const stats = bookId ? getBookStats(bookId) : undefined;
  const totalSessions = stats?.totalSessions ?? overallStats.totalSessions;
  const totalMinutes = stats?.totalMinutes ?? overallStats.minutesRead;
  const totalPages = stats?.totalPages ?? overallStats.pagesRead;
  const averagePages = stats?.averagePagesPerSession ?? overallStats.averagePagesPerSession;
  const averageMinutes = stats?.averageMinutesPerSession ?? overallStats.averageMinutesPerSession;
  const longestSession = stats?.longestSession ?? overallStats.longestSession;
  const calendarDays = Array.from({ length: 31 }, (_, index) => index + 1);
  const activeDays = new Set(sessions.map((session) => new Date(`${session.date}T00:00:00`).getDate()));

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{book ? "Book history" : "BoardGameGeek-style play log, but for reading"}</Text>
        <Text style={styles.title}>{book ? `${book.title} Log` : "Reading Log"}</Text>
        <Text style={styles.subtitle}>
          Every session keeps pages, minutes, mood, location, format, difficulty, quotes, enjoyment, and speed together.
        </Text>
        <Pressable style={styles.heroButton} onPress={() => navigation.navigate("AddReadingSession", { bookId })}>
          <Text style={styles.heroButtonText}>Add Reading Session</Text>
        </Pressable>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Sessions" value={totalSessions} detail="Total logs" />
        <StatCard label="Minutes" value={totalMinutes} detail="Focused reading" accent="green" />
        <StatCard label="Pages" value={totalPages} detail="Logged pages" accent="navy" />
        <StatCard label="Avg Pages" value={averagePages} detail="Per session" />
        <StatCard label="Avg Minutes" value={averageMinutes} detail="Per session" accent="green" />
        <StatCard label="Streak" value={`${overallStats.currentStreak}d`} detail={`${overallStats.longestStreak}d longest`} />
      </View>

      <SectionHeader title="Session Stats" />
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLine}>Best reading day: {overallStats.bestReadingDay}</Text>
        <Text style={styles.summaryLine}>
          Longest session: {longestSession ? `${longestSession.minutesRead} minutes, ${longestSession.pagesRead} pages` : "No sessions yet"}
        </Text>
        <Text style={styles.summaryLine}>Current streak: {overallStats.currentStreak} days</Text>
      </View>

      <SectionHeader title="Calendar View" />
      <View style={styles.calendar}>
        {calendarDays.map((day) => (
          <View key={day} style={[styles.dayDot, activeDays.has(day) && styles.dayDotActive]}>
            <Text style={[styles.dayText, activeDays.has(day) && styles.dayTextActive]}>{day}</Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Monthly Activity" />
      <View style={styles.chartCard}>
        <BarChart data={overallStats.monthly.map((month) => ({ label: month.label, value: month.sessions }))} />
      </View>

      <SectionHeader title="Sessions" />
      {sessions.map((session) => (
        <SessionRow key={session.id} bookTitle={getBook(session.bookId)?.title ?? "Unknown book"} session={session} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    ...shadows.card,
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    padding: spacing.lg
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  title: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38,
    marginTop: spacing.sm
  },
  subtitle: {
    color: "#D8D2C8",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm
  },
  heroButton: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingVertical: 12
  },
  heroButtonText: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.md
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md
  },
  summaryLine: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 24
  },
  calendar: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    padding: spacing.md
  },
  dayDot: {
    alignItems: "center",
    backgroundColor: "#EEE7DB",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  dayDotActive: {
    backgroundColor: colors.green
  },
  dayText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800"
  },
  dayTextActive: {
    color: colors.card
  },
  chartCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md
  }
});
