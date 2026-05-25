import { Text, StyleSheet } from "react-native";
import { colors, fonts, radii } from "../theme/theme";

type BadgeTone = "gold" | "green" | "gray" | "danger" | "navy" | "teal" | "coral";

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

const toneStyles: Record<BadgeTone, { backgroundColor: string; color: string }> = {
  gold: { backgroundColor: "#FFF1C2", color: "#7B5600" },
  green: { backgroundColor: "#E4F0D8", color: "#3F6F35" },
  gray: { backgroundColor: "#EEEAE4", color: colors.muted },
  danger: { backgroundColor: "#FFE0D8", color: colors.danger },
  navy: { backgroundColor: "#E0E7FF", color: colors.navy },
  teal: { backgroundColor: "#DDF7F4", color: colors.tealDark },
  coral: { backgroundColor: "#FFE1D8", color: colors.coral }
};

export function Badge({ label, tone = "gray" }: BadgeProps) {
  return <Text style={[styles.badge, toneStyles[tone]]}>{label}</Text>;
}

const styles = StyleSheet.create({
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
