import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, spacing } from "../theme/theme";

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    marginTop: spacing.lg
  },
  title: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 23,
    fontWeight: "800"
  },
  action: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800"
  }
});
