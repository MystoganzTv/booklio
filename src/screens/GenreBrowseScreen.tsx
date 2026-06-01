/**
 * GenreBrowseScreen
 *
 * Audible-style genre catalog browse:
 *   • Sub-genre chips (horizontal scroll)
 *   • "In your library" section (books already added)
 *   • Catalog results from Google Books — paginated, infinite scroll
 *
 * Books already in the user's library are highlighted with a badge.
 * Tapping a catalog book navigates to BookIntake with the ISBN pre-filled.
 */
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useBookliz } from "../data/BooklizContext";
import { RootStackParamList } from "../navigation/types";
import { fetchByGenre, fetchByKeyword, GenreBookResult } from "../services/googleBooksProvider";
import { AppColors, fonts, radii, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";
import { Book } from "../types/models";

// ─── Sub-genre chips ──────────────────────────────────────────────────────────

const SUB_GENRES: Record<string, string[]> = {
  "Fantasy":            ["Epic Fantasy", "Dark Fantasy", "Urban Fantasy", "Historical Fiction", "Science Fiction"],
  "Science Fiction":    ["Space Opera", "Cyberpunk", "Dystopian", "Hard Sci-Fi", "Fantasy"],
  "Mystery":            ["Cozy Mystery", "Detective", "Thriller", "Crime", "Historical Fiction"],
  "Thriller":           ["Psychological", "Legal", "Political", "Mystery", "Horror"],
  "Historical Fiction": ["Ancient", "Medieval", "World War", "Victorian", "Romance"],
  "Romance":            ["Contemporary", "Historical", "Paranormal", "Fantasy", "Young Adult"],
  "Horror":             ["Psychological", "Supernatural", "Gothic", "Thriller", "Dark Fantasy"],
  "Adventure":          ["Action", "Survival", "Travel", "Fantasy", "Science Fiction"],
  "Literary Fiction":   ["Contemporary", "Historical Fiction", "Coming of Age", "Nonfiction", "Mystery"],
  "Young Adult":        ["Fantasy", "Romance", "Science Fiction", "Adventure", "Horror"],
  "Biography":          ["Memoir", "Autobiography", "History", "Nonfiction", "Personal Growth"],
  "Nonfiction":         ["History", "Science", "Biography", "Personal Growth", "Business"],
  "History":            ["Ancient", "Modern", "Biography", "Military", "World History"],
  "Personal Growth":    ["Productivity", "Psychology", "Wellness", "Business", "Nonfiction"],
};

// ─── Types ────────────────────────────────────────────────────────────────────

type RouteProps = RouteProp<RootStackParamList, "GenreBrowse">;
type NavProps = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 40;

// ─── Screen ───────────────────────────────────────────────────────────────────

export function GenreBrowseScreen() {
  const { params } = useRoute<RouteProps>();
  const navigation = useNavigation<NavProps>();
  const c = useColors();
  const { books } = useBookliz();
  const styles = useMemo(() => createStyles(c), [c]);

  const [activeSubGenre, setActiveSubGenre] = useState<string | null>(null);
  const [catalogBooks, setCatalogBooks] = useState<GenreBookResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const startIndexRef = useRef(0);
  const currentGenreRef = useRef<string>("");

  const isKeywordMode = !!params.catalogQuery;
  const currentGenre = activeSubGenre ?? params.genre;
  const displayTitle = params.title ?? params.genre;
  // Sub-genre chips only make sense in genre mode
  const subGenres = isKeywordMode ? [] : (SUB_GENRES[params.genre] ?? []);

  // Set nav title
  useLayoutEffect(() => {
    navigation.setOptions({ title: displayTitle });
  }, [navigation, displayTitle]);

  // Build a set of ISBNs already in library for quick lookup
  const libraryIsbnSet = useMemo(
    () => new Set(books.map((b) => b.isbn).filter(Boolean) as string[]),
    [books]
  );

  // Books from library matching current genre
  const libraryBooks = useMemo(
    () => books.filter((b) => b.genre.includes(currentGenre)),
    [books, currentGenre]
  );

  // Load catalog books
  const loadGenre = useCallback(async (genre: string, reset = true) => {
    if (reset) {
      setLoading(true);
      setCatalogBooks([]);
      startIndexRef.current = 0;
      currentGenreRef.current = genre;
    } else {
      setLoadingMore(true);
    }

    try {
      const fetcher = params.catalogQuery
        ? fetchByKeyword(params.catalogQuery, reset ? 0 : startIndexRef.current, PAGE_SIZE)
        : fetchByGenre(genre, reset ? 0 : startIndexRef.current, PAGE_SIZE);
      const { books: fetched, totalItems: total } = await fetcher;
      startIndexRef.current += fetched.length;
      setTotalItems(total);
      setCatalogBooks((prev) => reset ? fetched : [...prev, ...fetched]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadGenre(currentGenre, true);
  }, [currentGenre, loadGenre]);

  function handleLoadMore() {
    if (loadingMore || loading || catalogBooks.length >= totalItems) return;
    if (currentGenreRef.current !== currentGenre) return;
    loadGenre(currentGenre, false);
  }

  function isInLibrary(book: GenreBookResult): boolean {
    return !!book.isbn13 && libraryIsbnSet.has(book.isbn13);
  }

  function getLibraryBook(catalogBook: GenreBookResult): Book | undefined {
    if (!catalogBook.isbn13) return undefined;
    return books.find((b) => b.isbn === catalogBook.isbn13);
  }

  function handleBookPress(book: GenreBookResult) {
    const libBook = getLibraryBook(book);
    if (libBook) {
      navigation.navigate("BookDetail", { bookId: libBook.id });
    } else {
      // Navigate to Add screen — in the future could pre-fill ISBN
      navigation.navigate("BookIntake");
    }
  }

  // ── Book card ──────────────────────────────────────────────────────────────
  function renderCatalogCard({ item }: { item: GenreBookResult }) {
    const inLibrary = isInLibrary(item);
    return (
      <Pressable
        style={[styles.bookCard, inLibrary && { opacity: 0.85 }]}
        onPress={() => handleBookPress(item)}
      >
        {/* Cover */}
        <View style={styles.coverWrap}>
          {item.coverUrl ? (
            <Image
              source={{ uri: item.coverUrl }}
              style={styles.cover}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder, { backgroundColor: c.surfaceAlt }]}>
              <Ionicons name="book-outline" size={28} color={c.border} />
            </View>
          )}
          {inLibrary && (
            <View style={[styles.libraryBadge, { backgroundColor: c.teal }]}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          )}
        </View>

        {/* Meta */}
        <Text numberOfLines={2} style={[styles.bookTitle, { color: c.ink }]}>
          {item.title}
        </Text>
        {item.authors[0] && (
          <Text numberOfLines={1} style={[styles.bookAuthor, { color: c.muted }]}>
            {item.authors[0]}
          </Text>
        )}
        {item.publishedYear && (
          <Text style={[styles.bookYear, { color: c.muted }]}>
            {item.publishedYear}
          </Text>
        )}
      </Pressable>
    );
  }

  const hasMore = catalogBooks.length < totalItems;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      {/* Sub-genre chips */}
      {subGenres.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.chipsScroll, { borderBottomColor: c.border }]}
          contentContainerStyle={styles.chipsContent}
        >
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
                onPress={() => setActiveSubGenre(isActive ? null : sg)}
              >
                <Text style={[styles.chipText, { color: isActive ? "#fff" : c.ink }]}>
                  {sg}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Main catalog list */}
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={c.teal} />
          <Text style={[styles.loadingText, { color: c.muted }]}>
            Finding {currentGenre.toLowerCase()} books…
          </Text>
        </View>
      ) : (
        <FlatList
          data={catalogBooks}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          renderItem={renderCatalogCard}
          ListHeaderComponent={
            <>
              {/* Library section — only in genre mode, not keyword/mood mode */}
              {!isKeywordMode && libraryBooks.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: c.ink }]}>
                    In your library
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.libraryRow}
                  >
                    {libraryBooks.map((book) => (
                      <Pressable
                        key={book.id}
                        style={styles.libraryCard}
                        onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}
                      >
                        <View style={styles.libraryCoverWrap}>
                          {book.coverImageUri ? (
                            <Image
                              source={{ uri: book.coverImageUri }}
                              style={styles.libraryCover}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[styles.libraryCover, { backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" }]}>
                              <Ionicons name="book-outline" size={22} color={c.border} />
                            </View>
                          )}
                          <View style={[styles.libraryBadgeLarge, { backgroundColor: c.teal }]}>
                            <Ionicons name="checkmark" size={11} color="#fff" />
                          </View>
                        </View>
                        <Text numberOfLines={2} style={[styles.libraryTitle, { color: c.ink }]}>
                          {book.title}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Catalog header */}
              <View style={styles.catalogHeader}>
                <Text style={[styles.sectionTitle, { color: c.ink }]}>
                  All titles
                </Text>
                {totalItems > 0 && (
                  <Text style={[styles.totalCount, { color: c.muted }]}>
                    {totalItems.toLocaleString()} books
                  </Text>
                )}
              </View>
            </>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color={c.teal} />
              </View>
            ) : hasMore ? (
              <Pressable
                style={[styles.loadMoreBtn, { borderColor: c.border }]}
                onPress={handleLoadMore}
              >
                <Text style={[styles.loadMoreText, { color: c.teal }]}>Load more</Text>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={40} color={c.border} />
                <Text style={[styles.emptyTitle, { color: c.ink }]}>No results</Text>
                <Text style={[styles.emptySub, { color: c.muted }]}>
                  Try a different genre or check your connection.
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    root: { flex: 1 },

    // ── Chips ──────────────────────────────────────────────────────────────
    chipsScroll: { borderBottomWidth: StyleSheet.hairlineWidth, flexGrow: 0 },
    chipsContent: { gap: 8, paddingHorizontal: spacing.md, paddingVertical: 12 },
    chip: { borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
    chipText: { fontFamily: fonts.body, fontSize: 13, fontWeight: "800" },

    // ── Loading ────────────────────────────────────────────────────────────
    loadingState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    loadingText: { fontFamily: fonts.body, fontSize: 14, fontWeight: "700" },

    // ── List ───────────────────────────────────────────────────────────────
    listContent: { paddingBottom: 40 },
    row: { gap: 0 },

    // ── Section headers ────────────────────────────────────────────────────
    section: { paddingTop: spacing.lg, marginBottom: spacing.sm },
    catalogHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    sectionTitle: {
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "900",
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    totalCount: { fontFamily: fonts.body, fontSize: 13, fontWeight: "700" },

    // ── Library horizontal strip ───────────────────────────────────────────
    libraryRow: { gap: 12, paddingHorizontal: spacing.md },
    libraryCard: { width: 96 },
    libraryCoverWrap: { position: "relative", marginBottom: 6 },
    libraryCover: { width: 96, height: 140, borderRadius: radii.sm },
    libraryBadgeLarge: {
      position: "absolute", bottom: 6, right: 6,
      borderRadius: 10, width: 20, height: 20,
      alignItems: "center", justifyContent: "center",
    },
    libraryTitle: {
      fontFamily: fonts.body, fontSize: 11, fontWeight: "800", lineHeight: 15,
    },

    // ── Catalog 2-col grid ─────────────────────────────────────────────────
    bookCard: {
      width: "50%",
      paddingLeft: spacing.md,
      paddingRight: spacing.sm,
      paddingBottom: spacing.md,
    },
    coverWrap: { position: "relative", marginBottom: 7 },
    cover: {
      width: "100%",
      aspectRatio: 0.67,
      borderRadius: radii.sm,
    },
    coverPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    libraryBadge: {
      position: "absolute", top: 6, right: 6,
      borderRadius: 8, width: 16, height: 16,
      alignItems: "center", justifyContent: "center",
    },
    bookTitle: {
      fontFamily: fonts.body, fontSize: 13, fontWeight: "800",
      lineHeight: 18, paddingHorizontal: 2,
    },
    bookAuthor: {
      fontFamily: fonts.body, fontSize: 11, fontWeight: "700",
      marginTop: 2, paddingHorizontal: 2,
    },
    bookYear: {
      fontFamily: fonts.body, fontSize: 10, fontWeight: "700",
      marginTop: 2, paddingHorizontal: 2, opacity: 0.6,
    },

    // ── Footer ────────────────────────────────────────────────────────────
    footer: { paddingVertical: 20, alignItems: "center" },
    loadMoreBtn: {
      alignSelf: "center", borderWidth: 1, borderRadius: radii.pill,
      paddingHorizontal: 24, paddingVertical: 10, marginVertical: 16,
    },
    loadMoreText: { fontFamily: fonts.body, fontSize: 14, fontWeight: "800" },

    // ── Empty ──────────────────────────────────────────────────────────────
    emptyState: {
      alignItems: "center", gap: 10, paddingHorizontal: spacing.xl, paddingVertical: 60,
    },
    emptyTitle: { fontFamily: fonts.display, fontSize: 18, fontWeight: "900" },
    emptySub: {
      fontFamily: fonts.body, fontSize: 13, fontWeight: "700",
      lineHeight: 19, textAlign: "center",
    },
  });
}
