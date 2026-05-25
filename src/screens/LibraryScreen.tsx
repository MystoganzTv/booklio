import { useNavigation } from "@react-navigation/native";
import { useDeferredValue, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BookCover } from "../components/BookCover";
import { BrandHeader } from "../components/BrandHeader";
import { FilterChip } from "../components/FilterChip";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

const filters = ["All", "Read", "Reading", "Wishlist", "Want to Buy", "Owned", "Series", "DNF"];
const sortOptions = ["Rating", "Date read", "Author", "Series order", "Release date", "Personal rank", "Most recently logged"];

export function LibraryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { books, getAuthor, readingSessions } = useBooklio();
  const [filter, setFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Personal rank");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

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
        if (filter === "DNF") return book.userStatus.status === "dnf";
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
      <BrandHeader
        eyebrow="Mi biblioteca"
        title="Tu coleccion viva"
        subtitle="Busca portadas, sagas, ISBNs, ownership, wishlists y rankings personales con el tono calido de Booklio."
      />

      <TextInput
        placeholder="Search title, author, genre, saga, ISBN"
        placeholderTextColor={colors.gray}
        style={styles.search}
        value={query}
        onChangeText={setQuery}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRail}>
        {filters.map((item) => (
          <FilterChip key={item} label={item} selected={filter === item} onPress={() => setFilter(item)} />
        ))}
      </ScrollView>

      <Text style={styles.sortLabel}>Sort by</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRail}>
        {sortOptions.map((item) => (
          <FilterChip key={item} label={item} selected={sortBy === item} onPress={() => setSortBy(item)} />
        ))}
      </ScrollView>

      <View style={styles.grid}>
        {filteredBooks.map((book) => {
          const author = getAuthor(book.authorId);
          return (
            <Pressable key={book.id} style={styles.bookTile} onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}>
              <BookCover book={book} size="md" />
              <Text numberOfLines={2} style={styles.bookTitle}>
                {book.title}
              </Text>
              <Text numberOfLines={1} style={styles.bookAuthor}>
                {author?.name}
              </Text>
              <Text style={styles.bookMeta}>
                {book.userStatus.rating ? `${book.userStatus.rating} stars` : book.userStatus.status.replaceAll("-", " ")}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.6,
    textTransform: "uppercase"
  },
  title: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 37,
    fontWeight: "900",
    marginTop: 4
  },
  subtitle: {
    color: "#D8D2C8",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm
  },
  search: {
    ...shadows.card,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: spacing.md,
    paddingVertical: 13
  },
  chipRail: {
    marginTop: spacing.md
  },
  sortLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: spacing.md,
    textTransform: "uppercase"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.lg
  },
  bookTile: {
    width: "46%"
  },
  bookTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 20,
    marginTop: spacing.sm
  },
  bookAuthor: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3
  },
  bookMeta: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 3,
    textTransform: "uppercase"
  }
});
