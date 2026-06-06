import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDeferredValue, useMemo, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Badge } from "../components/Badge";
import { BooklioDialog } from "../components/BooklioDialog";
import { BookCover } from "../components/BookCover";
import { FilterChip } from "../components/FilterChip";
import { Screen } from "../components/Screen";
import { useBookliz } from "../data/BooklizContext";
import { useI18n } from "../i18n/LocalizationContext";
import { RootStackParamList } from "../navigation/types";
import { Book } from "../types/models";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors, useTheme } from "../theme/ThemeContext";
import { formatStatusLabel } from "../utils/statusLabels";
import { normalizeBookGenres } from "../utils/genres";
import { CreateListSheet } from "../components/CreateListSheet";

const sortOptions = ["personalRank", "rating", "dateRead", "author", "seriesOrder", "releaseDate", "mostRecentlyLogged"] as const;

type ViewMode = "grid" | "list";
type LibraryFilter = "all" | "reading" | "read" | "wishlist";
type LibrarySort = typeof sortOptions[number];

const SIMPLE_FILTERS: { key: LibraryFilter; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "reading",  label: "In progress" },
  { key: "read",     label: "Finished" },
  { key: "wishlist", label: "Wish list" },
];

export function LibraryScreen() {
  const c = useColors();
  const { isDark } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const activeControlTextColor = isDark ? c.ink : "#FFFFFF";
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { books, getAuthor, readingSessions, userLists, createUserList, deleteUserList, renameUserList, deleteBook } = useBookliz();
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [sortBy, setSortBy] = useState<LibrarySort>("personalRank");
  const [query, setQuery] = useState("");
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<string | null>(null);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [renamingList, setRenamingList] = useState<{ id: string; name: string; emoji?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const deferredQuery = useDeferredValue(query);

  const clearFilters = () => {
    setQuery("");
    setFilter("all");
    setGenreFilter(null);
    setTagFilter(null);
    setListFilter(null);
    setSortOpen(false);
  };

  // Only filter by query when 2+ chars — avoids "no match" flash on first keystroke
  const effectiveQuery = deferredQuery.trim().length >= 2 ? deferredQuery.trim() : "";

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
    const normalized = effectiveQuery.toLowerCase();
    return books
      .filter((book) => {
        if (filter === "read") return book.userStatus.status === "read";
        if (filter === "reading") return book.userStatus.status === "reading";
        if (filter === "wishlist") return Boolean(book.userStatus.wishlist) || Boolean(book.userStatus.wantToBuy);
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
  }, [books, effectiveQuery, filter, genreFilter, tagFilter, listFilter, userLists, getAuthor, latestLogByBook, sortBy]);

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
      {/* ── Header ── */}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{t("library.eyebrow")}</Text>
          <Text style={styles.title}>{t("library.title")}</Text>
        </View>
        <View style={styles.miniStats}>
          <MiniStat value={String(books.length)} label={t("library.tracked")} styles={styles} />
          <MiniStat value={String(readCount)} label={t("library.read")} styles={styles} />
          <MiniStat value={String(ownedCount)} label={t("library.owned")} styles={styles} />
        </View>
      </View>

      {/* ── Lists rail — compact pills ── */}
      {userLists.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.listsRail} contentContainerStyle={styles.listsRailContent}>
          <Pressable
            style={[styles.listPill, !listFilter && styles.listPillActive]}
            onPress={() => setListFilter(null)}
          >
            <Text style={[styles.listPillText, !listFilter && styles.listPillTextActive]}>All</Text>
          </Pressable>
          {userLists.map((list) => {
            const active = listFilter === list.id;
            return (
              <Pressable
                key={list.id}
                style={[styles.listPill, active && styles.listPillActive]}
                onPress={() => setListFilter(active ? null : list.id)}
                onLongPress={() => setRenamingList({ id: list.id, name: list.name, emoji: list.emoji })}
              >
                <Text style={styles.listPillEmoji}>{list.emoji ?? "📚"}</Text>
                <Text style={[styles.listPillText, active && styles.listPillTextActive]} numberOfLines={1}>{list.name}</Text>
              </Pressable>
            );
          })}
          <Pressable style={styles.listPillNew} onPress={() => setCreateListOpen(true)}>
            <Ionicons name="add" size={14} color={c.teal} />
          </Pressable>
        </ScrollView>
      ) : null}

      {/* ── Search + view toggle ── */}
      <View style={styles.searchRow}>
        <TextInput
          placeholder={t("library.searchPlaceholder")}
          placeholderTextColor={c.gray}
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          maxLength={60}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <Pressable
          style={styles.controlBtn}
          onPress={() => setViewMode((v) => v === "grid" ? "list" : "grid")}
        >
          <Ionicons
            name={viewMode === "grid" ? "grid-outline" : "reorder-three-outline"}
            size={17}
            color={c.ink}
          />
        </Pressable>
      </View>

      {/* ── Simple filter tabs ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRail} contentContainerStyle={styles.chipRailContent}>
        {SIMPLE_FILTERS.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.simpleTab, filter === item.key && styles.simpleTabActive]}
            onPress={() => setFilter(item.key)}
          >
            <Text style={[styles.simpleTabText, filter === item.key && styles.simpleTabTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>


      {filteredBooks.length === 0 ? (
        books.length === 0 ? (
          /* ── Library is empty ── */
          <View style={styles.emptyState}>
            <Ionicons name="library-outline" size={44} color={c.teal} />
            <Text style={styles.emptyTitle}>{t("library.emptyTitle")}</Text>
            <Text style={styles.emptySub}>{t("library.emptyBody")}</Text>
            <Pressable style={styles.emptyButton} onPress={() => navigation.navigate("BookIntake")}>
              <Text style={styles.emptyButtonText}>{t("common.addBook")}</Text>
            </Pressable>
          </View>
        ) : (
          /* ── No search/filter matches ── */
          <NoMatchState
            query={query}
            styles={styles}
            c={c}
            onClear={clearFilters}
          />
        )
      ) : viewMode === "grid" ? (
        <View style={styles.grid}>
          {filteredBooks.map((book) => (
            <GridBookTile
              key={book.id}
              book={book}
              authorName={getAuthor(book.authorId)?.name ?? ""}
              styles={styles}
              onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}
              onLongPress={() => setDeleteTarget({ id: book.id, title: book.title })}
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
              onLongPress={() => setDeleteTarget({ id: book.id, title: book.title })}
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

      {/* Delete confirmation dialog */}
      <BooklioDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.title ?? ""}
        body="Remove this book from your library?"
        confirmLabel="Remove"
        cancelLabel="Keep it"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteBook(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </Screen>
  );
}

function NoMatchState({
  query,
  styles,
  c,
  onClear
}: {
  query: string;
  styles: ReturnType<typeof createStyles>;
  c: AppColors;
  onClear: () => void;
}) {
  const hasQuery = query.trim().length > 0;
  return (
    <View style={styles.noMatchWrap}>
      {/* Icon + badge anchored together */}
      <View style={styles.noMatchIconWrap}>
        <View style={styles.noMatchRingOuter}>
          <View style={styles.noMatchRingInner}>
            <Image
              source={require("../../assets/brand/bookliz-icon.png")}
              style={styles.noMatchIcon}
              resizeMode="contain"
            />
          </View>
        </View>
        <View style={styles.noMatchBadge}>
          <Ionicons name="search-outline" size={14} color="#fff" />
        </View>
      </View>

      <Text style={styles.noMatchTitle}>Sin resultados</Text>
      <Text style={styles.noMatchSub}>
        {hasQuery
          ? `No encontramos libros para "${query.trim()}"`
          : "Los filtros activos no tienen coincidencias"}
      </Text>

      <Pressable style={styles.noMatchClearBtn} onPress={onClear}>
        <Ionicons name="refresh-outline" size={14} color={c.teal} />
        <Text style={styles.noMatchClearText}>Limpiar búsqueda y filtros</Text>
      </Pressable>
    </View>
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
  onPress,
  onLongPress,
}: {
  book: Book;
  authorName: string;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const hasSeries = book.seriesName && book.seriesNumber;
  // Render cover image directly — bypasses BookCover dimension constraints
  const coverEl = book.coverImageUri ? (
    // resizeMode="contain" shows the full cover — no cropping, natural like Audible
    <View style={styles.tileCoverWrap}>
      <Image
        source={{ uri: book.coverImageUri }}
        style={styles.tileCoverImg}
        resizeMode="contain"
      />
    </View>
  ) : (
    <View style={[styles.tileCoverWrap, styles.tileCoverFallback]}>
      <Text numberOfLines={3} style={styles.tileCoverFallbackTitle}>{book.title}</Text>
      {authorName ? <Text numberOfLines={1} style={styles.tileCoverFallbackAuthor}>{authorName}</Text> : null}
    </View>
  );

  return (
    <Pressable style={styles.bookTile} onPress={onPress} onLongPress={onLongPress}>
      {coverEl}
      <Text numberOfLines={2} style={styles.bookTitle}>{book.title}</Text>
      <Text numberOfLines={1} style={styles.bookAuthor}>{authorName}</Text>
      {hasSeries ? (
        <Text numberOfLines={1} style={styles.bookSeries}>
          Book {book.seriesNumber} · {book.seriesName}
        </Text>
      ) : null}
    </Pressable>
  );
}

function LibraryRowCard({
  book,
  authorName,
  styles,
  onPress,
  onLongPress,
  onOpenSeries,
}: {
  book: Book;
  authorName: string;
  latestLogDate?: string;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
  onLongPress: () => void;
  onOpenSeries?: () => void;
}) {
  const progress = book.userStatus.progressPercent ?? 0;
  const isReading = book.userStatus.status === "reading";
  const isRead = book.userStatus.status === "read";
  const isDnf = book.userStatus.status === "dnf";

  const openGetLink = () => {
    const query = encodeURIComponent(`${book.title} ${authorName}`);
    // Amazon search with affiliate tag — swap tag for your Associates ID
    void Linking.openURL(`https://www.amazon.com/s?k=${query}&tag=bookliz-20`);
  };

  return (
    <Pressable style={styles.rowCard} onPress={onPress} onLongPress={onLongPress}>
      <BookCover book={book} size="sm" style={styles.rowCover} hideProgress />

      <View style={styles.rowCopy}>
        <Text numberOfLines={2} style={styles.rowTitle}>{book.title}</Text>
        <Text numberOfLines={1} style={styles.rowAuthor}>{authorName}</Text>

        {book.seriesName ? (
          <Pressable onPress={onOpenSeries}>
            <Text numberOfLines={1} style={styles.rowSeries}>
              {book.seriesNumber ? `Book ${book.seriesNumber} · ` : ""}{book.seriesName}
            </Text>
          </Pressable>
        ) : null}

        {isReading && progress > 0 ? (
          <View style={styles.rowProgressWrap}>
            <Text style={styles.rowProgressText}>{progress}% complete</Text>
            <View style={styles.rowProgressTrack}>
              <View style={[styles.rowProgressFill, { width: `${progress}%` as `${number}%` }]} />
            </View>
          </View>
        ) : isRead ? (
          <Text style={styles.rowStatusFinished}>Finished</Text>
        ) : isDnf ? (
          <Text style={styles.rowStatusDnf}>Did not finish</Text>
        ) : null}
      </View>

      <Pressable style={styles.rowGetBtn} onPress={openGetLink} hitSlop={8}>
        <Text style={styles.rowGetText}>Get</Text>
      </Pressable>
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
    }, // kept for i18n references, not rendered
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
    listsRail: {
      marginBottom: spacing.sm,
      marginTop: spacing.xs
    },
    listsRailContent: {
      gap: spacing.xs,
      paddingRight: spacing.sm,
      alignItems: "center"
    },
    listPill: {
      alignItems: "center",
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 7
    },
    listPillActive: {
      backgroundColor: c.navy,
      borderColor: c.navy
    },
    listPillEmoji: {
      fontSize: 13
    },
    listPillText: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800"
    },
    listPillTextActive: {
      color: "#FFFFFF"
    },
    listPillNew: {
      alignItems: "center",
      borderColor: c.teal + "60",
      borderRadius: radii.pill,
      borderStyle: "dashed",
      borderWidth: 1,
      height: 32,
      justifyContent: "center",
      width: 32
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
    controlBtn: {
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44
    },
    controlBtnActive: {
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
      marginTop: spacing.md,
    },
    chipRailContent: {
      gap: spacing.sm,
      paddingBottom: spacing.xs,
    },
    simpleTab: {
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 9,
    },
    simpleTabActive: {
      backgroundColor: c.gold,
      borderColor: c.gold,
    },
    simpleTabText: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
    },
    simpleTabTextActive: {
      color: "#0F172A",
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    bookTile: {
      width: "48%",
    },
    // Outer box: defines shape + dark bg. Inner image: full cover, no crop.
    tileCoverWrap: {
      aspectRatio: 2 / 3,
      backgroundColor: "#111827",   // near-black — neutral backdrop for any cover
      borderRadius: 10,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
      width: "100%",
    },
    tileCoverImg: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
    },
    tileCoverFallback: {
      alignItems: "flex-start",
      backgroundColor: c.surfaceAlt,
      justifyContent: "flex-end",
      padding: 12,
    },
    tileCoverFallbackTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 18,
    },
    tileCoverFallbackAuthor: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 11,
      marginTop: 4,
    },
    bookTitle: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
      lineHeight: 18,
      marginTop: 8,
    },
    bookAuthor: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
    },
    bookSeries: {
      color: c.tealDark,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 15,
      marginTop: 3,
    },
    listWrap: {
      gap: 0,
    },
    rowCard: {
      alignItems: "center",
      borderBottomColor: c.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    rowCover: {
      borderRadius: 12,
      height: 80,
      width: 80,   // square, like Audible
    },
    rowCopy: {
      flex: 1,
      gap: 3,
    },
    rowTitle: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
      lineHeight: 20,
    },
    rowAuthor: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 13,
      lineHeight: 18,
    },
    rowSeries: {
      color: c.tealDark,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "700",
    },
    rowProgressWrap: {
      gap: 4,
      marginTop: 2,
    },
    rowProgressText: {
      color: c.gold,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "700",
    },
    rowProgressTrack: {
      backgroundColor: c.border,
      borderRadius: 2,
      height: 3,
      overflow: "hidden",
      width: "100%",
    },
    rowProgressFill: {
      backgroundColor: c.gold,
      borderRadius: 2,
      height: 3,
    },
    rowStatusFinished: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 12,
      marginTop: 2,
    },
    rowStatusDnf: {
      color: c.danger,
      fontFamily: fonts.bodyRegular,
      fontSize: 12,
      marginTop: 2,
    },
    rowGetBtn: {
      backgroundColor: c.gold,
      borderRadius: radii.pill,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    rowGetText: {
      color: "#0F172A",
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900",
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
    },

    // ── No-match illustrated state ──
    noMatchWrap: {
      alignItems: "center",
      marginTop: spacing.xl,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl
    },
    noMatchIconWrap: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg
    },
    noMatchRingOuter: {
      alignItems: "center",
      backgroundColor: c.navy + "18",
      borderColor: c.teal + "30",
      borderRadius: 80,
      borderWidth: 1.5,
      height: 160,
      justifyContent: "center",
      width: 160
    },
    noMatchRingInner: {
      alignItems: "center",
      backgroundColor: c.navy,
      borderRadius: 60,
      height: 120,
      justifyContent: "center",
      width: 120
    },
    noMatchIcon: {
      height: 72,
      opacity: 0.55,
      width: 72
    },
    noMatchBadge: {
      alignItems: "center",
      backgroundColor: c.coral,
      borderColor: c.surface,
      borderRadius: 16,
      borderWidth: 2.5,
      bottom: 4,
      height: 32,
      justifyContent: "center",
      position: "absolute",
      right: 4,
      width: 32
    },
    noMatchTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 22,
      fontWeight: "900",
      marginBottom: spacing.xs,
      textAlign: "center"
    },
    noMatchSub: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: spacing.lg,
      textAlign: "center"
    },
    noMatchClearBtn: {
      alignItems: "center",
      borderColor: c.teal,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: spacing.lg,
      paddingVertical: 12
    },
    noMatchClearText: {
      color: c.teal,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900"
    }
  });
}
