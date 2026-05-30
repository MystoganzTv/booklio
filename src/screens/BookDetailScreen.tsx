import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Badge } from "../components/Badge";
import { BookCover } from "../components/BookCover";
import { RecommendationCard } from "../components/RecommendationCard";
import { BookStatusSheet } from "../components/BookStatusSheet";
import { BookListSheet } from "../components/BookListSheet";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SessionRow } from "../components/SessionRow";
import { useBookliz } from "../data/BooklizContext";
import { RootStackParamList } from "../navigation/types";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useTheme } from "../theme/ThemeContext";
import { useI18n } from "../i18n/LocalizationContext";
import { formatStatusLabel } from "../utils/statusLabels";

/** Strip raw API genre strings and return clean, readable labels */
function cleanGenres(raw: string[]): string[] {
  return raw
    .filter((g) => !/^nyt:/i.test(g))
    .filter((g) => !/new york times/i.test(g))
    .map((g) => g.replace(/\b\w/g, (ch) => ch.toUpperCase()).trim())
    .filter((g, i, arr) => arr.indexOf(g) === i)
    .slice(0, 3);
}

export function BookDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "BookDetail">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors: c } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(c), [c]);
  const { getAuthor, getBook, getBookStats, getRecommendationsForBook, updateBookStatus, getReviewForBook } = useBookliz();
  const book = getBook(route.params.bookId);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [listSheetOpen, setListSheetOpen] = useState(false);
  const review = getReviewForBook(route.params.bookId);

  if (!book) {
    return (
      <Screen>
        <Text style={{ color: c.muted, fontFamily: fonts.body, padding: spacing.lg }}>Book not found.</Text>
      </Screen>
    );
  }

  const author = getAuthor(book.authorId);
  const stats = getBookStats(book.id);
  const bestsellerSpecificTag = book.tags?.some((tag) => /bestseller/i.test(tag));
  const genres = cleanGenres(book.genre);

  const statusLabel = formatStatusLabel(book.userStatus.status);
  const isReading = book.userStatus.status === "reading";
  const isDone = book.userStatus.status === "read";
  const relatedRecommendations = getRecommendationsForBook(book.id, 3)
    .map((recommendation) => ({ recommendation, recommendedBook: getBook(recommendation.bookId) }))
    .filter((item): item is { recommendation: ReturnType<typeof getRecommendationsForBook>[number]; recommendedBook: NonNullable<ReturnType<typeof getBook>> } => Boolean(item.recommendedBook));

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
          <Ionicons name="pencil" size={15} color={c.card} style={{ marginRight: 6 }} />
          <Text style={styles.primaryActionText}>{t("bookDetail.logSession")}</Text>
        </Pressable>
        {(isDone || review) ? (
          <Pressable
            style={styles.reviewAction}
            onPress={() => navigation.navigate("WriteReview", { bookId: book.id })}
          >
            <Ionicons name={review ? "create-outline" : "star-outline"} size={15} color={c.navy} style={{ marginRight: 6 }} />
            <Text style={styles.reviewActionText}>{review ? t("bookDetail.editReview") : t("bookDetail.writeReview")}</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.secondaryAction}
          onPress={() => navigation.navigate("ReadingLog", { bookId: book.id })}
        >
          <Ionicons name="time-outline" size={15} color={c.ink} />
        </Pressable>
        {book.seriesId ? (
          <Pressable
            style={styles.secondaryAction}
            onPress={() => navigation.navigate("SeriesTracker", { seriesId: book.seriesId! })}
          >
            <Ionicons name="layers-outline" size={15} color={c.ink} />
          </Pressable>
        ) : null}
        <Pressable
          style={styles.secondaryAction}
          onPress={() => navigation.navigate("EditBook", { bookId: book.id })}
        >
          <Ionicons name="create-outline" size={15} color={c.ink} />
        </Pressable>
        <Pressable
          style={styles.secondaryAction}
          onPress={() => setListSheetOpen(true)}
        >
          <Ionicons name="bookmarks-outline" size={15} color={c.ink} />
        </Pressable>
      </View>

      {/* Reading progress */}
      {(isReading || isDone) && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>{t("bookDetail.progress")}</Text>
            <Text style={styles.progressPct}>{book.userStatus.progressPercent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${book.userStatus.progressPercent}%` }]} />
          </View>
          <View style={styles.progressMeta}>
            {book.userStatus.startDate ? (
              <Text style={styles.progressMetaText}>{t("bookDetail.started")} {book.userStatus.startDate}</Text>
            ) : null}
            {book.userStatus.finishDate ? (
              <Text style={styles.progressMetaText}>{t("bookDetail.finished")} {book.userStatus.finishDate}</Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Reading stats */}
      {stats.totalSessions > 0 && (
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{stats.totalSessions}</Text>
            <Text style={styles.statLbl}>{t("bookDetail.statSessions")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{stats.totalPages}</Text>
            <Text style={styles.statLbl}>{t("bookDetail.statPagesLogged")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{stats.averageSpeed}</Text>
            <Text style={styles.statLbl}>{t("bookDetail.statPpH")}</Text>
          </View>
        </View>
      )}

      <View style={styles.collectorSummary}>
        <View style={styles.collectorSummaryItem}>
          <Text style={styles.collectorSummaryValue}>{book.userStatus.readCount ?? 0}</Text>
          <Text style={styles.collectorSummaryLabel}>{t("bookDetail.timesFinished")}</Text>
        </View>
        <View style={styles.collectorDivider} />
        <View style={styles.collectorSummaryItem}>
          <Text style={styles.collectorSummaryValue}>{book.userStatus.personalRanking ?? "—"}</Text>
          <Text style={styles.collectorSummaryLabel}>{t("bookDetail.personalRank")}</Text>
        </View>
        <View style={styles.collectorDivider} />
        <View style={styles.collectorSummaryItem}>
          <Text style={styles.collectorSummaryValue}>{book.userStatus.favoriteQuotes.length}</Text>
          <Text style={styles.collectorSummaryLabel}>{t("bookDetail.savedQuotes")}</Text>
        </View>
      </View>

      {/* Book info */}
      <View style={styles.infoRow}>
        {([
          [t("bookDetail.labelGenre"), genres.length > 0 ? genres.join(", ") : "—"],
          [t("bookDetail.labelPages"), `${book.pages}`],
          [t("bookDetail.labelPublished"), book.publishedDate.slice(0, 4)],
          [t("bookDetail.labelFormat"), book.format],
        ] as [string, string][]).map(([label, value]) => (
          <View key={label} style={styles.infoChip}>
            <Text style={styles.infoChipLabel}>{label}</Text>
            <Text style={styles.infoChipValue}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Metadata badges: bestseller / sequel / tags */}
      {(book.isBestseller || book.isSequel || (book.tags && book.tags.length > 0)) && (
        <View style={styles.tagWrap}>
          {book.isBestseller && !bestsellerSpecificTag && (
            <View style={[styles.tagPill, styles.tagBestseller]}>
              <Ionicons name="star" size={11} color={c.navy} style={{ marginRight: 4 }} />
              <Text style={styles.tagPillText}>Bestseller</Text>
            </View>
          )}
          {book.isSequel && (
            <View style={[styles.tagPill, styles.tagSequel]}>
              <Ionicons name="git-branch-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={[styles.tagPillText, { color: "#FFFFFF" }]}>Sequel</Text>
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

      {/* Review section */}
      <SectionHeader
        title="Your Review"
        actionLabel={review ? "Edit" : "Write"}
        onAction={() => navigation.navigate("WriteReview", { bookId: book.id })}
      />
      {review ? (
        <View style={styles.reviewCard}>
          <View style={styles.reviewStars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Ionicons
                key={n}
                name={n <= review.rating ? "star" : "star-outline"}
                size={16}
                color={n <= review.rating ? c.gold : c.border}
              />
            ))}
            <Text style={styles.reviewDate}>{review.createdAt}</Text>
          </View>
          <Text style={styles.reviewTitle}>{review.title}</Text>
          {review.body ? (
            <Text style={styles.reviewBody} numberOfLines={4}>{review.body}</Text>
          ) : null}
        </View>
      ) : (
        <Pressable
          style={styles.reviewEmpty}
          onPress={() => navigation.navigate("WriteReview", { bookId: book.id })}
        >
          <Ionicons name="create-outline" size={18} color={c.muted} />
          <Text style={styles.reviewEmptyText}>No review yet — tap to write one</Text>
        </Pressable>
      )}

      {relatedRecommendations.length > 0 ? (
        <>
          <SectionHeader title="Keep This Shelf Moving" />
          <View style={styles.recommendationStack}>
            {relatedRecommendations.map(({ recommendation, recommendedBook }) => (
              <RecommendationCard
                key={recommendation.id}
                authorName={getAuthor(recommendedBook.authorId)?.name ?? ""}
                book={recommendedBook}
                compact
                recommendation={recommendation}
                onPress={() => navigation.navigate("BookDetail", { bookId: recommendedBook.id })}
              />
            ))}
          </View>
        </>
      ) : null}

      <BookStatusSheet
        open={statusSheetOpen}
        currentStatus={book.userStatus.status}
        currentRating={book.userStatus.rating}
        onSave={(status, rating) => updateBookStatus(book.id, status, rating)}
        onClose={() => setStatusSheetOpen(false)}
      />
      <BookListSheet
        open={listSheetOpen}
        bookId={book.id}
        onClose={() => setListSheetOpen(false)}
      />
    </Screen>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    hero: {
      ...shadows.card,
      backgroundColor: c.navy,
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
      color: "#FFFFFF",
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
      color: c.gold,
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
      backgroundColor: c.navy,
      borderRadius: radii.pill,
      flex: 1,
      flexDirection: "row",
      justifyContent: "center",
      minWidth: 150,
      paddingVertical: 13
    },
    primaryActionText: {
      color: "#FFFFFF",
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900"
    },
    reviewAction: {
      alignItems: "center",
      backgroundColor: c.gold,
      borderRadius: radii.pill,
      flexDirection: "row",
      justifyContent: "center",
      minWidth: 150,
      paddingHorizontal: spacing.md,
      paddingVertical: 13
    },
    reviewActionText: {
      color: c.navy,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900"
    },
    secondaryAction: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      height: 46,
      justifyContent: "center",
      width: 46
    },
    progressCard: {
      backgroundColor: c.surface,
      borderColor: c.border,
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
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1,
      textTransform: "uppercase"
    },
    progressPct: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 18,
      fontWeight: "900"
    },
    progressTrack: {
      backgroundColor: c.border,
      borderRadius: radii.pill,
      height: 10,
      overflow: "hidden"
    },
    progressFill: {
      backgroundColor: c.teal,
      borderRadius: radii.pill,
      height: "100%"
    },
    progressMeta: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.xs
    },
    progressMetaText: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 11
    },
    statsStrip: {
      ...shadows.card,
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: "row",
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm
    },
    collectorSummary: {
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: "row",
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm
    },
    collectorSummaryItem: {
      alignItems: "center",
      flex: 1
    },
    collectorSummaryValue: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "900"
    },
    collectorSummaryLabel: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "900",
      marginTop: 2,
      textTransform: "uppercase"
    },
    collectorDivider: {
      backgroundColor: c.border,
      width: 1
    },
    statItem: {
      alignItems: "center",
      flex: 1
    },
    statVal: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 22,
      fontWeight: "900"
    },
    statLbl: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      marginTop: 2,
      textAlign: "center"
    },
    statDivider: {
      backgroundColor: c.border,
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
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      width: "47%"
    },
    infoChipLabel: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0.8,
      textTransform: "uppercase"
    },
    infoChipValue: {
      color: c.ink,
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
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: "row",
      paddingHorizontal: 10,
      paddingVertical: 5
    },
    tagBestseller: {
      backgroundColor: c.gold,
      borderColor: c.gold
    },
    tagSequel: {
      backgroundColor: c.teal,
      borderColor: c.teal
    },
    tagPillText: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900"
    },
    synopsis: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 23
    },
    synopsisToggle: {
      color: c.tealDark,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900",
      marginTop: spacing.xs
    },
    recommendationStack: {
      marginBottom: spacing.sm
    },
    reviewCard: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      marginBottom: spacing.md,
      padding: spacing.md
    },
    reviewStars: {
      alignItems: "center",
      flexDirection: "row",
      gap: 3,
      marginBottom: spacing.xs
    },
    reviewDate: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 11,
      marginLeft: "auto"
    },
    reviewTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 16,
      fontWeight: "900",
      marginBottom: 4
    },
    reviewBody: {
      color: c.ink,
      fontFamily: fonts.bodyRegular,
      fontSize: 13,
      lineHeight: 20
    },
    reviewEmpty: {
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderStyle: "dashed",
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      marginBottom: spacing.md,
      paddingVertical: spacing.md
    },
    reviewEmptyText: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800"
    }
  });
}
