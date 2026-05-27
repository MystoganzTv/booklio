import { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";

type BrandHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

const booklioLogo = require("../../assets/brand/booklio-logo.png");

export function BrandHeader({ eyebrow, title, subtitle }: BrandHeaderProps) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  return (
    <View style={styles.card}>
      <Image source={booklioLogo} style={styles.logo} resizeMode="contain" />
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    card: {
      ...shadows.card,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      marginBottom: spacing.md,
      padding: spacing.lg
    },
    logo: {
      alignSelf: "center",
      height: 108,
      marginBottom: spacing.sm,
      width: "78%"
    },
    eyebrow: {
      color: c.tealDark,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 1.4,
      textTransform: "uppercase"
    },
    title: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 34,
      fontWeight: "900",
      lineHeight: 39,
      marginTop: 4
    },
    subtitle: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 14,
      lineHeight: 21,
      marginTop: spacing.sm
    }
  });
}
