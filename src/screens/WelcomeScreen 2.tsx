import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";
import { GoogleConnectionCard } from "../components/GoogleConnectionCard";
import { Screen } from "../components/Screen";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

const booklioLogo = require("../../assets/brand/booklio-logo.png");

const ENTRY_POINTS = [
  {
    icon: "library-outline" as const,
    title: "Track every shelf",
    body: "Read, wishlist, ownership, rereads, and series progress all in one place."
  },
  {
    icon: "time-outline" as const,
    title: "Log every session",
    body: "Minutes, pages, quotes, mood, place, and streaks with collector-grade history."
  },
  {
    icon: "sparkles-outline" as const,
    title: "Grow your reading map",
    body: "See stats, recommendations, future achievements, and the next saga steps clearly."
  }
];

export function WelcomeScreen() {
  return (
    <Screen scroll={false} contentStyle={styles.safe}>
      <View style={styles.hero}>
        <Image source={booklioLogo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.eyebrow}>Booklio</Text>
        <Text style={styles.title}>Your story, every book.</Text>
        <Text style={styles.subtitle}>
          A premium reading tracker for collectors, session loggers, saga finishers, and readers who want their whole history in one calm place.
        </Text>
      </View>

      <View style={styles.featureList}>
        {ENTRY_POINTS.map((item) => (
          <View key={item.title} style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <Ionicons name={item.icon} size={18} color={colors.card} />
            </View>
            <View style={styles.featureCopy}>
              <Text style={styles.featureTitle}>{item.title}</Text>
              <Text style={styles.featureBody}>{item.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <GoogleConnectionCard variant="onboarding" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.cream,
    flex: 1,
    justifyContent: "center",
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl
  },
  hero: {
    alignItems: "center",
    marginBottom: spacing.lg
  },
  logo: {
    height: 66,
    width: 66
  },
  eyebrow: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginTop: spacing.sm,
    textTransform: "uppercase"
  },
  title: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38,
    marginTop: spacing.sm,
    textAlign: "center"
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 23,
    marginTop: spacing.sm,
    textAlign: "center"
  },
  featureList: {
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  featureCard: {
    ...shadows.card,
    alignItems: "flex-start",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  featureIcon: {
    alignItems: "center",
    backgroundColor: colors.navy,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  featureCopy: {
    flex: 1
  },
  featureTitle: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  },
  featureBody: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3
  }
});
