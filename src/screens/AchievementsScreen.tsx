import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { Achievement } from "../types/models";
import { getAchievementIconSource } from "../utils/achievementIcons";
import { AppColors, fonts, palette, radii, shadows, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";

type Category = Achievement["category"];

const CATEGORY_META: Record<Category, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  reading:    { label: "Reading Milestones", icon: "book-outline",         color: palette.teal    },
  habit:      { label: "Habits",             icon: "flame-outline",        color: palette.coral   },
  genre:      { label: "Genres",             icon: "compass-outline",      color: palette.gold    },
  collection: { label: "Collection",         icon: "library-outline",      color: palette.green   },
  speed:      { label: "Speed",              icon: "speedometer-outline",  color: "#6366F1"      },
  social:     { label: "Social",             icon: "people-outline",       color: palette.navy    },
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

function TierPill({
  tier,
  unlocked,
  styles
}: {
  tier: Achievement["tier"];
  unlocked: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={[styles.tierPill, { borderColor: unlocked ? TIER_COLOR[tier] : "#C5BEB4" }]}>
      <Text style={[styles.tierText, { color: unlocked ? TIER_COLOR[tier] : "#A09890" }]}>
        {TIER_LABEL[tier]}
      </Text>
    </View>
  );
}

function AchievementEmoji({
  achievement,
  locked = false,
  styles
}: {
  achievement: Achievement;
  locked?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
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

function UnlockedCard({ achievement, styles, c }: { achievement: Achievement; styles: ReturnType<typeof createStyles>; c: AppColors }) {
  return (
    <View style={[styles.unlockedCard, { borderLeftColor: TIER_COLOR[achievement.tier] }]}>
      <View style={styles.unlockedTop}>
        <View style={styles.unlockedEmojiBubble}>
          <AchievementEmoji achievement={achievement} styles={styles} />
        </View>
        <View style={styles.unlockedCopy}>
          <View style={styles.unlockedTitleRow}>
            <Text style={styles.unlockedTitle}>{achievement.title}</Text>
            <TierPill tier={achievement.tier} unlocked styles={styles} />
          </View>
          <Text style={styles.unlockedFlavour}>{achievement.flavour}</Text>
        </View>
      </View>
      <View style={styles.unlockedFooter}>
        <Ionicons name="checkmark-circle" size={14} color={c.green} />
        <Text style={styles.unlockedDate}>
          {achievement.unlockedAt
            ? `Unlocked ${new Date(`${achievement.unlockedAt}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
            : "Unlocked"}
        </Text>
      </View>
    </View>
  );
}

function LockedRow({ achievement, styles, c }: { achievement: Achievement; styles: ReturnType<typeof createStyles>; c: AppColors }) {
  const pct = Math.min(100, Math.round((achievement.progress / achievement.goal) * 100));
  const hot = pct >= 80;
  return (
    <View style={[styles.lockedRow, hot && styles.lockedRowHot]}>
      <View style={styles.lockedIconWrap}>
        <AchievementEmoji achievement={achievement} locked={!hot} styles={styles} />
      </View>
      <View style={styles.lockedBody}>
        <View style={styles.lockedTitleRow}>
          <Text style={[styles.lockedTitle, hot && styles.lockedTitleHot]}>{achievement.title}</Text>
          <TierPill tier={achievement.tier} unlocked={false} styles={styles} />
        </View>
        <Text style={styles.lockedDesc}>{achievement.description}</Text>
        <View style={styles.lockedProgressRow}>
          <View style={styles.lockedTrack}>
            <View style={[styles.lockedFill, { width: `${pct}%`, backgroundColor: hot ? c.coral : c.teal }]} />
          </View>
          <Text style={[styles.lockedPct, { color: hot ? c.coral : c.muted }]}>
            {achievement.progress.toLocaleString()} / {achievement.goal.toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );
}

function CategorySection({
  category,
  achievements,
  styles,
  c
}: {
  category: Category;
  achievements: Achievement[];
  styles: ReturnType<typeof createStyles>;
  c: AppColors;
}) {
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

      {unlocked.map((a) => <UnlockedCard key={a.id} achievement={a} styles={styles} c={c} />)}

      {locked.length > 0 && (
        <View style={styles.lockedList}>
          {locked.map((a) => <LockedRow key={a.id} achievement={a} styles={styles} c={c} />)}
        </View>
      )}
    </View>
  );
}

export function AchievementsScreen() {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
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
          <CategorySection key={cat} category={cat} achievements={byCategory[cat]} styles={styles} c={c} />
        ) : null
      )}
    </Screen>
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
  overallCard: {
    ...shadows.card,
    backgroundColor: c.surface,
    borderColor: c.border,
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
    color: c.ink,
    fontFamily: fonts.display,
    fontSize: 36,
    fontWeight: "900"
  },
  overallSub: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800"
  },
  overallPct: {
    color: c.gold,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "900"
  },
  overallTrack: {
    backgroundColor: c.border,
    borderRadius: radii.pill,
    height: 10,
    marginTop: spacing.sm,
    overflow: "hidden"
  },
  overallFill: {
    backgroundColor: c.gold,
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
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800"
  },
  // ── Unlocked card ──────────────────────────────────────────────────────
  unlockedCard: {
    backgroundColor: c.surface,
    borderColor: c.border,
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
    backgroundColor: c.surfaceAlt,
    borderColor: c.border,
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
    color: c.ink,
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "900"
  },
  unlockedFlavour: {
    color: c.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4
  },
  unlockedFooter: {
    alignItems: "center",
    borderTopColor: c.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.sm
  },
  unlockedDate: {
    color: c.green,
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
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden"
  },
  lockedRow: {
    backgroundColor: c.surface,
    borderBottomColor: c.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  lockedRowHot: {
    backgroundColor: c.surfaceAlt
  },
  lockedIconWrap: {
    alignItems: "center",
    backgroundColor: c.surfaceAlt,
    borderColor: c.border,
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
    color: c.ink,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  },
  lockedTitleHot: {
    color: c.coral
  },
  lockedDesc: {
    color: c.muted,
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
    backgroundColor: c.border,
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
}
