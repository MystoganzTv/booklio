import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { Achievement } from "../types/models";
import { getAchievementIconSource } from "../utils/achievementIcons";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

type Category = Achievement["category"];

const CATEGORY_META: Record<Category, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  reading:    { label: "Reading Milestones", icon: "book-outline",         color: colors.teal    },
  habit:      { label: "Habits",             icon: "flame-outline",        color: colors.coral   },
  genre:      { label: "Genres",             icon: "compass-outline",      color: colors.gold    },
  collection: { label: "Collection",         icon: "library-outline",      color: colors.green   },
  speed:      { label: "Speed",              icon: "speedometer-outline",  color: "#6366F1"      },
  social:     { label: "Social",             icon: "people-outline",       color: colors.navy    },
  location:   { label: "Reading Places",     icon: "location-outline",     color: "#F59E0B"      }
};

const CATEGORY_ORDER: Category[] = ["habit", "reading", "genre", "collection", "speed", "social", "location"];

const TIER_COLOR: Record<Achievement["tier"], string> = {
  bronze:    "#CD7F32",
  silver:    "#A8A9AD",
  gold:      "#FFC857",
  legendary: "#9B5DE5"
};

const TIER_LABEL: Record<Achievement["tier"], string> = {
  bronze:    "Bronze",
  silver:    "Silver",
  gold:      "Gold",
  legendary: "Legendary"
};

function TierPill({ tier, unlocked }: { tier: Achievement["tier"]; unlocked: boolean }) {
  return (
    <View style={[styles.tierPill, { borderColor: unlocked ? TIER_COLOR[tier] : "#C5BEB4" }]}>
      <Text style={[styles.tierText, { color: unlocked ? TIER_COLOR[tier] : "#A09890" }]}>
        {TIER_LABEL[tier]}
      </Text>
    </View>
  );
}

function AchievementEmoji({ achievement, locked = false }: { achievement: Achievement; locked?: boolean }) {
  const source = getAchievementIconSource(achievement);
  const isCompound = Array.from(achievement.icon).length > 1;

  if (source) {
    return (
      <Image
        source={source}
        style={[styles.achievementArtwork, locked && styles.achievementEmojiLocked]}
        resizeMode="contain"
      />
    );
  }

  return (
    <Text
      numberOfLines={1}
      style={[
        styles.achievementEmoji,
        isCompound && styles.achievementEmojiCompound,
        locked && styles.achievementEmojiLocked
      ]}
    >
      {achievement.icon}
    </Text>
  );
}

function UnlockedCard({ achievement }: { achievement: Achievement }) {
  return (
    <View style={[styles.unlockedCard, { borderLeftColor: TIER_COLOR[achievement.tier] }]}>
      <View style={styles.unlockedTop}>
        <View style={styles.unlockedEmojiBubble}>
          <AchievementEmoji achievement={achievement} />
        </View>
        <View style={styles.unlockedCopy}>
          <View style={styles.unlockedTitleRow}>
            <Text style={styles.unlockedTitle}>{achievement.title}</Text>
            <TierPill tier={achievement.tier} unlocked />
          </View>
          <Text style={styles.unlockedFlavour}>{achievement.flavour}</Text>
        </View>
      </View>
      <View style={styles.unlockedFooter}>
        <Ionicons name="checkmark-circle" size={14} color={colors.green} />
        <Text style={styles.unlockedDate}>
          {achievement.unlockedAt
            ? `Unlocked ${new Date(`${achievement.unlockedAt}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
            : "Unlocked"}
        </Text>
      </View>
    </View>
  );
}

function LockedRow({ achievement }: { achievement: Achievement }) {
  const pct = Math.min(100, Math.round((achievement.progress / achievement.goal) * 100));
  const hot = pct >= 80;
  return (
    <View style={[styles.lockedRow, hot && styles.lockedRowHot]}>
      <View style={styles.lockedIconWrap}>
        <AchievementEmoji achievement={achievement} locked={!hot} />
      </View>
      <View style={styles.lockedBody}>
        <View style={styles.lockedTitleRow}>
          <Text style={[styles.lockedTitle, hot && styles.lockedTitleHot]}>{achievement.title}</Text>
          <TierPill tier={achievement.tier} unlocked={false} />
        </View>
        <Text style={styles.lockedDesc}>{achievement.description}</Text>
        <View style={styles.lockedProgressRow}>
          <View style={styles.lockedTrack}>
            <View style={[styles.lockedFill, { width: `${pct}%`, backgroundColor: hot ? colors.coral : colors.teal }]} />
          </View>
          <Text style={[styles.lockedPct, { color: hot ? colors.coral : colors.muted }]}>
            {achievement.progress.toLocaleString()} / {achievement.goal.toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );
}

function CategorySection({ category, achievements }: { category: Category; achievements: Achievement[] }) {
  const meta = CATEGORY_META[category];
  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  if (!achievements.length) return null;

  return (
    <View style={styles.categorySection}>
      <View style={styles.categoryHeader}>
        <View style={[styles.categoryIconWrap, { backgroundColor: meta.color + "18" }]}>
          <Ionicons name={meta.icon} size={16} color={meta.color} />
        </View>
        <Text style={[styles.categoryLabel, { color: meta.color }]}>{meta.label}</Text>
        <Text style={styles.categoryCount}>
          {unlocked.length}/{achievements.length}
        </Text>
      </View>

      {unlocked.map((a) => <UnlockedCard key={a.id} achievement={a} />)}

      {locked.length > 0 && (
        <View style={styles.lockedList}>
          {locked.map((a) => <LockedRow key={a.id} achievement={a} />)}
        </View>
      )}
    </View>
  );
}

export function AchievementsScreen() {
  const { userProfile } = useBooklio();
  const { achievements } = userProfile;

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const overallPct = Math.round((unlockedCount / totalCount) * 100);

  const byCategory = CATEGORY_ORDER.reduce<Record<Category, Achievement[]>>((acc, cat) => {
    acc[cat] = achievements.filter((a) => a.category === cat);
    return acc;
  }, {} as Record<Category, Achievement[]>);

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Your progress</Text>
        <Text style={styles.title}>Achievements</Text>
      </View>

      {/* Overall progress card */}
      <View style={styles.overallCard}>
        <View style={styles.overallRow}>
          <View>
            <Text style={styles.overallBig}>{unlockedCount}</Text>
            <Text style={styles.overallSub}>of {totalCount} unlocked</Text>
          </View>
          <Text style={styles.overallPct}>{overallPct}%</Text>
        </View>
        <View style={styles.overallTrack}>
          <View style={[styles.overallFill, { width: `${overallPct}%` }]} />
        </View>
      </View>

      {/* Category sections */}
      {CATEGORY_ORDER.map((cat) =>
        byCategory[cat].length > 0 ? (
          <CategorySection key={cat} category={cat} achievements={byCategory[cat]} />
        ) : null
      )}
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
  overallCard: {
    ...shadows.card,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.md
  },
  overallRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  overallBig: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 36,
    fontWeight: "900"
  },
  overallSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800"
  },
  overallPct: {
    color: colors.gold,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "900"
  },
  overallTrack: {
    backgroundColor: "#EEE7DB",
    borderRadius: radii.pill,
    height: 10,
    marginTop: spacing.sm,
    overflow: "hidden"
  },
  overallFill: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    height: "100%"
  },
  // ── Category ───────────────────────────────────────────────────────────
  categorySection: {
    marginBottom: spacing.lg
  },
  categoryHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  categoryIconWrap: {
    alignItems: "center",
    borderRadius: 10,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  categoryLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  categoryCount: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800"
  },
  // ── Unlocked card ──────────────────────────────────────────────────────
  unlockedCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.md
  },
  unlockedTop: {
    flexDirection: "row",
    gap: spacing.md
  },
  unlockedEmojiBubble: {
    alignItems: "center",
    backgroundColor: "#FFFDF9",
    borderColor: "#F1E7D8",
    borderWidth: 1,
    borderRadius: radii.md,
    flexShrink: 0,
    height: 72,
    justifyContent: "center",
    overflow: "visible",
    width: 72
  },
  achievementArtwork: {
    height: 68,
    width: 68
  },
  achievementEmoji: {
    fontSize: 28,
    includeFontPadding: false,
    lineHeight: 36,
    minWidth: 54,
    textAlign: "center"
  },
  achievementEmojiCompound: {
    fontSize: 21,
    lineHeight: 30,
    minWidth: 62
  },
  achievementEmojiLocked: {
    opacity: 0.44
  },
  unlockedCopy: {
    flex: 1
  },
  unlockedTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  unlockedTitle: {
    color: colors.navy,
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "900"
  },
  unlockedFlavour: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4
  },
  unlockedFooter: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.sm
  },
  unlockedDate: {
    color: colors.green,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900"
  },
  // ── Tier pill ──────────────────────────────────────────────────────────
  tierPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  tierText: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  // ── Locked rows ────────────────────────────────────────────────────────
  lockedList: {
    backgroundColor: "#F7F4EF",
    borderColor: "#E5DDD3",
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden"
  },
  lockedRow: {
    borderBottomColor: "#EDE8E2",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  lockedRowHot: {
    backgroundColor: "#FFF8EE"
  },
  lockedIconWrap: {
    alignItems: "center",
    backgroundColor: "#FFFDF9",
    borderColor: "#F1E7D8",
    borderWidth: 1,
    borderRadius: 18,
    flexShrink: 0,
    height: 60,
    justifyContent: "center",
    marginTop: 2,
    overflow: "visible",
    width: 70
  },
  lockedBody: {
    flex: 1
  },
  lockedTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  lockedTitle: {
    color: "#7A7268",
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  },
  lockedTitleHot: {
    color: colors.coral
  },
  lockedDesc: {
    color: "#A09890",
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginTop: 2
  },
  lockedProgressRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: 8
  },
  lockedTrack: {
    backgroundColor: "#E5DDD3",
    borderRadius: radii.pill,
    flex: 1,
    height: 5,
    overflow: "hidden"
  },
  lockedFill: {
    borderRadius: radii.pill,
    height: "100%"
  },
  lockedPct: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900"
  }
});
