import { Ionicons } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { BookCover } from "../components/BookCover";
import { RecommendationCard } from "../components/RecommendationCard";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SessionRow } from "../components/SessionRow";
import { useBooklio } from "../data/BooklioContext";
import { useI18n } from "../i18n/LocalizationContext";
import { MainTabParamList, RootStackParamList } from "../navigation/types";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors, useTheme } from "../theme/ThemeContext";

const booklioLogoLight = require("../../assets/brand/booklio-logo.png");
const booklioLogoDark = require("../../assets/brand/booklio-logo-dark.png");

function getGreeting(t: (key: string) => string) {
  const hour = new Date().getHours();
  if (hour < 12) return t("home.morning");
  if (hour < 19) return t("home.afternoon");
  return t("home.evening");
}

function getStreakMessage(streak: number, c: AppColors, t: (key: string, vars?: Record<string, string | number>) => string): { headline: string; sub: string; accent: string } {
  if (streak === 0) return { headline: t("home.streak0Title"), sub: t("home.streak0Body"), accent: c.muted };
  if (streak === 1) return { headline: t("home.streak1Title"), sub: t("home.streak1Body"), accent: c.teal };
  if (streak < 4) return { headline: t("home.streakSmallTitle", { count: streak }), sub: t("home.streakSmallBody"), accent: c.teal };
  if (streak < 7) return { headline: t("home.streakMidTitle", { count: streak }), sub: t("home.streakMidBody"), accent: c.coral };
  if (streak < 14) return { headline: t("home.streakWeekTitle", { count: streak }), sub: t("home.streakWeekBody"), accent: c.coral };
  if (streak < 30) return { headline: t("home.streakLongTitle", { count: streak }), sub: t("home.streakLongBody"), accent: c.gold };
  return { headline: t("home.streakLegendTitle", { count: streak }), sub: t("home.streakLegendBody"), accent: c.gold };
}

export function HomeScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList & MainTabParamList>>();
  const c = useColors();
  const { isDark } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(c), [c]);
  const { books, getAuthor, getBook, overallStats, readingSessions, recommendations, userProfile } = useBooklio();
  const logoSource = isDark ? booklioLogoDark : booklioLogoLight;

  const continueBook = books.find((b) => b.userStatus.status === "reading") ?? null;
  const goalPct = Math.min(100, Math.round((overallStats.booksReadThisYear / userProfile.yearlyGoal) * 100));
  const remaining = userProfile.yearlyGoal - overallStats.booksReadThisYear;
  const streakMsg = getStreakMessage(overallStats.currentStreak, c, t);
  const homeRecommendations = recommendations
    .map((recommendation) => ({ recommendation, book: getBook(recommendation.bookId) }))
    .filter((item): item is { recommendation: typeof recommendations[number]; book: NonNullable<ReturnType<typeof getBook>> } => Boolean(item.book))
    .slice(0, 4);
  const topLocation = overallStats.locationCounts[0]?.label ?? "—";

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Image source={logoSource} style={styles.logo} resizeMode="contain" />
        <View>
          <Text style={styles.greeting}>{getGreeting(t)},</Text>
          <Text style={styles.name}>{userProfile.name}.</Text>
        </View>
      </View>

      {/* Stats strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{overallStats.booksReadThisYear}</Text>
          <Text style={styles.statLabel}>{t("home.booksThisYear")}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{overallStats.pagesRead.toLocaleString()}</Text>
          <Text style={styles.statLabel}>{t("home.pagesRead")}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: c.tealDark }]}>{overallStats.currentStreak}d</Text>
          <Text style={styles.statLabel}>{t("home.currentStreak")}</Text>
        </View>
      </View>

      {/* Streak card */}
      <Pressable style={styles.streakCard} onPress={() => navigation.navigate("ReadingLog", {})}>
        <View style={[styles.streakIconWrap, { backgroundColor: streakMsg.accent + "22" }]}>
          <Ionicons name="flame" size={22} color={streakMsg.accent} />
        </View>
        <View style={styles.streakCopy}>
          <Text style={[styles.streakHeadline, { color: streakMsg.accent === c.muted ? c.ink : streakMsg.accent }]}>
            {streakMsg.headline}
          </Text>
          <Text style={styles.streakSub}>{streakMsg.sub}</Text>
        </View>
        <Text style={[styles.streakCount, { color: streakMsg.accent }]}>
          {overallStats.currentStreak}d
        </Text>
      </Pressable>

      {/* Goal card */}
      <View style={styles.goalCard}>
        <View style={styles.goalRow}>
          <View>
            <Text style={styles.goalLabel}>{t("home.annualGoal")}</Text>
            <Text style={styles.goalTitle}>{overallStats.booksReadThisYear} / {userProfile.yearlyGoal} books</Text>
          </View>
          <Text style={styles.goalPct}>{goalPct}%</Text>
        </View>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${goalPct}%` }]} />
        </View>
        <Text style={styles.goalSub}>
          {remaining > 0 ? t("home.goalRemaining", { count: remaining }) : t("home.goalReached")}
        </Text>
      </View>

      {/* Collector mini */}
      <View style={styles.collectorCard}>
        <View style={styles.collectorRow}>
          <CollectorMini label={t("home.owned")} value={overallStats.ownedCount.toString()} accent={c.tealDark} styles={styles} />
          <CollectorMini label={t("home.wishlist")} value={overallStats.wishlistCount.toString()} accent={c.gold} styles={styles} />
          <CollectorMini label={t("home.wantToBuy")} value={overallStats.wantToBuyCount.toString()} accent={c.coral} styles={styles} />
        </View>
        <View style={styles.collectorMetaRow}>
          <Text style={styles.collectorMetaText}>{t("home.sagasCompleted", { count: overallStats.completedSeriesCount })}</Text>
          <Text style={styles.collectorMetaDot}>•</Text>
          <Text style={styles.collectorMetaText}>{t("home.favoritePlace", { place: topLocation })}</Text>
        </View>
      </View>

      {/* Continue reading */}
      {continueBook ? (
        <View style={styles.continueCard}>
          <BookCover book={continueBook} size="sm" style={styles.continueCover} />
          <View style={styles.continueCopy}>
            <Text style={styles.sectionEyebrow}>{t("home.continueReading")}</Text>
            <Text style={styles.continueTitle}>{continueBook.title}</Text>
            <Text style={styles.continueAuthor}>{getAuthor(continueBook.authorId)?.name}</Text>
            <View style={styles.progressMini}>
              <View style={styles.progressMiniTrack}>
                <View style={[styles.progressMiniFill, { width: `${continueBook.userStatus.progressPercent}%` }]} />
              </View>
              <Text style={styles.progressMiniPct}>{continueBook.userStatus.progressPercent}%</Text>
            </View>
            <Pressable
              style={styles.primaryButton}
              onPress={() => navigation.navigate("AddReadingSession", { bookId: continueBook.id })}
            >
              <Ionicons name="pencil" size={13} color={c.navText} style={{ marginRight: 6 }} />
              <Text style={styles.primaryButtonText}>{t("home.logSession")}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.emptyCard} onPress={() => navigation.navigate("Add")}>
          <Ionicons name="book-outline" size={28} color={c.teal} />
          <Text style={styles.emptyTitle}>{t("home.whatReading")}</Text>
          <Text style={styles.emptySubtitle}>{t("home.addFirstBook")}</Text>
        </Pressable>
      )}

      {readingSessions.length > 0 ? (
        <>
          {homeRecommendations.length > 0 ? (
            <>
              <SectionHeader title={t("home.recommended")} />
              <View style={styles.recommendationRail}>
                {homeRecommendations.map(({ recommendation, book }) => (
                  <RecommendationCard
                    key={recommendation.id}
                    authorName={getAuthor(book.authorId)?.name ?? ""}
                    book={book}
                    compact
                    recommendation={recommendation}
                    onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}
                  />
                ))}
              </View>
            </>
          ) : null}

          <SectionHeader
            title={t("home.recentSessions")}
            actionLabel={t("home.viewAll")}
            onAction={() => navigation.navigate("ReadingLog", {})}
          />
          {readingSessions.slice(0, 3).map((session) => (
            <SessionRow
              key={session.id}
              bookTitle={getBook(session.bookId)?.title ?? "Unknown book"}
              session={session}
              onPress={() => navigation.navigate("AddReadingSession", { bookId: session.bookId, sessionId: session.id })}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function CollectorMini({ label, value, accent, styles }: {
  label: string; value: string; accent: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.collectorMiniWrap}>
      <Text style={[styles.collectorMiniValue, { color: accent }]}>{value}</Text>
      <Text style={styles.collectorMiniLabel}>{label}</Text>
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    header: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    logo: { height: 48, width: 48 },
    greeting: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
    },
    name: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 22,
      fontWeight: "900",
      lineHeight: 26,
    },
    statsStrip: {
      ...shadows.card,
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: "row",
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    statItem: { alignItems: "center", flex: 1 },
    statValue: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 22,
      fontWeight: "900",
    },
    statLabel: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      marginTop: 2,
      textAlign: "center",
    },
    statDivider: { backgroundColor: c.border, height: 32, width: 1 },
    streakCard: {
      ...shadows.card,
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    streakIconWrap: {
      alignItems: "center",
      borderRadius: 20,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    streakCopy: { flex: 1 },
    streakHeadline: { fontFamily: fonts.body, fontSize: 14, fontWeight: "900" },
    streakSub: { color: c.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
    streakCount: { fontFamily: fonts.display, fontSize: 22, fontWeight: "900" },
    goalCard: {
      ...shadows.card,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    goalRow: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
    goalLabel: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    goalTitle: { color: c.ink, fontFamily: fonts.display, fontSize: 20, fontWeight: "900", marginTop: 2 },
    goalPct: { color: c.green, fontFamily: fonts.display, fontSize: 22, fontWeight: "900" },
    goalTrack: {
      backgroundColor: c.border,
      borderRadius: radii.pill,
      height: 10,
      marginTop: spacing.sm,
      overflow: "hidden",
    },
    goalFill: { backgroundColor: c.green, borderRadius: radii.pill, height: "100%" },
    goalSub: { color: c.muted, fontFamily: fonts.body, fontSize: 12, marginTop: spacing.xs },
    collectorCard: {
      ...shadows.card,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    collectorRow: { flexDirection: "row", gap: spacing.sm },
    collectorMiniWrap: { flex: 1 },
    collectorMiniValue: { fontFamily: fonts.display, fontSize: 24, fontWeight: "900" },
    collectorMiniLabel: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      marginTop: 2,
      textTransform: "uppercase",
    },
    collectorMetaRow: { alignItems: "center", flexDirection: "row", marginTop: spacing.sm },
    collectorMetaText: { color: c.muted, fontFamily: fonts.body, fontSize: 12, fontWeight: "800" },
    collectorMetaDot: { color: c.border, marginHorizontal: 8 },
    continueCard: {
      ...shadows.card,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    continueCopy: { flex: 1 },
    continueCover: { width: 96, height: 142, marginTop: 2 },
    sectionEyebrow: {
      color: c.gold,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    continueTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "900",
      lineHeight: 24,
      marginTop: 4,
    },
    continueAuthor: { color: c.muted, fontFamily: fonts.body, fontSize: 13, fontWeight: "800", marginTop: 4 },
    progressMini: { alignItems: "center", flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm },
    progressMiniTrack: {
      backgroundColor: c.border,
      borderRadius: radii.pill,
      flex: 1,
      height: 6,
      overflow: "hidden",
    },
    progressMiniFill: { backgroundColor: c.teal, borderRadius: radii.pill, height: "100%" },
    progressMiniPct: { color: c.muted, fontFamily: fonts.body, fontSize: 11, fontWeight: "800" },
    primaryButton: {
      alignItems: "center",
      backgroundColor: c.navy,
      borderRadius: radii.pill,
      flexDirection: "row",
      justifyContent: "center",
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    primaryButtonText: { color: "#FFFFFF", fontFamily: fonts.body, fontSize: 12, fontWeight: "900" },
    emptyCard: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderStyle: "dashed",
      borderWidth: 1,
      gap: spacing.xs,
      marginBottom: spacing.md,
      padding: spacing.xl,
    },
    emptyTitle: { color: c.ink, fontFamily: fonts.display, fontSize: 18, fontWeight: "900", marginTop: spacing.xs },
    emptySubtitle: { color: c.muted, fontFamily: fonts.body, fontSize: 13, textAlign: "center" },
    recommendationRail: { marginBottom: spacing.md },
  });
}
