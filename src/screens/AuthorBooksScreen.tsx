import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookCover } from "../components/BookCover";
import { useBookliz } from "../data/BooklizContext";
import { RootStackParamList } from "../navigation/types";
import { Book } from "../types/models";
import { AppColors, fonts, radii, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";
import { formatStatusLabel } from "../utils/statusLabels";

export function AuthorBooksScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "AuthorBooks">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(c), [c]);
  const { books } = useBookliz();

  const { authorId, authorName } = route.params;

  const authorBooks = useMemo(
    () => books.filter((b) => b.authorId === authorId),
    [books, authorId]
  );

  function renderBook({ item }: { item: Book }) {
    const isReading = item.userStatus.status === "reading";
    const isRead = item.userStatus.status === "read";
    const isDnf = item.userStatus.status === "dnf";
    const progress = item.userStatus.progressPercent ?? 0;

    return (
      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate("BookDetail", { bookId: item.id })}
      >
        <BookCover book={item} size="sm" style={styles.cover} hideProgress />

        <View style={styles.info}>
          <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
          {item.seriesName ? (
            <Text numberOfLines={1} style={styles.series}>
              {item.seriesNumber ? `Book ${item.seriesNumber} · ` : ""}
              {item.seriesName}
            </Text>
          ) : null}

          {isReading && progress > 0 ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` as `${number}%` }]} />
              </View>
              <Text style={styles.progressText}>{progress}%</Text>
            </View>
          ) : isRead ? (
            <View style={styles.statusPill}>
              <Ionicons name="checkmark-circle" size={11} color={c.teal} />
              <Text style={[styles.statusText, { color: c.teal }]}>Finished</Text>
            </View>
          ) : isDnf ? (
            <View style={styles.statusPill}>
              <Ionicons name="close-circle" size={11} color={c.danger} />
              <Text style={[styles.statusText, { color: c.danger }]}>Did not finish</Text>
            </View>
          ) : (
            <View style={styles.statusPill}>
              <Ionicons name="bookmark-outline" size={11} color={c.muted} />
              <Text style={[styles.statusText, { color: c.muted }]}>
                {formatStatusLabel(item.userStatus.status)}
              </Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={16} color={c.muted} />
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={c.ink} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Author</Text>
          <Text numberOfLines={1} style={styles.heading}>{authorName}</Text>
        </View>
      </View>

      <FlatList
        data={authorBooks}
        keyExtractor={(b) => b.id}
        renderItem={renderBook}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="book-outline" size={36} color={c.muted} />
            <Text style={styles.emptyText}>No books in your library</Text>
          </View>
        }
      />
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: c.bg,
      flex: 1,
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.md,
    },
    backBtn: {
      padding: 4,
    },
    headerText: {
      flex: 1,
    },
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
    list: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs,
    },
    separator: {
      backgroundColor: c.border,
      height: StyleSheet.hairlineWidth,
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      paddingVertical: 12,
    },
    cover: {
      borderRadius: radii.sm,
      height: 72,
      width: 48,
    },
    info: {
      flex: 1,
      gap: 3,
    },
    title: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 20,
    },
    series: {
      color: c.tealDark,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "600",
    },
    progressWrap: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
      marginTop: 2,
    },
    progressTrack: {
      backgroundColor: c.border,
      borderRadius: 2,
      flex: 1,
      height: 2,
      overflow: "hidden",
    },
    progressFill: {
      backgroundColor: c.teal,
      borderRadius: 2,
      height: 2,
    },
    progressText: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "600",
    },
    statusPill: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      marginTop: 2,
    },
    statusText: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "600",
    },
    empty: {
      alignItems: "center",
      gap: 12,
      paddingTop: 80,
    },
    emptyText: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 15,
    },
  });
}
