/**
 * DiscoverScreen — Premium redesign
 *
 * Visual-first discover experience inspired by Audible / Apple Books / Netflix.
 * No generic icon squares. Images are the protagonists.
 *
 * Sections:
 *   - Sticky search bar
 *   - Browse by mood   → cinematic image cards, 2-col grid
 *   - Browse by genre  → image cards, horizontal scroll
 *   - Trending now     → real data from Google Books, horizontal scroll
 *   - Popular searches → quick chips
 */
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  ImageStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { RootStackParamList, MainTabParamList } from "../navigation/types";
import { fetchByKeyword, GenreBookResult } from "../services/googleBooksProvider";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";

// ─── Moods ────────────────────────────────────────────────────────────────────

type Mood = {
  id: string;
  label: string;
  imageSource: ImageSourcePropType;
  tint: string;
  catalogQuery: string;
};

const MOODS: Mood[] = [
  {
    id: "scary",
    label: "Scary",
    imageSource: require("../../assets/discover/mood-scary.png"),
    tint: "rgba(10, 20, 30, 0.22)",
    catalogQuery: "horror scary supernatural dark thriller",
  },
  {
    id: "exciting",
    label: "Exciting",
    imageSource: require("../../assets/discover/mood-exciting.png"),
    tint: "rgba(96, 52, 14, 0.16)",
    catalogQuery: "thrilling adventure action packed suspense",
  },
  {
    id: "epic",
    label: "Epic",
    imageSource: require("../../assets/discover/mood-epic.png"),
    tint: "rgba(70, 58, 94, 0.16)",
    catalogQuery: "epic fantasy adventure saga series quest",
  },
  {
    id: "fastpaced",
    label: "Fast-paced",
    imageSource: require("../../assets/discover/mood-fast-paced.png"),
    tint: "rgba(8, 56, 76, 0.18)",
    catalogQuery: "fast paced action thriller page turner suspense",
  },
  {
    id: "heartfelt",
    label: "Heartfelt",
    imageSource: require("../../assets/discover/mood-heartfelt.png"),
    tint: "rgba(92, 42, 54, 0.16)",
    catalogQuery: "emotional heartfelt love story family drama",
  },
  {
    id: "inspiring",
    label: "Inspiring",
    imageSource: require("../../assets/discover/mood-inspiring.png"),
    tint: "rgba(118, 82, 20, 0.14)",
    catalogQuery: "inspiring uplifting motivational memoir biography",
  },
  {
    id: "cozy",
    label: "Cozy",
    imageSource: require("../../assets/discover/mood-cozy.png"),
    tint: "rgba(88, 58, 32, 0.18)",
    catalogQuery: "cozy mystery cozy fantasy comfort read warm",
  },
  {
    id: "thought",
    label: "Thought-provoking",
    imageSource: require("../../assets/discover/mood-thought-provoking.png"),
    tint: "rgba(34, 62, 86, 0.15)",
    catalogQuery: "thought provoking philosophical literary fiction",
  },
];

// ─── Genres ───────────────────────────────────────────────────────────────────

type GenreCard = {
  genre: string;
  label: string;
  imageSource: ImageSourcePropType;
  catalogQuery?: string;
};

const CATALOG_GENRES: GenreCard[] = [
  { genre: "Fantasy", label: "Fantasy", imageSource: require("../../assets/discover/genre-fantasy.png"), catalogQuery: "bestselling fantasy novels epic fantasy popular" },
  { genre: "Science Fiction", label: "Science Fiction", imageSource: require("../../assets/discover/genre-science-fiction.png"), catalogQuery: "popular science fiction novels bestselling" },
  { genre: "Mystery", label: "Mystery & Thriller", imageSource: require("../../assets/discover/genre-mystery-thriller.png"), catalogQuery: "bestselling mystery thriller novels popular" },
  { genre: "Romance", label: "Romance", imageSource: require("../../assets/discover/genre-romance.png"), catalogQuery: "popular romance novels bestselling" },
  { genre: "Historical Fiction", label: "Historical Fiction", imageSource: require("../../assets/discover/genre-historical-fiction.png"), catalogQuery: "historical fiction bestselling novels popular" },
  { genre: "Horror", label: "Horror", imageSource: require("../../assets/discover/genre-horror.png"), catalogQuery: "popular horror novels bestselling supernatural thriller" },
  { genre: "Biography", label: "Biography", imageSource: require("../../assets/discover/genre-biography.png"), catalogQuery: "bestselling biography memoir notable people" },
  { genre: "Personal Growth", label: "Self Help", imageSource: require("../../assets/discover/genre-self-help.png"), catalogQuery: "self help personal growth bestselling mindset habits" },
];

// ─── Popular searches ─────────────────────────────────────────────────────────

const POPULAR_SEARCHES = [
  { label: "Award winners 2024", query: "award winning fiction 2024 literary prize" },
  { label: "Book club picks", query: "book club fiction contemporary popular" },
  { label: "Dark academia", query: "dark academia novels gothic campus mystery" },
  { label: "Cozy mysteries", query: "cozy mystery novels charming amateur sleuth" },
  { label: "Enemies to lovers", query: "enemies to lovers romance bestselling" },
  { label: "Sci-fi classics", query: "classic science fiction novels essential" },
  { label: "Historical thrillers", query: "historical thriller novels bestselling" },
  { label: "True crime", query: "true crime bestselling nonfiction" },
  { label: "Coming of age", query: "coming of age novels literary fiction" },
  { label: "Magical realism", query: "magical realism novels acclaimed" },
];

const CURATED_TRENDING_TITLES: Array<{ title: string; author?: string }> = [
  { title: "Yellowface", author: "R. F. Kuang" },
  { title: "Book Lovers", author: "Emily Henry" },
  { title: "Project Hail Mary", author: "Andy Weir" },
  { title: "The Unhoneymooners", author: "Christina Lauren" },
  { title: "My Year of Rest and Relaxation", author: "Ottessa Moshfegh" },
  { title: "Carl's Doomsday Scenario", author: "Matt Dinniman" },
];

function normalizeTitle(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function selectBestCuratedMatch(
  books: GenreBookResult[],
  seed: { title: string; author?: string }
): GenreBookResult | null {
  const wantedTitle = normalizeTitle(seed.title);
  const wantedAuthor = seed.author ? normalizeTitle(seed.author) : "";

  const ranked = [...books].sort((a, b) => {
    const aTitle = normalizeTitle(a.title);
    const bTitle = normalizeTitle(b.title);
    const aAuthor = normalizeTitle(a.authors[0] ?? "");
    const bAuthor = normalizeTitle(b.authors[0] ?? "");

    const aExact = aTitle === wantedTitle ? 2 : aTitle.includes(wantedTitle) ? 1 : 0;
    const bExact = bTitle === wantedTitle ? 2 : bTitle.includes(wantedTitle) ? 1 : 0;
    if (bExact !== aExact) return bExact - aExact;

    const aAuthorMatch = wantedAuthor && (aAuthor === wantedAuthor || aAuthor.includes(wantedAuthor)) ? 1 : 0;
    const bAuthorMatch = wantedAuthor && (bAuthor === wantedAuthor || bAuthor.includes(wantedAuthor)) ? 1 : 0;
    if (bAuthorMatch !== aAuthorMatch) return bAuthorMatch - aAuthorMatch;

    return (b.averageRating ?? 0) - (a.averageRating ?? 0);
  });

  return ranked.find((book) => normalizeTitle(book.title).includes(wantedTitle) && !!book.coverUrl) ?? ranked[0] ?? null;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function DiscoverScreen() {
  const c = useColors();
  const navigation = useNavigation<NavigationProp<RootStackParamList & MainTabParamList>>();
  const styles = useMemo(() => createStyles(c), [c]);

  // Trending — fetched once on mount
  const [trending, setTrending] = useState<GenreBookResult[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      CURATED_TRENDING_TITLES.map(async (seed) => {
        const query = seed.author
          ? `${seed.title} ${seed.author}`
          : seed.title;
        const { books } = await fetchByKeyword(query, 0, 8);
        return selectBestCuratedMatch(books, seed);
      })
    )
      .then((books) => {
        if (cancelled) return;
        setTrending(books.filter((book): book is GenreBookResult => Boolean(book)));
      })
      .catch(() => {
        if (!cancelled) setTrending([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTrending(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function goToCatalog(query: string, title?: string) {
    if (!query.trim()) return;
    navigation.navigate("GenreBrowse", {
      genre: title ?? query,
      title: title ?? query,
      catalogQuery: query,
    });
  }

  function openUnifiedSearch(initialQuery?: string) {
    navigation.navigate("BookIntake", {
      autoRun: Boolean(initialQuery?.trim()),
      initialMode: "search",
      initialQuery: initialQuery?.trim(),
    });
  }

  function goToGenre(card: GenreCard) {
    navigation.navigate("GenreBrowse", {
      genre: card.genre,
      title: card.label,
      catalogQuery: card.catalogQuery,
    });
  }

  function openTrendingBook(book: GenreBookResult) {
    navigation.navigate("BookIntake", {
      initialBookSelection: {
        title: book.title,
        authorName: book.authors[0] ?? "Unknown Author",
        isbn: book.isbn13,
        pages: book.pageCount,
        genre: book.genres,
        publishedDate: book.publishedYear ? `${book.publishedYear}-01-01` : undefined,
        language: book.language,
        synopsis: book.description,
        coverImageUri: book.coverUrl,
      },
    });
  }

  const trendingShowcase = trending.slice(0, 6);

  return (
    <Screen>
      {/* ── Unified search entry ───────────────────────────────────────────── */}
      <Pressable style={styles.searchRow} onPress={() => openUnifiedSearch()}>
        <Ionicons name="search-outline" size={18} color={c.muted} style={styles.searchIcon} />
        <Text style={[styles.searchPlaceholder, { color: c.muted }]}>
          Search books, authors, series...
        </Text>
      </Pressable>

      {/* ── Browse by mood ─────────────────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Browse by mood</Text>
      </View>
      <View style={styles.moodGrid}>
        {MOODS.map((mood) => (
          <Pressable
            key={mood.id}
            style={styles.moodCard}
            onPress={() => goToCatalog(mood.catalogQuery, mood.label)}
          >
            <View style={styles.moodImageWrap}>
              <Image
                source={mood.imageSource}
                style={styles.moodImage}
                resizeMode="cover"
              />
              <View style={[styles.moodTintOverlay, { backgroundColor: mood.tint }]} />
            </View>
            <Text style={styles.moodCardLabel}>{mood.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── Browse by genre ────────────────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Browse by genre</Text>
      </View>
      <View style={styles.genreGrid}>
        {CATALOG_GENRES.map((g) => (
          <Pressable
            key={g.label}
            style={styles.genreCard}
            onPress={() => goToGenre(g)}
          >
            <Image
              source={g.imageSource}
              style={styles.genreImage}
              resizeMode="cover"
            />
            <Text style={styles.genreCardLabel}>{g.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── Trending now ───────────────────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trending on #BookTok</Text>
        <Text style={styles.sectionSubtitle}>Fresh picks readers can&apos;t stop sharing.</Text>
      </View>
      {loadingTrending ? (
        <View style={styles.trendingLoader}>
          <ActivityIndicator size="small" color={c.teal} />
        </View>
      ) : (
        <View style={styles.trendingSection}>
          <View style={[styles.trendingBackdrop, { backgroundColor: c.surface }]} />
          <View style={styles.trendingMosaic}>
            <View style={styles.trendingColumn}>
              {trendingShowcase[0] ? (
                <TrendingTile
                  book={trendingShowcase[0]}
                  style={styles.trendingTileSmall}
                  coverStyle={styles.trendingCoverSmall}
                  onPress={openTrendingBook}
                />
              ) : null}
              {trendingShowcase[3] ? (
                <TrendingTile
                  book={trendingShowcase[3]}
                  style={styles.trendingTileSmall}
                  coverStyle={styles.trendingCoverSmall}
                  onPress={openTrendingBook}
                />
              ) : null}
            </View>
            <View style={styles.trendingColumn}>
              {trendingShowcase[1] ? (
                <TrendingTile
                  book={trendingShowcase[1]}
                  style={styles.trendingTileLarge}
                  coverStyle={styles.trendingCoverLarge}
                  onPress={openTrendingBook}
                />
              ) : null}
              {trendingShowcase[4] ? (
                <TrendingTile
                  book={trendingShowcase[4]}
                  style={styles.trendingTileTall}
                  coverStyle={styles.trendingCoverTall}
                  onPress={openTrendingBook}
                />
              ) : null}
            </View>
            <View style={styles.trendingColumn}>
              {trendingShowcase[2] ? (
                <TrendingTile
                  book={trendingShowcase[2]}
                  style={styles.trendingTileSmall}
                  coverStyle={styles.trendingCoverSmall}
                  onPress={openTrendingBook}
                />
              ) : null}
              {trendingShowcase[5] ? (
                <TrendingTile
                  book={trendingShowcase[5]}
                  style={styles.trendingTileSmall}
                  coverStyle={styles.trendingCoverSmall}
                  onPress={openTrendingBook}
                />
              ) : null}
            </View>
          </View>
          <Text style={styles.trendingCaption}>Tap any book to open it</Text>
        </View>
      )}

      {/* ── Popular searches ───────────────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Popular searches</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        {POPULAR_SEARCHES.map((s) => (
          <Pressable
            key={s.label}
            style={[styles.chip, { borderColor: c.border, backgroundColor: c.surface }]}
            onPress={() => goToCatalog(s.query, s.label)}
          >
            <Text style={[styles.chipText, { color: c.ink }]}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

function TrendingTile({
  book,
  style,
  coverStyle,
  onPress,
}: {
  book: GenreBookResult;
  style: StyleProp<ViewStyle>;
  coverStyle: StyleProp<ImageStyle>;
  onPress: (book: GenreBookResult) => void;
}) {
  return (
    <Pressable style={style} onPress={() => onPress(book)}>
      {book.coverUrl ? (
        <Image
          source={{ uri: book.coverUrl }}
          style={coverStyle}
          resizeMode="cover"
        />
      ) : (
        <View style={[coverStyle as StyleProp<ViewStyle>, stylesFallback.trendingPlaceholder]}>
          <Ionicons name="book-outline" size={24} color="#91A0B8" />
        </View>
      )}
    </Pressable>
  );
}

const stylesFallback = StyleSheet.create({
  trendingPlaceholder: {
    alignItems: "center",
    backgroundColor: "#152235",
    justifyContent: "center",
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    // ── Search ──────────────────────────────────────────────────────────────
    searchRow: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: "row",
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.md,
      ...shadows.card,
    },
    searchIcon: { marginRight: 8 },
    searchPlaceholder: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "700",
      paddingVertical: 14,
    },

    // ── Section header ───────────────────────────────────────────────────────
    sectionHeader: {
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 22,
      fontWeight: "900",
    },
    sectionSubtitle: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 4,
    },

    // ── Mood grid (2-col, image cards) ───────────────────────────────────────
    moodGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: spacing.xl,
    },
    moodCard: {
      gap: 8,
      width: "48.5%",
    },
    moodImageWrap: {
      borderRadius: radii.lg,
      overflow: "hidden",
      position: "relative",
    },
    moodImage: {
      height: 150,
      width: "100%",
    },
    moodTintOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    moodCardLabel: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 16,
      fontWeight: "800",
      textAlign: "center",
    },

    // ── Genre grid (2-col, image cards) ──────────────────────────────────────
    genreGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: spacing.xl,
    },
    genreCard: {
      gap: 8,
      width: "48.5%",
    },
    genreImage: {
      borderRadius: radii.lg,
      height: 150,
      width: "100%",
    },
    genreCardLabel: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 16,
      fontWeight: "800",
      textAlign: "center",
    },

    // ── Trending now ─────────────────────────────────────────────────────────
    trendingLoader: {
      alignItems: "center",
      height: 240,
      justifyContent: "center",
      marginBottom: spacing.xl,
    },
    trendingSection: {
      alignItems: "center",
      marginBottom: spacing.xl,
    },
    trendingBackdrop: {
      borderRadius: 120,
      height: 260,
      opacity: 0.28,
      position: "absolute",
      top: 48,
      width: 260,
    },
    trendingMosaic: {
      flexDirection: "row",
      gap: 14,
      justifyContent: "center",
      width: "100%",
    },
    trendingColumn: {
      alignItems: "center",
      gap: 14,
    },
    trendingTileSmall: {
      borderRadius: radii.lg,
      overflow: "hidden",
    },
    trendingTileLarge: {
      borderRadius: radii.lg,
      overflow: "hidden",
    },
    trendingTileTall: {
      borderRadius: radii.lg,
      overflow: "hidden",
    },
    trendingCoverSmall: {
      borderRadius: radii.lg,
      height: 160,
      width: 108,
    },
    trendingCoverLarge: {
      borderRadius: radii.lg,
      height: 210,
      width: 140,
    },
    trendingCoverTall: {
      borderRadius: radii.lg,
      height: 220,
      width: 140,
    },
    trendingCaption: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
      marginTop: spacing.lg,
      textAlign: "center",
    },

    // ── Popular chips ────────────────────────────────────────────────────────
    chipsScroll: { marginHorizontal: -spacing.lg, marginBottom: spacing.xl },
    chipsContent: { gap: 8, paddingHorizontal: spacing.lg, paddingBottom: 4 },
    chip: {
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    chipText: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
    },
  });
}
