import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BookCover } from "./BookCover";
import { useBookliz } from "../data/BooklizContext";
import { RootStackParamList, MainTabParamList } from "../navigation/types";
import { fonts, radii, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";
import { Book } from "../types/models";

// ─── Mood → genre mapping ─────────────────────────────────────────────────────

const MOOD_GENRES: Record<string, string[]> = {
  exciting:   ["Thriller", "Adventure"],
  scary:      ["Horror"],
  thought:    ["Literary Fiction", "Nonfiction", "Science Fiction", "History"],
  inspiring:  ["Biography", "Personal Growth", "Nonfiction"],
  heartfelt:  ["Romance", "Literary Fiction"],
  dark:       ["Horror", "Thriller", "Fantasy"],
  feelgood:   ["Romance", "Young Adult"],
  gripping:   ["Literary Fiction", "Thriller", "Mystery"],
  funny:      ["Young Adult", "Literary Fiction"],
  cozy:       ["Mystery", "Romance"],
  fastpaced:  ["Thriller", "Adventure", "Science Fiction", "Mystery"],
  epic:       ["Fantasy", "Science Fiction", "Adventure", "Historical Fiction"],
};

// ─── Status sort order ────────────────────────────────────────────────────────

const STATUS_ORDER: Record<string, number> = {
  reading:          0,
  "want-to-read":   1,
  wishlist:         2,
  "want-to-buy":    3,
  read:             4,
  dnf:              5,
  "upcoming-release": 6,
};

function sortByStatus(a: Book, b: Book) {
  return (STATUS_ORDER[a.userStatus.status] ?? 99) - (STATUS_ORDER[b.userStatus.status] ?? 99);
}

// ─── Props ────────────────────────────────────────────────────────────────────

type MoodInfo = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  grad: [string, string];
};

type Props = {
  mood: MoodInfo | null;
  onClose: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function MoodBooksSheet({ mood, onClose }: Props) {
  const c = useColors();
  const navigation = useNavigation<NavigationProp<RootStackParamList & MainTabParamList>>();
  const { books, authors } = useBookliz();
  const styles = useMemo(() => createStyles(), []);

  const matchingBooks = useMemo(() => {
    if (!mood) return [];
    const genres = MOOD_GENRES[mood.id] ?? [];
    return books
      .filter((book) => book.genre.some((g) => genres.includes(g)))
      .sort(sortByStatus);
  }, [mood, books]);

  if (!mood) return null;

  function authorName(book: Book) {
    return authors.find((a) => a.id === book.authorId)?.name ?? "";
  }

  function statusLabel(book: Book) {
    const s = book.userStatus.status;
    if (s === "reading")        return { text: "Reading", color: c.teal };
    if (s === "want-to-read")   return { text: "Want to read", color: c.gold };
    if (s === "read")           return { text: "Read", color: c.muted };
    if (s === "wishlist")       return { text: "Wishlist", color: c.muted };
    return null;
  }

  return (
    <Modal visible={!!mood} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: c.surface }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: c.border }]} />

          {/* Mood header */}
          <View style={styles.moodHeader}>
            <LinearGradient
              colors={mood.grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.moodIcon}
            >
              <Ionicons name={mood.icon} size={26} color="rgba(255,255,255,0.92)" />
            </LinearGradient>
            <View style={styles.moodHeaderText}>
              <Text style={[styles.moodLabel, { color: c.ink }]}>{mood.label}</Text>
              <Text style={[styles.moodCount, { color: c.muted }]}>
                {matchingBooks.length === 0
                  ? "No books in your library"
                  : `${matchingBooks.length} book${matchingBooks.length === 1 ? "" : "s"} in your library`}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Ionicons name="close" size={20} color={c.muted} />
            </Pressable>
          </View>

          {/* Book list */}
          {matchingBooks.length > 0 ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            >
              {matchingBooks.map((book) => {
                const status = statusLabel(book);
                return (
                  <Pressable
                    key={book.id}
                    style={[styles.bookRow, { borderBottomColor: c.border }]}
                    onPress={() => {
                      onClose();
                      navigation.navigate("BookDetail", { bookId: book.id });
                    }}
                  >
                    <BookCover book={book} size="sm" style={styles.cover} />
                    <View style={styles.bookInfo}>
                      <Text numberOfLines={2} style={[styles.bookTitle, { color: c.ink }]}>
                        {book.title}
                      </Text>
                      <Text numberOfLines={1} style={[styles.bookAuthor, { color: c.muted }]}>
                        {authorName(book)}
                      </Text>
                      {book.genre.length > 0 && (
                        <Text numberOfLines={1} style={[styles.bookGenres, { color: c.muted }]}>
                          {book.genre.slice(0, 2).join(" · ")}
                        </Text>
                      )}
                      {status && (
                        <Text style={[styles.statusPill, { color: status.color }]}>
                          {status.text}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={c.border} />
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={mood.grad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyIcon}
              >
                <Ionicons name={mood.icon} size={32} color="rgba(255,255,255,0.9)" />
              </LinearGradient>
              <Text style={[styles.emptyTitle, { color: c.ink }]}>
                Nothing here yet
              </Text>
              <Text style={[styles.emptySub, { color: c.muted }]}>
                Add some {mood.label.toLowerCase()} books to your library to see them here.
              </Text>
              <Pressable
                style={[styles.emptyBtn, { backgroundColor: c.teal }]}
                onPress={() => {
                  onClose();
                  navigation.navigate("Add");
                }}
              >
                <Ionicons name="search-outline" size={15} color="#fff" />
                <Text style={styles.emptyBtnText}>Search for books</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles() {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    sheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "82%",
      paddingBottom: 44,
      paddingTop: spacing.md,
      width: "100%",
    },
    handle: {
      alignSelf: "center",
      borderRadius: radii.pill,
      height: 4,
      marginBottom: spacing.md,
      width: 40,
    },

    // ── Mood header ───────────────────────────────────────────────────────
    moodHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    moodIcon: {
      alignItems: "center",
      borderRadius: 14,
      height: 52,
      justifyContent: "center",
      width: 52,
    },
    moodHeaderText: { flex: 1 },
    moodLabel: {
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "900",
    },
    moodCount: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2,
    },
    closeBtn: {
      padding: 4,
    },

    // ── Book list ─────────────────────────────────────────────────────────
    listContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
    },
    bookRow: {
      alignItems: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 12,
      paddingVertical: 12,
    },
    cover: {
      borderRadius: radii.sm,
      height: 72,
      width: 48,
    },
    bookInfo: { flex: 1 },
    bookTitle: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
      lineHeight: 19,
    },
    bookAuthor: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2,
    },
    bookGenres: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 2,
      opacity: 0.7,
    },
    statusPill: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      marginTop: 4,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },

    // ── Empty state ───────────────────────────────────────────────────────
    emptyState: {
      alignItems: "center",
      gap: 12,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xl,
    },
    emptyIcon: {
      alignItems: "center",
      borderRadius: 24,
      height: 80,
      justifyContent: "center",
      marginBottom: 4,
      width: 80,
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
