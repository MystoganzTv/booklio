import { Pressable, StyleSheet, Text, View } from "react-native";
import { Book } from "../types/models";
import { colors, fonts, spacing } from "../theme/theme";
import { formatStatusLabel } from "../utils/statusLabels";
import { BookCover } from "./BookCover";

type BookCardProps = {
  book: Book;
  authorName: string;
  compact?: boolean;
  onPress?: () => void;
};

export function BookCard({ book, authorName, compact = false, onPress }: BookCardProps) {
  const meta = book.userStatus.rating
    ? `${book.userStatus.rating} stars`
    : formatStatusLabel(book.userStatus.status);

  return (
    <Pressable style={[styles.card, compact && styles.compact]} onPress={onPress}>
      <BookCover
        book={book}
        size={compact ? "sm" : "md"}
        style={compact ? undefined : styles.cover}
      />
      <View style={styles.copy}>
        <Text numberOfLines={2} style={styles.title}>
          {book.title}
        </Text>
        <Text numberOfLines={1} style={styles.author}>
          By {authorName}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>{meta}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginRight: spacing.md,
    width: 168
  },
  compact: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
    marginRight: 0,
    width: "100%"
  },
  cover: {
    height: 236,
    width: "100%"
  },
  copy: {
    flex: 1,
    marginTop: spacing.sm
  },
  title: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 19
  },
  author: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3
  },
  meta: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 5,
    textTransform: "uppercase"
  }
});
