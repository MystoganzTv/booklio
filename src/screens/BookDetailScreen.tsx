import { useNavigation, useRoute } from "@react-navigation/native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Badge } from "../components/Badge";
import { BarChart } from "../components/BarChart";
import { BookCover } from "../components/BookCover";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SessionRow } from "../components/SessionRow";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

export function BookDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "BookDetail">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getAuthor, getBook, getBookStats } = useBooklio();
  const book = getBook(route.params.bookId);

  if (!book) {
    return (
      <Screen>
        <Text>Book not found.</Text>
      </Screen>
    );
  }

  const author = getAuthor(book.authorId);
  const stats = getBookStats(book.id);
  const progressData = stats.latestSessions
    .slice()
    .reverse()
    .map((session) => ({
      label: new Date(`${session.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: session.pagesRead
    }));

  return (
    <Screen>
      <View style={styles.hero}>
        <BookCover book={book} size="lg" />
        <View style={styles.heroCopy}>
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.author}>{author?.name}</Text>
          {book.seriesName ? (
            <Pressable onPress={() => navigation.navigate("SeriesTracker", { seriesId: book.seriesId ?? "" })}>
              <Text style={styles.series}>
                {book.seriesName} - Book {book.seriesNumber}
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.badges}>
            <Badge label={book.userStatus.status.replaceAll("-", " ")} tone={book.userStatus.status === "dnf" ? "danger" : "gold"} />
            <Badge label={book.userStatus.ownership === "owned" ? "Owned" : "Not Owned"} tone={book.userStatus.ownership === "owned" ? "green" : "gray"} />
            {book.userStatus.wishlist ? <Badge label="Wishlist" tone="navy" /> : null}
            {book.userStatus.wantToBuy ? <Badge label="Buy" tone="gold" /> : null}
          </View>
        </View>
      </View>

      <View style={styles.actionGrid}>
        {[
          ["Mark as Read", "read"],
          ["Start Reading", "reading"],
          ["Log Session", "log"],
          ["Add to Wishlist", "wishlist"],
          ["Want to Buy", "buy"],
          ["Add Note", "note"],
          ["View Similar Books", "similar"],
          ["View Same Author", "author"],
          ["View Saga", "saga"]
        ].map(([label, action]) => (
          <Pressable
            key={label}
            style={[styles.actionButton, action === "log" && styles.actionPrimary]}
            onPress={() => {
              if (action === "log") navigation.navigate("AddReadingSession", { bookId: book.id });
              else if (action === "saga" && book.seriesId) navigation.navigate("SeriesTracker", { seriesId: book.seriesId });
              else Alert.alert("Mock interaction", `${label} is wired as a backend-ready action.`);
            }}
          >
            <Text style={[styles.actionText, action === "log" && styles.actionPrimaryText]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader title="Synopsis" />
      <Text style={styles.paragraph}>{book.synopsis}</Text>

      <SectionHeader title="Author Bio" />
      <Text style={styles.paragraph}>{author?.bio}</Text>

      <SectionHeader title="Metadata" />
      <View style={styles.infoGrid}>
        {[
          ["Genre", book.genre.join(", ")],
          ["Pages", `${book.pages}`],
          ["Published", book.publishedDate],
          ["Publisher", book.publisher],
          ["Language", book.language],
          ["ISBN", book.isbn],
          ["Format", book.format]
        ].map(([label, value]) => (
          <View key={label} style={styles.infoCard}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Your Data" />
      <View style={styles.infoGrid}>
        {[
          ["Rating", book.userStatus.rating ? `${book.userStatus.rating}/5` : "Unrated"],
          ["Personal Rank", book.userStatus.personalRanking ? `#${book.userStatus.personalRanking}` : "Not ranked"],
          ["Start Date", book.userStatus.startDate ?? "Not started"],
          ["Finish Date", book.userStatus.finishDate ?? "Open"],
          ["Progress", `${book.userStatus.progressPercent}%`],
          ["Sessions", `${stats.totalSessions}`],
          ["Minutes", `${stats.totalMinutes}`],
          ["Avg Speed", `${stats.averageSpeed} pp/h`]
        ].map(([label, value]) => (
          <View key={label} style={styles.infoCard}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.notesCard}>
        <Text style={styles.notesLabel}>Notes</Text>
        <Text style={styles.paragraph}>{book.userStatus.notes}</Text>
        {book.userStatus.favoriteQuotes.map((quote) => (
          <Text key={quote} style={styles.quote}>
            "{quote}"
          </Text>
        ))}
      </View>

      <SectionHeader
        title="Reading Log"
        actionLabel="Full history"
        onAction={() => navigation.navigate("ReadingLog", { bookId: book.id })}
      />
      {stats.latestSessions.map((session) => (
        <SessionRow key={session.id} bookTitle={book.title} session={session} />
      ))}
      {progressData.length ? (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Recent page bursts</Text>
          <BarChart data={progressData} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    ...shadows.card,
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  heroCopy: {
    flex: 1
  },
  title: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 33
  },
  author: {
    color: "#E7DCCB",
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 6
  },
  series: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 8
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: spacing.md
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg
  },
  actionButton: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 11
  },
  actionPrimary: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  actionText: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  actionPrimaryText: {
    color: colors.navy
  },
  paragraph: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  infoCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    width: "48%"
  },
  infoLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  infoValue: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 5
  },
  notesCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md
  },
  notesLabel: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: "uppercase"
  },
  quote: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 18,
    fontStyle: "italic",
    lineHeight: 25,
    marginTop: spacing.sm
  },
  chartCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md
  },
  chartTitle: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: spacing.md,
    textTransform: "uppercase"
  }
});
