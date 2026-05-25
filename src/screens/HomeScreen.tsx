import { NavigationProp, useNavigation } from "@react-navigation/native";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BookCard } from "../components/BookCard";
import { BookCover } from "../components/BookCover";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SessionRow } from "../components/SessionRow";
import { StatCard } from "../components/StatCard";
import { useBooklio } from "../data/BooklioContext";
import { MainTabParamList, RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

const booklioLogo = require("../../assets/brand/booklio-logo.png");

export function HomeScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList & MainTabParamList>>();
  const { books, getAuthor, getBook, overallStats, readingSessions, recommendations, userProfile } = useBooklio();
  const currentlyReading = books.filter((book) => book.userStatus.status === "reading");
  const continueBook = currentlyReading[0] ?? books.find((book) => book.userStatus.status === "read");
  const upcoming = books.filter((book) => book.userStatus.status === "upcoming-release" || book.upcomingReleaseDate);
  const recommendedBooks = recommendations.map((rec) => getBook(rec.bookId)).filter(Boolean);
  const recentActivity = [
    `Logged ${readingSessions[0]?.pagesRead ?? 0} pages in ${getBook(readingSessions[0]?.bookId ?? "")?.title ?? "a book"}.`,
    `Moved ${continueBook?.title ?? "current read"} to ${continueBook?.userStatus.progressPercent ?? 0}% progress.`,
    `${overallStats.totalBooksRead} books finished toward ${userProfile.yearlyGoal}.`
  ];

  return (
    <Screen>
      <View style={styles.hero}>
        <Image source={booklioLogo} style={styles.heroLogo} resizeMode="contain" />
        <Text style={styles.greeting}>Good evening, {userProfile.name}.</Text>
        <Text style={styles.subtitle}>Tu historia, cada libro. Your library is warm, personal, and very traceable today.</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Books Read" value={overallStats.totalBooksRead} detail="All-time library" />
        <StatCard label="This Year" value={overallStats.booksReadThisYear} detail={`${userProfile.yearlyGoal - overallStats.booksReadThisYear} to goal`} accent="green" />
        <StatCard label="Pages Read" value={overallStats.pagesRead} detail="Logged pages" accent="navy" />
        <StatCard label="Current Streak" value={`${overallStats.currentStreak}d`} detail="Reading habit" />
      </View>

      <View style={styles.goalCard}>
        <View>
          <Text style={styles.goalLabel}>Reading goal progress</Text>
          <Text style={styles.goalTitle}>
            {overallStats.booksReadThisYear}/{userProfile.yearlyGoal} books
          </Text>
        </View>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${Math.min(100, (overallStats.booksReadThisYear / userProfile.yearlyGoal) * 100)}%` }]} />
        </View>
      </View>

      {continueBook ? (
        <View style={styles.continueCard}>
          <BookCover book={continueBook} size="md" />
          <View style={styles.continueCopy}>
            <Text style={styles.sectionEyebrow}>Continue reading</Text>
            <Text style={styles.continueTitle}>{continueBook.title}</Text>
            <Text style={styles.continueAuthor}>{getAuthor(continueBook.authorId)?.name}</Text>
            <Text style={styles.continueMeta}>{continueBook.userStatus.progressPercent}% complete - {continueBook.pages} pages</Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => navigation.navigate("AddReadingSession", { bookId: continueBook.id })}
            >
              <Text style={styles.primaryButtonText}>Log Reading Session</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <SectionHeader title="Current Shelf" actionLabel="Library" onAction={() => navigation.navigate("Library")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {currentlyReading.map((book) => (
          <BookCard
            key={book.id}
            authorName={getAuthor(book.authorId)?.name ?? "Unknown author"}
            book={book}
            onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}
          />
        ))}
      </ScrollView>

      <SectionHeader title="Recent Sessions" actionLabel="View log" onAction={() => navigation.navigate("ReadingLog", {})} />
      {readingSessions.slice(0, 3).map((session) => (
        <SessionRow key={session.id} bookTitle={getBook(session.bookId)?.title ?? "Unknown book"} session={session} />
      ))}

      <SectionHeader title="Upcoming Releases" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {upcoming.map((book) => (
          <BookCard
            key={book.id}
            authorName={getAuthor(book.authorId)?.name ?? "Unknown author"}
            book={book}
            onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}
          />
        ))}
      </ScrollView>

      <SectionHeader title="Recommended For You" />
      {recommendedBooks.map((book) =>
        book ? (
          <BookCard
            key={book.id}
            compact
            authorName={getAuthor(book.authorId)?.name ?? "Unknown author"}
            book={book}
            onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}
          />
        ) : null
      )}

      <SectionHeader title="Recent Activity" />
      <View style={styles.activityCard}>
        {recentActivity.map((item) => (
          <Text key={item} style={styles.activityItem}>
            {item}
          </Text>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: "hidden",
    padding: spacing.lg
  },
  heroLogo: {
    height: 155,
    width: "100%"
  },
  kicker: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase"
  },
  greeting: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38,
    marginTop: spacing.sm
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  goalCard: {
    ...shadows.card,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md
  },
  goalLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  goalTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 3
  },
  goalTrack: {
    backgroundColor: "#EEE7DB",
    borderRadius: radii.pill,
    height: 12,
    marginTop: spacing.md,
    overflow: "hidden"
  },
  goalFill: {
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    height: "100%"
  },
  continueCard: {
    ...shadows.card,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
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
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 27,
    marginTop: 6
  },
  continueAuthor: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 5
  },
  continueMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 5
  },
  primaryButton: {
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11
  },
  primaryButtonText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  activityCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md
  },
  activityItem: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 8
  }
});
