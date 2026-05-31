/**
 * DiscoverScreen
 *
 * Uses the app's real theme tokens — no hardcoded colours.
 * Everything that's tappable navigates somewhere real.
 * Items that aren't built yet are clearly marked "coming soon"
 * and don't show fake buttons.
 */
import { Ionicons } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { BookCover } from "../components/BookCover";
import { useBookliz } from "../data/BooklizContext";
import { useI18n } from "../i18n/LocalizationContext";
import { RootStackParamList, MainTabParamList } from "../navigation/types";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";

// ─── Static content ───────────────────────────────────────────────────────────

const MOODS = [
  { id: "epic",       label: "Epic",            icon: "⚡", desc: "Grand scale, high stakes" },
  { id: "cozy",       label: "Cozy",            icon: "☕", desc: "Safe, warm & comfortable" },
  { id: "dark",       label: "Dark & Grim",     icon: "🌑", desc: "Morally complex worlds" },
  { id: "inspiring",  label: "Inspiring",       icon: "🌟", desc: "Real or fictional triumph" },
  { id: "fastpaced",  label: "Fast-paced",      icon: "🔥", desc: "Can't put it down" },
  { id: "funny",      label: "Funny",           icon: "😄", desc: "Genuinely laugh-out-loud" },
  { id: "thought",    label: "Thought-provoking",icon: "🧠", desc: "Changes how you see the world" },
  { id: "comfy",      label: "Comfort read",    icon: "🛋", desc: "Like rereading an old favorite" },
] as const;

const GENRES = [
  { id: "Fantasy",    emoji: "🧙" },
  { id: "Sci-Fi",     emoji: "🚀" },
  { id: "Thriller",   emoji: "🔪" },
  { id: "Romance",    emoji: "💌" },
  { id: "Horror",     emoji: "👁" },
  { id: "Mystery",    emoji: "🕵" },
  { id: "Historical", emoji: "⚔️" },
  { id: "Biography",  emoji: "🙋" },
  { id: "Self-Dev",   emoji: "🧠" },
  { id: "Business",   emoji: "📈" },
] as const;

const FEATURED_AUTHORS = [
  { id: "Brandon Sanderson", initials: "BS", genre: "Epic Fantasy" },
  { id: "Sarah J. Maas",     initials: "SJ", genre: "Fantasy" },
  { id: "Pierce Brown",      initials: "PB", genre: "Sci-Fantasy" },
  { id: "Rebecca Yarros",    initials: "RY", genre: "Romantasy" },
  { id: "Joe Abercrombie",   initials: "JA", genre: "Grimdark" },
  { id: "Michael Connelly",  initials: "MC", genre: "Thriller" },
] as const;

const READING_GOALS = [
  { id: "investing",    label: "Learn investing",        emoji: "💰" },
  { id: "leadership",   label: "Become a better leader", emoji: "🎯" },
  { id: "productivity", label: "Be more productive",     emoji: "⚡" },
  { id: "business",     label: "Start a business",       emoji: "🚀" },
  { id: "psychology",   label: "Understand people",      emoji: "🧠" },
  { id: "history",      label: "Understand history",     emoji: "🌍" },
] as const;

// ─── Screen ───────────────────────────────────────────────────────────────────

export function DiscoverScreen() {
  const c = useColors();
  const { t } = useI18n();
  const navigation = useNavigation<NavigationProp<RootStackParamList & MainTabParamList>>();
  const { books, getAuthor } = useBookliz();
  const styles = useMemo(() => createStyles(c), [c]);

  // Books the user has read — show recently finished at the top
  const recentlyRead = books
    .filter((b) => b.userStatus.status === "read" && b.userStatus.finishDate)
    .sort((a, b) => (b.userStatus.finishDate ?? "").localeCompare(a.userStatus.finishDate ?? ""))
    .slice(0, 6);

  // Books currently reading
  const currentlyReading = books.filter((b) => b.userStatus.status === "reading");

  // Navigate to the Add/Search screen (the real search in this app)
  function goToSearch(prefill?: string) {
    navigation.navigate("Add");
  }

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("discover.title")}</Text>
        <Text style={styles.headerSub}>{t("discover.subtitle")}</Text>
      </View>

      {/* Search bar — navigates to real BookIntake */}
      <Pressable style={styles.searchBar} onPress={() => goToSearch()}>
        <Ionicons name="search-outline" size={18} color={c.muted} />
        <Text style={styles.searchPlaceholder}>{t("discover.searchPlaceholder")}</Text>
        <View style={styles.searchBadge}>
          <Text style={styles.searchBadgeText}>ISBN</Text>
        </View>
      </Pressable>

      {/* ── YOUR LIBRARY HIGHLIGHTS ───────────────────────────────────────── */}
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

      {/* ── BROWSE BY MOOD ────────────────────────────────────────────────── */}
      <SectionHeader title={t("discover.byMood")} />
      <View style={styles.moodGrid}>
        {MOODS.map((mood) => (
          <Pressable
            key={mood.id}
            style={styles.moodCard}
            onPress={() => goToSearch(mood.label)}
          >
            <Text style={styles.moodEmoji}>{mood.icon}</Text>
            <Text style={styles.moodLabel}>{mood.label}</Text>
            <Text style={styles.moodDesc}>{mood.desc}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── BROWSE BY GENRE ───────────────────────────────────────────────── */}
      <SectionHeader title={t("discover.byGenre")} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.hScroll}
        contentContainerStyle={styles.hScrollContent}
      >
        {GENRES.map((g) => (
          <Pressable
            key={g.id}
            style={styles.genrePill}
            onPress={() => goToSearch(g.id)}
          >
            <Text style={styles.genreEmoji}>{g.emoji}</Text>
            <Text style={styles.genreLabel}>{g.id}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── FEATURED AUTHORS ──────────────────────────────────────────────── */}
      <SectionHeader title={t("discover.featuredAuthors")} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.hScroll}
        contentContainerStyle={styles.hScrollContent}
      >
        {FEATURED_AUTHORS.map((author) => (
          <Pressable
            key={author.id}
            style={styles.authorChip}
            onPress={() => goToSearch(author.id)}
          >
            <View style={styles.authorAvatar}>
              <Text style={styles.authorInitials}>{author.initials}</Text>
            </View>
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{author.id}</Text>
              <Text style={styles.authorGenre}>{author.genre}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── READING GOALS ─────────────────────────────────────────────────── */}
      <SectionHeader title={t("discover.readingGoals")} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.hScroll}
        contentContainerStyle={styles.hScrollContent}
      >
        {READING_GOALS.map((goal) => (
          <Pressable
            key={goal.id}
            style={styles.goalChip}
            onPress={() => goToSearch(goal.label)}
          >
            <Text style={styles.goalEmoji}>{goal.emoji}</Text>
            <Text style={styles.goalLabel}>{goal.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── AI COMING SOON ────────────────────────────────────────────────── */}
      <View style={styles.comingSoonCard}>
        <View style={styles.comingSoonIconWrap}>
          <Ionicons name="sparkles" size={22} color={c.gold} />
        </View>
        <View style={styles.comingSoonCopy}>
          <Text style={styles.comingSoonTitle}>{t("discover.aiComingTitle")}</Text>
          <Text style={styles.comingSoonSub}>{t("discover.aiComingSub")}</Text>
        </View>
      </View>
    </Screen>
  );
}

// ─── Styles — all using theme tokens ─────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    // Header
    header: {
      marginBottom: spacing.md,
    },
    headerTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 28,
      fontWeight: "900",
    },
    headerSub: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 3,
    },

    // Search
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
    searchPlaceholder: {
      color: c.muted,
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
    },
    searchBadge: {
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: 6,
      borderWidth: 1,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    searchBadgeText: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "900",
    },

    // Horizontal scroll wrapper
    hScroll: {
      marginHorizontal: -spacing.md,
      marginBottom: spacing.sm,
    },
    hScrollContent: {
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: 4,
    },

    // Recently read book thumbs
    bookThumb: {
      width: 80,
    },
    bookThumbTitle: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "800",
      marginTop: 5,
      textAlign: "center",
    },

    // Mood grid — 2 columns, uses theme surface + border
    moodGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    moodCard: {
      ...shadows.card,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.sm,
      borderWidth: 1,
      padding: 14,
      width: "48.5%",
    },
    moodEmoji: {
      fontSize: 22,
      marginBottom: 6,
    },
    moodLabel: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 14,
      fontWeight: "800",
    },
    moodDesc: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 15,
      marginTop: 3,
    },

    // Genre pills
    genrePill: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: 7,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    genreEmoji: {
      fontSize: 16,
    },
    genreLabel: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
    },

    // Author chips
    authorChip: {
      ...shadows.card,
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      width: 185,
    },
    authorAvatar: {
      alignItems: "center",
      backgroundColor: c.teal + "22",
      borderRadius: 20,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    authorInitials: {
      color: c.tealDark,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900",
    },
    authorInfo: {
      flex: 1,
    },
    authorName: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
    },
    authorGenre: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 1,
    },

    // Goal chips
    goalChip: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: 7,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    goalEmoji: {
      fontSize: 16,
    },
    goalLabel: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
    },

    // Coming soon
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
    comingSoonIconWrap: {
      alignItems: "center",
      backgroundColor: c.gold + "22",
      borderRadius: 20,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    comingSoonCopy: {
      flex: 1,
    },
    comingSoonTitle: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900",
    },
    comingSoonSub: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 18,
      marginTop: 3,
    },
  });
}
