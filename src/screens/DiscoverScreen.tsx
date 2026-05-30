import { Ionicons } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { useBookliz } from "../data/BooklizContext";
import { useI18n } from "../i18n/LocalizationContext";
import { RootStackParamList, MainTabParamList } from "../navigation/types";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";

// ─── Static data ─────────────────────────────────────────────────────────────

type Mood = {
  id: string;
  label: string;
  description: string;
  bg: string;
  textColor: string;
  accent: string;
};

const MOODS: Mood[] = [
  { id: "epic",        label: "Epic",            description: "Grand scale, high stakes",     bg: "#1A1040", textColor: "#C8C0FF", accent: "#7F77DD" },
  { id: "cozy",        label: "Cozy",            description: "Safe, warm & comfortable",     bg: "#2C1A00", textColor: "#FFD490", accent: "#FFC857" },
  { id: "dark",        label: "Dark & Grim",     description: "Morally complex worlds",       bg: "#1A0808", textColor: "#FF9E9E", accent: "#FF7A59" },
  { id: "inspiring",   label: "Inspiring",       description: "Real or fictional triumph",    bg: "#001E18", textColor: "#5DCAA5", accent: "#14B8A6" },
  { id: "funny",       label: "Funny",           description: "Genuinely laugh-out-loud",     bg: "#1F1A00", textColor: "#FFE066", accent: "#FFC857" },
  { id: "fastpaced",   label: "Fast-paced",      description: "Can't put it down",            bg: "#1F0000", textColor: "#FF8080", accent: "#FF7A59" },
  { id: "thoughtprov", label: "Thought-provoking",description: "Changes how you see the world",bg: "#001A2C", textColor: "#80CAFF", accent: "#2196F3" },
  { id: "comfy",       label: "Comfort read",    description: "Like an old favorite",         bg: "#1A1200", textColor: "#D4A96A", accent: "#FFC857" },
];

type GenrePill = { id: string; label: string; emoji: string; bg: string; textColor: string };

const GENRES: GenrePill[] = [
  { id: "fantasy",    label: "Fantasy",          emoji: "🧙",  bg: "#2A1A4A", textColor: "#C8C0FF" },
  { id: "scifi",      label: "Sci-Fi",           emoji: "🚀",  bg: "#0A1A2E", textColor: "#80CAFF" },
  { id: "thriller",   label: "Thriller",         emoji: "🔪",  bg: "#1A0A0A", textColor: "#FF9E9E" },
  { id: "romance",    label: "Romance",          emoji: "💌",  bg: "#2A0A1A", textColor: "#FFB3D1" },
  { id: "horror",     label: "Horror",           emoji: "👁",  bg: "#1A0000", textColor: "#FF6B6B" },
  { id: "mystery",    label: "Mystery",          emoji: "🕵",  bg: "#0A0A1A", textColor: "#B3B3FF" },
  { id: "historical", label: "Historical",       emoji: "⚔️",  bg: "#1A1200", textColor: "#D4A96A" },
  { id: "biography",  label: "Biography",        emoji: "🙋",  bg: "#001A0A", textColor: "#5DCAA5" },
  { id: "selfdev",    label: "Self-Dev",         emoji: "🧠",  bg: "#001A10", textColor: "#5DCAA5" },
  { id: "business",   label: "Business",         emoji: "📈",  bg: "#001220", textColor: "#80CAFF" },
];

type SeriesItem = {
  id: string;
  name: string;
  author: string;
  bookCount: number;
  status: "complete" | "ongoing";
  gradientTop: string;
  gradientBottom: string;
  emoji: string;
};

const POPULAR_SERIES: SeriesItem[] = [
  { id: "stormlight",  name: "Stormlight Archive",   author: "Brandon Sanderson", bookCount: 5,  status: "ongoing",  gradientTop: "#3C3489", gradientBottom: "#7F77DD", emoji: "⚡" },
  { id: "mistborn",    name: "Mistborn Era 1",        author: "Brandon Sanderson", bookCount: 3,  status: "complete", gradientTop: "#085041", gradientBottom: "#1D9E75", emoji: "🌫" },
  { id: "redrisingsg", name: "Red Rising",            author: "Pierce Brown",      bookCount: 6,  status: "ongoing",  gradientTop: "#7A1A00", gradientBottom: "#FF7A59", emoji: "🌅" },
  { id: "acotar",      name: "ACOTAR",                author: "Sarah J. Maas",     bookCount: 5,  status: "complete", gradientTop: "#4A1528", gradientBottom: "#D4537E", emoji: "🌹" },
  { id: "empyrean",    name: "The Empyrean",          author: "Rebecca Yarros",    bookCount: 2,  status: "ongoing",  gradientTop: "#1A0A2E", gradientBottom: "#6B3FA0", emoji: "🐉" },
  { id: "dune",        name: "Dune Saga",             author: "Frank Herbert",     bookCount: 6,  status: "complete", gradientTop: "#2C1A00", gradientBottom: "#C08030", emoji: "🏜" },
  { id: "nameofwind",  name: "Kingkiller Chronicle",  author: "Patrick Rothfuss",  bookCount: 2,  status: "ongoing",  gradientTop: "#1A0A0A", gradientBottom: "#8B3A3A", emoji: "🎶" },
  { id: "expanse",     name: "The Expanse",           author: "James S.A. Corey",  bookCount: 9,  status: "complete", gradientTop: "#0A1520", gradientBottom: "#1E6A9E", emoji: "🪐" },
];

type AuthorItem = {
  id: string;
  name: string;
  initials: string;
  genre: string;
  accentBg: string;
  accentText: string;
};

const FEATURED_AUTHORS: AuthorItem[] = [
  { id: "sanderson", name: "Brandon Sanderson", initials: "BS", genre: "Epic Fantasy",   accentBg: "#2A1A4A", accentText: "#C8C0FF" },
  { id: "maas",      name: "Sarah J. Maas",     initials: "SJ", genre: "Fantasy",        accentBg: "#2A0A1A", accentText: "#FFB3D1" },
  { id: "brown",     name: "Pierce Brown",      initials: "PB", genre: "Sci-Fantasy",    accentBg: "#1F0A00", accentText: "#FFA070" },
  { id: "yarros",    name: "Rebecca Yarros",    initials: "RY", genre: "Romantasy",      accentBg: "#1A0A2E", accentText: "#C89AFF" },
  { id: "abercrombie",name: "Joe Abercrombie",  initials: "JA", genre: "Grimdark",       accentBg: "#1A0808", accentText: "#FF9E9E" },
  { id: "connelly",  name: "Michael Connelly",  initials: "MC", genre: "Thriller",       accentBg: "#0A0A1A", accentText: "#B3B3FF" },
];

type ReadingGoal = { id: string; label: string; emoji: string };

const READING_GOALS: ReadingGoal[] = [
  { id: "investing",      label: "Learn investing",        emoji: "💰" },
  { id: "leadership",     label: "Become a better leader", emoji: "🎯" },
  { id: "productivity",   label: "Be more productive",     emoji: "⚡" },
  { id: "startabusiness", label: "Start a business",       emoji: "🚀" },
  { id: "psychology",     label: "Understand people",      emoji: "🧠" },
  { id: "history",        label: "Understand history",     emoji: "🌍" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function DiscoverScreen() {
  const c = useColors();
  const { t } = useI18n();
  const navigation = useNavigation<NavigationProp<RootStackParamList & MainTabParamList>>();
  const { books } = useBookliz();
  const styles = useMemo(() => createStyles(c), [c]);

  // Books the user has read — used for "Because you loved X"
  const readBooks = books.filter(
    (b) => b.userStatus.status === "read" && b.userStatus.rating && b.userStatus.rating >= 4
  );
  const topRatedBook = readBooks.sort((a, b) => (b.userStatus.rating ?? 0) - (a.userStatus.rating ?? 0))[0];

  function handleSearchPress() {
    // Navigate to BookIntake which has search built in
    navigation.navigate("Add");
  }

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("discover.title")}</Text>
        <Text style={styles.headerSub}>{t("discover.subtitle")}</Text>
      </View>

      {/* Search bar */}
      <Pressable style={styles.searchBar} onPress={handleSearchPress}>
        <Ionicons name="search-outline" size={18} color={c.muted} />
        <Text style={styles.searchPlaceholder}>{t("discover.searchPlaceholder")}</Text>
        <View style={styles.searchKbd}>
          <Text style={styles.searchKbdText}>ISBN</Text>
        </View>
      </Pressable>

      {/* Mood browser */}
      <SectionHeader title={t("discover.byMood")} />
      <View style={styles.moodGrid}>
        {MOODS.map((mood) => (
          <MoodCard key={mood.id} mood={mood} styles={styles} />
        ))}
      </View>

      {/* Genre pills */}
      <SectionHeader title={t("discover.byGenre")} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScroll}
        contentContainerStyle={styles.pillScrollContent}
      >
        {GENRES.map((genre) => (
          <Pressable key={genre.id} style={[styles.genrePill, { backgroundColor: genre.bg }]}>
            <Text style={styles.genrePillEmoji}>{genre.emoji}</Text>
            <Text style={[styles.genrePillLabel, { color: genre.textColor }]}>{genre.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Popular series */}
      <SectionHeader title={t("discover.popularSeries")} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScroll}
        contentContainerStyle={[styles.pillScrollContent, { paddingBottom: spacing.sm }]}
      >
        {POPULAR_SERIES.map((series) => (
          <SeriesCard key={series.id} series={series} styles={styles} c={c} />
        ))}
      </ScrollView>

      {/* Reading goals */}
      <SectionHeader title={t("discover.readingGoals")} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScroll}
        contentContainerStyle={styles.pillScrollContent}
      >
        {READING_GOALS.map((goal) => (
          <Pressable key={goal.id} style={styles.goalChip}>
            <Text style={styles.goalEmoji}>{goal.emoji}</Text>
            <Text style={[styles.genrePillLabel, { color: c.ink }]}>{goal.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Featured authors */}
      <SectionHeader title={t("discover.featuredAuthors")} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScroll}
        contentContainerStyle={[styles.pillScrollContent, { paddingBottom: spacing.sm }]}
      >
        {FEATURED_AUTHORS.map((author) => (
          <AuthorChip key={author.id} author={author} styles={styles} c={c} />
        ))}
      </ScrollView>

      {/* Coming soon banner */}
      <View style={styles.comingSoonBanner}>
        <Ionicons name="sparkles" size={20} color={c.gold} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.comingSoonTitle}>{t("discover.aiComingTitle")}</Text>
          <Text style={styles.comingSoonSub}>{t("discover.aiComingSub")}</Text>
        </View>
      </View>
    </Screen>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MoodCard({ mood, styles }: { mood: Mood; styles: ReturnType<typeof createStyles> }) {
  return (
    <Pressable style={[styles.moodCard, { backgroundColor: mood.bg }]}>
      <Text style={[styles.moodLabel, { color: mood.textColor }]}>{mood.label}</Text>
      <Text style={[styles.moodDesc, { color: mood.accent }]}>{mood.description}</Text>
      <View style={[styles.moodAccentDot, { backgroundColor: mood.accent }]} />
    </Pressable>
  );
}

function SeriesCard({
  series,
  styles,
  c,
}: {
  series: SeriesItem;
  styles: ReturnType<typeof createStyles>;
  c: AppColors;
}) {
  return (
    <Pressable style={styles.seriesCard}>
      {/* Art */}
      <View style={[styles.seriesArt, { backgroundColor: series.gradientTop }]}>
        <Text style={styles.seriesEmoji}>{series.emoji}</Text>
        <View style={[styles.seriesArtBottom, { backgroundColor: series.gradientBottom + "55" }]} />
      </View>
      {/* Info */}
      <View style={[styles.seriesInfo, { backgroundColor: c.surface }]}>
        <Text style={styles.seriesName} numberOfLines={2}>{series.name}</Text>
        <Text style={styles.seriesAuthor} numberOfLines={1}>{series.author}</Text>
        <View style={styles.seriesMeta}>
          <Text style={styles.seriesMetaText}>{series.bookCount} books</Text>
          <View style={[styles.seriesStatusDot, { backgroundColor: series.status === "complete" ? "#14B8A6" : "#FFC857" }]} />
          <Text style={[styles.seriesMetaText, { color: series.status === "complete" ? "#14B8A6" : "#FFC857" }]}>
            {series.status === "complete" ? "Complete" : "Ongoing"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function AuthorChip({
  author,
  styles,
  c,
}: {
  author: AuthorItem;
  styles: ReturnType<typeof createStyles>;
  c: AppColors;
}) {
  return (
    <Pressable style={[styles.authorChip, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[styles.authorAvatar, { backgroundColor: author.accentBg }]}>
        <Text style={[styles.authorInitials, { color: author.accentText }]}>{author.initials}</Text>
      </View>
      <View style={styles.authorInfo}>
        <Text style={[styles.authorName, { color: c.ink }]}>{author.name}</Text>
        <Text style={[styles.authorGenre, { color: c.muted }]}>{author.genre}</Text>
      </View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    header: {
      marginBottom: spacing.md,
    },
    headerTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 28,
      fontWeight: "900",
      lineHeight: 32,
    },
    headerSub: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 4,
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
    searchKbd: {
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: 6,
      borderWidth: 1,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    searchKbdText: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "900",
    },

    // Mood grid — 2 columns
    moodGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: spacing.sm,
    },
    moodCard: {
      borderRadius: radii.sm,
      justifyContent: "space-between",
      minHeight: 90,
      overflow: "hidden",
      padding: 14,
      width: "48%",
    },
    moodLabel: {
      fontFamily: fonts.display,
      fontSize: 16,
      fontWeight: "800",
      lineHeight: 20,
    },
    moodDesc: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 3,
      opacity: 0.85,
    },
    moodAccentDot: {
      borderRadius: 4,
      bottom: 14,
      height: 5,
      opacity: 0.5,
      position: "absolute",
      right: 14,
      width: 24,
    },

    // Pills / horizontal scrolls
    pillScroll: {
      marginHorizontal: -spacing.md,
      marginBottom: spacing.sm,
    },
    pillScrollContent: {
      gap: 8,
      paddingHorizontal: spacing.md,
    },
    genrePill: {
      alignItems: "center",
      borderRadius: radii.pill,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    genrePillEmoji: {
      fontSize: 15,
    },
    genrePillLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
    },
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
      fontSize: 15,
    },

    // Series card
    seriesCard: {
      ...shadows.card,
      borderRadius: radii.sm,
      overflow: "hidden",
      width: 150,
    },
    seriesArt: {
      alignItems: "center",
      height: 100,
      justifyContent: "center",
      width: 150,
    },
    seriesArtBottom: {
      bottom: 0,
      height: 40,
      left: 0,
      position: "absolute",
      right: 0,
    },
    seriesEmoji: {
      fontSize: 36,
    },
    seriesInfo: {
      padding: 10,
    },
    seriesName: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 13,
      fontWeight: "800",
      lineHeight: 17,
    },
    seriesAuthor: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 2,
    },
    seriesMeta: {
      alignItems: "center",
      flexDirection: "row",
      gap: 5,
      marginTop: 6,
    },
    seriesMetaText: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "800",
    },
    seriesStatusDot: {
      borderRadius: 3,
      height: 6,
      width: 6,
    },

    // Author chip
    authorChip: {
      alignItems: "center",
      borderRadius: radii.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      width: 190,
    },
    authorAvatar: {
      alignItems: "center",
      borderRadius: 20,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    authorInitials: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900",
    },
    authorInfo: {
      flex: 1,
    },
    authorName: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900",
    },
    authorGenre: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 2,
    },

    // Coming soon
    comingSoonBanner: {
      ...shadows.card,
      alignItems: "flex-start",
      backgroundColor: c.surface,
      borderColor: c.gold + "44",
      borderRadius: radii.sm,
      borderWidth: 1,
      flexDirection: "row",
      marginTop: spacing.lg,
      padding: spacing.md,
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
