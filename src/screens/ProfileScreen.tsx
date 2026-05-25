import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BookCard } from "../components/BookCard";
import { BrandHeader } from "../components/BrandHeader";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { books, getAuthor, overallStats, userProfile } = useBooklio();
  const topBooks = userProfile.topBookIds.map((bookId) => books.find((book) => book.id === bookId)).filter(Boolean);
  const unlocked = userProfile.achievements.filter((achievement) => achievement.unlocked).length;

  return (
    <Screen>
      <BrandHeader
        eyebrow="Perfil lector"
        title="Tu historia lectora"
        subtitle="Nivel, logros, top libros, autores favoritos y metas personales en un espacio mas humano."
      />

      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userProfile.avatarInitials}</Text>
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.name}>{userProfile.name}</Text>
          <Text style={styles.level}>{userProfile.readingLevel}</Text>
          <Text style={styles.meta}>{overallStats.totalBooksRead} books read - {overallStats.totalSessions} sessions - {unlocked} badges unlocked</Text>
        </View>
      </View>

      <View style={styles.goalCard}>
        <Text style={styles.goalLabel}>Reading goal</Text>
        <Text style={styles.goalText}>{overallStats.booksReadThisYear}/{userProfile.yearlyGoal} books this year</Text>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${Math.min(100, (overallStats.booksReadThisYear / userProfile.yearlyGoal) * 100)}%` }]} />
        </View>
      </View>

      <SectionHeader title="Achievements" />
      <View style={styles.achievementGrid}>
        {userProfile.achievements.map((achievement) => (
          <View key={achievement.id} style={[styles.achievement, achievement.unlocked && styles.achievementUnlocked]}>
            <Text style={styles.achievementTitle}>{achievement.title}</Text>
            <Text style={styles.achievementDescription}>{achievement.description}</Text>
            <Text style={styles.achievementProgress}>
              {Math.min(achievement.progress, achievement.goal)}/{achievement.goal}
            </Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Personal Top 10" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {topBooks.map((book) =>
          book ? (
            <BookCard
              key={book.id}
              authorName={getAuthor(book.authorId)?.name ?? "Unknown author"}
              book={book}
              onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}
            />
          ) : null
        )}
      </ScrollView>

      <SectionHeader title="Favorite Authors" />
      <View style={styles.listCard}>
        {userProfile.favoriteAuthors.map((author) => (
          <Text key={author} style={styles.listItem}>
            {author}
          </Text>
        ))}
      </View>

      <SectionHeader title="Favorite Genres" />
      <View style={styles.genreWrap}>
        {userProfile.favoriteGenres.map((genre) => (
          <Pressable key={genre} style={styles.genrePill}>
            <Text style={styles.genreText}>{genre}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    ...shadows.card,
    alignItems: "center",
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: 28,
    height: 72,
    justifyContent: "center",
    width: 72
  },
  avatarText: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "900"
  },
  heroCopy: {
    flex: 1
  },
  name: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: "900"
  },
  level: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 3
  },
  meta: {
    color: "#D8D2C8",
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6
  },
  goalCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md
  },
  goalLabel: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  goalText: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 25,
    fontWeight: "900",
    marginTop: 5
  },
  goalTrack: {
    backgroundColor: "#EEE7DB",
    borderRadius: radii.pill,
    height: 12,
    marginTop: spacing.md,
    overflow: "hidden"
  },
  goalFill: {
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    height: "100%"
  },
  achievementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  achievement: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    width: "48%"
  },
  achievementUnlocked: {
    backgroundColor: "#F5E7C8",
    borderColor: colors.gold
  },
  achievementTitle: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  },
  achievementDescription: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5
  },
  achievementProgress: {
    color: colors.green,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "900",
    marginTop: spacing.sm
  },
  listCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md
  },
  listItem: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 26
  },
  genreWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  genrePill: {
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 11
  },
  genreText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  }
});
