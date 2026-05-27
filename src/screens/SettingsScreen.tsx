import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { GoogleConnectionCard } from "../components/GoogleConnectionCard";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { useI18n } from "../i18n/LocalizationContext";
import { useTheme } from "../theme/ThemeContext";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";

export function SettingsScreen() {
  const { colors: c, isDark, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const { resetApp } = useBooklio();
  const styles = useMemo(() => createStyles(c), [c]);

  const themeTitle = isDark ? t("settings.themeDarkTitle") : t("settings.themeLightTitle");
  const themeBody = isDark ? t("settings.themeDarkBody") : t("settings.themeLightBody");

  return (
    <Screen>
      <View style={styles.pageHeader}>
        <Text style={styles.eyebrow}>{t("settings.eyebrow")}</Text>
        <Text style={styles.title}>{t("settings.title")}</Text>
        <Text style={styles.subtitle}>{t("settings.subtitle")}</Text>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name={isDark ? "moon" : "sunny-outline"} size={18} color={isDark ? c.gold : c.tealDark} />
          </View>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>{t("settings.appearanceTitle")}</Text>
            <Text style={styles.sectionBody}>{t("settings.appearanceBody")}</Text>
          </View>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>{themeTitle}</Text>
            <Text style={styles.settingSub}>{themeBody}</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: c.border, true: c.teal }}
            thumbColor={isDark ? c.gold : c.surface}
          />
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="language-outline" size={18} color={c.tealDark} />
          </View>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>{t("settings.languageTitle")}</Text>
            <Text style={styles.sectionBody}>{t("settings.languageBody")}</Text>
          </View>
        </View>

        <View style={styles.languageRow}>
          <Pressable
            style={[styles.languageChip, locale === "en" && styles.languageChipActive]}
            onPress={() => setLocale("en")}
          >
            <Text style={[styles.languageChipText, locale === "en" && styles.languageChipTextActive]}>
              {t("common.english")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.languageChip, locale === "es" && styles.languageChipActive]}
            onPress={() => setLocale("es")}
          >
            <Text style={[styles.languageChipText, locale === "es" && styles.languageChipTextActive]}>
              {t("common.spanish")}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <Text style={styles.sectionEyebrow}>{t("settings.accountTitle")}</Text>
        <Text style={styles.sectionHint}>{t("settings.accountBody")}</Text>
      </View>
      <GoogleConnectionCard variant="settings" />

      <View style={styles.dangerSection}>
        <Text style={styles.dangerEyebrow}>{t("settings.dangerEyebrow")}</Text>
        <Text style={styles.dangerTitle}>{t("settings.dangerTitle")}</Text>
        <Text style={styles.dangerBody}>{t("settings.dangerBody")}</Text>
        <Pressable
          style={styles.dangerButton}
          onPress={() =>
            Alert.alert(
              t("settings.deletePromptTitle"),
              t("settings.deletePromptBody"),
              [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("settings.deleteConfirm"), style: "destructive", onPress: () => resetApp() },
              ]
            )
          }
        >
          <Ionicons name="trash-outline" size={16} color={c.danger} />
          <Text style={styles.dangerButtonText}>{t("settings.dangerButton")}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    pageHeader: {
      marginBottom: spacing.lg,
    },
    eyebrow: {
      color: c.tealDark,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.3,
      textTransform: "uppercase",
    },
    title: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 28,
      fontWeight: "900",
      marginTop: 2,
    },
    subtitle: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 14,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
    sectionCard: {
      ...shadows.card,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    sectionHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    sectionIconWrap: {
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderRadius: radii.pill,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    sectionCopy: {
      flex: 1,
    },
    sectionTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 21,
      fontWeight: "900",
    },
    sectionBody: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 3,
    },
    settingRow: {
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.md,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
    },
    settingCopy: {
      flex: 1,
      paddingRight: spacing.md,
    },
    settingTitle: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900",
    },
    settingSub: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4,
    },
    languageRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    languageChip: {
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    languageChipActive: {
      backgroundColor: c.teal + "18",
      borderColor: c.teal + "44",
    },
    languageChipText: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
    },
    languageChipTextActive: {
      color: c.tealDark,
    },
    sectionWrap: {
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },
    sectionEyebrow: {
      color: c.tealDark,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.3,
      textTransform: "uppercase",
    },
    sectionHint: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 6,
    },
    dangerSection: {
      borderTopColor: c.danger + "50",
      borderTopWidth: 1,
      marginBottom: spacing.xl,
      marginTop: spacing.xl,
      paddingTop: spacing.lg,
    },
    dangerEyebrow: {
      color: c.danger,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.3,
      textTransform: "uppercase",
    },
    dangerTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 22,
      fontWeight: "900",
      marginBottom: spacing.xs,
      marginTop: 2,
    },
    dangerBody: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: spacing.md,
    },
    dangerButton: {
      alignItems: "center",
      backgroundColor: c.danger + "14",
      borderColor: c.danger + "45",
      borderRadius: radii.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      paddingVertical: 14,
    },
    dangerButtonText: {
      color: c.danger,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900",
    },
  });
}

