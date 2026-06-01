/**
 * GenreBrowseScreen
 *
 * Audible-style genre deep-dive:
 *   • Sub-genre chips (horizontal scroll)
 *   • "Top picks" 2-column grid (highest-rated books in genre)
 *   • "All titles" 2-column grid (everything else)
 */
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useLayoutEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BookCover } from "../components/BookCover";
import { useBookliz } from "../data/BooklizContext";
import { RootStackParamList } from "../navigation/types";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";
import { Book } from "../types/models";

// ─── Sub-genre mapping ────────────────────────────────────────────────────────

const SUB_GENRES: Record<string, string[]> = {
  "Fantasy":            ["Epic Fantasy", "Historical Fiction", "Young Adult", "Science Fiction", "Horror"],
  "Science Fiction":    ["Thriller", "Adventure", "Literary Fiction", "Fantasy", "Nonfiction"],
  "Mystery":            ["Thriller", "Horror", "Literary Fiction", "Historical Fiction", "Romance"],
  "Thriller":           ["Mystery", "Horror", "Science Fiction", "Literary Fiction", "Adventure"],
  "Historical Fiction": ["Literary Fiction", "Romance", "Biography", "Mystery", "Adventure"],
  "Romance":            ["Young Adult", "Literary Fiction", "Historical Fiction", "Fantasy", "Mystery"],
  "Horror":             ["Thriller", "Mystery", "Fantasy", "Literary Fiction", "Science Fiction"],
  "Adventure":          ["Fantasy", "Science Fiction", "Thriller", "Historical Fiction", "Young Adult"],
  "Literary Fiction":   ["Historical Fiction", "Romance", "Nonfiction", "Mystery", "Biography"],
  "Young Adult":        ["Fantasy", "Romance", "Science Fiction", "Adventure", "Mystery"],
  "Biography":          ["Nonfiction", "History", "Literary Fiction", "Personal Growth"],
  "Nonfiction":         ["Biography", "History", "Personal Growth", "Science Fiction"],
  "History":            ["Biography", "Historical Fiction", "Nonfiction", "Literary Fiction"],
  "Personal Growth":    ["Nonfiction", "Biography"],
};

function getSubGenres(genre: string): string[] {
  return SUB_GENRES[genre] ?? [];
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type RouteProps = RouteProp<RootStackParamList, "GenreBrowse">;

export function GenreBrowseScreen() {
  const { params } = useRoute<RouteProps>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const c = useColors();
  const { books, authors } = useBookliz();
  const styles = useMemo(() => createStyles(c), [c]);

  const [activeSubGenre, setActiveSubGenre] = useState<string | null>(null);

  // Set the nav title
  useLayoutEffect(() => {
    navigation.setOptions({ title: params.genre });
  }, [navigation, params.genre]);

  const currentGenre = activeSubGenre ?? params.genre;

  // All books in current genre
  const genreBooks = useMemo(
    () => books.filter((b) => b.genre.includes(currentGenre)),
    [books, currentGenre]
  );

  // Top picks: rated 4+ first, then reading, then want-to-read — max 6
  const topPicks = useMemo(() => {
    const rated = genreBooks
      .filter((b) => b.userStatus.status === "read" && (b.userStatus.rating ?? 0) >= 4)
      .sort((a, b) => (b.userStatus.rating ?? 0) - (a.userStatus.rating ?? 0));
    const reading = genreBooks.filter((b) => b.userStatus.status === "reading");
    const wtr = genreBooks.filter((b) => b.userStatus.status === "want-to-read");
    const combined = [...rated, ...reading, ...wtr];
    const seen = new Set<string>();
    const deduped: Book[] = [];
    for (const b of combined) {
      if (!seen.has(b.id)) { seen.add(b.id); deduped.push(b); }
    }
    return deduped.slice(0, 6);
  }, [genreBooks]);

  const topPickIds = useMemo(() => new Set(topPicks.map((b) => b.id)), [topPicks]);

  // All titles: everything not in top picks
  const allTitles = useMemo(
    () => genreBooks.filter((b) => !topPickIds.has(b.id)),
    [genreBooks, topPickIds]
  );

  const subGenres = useMemo(() => getSubGenres(params.genre), [params.genre]);

  function authorName(book: Book) {
    return authors.find((a) => a.id === book.authorId)?.name ?? "";
  }

  function ratingStars(book: Book) {
    const r = book.userStatus.rating;
    if (!r) return null;
    return "★".repeat(r) + "☆".repeat(5 - r);
  }

  function navigateToBook(bookId: string) {
    navigation.navigate("BookDetail", { bookId });
  }

  function navigateToSubGenre(genre: string) {
    if (genre === currentGenre) return;
    setActiveSubGenre(genre === params.genre ? null : genre);
  }

  // ── Book card (used in both sections) ───────────────────────────────────────
  function renderBookCard(book: Book, showRating = false) {
    const stars = ratingStars(book);
    return (
      <Pressable
        style={[styles.bookCard, { backgroundColor: c.surface }]}
        onPress={() => navigateToBook(book.id)}
      >
        <BookCover book={book} size="lg" style={styles.bookCover} />
        <Text numberOfLines={2} style={[styles.bookTitle, { color: c.ink }]}>
          {book.title}
        </Text>
        <Text numberOfLines={1} style={[styles.bookAuthor, { color: c.muted }]}>
          {authorName(book)}
        </Text>
        {showRating && stars && (
          <Text style={[styles.bookStars, { color: c.gold }]}>{stars}</Text>
        )}
        {!showRating && book.pages > 0 && (
          <Text style={[styles.bookPages, { color: c.muted }]}>
            {book.pages} pages
          </Text>
        )}
      </Pressable>
    );
  }

  const isEmpty = genreBooks.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      {/* ── Sub-genre chips ─────────────────────────────────────────────── */}
      {subGenres.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.chipsScroll, { borderBottomColor: c.border }]}
          contentContainerStyle={styles.chipsContent}
        >
          {/* "All" chip to reset */}
          <Pressable
            style={[
              styles.chip,
              { borderColor: c.border, backgroundColor: c.surface },
              !activeSubGenre && { backgroundColor: c.teal, borderColor: c.teal },
            ]}
            onPress={() => setActiveSubGenre(null)}
          >
            <Text style={[styles.chipText, { color: !activeSubGenre ? "#fff" : c.ink }]}>
              All {params.genre}
            </Text>
          </Pressable>

          {subGenres.map((sg) => {
            const isActive = activeSubGenre === sg;
            return (
              <Pressable
                key={sg}
                style={[
                  styles.chip,
                  { borderColor: c.border, backgroundColor: c.surface },
                  isActive && { backgroundColor: c.teal, borderColor: c.teal },
                ]}
                onPress={() => navigateToSubGenre(sg)}
              >
                <Text style={[styles.chipText, { color: isActive ? "#fff" : c.ink }]}>
                  {sg}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      {isEmpty ? (
        <View style={styles.emptyState}>
          <Ionicons name="library-outline" size={48} color={c.border} />
          <Text style={[styles.emptyTitle, { color: c.ink }]}>
            Nothing here yet
          </Text>
          <Text style={[styles.emptySub, { color: c.muted }]}>
            Add {currentGenre.toLowerCase()} books to your library to see them here.
          </Text>
          <Pressable
            style={[styles.emptyBtn, { backgroundColor: c.teal }]}
            onPress={() => navigation.navigate("BookIntake")}
          >
            <Ionicons name="search-outline" size={15} color="#fff" />
            <Text style={styles.emptyBtnText}>Search for books</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={allTitles}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* Top picks */}
              {topPicks.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: c.ink }]}>
                    Top picks for you in {currentGenre}
                  </Text>
                  <View style={styles.topPicksGrid}>
                    {topPicks.map((book) => (
                      <View key={book.id} style={styles.topPickCell}>
                        {renderBookCard(book, true)}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Sub-niche shortcuts */}
              {subGenres.length > 0 && !activeSubGenre && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: c.ink }]}>
                    Find your {params.genre.toLowerCase()} niche
                  </Text>
                  <View style={styles.nicheGrid}>
                    {subGenres.slice(0, 4).map((sg) => (
                      <Pressable
                        key={sg}
                        style={[styles.nicheBtn, { backgroundColor: c.surface, borderColor: c.border }]}
                        onPress={() => navigateToSubGenre(sg)}
                      >
                        <Text style={[styles.nicheBtnText, { color: c.ink }]}>{sg}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {/* All titles header */}
              {allTitles.length > 0 && (
                <Text style={[styles.allTitlesHeader, { color: c.ink }]}>
                  All titles
                </Text>
              )}
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.allTitleCell}>
              {renderBookCard(item, false)}
            </View>
          )}
          ListEmptyComponent={
            topPicks.length > 0 ? null : (
              <View style={styles.emptyState}>
                <Ionicons name="library-outline" size={48} color={c.border} />
                <Text style={[styles.emptyTitle, { color: c.ink }]}>No more titles</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },

    // ── Sub-genre chips ────────────────────────────────────────────────────
    chipsScroll: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexGrow: 0,
    },
    chipsContent: {
      gap: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
    },
    chip: {
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    chipText: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
    },

    // ── Main list ──────────────────────────────────────────────────────────
    listContent: {
      paddingBottom: 40,
    },
    row: {
      gap: 0,
    },

    // ── Section ────────────────────────────────────────────────────────────
    section: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "900",
      lineHeight: 26,
      marginBottom: spacing.md,
    },

    // ── Top picks 2-col grid ───────────────────────────────────────────────
    topPicksGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    topPickCell: {
      width: "50%",
      paddingRight: spacing.sm,
      paddingBottom: spacing.md,
    },

    // ── Niche buttons ──────────────────────────────────────────────────────
    nicheGrid: {
      gap: 10,
    },
    nicheBtn: {
      borderRadius: radii.sm,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 20,
      marginBottom: 2,
    },
    nicheBtnText: {
      fontFamily: fonts.display,
      fontSize: 17,
      fontWeight: "900",
    },

    // ── All titles header ──────────────────────────────────────────────────
    allTitlesHeader: {
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "900",
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
    },

    // ── All titles cell ────────────────────────────────────────────────────
    allTitleCell: {
      width: "50%",
      paddingLeft: spacing.md,
      paddingRight: spacing.sm,
      paddingBottom: spacing.md,
    },

    // ── Book card ──────────────────────────────────────────────────────────
    bookCard: {
      borderRadius: radii.sm,
      overflow: "hidden",
    },
    bookCover: {
      width: "100%",
      aspectRatio: 0.67,
      borderRadius: radii.sm,
      marginBottom: 8,
    },
    bookTitle: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
      lineHeight: 18,
      paddingHorizontal: 2,
    },
    bookAuthor: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 2,
      paddingHorizontal: 2,
    },
    bookStars: {
      fontFamily: fonts.body,
      fontSize: 11,
      marginTop: 3,
      paddingHorizontal: 2,
    },
    bookPages: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 3,
      paddingHorizontal: 2,
    },

    // ── Empty state ────────────────────────────────────────────────────────
    emptyState: {
      alignItems: "center",
      flex: 1,
      gap: 12,
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      paddingVertical: 80,
    },
    emptyTitle: {
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "900",
      textAlign: "center",
    },
    emptySub: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 20,
      textAlign: "center",
    },
    emptyBtn: {
      alignItems: "center",
      borderRadius: radii.pill,
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    emptyBtnText: {
      color: "#fff",
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900",
    },
  });
}
