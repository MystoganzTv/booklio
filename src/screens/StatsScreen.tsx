import { StyleSheet, Text, View } from "react-native";
import { BarChart } from "../components/BarChart";
import { BrandHeader } from "../components/BrandHeader";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { StatCard } from "../components/StatCard";
import { useBooklio } from "../data/BooklioContext";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

export function StatsScreen() {
  const { books, overallStats, series, userProfile } = useBooklio();
  const completedSagas = series.filter((saga) => {
    const sagaBooks = books.filter((book) => book.seriesId === saga.id);
    return sagaBooks.length > 0 && sagaBooks.every((book) => book.userStatus.status === "read");
  }).length;
  const dnfCount = books.filter((book) => book.userStatus.status === "dnf").length;

  return (
    <Screen>
      <BrandHeader
        eyebrow="Estadisticas"
        title="Tu lectura en numeros"
        subtitle="Progreso, rachas, velocidad, minutos, generos, autores y sagas completadas con una lectura clara y tranquila."
      />

      <View style={styles.statsGrid}>
        <StatCard label="Books Read" value={overallStats.totalBooksRead} />
        <StatCard label="Avg Rating" value={overallStats.averageRating} accent="green" />
        <StatCard label="Longest Streak" value={`${overallStats.longestStreak}d`} accent="navy" />
        <StatCard label="Completed Sagas" value={completedSagas} />
        <StatCard label="DNF Count" value={dnfCount} accent="navy" />
        <StatCard label="Challenge" value={`${overallStats.booksReadThisYear}/${userProfile.yearlyGoal}`} accent="green" />
      </View>

      <SectionHeader title="Books Read By Month" />
      <ChartCard>
        <BarChart data={overallStats.monthly.map((month) => ({ label: month.label, value: month.booksFinished }))} />
      </ChartCard>

      <SectionHeader title="Pages Read By Month" />
      <ChartCard>
        <BarChart data={overallStats.monthly.map((month) => ({ label: month.label, value: month.pages }))} />
      </ChartCard>

      <SectionHeader title="Minutes Read By Month" />
      <ChartCard>
        <BarChart data={overallStats.monthly.map((month) => ({ label: month.label, value: month.minutes }))} />
      </ChartCard>

      <SectionHeader title="Sessions By Month" />
      <ChartCard>
        <BarChart data={overallStats.monthly.map((month) => ({ label: month.label, value: month.sessions }))} />
      </ChartCard>

      <SectionHeader title="Favorite Genres" />
      <ChartCard>
        <BarChart data={overallStats.genreCounts.slice(0, 6)} />
      </ChartCard>

      <SectionHeader title="Favorite Authors" />
      <ChartCard>
        <BarChart data={overallStats.authorCounts.slice(0, 6)} />
      </ChartCard>

      <SectionHeader title="Owned vs Wishlist vs Buy" />
      <ChartCard>
        <BarChart data={overallStats.statusCounts} />
      </ChartCard>

      <SectionHeader title="Reading Speed Over Time" />
      <ChartCard>
        <BarChart data={overallStats.speedOverTime.slice(-8)} />
      </ChartCard>

      <SectionHeader title="Most Active Reading Days" />
      <ChartCard>
        <BarChart data={overallStats.mostActiveDays} />
      </ChartCard>
    </Screen>
  );
}

function ChartCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.chartCard}>{children}</View>;
}

const styles = StyleSheet.create({
  hero: {
    ...shadows.card,
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    padding: spacing.lg
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.3,
    textTransform: "uppercase"
  },
  title: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 36,
    fontWeight: "900",
    marginTop: spacing.sm
  },
  subtitle: {
    color: "#D8D2C8",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.md
  },
  chartCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md
  }
});
