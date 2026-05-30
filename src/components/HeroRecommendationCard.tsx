/**
 * HeroRecommendationCard
 *
 * Full-width immersive hero card shown at the top of the Home screen.
 * Design ref: Spotify "Daily Mix" hero + Letterboxd film card.
 *
 * When the user has a recommendation → shows the top rec with cover art,
 * reason badge, confidence, and explanation note.
 * When no recs yet → shows a "What should I read next?" prompt card.
 */

import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Book, Recommendation } from "../types/models";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";
import { useI18n } from "../i18n/LocalizationContext";

type Props = {
  recommendation: Recommendation | null;
  book: Book | null;
  authorName: string;
  onPress?: () => void;
  onDiscoverPress?: () => void;
};

export function HeroRecommendationCard({
  recommendation,
  book,
  authorName,
  onPress,
  onDiscoverPress,
}: Props) {
  const c = useColors();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(c), [c]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!recommendation || !book) {
    return (
      <Pressable style={styles.emptyHero} onPress={onDiscoverPress}>
        <LinearGradient
          colors={[c.navy + "EE", c.teal + "55"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emptyGradient}
        >
          <Text style={styles.emptyEyebrow}>{t("home.heroEmptyEyebrow")}</Text>
          <Text style={styles.emptyTitle}>{t("home.heroEmptyTitle")}</Text>
          <Text style={styles.emptyBody}>{t("home.heroEmptyBody")}</Text>
          <View style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>{t("home.heroEmptyBtn")}</Text>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  // ── Cover backdrop ─────────────────────────────────────────────────────────
  const [gradTop, gradBot] = book.coverGradient;

  const content = (
    <LinearGradient
      colors={["transparent", "rgba(7,17,35,0.72)", "rgba(7,17,35,0.97)"]}
      style={styles.overlay}
    >
      {/* Reason badge */}
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{formatReason(recommendation.reason)}</Text>
        </View>
        <View style={styles.confidencePill}>
          <Text style={styles.confidenceText}>{recommendation.confidence}% match</Text>
        </View>
      </View>

      {/* Book info */}
      <Text numberOfLines={2} style={styles.heroTitle}>{book.title}</Text>
      <Text numberOfLines={1} style={styles.heroAuthor}>
        {authorName}
        {book.seriesName ? `  ·  ${book.seriesName}` : ""}
      </Text>

      {/* AI note */}
      {recommendation.note ? (
        <Text numberOfLines={2} style={styles.heroNote}>"{recommendation.note}"</Text>
      ) : null}

      {/* CTA */}
      <View style={styles.heroActions}>
        <View style={styles.heroBtn}>
          <Text style={styles.heroBtnText}>{t("home.heroViewBook")}</Text>
        </View>
        <View style={styles.genrePills}>
          {(book.genre ?? []).slice(0, 2).map((g) => (
            <View key={g} style={styles.genrePill}>
              <Text style={styles.genrePillText}>{g}</Text>
            </View>
          ))}
        </View>
      </View>
    </LinearGradient>
  );

  if (book.coverImageUri) {
    return (
      <Pressable style={[styles.hero, shadows.card]} onPress={onPress}>
        <ImageBackground
          source={{ uri: book.coverImageUri }}
          style={styles.heroImage}
          imageStyle={styles.heroImageStyle}
        >
          {content}
        </ImageBackground>
      </Pressable>
    );
  }

  return (
    <Pressable style={[styles.hero, shadows.card]} onPress={onPress}>
      <LinearGradient
        colors={[gradTop, gradBot]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.heroImage}
      >
        {content}
      </LinearGradient>
    </Pressable>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatReason(reason: Recommendation["reason"]): string {
  switch (reason) {
    case "continue-saga":       return "Continue your saga";
    case "same-author":         return "Same author";
    case "same-saga":           return "In this series";
    case "same-genre":          return "Matches your taste";
    case "upcoming-release":    return "On your radar";
    case "because-you-liked":   return "Because you loved it";
    case "reading-log-habits":  return "Fits your habits";
    case "users-also-liked":    return "Readers also loved";
    default:                    return "Recommended for you";
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    // ── Full hero ────────────────────────────────────────────────────────────
    // Negative horizontal margin breaks out of Screen's paddingHorizontal (spacing.md = 16)
    hero: {
      borderRadius: radii.lg,
      height: 300,
      marginBottom: spacing.lg,
      marginHorizontal: -spacing.md,
      overflow: "hidden",
    },
    heroImage: {
      flex: 1,
      justifyContent: "flex-end",
    },
    heroImageStyle: {
      borderRadius: radii.lg,
    },
    overlay: {
      borderRadius: radii.lg,
      padding: spacing.md,
      paddingBottom: spacing.lg,
    },

    // Badge row
    badgeRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      marginBottom: spacing.sm,
    },
    badge: {
      backgroundColor: c.gold,
      borderRadius: radii.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: {
      color: c.navy,
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    confidencePill: {
      backgroundColor: "rgba(255,255,255,0.15)",
      borderColor: "rgba(255,255,255,0.2)",
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    confidenceText: {
      color: "rgba(255,255,255,0.85)",
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "900",
    },

    // Title / author / note
    heroTitle: {
      color: "#FFFFFF",
      fontFamily: fonts.display,
      fontSize: 26,
      fontWeight: "900",
      lineHeight: 31,
    },
    heroAuthor: {
      color: "rgba(255,255,255,0.70)",
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 4,
    },
    heroNote: {
      color: "rgba(255,255,255,0.60)",
      fontFamily: fonts.bodyRegular,
      fontSize: 12,
      fontStyle: "italic",
      lineHeight: 18,
      marginTop: 8,
    },

    // CTA row
    heroActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      marginTop: spacing.md,
    },
    heroBtn: {
      backgroundColor: "#FFFFFF",
      borderRadius: radii.pill,
      paddingHorizontal: 18,
      paddingVertical: 9,
    },
    heroBtnText: {
      color: c.navy,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900",
    },
    genrePills: {
      flexDirection: "row",
      gap: 6,
    },
    genrePill: {
      backgroundColor: "rgba(255,255,255,0.12)",
      borderColor: "rgba(255,255,255,0.22)",
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    genrePillText: {
      color: "rgba(255,255,255,0.75)",
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
    },

    // ── Empty hero ───────────────────────────────────────────────────────────
    emptyHero: {
      borderRadius: radii.lg,
      height: 200,
      marginBottom: spacing.lg,
      marginHorizontal: -spacing.md,
      overflow: "hidden",
    },
    emptyGradient: {
      flex: 1,
      justifyContent: "center",
      padding: spacing.lg,
    },
    emptyEyebrow: {
      color: c.teal,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1,
      marginBottom: 6,
      textTransform: "uppercase",
    },
    emptyTitle: {
      color: "#FFFFFF",
      fontFamily: fonts.display,
      fontSize: 22,
      fontWeight: "900",
      lineHeight: 26,
    },
    emptyBody: {
      color: "rgba(255,255,255,0.60)",
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 19,
      marginTop: 6,
    },
    emptyBtn: {
      alignSelf: "flex-start",
      backgroundColor: c.teal,
      borderRadius: radii.pill,
      marginTop: spacing.md,
      paddingHorizontal: 18,
      paddingVertical: 9,
    },
    emptyBtnText: {
      color: "#FFFFFF",
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900",
    },
  });
}
