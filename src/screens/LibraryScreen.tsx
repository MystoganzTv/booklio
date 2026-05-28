import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDeferredValue, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Badge } from "../components/Badge";
import { BookCover } from "../components/BookCover";
import { FilterChip } from "../components/FilterChip";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { useI18n } from "../i18n/LocalizationContext";
import { RootStackParamList } from "../navigation/types";
import { Book } from "../types/models";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors, useTheme } from "../theme/ThemeContext";
import { formatStatusLabel } from "../utils/statusLabels";
import { normalizeBookGenres } from "../utils/genres";
import { CreateListSheet } from "../components/CreateListSheet";

const filters = ["all", "read", "reading", "wishlist", "wantToBuy", "owned", "series", "unfinished"] as const;
const sortOptions = ["personalRank", "rating", "dateRead", "author", "seriesOrder", "releaseDate", "mostRecentlyLogged"] as const;

type ViewMode = "grid" | "list";
type LibraryFilter = typeof filters[number];
type LibrarySort = typeof sortOptions[number];

export function LibraryScreen() {
  const c = useColors();
  const { isDark } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const activeControlTextColor = isDark ? c.ink : "#FFFFFF";
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { books, getAuthor, readingSessions, userLists, createUserList, deleteUserList, renameUserList } = useBooklio();
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [sortBy, setSortBy] = useState<LibrarySort>("personalRank");
  const [query, setQuery] = useState("");
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<string | null>(null);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [renamingList, setRenamingList] = useState<{ id: string; name: string; emoji?: string } | null>(null);
  const deferredQuery = useDeferredValue(query);

  const ownedCount = books.filter((b) => b.userStatus.ownership === "owned").length;
  const readCount = books.filter((b) => b.userStatus.status === "read").length;
  const wishlistCount = books.filter((b) => b.userStatus.wishlist).length;
  const unfinishedCount = books.filter((b) => b.userStatus.status === "dnf").length;
  const activeSeriesCount = new Set(books.filter((b) => b.seriesId && ["reading", "read"].includes(b.userStatus.status)).map((b) => b.seriesId)).size;
  const readingNow = books.filter((b) => b.userStatus.status === "reading").length;

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

  // Collect all clean genres and tags available in the library
  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    for (const book of books) {
      for (const g of normalizeBookGenres(book.genre)) {
        if (g !== "Uncategorized") set.add(g);
      }
    }
    return Array.from(set).sort();
  }, [books]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const book of books) {
      for (const tag of book.tags ?? []) {
        if (tag.trim()) set.add(tag.trim());
      }
    }
    return Array.from(set).sort();
  }, [books]);

  const filteredBooks = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    return books
      .filter((book) => {
        if (filter === "read") return book.userStatus.status === "read";
        if (filter === "reading") return book.userStatus.status === "reading";
        if (filter === "wishlist") return book.userStatus.wishlist;
        if (filter === "wantToBuy") return book.userStatus.wantToBuy;
        if (filter === "owned") return book.userStatus.ownership === "owned";
        if (filter === "series") return Boolean(book.seriesId);
        if (filter === "unfinished") return book.userStatus.status === "dnf";
        return true;
      })
      .filter((book) => {
        if (!genreFilter) return true;
        return normalizeBookGenres(book.genre).includes(genreFilter);
      })
      .filter((book) => {
        if (!tagFilter) return true;
        return (book.tags ?? []).includes(tagFilter);
      })
      .filter((book) => {
        if (!listFilter) return true;
        const list = userLists.find((l) => l.id === listFilter);
        return list ? list.bookIds.includes(book.id) : true;
      })
      .filter((book) => {
        if (!normalized) return true;
        const author = getAuthor(book.authorId)?.name ?? "";
        return [
          book.title,
          author,
          book.genre.join(" "),
          book.seriesName ?? "",
          book.isbn,
          book.publisher,
          book.language,
          (book.tags ?? []).join(" ")
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      })
      .sort((a, b) => {
        if (sortBy === "rating") return (b.userStatus.rating ?? 0) - (a.userStatus.rating ?? 0);
        if (sortBy === "dateRead") return (b.userStatus.finishDate ?? "").localeCompare(a.userStatus.finishDate ?? "");
        if (sortBy === "author") return (getAuthor(a.authorId)?.name ?? "").localeCompare(getAuthor(b.authorId)?.name ?? "");
        if (sortBy === "seriesOrder") return (a.seriesName ?? "").localeCompare(b.seriesName ?? "") || (a.sagaOrder ?? 99) - (b.sagaOrder ?? 99);
        if (sortBy === "releaseDate") return b.publishedDate.localeCompare(a.publishedDate);
        if (sortBy === "mostRecentlyLogged") return (latestLogByBook[b.id] ?? "").localeCompare(latestLogByBook[a.id] ?? "");
        return (a.userStatus.personalRanking ?? 999) - (b.userStatus.personalRanking ?? 999);
      });
  }, [books, deferredQuery, filter, genreFilter, tagFilter, listFilter, userLists, getAuthor, latestLogByBook, sortBy]);

  const collectorShelves = [
    {
      title: t("library.readingNow"),
      value: String(readingNow),
      note: readingNow ? t("library.readingNowActive") : t("library.readingNowEmpty"),
      accent: c.tealDark
    },
    {
      title: t("library.sagaMomentum"),
      value: String(activeSeriesCount),
      note: activeSeriesCount ? t("library.sagaMomentumActive") : t("library.sagaMomentumEmpty"),
      accent: c.gold
    },
    {
      title: t("library.wishlistPressure"),
      value: String(wishlistCount),
      note: wishlistCount ? t("library.wishlistPressureActive") : t("library.wishlistPressureEmpty"),
      accent: c.coral
    },
    {
      title: t("library.unfinished"),
      value: String(unfinishedCount),
      note: unfinishedCount ? t("library.unfinishedActive") : t("library.unfinishedEmpty"),
      accent: c.muted
    }
  ];

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{t("library.eyebrow")}</Text>
          <Text style={styles.title}>{t("library.title")}</Text>
          <Text style={styles.subtitle}>{t("library.subtitle")}</Text>
        </View>
        <View style={styles.miniStats}>
          <MiniStat value={String(books.length)} label={t("library.tracked")} styles={styles} />
          <MiniStat value={String(readCount)} label={t("library.read")} styles={styles} />
          <MiniStat value={String(ownedCount)} label={t("library.owned")} styles={styles} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shelfRail}>
        {collectorShelves.map((item) => (
          <View key={item.title} style={styles.shelfCard}>
            <Text style={[styles.shelfValue, { color: item.accent }]}>{item.value}</Text>
            <Text style={styles.shelfTitle}>{item.title}</Text>
            <Text style={styles.shelfNote}>{item.note}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Custom lists rail */}
      {userLists.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.listsRail} contentContainerStyle={styles.listsRailContent}>
          {/* "All books" clear-filter card */}
          <Pressable
            style={[styles.listCard, !listFilter && styles.listCardActive]}
            onPress={() => setListFilter(null)}
          >
            <Text style={styles.listCardEmoji}>📖</Text>
            <Text style={[styles.listCardName, !listFilter && styles.listCardNameActive]} numberOfLines={1}>All</Text>
            <Text style={[styles.listCardCount, !listFilter && styles.listCardCountActive]}>{books.length}</Text>
          </Pressable>

          {userLists.map((list) => {
            const active = listFilter === list.id;
            return (
              <Pressable
                key={list.id}
                style={[styles.listCard, active && styles.listCardActive]}
                onPress={() => setListFilter(active ? null : list.id)}
                onLongPress={() => setRenamingList({ id: list.id, name: list.name, emoji: list.emoji })}
              >
                <Text style={styles.listCardEmoji}>{list.emoji ?? "📚"}</Text>
                <Text style={[styles.listCardName, active && styles.listCardNameActive]} numberOfLines={1}>{list.name}</Text>
                <Text style={[styles.listCardCount, active && styles.listCardCountActive]}>{list.bookIds.length}</Text>
              </Pressable>
            );
          })}

          {/* "+" create new list */}
          <Pressable style={styles.listCardNew} onPress={() => setCreateListOpen(true)}>
            <Ionicons name="add" size={20} color={c.teal} />
            <Text style={styles.listCardNewText}>New</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <Pressable style={styles.listsRailEmpty} onPress={() => setCreateListOpen(true)}>
          <Ionicons name="bookmarks-outline" size={14} color={c.teal} />
          <Text style={styles.listsRailEmptyText}>{t("lists.createPrompt")}</Text>
          <Ionicons name="add-circle-outline" size={14} color={c.teal} />
        </Pressable>
      )}

      <View style={styles.searchRow}>
        <TextInput
          placeholder={t("library.searchPlaceholder")}
          placeholderTextColor={c.gray}
          style={styles.search}
          value={query}
          onChangeText={setQuery}
        />
        <Pressable
          style={[styles.viewBtn, viewMode === "grid" && styles.viewBtnActive]}
          onPress={() => setViewMode("grid")}
        >
          <Ionicons name="grid-outline" size={16} color={viewMode === "grid" ? activeControlTextColor : c.ink} />
        </Pressable>
        <Pressable
          style={[styles.viewBtn, viewMode === "list" && styles.viewBtnActive]}
          onPress={() => setViewMode("list")}
        >
          <Ionicons name="reorder-three-outline" size={18} color={viewMode === "list" ? activeControlTextColor : c.ink} />
        </Pressable>
        <Pressable
          style={[styles.sortBtn, sortOpen && styles.sortBtnActive]}
          onPress={() => setSortOpen((v) => !v)}
        >
          <Ionicons name="funnel-outline" size={16} color={sortOpen ? activeControlTextColor : c.ink} />
        </Pressable>
      </View>

      {sortOpen ? (
        <View style={styles.sortPanel}>
          <Text style={styles.sortPanelLabel}>{t("library.sortBy")}</Text>
          <View style={styles.sortPanelOptions}>
            {sortOptions.map((opt) => (
              <Pressable
                key={opt}
                style={[styles.sortOption, sortBy === opt && styles.sortOptionActive]}
                onPress={() => {
                  setSortBy(opt);
                  setSortOpen(false);
                }}
              >
                <Text style={[styles.sortOptionText, sortBy === opt && styles.sortOptionTextActive]}>{t(`library.sorts.${opt}`)}</Text>
                {sortBy === opt ? <Ionicons name="checkmark" size={13} color={activeControlTextColor} /> : null}
              </Pressable>
            ))}
          </View>

          {availableGenres.length > 0 ? (
            <>
              <Text style={[styles.sortPanelLabel, { marginTop: spacing.md }]}>Genre</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.md }}>
                <View style={styles.advancedChipRow}>
                  <Pressable
                    style={[styles.advancedChip, !genreFilter && styles.advancedChipActive]}
                    onPress={() => setGenreFilter(null)}
                  >
                    <Text style={[styles.advancedChipText, !genreFilter && styles.advancedChipTextActive]}>All</Text>
                  </Pressable>
                  {availableGenres.map((g) => (
                    <Pressable
                      key={g}
                      style={[styles.advancedChip, genreFilter === g && styles.advancedChipActive]}
                      onPress={() => setGenreFilter(genreFilter === g ? null : g)}
                    >
                      <Text style={[styles.advancedChipText, genreFilter === g && styles.advancedChipTextActive]}>{g}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </>
          ) : null}

          {availableTags.length > 0 ? (
            <>
              <Text style={[styles.sortPanelLabel, { marginTop: spacing.md }]}>Tags</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.md }}>
                <View style={styles.advancedChipRow}>
                  <Pressable
                    style={[styles.advancedChip, !tagFilter && styles.advancedChipActive]}
                    onPress={() => setTagFilter(null)}
                  >
                    <Text style={[styles.advancedChipText, !tagFilter && styles.advancedChipTextActive]}>All</Text>
                  </Pressable>
                  {availableTags.map((tag) => (
                    <Pressable
                      key={tag}
                      style={[styles.advancedChip, tagFilter === tag && styles.advancedChipActive]}
                      onPress={() => setTagFilter(tagFilter === tag ? null : tag)}
                    >
                      <Text style={[styles.advancedChipText, tagFilter === tag && styles.advancedChipTextActive]}>{tag}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </>
          ) : null}
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRail}>
        {filters.map((item) => (
          <FilterChip key={item} label={t(`library.filters.${item}`)} selected={filter === item} onPress={() => setFilter(item)} />
        ))}
      </ScrollView>

      <View style={styles.resultsMeta}>
        <Text style={styles.resultsCount}>{t("library.booksOnShelf", { count: filteredBooks.length })}</Text>
        <Text style={styles.activeSort}>· {t(`library.sorts.${sortBy}`)}</Text>
        {listFilter ? <Text style={styles.activeSort}>· {userLists.find((l) => l.id === listFilter)?.emoji} {userLists.find((l) => l.id === listFilter)?.name}</Text> : null}
        {genreFilter ? <Text style={styles.activeSort}>· {genreFilter}</Text> : null}
        {tagFilter ? <Text style={styles.activeSort}>· #{tagFilter}</Text> : null}
        <Text style={styles.activeSort}>· {viewMode === "grid" ? t("library.coverWall") : t("library.spineList")}</Text>
      </View>

      {filteredBooks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name={books.length === 0 ? "library-outline" : "search-outline"}
            size={44}
            color={books.length === 0 ? c.teal : c.muted}
          />
          <Text style={styles.emptyTitle}>{books.length === 0 ? t("library.emptyTitle") : t("library.noMatchesTitle")}</Text>
          <Text style={styles.emptySub}>
            {books.length === 0 ? t("library.emptyBody") : t("library.noMatchesBody")}
          </Text>
          {books.length === 0 ? (
            <Pressable style={styles.emptyButton} onPress={() => navigation.navigate("BookIntake")}>
              <Text style={styles.emptyButtonText}>{t("common.addBook")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : viewMode === "grid" ? (
        <View style={styles.grid}>
          {filteredBooks.map((book) => (
            <GridBookTile
              key={book.id}
              book={book}
              authorName={getAuthor(book.authorId)?.name ?? ""}
              styles={styles}
              onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}
            />
          ))}
        </View>
      ) : (
        <View style={styles.listWrap}>
          {filteredBooks.map((book) => (
            <LibraryRowCard
              key={book.id}
              book={book}
              authorName={getAuthor(book.authorId)?.name ?? ""}
              latestLogDate={latestLogByBook[book.id]}
              styles={styles}
              onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}
              onOpenSeries={
                book.seriesId
                  ? () => navigation.navigate("SeriesTracker", { seriesId: book.seriesId! })
                  : undefined
              }
            />
          ))}
        </View>
      )}
      {/* Create list sheet */}
      <CreateListSheet
        open={createListOpen}
        mode="create"
        onSave={(name, emoji) => {
          createUserList(name, emoji);
          setCreateListOpen(false);
        }}
        onClose={() => setCreateListOpen(false)}
      />

      {/* Rename list sheet */}
      <CreateListSheet
        open={Boolean(renamingList)}
        mode="rename"
        initialName={renamingList?.name ?? ""}
        initialEmoji={renamingList?.emoji ?? "📚"}
        onSave={(name, emoji) => {
          if (renamingList) {
            renameUserList(renamingList.id, name, emoji);
            // If we were filtering by this list keep the filter active
          }
          setRenamingList(null);
        }}
        onClose={() => setRenamingList(null)}
      />
    </Screen>
  );
}

function MiniStat({ value, label, styles }: { value: string; label: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatVal}>{value}</Text>
      <Text style={styles.miniStatLbl}>{label}</Text>
    </View>
  );
}

function GridBookTile({
  book,
  authorName,
  styles,
  onPress
}: {
  book: Book;
  authorName: string;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.bookTile} onPress={onPress}>
      <BookCover book={book} size="md" style={styles.tileCover} />
      <Text numberOfLines={2} style={styles.bookTitle}>{book.title}</Text>
      <Text numberOfLines={1} style={styles.bookAuthor}>By {authorName}</Text>
      <View style={styles.tileBadges}>
        <Badge
          label={book.userStatus.rating ? `${book.userStatus.rating} stars` : formatStatusLabel(book.userStatus.status)}
          tone={book.userStatus.status === "read" ? "gold" : book.userStatus.status === "reading" ? "teal" : "gray"}
        />
        {book.seriesId ? <Badge label="Saga" tone="navy" /> : null}
      </View>
    </Pressable>
  );
}

function LibraryRowCard({
  book,
  authorName,
  latestLogDate,
  styles,
  onPress,
  onOpenSeries
}: {
  book: Book;
  authorName: string;
  latestLogDate?: string;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
  onOpenSeries?: () => void;
}) {
  return (
    <Pressable style={styles.rowCard} onPress={onPress}>
      <BookCover book={book} size="sm" style={styles.rowCover} />
      <View style={styles.rowCopy}>
        <View style={styles.rowTopline}>
          <Text style={styles.rowTitle}>{book.title}</Text>
          {typeof book.userStatus.personalRanking === "number" ? (
            <Text style={styles.rowRank}>#{book.userStatus.personalRanking}</Text>
          ) : null}
        </View>
        <Text style={styles.rowAuthor}>{authorName}</Text>
        <Text style={styles.rowMeta}>
          {book.language} · {book.pages} pages · {book.publisher}
        </Text>
        {book.seriesName ? (
          <Pressable onPress={onOpenSeries}>
            <Text style={styles.rowSeries}>
              {book.seriesName} · Book {book.seriesNumber ?? "—"}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.rowBadges}>
          <Badge label={formatStatusLabel(book.userStatus.status)} tone={book.userStatus.status === "read" ? "gold" : book.userStatus.status === "reading" ? "teal" : book.userStatus.status === "dnf" ? "danger" : "gray"} />
          {book.userStatus.ownership === "owned" ? <Badge label="Owned" tone="green" /> : null}
          {book.userStatus.wishlist ? <Badge label="Wishlist" tone="navy" /> : null}
          {book.userStatus.wantToBuy ? <Badge label="Buy" tone="coral" /> : null}
        </View>
        <Text style={styles.rowFootnote}>
          {latestLogDate ? `Latest session: ${latestLogDate}` : `ISBN ${book.isbn}`}
        </Text>
      </View>
    </Pressable>
  );
}

function createStyles(c: AppColors, isDark: boolean) {
  const activeControlBackground = isDark ? "rgba(20,184,166,0.16)" : c.navy;
  const activeControlBorder = isDark ? "rgba(20,184,166,0.34)" : c.navy;
  const activeControlText = isDark ? c.ink : "#FFFFFF";

  return StyleSheet.create({
    headerRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.md
    },
    headerText: {
      flex: 1,
      paddingRight: spacing.sm
    },
    eyebrow: {
      color: c.tealDark,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.3,
      textTransform: "uppercase"
    },
    title: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 26,
      fontWeight: "900",
      marginTop: 2
    },
    subtitle: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 6
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
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "900"
    },
    miniStatLbl: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase"
    },
    shelfRail: {
      marginBottom: spacing.md
    },
    shelfCard: {
      ...shadows.card,
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      marginRight: spacing.sm,
      minHeight: 116,
      padding: spacing.md,
      width: 164
    },
    shelfValue: {
      fontFamily: fonts.display,
      fontSize: 28,
      fontWeight: "900"
    },
    shelfTitle: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900",
      marginTop: 3
    },
    shelfNote: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 6
    },
    listsRail: {
      marginBottom: spacing.sm
    },
    listsRailContent: {
      gap: spacing.sm,
      paddingRight: spacing.sm
    },
    listCard: {
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      minWidth: 72,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm
    },
    listCardActive: {
      backgroundColor: c.navy,
      borderColor: c.navy
    },
    listCardEmoji: {
      fontSize: 22,
      marginBottom: 4
    },
    listCardName: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      textAlign: "center"
    },
    listCardNameActive: {
      color: "#FFFFFF"
    },
    listCardCount: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 11,
      marginTop: 2,
      textAlign: "center"
    },
    listCardCountActive: {
      color: "rgba(255,255,255,0.65)"
    },
    listCardNew: {
      alignItems: "center",
      backgroundColor: c.teal + "12",
      borderColor: c.teal,
      borderRadius: radii.lg,
      borderStyle: "dashed",
      borderWidth: 1.5,
      justifyContent: "center",
      minWidth: 58,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm
    },
    listCardNewText: {
      color: c.teal,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      marginTop: 2
    },
    listsRailEmpty: {
      alignItems: "center",
      backgroundColor: c.teal + "10",
      borderColor: c.teal,
      borderRadius: radii.pill,
      borderStyle: "dashed",
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "center",
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10
    },
    listsRailEmptyText: {
      color: c.teal,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800"
    },
    searchRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
      marginBottom: spacing.xs
    },
    search: {
      ...shadows.card,
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      color: c.ink,
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      paddingHorizontal: spacing.md,
      paddingVertical: 12
    },
    viewBtn: {
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44
    },
    viewBtnActive: {
      backgroundColor: activeControlBackground,
      borderColor: activeControlBorder
    },
    sortBtn: {
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44
    },
    sortBtnActive: {
      backgroundColor: activeControlBackground,
      borderColor: activeControlBorder
    },
    sortPanel: {
      ...shadows.card,
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.md,
      borderWidth: 1,
      marginBottom: spacing.sm,
      padding: spacing.md
    },
    sortPanelLabel: {
      color: c.muted,
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
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: 5,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7
    },
    sortOptionActive: {
      backgroundColor: activeControlBackground,
      borderColor: activeControlBorder
    },
    sortOptionText: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800"
    },
    sortOptionTextActive: {
      color: activeControlText
    },
    advancedChipRow: {
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xs
    },
    advancedChip: {
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 6
    },
    advancedChipActive: {
      backgroundColor: c.tealDark,
      borderColor: c.tealDark
    },
    advancedChipText: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800"
    },
    advancedChipTextActive: {
      color: "#FFFFFF"
    },
    chipRail: {
      marginTop: spacing.sm
    },
    resultsMeta: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
      marginBottom: spacing.sm,
      marginTop: spacing.md
    },
    resultsCount: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800"
    },
    activeSort: {
      color: c.muted,
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
      height: 236,
      width: "100%"
    },
    bookTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 18,
      fontWeight: "800",
      lineHeight: 22,
      marginTop: spacing.md
    },
    bookAuthor: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 3
    },
    tileBadges: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 8
    },
    listWrap: {
      gap: spacing.md
    },
    rowCard: {
      ...shadows.card,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md
    },
    rowCover: {
      width: 86,
      height: 128
    },
    rowCopy: {
      flex: 1
    },
    rowTopline: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.sm
    },
    rowTitle: {
      color: c.ink,
      flex: 1,
      fontFamily: fonts.display,
      fontSize: 22,
      fontWeight: "900",
      lineHeight: 25
    },
    rowRank: {
      color: c.gold,
      fontFamily: fonts.display,
      fontSize: 18,
      fontWeight: "900"
    },
    rowAuthor: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
      marginTop: 4
    },
    rowMeta: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4
    },
    rowSeries: {
      color: c.tealDark,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
      marginTop: 6
    },
    rowBadges: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: spacing.sm
    },
    rowFootnote: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 11,
      marginTop: spacing.sm
    },
    emptyState: {
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderStyle: "dashed",
      borderWidth: 1,
      gap: spacing.xs,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 52
    },
    emptyTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "900",
      marginTop: spacing.xs,
      textAlign: "center"
    },
    emptySub: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 13,
      textAlign: "center"
    },
    emptyButton: {
      backgroundColor: isDark ? "rgba(20,184,166,0.16)" : c.navy,
      borderColor: isDark ? "rgba(20,184,166,0.34)" : c.navy,
      borderWidth: 1,
      borderRadius: radii.pill,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: 12
    },
    emptyButtonText: {
      color: activeControlText,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900"
    }
  });
}
