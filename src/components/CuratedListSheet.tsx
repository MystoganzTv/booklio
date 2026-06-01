import { Ionicons } from "@expo/vector-icons";
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

// ─── Props ────────────────────────────────────────────────────────────────────

export type CuratedList = {
  id: string;
  title: string;
  emoji: string;
  description: string;
  accentColor: string;
  books: Book[];
};

type Props = {
  list: CuratedList | null;
  onClose: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CuratedListSheet({ list, onClose }: Props) {
  const c = useColors();
  const navigation = useNavigation<NavigationProp<RootStackParamList & MainTabParamList>>();
  const { authors } = useBookliz();
  const styles = useMemo(() => createStyles(), []);

  if (!list) return null;

  function authorName(book: Book) {
    return authors.find((a) => a.id === book.authorId)?.name ?? "";
  }

  function statusLabel(book: Book) {
    const s = book.userStatus.status;
    if (s === "reading")       return { text: "Reading now", color: c.teal };
    if (s === "want-to-read")  return { text: "Want to read", color: c.gold };
    if (s === "read" && book.userStatus.rating)
      return { text: `${"★".repeat(book.userStatus.rating)} ${book.userStatus.rating}/5`, color: c.gold };
    if (s === "read")          return { text: "Read", color: c.muted };
    if (s === "dnf")           return { text: "Did not finish", color: c.coral };
    return null;
  }

  return (
    <Modal visible={!!list} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: c.surface }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: c.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.emojiWrap, { backgroundColor: list.accentColor + "22", borderColor: list.accentColor + "44" }]}>
              <Text style={styles.emoji}>{list.emoji}</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: c.ink }]}>{list.title}</Text>
              <Text style={[styles.description, { color: c.muted }]}>{list.description}</Text>
              <Text style={[styles.count, { color: list.accentColor }]}>
                {list.books.length} {list.books.length === 1 ? "book" : "books"}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={20} color={c.muted} />
            </Pressable>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: c.border }]} />

          {/* Book list */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {list.books.map((book, index) => {
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
                  {/* Rank number */}
                  <Text style={[styles.rank, { color: c.muted }]}>{index + 1}</Text>

                  <BookCover book={book} size="sm" style={styles.cover} />

                  <View style={styles.bookInfo}>
                    <Text numberOfLines={2} style={[styles.bookTitle, { color: c.ink }]}>
                      {book.title}
                    </Text>
                    <Text numberOfLines={1} style={[styles.bookAuthor, { color: c.muted }]}>
                      {authorName(book)}
                    </Text>
                    {book.pages > 0 && (
                      <Text style={[styles.bookMeta, { color: c.muted }]}>
                        {book.pages} pages{book.genre[0] ? ` · ${book.genre[0]}` : ""}
                      </Text>
                    )}
                    {status && (
                      <Text style={[styles.statusLabel, { color: status.color }]}>
                        {status.text}
                      </Text>
                    )}
                  </View>

                  <Ionicons name="chevron-forward" size={16} color={c.border} />
                </Pressable>
              );
            })}
          </ScrollView>
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

    // ── Header ────────────────────────────────────────────────────────────
    header: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    emojiWrap: {
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      height: 52,
      justifyContent: "center",
      width: 52,
    },
    emoji: {
      fontSize: 26,
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "900",
    },
    description: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
      marginTop: 2,
    },
    count: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
      marginTop: 4,
    },

    divider: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.xs,
    },

    // ── Book list ─────────────────────────────────────────────────────────
    listContent: {
      paddingHorizontal: spacing.lg,
    },
    bookRow: {
      alignItems: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 10,
      paddingVertical: 12,
    },
    rank: {
      fontFamily: fonts.display,
      fontSize: 13,
      fontWeight: "900",
      width: 18,
      textAlign: "center",
    },
    cover: {
      borderRadius: radii.sm,
      height: 72,
      width: 48,
    },
    bookInfo: {
      flex: 1,
    },
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
    bookMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 2,
      opacity: 0.7,
    },
    statusLabel: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.3,
      marginTop: 4,
      textTransform: "uppercase",
    },
  });
}
