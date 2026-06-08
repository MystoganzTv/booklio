/**
 * AuthorBooksScreen
 *
 * Shows all books by an author:
 *   • "In your library" horizontal strip (books already added)
 *   • Full catalog from Google Books via inauthor: query — paginated
 *
 * Tapping a catalog book navigates to BookIntake with ISBN/title pre-filled.
 * Tapping a library book navigates to BookDetail.
 */
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBookliz } from "../data/BooklizContext";
import { RootStackParamList } from "../navigation/types";
import { fetchByKeyword, GenreBookResult } from "../services/googleBooksProvider";
import { isHighSignalCatalogBook } from "../services/recommendationEngine";
import { Book } from "../types/models";
import { AppColors, fonts, radii, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";

const PAGE_SIZE = 40;
const COLLECTION_PATTERN = /\b(box\s*set|boxed\s*set|collection|omnibus|complete\s*works?|complete\s*series|books?\s*set|bundle|anthology|collected\s*works?)\b/i;
const LOW_SIGNAL_PATTERN  = /\b(workbook|summary|study guide|companion|analysis|unauthorized)\b/i;

export function AuthorBooksScreen() {
  const route       = useRoute<RouteProp<RootStackParamList, "AuthorBooks">>();
  const navigation  = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const c           = useColors();
  const insets      = useSafeAreaInsets();
  const styles      = useMemo(() => createStyles(c), [c]);
  const { books }   = useBookliz();

  const { authorId, authorName } = route.params;

  // ── Catalog state ──────────────────────────────────────────────────────────
  const [catalogBooks, setCatalogBooks]   = useState<GenreBookResult[]>([]);
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [networkError, setNetworkError]   = useState(false);
  const [totalItems, setTotalItems]       = useState(0);
  const startIndexRef                     = useRef(0);

  // ── Library section ────────────────────────────────────────────────────────
  const libraryBooks = useMemo(
    () => books.filter((b) => b.authorId === authorId),
    [books, authorId]
  );
  const libraryIsbnSet = useMemo(
    () => new Set(books.map((b) => b.isbn).filter(Boolean) as string[]),
    [books]
  );

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const loadAuthor = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true);
      setNetworkError(false);
      setCatalogBooks([]);
      startIndexRef.current = 0;
    } else {
      setLoadingMore(true);
    }

    try {
      // Use inauthor: to get books BY this author — same qualifier the search
      // engine uses in author mode.
      const query = `inauthor:"${authorName}"`;
      const { books: fetched, totalItems: total } = await fetchByKeyword(
        query,
        reset ? 0 : startIndexRef.current,
        PAGE_SIZE
      );

      // Quality filter — same approach as GenreBrowseScreen
      const highSignal = fetched.filter((b) => isHighSignalCatalogBook(b));
      const withCover  = fetched.filter((b) => !!b.coverUrl && !COLLECTION_PATTERN.test(b.title));
      let filtered     = highSignal.length >= 4 ? highSignal : withCover.length > 0 ? withCover : fetched;

      // Remove study guides, summaries, unauthorized bios
      filtered = filtered.filter((b) => !LOW_SIGNAL_PATTERN.test(b.title));

      // Sort: library-owned first, then by rating count descending
      filtered.sort((a, b) => {
        const aLib = a.isbn13 && libraryIsbnSet.has(a.isbn13) ? 1 : 0;
        const bLib = b.isbn13 && libraryIsbnSet.has(b.isbn13) ? 1 : 0;
        if (bLib !== aLib) return bLib - aLib;
        return (b.ratingsCount ?? 0) - (a.ratingsCount ?? 0);
      });

      startIndexRef.current += fetched.length;
      setTotalItems(total);
      setCatalogBooks((prev) => (reset ? filtered : [...prev, ...filtered]));
    } catch {
      if (reset) setNetworkError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [authorName, libraryIsbnSet]);

  useEffect(() => { loadAuthor(true); }, [loadAuthor]);

  function handleLoadMore() {
    if (loadingMore || loading || catalogBooks.length >= totalItems) return;
    void loadAuthor(false);
  }

  function isInLibrary(book: GenreBookResult): boolean {
    return !!book.isbn13 && libraryIsbnSet.has(book.isbn13);
  }

  function getLibraryBook(catalogBook: GenreBookResult): Book | undefined {
    if (!catalogBook.isbn13) return undefined;
    return books.find((b) => b.isbn === catalogBook.isbn13);
  }

  function handleCatalogPress(book: GenreBookResult) {
    const libBook = getLibraryBook(book);
    if (libBook) {
      navigation.navigate("BookDetail", { bookId: libBook.id });
      return;
    }
    // Pre-fill BookIntake with as much metadata as we have
    navigation.navigate("BookIntake", {
      autoRun: true,
      initialMode: "search",
      ...(book.isbn13
        ? { initialQuery: book.isbn13, initialSearchIntent: "auto" }
        : { initialQuery: book.title, initialSearchIntent: "auto",
            initialBookSelection: {
              title: book.title,
              authorName: book.authors[0] ?? authorName,
              isbn: book.isbn13,
              pages: book.pageCount,
              coverImageUri: book.coverUrl,
              publishedDate: book.publishedYear ? String(book.publishedYear) : undefined,
            } as any }),
    });
  }

  // ── Catalog card ───────────────────────────────────────────────────────────
  function renderCatalogCard({ item }: { item: GenreBookResult }) {
    const inLibrary  = isInLibrary(item);
    const fullStars  = item.averageRating ? Math.round(item.averageRating) : 0;
    const ratingCount = item.ratingsCount
      ? item.ratingsCount >= 1000
        ? `${(item.ratingsCount / 1000).toFixed(1)}k`
        : String(item.ratingsCount)
      : null;

    return (
      <Pressable style={styles.bookCard} onPress={() => handleCatalogPress(item)}>
        <View style={styles.coverWrap}>
          {item.coverUrl ? (
            <Image source={{ uri: item.coverUrl }} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]}>
              <Ionicons name="book-outline" size={28} color={c.border} />
            </View>
          )}
          {inLibrary && (
            <View style={[styles.libraryBadge, { backgroundColor: c.teal }]}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          )}
        </View>

        <Text numberOfLines={2} style={styles.bookTitle}>{item.title}</Text>

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
              <Text style={styles.ratingCount}>{ratingCount}</Text>
            ) : null}
          </View>
        ) : item.publishedYear ? (
          <Text style={styles.bookYear}>{item.publishedYear}</Text>
        ) : null}
      </Pressable>
    );
  }

  const hasMore = catalogBooks.length < totalItems;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      {/* Custom back header — this screen uses headerShown: false */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={c.ink} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Author</Text>
          <Text numberOfLines={1} style={styles.heading}>{authorName}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={c.teal} />
          <Text style={styles.loadingText}>Finding books by {authorName}…</Text>
        </View>
      ) : (
        <FlatList
          data={catalogBooks}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          renderItem={renderCatalogCard}
          ListHeaderComponent={
            <>
              {/* Library strip */}
              {libraryBooks.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>In your library</Text>
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
                            <Image source={{ uri: book.coverImageUri }} style={styles.libraryCover} resizeMode="cover" />
                          ) : (
                            <View style={[styles.libraryCover, styles.coverPlaceholder]}>
                              <Ionicons name="book-outline" size={22} color={c.border} />
                            </View>
                          )}
                          <View style={[styles.libraryBadgeLarge, { backgroundColor: c.teal }]}>
                            <Ionicons name="checkmark" size={11} color="#fff" />
                          </View>
                        </View>
                        <Text numberOfLines={2} style={styles.libraryTitle}>{book.title}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Catalog header */}
              <View style={styles.catalogHeader}>
                <Text style={styles.sectionTitle}>All books</Text>
                {totalItems > 0 && (
                  <Text style={styles.totalCount}>
                    {totalItems > 500 ? "500+" : totalItems.toLocaleString()}
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
            networkError ? (
              <View style={styles.emptyState}>
                <Ionicons name="wifi-outline" size={40} color={c.border} />
                <Text style={styles.emptyTitle}>Connection lost</Text>
                <Text style={styles.emptySub}>Check your internet and try again.</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={40} color={c.border} />
                <Text style={styles.emptyTitle}>No results</Text>
                <Text style={styles.emptySub}>
                  Couldn't find catalog books for this author.
                </Text>
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
    root: { flex: 1 },

    // Header
    header: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.md,
    },
    backBtn: { padding: 4 },
    headerText: { flex: 1 },
    eyebrow: {
      color: c.tealDark,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.3,
      textTransform: "uppercase",
    },
    heading: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 22,
      fontWeight: "900",
      marginTop: 1,
    },

    // Loading
    loadingState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    loadingText: { color: c.muted, fontFamily: fonts.body, fontSize: 14, fontWeight: "700" },

    // List
    listContent: { paddingBottom: 40 },
    columnWrapper: { gap: 0 },

    // Sections
    section: { paddingTop: spacing.md, marginBottom: spacing.sm },
    catalogHeader: {
      alignItems: "baseline",
      flexDirection: "row",
      gap: 8,
      paddingBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
    },
    sectionTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "900",
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    totalCount: { color: c.muted, fontFamily: fonts.body, fontSize: 13, fontWeight: "700" },

    // Library strip
    libraryRow: { gap: 12, paddingHorizontal: spacing.md },
    libraryCard: { width: 96 },
    libraryCoverWrap: { position: "relative", marginBottom: 6 },
    libraryCover: { width: 96, height: 140, borderRadius: radii.sm },
    libraryBadgeLarge: {
      alignItems: "center",
      bottom: 6,
      borderRadius: 10,
      height: 20,
      justifyContent: "center",
      position: "absolute",
      right: 6,
      width: 20,
    },
    libraryTitle: { fontFamily: fonts.body, fontSize: 11, fontWeight: "800", lineHeight: 15, color: c.ink },

    // Catalog grid
    bookCard: {
      paddingBottom: spacing.md,
      paddingLeft: spacing.md,
      paddingRight: spacing.sm,
      width: "50%",
    },
    coverWrap: { marginBottom: 7, position: "relative" },
    cover: { aspectRatio: 0.67, borderRadius: radii.sm, width: "100%" },
    coverPlaceholder: { alignItems: "center", backgroundColor: c.surfaceAlt, justifyContent: "center" },
    libraryBadge: {
      alignItems: "center",
      borderRadius: 8,
      height: 16,
      justifyContent: "center",
      position: "absolute",
      right: 6,
      top: 6,
      width: 16,
    },
    bookTitle: { color: c.ink, fontFamily: fonts.body, fontSize: 13, fontWeight: "800", lineHeight: 18, paddingHorizontal: 2 },
    ratingRow: { alignItems: "center", flexDirection: "row", gap: 2, marginTop: 3, paddingHorizontal: 2 },
    ratingCount: { color: c.muted, fontFamily: fonts.body, fontSize: 10, marginLeft: 2 },
    bookYear: { color: c.muted, fontFamily: fonts.body, fontSize: 11, marginTop: 3, paddingHorizontal: 2 },

    // Footer
    footer: { alignItems: "center", paddingVertical: 16 },
    loadMoreBtn: {
      alignItems: "center",
      borderRadius: radii.pill,
      borderWidth: 1,
      marginHorizontal: spacing.lg,
      marginVertical: spacing.md,
      paddingVertical: 10,
    },
    loadMoreText: { fontFamily: fonts.body, fontSize: 14, fontWeight: "700" },

    // Empty / error
    emptyState: { alignItems: "center", gap: 12, paddingTop: 60 },
    emptyTitle: { color: c.ink, fontFamily: fonts.display, fontSize: 18, fontWeight: "900" },
    emptySub: { color: c.muted, fontFamily: fonts.body, fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  });
}
