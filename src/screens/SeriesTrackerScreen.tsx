import { useNavigation, useRoute } from "@react-navigation/native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge } from "../components/Badge";
import { BookCover } from "../components/BookCover";
import { FilterChip } from "../components/FilterChip";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

export function SeriesTrackerScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "SeriesTracker">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { books, getAuthor, series } = useBooklio();
  const [order, setOrder] = useState<"Reading order" | "Release order">("Reading order");
  const saga = series.find((item) => item.id === route.params.seriesId);
  const sagaBooks = books
    .filter((book) => book.seriesId === route.params.seriesId)
    .sort((a, b) => (order === "Reading order" ? (a.sagaOrder ?? 99) - (b.sagaOrder ?? 99) : (a.releaseOrder ?? 99) - (b.releaseOrder ?? 99)));
  const completed = sagaBooks.filter((book) => book.userStatus.status === "read").length;
  const completion = sagaBooks.length ? Math.round((completed / sagaBooks.length) * 100) : 0;
  const nextBook = sagaBooks.find((book) => book.userStatus.status !== "read" && book.userStatus.status !== "dnf");
  const upcoming = sagaBooks.filter((book) => book.userStatus.status === "upcoming-release" || book.upcomingReleaseDate);

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Saga tracker</Text>
        <Text style={styles.title}>{saga?.name ?? "Series"}</Text>
        <Text style={styles.subtitle}>{saga?.description}</Text>
        <View style={styles.completionTrack}>
          <View style={[styles.completionFill, { width: `${completion}%` }]} />
        </View>
        <Text style={styles.completionText}>{completion}% complete - {completed}/{sagaBooks.length} tracked books read</Text>
      </View>

      <View style={styles.orderRail}>
        <FilterChip label="Reading order" selected={order === "Reading order"} onPress={() => setOrder("Reading order")} />
        <FilterChip label="Release order" selected={order === "Release order"} onPress={() => setOrder("Release order")} />
      </View>

      {nextBook ? (
        <View style={styles.nextCard}>
          <Text style={styles.nextLabel}>Next book to read</Text>
          <Text style={styles.nextTitle}>{nextBook.title}</Text>
          <Text style={styles.nextMeta}>{getAuthor(nextBook.authorId)?.name} - {nextBook.pages} pages</Text>
          <Pressable style={styles.nextButton} onPress={() => navigation.navigate("BookDetail", { bookId: nextBook.id })}>
            <Text style={styles.nextButtonText}>Open Book</Text>
          </Pressable>
        </View>
      ) : null}

      {sagaBooks.map((book) => (
        <Pressable key={book.id} style={styles.bookRow} onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}>
          <BookCover book={book} size="sm" />
          <View style={styles.bookCopy}>
            <Text style={styles.bookOrder}>#{order === "Reading order" ? book.sagaOrder : book.releaseOrder}</Text>
            <Text style={styles.bookTitle}>{book.title}</Text>
            <Text style={styles.bookMeta}>{book.publishedDate} - {book.pages} pages</Text>
            <View style={styles.badges}>
              <Badge label={book.userStatus.status.replaceAll("-", " ")} tone={book.userStatus.status === "read" ? "green" : "gray"} />
              {book.userStatus.ownership === "owned" ? <Badge label="Owned" tone="green" /> : null}
              {book.userStatus.wishlist ? <Badge label="Wishlist" tone="navy" /> : null}
            </View>
          </View>
        </Pressable>
      ))}

      {upcoming.length ? (
        <View style={styles.upcomingCard}>
          <Text style={styles.nextLabel}>Upcoming in saga</Text>
          {upcoming.map((book) => (
            <Text key={book.id} style={styles.upcomingLine}>
              {book.title} - {book.upcomingReleaseDate ?? book.publishedDate}
            </Text>
          ))}
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
    padding: spacing.lg
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  title: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 35,
    fontWeight: "900",
    lineHeight: 39,
    marginTop: spacing.sm
  },
  subtitle: {
    color: "#D8D2C8",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm
  },
  completionTrack: {
    backgroundColor: "rgba(248,243,234,0.18)",
    borderRadius: radii.pill,
    height: 12,
    marginTop: spacing.lg,
    overflow: "hidden"
  },
  completionFill: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    height: "100%"
  },
  completionText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800",
    marginTop: spacing.sm
  },
  orderRail: {
    flexDirection: "row",
    marginTop: spacing.lg
  },
  nextCard: {
    backgroundColor: "#EFE6D7",
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md
  },
  nextLabel: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  nextTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 5
  },
  nextMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4
  },
  nextButton: {
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingVertical: 12
  },
  nextButtonText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  bookRow: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md
  },
  bookCopy: {
    flex: 1
  },
  bookOrder: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  bookTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 25,
    marginTop: 4
  },
  bookMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: spacing.sm
  },
  upcomingCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md
  },
  upcomingLine: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 24,
    marginTop: 5
  }
});
