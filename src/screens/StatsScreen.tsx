import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { BarChart } from "../components/BarChart";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";

type Tab = "books" | "pages" | "minutes";
type StatsStyles = ReturnType<typeof createStyles>;

export function StatsScreen() {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { books, overallStats, userProfile } = useBooklio();
  const [activeTab, setActiveTab] = useState<Tab>("books");

  const unfinishedCount = books.filter((b) => b.userStatus.status === "dnf").length;
  const goalPct = Math.min(100, Math.round((overallStats.booksReadThisYear / userProfile.yearlyGoal) * 100));

  const chartData: Record<Tab, { label: string; value: number }[]> = {
    books: overallStats.monthly.map((m) => ({ label: m.label, value: m.booksFinished })),
    pages: overallStats.monthly.map((m) => ({ label: m.label, value: m.pages })),
    minutes: overallStats.monthly.map((m) => ({ label: m.label, value: m.minutes }))
  };

  const topGenre = overallStats.genreCounts[0]?.label ?? "—";
  const topAuthor = overallStats.authorCounts[0]?.label ?? "—";
  const topLocation = overallStats.locationCounts[0]?.label ?? "—";
  const topFormat = overallStats.formatCounts[0]?.label ?? "—";
  const avgSpeed = Math.round(
    overallStats.speedOverTime.reduce((s, d) => s + d.value, 0) /
    (overallStats.speedOverTime.length || 1)
  );
  const hoursRead = Math.round(overallStats.minutesRead / 60);
  const bestDay = overallStats.bestReadingDay === "No sessions yet"
    ? "—"
    : new Date(`${overallStats.bestReadingDay}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      });

  const shareYearInReview = async () => {
    const year = new Date().getFullYear();
    const text = [
      `📚 My ${year} in books — powered by Booklio`,
      "",
      `${overallStats.booksReadThisYear} books read`,
      overallStats.rereadsCompleted > 0 ? `${overallStats.rereadsCompleted} rereads completed` : null,
      `${overallStats.pagesRead.toLocaleString()} pages`,
      `${hoursRead} hours of reading`,
      `${overallStats.longestStreak}-day longest streak`,
      topGenre !== "—" ? `Favorite genre: ${topGenre}` : null,
      topAuthor !== "—" ? `Most-read author: ${topAuthor}` : null,
      overallStats.averageRating > 0 ? `Average rating: ${overallStats.averageRating} ★` : null
    ].filter(Boolean).join("\n");

    try {
      await Share.share({ message: text });
    } catch {
      Alert.alert("Could not share", "Try again later.");
    }
  };

  const hasData = overallStats.totalBooksRead > 0 || overallStats.pagesRead > 0;

  if (!hasData) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Statistics</Text>
          <Text style={styles.title}>Your reading stats</Text>
          <Text style={styles.subtitle}>The more you log, the richer your reading map becomes.</Text>
        </View>

        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="bar-chart-outline" size={42} color={c.teal} />
          </View>
          <Text style={styles.emptyTitle}>Nothing to show yet</Text>
          <Text style={styles.emptySub}>Log your first reading session and your stats will appear here.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Statistics</Text>
        <Text style={styles.title}>Your reading stats</Text>
        <Text style={styles.subtitle}>Momentum, habits, and collector signals in one reading dashboard.</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroGlowA} />
        <View style={styles.heroGlowB} />

        <View style={styles.goalRow}>
          <View style={styles.goalLeft}>
            <Text style={styles.goalLabel}>Annual goal</Text>
            <Text style={styles.goalNumbers}>
              {overallStats.booksReadThisYear}
              <Text style={styles.goalOf}> / {userProfile.yearlyGoal}</Text>
            </Text>
          </View>
          <Text style={styles.goalPct}>{goalPct}%</Text>
        </View>

        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${goalPct}%` }]} />
        </View>

        <View style={styles.heroNumbers}>
          <HeroStat styles={styles} value={overallStats.pagesRead.toLocaleString()} label="pages" />
          <HeroStat styles={styles} value={`${hoursRead}h`} label="hours read" />
          <HeroStat styles={styles} value={`${overallStats.longestStreak}d`} label="best streak" accent={c.coral} />
          <HeroStat styles={styles} value={overallStats.totalSessions.toString()} label="sessions" />
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.sectionTitle}>Monthly activity</Text>
          <View style={styles.tabs}>
            {(["books", "pages", "minutes"] as Tab[]).map((tab) => (
              <Pressable
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <BarChart data={chartData[activeTab]} />
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Insights</Text>
        <View style={styles.insightsGrid}>
          <InsightTile styles={styles} icon="compass-outline" label="Top genre" value={topGenre} color={c.teal} />
          <InsightTile styles={styles} icon="person-outline" label="Top author" value={topAuthor} color={c.gold} />
          <InsightTile styles={styles} icon="speedometer-outline" label="Avg speed" value={`${avgSpeed} pp/h`} color="#7C83FD" />
          <InsightTile styles={styles} icon="calendar-outline" label="Best day" value={bestDay} color={c.green} />
          <InsightTile styles={styles} icon="star-outline" label="Avg rating" value={`${overallStats.averageRating.toFixed(1)} ★`} color={c.coral} />
          <InsightTile styles={styles} icon="close-circle-outline" label="Unfinished" value={unfinishedCount.toString()} color={c.muted} />
        </View>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Collector dashboard</Text>
        <View style={styles.collectorGrid}>
          <CollectorTile styles={styles} label="Tracked books" value={overallStats.booksTracked.toString()} sub={`${overallStats.completionRate}% completed`} accent={c.tealDark} />
          <CollectorTile styles={styles} label="Owned shelf" value={overallStats.ownedCount.toString()} sub={`${overallStats.wishlistCount} wishlist`} accent={c.gold} />
          <CollectorTile styles={styles} label="Want to buy" value={overallStats.wantToBuyCount.toString()} sub={`${overallStats.completedSeriesCount} sagas done`} accent={c.coral} />
          <CollectorTile styles={styles} label="Avg length" value={`${overallStats.averageBookLength}`} sub="pages per tracked book" accent={c.ink} />
        </View>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Habit lens</Text>
        <View style={styles.collectorGrid}>
          <CollectorTile styles={styles} label="Enjoyment" value={`${overallStats.averageSessionEnjoyment.toFixed(1)} / 10`} sub="average session rating" accent={c.green} />
          <CollectorTile styles={styles} label="Session length" value={`${overallStats.averageMinutesPerSession}m`} sub="average reading session" accent={c.teal} />
          <CollectorTile styles={styles} label="Top place" value={topLocation} sub="where you read most" accent={c.gold} />
          <CollectorTile styles={styles} label="Top format" value={topFormat} sub="dominant reading format" accent={c.coral} />
        </View>
      </View>

      {overallStats.genreCounts.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>By genre</Text>
          <BarChart data={overallStats.genreCounts.slice(0, 6)} />
        </View>
      )}

      {overallStats.locationCounts.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Reading places</Text>
          <BarChart data={overallStats.locationCounts.slice(0, 5)} />
        </View>
      )}

      {overallStats.formatCounts.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>By format</Text>
          <BarChart data={overallStats.formatCounts} />
        </View>
      )}

      <View style={styles.yearCard}>
        <View style={styles.yearTop}>
          <Text style={styles.yearEyebrow}>{new Date().getFullYear()} Year in Review</Text>
          <Ionicons name="trophy" size={20} color={c.gold} />
        </View>

        <Text style={styles.yearTitle}>Your reading year, at a glance.</Text>

        <View style={styles.yearRow}>
          <YearStat styles={styles} value={overallStats.booksReadThisYear.toString()} label="books read" />
          <YearStat styles={styles} value={overallStats.pagesRead.toLocaleString()} label="pages" />
          <YearStat styles={styles} value={`${hoursRead}h`} label="hours" />
        </View>

        {(topGenre !== "—" || topAuthor !== "—") && (
          <View style={styles.yearMeta}>
            {topGenre !== "—" && <YearMeta styles={styles} label="Top genre" value={topGenre} />}
            {topAuthor !== "—" && <YearMeta styles={styles} label="Top author" value={topAuthor} />}
          </View>
        )}

        <Pressable style={styles.shareBtn} onPress={shareYearInReview}>
          <Ionicons name="share-outline" size={15} color={c.ink} />
          <Text style={styles.shareBtnText}>Share my year</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function HeroStat({
  value,
  label,
  accent,
  styles
}: {
  value: string;
  label: string;
  accent?: string;
  styles: StatsStyles;
}) {
  return (
    <View style={styles.heroStatWrap}>
      <Text style={[styles.heroStatVal, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.heroStatLbl}>{label}</Text>
    </View>
  );
}

function InsightTile({
  icon,
  label,
  value,
  color,
  styles
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  styles: StatsStyles;
}) {
  return (
    <View style={styles.insightTile}>
      <View style={[styles.insightIconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.insightLabel}>{label}</Text>
      <Text style={styles.insightValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function CollectorTile({
  label,
  value,
  sub,
  accent,
  styles
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
  styles: StatsStyles;
}) {
  return (
    <View style={styles.collectorTile}>
      <Text style={[styles.collectorValue, { color: accent }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.collectorLabel}>{label}</Text>
      <Text style={styles.collectorSub} numberOfLines={2}>{sub}</Text>
    </View>
  );
}

function YearStat({ value, label, styles }: { value: string; label: string; styles: StatsStyles }) {
  return (
    <View style={styles.yearStatWrap}>
      <Text style={styles.yearStatVal}>{value}</Text>
      <Text style={styles.yearStatLbl}>{label}</Text>
    </View>
  );
}

function YearMeta({
  label,
  value,
  styles
}: {
  label: string;
  value: string;
  styles: StatsStyles;
}) {
  return (
    <View style={styles.yearMetaRow}>
      <Text style={styles.yearMetaLabel}>{label}</Text>
      <Text style={styles.yearMetaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    header: {
      marginBottom: spacing.md
    },
    eyebrow: {
      color: c.tealDark,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.5,
      textTransform: "uppercase"
    },
    title: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 28,
      fontWeight: "900",
      marginTop: 2
    },
    subtitle: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 6
    },
    heroCard: {
      ...shadows.card,
      backgroundColor: c.navy,
      borderRadius: radii.lg,
      marginBottom: spacing.md,
      overflow: "hidden",
      padding: spacing.lg,
      position: "relative"
    },
    heroGlowA: {
      backgroundColor: c.teal + "20",
      borderRadius: 160,
      height: 180,
      position: "absolute",
      right: -40,
      top: -20,
      width: 180
    },
    heroGlowB: {
      backgroundColor: c.gold + "24",
      borderRadius: 110,
      bottom: -50,
      height: 150,
      left: -30,
      position: "absolute",
      width: 150
    },
    goalRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.sm
    },
    goalLeft: { flex: 1 },
    goalLabel: {
      color: "rgba(255,255,255,0.55)",
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase"
    },
    goalNumbers: {
      color: "#FFFFFF",
      fontFamily: fonts.display,
      fontSize: 30,
      fontWeight: "900",
      marginTop: 2
    },
    goalOf: {
      color: "rgba(255,255,255,0.45)",
      fontSize: 20
    },
    goalPct: {
      color: c.gold,
      fontFamily: fonts.display,
      fontSize: 28,
      fontWeight: "900"
    },
    goalTrack: {
      backgroundColor: "rgba(255,255,255,0.12)",
      borderRadius: radii.pill,
      height: 7,
      marginBottom: spacing.lg,
      overflow: "hidden"
    },
    goalFill: {
      backgroundColor: c.gold,
      borderRadius: radii.pill,
      height: "100%"
    },
    heroNumbers: {
      borderTopColor: "rgba(255,255,255,0.10)",
      borderTopWidth: 1,
      flexDirection: "row",
      paddingTop: spacing.md
    },
    heroStatWrap: { alignItems: "center", flex: 1 },
    heroStatVal: { color: "#FFFFFF", fontFamily: fonts.display, fontSize: 18, fontWeight: "900" },
    heroStatLbl: { color: "rgba(255,255,255,0.58)", fontFamily: fonts.body, fontSize: 10, fontWeight: "800", marginTop: 2 },
    chartCard: {
      ...shadows.card,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      marginBottom: spacing.md,
      padding: spacing.md
    },
    chartHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.md
    },
    sectionTitle: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 1,
      textTransform: "uppercase"
    },
    tabs: {
      flexDirection: "row",
      gap: spacing.xs
    },
    tab: {
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 5
    },
    tabActive: {
      backgroundColor: c.navy,
      borderColor: c.navy
    },
    tabText: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900"
    },
    tabTextActive: { color: "#FFFFFF" },
    insightsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.sm
    },
    collectorGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.sm
    },
    insightTile: {
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.md,
      borderWidth: 1,
      flex: 1,
      minWidth: "30%",
      padding: spacing.sm + 2
    },
    insightIconWrap: {
      alignItems: "center",
      borderRadius: 8,
      height: 28,
      justifyContent: "center",
      marginBottom: 6,
      width: 28
    },
    insightLabel: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "800",
      marginBottom: 3,
      textTransform: "uppercase"
    },
    insightValue: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 14,
      fontWeight: "900"
    },
    collectorTile: {
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.md,
      borderWidth: 1,
      flex: 1,
      minWidth: "47%",
      padding: spacing.sm + 2
    },
    collectorValue: {
      fontFamily: fonts.display,
      fontSize: 18,
      fontWeight: "900"
    },
    collectorLabel: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "900",
      marginTop: 4,
      textTransform: "uppercase"
    },
    collectorSub: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4
    },
    yearCard: {
      ...shadows.card,
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      marginBottom: spacing.md,
      padding: spacing.lg
    },
    yearTop: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.xs
    },
    yearEyebrow: {
      color: c.gold,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
      textTransform: "uppercase"
    },
    yearTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "900",
      lineHeight: 26,
      marginBottom: spacing.lg
    },
    yearRow: {
      borderTopColor: c.border,
      borderTopWidth: 1,
      flexDirection: "row",
      marginBottom: spacing.md,
      paddingTop: spacing.md
    },
    yearStatWrap: { alignItems: "center", flex: 1 },
    yearStatVal: { color: c.ink, fontFamily: fonts.display, fontSize: 22, fontWeight: "900" },
    yearStatLbl: { color: c.muted, fontFamily: fonts.body, fontSize: 10, fontWeight: "800", marginTop: 2 },
    yearMeta: {
      borderTopColor: c.border,
      borderTopWidth: 1,
      marginBottom: spacing.md,
      paddingTop: spacing.sm
    },
    yearMetaRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4
    },
    yearMetaLabel: { color: c.muted, fontFamily: fonts.body, fontSize: 12, fontWeight: "800" },
    yearMetaValue: { color: c.ink, fontFamily: fonts.body, fontSize: 12, fontWeight: "900", maxWidth: "60%", textAlign: "right" },
    shareBtn: {
      alignItems: "center",
      backgroundColor: c.gold,
      borderRadius: radii.pill,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      paddingVertical: 13
    },
    shareBtnText: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900"
    },
    emptyState: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: 54
    },
    emptyIconWrap: {
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderRadius: 24,
      height: 88,
      justifyContent: "center",
      width: 88
    },
    emptyTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 22,
      fontWeight: "900",
      textAlign: "center"
    },
    emptySub: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center"
    }
  });
}
