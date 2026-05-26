import { Pressable, StyleSheet, Text, View } from "react-native";
import { Book, Recommendation } from "../types/models";
import { colors, fonts, radii, spacing } from "../theme/theme";
import { BookCover } from "./BookCover";

type RecommendationCardProps = {
  recommendation: Recommendation;
  book: Book;
  authorName: string;
  compact?: boolean;
  onPress?: () => void;
};

export function RecommendationCard({
  recommendation,
  book,
  authorName,
  compact = false,
  onPress
}: RecommendationCardProps) {
  return (
    <Pressable style={[styles.card, compact && styles.cardCompact]} onPress={onPress}>
      <BookCover book={book} size={compact ? "sm" : "md"} style={!compact ? styles.cover : undefined} />
      <View style={styles.copy}>
        <View style={styles.topline}>
          <Text style={styles.reason}>{formatReason(recommendation.reason)}</Text>
          <Text style={styles.confidence}>{recommendation.confidence}%</Text>
        </View>
        <Text numberOfLines={2} style={styles.title}>{book.title}</Text>
        <Text numberOfLines={1} style={styles.author}>By {authorName}</Text>
        <Text numberOfLines={compact ? 2 : 3} style={styles.note}>{recommendation.note}</Text>
      </View>
    </Pressable>
  );
}

function formatReason(reason: Recommendation["reason"]) {
  switch (reason) {
    case "continue-saga": return "Continue saga";
    case "same-author": return "Same author";
    case "same-saga": return "Same saga";
    case "same-genre": return "Same genre";
    case "upcoming-release": return "Release radar";
    case "because-you-liked": return "Because you liked";
    case "reading-log-habits": return "Habit fit";
    case "users-also-liked": return "Readers also liked";
    default: return "For you";
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginRight: spacing.md,
    padding: spacing.md,
    width: 240
  },
  cardCompact: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
    marginRight: 0,
    width: "100%"
  },
  cover: {
    height: 184,
    width: "100%"
  },
  copy: {
    flex: 1,
    marginTop: spacing.sm
  },
  topline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  reason: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  confidence: {
    color: "#D9D4CA",
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "900"
  },
  title: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 22,
    marginTop: 6
  },
  author: {
    color: "#D8D2C8",
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginTop: 4
  },
  note: {
    color: "#F3E9D2",
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8
  }
});
