import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppColors, fonts, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
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

function createStyles(c: AppColors) {
  return StyleSheet.create({
    wrap: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
      marginTop: spacing.lg,
    },
    title: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 23,
      fontWeight: "800",
    },
    action: {
      color: c.gold,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
    },
  });
}
