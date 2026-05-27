import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { AppColors, fonts, radii, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

export function BooklioDialog({
  open,
  title,
  body,
  confirmLabel = "Okay",
  onConfirm
}: Props) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onConfirm}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onConfirm} />
        <View style={styles.card}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable style={styles.button} onPress={onConfirm}>
            <Text style={styles.buttonText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    overlay: {
      alignItems: "center",
      backgroundColor: c.navy + "57",
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.lg
    },
    card: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: 30,
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      width: "100%"
    },
    handle: {
      alignSelf: "center",
      backgroundColor: c.border,
      borderRadius: radii.pill,
      height: 4,
      marginBottom: spacing.md,
      width: 42
    },
    title: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 28,
      fontWeight: "900",
      lineHeight: 32
    },
    body: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 15,
      lineHeight: 23,
      marginTop: spacing.sm
    },
    button: {
      alignItems: "center",
      backgroundColor: c.navy,
      borderRadius: radii.pill,
      marginTop: spacing.lg,
      paddingVertical: 15
    },
    buttonText: {
      color: c.surface,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900"
    }
  });
}
