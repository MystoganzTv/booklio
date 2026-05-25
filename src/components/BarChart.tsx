import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radii, spacing } from "../theme/theme";

type BarChartProps = {
  data: { label: string; value: number }[];
  max?: number;
};

export function BarChart({ data, max }: BarChartProps) {
  const peak = max ?? Math.max(1, ...data.map((item) => item.value));

  return (
    <View style={styles.wrap}>
      {data.map((item) => (
        <View key={`${item.label}-${item.value}`} style={styles.row}>
          <Text numberOfLines={1} style={styles.label}>
            {item.label}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(8, (item.value / peak) * 100)}%` }]} />
          </View>
          <Text style={styles.value}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  label: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800",
    width: 74
  },
  track: {
    backgroundColor: "#EEE7DB",
    borderRadius: radii.pill,
    flex: 1,
    height: 10,
    overflow: "hidden"
  },
  fill: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    height: "100%"
  },
  value: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
    width: 34
  }
});
