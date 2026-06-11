/**
 * LegalScreen — in-app Privacy Policy & Terms of Use.
 * Rendered natively (no broken external links, works offline).
 * Legal body text is intentionally English-only; section titles are localized.
 */
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useLayoutEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../i18n/LocalizationContext";
import { RootStackParamList } from "../navigation/types";
import { AppColors, fonts, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";

type LegalRoute = RouteProp<RootStackParamList, "Legal">;

const LAST_UPDATED = "June 2026";

type Section = { heading: string; body: string };

const PRIVACY_SECTIONS: Section[] = [
  {
    heading: "Your data lives on your device",
    body: "Bookliz is a local-first app. Your library, reading sessions, reviews, notes, quotes, and statistics are stored on this device. We do not see or collect this data unless you explicitly sign in to enable cloud sync.",
  },
  {
    heading: "Cloud sync (optional)",
    body: "If you sign in with Google or Apple, your library data is synced to our cloud database (hosted on Supabase) so you can restore it on another device. Only your library content and basic account identity (name, email) are stored. You can disconnect at any time from Settings, and deleting your account permanently erases this data.",
  },
  {
    heading: "Book metadata",
    body: "When you search for books or scan an ISBN, Bookliz queries public book catalogs (Google Books and Open Library). Your search terms are sent to these services to return results; they are not linked to your identity by Bookliz.",
  },
  {
    heading: "Photos and camera",
    body: "Camera access is used only to scan barcodes and capture cover photos. Images stay on your device and are never uploaded by Bookliz.",
  },
  {
    heading: "Purchases",
    body: "\"Get on Amazon\" links may include an affiliate tag. Bookliz may earn a commission on qualifying purchases at no extra cost to you. No purchase data flows back to Bookliz.",
  },
  {
    heading: "No ads, no tracking",
    body: "Bookliz does not show ads, does not sell your data, and does not use third-party advertising or analytics trackers.",
  },
  {
    heading: "Your rights",
    body: "You can export, correct, or delete your data at any time. \"Delete account\" in Settings permanently erases your cloud data; deleting the app erases local data. Questions: contact us at support@bookliz.app.",
  },
];

const TERMS_SECTIONS: Section[] = [
  {
    heading: "Acceptance",
    body: "By using Bookliz you agree to these terms. If you do not agree, please do not use the app.",
  },
  {
    heading: "Personal use",
    body: "Bookliz is licensed to you for personal, non-commercial use to track your reading life. You may not resell, scrape, or redistribute the app or its data services.",
  },
  {
    heading: "Your content",
    body: "Your reviews, notes, and quotes are yours. By syncing them to the cloud you grant us only the storage rights needed to provide the service back to you.",
  },
  {
    heading: "Book data",
    body: "Book metadata and covers come from third-party catalogs (Google Books, Open Library) and remain subject to their respective terms. Bookliz does not guarantee its accuracy or completeness.",
  },
  {
    heading: "Availability",
    body: "Bookliz is provided \"as is\", without warranties of any kind. Core features work offline; search, sync, and metadata require an internet connection and may change or be interrupted.",
  },
  {
    heading: "Limitation of liability",
    body: "To the maximum extent permitted by law, Bookliz is not liable for indirect or consequential damages, including loss of data. Keep backups of anything important.",
  },
  {
    heading: "Changes",
    body: "We may update these terms as the app evolves. Material changes will be announced in the app. Continued use after changes means acceptance.",
  },
];

export function LegalScreen() {
  const { params } = useRoute<LegalRoute>();
  const navigation = useNavigation();
  const c = useColors();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(c), [c]);

  const isPrivacy = params.doc === "privacy";
  const title = isPrivacy ? t("legal.privacyTitle") : t("legal.termsTitle");
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  useLayoutEffect(() => {
    // Body carries the big title — keep the nav bar minimal
    navigation.setOptions({ title: "" });
  }, [navigation, title]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>{title}</Text>
      <Text style={styles.updated}>{t("legal.lastUpdated", { date: LAST_UPDATED })}</Text>
      <View style={styles.titleRule} />

      {/* Document style — continuous prose, no boxed cards */}
      {sections.map((section, index) => (
        <View key={section.heading} style={index > 0 ? styles.section : undefined}>
          <Text style={styles.sectionHeading}>{section.heading}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
        </View>
      ))}

      <View style={styles.footerRule} />
      <Text style={styles.footerNote}>Bookliz · support@bookliz.app</Text>
    </ScrollView>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    root: { backgroundColor: c.bg, flex: 1 },
    content: { padding: spacing.md, paddingBottom: 60 },
    pageTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 28,
      fontWeight: "900",
    },
    updated: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 6,
    },
    titleRule: {
      backgroundColor: c.border,
      height: 1,
      marginBottom: spacing.lg,
      marginTop: spacing.md,
    },
    section: {
      marginTop: spacing.lg,
    },
    sectionHeading: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 17,
      fontWeight: "800",
      marginBottom: 6,
    },
    sectionBody: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 15,
      lineHeight: 24,
    },
    footerRule: {
      backgroundColor: c.border,
      height: 1,
      marginBottom: spacing.md,
      marginTop: spacing.xl,
    },
    footerNote: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "700",
      opacity: 0.7,
      textAlign: "center",
    },
  });
}
