/**
 * GenreBrowseScreen
 *
 * Audible-style genre catalog browse:
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

  const [catalogBooks, setCatalogBooks] = useState<GenreBookResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const startIndexRef = useRef(0);
  const currentGenreRef = useRef<string>("");

  const isKeywordMode = !!params.catalogQuery;
  const currentGenre = params.genre;
  const displayTitle = params.title ?? params.genre;

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
  const COLLECTION_PATTERN = /\b(box\s*set|boxed\s*set|collection|omnibus|complete\s*works?|complete\s*series|books?\s*set|bundle|anthology|collected\s*works?|volumes?\s*\d|komplett|gesammelte)\b/i;

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

      // Filter 1 (hard): remove box sets and multi-book collections
      const noCollections = fetched.filter((b) => !COLLECTION_PATTERN.test(b.title));

      // Filter 2 (soft): prefer books with a cover image plus some signal of quality/recency.
      const withStrongCover = noCollections.filter((b) =>
        !!b.coverUrl && (
          (b.ratingsCount ?? 0) > 0 ||
          (b.averageRating ?? 0) > 0 ||
          (b.publishedYear ?? 0) >= 1990
        )
      );
      const withCover = noCollections.filter((b) => !!b.coverUrl);
      const filtered =
        withStrongCover.length >= 3 ? withStrongCover :
        withCover.length >= 3 ? withCover :
        noCollections;

      startIndexRef.current += fetched.length;
      setTotalItems(total);
      setCatalogBooks((prev) => reset ? filtered : [...prev, ...filtered]);
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
    const fullStars = item.averageRating ? Math.round(item.averageRating) : 0;
    const ratingCount = item.ratingsCount
      ? item.ratingsCount >= 1000
        ? `${(item.ratingsCount / 1000).toFixed(1)}k`
        : String(item.ratingsCount)
      : null;

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
            By {item.authors[0]}
          </Text>
        )}
        {/* Ratings row */}
        {fullStars > 0 ? (
          <View style={styles.ratingRow}>
            {[1,2,3,4,5].map((i) => (
              <Ionicons
                key={i}
                name={i <= fullStars ? "star" : "star-outline"}
                size={10}
                color={i <= fullStars ? "#F5A623" : c.muted}
              />
            ))}
            {ratingCount ? (
              <Text style={[styles.ratingCount, { color: c.muted }]}>{ratingCount}</Text>
            ) : null}
          </View>
        ) : item.publishedYear ? (
          <Text style={[styles.bookYear, { color: c.muted }]}>
            {item.publishedYear}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  const hasMore = catalogBooks.length < totalItems;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
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
    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      marginTop: 3,
      paddingHorizontal: 2,
    },
    ratingCount: {
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "700",
      marginLeft: 2,
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
