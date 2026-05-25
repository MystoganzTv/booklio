import { Pressable, StyleSheet, Text, View } from "react-native";
import { Book } from "../types/models";
import { colors, fonts, spacing } from "../theme/theme";
import { Badge } from "./Badge";
import { BookCover } from "./BookCover";

type BookCardProps = {
  book: Book;
  authorName: string;
  compact?: boolean;
  onPress?: () => void;
};

export function BookCard({ book, authorName, compact = false, onPress }: BookCardProps) {
  const badges = [
    book.userStatus.ownership === "owned" ? "Owned" : null,
    book.userStatus.wishlist ? "Wishlist" : null,
    book.userStatus.wantToBuy ? "Buy" : null
  ].filter(Boolean);

  return (
    <Pressable style={[styles.card, compact && styles.compact]} onPress={onPress}>
      <BookCover book={book} size={compact ? "sm" : "md"} />
      <View style={styles.copy}>
        <Text numberOfLines={2} style={styles.title}>
          {book.title}
        </Text>
        <Text numberOfLines={1} style={styles.author}>
          {authorName}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {book.seriesName ? `${book.seriesName} #${book.seriesNumber}` : book.genre[0]}
        </Text>
        <View style={styles.badges}>
          {badges.slice(0, 2).map((badge) => (
            <Badge key={badge} label={badge ?? ""} tone={badge === "Owned" ? "green" : badge === "Buy" ? "gold" : "navy"} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginRight: spacing.md,
    width: 132
  },
  compact: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
    marginRight: 0,
    width: "100%"
  },
  copy: {
    flex: 1,
    marginTop: spacing.sm
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 20
  },
  author: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3
  },
  meta: {
    color: colors.gray,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 3
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8
  }
});
