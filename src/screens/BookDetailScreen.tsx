import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge } from "../components/Badge";
import { BookCover } from "../components/BookCover";
import { BookStatusSheet } from "../components/BookStatusSheet";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SessionRow } from "../components/SessionRow";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";
import { formatStatusLabel } from "../utils/statusLabels";

export function BookDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "BookDetail">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getAuthor, getBook, getBookStats, updateBookStatus } = useBooklio();
  const book = getBook(route.params.bookId);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);

  if (!book) {
    return (
      <Screen>
        <Text style={{ color: colors.muted, fontFamily: fonts.body, padding: spacing.lg }}>Book not found.</Text>
      </Screen>
    );
  }

  const author = getAuthor(book.authorId);
  const stats = getBookStats(book.id);

  const statusLabel = formatStatusLabel(book.userStatus.status);
  const isReading = book.userStatus.status === "reading";
  const isDone = book.userStatus.status === "read";

  return (
    <Screen>
      {/* Hero */}
      <View style={styles.hero}>
        <BookCover book={book} size="lg" />
        <View style={styles.heroCopy}>
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.author}>{author?.name}</Text>
          {book.seriesName ? (
            <Pressable onPress={() => book.seriesId && navigation.navigate("SeriesTracker", { seriesId: book.seriesId })}>
              <Text style={styles.series}>{book.seriesName} · Book {book.seriesNumber}</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.badges} onPress={() => setStatusSheetOpen(true)}>
            <Badge
              label={statusLabel}
              tone={book.userStatus.status === "dnf" ? "danger" : book.userStatus.status === "read" ? "green" : "gold"}
            />
            {book.userStatus.rating ? (
              <Badge label={`${book.userStatus.rating} ★`} tone="navy" />
            ) : null}
            <Badge label="Edit ›" tone="gray" />
          </Pressable>
        </View>
      </View>

      {/* Primary actions */}
      <View style={styles.actions}>
        <Pressable
          style={styles.primaryAction}
          onPress={() => navigation.navigate("AddReadingSession", { bookId: book.id })}
        >
          <Ionicons name="pencil" size={15} color={colors.card} style={{ marginRight: 6 }} />
          <Text style={styles.primaryActionText}>Log Session</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryAction}
          onPress={() => navigation.navigate("ReadingLog", { bookId: book.id })}
        >
          <Ionicons name="time-outline" size={15} color={colors.navy} />
        </Pressable>
        {book.seriesId ? (
          <Pressable
            style={styles.secondaryAction}
            onPress={() => navigation.navigate("SeriesTracker", { seriesId: book.seriesId! })}
          >
            <Ionicons name="layers-outline" size={15} color={colors.navy} />
          </Pressable>
        ) : null}
        <Pressable
          style={styles.secondaryAction}
          onPress={() => navigation.navigate("EditBook", { bookId: book.id })}
        >
          <Ionicons name="create-outline" size={15} color={colors.navy} />
        </Pressable>
      </View>

      {/* Reading progress */}
      {(isReading || isDone) && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressPct}>{book.userStatus.progressPercent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${book.userStatus.progressPercent}%` }]} />
          </View>
          <View style={styles.progressMeta}>
            {book.userStatus.startDate ? (
              <Text style={styles.progressMetaText}>Started {book.userStatus.startDate}</Text>
            ) : null}
            {book.userStatus.finishDate ? (
              <Text style={styles.progressMetaText}>Finished {book.userStatus.finishDate}</Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Reading stats */}
      {stats.totalSessions > 0 && (
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{stats.totalSessions}</Text>
            <Text style={styles.statLbl}>sessions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{stats.totalPages}</Text>
            <Text style={styles.statLbl}>pages logged</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{stats.averageSpeed}</Text>
            <Text style={styles.statLbl}>pp/h avg</Text>
          </View>
        </View>
      )}

      {/* Book info */}
      <View style={styles.infoRow}>
        {[
          ["Genre", book.genre.join(", ")],
          ["Pages", `${book.pages}`],
          ["Published", book.publishedDate.slice(0, 4)],
          ["Format", book.format],
        ].map(([label, value]) => (
          <View key={label} style={styles.infoChip}>
            <Text style={styles.infoChipLabel}>{label}</Text>
            <Text style={styles.infoChipValue}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Metadata badges: bestseller / sequel / tags */}
      {(book.isBestseller || book.isSequel || (book.tags && book.tags.length > 0)) && (
        <View style={styles.tagWrap}>
          {book.isBestseller && (
            <View style={[styles.tagPill, styles.tagBestseller]}>
              <Ionicons name="star" size={11} color={colors.navy} style={{ marginRight: 4 }} />
              <Text style={styles.tagPillText}>Bestseller</Text>
            </View>
          )}
          {book.isSequel && (
            <View style={[styles.tagPill, styles.tagSequel]}>
              <Ionicons name="git-branch-outline" size={11} color={colors.card} style={{ marginRight: 4 }} />
              <Text style={[styles.tagPillText, { color: colors.card }]}>Sequel</Text>
            </View>
          )}
          {book.tags?.map((tag) => (
            <View key={tag} style={styles.tagPill}>
              <Text style={styles.tagPillText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Synopsis */}
      {book.synopsis ? (
        <>
          <SectionHeader title="Synopsis" />
          <Pressable onPress={() => setSynopsisExpanded((v) => !v)}>
            <Text style={styles.synopsis} numberOfLines={synopsisExpanded ? undefined : 3}>
              {book.synopsis}
            </Text>
            <Text style={styles.synopsisToggle}>
              {synopsisExpanded ? "Show less" : "Read more"}
            </Text>
          </Pressable>
        </>
      ) : null}

      {/* Recent sessions */}
      {stats.latestSessions.length > 0 ? (
        <>
          <SectionHeader
            title="Recent Sessions"
            actionLabel="All sessions"
            onAction={() => navigation.navigate("ReadingLog", { bookId: book.id })}
          />
          {stats.latestSessions.slice(0, 3).map((session) => (
            <SessionRow
              key={session.id}
              bookTitle={book.title}
              session={session}
              onPress={() => navigation.navigate("AddReadingSession", { bookId: book.id, sessionId: session.id })}
            />
          ))}
        </>
      ) : null}

      <BookStatusSheet
        open={statusSheetOpen}
        currentStatus={book.userStatus.status}
        currentRating={book.userStatus.rating}
        onSave={(status, rating) => updateBookStatus(book.id, status, rating)}
        onClose={() => setStatusSheetOpen(false)}
      />
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
    marginBottom: spacing.md,
    padding: spacing.md
  },
  heroCopy: {
    flex: 1
  },
  title: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26
  },
  author: {
    color: "#E7DCCB",
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 5
  },
  series: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 6
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: spacing.sm
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    minWidth: 150,
    paddingVertical: 13
  },
  primaryActionText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46
  },
  progressCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  progressHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm
  },
  progressLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  progressPct: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "900"
  },
  progressTrack: {
    backgroundColor: "#EEE7DB",
    borderRadius: radii.pill,
    height: 10,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: colors.teal,
    borderRadius: radii.pill,
    height: "100%"
  },
  progressMeta: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xs
  },
  progressMetaText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11
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
  statVal: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900"
  },
  statLbl: {
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
  infoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  infoChip: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: "47%"
  },
  infoChipLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  infoChipValue: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.md
  },
  tagPill: {
    alignItems: "center",
    backgroundColor: colors.navy + "18",
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  tagBestseller: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  tagSequel: {
    backgroundColor: colors.teal,
    borderColor: colors.teal
  },
  tagPillText: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900"
  },
  synopsis: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23
  },
  synopsisToggle: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    marginTop: spacing.xs
  }
});
