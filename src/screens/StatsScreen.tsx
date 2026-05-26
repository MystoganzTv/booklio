import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { BarChart } from "../components/BarChart";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

type Tab = "books" | "pages" | "minutes";

export function StatsScreen() {
  const { books, overallStats, userProfile } = useBooklio();
  const [activeTab, setActiveTab] = useState<Tab>("books");

  const unfinishedCount = books.filter((b) => b.userStatus.status === "dnf").length;
  const goalPct = Math.min(100, Math.round((overallStats.booksReadThisYear / userProfile.yearlyGoal) * 100));

  const chartData: Record<Tab, { label: string; value: number }[]> = {
    books:   overallStats.monthly.map((m) => ({ label: m.label, value: m.booksFinished })),
    pages:   overallStats.monthly.map((m) => ({ label: m.label, value: m.pages })),
    minutes: overallStats.monthly.map((m) => ({ label: m.label, value: m.minutes }))
  };

  const topGenre  = overallStats.genreCounts[0]?.label  ?? "—";
  const topAuthor = overallStats.authorCounts[0]?.label ?? "—";
  const avgSpeed  = Math.round(
    overallStats.speedOverTime.reduce((s, d) => s + d.value, 0) /
    (overallStats.speedOverTime.length || 1)
  );
  const hoursRead = Math.round(overallStats.minutesRead / 60);
  const bestDay   = overallStats.bestReadingDay === "No sessions yet"
    ? "—"
    : new Date(`${overallStats.bestReadingDay}T00:00:00`).toLocaleDateString("en-US", {
        month: "short", day: "numeric"
      });

  const shareYearInReview = async () => {
    const year = new Date().getFullYear();
    const text = [
      `📚 My ${year} in books — powered by Booklio`,
      ``,
      `${overallStats.booksReadThisYear} books read`,
      overallStats.rereadsCompleted > 0 ? `${overallStats.rereadsCompleted} rereads completed` : null,
      `${overallStats.pagesRead.toLocaleString()} pages`,
      `${hoursRead} hours of reading`,
      `${overallStats.longestStreak}-day longest streak`,
      topGenre  !== "—" ? `Favorite genre: ${topGenre}`        : null,
      topAuthor !== "—" ? `Most-read author: ${topAuthor}`      : null,
      overallStats.averageRating > 0 ? `Average rating: ${overallStats.averageRating} ★` : null
    ].filter(Boolean).join("\n");

    try { await Share.share({ message: text }); }
    catch { Alert.alert("Could not share", "Try again later."); }
  };

  const hasData = overallStats.totalBooksRead > 0 || overallStats.pagesRead > 0;

  if (!hasData) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Statistics</Text>
          <Text style={styles.title}>Your reading stats</Text>
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
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Statistics</Text>
        <Text style={styles.title}>Your reading stats</Text>
      </View>

      {/* ── Hero card: goal + big numbers ──────────────────────── */}
      <View style={styles.heroCard}>
        {/* Goal row */}
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

        {/* Key numbers */}
        <View style={styles.heroNumbers}>
          <HeroStat value={overallStats.pagesRead.toLocaleString()} label="pages" />
          <HeroStat value={`${hoursRead}h`} label="hours read" />
          <HeroStat value={`${overallStats.longestStreak}d`} label="best streak" accent={colors.coral} />
          <HeroStat value={overallStats.totalSessions.toString()} label="sessions" />
        </View>
      </View>

      {/* ── Monthly activity chart ──────────────────────────────── */}
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

      {/* ── Insights grid ──────────────────────────────────────── */}
      <View style={styles.insightsCard}>
        <Text style={styles.sectionTitle}>Insights</Text>
        <View style={styles.insightsGrid}>
          <InsightTile icon="compass-outline"      label="Top genre"    value={topGenre}         color={colors.teal}    />
          <InsightTile icon="person-outline"        label="Top author"   value={topAuthor}        color={colors.navy}    />
          <InsightTile icon="speedometer-outline"   label="Avg speed"    value={`${avgSpeed} pp/h`} color="#6366F1"     />
          <InsightTile icon="calendar-outline"      label="Best day"     value={bestDay}           color={colors.gold}   />
          <InsightTile icon="star-outline"          label="Avg rating"   value={overallStats.averageRating.toFixed(1) + " ★"} color={colors.coral} />
          <InsightTile icon="close-circle-outline"  label="Unfinished"   value={unfinishedCount.toString()} color={colors.muted} />
        </View>
      </View>

      {/* ── Genre breakdown ────────────────────────────────────── */}
      {overallStats.genreCounts.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>By genre</Text>
          <BarChart data={overallStats.genreCounts.slice(0, 6)} />
        </View>
      )}

      {/* ── Year in Review ─────────────────────────────────────── */}
      <View style={styles.yearCard}>
        <View style={styles.yearTop}>
          <Text style={styles.yearEyebrow}>{new Date().getFullYear()} Year in Review</Text>
          <Ionicons name="trophy" size={20} color={colors.gold} />
        </View>

        <Text style={styles.yearTitle}>Your reading year, at a glance.</Text>

        <View style={styles.yearRow}>
          <YearStat value={overallStats.booksReadThisYear.toString()} label="books read" />
          <YearStat value={overallStats.pagesRead.toLocaleString()} label="pages" />
          <YearStat value={`${hoursRead}h`} label="hours" />
        </View>

        {(topGenre !== "—" || topAuthor !== "—") && (
          <View style={styles.yearMeta}>
            {topGenre  !== "—" && <YearMeta label="Top genre"   value={topGenre}  />}
            {topAuthor !== "—" && <YearMeta label="Top author"  value={topAuthor} />}
          </View>
        )}

        <Pressable style={styles.shareBtn} onPress={shareYearInReview}>
          <Ionicons name="share-outline" size={15} color={colors.navy} />
          <Text style={styles.shareBtnText}>Share my year</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HeroStat({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <View style={heroStatStyles.wrap}>
      <Text style={[heroStatStyles.val, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={heroStatStyles.lbl}>{label}</Text>
    </View>
  );
}

const heroStatStyles = StyleSheet.create({
  wrap: { alignItems: "center", flex: 1 },
  val:  { color: colors.card, fontFamily: fonts.display, fontSize: 18, fontWeight: "900" },
  lbl:  { color: "rgba(255,255,255,0.55)", fontFamily: fonts.body, fontSize: 10, fontWeight: "800", marginTop: 2 }
});

function InsightTile({ icon, label, value, color }: {
  icon: string; label: string; value: string; color: string;
}) {
  return (
    <View style={insightStyles.tile}>
      <View style={[insightStyles.iconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={insightStyles.label}>{label}</Text>
      <Text style={insightStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const insightStyles = StyleSheet.create({
  tile: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    minWidth: "30%",
    padding: spacing.sm + 2
  },
  iconWrap: { alignItems: "center", borderRadius: 8, height: 28, justifyContent: "center", marginBottom: 6, width: 28 },
  label: { color: colors.muted, fontFamily: fonts.body, fontSize: 10, fontWeight: "800", marginBottom: 3, textTransform: "uppercase" },
  value: { color: colors.navy, fontFamily: fonts.display, fontSize: 14, fontWeight: "900" }
});

function YearStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={yearStatStyles.wrap}>
      <Text style={yearStatStyles.val}>{value}</Text>
      <Text style={yearStatStyles.lbl}>{label}</Text>
    </View>
  );
}

const yearStatStyles = StyleSheet.create({
  wrap: { alignItems: "center", flex: 1 },
  val:  { color: colors.card, fontFamily: fonts.display, fontSize: 22, fontWeight: "900" },
  lbl:  { color: "rgba(255,255,255,0.5)", fontFamily: fonts.body, fontSize: 10, fontWeight: "800", marginTop: 2 }
});

function YearMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={yearMetaStyles.row}>
      <Text style={yearMetaStyles.label}>{label}</Text>
      <Text style={yearMetaStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const yearMetaStyles = StyleSheet.create({
  row:   { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "rgba(255,255,255,0.5)", fontFamily: fonts.body, fontSize: 12, fontWeight: "800" },
  value: { color: colors.card, fontFamily: fonts.body, fontSize: 12, fontWeight: "900", maxWidth: "60%", textAlign: "right" }
});

// ── Styles ────────────────────────────────────────────────────────────────────

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

  // ── Hero card ──
  heroCard: {
    ...shadows.card,
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.lg
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
    color: colors.card,
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
    color: colors.gold,
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
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    height: "100%"
  },
  heroNumbers: {
    borderTopColor: "rgba(255,255,255,0.1)",
    borderTopWidth: 1,
    flexDirection: "row",
    paddingTop: spacing.md
  },

  // ── Chart card ──
  chartCard: {
    ...shadows.card,
    backgroundColor: colors.card,
    borderColor: colors.border,
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
    color: colors.navy,
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
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  tabActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  tabText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900"
  },
  tabTextActive: { color: colors.card },

  // ── Insights ──
  insightsCard: {
    ...shadows.card,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  insightsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm
  },

  // ── Year in Review ──
  yearCard: {
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
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
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  yearTitle: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
    marginBottom: spacing.lg
  },
  yearRow: {
    borderTopColor: "rgba(255,255,255,0.1)",
    borderTopWidth: 1,
    flexDirection: "row",
    marginBottom: spacing.md,
    paddingTop: spacing.md
  },
  yearMeta: {
    borderTopColor: "rgba(255,255,255,0.1)",
    borderTopWidth: 1,
    marginBottom: spacing.md,
    paddingTop: spacing.sm
  },
  shareBtn: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    paddingVertical: 13
  },
  shareBtnText: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },

  // ── Empty state ──
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
