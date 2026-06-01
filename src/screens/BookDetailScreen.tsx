/**
 * BookDetailScreen — Premium redesign
 * Design: full-bleed cover hero + floating actions + immersive dark gradient
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookCover } from "../components/BookCover";
import { RecommendationCard } from "../components/RecommendationCard";
import { BookStatusSheet } from "../components/BookStatusSheet";
import { BookListSheet } from "../components/BookListSheet";
import { SessionRow } from "../components/SessionRow";
import { useBookliz } from "../data/BooklizContext";
import { useReadingTimer } from "../data/ReadingTimerContext";
import { RootStackParamList } from "../navigation/types";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useTheme } from "../theme/ThemeContext";
import { useI18n } from "../i18n/LocalizationContext";
import { formatStatusLabel } from "../utils/statusLabels";

function cleanGenres(raw: string[]): string[] {
  return raw
    .filter((g) => !/^nyt:/i.test(g))
    .filter((g) => !/new york times/i.test(g))
    .map((g) => g.replace(/\b\w/g, (ch) => ch.toUpperCase()).trim())
    .filter((g, i, arr) => arr.indexOf(g) === i)
    .slice(0, 4);
}

export function BookDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "BookDetail">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors: c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(c), [c]);

  const {
    getAuthor, getBook, getBookStats,
    getRecommendationsForBook, updateBookStatus, getReviewForBook,
  } = useBookliz();

  const { isRunning, bookId: timerBookId, start: startTimer, stop: stopTimer } = useReadingTimer();
  const book = getBook(route.params.bookId);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [listSheetOpen, setListSheetOpen] = useState(false);

  if (!book) {
    return (
      <View style={[styles.notFound, { paddingTop: insets.top + 16 }]}>
        <Ionicons name="book-outline" size={40} color={c.muted} />
        <Text style={styles.notFoundText}>Book not found.</Text>
      </View>
    );
  }

  const author = getAuthor(book.authorId);
  const stats = getBookStats(book.id);
  const review = getReviewForBook(route.params.bookId);
  const genres = cleanGenres(book.genre);
  const isReading = book.userStatus.status === "reading";
  const isDone = book.userStatus.status === "read";
  const hasSessions = stats.totalSessions > 0;
  const statusLabel = formatStatusLabel(book.userStatus.status);

  const relatedRecs = getRecommendationsForBook(book.id, 4)
    .map((rec) => ({ rec, recBook: getBook(rec.bookId) }))
    .filter((item): item is { rec: (typeof item)["rec"]; recBook: NonNullable<ReturnType<typeof getBook>> } =>
      Boolean(item.recBook)
    );

  const [gradTop, gradBot] = book.coverGradient;

  const HeroInner = (
    <LinearGradient
      colors={["transparent", "rgba(7,17,35,0.65)", "rgba(7,17,35,0.97)"]}
      style={styles.heroGradient}
    >
      {!book.coverImageUri ? (
        <BookCover book={book} size="lg" style={styles.heroCoverFloat} />
      ) : null}
      <Text numberOfLines={3} style={styles.heroTitle}>{book.title}</Text>
      <Text numberOfLines={1} style={styles.heroAuthor}>{author?.name}</Text>
      {book.seriesName ? (
        <Pressable
          onPress={() => book.seriesId && navigation.navigate("SeriesTracker", { seriesId: book.seriesId! })}
          style={styles.heroSeriesBtn}
        >
          <Ionicons name="layers-outline" size={12} color={c.teal} style={{ marginRight: 4 }} />
          <Text style={styles.heroSeries}>
            {book.seriesName}{book.seriesNumber ? ` · Book ${book.seriesNumber}` : ""}
          </Text>
        </Pressable>
      ) : null}
      <Pressable style={styles.heroStatusPill} onPress={() => setStatusSheetOpen(true)}>
        <View style={[styles.heroStatusDot, {
          backgroundColor:
            book.userStatus.status === "read" ? "#7FB069"
            : book.userStatus.status === "reading" ? "#14B8A6"
            : book.userStatus.status === "dnf" ? "#D95D47"
            : "#FFC857",
        }]} />
        <Text style={styles.heroStatusText}>{statusLabel}</Text>
        {book.userStatus.rating ? (
          <>
            <Text style={styles.heroStatusSep}>·</Text>
            <Ionicons name="star" size={11} color={c.gold} />
            <Text style={styles.heroRating}>{book.userStatus.rating}</Text>
          </>
        ) : null}
        <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.45)" style={{ marginLeft: 4 }} />
      </Pressable>
    </LinearGradient>
  );

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        {book.coverImageUri ? (
          <ImageBackground
            source={{ uri: book.coverImageUri }}
            style={[styles.hero, { paddingTop: insets.top + 52 }]}
            imageStyle={styles.heroImageStyle}
          >
            {HeroInner}
          </ImageBackground>
        ) : (
          <LinearGradient
            colors={[gradTop, gradBot, "rgba(7,17,35,0.97)"]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + 52 }]}
          >
            {HeroInner}
          </LinearGradient>
        )}

        {/* ── ACTION ROW ───────────────────────────────────────────────────── */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: c.teal }]}
            onPress={() => navigation.navigate("AddReadingSession", { bookId: book.id })}
          >
            <Ionicons name="pencil" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>{t("bookDetail.logSession")}</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate("WriteReview", { bookId: book.id })}>
            <Ionicons name={review ? "star" : "star-outline"} size={20} color={review ? c.gold : c.ink} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate("ReadingLog", { bookId: book.id })}>
            <Ionicons name="time-outline" size={20} color={c.ink} />
          </Pressable>
          {book.seriesId ? (
            <Pressable style={styles.iconBtn} onPress={() => navigation.navigate("SeriesTracker", { seriesId: book.seriesId! })}>
              <Ionicons name="layers-outline" size={20} color={c.ink} />
            </Pressable>
          ) : null}
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate("EditBook", { bookId: book.id })}>
            <Ionicons name="create-outline" size={20} color={c.ink} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => setListSheetOpen(true)}>
            <Ionicons name="bookmarks-outline" size={20} color={c.ink} />
          </Pressable>
          {/* Timer button — start or stop */}
          <Pressable
            style={[styles.iconBtn, isRunning && timerBookId === book.id && { backgroundColor: c.coral + "22", borderColor: c.coral }]}
            onPress={() => {
              if (isRunning && timerBookId === book.id) {
                const minutes = stopTimer();
                navigation.navigate("AddReadingSession", { bookId: book.id, prefillMinutes: minutes } as any);
              } else {
                startTimer(book.id);
              }
            }}
          >
            <Ionicons
              name={isRunning && timerBookId === book.id ? "stop-circle" : "timer-outline"}
              size={20}
              color={isRunning && timerBookId === book.id ? c.coral : c.ink}
            />
          </Pressable>
        </View>

        {/* ── PROGRESS ─────────────────────────────────────────────────────── */}
        {(isReading || isDone) ? (
          <View style={[styles.card, { marginTop: spacing.md }]}>
            <View style={styles.progressTopRow}>
              <Text style={styles.eyebrow}>{isReading ? "Reading now" : "Completed"}</Text>
              <Text style={[styles.progressPct, { color: isReading ? c.teal : c.green }]}>
                {book.userStatus.progressPercent}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, {
                width: `${book.userStatus.progressPercent}%`,
                backgroundColor: isReading ? c.teal : c.green,
              }]} />
            </View>
            <View style={styles.progressDates}>
              {book.userStatus.startDate ? <Text style={styles.mutedSm}>Started {book.userStatus.startDate}</Text> : null}
              {book.userStatus.finishDate ? <Text style={styles.mutedSm}>Finished {book.userStatus.finishDate}</Text> : null}
            </View>
          </View>
        ) : null}

        {/* ── STATS ────────────────────────────────────────────────────────── */}
        {hasSessions ? (
          <View style={[styles.statsStrip, { marginTop: spacing.sm }]}>
            <StatBox label={t("bookDetail.statSessions")} value={String(stats.totalSessions)} accent={c.teal} styles={styles} />
            <View style={styles.statDivider} />
            <StatBox label={t("bookDetail.statPagesLogged")} value={String(stats.totalPages)} accent={c.gold} styles={styles} />
            <View style={styles.statDivider} />
            <StatBox label={t("bookDetail.statPpH")} value={String(stats.averageSpeed)} accent={c.coral} styles={styles} />
            <View style={styles.statDivider} />
            <StatBox label="Times read" value={String(book.userStatus.readCount ?? 0)} accent={c.green} styles={styles} />
          </View>
        ) : null}

        {/* ── COLLECTOR ROW ────────────────────────────────────────────────── */}
        <View style={[styles.collectorRow, { marginTop: spacing.sm }]}>
          <CollectorChip icon="trophy-outline" label="Rank" value={book.userStatus.personalRanking ? `#${book.userStatus.personalRanking}` : "—"} styles={styles} c={c} />
          <CollectorChip icon="chatbubble-ellipses-outline" label="Quotes" value={String(book.userStatus.favoriteQuotes.length)} styles={styles} c={c} />
          <CollectorChip icon="pricetag-outline" label="Format" value={book.format} styles={styles} c={c} />
          {book.pages ? <CollectorChip icon="document-text-outline" label="Pages" value={String(book.pages)} styles={styles} c={c} /> : null}
        </View>

        {/* ── SYNOPSIS ─────────────────────────────────────────────────────── */}
        {book.synopsis ? (
          <View style={[styles.card, { marginTop: spacing.md }]}>
            <Text style={styles.eyebrow}>Synopsis</Text>
            <Pressable onPress={() => setSynopsisExpanded((v) => !v)}>
              <Text style={styles.synopsisText} numberOfLines={synopsisExpanded ? undefined : 4}>
                {book.synopsis}
              </Text>
              <Text style={styles.synopsisToggle}>{synopsisExpanded ? "Show less ↑" : "Read more ↓"}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── GENRE / META CHIPS ───────────────────────────────────────────── */}
        <View style={[styles.metaChipRow, { marginTop: spacing.sm }]}>
          {genres.map((g) => (
            <View key={g} style={[styles.metaChip, { backgroundColor: c.teal + "22", borderColor: c.teal + "44" }]}>
              <Text style={[styles.metaChipText, { color: c.teal }]}>{g}</Text>
            </View>
          ))}
          {book.publishedDate ? (
            <View style={styles.metaChip}><Text style={styles.metaChipText}>{book.publishedDate.slice(0, 4)}</Text></View>
          ) : null}
          {book.isBestseller ? (
            <View style={[styles.metaChip, { backgroundColor: c.gold + "22", borderColor: c.gold + "55" }]}>
              <Ionicons name="star" size={10} color={c.gold} style={{ marginRight: 3 }} />
              <Text style={[styles.metaChipText, { color: c.gold }]}>Bestseller</Text>
            </View>
          ) : null}
          {book.tags?.map((tag) => (
            <View key={tag} style={styles.metaChip}><Text style={styles.metaChipText}>{tag}</Text></View>
          ))}
        </View>

        {/* ── REVIEW ───────────────────────────────────────────────────────── */}
        <View style={[styles.sectionBlock, { marginTop: spacing.lg }]}>
          <View style={styles.sectionBlockHeader}>
            <Text style={styles.sectionTitle}>Your review</Text>
            <Pressable onPress={() => navigation.navigate("WriteReview", { bookId: book.id })}>
              <Text style={styles.sectionAction}>{review ? "Edit" : "Write"}</Text>
            </Pressable>
          </View>
          {review ? (
            <Pressable style={styles.card} onPress={() => navigation.navigate("WriteReview", { bookId: book.id })}>
              <View style={styles.reviewStars}>
                {[1,2,3,4,5].map((n) => (
                  <Ionicons key={n} name={n <= review.rating ? "star" : "star-outline"} size={16} color={n <= review.rating ? c.gold : c.border} />
                ))}
                <Text style={[styles.mutedSm, { marginLeft: spacing.sm }]}>{review.createdAt}</Text>
              </View>
              {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
              {review.body ? <Text style={styles.reviewBody} numberOfLines={4}>{review.body}</Text> : null}
            </Pressable>
          ) : (
            <Pressable style={styles.reviewEmpty} onPress={() => navigation.navigate("WriteReview", { bookId: book.id })}>
              <Ionicons name="create-outline" size={22} color={c.muted} />
              <Text style={styles.reviewEmptyText}>No review yet — tap to write one</Text>
            </Pressable>
          )}
        </View>

        {/* ── SESSIONS ─────────────────────────────────────────────────────── */}
        {hasSessions ? (
          <View style={[styles.sectionBlock, { marginTop: spacing.lg }]}>
            <View style={styles.sectionBlockHeader}>
              <Text style={styles.sectionTitle}>Reading sessions</Text>
              <Pressable onPress={() => navigation.navigate("ReadingLog", { bookId: book.id })}>
                <Text style={styles.sectionAction}>All</Text>
              </Pressable>
            </View>
            {stats.latestSessions.slice(0, 3).map((session) => (
              <SessionRow
                key={session.id}
                bookTitle={book.title}
                session={session}
                onPress={() => navigation.navigate("AddReadingSession", { bookId: book.id, sessionId: session.id })}
              />
            ))}
          </View>
        ) : null}

        {/* ── NOTES ────────────────────────────────────────────────────────── */}
        {book.userStatus.notes ? (
          <View style={[styles.sectionBlock, { marginTop: spacing.lg }]}>
            <View style={styles.sectionBlockHeader}>
              <Text style={styles.sectionTitle}>Your notes</Text>
              <Pressable onPress={() => navigation.navigate("EditBook", { bookId: book.id })}>
                <Text style={styles.sectionAction}>Edit</Text>
              </Pressable>
            </View>
            <View style={styles.card}>
              <Text style={styles.notesText}>{book.userStatus.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* ── QUOTES ───────────────────────────────────────────────────────── */}
        {book.userStatus.favoriteQuotes.length > 0 ? (
          <View style={[styles.sectionBlock, { marginTop: spacing.lg }]}>
            <View style={styles.sectionBlockHeader}>
              <Text style={styles.sectionTitle}>Favourite quotes</Text>
              <Pressable onPress={() => navigation.navigate("EditBook", { bookId: book.id })}>
                <Text style={styles.sectionAction}>Edit</Text>
              </Pressable>
            </View>
            <View style={{ gap: spacing.sm }}>
              {book.userStatus.favoriteQuotes.map((quote, i) => (
                <View key={i} style={styles.quoteCard}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={c.gold} style={styles.quoteIcon} />
                  <Text style={styles.quoteText}>{quote}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── SIMILAR BOOKS ────────────────────────────────────────────────── */}
        {relatedRecs.length > 0 ? (
          <View style={[styles.sectionBlock, { marginTop: spacing.lg }]}>
            <Text style={styles.sectionTitle}>Keep this shelf moving</Text>
            <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
              {relatedRecs.map(({ rec, recBook }) => (
                <RecommendationCard
                  key={rec.id}
                  authorName={getAuthor(recBook.authorId)?.name ?? ""}
                  book={recBook}
                  compact
                  recommendation={rec}
                  onPress={() => navigation.navigate("BookDetail", { bookId: recBook.id })}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <BookStatusSheet
        open={statusSheetOpen}
        currentStatus={book.userStatus.status}
        currentRating={book.userStatus.rating}
        onSave={(status, rating) => updateBookStatus(book.id, status, rating)}
        onClose={() => setStatusSheetOpen(false)}
      />
      <BookListSheet open={listSheetOpen} bookId={book.id} onClose={() => setListSheetOpen(false)} />
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({ label, value, accent, styles }: { label: string; value: string; accent: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statVal, { color: accent }]}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

function CollectorChip({ icon, label, value, styles, c }: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string; value: string;
  styles: ReturnType<typeof createStyles>; c: AppColors;
}) {
  return (
    <View style={styles.collectorChip}>
      <Ionicons name={icon} size={18} color={c.muted} />
      <Text style={styles.collectorChipValue}>{value}</Text>
      <Text style={styles.collectorChipLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    root: { backgroundColor: c.bg, flex: 1 },
    scroll: { flex: 1 },
    notFound: { alignItems: "center", flex: 1, gap: 12, justifyContent: "center" },
    notFoundText: { color: c.muted, fontFamily: fonts.body, fontSize: 16 },

    // Hero
    hero: { justifyContent: "flex-end", minHeight: 420 },
    heroImageStyle: { resizeMode: "cover" },
    heroGradient: { paddingBottom: spacing.lg, paddingHorizontal: spacing.md, paddingTop: 80 },
    heroCoverFloat: { alignSelf: "center", marginBottom: spacing.lg },
    heroTitle: {
      color: "#FFFFFF", fontFamily: fonts.display, fontSize: 30, fontWeight: "900", lineHeight: 35,
      textShadowColor: "rgba(7,17,35,0.5)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12,
    },
    heroAuthor: { color: "rgba(255,255,255,0.72)", fontFamily: fonts.body, fontSize: 15, fontWeight: "700", marginTop: 5 },
    heroSeriesBtn: { alignItems: "center", flexDirection: "row", marginTop: 8 },
    heroSeries: { color: c.teal, fontFamily: fonts.body, fontSize: 13, fontWeight: "800" },
    heroStatusPill: {
      alignItems: "center", alignSelf: "flex-start",
      backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.20)",
      borderRadius: radii.pill, borderWidth: 1, flexDirection: "row",
      gap: 5, marginTop: spacing.md, paddingHorizontal: 12, paddingVertical: 7,
    },
    heroStatusDot: { borderRadius: 4, height: 8, width: 8 },
    heroStatusText: { color: "#FFFFFF", fontFamily: fonts.body, fontSize: 12, fontWeight: "900" },
    heroStatusSep: { color: "rgba(255,255,255,0.4)", fontFamily: fonts.body, fontSize: 12 },
    heroRating: { color: c.gold, fontFamily: fonts.body, fontSize: 12, fontWeight: "900" },

    // Action row
    actionRow: {
      alignItems: "center", backgroundColor: c.surface, borderBottomColor: c.border,
      borderBottomWidth: 1, flexDirection: "row", gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    primaryBtn: {
      alignItems: "center", borderRadius: radii.pill, flex: 1,
      flexDirection: "row", gap: 7, justifyContent: "center", paddingVertical: 10,
    },
    primaryBtnText: { color: "#FFFFFF", fontFamily: fonts.body, fontSize: 14, fontWeight: "900" },
    iconBtn: {
      ...shadows.card, alignItems: "center", backgroundColor: c.surface,
      borderColor: c.border, borderRadius: radii.sm, borderWidth: 1,
      height: 40, justifyContent: "center", width: 40,
    },

    // Shared card
    card: {
      ...shadows.card, backgroundColor: c.surface, borderColor: c.border,
      borderRadius: radii.sm, borderWidth: 1, marginHorizontal: spacing.md, padding: spacing.md,
    },
    eyebrow: {
      color: c.muted, fontFamily: fonts.body, fontSize: 11, fontWeight: "900",
      letterSpacing: 0.8, marginBottom: spacing.sm, textTransform: "uppercase",
    },

    // Progress
    progressTopRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
    progressPct: { fontFamily: fonts.display, fontSize: 20, fontWeight: "900" },
    progressTrack: { backgroundColor: c.border, borderRadius: radii.pill, height: 8, marginTop: spacing.sm, overflow: "hidden" },
    progressFill: { borderRadius: radii.pill, height: "100%" },
    progressDates: { flexDirection: "row", gap: spacing.md, marginTop: 8 },

    // Stats
    statsStrip: {
      ...shadows.card, alignItems: "center", backgroundColor: c.surface, borderColor: c.border,
      borderRadius: radii.sm, borderWidth: 1, flexDirection: "row",
      marginHorizontal: spacing.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    },
    statItem: { alignItems: "center", flex: 1, gap: 2 },
    statVal: { fontFamily: fonts.display, fontSize: 20, fontWeight: "900" },
    statLbl: { color: c.muted, fontFamily: fonts.body, fontSize: 10, fontWeight: "800", textAlign: "center" },
    statDivider: { backgroundColor: c.border, height: 28, width: 1 },

    // Collector
    collectorRow: { flexDirection: "row", gap: spacing.sm, marginHorizontal: spacing.md },
    collectorChip: {
      alignItems: "center", backgroundColor: c.surface, borderColor: c.border,
      borderRadius: radii.sm, borderWidth: 1, flex: 1, gap: 3, paddingVertical: 10,
    },
    collectorChipValue: { color: c.ink, fontFamily: fonts.display, fontSize: 14, fontWeight: "900" },
    collectorChipLabel: { color: c.muted, fontFamily: fonts.body, fontSize: 9, fontWeight: "800", textTransform: "uppercase" },

    // Synopsis
    synopsisText: { color: c.ink, fontFamily: fonts.bodyRegular, fontSize: 14, lineHeight: 22 },
    synopsisToggle: { color: c.teal, fontFamily: fonts.body, fontSize: 12, fontWeight: "800", marginTop: 8 },

    // Meta chips
    metaChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginHorizontal: spacing.md },
    metaChip: {
      alignItems: "center", backgroundColor: c.surfaceAlt, borderColor: c.border,
      borderRadius: radii.pill, borderWidth: 1, flexDirection: "row",
      paddingHorizontal: 12, paddingVertical: 5,
    },
    metaChipText: { color: c.muted, fontFamily: fonts.body, fontSize: 12, fontWeight: "800" },

    // Section
    sectionBlock: { marginHorizontal: spacing.md },
    sectionBlockHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
    sectionTitle: { color: c.ink, fontFamily: fonts.display, fontSize: 20, fontWeight: "900" },
    sectionAction: { color: c.gold, fontFamily: fonts.body, fontSize: 13, fontWeight: "800" },

    // Review
    reviewStars: { alignItems: "center", flexDirection: "row", gap: 3, marginBottom: spacing.sm },
    reviewTitle: { color: c.ink, fontFamily: fonts.display, fontSize: 16, fontWeight: "800", lineHeight: 21 },
    reviewBody: { color: c.muted, fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 20, marginTop: 6 },
    reviewEmpty: {
      alignItems: "center", backgroundColor: c.surface, borderColor: c.border,
      borderRadius: radii.sm, borderStyle: "dashed", borderWidth: 1,
      flexDirection: "row", gap: spacing.sm, padding: spacing.md,
    },
    reviewEmptyText: { color: c.muted, fontFamily: fonts.body, fontSize: 13, fontWeight: "800" },

    // Shared small text
    mutedSm: { color: c.muted, fontFamily: fonts.body, fontSize: 11, fontWeight: "700" },
    notesText: { color: c.ink, fontFamily: fonts.bodyRegular, fontSize: 14, lineHeight: 22 },
    quoteCard: {
      ...shadows.card,
      backgroundColor: c.surface,
      borderColor: c.gold + "44",
      borderLeftColor: c.gold,
      borderLeftWidth: 3,
      borderRadius: radii.sm,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
    },
    quoteIcon: { marginTop: 2 },
    quoteText: { color: c.ink, flex: 1, fontFamily: fonts.bodyRegular, fontSize: 14, fontStyle: "italic", lineHeight: 22 },
  });
}
