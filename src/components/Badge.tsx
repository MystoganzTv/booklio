import { useMemo } from "react";
import { Text, StyleSheet } from "react-native";
import { AppColors, fonts, radii } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";

type BadgeTone = "gold" | "green" | "gray" | "danger" | "navy" | "teal" | "coral";

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

export function Badge({ label, tone = "gray" }: BadgeProps) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const toneStyles = useMemo<Record<BadgeTone, { backgroundColor: string; color: string }>>(() => ({
    gold: { backgroundColor: c.gold + "26", color: c.gold },
    green: { backgroundColor: c.green + "26", color: c.green },
    gray: { backgroundColor: c.surfaceAlt, color: c.muted },
    danger: { backgroundColor: c.danger + "24", color: c.danger },
    navy: { backgroundColor: c.navy + "16", color: c.navy },
    teal: { backgroundColor: c.teal + "24", color: c.tealDark },
    coral: { backgroundColor: c.coral + "22", color: c.coral }
  }), [c]);
  return <Text style={[styles.badge, toneStyles[tone]]}>{label}</Text>;
}

function createStyles(_: AppColors) {
  return StyleSheet.create({
    badge: {
      alignSelf: "flex-start",
      borderRadius: radii.pill,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.4,
      overflow: "hidden",
      paddingHorizontal: 9,
      paddingVertical: 5,
      textTransform: "uppercase"
    }
  });
}
