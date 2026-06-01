import { PropsWithChildren, ReactNode, useMemo } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { useColors } from "../theme/ThemeContext";
import { spacing } from "../theme/theme";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: ViewStyle;
  headerRight?: ReactNode;
}>;

export function Screen({ children, scroll = true, contentStyle, headerRight }: ScreenProps) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);

  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safe, contentStyle]}>
        {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
        {children}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: {
      backgroundColor: c.bg,
      flex: 1,
    },
    content: {
      paddingBottom: 124,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
    headerRight: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
    },
  });
}
