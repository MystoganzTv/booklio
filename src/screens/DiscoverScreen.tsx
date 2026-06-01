/**
 * DiscoverScreen
 *
 * - Mood icons: real atmospheric photos (Unsplash, stable IDs)
 * - "Continue your saga": detects next unread book in each series
 * - Genre breakdown: real user data
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { MoodBooksSheet } from "../components/MoodBooksSheet";
import { CuratedListSheet, CuratedList } from "../components/CuratedListSheet";
import { BookCover } from "../components/BookCover";
import { useBookliz } from "../data/BooklizContext";
import { useI18n } from "../i18n/LocalizationContext";
import { RootStackParamList, MainTabParamList } from "../navigation/types";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";
import { Book } from "../types/models";

// ─── Mood data — gradient + Ionicons (fully controlled, works offline) ────────

type Mood = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  grad: [string, string];
};

const MOODS: Mood[] = [
  { id: "exciting",   label: "Exciting",            icon: "flash",              grad: ["#E65C00", "#F9D423"] },
  { id: "scary",      label: "Scary",               icon: "moon",               grad: ["#0D0D1A", "#1a0533"] },
  { id: "thought",    label: "Thought-provoking",   icon: "bulb-outline",       grad: ["#134E5E", "#71B280"] },
  { id: "inspiring",  label: "Inspiring",           icon: "sunny",              grad: ["#B34700", "#FFB347"] },
  { id: "heartfelt",  label: "Heartfelt",           icon: "heart",              grad: ["#833ab4", "#fd1d1d"] },
  { id: "dark",       label: "Dark & Grim",         icon: "thunderstorm",       grad: ["#0f0c29", "#302b63"] },
  { id: "feelgood",   label: "Feel-good",           icon: "happy",              grad: ["#1D976C", "#93F9B9"] },
  { id: "gripping",   label: "Emotionally gripping",icon: "musical-notes",      grad: ["#4B0082", "#8A2BE2"] },
  { id: "funny",      label: "Funny",               icon: "happy-outline",      grad: ["#FF512F", "#F09819"] },
  { id: "cozy",       label: "Cozy",                icon: "cafe",               grad: ["#6f4e37", "#c8a97e"] },
  { id: "fastpaced",  label: "Fast-paced",          icon: "speedometer",        grad: ["#8B0000", "#FF4500"] },
  { id: "epic",       label: "Epic",                icon: "shield",             grad: ["#1a1a2e", "#16213e"] },
];

// ─── Genre colour map ─────────────────────────────────────────────────────────

const GENRE_ACCENT: Record<string, { bg: string; text: string }> = {
  "Fantasy":            { bg: "#7F77DD22", text: "#534AB7" },
  "Science Fiction":    { bg: "#2196F322", text: "#0D6EFD" },
  "Sci-Fi":             { bg: "#2196F322", text: "#0D6EFD" },
  "Thriller":           { bg: "#FF7A5922", text: "#C0392B" },
  "Mystery":            { bg: "#9B59B622", text: "#7D3C98" },
  "Romance":            { bg: "#E91E6322", text: "#C2185B" },
  "Horror":             { bg: "#D32F2F22", text: "#B71C1C" },
  "Historical Fiction": { bg: "#FFC85722", text: "#856404" },
  "Historical":         { bg: "#FFC85722", text: "#856404" },
  "Biography":          { bg: "#14B8A622", text: "#0E9E93" },
  "Nonfiction":         { bg: "#14B8A622", text: "#0E9E93" },
  "Personal Growth":    { bg: "#7FB06922", text: "#3D6B30" },
  "Literary Fiction":   { bg: "#78909C22", text: "#37474F" },
};

function accentFor(genre: string) {
  return GENRE_ACCENT[genre] ?? { bg: "#14B8A622", text: "#0E9E93" };
}

// ─── "Continue your saga" logic ───────────────────────────────────────────────

type SagaRec = {
  seriesId: string;
  seriesName: string;
  /** Last book the user finished */
  lastRead: Book;
  /** Next book if it's already in the library */
  nextInLibrary: Book | null;
  /** What book number comes next */
  nextNumber: number;
  /** Cover to show (the next book or last read) */
  displayBook: Book;
};

function buildSagaRecs(books: Book[]): SagaRec[] {
  // Group by series
  const map: Record<string, Book[]> = {};
  for (const book of books) {
    if (!book.seriesId || !book.seriesName || book.seriesNumber == null) continue;
    if (!map[book.seriesId]) map[book.seriesId] = [];
    map[book.seriesId].push(book);
  }

  const recs: SagaRec[] = [];

  for (const [seriesId, seriesBooks] of Object.entries(map)) {
    const sorted = [...seriesBooks].sort((a, b) => (a.seriesNumber ?? 0) - (b.seriesNumber ?? 0));

    const readBooks = sorted.filter((b) => b.userStatus.status === "read");
    if (readBooks.length === 0) continue;               // hasn't read any — skip

    const lastRead = readBooks[readBooks.length - 1];
    const nextNumber = (lastRead.seriesNumber ?? 0) + 1;

    // Is the user already reading the next one?
    const alreadyReading = sorted.find((b) => b.userStatus.status === "reading");
    if (alreadyReading) continue;                       // already on it — skip

    // Is the next book in the library (unstarted)?
    const nextInLibrary = sorted.find(
      (b) => b.seriesNumber === nextNumber && b.userStatus.status !== "read"
    ) ?? null;

    // If the entire series the user owns is read — skip
    const unreadInLibrary = sorted.filter((b) => b.userStatus.status !== "read");
    if (!nextInLibrary && unreadInLibrary.length === 0) continue;

    recs.push({
      seriesId,
      seriesName: lastRead.seriesName!,
      lastRead,
      nextInLibrary,
      nextNumber,
      displayBook: nextInLibrary ?? lastRead,
    });
  }

  // Sort: series with next book in library first
  return recs
    .sort((a, b) => (b.nextInLibrary ? 1 : 0) - (a.nextInLibrary ? 1 : 0))
    .slice(0, 6);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function DiscoverScreen() {
  const c = useColors();
  const { t } = useI18n();
  const navigation = useNavigation<NavigationProp<RootStackParamList & MainTabParamList>>();
  const { books, overallStats } = useBookliz();
  const styles = useMemo(() => createStyles(c), [c]);

  const [activeMood, setActiveMood] = useState<typeof MOODS[number] | null>(null);
  const [activeList, setActiveList] = useState<CuratedList | null>(null);

  const sagaRecs      = useMemo(() => buildSagaRecs(books), [books]);
  const topGenres     = useMemo(() => overallStats.genreCounts.slice(0, 6), [overallStats.genreCounts]);
  const totalGenreBooks = useMemo(() => topGenres.reduce((s, g) => s + g.value, 0), [topGenres]);

  const recentlyRead  = useMemo(() =>
    books
      .filter((b) => b.userStatus.status === "read" && b.userStatus.finishDate)
      .sort((a, b) => (b.userStatus.finishDate ?? "").localeCompare(a.userStatus.finishDate ?? ""))
      .slice(0, 6),
    [books]
  );

  const curatedLists = useMemo((): CuratedList[] => {
    const unread = (b: Book) => b.userStatus.status !== "read" && b.userStatus.status !== "reading";
    const all: CuratedList[] = [
      {
        id: "quick-reads",
        title: "Quick reads",
        emoji: "⚡",
        description: "Under 300 pages — perfect for a weekend.",
        accentColor: "#14B8A6",
        books: books
          .filter((b) => b.pages > 0 && b.pages <= 300 && unread(b))
          .sort((a, b) => a.pages - b.pages),
      },
      {
        id: "top-rated",
        title: "Your top picks",
        emoji: "⭐",
        description: "Books you loved — 4 stars and above.",
        accentColor: "#FFC857",
        books: books
          .filter((b) => b.userStatus.status === "read" && (b.userStatus.rating ?? 0) >= 4)
          .sort((a, b) => (b.userStatus.rating ?? 0) - (a.userStatus.rating ?? 0)),
      },
      {
        id: "want-to-read",
        title: "Your TBR",
        emoji: "🔖",
        description: "Everything sitting on your to-be-read pile.",
        accentColor: "#FF7A59",
        books: books.filter((b) => b.userStatus.status === "want-to-read"),
      },
      {
        id: "series-starters",
        title: "Series starters",
        emoji: "🌱",
        description: "Book #1 of series you haven't started yet.",
        accentColor: "#7FB069",
        books: books.filter(
          (b) => b.seriesNumber === 1 && unread(b)
        ),
      },
      {
        id: "unread-sequels",
        title: "Continue the story",
        emoji: "📖",
        description: "Sequels in your library waiting to be read.",
        accentColor: "#8A2BE2",
        books: books.filter(
          (b) => (b.seriesNumber ?? 0) > 1 && unread(b)
        ).sort((a, b) => (a.seriesNumber ?? 0) - (b.seriesNumber ?? 0)),
      },
      {
        id: "dnf",
        title: "Second chances",
        emoji: "🔄",
        description: "Books you abandoned — maybe now is the time.",
        accentColor: "#E65C00",
        books: books.filter((b) => b.userStatus.status === "dnf"),
      },
      {
        id: "bestsellers",
        title: "Bestsellers",
        emoji: "🏆",
        description: "Popular titles you've added to your library.",
        accentColor: "#0D6EFD",
        books: books.filter((b) => b.isBestseller),
      },
    ];
    // Only show lists that have at least 1 book
    return all.filter((l) => l.books.length > 0);
  }, [books]);

  function goToSearch() { navigation.navigate("Add"); }

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("discover.title")}</Text>
        <Text style={styles.headerSub}>{t("discover.subtitle")}</Text>
      </View>

      {/* Search */}
      <Pressable style={styles.searchBar} onPress={goToSearch}>
        <Ionicons name="search-outline" size={18} color={c.muted} />
        <Text style={styles.searchPlaceholder}>{t("discover.searchPlaceholder")}</Text>
        <View style={styles.searchBadge}>
          <Text style={styles.searchBadgeText}>ISBN</Text>
        </View>
      </Pressable>

      {/* ══ CONTINUE YOUR SAGA ═══════════════════════════════════════════════ */}
      {sagaRecs.length > 0 && (
        <>
          <SectionHeader title="Continue your saga" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hScroll}
            contentContainerStyle={styles.hScrollContent}
          >
            {sagaRecs.map((rec) => (
              <Pressable
                key={rec.seriesId}
                style={styles.sagaCard}
                onPress={() => {
                  if (rec.nextInLibrary) {
                    navigation.navigate("BookDetail", { bookId: rec.nextInLibrary.id });
                  } else {
                    navigation.navigate("SeriesTracker", { seriesId: rec.seriesId });
                  }
                }}
              >
                {/* Cover */}
                <BookCover book={rec.displayBook} size="md" style={styles.sagaCover} />

                {/* Info */}
                <View style={styles.sagaInfo}>
                  <Text style={styles.sagaSeriesName} numberOfLines={1}>{rec.seriesName}</Text>

                  {rec.nextInLibrary ? (
                    <>
                      <Text style={styles.sagaNextLabel}>Up next</Text>
                      <Text style={styles.sagaBookTitle} numberOfLines={2}>{rec.nextInLibrary.title}</Text>
                      <Text style={styles.sagaBookNum}>Book {rec.nextNumber}</Text>
                      <View style={[styles.sagaBtn, { backgroundColor: c.teal }]}>
                        <Text style={styles.sagaBtnText}>Start reading</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.sagaNextLabel}>You finished Book {rec.lastRead.seriesNumber}</Text>
                      <Text style={styles.sagaBookTitle} numberOfLines={2}>
                        Book {rec.nextNumber} — not in library yet
                      </Text>
                      <View style={[styles.sagaBtn, { backgroundColor: c.gold }]}>
                        <Ionicons name="search-outline" size={13} color={c.navy} style={{ marginRight: 4 }} />
                        <Text style={[styles.sagaBtnText, { color: c.navy }]}>Find it</Text>
                      </View>
                    </>
                  )}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {/* ══ BROWSE BY GENRE ══════════════════════════════════════════════════ */}
      {topGenres.length > 0 && (
        <>
          <SectionHeader title="Browse by genre" />
          <View style={styles.genreGrid}>
            {topGenres.map((g) => {
              const accent = accentFor(g.label);
              return (
                <Pressable
                  key={g.label}
                  style={[styles.genreGridCard, { backgroundColor: accent.bg, borderColor: accent.text + "44" }]}
                  onPress={() => navigation.navigate("GenreBrowse", { genre: g.label })}
                >
                  <Text style={[styles.genreGridLabel, { color: accent.text }]}>{g.label}</Text>
                  <Text style={[styles.genreGridCount, { color: accent.text }]}>
                    {g.value} {g.value === 1 ? "book" : "books"}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={accent.text} style={{ opacity: 0.6 }} />
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* ══ RECENTLY FINISHED ════════════════════════════════════════════════ */}
      {recentlyRead.length > 0 && (
        <>
          <SectionHeader
            title="Recently finished"
            actionLabel="Library"
            onAction={() => navigation.navigate("Library")}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hScroll}
            contentContainerStyle={styles.hScrollContent}
          >
            {recentlyRead.map((book) => (
              <Pressable
                key={book.id}
                style={styles.bookThumb}
                onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}
              >
                <BookCover book={book} size="sm" />
                <Text numberOfLines={2} style={styles.bookThumbTitle}>{book.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {/* ══ CURATED LISTS ════════════════════════════════════════════════════ */}
      {curatedLists.length > 0 && (
        <>
          <SectionHeader title="Made for your shelf" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hScroll}
            contentContainerStyle={styles.hScrollContent}
          >
            {curatedLists.map((list) => (
              <Pressable
                key={list.id}
                style={[styles.curatedCard, { borderColor: list.accentColor + "44", backgroundColor: c.surface }]}
                onPress={() => setActiveList(list)}
              >
                <View style={[styles.curatedEmoji, { backgroundColor: list.accentColor + "18" }]}>
                  <Text style={styles.curatedEmojiText}>{list.emoji}</Text>
                </View>
                <Text style={[styles.curatedTitle, { color: c.ink }]} numberOfLines={1}>
                  {list.title}
                </Text>
                <Text style={[styles.curatedDesc, { color: c.muted }]} numberOfLines={2}>
                  {list.description}
                </Text>
                <View style={[styles.curatedCountRow]}>
                  <Text style={[styles.curatedCount, { color: list.accentColor }]}>
                    {list.books.length} {list.books.length === 1 ? "book" : "books"}
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color={list.accentColor} />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {/* ══ BROWSE BY MOOD — real photos ═════════════════════════════════════ */}
      <SectionHeader title={t("discover.byMood")} />
      <View style={styles.twoColGrid}>
        {MOODS.map((mood) => (
          <Pressable key={mood.id} style={styles.twoColItem} onPress={() => setActiveMood(mood)}>
            <LinearGradient
              colors={mood.grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.squareIcon}
            >
              <Ionicons name={mood.icon} size={32} color="rgba(255,255,255,0.92)" />
            </LinearGradient>
            <Text style={styles.twoColName}>{mood.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ══ AI COMING SOON ════════════════════════════════════════════════════ */}
      <View style={styles.comingSoonCard}>
        <View style={styles.comingSoonIconWrap}>
          <Ionicons name="sparkles" size={22} color={c.gold} />
        </View>
        <View style={styles.comingSoonCopy}>
          <Text style={styles.comingSoonTitle}>{t("discover.aiComingTitle")}</Text>
          <Text style={styles.comingSoonSub}>{t("discover.aiComingSub")}</Text>
        </View>
      </View>

      {/* ══ MOOD BOOKS SHEET ══════════════════════════════════════════════════ */}
      <MoodBooksSheet mood={activeMood} onClose={() => setActiveMood(null)} />

      {/* ══ CURATED LIST SHEET ════════════════════════════════════════════════ */}
      <CuratedListSheet list={activeList} onClose={() => setActiveList(null)} />
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    header: { marginBottom: spacing.md },
    headerTitle: { color: c.ink, fontFamily: fonts.display, fontSize: 28, fontWeight: "900" },
    headerSub: { color: c.muted, fontFamily: fonts.body, fontSize: 13, fontWeight: "700", marginTop: 3 },

    searchBar: {
      ...shadows.card,
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 13,
    },
    searchPlaceholder: { color: c.muted, flex: 1, fontFamily: fonts.body, fontSize: 14, fontWeight: "700" },
    searchBadge: { backgroundColor: c.surfaceAlt, borderColor: c.border, borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
    searchBadgeText: { color: c.muted, fontFamily: fonts.body, fontSize: 10, fontWeight: "900" },

    // ── Saga continuation cards ───────────────────────────────────────────
    hScroll: { marginHorizontal: -spacing.md, marginBottom: spacing.sm },
    hScrollContent: { gap: 12, paddingHorizontal: spacing.md, paddingBottom: 4 },

    sagaCard: {
      ...shadows.card,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.sm,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      padding: 12,
      width: 280,
    },
    sagaCover: {
      borderRadius: radii.sm,
      height: 120,
      width: 80,
    },
    sagaInfo: {
      flex: 1,
      justifyContent: "center",
    },
    sagaSeriesName: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.5,
      marginBottom: 4,
      textTransform: "uppercase",
    },
    sagaNextLabel: {
      color: c.teal,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      marginBottom: 3,
    },
    sagaBookTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 15,
      fontWeight: "900",
      lineHeight: 19,
    },
    sagaBookNum: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "700",
      marginBottom: 10,
      marginTop: 2,
    },
    sagaBtn: {
      alignItems: "center",
      alignSelf: "flex-start",
      borderRadius: radii.pill,
      flexDirection: "row",
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    sagaBtnText: {
      color: "#fff",
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
    },

    // ── Genre grid cards ──────────────────────────────────────────────────
    genreGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: spacing.sm,
    },
    genreGridCard: {
      alignItems: "center",
      borderRadius: radii.sm,
      borderWidth: 1,
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      width: "47%",
    },
    genreGridLabel: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900",
    },
    genreGridCount: {
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "800",
      opacity: 0.8,
    },

    // ── Recently read ─────────────────────────────────────────────────────
    bookThumb: { width: 80 },
    bookThumbTitle: { color: c.muted, fontFamily: fonts.body, fontSize: 10, fontWeight: "800", marginTop: 5, textAlign: "center" },

    // ── Curated list cards ────────────────────────────────────────────────
    curatedCard: {
      ...shadows.card,
      borderRadius: radii.sm,
      borderWidth: 1,
      padding: spacing.md,
      width: 160,
      gap: 6,
    },
    curatedEmoji: {
      alignItems: "center",
      borderRadius: 10,
      height: 40,
      justifyContent: "center",
      marginBottom: 2,
      width: 40,
    },
    curatedEmojiText: {
      fontSize: 20,
    },
    curatedTitle: {
      fontFamily: fonts.display,
      fontSize: 15,
      fontWeight: "900",
    },
    curatedDesc: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 16,
    },
    curatedCountRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 2,
      marginTop: 2,
    },
    curatedCount: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
    },

    // ── Mood grid — 2 cols, photo icon + label ────────────────────────────
    twoColGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginBottom: spacing.sm,
    },
    twoColItem: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      paddingVertical: 8,
      width: "50%",
    },
    squareIcon: {
      alignItems: "center",
      borderRadius: 14,
      height: 72,
      justifyContent: "center",
      overflow: "hidden",
      width: 72,
    },
    twoColName: {
      color: c.ink,
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 19,
    },

    // ── Coming soon ───────────────────────────────────────────────────────
    comingSoonCard: {
      ...shadows.card,
      alignItems: "flex-start",
      backgroundColor: c.surface,
      borderColor: c.gold + "55",
      borderRadius: radii.sm,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.lg,
      padding: spacing.md,
    },
    comingSoonIconWrap: { alignItems: "center", backgroundColor: c.gold + "22", borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
    comingSoonCopy: { flex: 1 },
    comingSoonTitle: { color: c.ink, fontFamily: fonts.body, fontSize: 14, fontWeight: "900" },
    comingSoonSub: { color: c.muted, fontFamily: fonts.body, fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 3 },
  });
}
