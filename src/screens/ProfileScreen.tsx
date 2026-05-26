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
  bronze: "#CD7F32",
  silver: "#A8A9AD",
  gold: "#FFC857",
  legendary: "#9B5DE5"
};

const READER_LEVELS = [
  { title: "Page Apprentice", minBooks: 0, note: "Starting the shelf." },
  { title: "Story Scout", minBooks: 2, note: "Testing your taste." },
  { title: "Shelf Wanderer", minBooks: 4, note: "Building rhythm." },
  { title: "Saga Cartographer", minBooks: 5, note: "Tracking worlds and arcs." },
  { title: "Chapter Curator", minBooks: 10, note: "Your shelves have shape." },
  { title: "Archive Architect", minBooks: 18, note: "Reading with intention." },
  { title: "Canon Keeper", minBooks: 30, note: "A serious personal library." },
  { title: "Mythic Reader", minBooks: 50, note: "A reader with gravity." },
  { title: "Legend Ledger", minBooks: 75, note: "The log becomes legacy." }
] as const;

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
  const { books, getAuthor, overallStats, repositoryStatus, userProfile } = useBooklio();
  const topBooks = userProfile.topBookIds.map((id) => books.find((b) => b.id === id)).filter(Boolean);
  const unlockedAchievements = userProfile.achievements.filter((achievement) => achievement.unlocked);
  const lockedAchievements = userProfile.achievements.filter((achievement) => !achievement.unlocked);
  const unlocked = unlockedAchievements.length;
  const goalPct = Math.min(100, Math.round((overallStats.booksReadThisYear / userProfile.yearlyGoal) * 100));
  const repositoryCopy = getRepositoryCopy(repositoryStatus);
  const level = getReaderLevel(overallStats.totalBooksRead, userProfile.readingLevel);
  const nextLevel = READER_LEVELS[level.index + 1];
  const nextLevelProgress = nextLevel
    ? Math.min(
        100,
        Math.round(
          ((overallStats.totalBooksRead - level.level.minBooks) / Math.max(1, nextLevel.minBooks - level.level.minBooks)) * 100
        )
      )
    : 100;
  const futureLevels = READER_LEVELS.slice(level.index + 1, level.index + 4);
  const nextUnlocks = [...lockedAchievements]
    .sort((a, b) => b.progress / Math.max(1, b.goal) - a.progress / Math.max(1, a.goal))
    .slice(0, 3);
  const identityStats = [
    { label: "Books", value: String(overallStats.totalBooksRead) },
    { label: "Sessions", value: String(overallStats.totalSessions) },
    { label: "Badges", value: String(unlocked) }
  ];

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.heroGlowLarge} />
        <View style={styles.heroGlowSmall} />
        <View style={styles.heroTop}>
          <View style={styles.avatarWrap}>
            {userProfile.avatarUri ? (
              <Image source={{ uri: userProfile.avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{userProfile.avatarInitials}</Text>
              </View>
            )}
            <View style={styles.rankMedallion}>
              <Ionicons name="sparkles" size={12} color={colors.navy} />
            </View>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.name}>{userProfile.name}</Text>
            <Text style={styles.levelEyebrow}>Current reading identity</Text>
            <Text style={styles.level}>{level.level.title}</Text>
            <Text style={styles.levelNote}>{level.level.note}</Text>
            {userProfile.email ? <Text style={styles.email}>{userProfile.email}</Text> : null}
          </View>

          <Pressable style={styles.editButton} onPress={() => navigation.navigate("EditProfile")}>
            <Ionicons name="pencil" size={14} color={colors.card} />
          </Pressable>
        </View>

        <View style={styles.heroStatsRow}>
          {identityStats.map((item) => (
            <View key={item.label} style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{item.value}</Text>
              <Text style={styles.heroStatLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.heroFooter}>
          <View style={styles.heroFooterPill}>
            <Ionicons name="cloud-done-outline" size={12} color={repositoryCopy.accent} />
            <Text style={styles.heroFooterText}>{repositoryCopy.title}</Text>
          </View>
          <View style={styles.heroFooterPill}>
            <Ionicons name="ribbon-outline" size={12} color={colors.gold} />
            <Text style={styles.heroFooterText}>
              {nextLevel ? `${nextLevel.minBooks - overallStats.totalBooksRead} books to ${nextLevel.title}` : "Top rank reached"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.identityCard}>
        <View style={styles.identityHeader}>
          <View>
            <Text style={styles.identityEyebrow}>Reader path</Text>
            <Text style={styles.identityTitle}>
              {nextLevel ? `Next: ${nextLevel.title}` : "Reading legend"}
            </Text>
          </View>
          <Text style={styles.identityPct}>{nextLevelProgress}%</Text>
        </View>
        <Text style={styles.identityBody}>
          {nextLevel
            ? `${overallStats.totalBooksRead} books logged. Keep going to unlock ${nextLevel.title}.`
            : "You have reached the highest visible reading tier in Booklio."}
        </Text>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${nextLevelProgress}%` }]} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.futureLevelsRow}>
          {futureLevels.map((futureLevel) => (
            <View key={futureLevel.title} style={styles.futureLevelCard}>
              <Text style={styles.futureLevelBooks}>{futureLevel.minBooks} books</Text>
              <Text style={styles.futureLevelTitle}>{futureLevel.title}</Text>
              <Text style={styles.futureLevelNote}>{futureLevel.note}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.goalCard}>
        <View style={styles.goalRow}>
          <View>
            <Text style={styles.goalLabel}>Annual goal</Text>
            <Text style={styles.goalText}>{overallStats.booksReadThisYear} / {userProfile.yearlyGoal} books</Text>
          </View>
          <Text style={styles.goalPct}>{goalPct}%</Text>
        </View>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${goalPct}%` }]} />
        </View>
        <Text style={styles.goalHint}>
          {goalPct >= 100
            ? "You hit your yearly mark. Time to stretch the shelf."
            : `${Math.max(0, userProfile.yearlyGoal - overallStats.booksReadThisYear)} books left to hit your 2026 target.`}
        </Text>
      </View>

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
            {unlockedAchievements.slice(0, 6).map((achievement) => (
              <UnlockedBubble key={achievement.id} achievement={achievement} />
            ))}
            {unlockedAchievements.length > 6 ? (
              <View style={styles.lockedCount}>
                <Ionicons name="sparkles" size={12} color={colors.gold} />
                <Text style={styles.lockedCountText}>+{unlockedAchievements.length - 6}</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <Text style={styles.achievementsEmpty}>Log sessions and finish books to earn your first badge.</Text>
        )}

        <View style={styles.nextUnlocksWrap}>
          <Text style={styles.nextUnlocksTitle}>Closest next unlocks</Text>
          {nextUnlocks.map((achievement) => {
            const progressPct = Math.min(100, Math.round((achievement.progress / Math.max(1, achievement.goal)) * 100));
            return (
              <View key={achievement.id} style={styles.nextUnlockCard}>
                <View style={styles.nextUnlockHeader}>
                  <View style={styles.nextUnlockTitleWrap}>
                    <Image source={getAchievementIconSource(achievement)} style={styles.nextUnlockIcon} resizeMode="contain" />
                    <View style={styles.nextUnlockCopy}>
                      <Text style={styles.nextUnlockName}>{achievement.title}</Text>
                      <Text style={styles.nextUnlockMeta}>{achievement.progress} / {achievement.goal}</Text>
                    </View>
                  </View>
                  <Text style={styles.nextUnlockPct}>{progressPct}%</Text>
                </View>
                <View style={styles.nextUnlockTrack}>
                  <View style={[styles.nextUnlockFill, { width: `${progressPct}%` }]} />
                </View>
              </View>
            );
          })}
        </View>
      </Pressable>

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

function getReaderLevel(totalBooksRead: number, customLevel?: string) {
  const index = READER_LEVELS.reduce((current, level, levelIndex) => (
    totalBooksRead >= level.minBooks ? levelIndex : current
  ), 0);

  const level = READER_LEVELS[index];
  if (customLevel && customLevel.trim().length) {
    return {
      index,
      level: {
        ...level,
        title: customLevel
      }
    };
  }

  return { index, level };
}

function getRepositoryCopy(repositoryStatus: ReturnType<typeof useBooklio>["repositoryStatus"]) {
  if (repositoryStatus.syncState === "error") {
    return {
      accent: colors.coral,
      title: "Sync needs attention",
      body: repositoryStatus.lastError ?? "Booklio could not persist your latest changes."
    };
  }

  if (repositoryStatus.remoteEnabled) {
    return {
      accent: colors.teal,
      title: repositoryStatus.lastSavedAt ? "Remote sync active" : "Remote sync configured",
      body: repositoryStatus.lastSavedAt
        ? `Cached locally and synced ${formatSyncTime(repositoryStatus.lastSavedAt)}.`
        : "Booklio is ready to sync as soon as this device signs into its cloud account."
    };
  }

  return {
    accent: colors.green,
    title: "Saved on this device",
    body: repositoryStatus.lastSavedAt
      ? `Last saved ${formatSyncTime(repositoryStatus.lastSavedAt)}.`
      : "Your reading life is stored locally for now."
  };
}

function formatSyncTime(timestamp: string) {
  const parsed = new Date(timestamp);
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

const styles = StyleSheet.create({
  hero: {
    ...shadows.card,
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    overflow: "hidden",
    padding: spacing.lg,
    position: "relative"
  },
  heroGlowLarge: {
    backgroundColor: "rgba(20, 184, 166, 0.14)",
    borderRadius: 180,
    height: 220,
    position: "absolute",
    right: -60,
    top: -30,
    width: 220
  },
  heroGlowSmall: {
    backgroundColor: "rgba(255, 200, 87, 0.14)",
    borderRadius: 90,
    bottom: -30,
    height: 120,
    left: -20,
    position: "absolute",
    width: 120
  },
  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    zIndex: 1
  },
  avatarWrap: {
    position: "relative"
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: 38,
    height: 76,
    justifyContent: "center",
    width: 76
  },
  avatarImage: {
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 38,
    borderWidth: 2,
    height: 76,
    width: 76
  },
  avatarText: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "900"
  },
  rankMedallion: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderColor: colors.navy,
    borderRadius: radii.pill,
    borderWidth: 2,
    bottom: -4,
    height: 24,
    justifyContent: "center",
    position: "absolute",
    right: -4,
    width: 24
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
  levelEyebrow: {
    color: "#8FD7CE",
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginTop: 3,
    textTransform: "uppercase"
  },
  level: {
    color: colors.gold,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 2
  },
  levelNote: {
    color: "#D7EAE4",
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4
  },
  email: {
    color: "#AFC5BE",
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginTop: 6
  },
  editButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    padding: 10
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    zIndex: 1
  },
  heroStatCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 12
  },
  heroStatValue: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "900"
  },
  heroStatLabel: {
    color: "#BFD4CD",
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: "uppercase"
  },
  heroFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
    zIndex: 1
  },
  heroFooterPill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  heroFooterText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800"
  },
  identityCard: {
    ...shadows.card,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  identityHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  identityEyebrow: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  identityTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 2
  },
  identityPct: {
    color: colors.teal,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900"
  },
  identityBody: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6
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
    fontSize: 20,
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
  goalHint: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8
  },
  futureLevelsRow: {
    gap: spacing.sm,
    paddingTop: spacing.md
  },
  futureLevelCard: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 108,
    padding: spacing.md,
    width: 160
  },
  futureLevelBooks: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  futureLevelTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6
  },
  futureLevelNote: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6
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
    backgroundColor: colors.cream,
    borderRadius: 32,
    borderWidth: 2,
    height: 64,
    justifyContent: "center",
    marginRight: spacing.sm,
    width: 64
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
  nextUnlocksWrap: {
    marginTop: spacing.md
  },
  nextUnlocksTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.sm
  },
  nextUnlockCard: {
    backgroundColor: colors.cream,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    padding: spacing.sm
  },
  nextUnlockHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  nextUnlockTitleWrap: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: spacing.sm
  },
  nextUnlockIcon: {
    height: 42,
    width: 42
  },
  nextUnlockCopy: {
    flex: 1
  },
  nextUnlockName: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  nextUnlockMeta: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginTop: 2
  },
  nextUnlockPct: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  nextUnlockTrack: {
    backgroundColor: "#E8E1D5",
    borderRadius: radii.pill,
    height: 8,
    marginTop: 10,
    overflow: "hidden"
  },
  nextUnlockFill: {
    backgroundColor: colors.teal,
    borderRadius: radii.pill,
    height: "100%"
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
