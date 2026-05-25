import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BookCard } from "../components/BookCard";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { useBooklio } from "../data/BooklioContext";
import { Achievement } from "../types/models";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

type BadgeConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
};

const BADGE_CONFIG: Record<Achievement["category"], BadgeConfig> = {
  reading:    { icon: "book",              color: "#0F172A", bg: "#FFC857" },
  habit:      { icon: "flame",             color: "#FFFFFF", bg: "#FF7A59" },
  genre:      { icon: "trophy-outline",    color: "#FFFFFF", bg: "#14B8A6" },
  collection: { icon: "library",           color: "#FFFFFF", bg: "#7FB069" },
  speed:      { icon: "speedometer",       color: "#FFFFFF", bg: "#6366F1" }
};

function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const cfg = BADGE_CONFIG[achievement.category] ?? BADGE_CONFIG["reading"];
  const pct = Math.min(100, Math.round((achievement.progress / achievement.goal) * 100));
  const locked = !achievement.unlocked;

  return (
    <View style={[styles.badge, locked && styles.badgeLocked]}>
      <View style={[styles.badgeIcon, { backgroundColor: locked ? "#D5CFC5" : cfg.bg }]}>
        <Ionicons name={cfg.icon} size={22} color={locked ? "#A09890" : cfg.color} />
      </View>
      <Text style={[styles.badgeTitle, locked && styles.badgeTitleLocked]} numberOfLines={2}>
        {achievement.title}
      </Text>
      <Text style={styles.badgeDesc} numberOfLines={2}>
        {achievement.description}
      </Text>
      <View style={styles.badgeTrack}>
        <View style={[styles.badgeFill, { width: `${pct}%`, backgroundColor: locked ? "#C5BEB4" : cfg.bg }]} />
      </View>
      <Text style={[styles.badgePct, { color: locked ? colors.muted : cfg.bg }]}>
        {achievement.unlocked
          ? "Unlocked ✓"
          : `${Math.min(achievement.progress, achievement.goal)} / ${achievement.goal}`}
      </Text>
    </View>
  );
}

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { books, getAuthor, overallStats, userProfile } = useBooklio();
  const topBooks = userProfile.topBookIds.map((id) => books.find((b) => b.id === id)).filter(Boolean);
  const unlocked = userProfile.achievements.filter((a) => a.unlocked).length;
  const goalPct = Math.min(100, Math.round((overallStats.booksReadThisYear / userProfile.yearlyGoal) * 100));

  return (
    <Screen>
      {/* Profile hero */}
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userProfile.avatarInitials}</Text>
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.name}>{userProfile.name}</Text>
          <Text style={styles.level}>{userProfile.readingLevel}</Text>
          <Text style={styles.meta}>
            {overallStats.totalBooksRead} books · {overallStats.totalSessions} sessions · {unlocked} badges
          </Text>
        </View>
        <Pressable style={styles.editButton} onPress={() => navigation.navigate("EditProfile")}>
          <Ionicons name="pencil" size={14} color={colors.card} />
        </Pressable>
      </View>

      {/* Goal */}
      <View style={styles.goalCard}>
        <View style={styles.goalRow}>
          <Text style={styles.goalLabel}>Annual goal</Text>
          <Text style={styles.goalPct}>{goalPct}%</Text>
        </View>
        <Text style={styles.goalText}>{overallStats.booksReadThisYear} / {userProfile.yearlyGoal} books</Text>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${goalPct}%` }]} />
        </View>
      </View>

      {/* Achievements */}
      <SectionHeader title="Achievements" />
      <View style={styles.achievementGrid}>
        {userProfile.achievements.map((a) => (
          <AchievementBadge key={a.id} achievement={a} />
        ))}
      </View>

      {/* Top books */}
      {topBooks.length > 0 ? (
        <>
          <SectionHeader title="Personal Favorites" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {topBooks.map((book) =>
              book ? (
                <BookCard
                  key={book.id}
                  authorName={getAuthor(book.authorId)?.name ?? ""}
                  book={book}
                  onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}
                />
              ) : null
            )}
          </ScrollView>
        </>
      ) : null}

      {/* Genres */}
      {userProfile.favoriteGenres.length > 0 ? (
        <>
          <SectionHeader title="Favorite Genres" />
          <View style={styles.tagWrap}>
            {userProfile.favoriteGenres.map((genre) => (
              <View key={genre} style={styles.tagPill}>
                <Text style={styles.tagText}>{genre}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* Authors */}
      {userProfile.favoriteAuthors.length > 0 ? (
        <>
          <SectionHeader title="Favorite Authors" />
          <View style={styles.tagWrap}>
            {userProfile.favoriteAuthors.map((author) => (
              <View key={author} style={[styles.tagPill, styles.tagPillAuthor]}>
                <Text style={[styles.tagText, styles.tagTextAuthor]}>{author}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
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
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: 30,
    height: 60,
    justifyContent: "center",
    width: 60
  },
  avatarText: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "900"
  },
  heroCopy: {
    flex: 1
  },
  name: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "900"
  },
  level: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 2
  },
  meta: {
    color: "#BDB8B0",
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 5
  },
  editButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    padding: 10
  },
  goalCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  goalRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  goalLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  goalPct: {
    color: colors.green,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "900"
  },
  goalText: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 3
  },
  goalTrack: {
    backgroundColor: "#EEE7DB",
    borderRadius: radii.pill,
    height: 10,
    marginTop: spacing.sm,
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
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  badge: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    width: "48%"
  },
  badgeLocked: {
    backgroundColor: "#F7F4EF",
    borderColor: "#E5DDD3"
  },
  badgeIcon: {
    alignItems: "center",
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 44
  },
  badgeTitle: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17
  },
  badgeTitleLocked: {
    color: "#9E978E"
  },
  badgeDesc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3
  },
  badgeTrack: {
    backgroundColor: "#EEE7DB",
    borderRadius: radii.pill,
    height: 5,
    marginTop: spacing.sm,
    overflow: "hidden"
  },
  badgeFill: {
    borderRadius: radii.pill,
    height: "100%"
  },
  badgePct: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 5
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  tagPill: {
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 9
  },
  tagPillAuthor: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1
  },
  tagText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  tagTextAuthor: {
    color: colors.navy
  }
});
