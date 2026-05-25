import { Ionicons } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { BookCover } from "../components/BookCover";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SessionRow } from "../components/SessionRow";
import { useBooklio } from "../data/BooklioContext";
import { MainTabParamList, RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

const booklioLogo = require("../../assets/brand/booklio-logo.png");

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 19) return "Good afternoon";
  return "Good evening";
}

function getStreakMessage(streak: number): { headline: string; sub: string; accent: string } {
  if (streak === 0)  return { headline: "No streak yet today",  sub: "Log a session to start one.",          accent: colors.muted };
  if (streak === 1)  return { headline: "Day 1 — welcome back!", sub: "Every streak starts somewhere.",       accent: colors.teal };
  if (streak < 4)   return { headline: `${streak} days in a row`, sub: "You're building a habit.",           accent: colors.teal };
  if (streak < 7)   return { headline: `${streak}-day streak 🔥`, sub: "Solid consistency. Keep going.",     accent: colors.coral };
  if (streak < 14)  return { headline: `${streak} days straight!`, sub: "One week down. You're on fire.",    accent: colors.coral };
  if (streak < 30)  return { headline: `${streak}-day streak 🔥`, sub: "Two weeks? That's a real habit.",    accent: colors.gold };
  return               { headline: `${streak} days. Legendary.`, sub: "You might be unstoppable.",           accent: colors.gold };
}

export function HomeScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList & MainTabParamList>>();
  const { books, getAuthor, getBook, overallStats, readingSessions, userProfile } = useBooklio();
  const continueBook = books.find((b) => b.userStatus.status === "reading") ?? null;
  const goalPct = Math.min(100, Math.round((overallStats.booksReadThisYear / userProfile.yearlyGoal) * 100));
  const remaining = userProfile.yearlyGoal - overallStats.booksReadThisYear;
  const streakMsg = getStreakMessage(overallStats.currentStreak);

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Image source={booklioLogo} style={styles.logo} resizeMode="contain" />
        <View>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.name}>{userProfile.name}.</Text>
        </View>
      </View>

      {/* Stats strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{overallStats.booksReadThisYear}</Text>
          <Text style={styles.statLabel}>books this year</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{overallStats.pagesRead.toLocaleString()}</Text>
          <Text style={styles.statLabel}>pages read</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.tealDark }]}>{overallStats.currentStreak}d</Text>
          <Text style={styles.statLabel}>current streak</Text>
        </View>
      </View>

      {/* Streak card */}
      <Pressable
        style={styles.streakCard}
        onPress={() => navigation.navigate("ReadingLog", {})}
      >
        <View style={[styles.streakIconWrap, { backgroundColor: streakMsg.accent + "22" }]}>
          <Ionicons name="flame" size={22} color={streakMsg.accent} />
        </View>
        <View style={styles.streakCopy}>
          <Text style={[styles.streakHeadline, { color: streakMsg.accent === colors.muted ? colors.navy : streakMsg.accent }]}>
            {streakMsg.headline}
          </Text>
          <Text style={styles.streakSub}>{streakMsg.sub}</Text>
        </View>
        <Text style={[styles.streakCount, { color: streakMsg.accent }]}>
          {overallStats.currentStreak}d
        </Text>
      </Pressable>

      {/* Goal card */}
      <View style={styles.goalCard}>
        <View style={styles.goalRow}>
          <View>
            <Text style={styles.goalLabel}>Annual goal</Text>
            <Text style={styles.goalTitle}>{overallStats.booksReadThisYear} / {userProfile.yearlyGoal} books</Text>
          </View>
          <Text style={styles.goalPct}>{goalPct}%</Text>
        </View>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${goalPct}%` }]} />
        </View>
        <Text style={styles.goalSub}>
          {remaining > 0 ? `${remaining} more book${remaining === 1 ? "" : "s"} to your goal` : "Goal reached! 🎉"}
        </Text>
      </View>

      {/* Continue reading */}
      {continueBook ? (
        <View style={styles.continueCard}>
          <BookCover book={continueBook} size="md" />
          <View style={styles.continueCopy}>
            <Text style={styles.sectionEyebrow}>Continue reading</Text>
            <Text style={styles.continueTitle}>{continueBook.title}</Text>
            <Text style={styles.continueAuthor}>{getAuthor(continueBook.authorId)?.name}</Text>
            <View style={styles.progressMini}>
              <View style={styles.progressMiniTrack}>
                <View style={[styles.progressMiniFill, { width: `${continueBook.userStatus.progressPercent}%` }]} />
              </View>
              <Text style={styles.progressMiniPct}>{continueBook.userStatus.progressPercent}%</Text>
            </View>
            <Pressable
              style={styles.primaryButton}
              onPress={() => navigation.navigate("AddReadingSession", { bookId: continueBook.id })}
            >
              <Ionicons name="pencil" size={13} color={colors.card} style={{ marginRight: 6 }} />
              <Text style={styles.primaryButtonText}>Log session</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.emptyCard} onPress={() => navigation.navigate("Add")}>
          <Ionicons name="book-outline" size={28} color={colors.teal} />
          <Text style={styles.emptyTitle}>What are you reading?</Text>
          <Text style={styles.emptySubtitle}>Add a book to start tracking your progress.</Text>
        </Pressable>
      )}

      {/* Recent sessions */}
      {readingSessions.length > 0 ? (
        <>
          <SectionHeader
            title="Recent Sessions"
            actionLabel="View all"
            onAction={() => navigation.navigate("ReadingLog", {})}
          />
          {readingSessions.slice(0, 3).map((session) => (
            <SessionRow
              key={session.id}
              bookTitle={getBook(session.bookId)?.title ?? "Unknown book"}
              session={session}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md
  },
  logo: {
    height: 48,
    width: 48
  },
  greeting: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "800"
  },
  name: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  statItem: {
    alignItems: "center",
    flex: 1
  },
  statValue: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900"
  },
  statLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center"
  },
  statDivider: {
    backgroundColor: colors.border,
    height: 32,
    width: 1
  },
  streakCard: {
    ...shadows.card,
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  streakIconWrap: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  streakCopy: {
    flex: 1
  },
  streakHeadline: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  },
  streakSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2
  },
  streakCount: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900"
  },
  goalCard: {
    ...shadows.card,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  goalRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  goalLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  goalTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 2
  },
  goalPct: {
    color: colors.green,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900"
  },
  goalTrack: {
    backgroundColor: "#EEE7DB",
    borderRadius: radii.pill,
    height: 10,
    marginTop: spacing.sm,
    overflow: "hidden"
  },
  goalFill: {
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    height: "100%"
  },
  goalSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: spacing.xs
  },
  continueCard: {
    ...shadows.card,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  continueCopy: {
    flex: 1
  },
  sectionEyebrow: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  continueTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24,
    marginTop: 4
  },
  continueAuthor: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4
  },
  progressMini: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  progressMiniTrack: {
    backgroundColor: "#EEE7DB",
    borderRadius: radii.pill,
    flex: 1,
    height: 6,
    overflow: "hidden"
  },
  progressMiniFill: {
    backgroundColor: colors.teal,
    borderRadius: radii.pill,
    height: "100%"
  },
  progressMiniPct: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  primaryButtonText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.xl
  },
  emptyTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "900",
    marginTop: spacing.xs
  },
  emptySubtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center"
  }
});
