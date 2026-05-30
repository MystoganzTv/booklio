/**
 * BookEditionsSheet — editions browser for the Book Intelligence Engine.
 *
 * Shows all editions of a work grouped by language, letting the user pick
 * the exact edition they own before adding it to their library.
 *
 * Props:
 *   visible       — whether the sheet is shown
 *   work          — the BookWork whose editions to display
 *   onSelectEdition — called when user taps "Add this edition"
 *   onAddManually   — called when user taps "Add manually"
 *   onClose         — called when user dismisses the sheet
 */

import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BookEdition, BookWork, EditionGroup, MatchConfidence } from "../types/bookMetadata";
import { groupEditionsByLanguage } from "../services/bookMetadataAggregator";
import { languageFlag } from "../utils/languageUtils";
import { useColors, useTheme } from "../theme/ThemeContext";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookEditionsSheetProps {
  visible: boolean;
  work: BookWork | null;
  isLoadingEditions?: boolean;
  onSelectEdition: (edition: BookEdition) => void;
  onAddManually: () => void;
  onClose: () => void;
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: MatchConfidence }) {
  const c = useColors();
  const configs: Record<MatchConfidence, { label: string; bg: string; fg: string }> = {
    high:     { label: "High confidence",  bg: "#D1FAE5", fg: "#065F46" },
    good:     { label: "Good match",       bg: "#DBEAFE", fg: "#1E40AF" },
    possible: { label: "Possible match",   bg: "#FEF3C7", fg: "#92400E" },
    review:   { label: "Needs review",     bg: "#FEE2E2", fg: "#991B1B" },
  };
  const cfg = configs[confidence];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: "google-books" | "open-library" }) {
  const label = source === "google-books" ? "Google Books" : "Open Library";
  const bg = source === "google-books" ? "#E8F0FE" : "#FFF3E0";
  const fg = source === "google-books" ? "#1A73E8" : "#E65100";
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// ─── Edition card ─────────────────────────────────────────────────────────────

interface EditionCardProps {
  edition: BookEdition;
  isSelected: boolean;
  onPress: () => void;
}

function EditionCard({ edition, isSelected, onPress }: EditionCardProps) {
  const c = useColors();
  const { isDark } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        editionCardStyles.container,
        {
          backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
          borderColor: isSelected ? c.teal : (isDark ? "#334155" : "#E2E8F0"),
          borderWidth: isSelected ? 2 : 1,
        },
        shadows.card,
      ]}
    >
      {/* Cover */}
      <View style={editionCardStyles.coverContainer}>
        {edition.coverUrl ? (
          <Image
            source={{ uri: edition.coverUrl }}
            style={editionCardStyles.cover}
            resizeMode="cover"
          />
        ) : (
          <View style={[editionCardStyles.coverPlaceholder, { backgroundColor: isDark ? "#334155" : "#F1F5F9" }]}>
            <Ionicons name="book-outline" size={20} color={isDark ? "#64748B" : "#94A3B8"} />
          </View>
        )}
        {isSelected && (
          <View style={[editionCardStyles.selectedBadge, { backgroundColor: c.teal }]}>
            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={editionCardStyles.info}>
        <Text
          style={[editionCardStyles.title, { color: isDark ? "#F8FAFC" : "#0F172A" }]}
          numberOfLines={2}
        >
          {edition.title}
        </Text>

        <View style={editionCardStyles.metaRow}>
          <Text style={[editionCardStyles.flag]}>{languageFlag(edition.languageCode)}</Text>
          <Text style={[editionCardStyles.language, { color: isDark ? "#94A3B8" : "#64748B" }]}>
            {edition.language}
          </Text>
        </View>

        {edition.publisher && (
          <Text style={[editionCardStyles.meta, { color: isDark ? "#94A3B8" : "#64748B" }]} numberOfLines={1}>
            {edition.publisher}
            {edition.publishedYear ? ` · ${edition.publishedYear}` : ""}
          </Text>
        )}

        {edition.pageCount && (
          <Text style={[editionCardStyles.meta, { color: isDark ? "#64748B" : "#94A3B8" }]}>
            {edition.pageCount} pages
            {edition.format ? ` · ${edition.format}` : ""}
          </Text>
        )}

        {edition.isbn13 && (
          <Text style={[editionCardStyles.isbn, { color: isDark ? "#64748B" : "#94A3B8" }]}>
            ISBN {edition.isbn13}
          </Text>
        )}

        <View style={editionCardStyles.badges}>
          <SourceBadge source={edition.source} />
        </View>
      </View>
    </Pressable>
  );
}

// ─── Language group header ────────────────────────────────────────────────────

function LanguageGroupHeader({ group }: { group: EditionGroup }) {
  const c = useColors();
  const { isDark } = useTheme();
  return (
    <View style={[groupHeaderStyles.container, { borderBottomColor: isDark ? "#334155" : "#E2E8F0" }]}>
      <Text style={groupHeaderStyles.flag}>{languageFlag(group.languageCode)}</Text>
      <Text style={[groupHeaderStyles.language, { color: isDark ? "#F8FAFC" : "#0F172A" }]}>
        {group.language}
      </Text>
      <View style={[groupHeaderStyles.countBadge, { backgroundColor: isDark ? "#334155" : "#F1F5F9" }]}>
        <Text style={[groupHeaderStyles.count, { color: isDark ? "#94A3B8" : "#64748B" }]}>
          {group.editions.length} edition{group.editions.length !== 1 ? "s" : ""}
        </Text>
      </View>
      {group.isPriority && (
        <View style={[groupHeaderStyles.priorityBadge, { backgroundColor: "#D1FAE5" }]}>
          <Text style={[groupHeaderStyles.priorityText, { color: "#065F46" }]}>Supported</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

export function BookEditionsSheet({
  visible,
  work,
  isLoadingEditions = false,
  onSelectEdition,
  onAddManually,
  onClose,
}: BookEditionsSheetProps) {
  const c = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedEditionId, setSelectedEditionId] = useState<string | null>(null);

  const groups: EditionGroup[] = useMemo(
    () => (work ? groupEditionsByLanguage(work.editions) : []),
    [work]
  );

  const selectedEdition = useMemo(
    () =>
      selectedEditionId
        ? work?.editions.find((e) => e.id === selectedEditionId) ?? null
        : null,
    [selectedEditionId, work]
  );

  const handleConfirm = () => {
    if (selectedEdition) {
      onSelectEdition(selectedEdition);
    } else if (work?.bestEdition) {
      onSelectEdition(work.bestEdition);
    }
  };

  if (!work) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[sheetStyles.container, { backgroundColor: isDark ? "#0F172A" : "#FAF7F2" }]}>
        {/* Header */}
        <View style={[sheetStyles.header, { borderBottomColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
          <Pressable onPress={onClose} style={sheetStyles.closeBtn} hitSlop={12}>
            <Ionicons name="chevron-down" size={22} color={isDark ? "#94A3B8" : "#64748B"} />
          </Pressable>
          <Text style={[sheetStyles.headerTitle, { color: isDark ? "#F8FAFC" : "#0F172A" }]} numberOfLines={1}>
            {work.title}
          </Text>
          <View style={sheetStyles.closeBtn} />
        </View>

        {/* Work summary */}
        <View style={[sheetStyles.workSummary, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}>
          <View style={sheetStyles.workInfo}>
            {work.bestEdition.coverUrl && (
              <Image
                source={{ uri: work.bestEdition.coverUrl }}
                style={sheetStyles.workCover}
                resizeMode="cover"
              />
            )}
            <View style={sheetStyles.workText}>
              <Text style={[sheetStyles.workTitle, { color: isDark ? "#F8FAFC" : "#0F172A" }]} numberOfLines={2}>
                {work.title}
              </Text>
              {work.authors.length > 0 && (
                <Text style={[sheetStyles.workAuthor, { color: isDark ? "#94A3B8" : "#64748B" }]} numberOfLines={1}>
                  by {work.authors.join(", ")}
                </Text>
              )}
              <View style={sheetStyles.confidenceRow}>
                <ConfidenceBadge confidence={work.confidence} />
                {work.editionCount !== undefined && (
                  <Text style={[sheetStyles.editionCount, { color: isDark ? "#64748B" : "#94A3B8" }]}>
                    {work.editions.length}{work.editionCount > work.editions.length ? `/${work.editionCount}` : ""} editions
                  </Text>
                )}
              </View>
            </View>
          </View>
          {work.description && (
            <Text style={[sheetStyles.description, { color: isDark ? "#94A3B8" : "#64748B" }]} numberOfLines={3}>
              {work.description}
            </Text>
          )}
        </View>

        {/* Edition list */}
        {isLoadingEditions ? (
          <View style={sheetStyles.loadingContainer}>
            <ActivityIndicator size="large" color={c.teal} />
            <Text style={[sheetStyles.loadingText, { color: isDark ? "#94A3B8" : "#64748B" }]}>
              Loading all editions…
            </Text>
          </View>
        ) : (
          <ScrollView
            style={sheetStyles.scroll}
            contentContainerStyle={[sheetStyles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
            showsVerticalScrollIndicator={false}
          >
            {groups.length === 0 && (
              <View style={sheetStyles.emptyState}>
                <Ionicons name="library-outline" size={40} color={isDark ? "#334155" : "#CBD5E1"} />
                <Text style={[sheetStyles.emptyText, { color: isDark ? "#64748B" : "#94A3B8" }]}>
                  No editions found
                </Text>
              </View>
            )}
            {groups.map((group) => (
              <View key={group.languageCode} style={sheetStyles.group}>
                <LanguageGroupHeader group={group} />
                {group.editions.map((edition) => (
                  <EditionCard
                    key={edition.id}
                    edition={edition}
                    isSelected={edition.id === selectedEditionId}
                    onPress={() =>
                      setSelectedEditionId((prev) =>
                        prev === edition.id ? null : edition.id
                      )
                    }
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        )}

        {/* Action bar */}
        <View
          style={[
            sheetStyles.actionBar,
            {
              backgroundColor: isDark ? "#0F172A" : "#FAF7F2",
              borderTopColor: isDark ? "#1E293B" : "#E2E8F0",
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          <Pressable
            onPress={handleConfirm}
            style={[sheetStyles.primaryBtn, { backgroundColor: c.teal }]}
          >
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text style={sheetStyles.primaryBtnText}>
              {selectedEdition ? "Add selected edition" : "Add best edition"}
            </Text>
          </Pressable>
          <Pressable onPress={onAddManually} style={sheetStyles.secondaryBtn}>
            <Text style={[sheetStyles.secondaryBtnText, { color: isDark ? "#94A3B8" : "#64748B" }]}>
              Add manually instead
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.body,
    letterSpacing: 0.1,
  },
});

const editionCardStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    overflow: "hidden",
    padding: spacing.sm,
  },
  coverContainer: {
    position: "relative",
    marginRight: spacing.sm,
  },
  cover: {
    width: 56,
    height: 80,
    borderRadius: 4,
    backgroundColor: "#F1F5F9",
  },
  coverPlaceholder: {
    width: 56,
    height: 80,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  flag: {
    fontSize: 13,
  },
  language: {
    fontSize: 12,
    fontFamily: fonts.body,
  },
  meta: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
  },
  isbn: {
    fontSize: 10,
    fontFamily: fonts.mono ?? fonts.bodyRegular,
    letterSpacing: 0.3,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
});

const groupHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    marginBottom: spacing.sm,
  },
  flag: {
    fontSize: 18,
  },
  language: {
    fontFamily: fonts.body,
    fontSize: 14,
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  count: {
    fontSize: 11,
    fontFamily: fonts.body,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontFamily: fonts.body,
  },
});

const sheetStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    textAlign: "center",
  },
  workSummary: {
    margin: spacing.md,
    borderRadius: radii.md,
    padding: spacing.md,
    ...shadows.card,
    gap: spacing.sm,
  },
  workInfo: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  workCover: {
    width: 48,
    height: 68,
    borderRadius: 4,
    backgroundColor: "#F1F5F9",
  },
  workText: {
    flex: 1,
    gap: 4,
  },
  workTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    lineHeight: 20,
  },
  workAuthor: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
  },
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  editionCount: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
  },
  description: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },
  group: {
    marginBottom: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
  },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radii.md,
  },
  primaryBtnText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: "#FFFFFF",
  },
  secondaryBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  secondaryBtnText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
  },
});
