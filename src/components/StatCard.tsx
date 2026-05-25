import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

type StatCardProps = {
  label: string;
  value: string | number;
  detail?: string;
  accent?: "gold" | "green" | "navy";
};

export function StatCard({ label, value, detail, accent = "gold" }: StatCardProps) {
  const accentColor = accent === "green" ? colors.green : accent === "navy" ? colors.navy : colors.gold;

  return (
    <View style={styles.card}>
      <View style={[styles.rule, { backgroundColor: accentColor }]} />
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadows.card,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    minWidth: 142,
    overflow: "hidden",
    padding: spacing.md
  },
  rule: {
    borderRadius: radii.pill,
    height: 4,
    marginBottom: spacing.sm,
    width: 44
  },
  value: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 27,
    fontWeight: "800"
  },
  label: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
    textTransform: "uppercase"
  },
  detail: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 5
  }
});
