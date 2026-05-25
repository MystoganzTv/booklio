import { StyleSheet, Text, View } from "react-native";
import { ReadingSession } from "../types/models";
import { colors, fonts, radii, spacing } from "../theme/theme";

type SessionRowProps = {
  session: ReadingSession;
  bookTitle: string;
};

export function SessionRow({ session, bookTitle }: SessionRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.datePill}>
        <Text style={styles.dateMonth}>
          {new Date(`${session.date}T00:00:00`).toLocaleDateString("en-US", { month: "short" })}
        </Text>
        <Text style={styles.dateDay}>{new Date(`${session.date}T00:00:00`).getDate()}</Text>
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.book}>
          {bookTitle}
        </Text>
        <Text style={styles.meta}>
          {session.pagesRead} pages - {session.minutesRead} min - {Math.round(session.pagesPerHour)} pp/h
        </Text>
        <Text numberOfLines={2} style={styles.notes}>
          {session.mood} at {session.location}. {session.notes}
        </Text>
      </View>
      <Text style={styles.rating}>{session.enjoymentRating}/10</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md
  },
  datePill: {
    alignItems: "center",
    backgroundColor: colors.navy,
    borderRadius: radii.md,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 54
  },
  dateMonth: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  dateDay: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "900"
  },
  body: {
    flex: 1
  },
  book: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "800"
  },
  meta: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3
  },
  notes: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4
  },
  rating: {
    color: colors.green,
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "900"
  }
});
