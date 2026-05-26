import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BookCard } from "../components/BookCard";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { useBooklio } from "../data/BooklioContext";
import { Achievement } from "../types/models";
import { RootStackParamList } from "../navigation/types";
import { getAchievementIconSource } from "../utils/achievementIcons";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

const TIER_COLOR: Record<Achievement["tier"], string> = {
  bronze:    "#CD7F32",
  silver:    "#A8A9AD",
  gold:      "#FFC857",
  legendary: "#9B5DE5"
};

function UnlockedBubble({ achievement }: { achievement: Achievement }) {
  const source = getAchievementIconSource(achievement);
  const isCompound = Array.from(achievement.icon).length > 1;
  return (
    <View style={[styles.bubble, { borderColor: TIER_COLOR[achievement.tier] }]}>
      {source ? (
        <Image source={source} style={styles.achievementArtwork} resizeMode="contain" />
      ) : (
        <Text numberOfLines={1} style={[styles.achievementEmoji, isCompound && styles.achievementEmojiCompound]}>
          {achievement.icon}
        </Text>
      )}
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

      {/* Achievements teaser */}
      <Pressable style={styles.achievementsCard} onPress={() => navigation.navigate("Achievements")}>
        <View style={styles.achievementsCardTop}>
          <View>
            <Text style={styles.achievementsEyebrow}>Achievements</Text>
            <Text style={styles.achievementsCount}>
              {unlocked} <Text style={styles.achievementsCountMuted}>of {userProfile.achievements.length} unlocked</Text>
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>
        {unlocked > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bubblesRow}>
            {userProfile.achievements.filter((a) => a.unlocked).map((a) => (
              <UnlockedBubble key={a.id} achievement={a} />
            ))}
            {userProfile.achievements.filter((a) => !a.unlocked).length > 0 && (
              <View style={styles.lockedCount}>
                <Ionicons name="lock-closed" size={12} color={colors.muted} />
                <Text style={styles.lockedCountText}>
                  +{userProfile.achievements.filter((a) => !a.unlocked).length}
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <Text style={styles.achievementsEmpty}>Log sessions and finish books to earn your first badge.</Text>
        )}
      </Pressable>

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
  achievementsCard: {
    ...shadows.card,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  achievementsCardTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md
  },
  achievementsEyebrow: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  achievementsCount: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2
  },
  achievementsCountMuted: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: "700"
  },
  bubblesRow: {
    flexDirection: "row"
  },
  bubble: {
    alignItems: "center",
    borderRadius: 32,
    borderWidth: 2,
    height: 64,
    justifyContent: "center",
    marginRight: spacing.sm,
    overflow: "visible",
    width: 64,
    backgroundColor: colors.cream
  },
  achievementArtwork: {
    height: 60,
    width: 60
  },
  achievementEmoji: {
    fontSize: 25,
    includeFontPadding: false,
    lineHeight: 34,
    minWidth: 48,
    textAlign: "center"
  },
  achievementEmojiCompound: {
    fontSize: 20,
    lineHeight: 28,
    minWidth: 58
  },
  lockedCount: {
    alignItems: "center",
    backgroundColor: "#F0EDE8",
    borderRadius: 28,
    flexDirection: "row",
    gap: 4,
    height: 52,
    justifyContent: "center",
    paddingHorizontal: 14
  },
  lockedCountText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  achievementsEmpty: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19
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
