import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDeferredValue, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BookCover } from "../components/BookCover";
import { FilterChip } from "../components/FilterChip";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";
import { formatStatusLabel } from "../utils/statusLabels";

const filters = ["All", "Read", "Reading", "Wishlist", "Want to Buy", "Owned", "Series", "Unfinished"];
const sortOptions = ["Personal rank", "Rating", "Date read", "Author", "Series order", "Release date", "Most recently logged"];

export function LibraryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { books, getAuthor, readingSessions } = useBooklio();
  const [filter, setFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Personal rank");
  const [query, setQuery] = useState("");
  const [sortOpen, setSortOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const ownedCount = books.filter((b) => b.userStatus.ownership === "owned").length;
  const readCount = books.filter((b) => b.userStatus.status === "read").length;

  const latestLogByBook = useMemo(
    () =>
      readingSessions.reduce<Record<string, string>>((acc, session) => {
        if (!acc[session.bookId] || session.date > acc[session.bookId]) {
          acc[session.bookId] = session.date;
        }
        return acc;
      }, {}),
    [readingSessions]
  );

  const filteredBooks = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    return books
      .filter((book) => {
        if (filter === "Read") return book.userStatus.status === "read";
        if (filter === "Reading") return book.userStatus.status === "reading";
        if (filter === "Wishlist") return book.userStatus.wishlist;
        if (filter === "Want to Buy") return book.userStatus.wantToBuy;
        if (filter === "Owned") return book.userStatus.ownership === "owned";
        if (filter === "Series") return Boolean(book.seriesId);
        if (filter === "Unfinished") return book.userStatus.status === "dnf";
        return true;
      })
      .filter((book) => {
        if (!normalized) return true;
        const author = getAuthor(book.authorId)?.name ?? "";
        return [book.title, author, book.genre.join(" "), book.seriesName ?? "", book.isbn].join(" ").toLowerCase().includes(normalized);
      })
      .sort((a, b) => {
        if (sortBy === "Rating") return (b.userStatus.rating ?? 0) - (a.userStatus.rating ?? 0);
        if (sortBy === "Date read") return (b.userStatus.finishDate ?? "").localeCompare(a.userStatus.finishDate ?? "");
        if (sortBy === "Author") return (getAuthor(a.authorId)?.name ?? "").localeCompare(getAuthor(b.authorId)?.name ?? "");
        if (sortBy === "Series order") return (a.seriesName ?? "").localeCompare(b.seriesName ?? "") || (a.sagaOrder ?? 99) - (b.sagaOrder ?? 99);
        if (sortBy === "Release date") return b.publishedDate.localeCompare(a.publishedDate);
        if (sortBy === "Most recently logged") return (latestLogByBook[b.id] ?? "").localeCompare(latestLogByBook[a.id] ?? "");
        return (a.userStatus.personalRanking ?? 999) - (b.userStatus.personalRanking ?? 999);
      });
  }, [books, deferredQuery, filter, getAuthor, latestLogByBook, sortBy]);

  return (
    <Screen>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Library</Text>
          <Text style={styles.title}>Your collection</Text>
        </View>
        <View style={styles.miniStats}>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatVal}>{books.length}</Text>
            <Text style={styles.miniStatLbl}>tracked</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatVal}>{readCount}</Text>
            <Text style={styles.miniStatLbl}>read</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatVal}>{ownedCount}</Text>
            <Text style={styles.miniStatLbl}>owned</Text>
          </View>
        </View>
      </View>

      {/* Search + Sort button */}
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Search title, author, genre, ISBN..."
          placeholderTextColor={colors.gray}
          style={styles.search}
          value={query}
          onChangeText={setQuery}
        />
        <Pressable
          style={[styles.sortBtn, sortOpen && styles.sortBtnActive]}
          onPress={() => setSortOpen((v) => !v)}
        >
          <Ionicons name="funnel-outline" size={16} color={sortOpen ? colors.card : colors.navy} />
        </Pressable>
      </View>

      {/* Sort dropdown */}
      {sortOpen && (
        <View style={styles.sortPanel}>
          <Text style={styles.sortPanelLabel}>Sort by</Text>
          <View style={styles.sortPanelOptions}>
            {sortOptions.map((opt) => (
              <Pressable
                key={opt}
                style={[styles.sortOption, sortBy === opt && styles.sortOptionActive]}
                onPress={() => { setSortBy(opt); setSortOpen(false); }}
              >
                <Text style={[styles.sortOptionText, sortBy === opt && styles.sortOptionTextActive]}>
                  {opt}
                </Text>
                {sortBy === opt && <Ionicons name="checkmark" size={13} color={colors.card} />}
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRail}>
        {filters.map((item) => (
          <FilterChip key={item} label={item} selected={filter === item} onPress={() => setFilter(item)} />
        ))}
      </ScrollView>

      {/* Count + active sort */}
      <View style={styles.resultsMeta}>
        <Text style={styles.resultsCount}>{filteredBooks.length} books</Text>
        {sortBy !== "Personal rank" && (
          <Text style={styles.activeSort}>· {sortBy}</Text>
        )}
      </View>

      {/* Grid or empty state */}
      {filteredBooks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name={books.length === 0 ? "library-outline" : "search-outline"}
            size={44}
            color={books.length === 0 ? colors.teal : colors.muted}
          />
          <Text style={styles.emptyTitle}>
            {books.length === 0 ? "Your library is empty" : "No books match"}
          </Text>
          <Text style={styles.emptySub}>
            {books.length === 0
              ? "Add your first book to start tracking."
              : "Try a different search term or filter."}
          </Text>
          {books.length === 0 && (
            <Pressable style={styles.emptyButton} onPress={() => navigation.navigate("BookIntake")}>
              <Text style={styles.emptyButtonText}>Add a book</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.grid}>
          {filteredBooks.map((book) => {
            const author = getAuthor(book.authorId);
            const bookMeta = book.userStatus.rating
              ? `${book.userStatus.rating} stars`
              : formatStatusLabel(book.userStatus.status);
            return (
              <Pressable
                key={book.id}
                style={styles.bookTile}
                onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}
              >
                <BookCover book={book} size="md" style={styles.tileCover} />
                <Text numberOfLines={2} style={styles.bookTitle}>{book.title}</Text>
                <Text numberOfLines={1} style={styles.bookAuthor}>By {author?.name}</Text>
                <Text style={styles.bookMeta}>{bookMeta}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md
  },
  headerText: {
    flex: 1
  },
  eyebrow: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    textTransform: "uppercase"
  },
  title: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 2
  },
  miniStats: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.md,
    paddingTop: 4
  },
  miniStat: {
    alignItems: "center"
  },
  miniStatVal: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "900"
  },
  miniStatLbl: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  searchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xs
  },
  search: {
    ...shadows.card,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: spacing.md,
    paddingVertical: 12
  },
  sortBtn: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  sortBtnActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  sortPanel: {
    ...shadows.card,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.md
  },
  sortPanelLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    textTransform: "uppercase"
  },
  sortPanelOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  sortOption: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7
  },
  sortOptionActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  sortOptionText: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800"
  },
  sortOptionTextActive: {
    color: colors.card
  },
  chipRail: {
    marginTop: spacing.sm
  },
  resultsMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginBottom: spacing.sm,
    marginTop: spacing.md
  },
  resultsCount: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800"
  },
  activeSort: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg
  },
  bookTile: {
    width: "46%"
  },
  tileCover: {
    height: 250,
    width: "100%"
  },
  bookTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
    marginTop: spacing.md
  },
  bookAuthor: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3
  },
  bookMeta: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginTop: 6,
    textTransform: "uppercase"
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 52
  },
  emptyTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "900",
    marginTop: spacing.xs,
    textAlign: "center"
  },
  emptySub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center"
  },
  emptyButton: {
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12
  },
  emptyButtonText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  }
});
