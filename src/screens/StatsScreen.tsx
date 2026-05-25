import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BarChart } from "../components/BarChart";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

type Tab = "books" | "pages" | "minutes";

export function StatsScreen() {
  const { books, overallStats, userProfile } = useBooklio();
  const [activeTab, setActiveTab] = useState<Tab>("books");

  const dnfCount = books.filter((b) => b.userStatus.status === "dnf").length;
  const goalPct = Math.min(100, Math.round((overallStats.booksReadThisYear / userProfile.yearlyGoal) * 100));

  const chartData: Record<Tab, { label: string; value: number }[]> = {
    books:   overallStats.monthly.map((m) => ({ label: m.label, value: m.booksFinished })),
    pages:   overallStats.monthly.map((m) => ({ label: m.label, value: m.pages })),
    minutes: overallStats.monthly.map((m) => ({ label: m.label, value: m.minutes }))
  };

  const topGenre = overallStats.genreCounts[0]?.label ?? "—";
  const avgSpeed = Math.round(
    overallStats.speedOverTime.reduce((s, d) => s + d.value, 0) / (overallStats.speedOverTime.length || 1)
  );

  const hasData = overallStats.totalBooksRead > 0 || overallStats.pagesRead > 0;

  if (!hasData) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Statistics</Text>
          <Text style={styles.title}>Your year in books</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="bar-chart-outline" size={48} color={colors.teal} />
          <Text style={styles.emptyTitle}>Nothing to show yet</Text>
          <Text style={styles.emptySub}>
            Log your first reading session and your stats will appear here.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Statistics</Text>
        <Text style={styles.title}>Your year in books</Text>
      </View>

      {/* Key stats strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{overallStats.totalBooksRead}</Text>
          <Text style={styles.statLbl}>books read</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{overallStats.averageRating.toFixed(1)}</Text>
          <Text style={styles.statLbl}>avg rating</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={[styles.statVal, { color: colors.coral }]}>{overallStats.longestStreak}d</Text>
          <Text style={styles.statLbl}>longest streak</Text>
        </View>
      </View>

      {/* Goal + DNF */}
      <View style={styles.goalRow}>
        <View style={styles.goalPill}>
          <Text style={styles.goalText}>Annual goal</Text>
          <Text style={styles.goalBig}>{overallStats.booksReadThisYear}/{userProfile.yearlyGoal}</Text>
          <View style={styles.goalTrack}>
            <View style={[styles.goalFill, { width: `${goalPct}%` }]} />
          </View>
        </View>
        <View style={styles.goalPill}>
          <Text style={styles.goalText}>DNF this year</Text>
          <Text style={styles.goalBig}>{dnfCount}</Text>
        </View>
      </View>

      {/* Monthly chart with tabs */}
      <View style={styles.chartCard}>
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
        <BarChart data={chartData[activeTab]} />
      </View>

      {/* Highlights */}
      <View style={styles.highlightRow}>
        <View style={[styles.highlightCard, { backgroundColor: colors.teal }]}>
          <Text style={styles.highlightLabel}>Top genre</Text>
          <Text style={styles.highlightValue}>{topGenre}</Text>
        </View>
        <View style={[styles.highlightCard, { backgroundColor: colors.navy }]}>
          <Text style={styles.highlightLabel}>Avg speed</Text>
          <Text style={styles.highlightValue}>{avgSpeed} pp/h</Text>
        </View>
      </View>

      {/* Genre breakdown */}
      {overallStats.genreCounts.length > 0 ? (
        <View style={styles.genreCard}>
          <Text style={styles.sectionTitle}>By genre</Text>
          <BarChart data={overallStats.genreCounts.slice(0, 5)} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.md
  },
  eyebrow: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase"
  },
  title: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2
  },
  statsStrip: {
    ...shadows.card,
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  statItem: {
    alignItems: "center",
    flex: 1
  },
  statVal: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: "900"
  },
  statLbl: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center"
  },
  divider: {
    backgroundColor: colors.border,
    height: 36,
    width: 1
  },
  goalRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  goalPill: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    padding: spacing.md
  },
  goalText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: spacing.xs,
    textTransform: "uppercase"
  },
  goalBig: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: "900"
  },
  goalTrack: {
    backgroundColor: "#EEE7DB",
    borderRadius: radii.pill,
    height: 8,
    marginTop: 6,
    overflow: "hidden"
  },
  goalFill: {
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    height: "100%"
  },
  chartCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md
  },
  tab: {
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 7
  },
  tabActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  tabText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  tabTextActive: {
    color: colors.card
  },
  highlightRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  highlightCard: {
    borderRadius: radii.md,
    flex: 1,
    padding: spacing.md
  },
  highlightLabel: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 4,
    textTransform: "uppercase"
  },
  highlightValue: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "900"
  },
  genreCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  sectionTitle: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: spacing.md,
    textTransform: "uppercase"
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 60
  },
  emptyTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center"
  },
  emptySub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center"
  }
});
