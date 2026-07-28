import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { GoogleConnectionCard } from "../components/GoogleConnectionCard";
import { Screen } from "../components/Screen";
import { useI18n } from "../i18n/LocalizationContext";
import { RootStackParamList } from "../navigation/types";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors, useTheme } from "../theme/ThemeContext";

const booklizLogoLight = require("../../assets/brand/bookliz-logo.png");
const booklizLogoDark = require("../../assets/brand/bookliz-logo-dark.png");

export function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const c = useColors();
  const { isDark } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(c), [c]);
  const logoSource = isDark ? booklizLogoDark : booklizLogoLight;

  const heroTags = [
    t("welcome.tagCollector"),
    t("welcome.tagSession"),
    t("welcome.tagStats"),
    t("welcome.tagSaga"),
  ];

  const featureTiles = [
    {
      icon: "library-outline" as const,
      title: t("welcome.feature1Title"),
      body: t("welcome.feature1Body"),
    },
    {
      icon: "time-outline" as const,
      title: t("welcome.feature2Title"),
      body: t("welcome.feature2Body"),
    },
    {
      icon: "sparkles-outline" as const,
      title: t("welcome.feature3Title"),
      body: t("welcome.feature3Body"),
    },
  ];

  return (
    <Screen contentStyle={styles.safe}>
      <View style={styles.heroCard}>
        <View style={styles.heroGlowTop} />
        <View style={styles.heroGlowBottom} />

        <View style={styles.logoShell}>
          <Image source={logoSource} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>{t("welcome.eyebrow")}</Text>
          <Text style={styles.title}>{t("welcome.title")}</Text>
          <Text style={styles.subtitle}>{t("welcome.subtitle")}</Text>
        </View>

        <View style={styles.tagRow}>
          {heroTags.map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <LinearGradient
          colors={[c.gold + "26", c.teal + "1A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.promiseCard}
        >
          <Text style={styles.promiseLead}>{t("welcome.promiseLead")}</Text>
          <Text style={styles.promiseBody}>{t("welcome.promiseBody")}</Text>
        </LinearGradient>
      </View>

      <View style={styles.featureGrid}>
        {featureTiles.map((tile, index) => (
          <View
            key={tile.title}
            style={[
              styles.featureCard,
              index === 2 ? styles.featureCardWide : styles.featureCardHalf
            ]}
          >
            <View style={styles.featureIcon}>
              <Ionicons name={tile.icon} size={18} color={c.surface} />
            </View>
            <Text style={styles.featureTitle}>{tile.title}</Text>
            <Text style={styles.featureBody}>{tile.body}</Text>
          </View>
        ))}
      </View>

      <GoogleConnectionCard variant="onboarding" />

      <Pressable accessibilityRole="button" style={styles.skipRow} onPress={() => navigation.navigate("AppTabs")}>
        <Ionicons name="arrow-back-outline" size={14} color={c.muted} />
        <Text style={styles.skipText}>{t("welcome.backToLibrary")}</Text>
      </Pressable>
    </Screen>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: {
      backgroundColor: c.bg,
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm
    },
    heroCard: {
      ...shadows.card,
      backgroundColor: c.navy,
      borderRadius: 32,
      marginBottom: spacing.md,
      overflow: "hidden",
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      position: "relative"
    },
    heroGlowTop: {
      backgroundColor: c.gold + "2E",
      borderRadius: 160,
      height: 180,
      position: "absolute",
      right: -40,
      top: -50,
      width: 180
    },
    heroGlowBottom: {
      backgroundColor: c.teal + "24",
      borderRadius: 160,
      height: 200,
      left: -80,
      position: "absolute",
      top: 120,
      width: 200
    },
    logoShell: {
      alignItems: "center"
    },
    logo: {
      height: 116,
      width: 220
    },
    heroCopy: {
      alignItems: "center",
      marginTop: spacing.sm
    },
    eyebrow: {
      color: c.gold,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 1.8,
      textTransform: "uppercase"
    },
    title: {
      color: "#FFFFFF",
      fontFamily: fonts.display,
      fontSize: 38,
      fontWeight: "900",
      lineHeight: 42,
      marginTop: spacing.sm,
      textAlign: "center"
    },
    subtitle: {
      color: "rgba(255,255,255,0.82)",
      fontFamily: fonts.bodyRegular,
      fontSize: 16,
      lineHeight: 24,
      marginTop: spacing.sm,
      textAlign: "center"
    },
    tagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      justifyContent: "center",
      marginTop: spacing.md
    },
    tagChip: {
      backgroundColor: "rgba(255,255,255,0.08)",
      borderColor: "rgba(255,255,255,0.08)",
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 7
    },
    tagText: {
      color: "#FFFFFF",
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800"
    },
    promiseCard: {
      borderColor: "rgba(255,255,255,0.10)",
      borderRadius: radii.lg,
      borderWidth: 1,
      marginTop: spacing.lg,
      padding: spacing.md
    },
    promiseLead: {
      color: "#FFFFFF",
      fontFamily: fonts.display,
      fontSize: 22,
      fontWeight: "900",
      lineHeight: 26
    },
    promiseBody: {
      color: "rgba(255,255,255,0.82)",
      fontFamily: fonts.bodyRegular,
      fontSize: 13,
      lineHeight: 20,
      marginTop: spacing.xs
    },
    featureGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.md
    },
    featureCard: {
      ...shadows.card,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      padding: spacing.md
    },
    featureCardHalf: {
      width: "48.5%"
    },
    featureCardWide: {
      width: "100%"
    },
    featureIcon: {
      alignItems: "center",
      backgroundColor: c.navy,
      borderRadius: 18,
      height: 36,
      justifyContent: "center",
      width: 36
    },
    featureTitle: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 18,
      marginTop: spacing.sm
    },
    featureBody: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4
    },
    skipRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      paddingVertical: spacing.md
    },
    skipText: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800"
    }
  });
}
