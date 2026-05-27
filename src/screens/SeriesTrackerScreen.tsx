import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge } from "../components/Badge";
import { BookCover } from "../components/BookCover";
import { FilterChip } from "../components/FilterChip";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { useColors } from "../theme/ThemeContext";
import { Book } from "../types/models";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { formatStatusLabel } from "../utils/statusLabels";

type OrderMode = "Reading order" | "Release order";

export function SeriesTrackerScreen() {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const route = useRoute<RouteProp<RootStackParamList, "SeriesTracker">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { books, getAuthor, series } = useBooklio();
  const [order, setOrder] = useState<OrderMode>("Reading order");
  const saga = series.find((item) => item.id === route.params.seriesId);

  const sagaBooks = useMemo(
    () =>
      books.filter((book) => book.seriesId === route.params.seriesId),
    [books, route.params.seriesId]
  );

  const orderedBooks = useMemo(
    () =>
      [...sagaBooks].sort((a, b) =>
        order === "Reading order"
          ? (a.sagaOrder ?? 99) - (b.sagaOrder ?? 99)
          : (a.releaseOrder ?? 99) - (b.releaseOrder ?? 99)
      ),
    [order, sagaBooks]
  );

  const completed = sagaBooks.filter((book) => book.userStatus.status === "read").length;
  const owned = sagaBooks.filter((book) => book.userStatus.ownership === "owned").length;
  const upcoming = sagaBooks.filter((book) => book.userStatus.status === "upcoming-release" || book.upcomingReleaseDate);
  const completion = sagaBooks.length ? Math.round((completed / sagaBooks.length) * 100) : 0;
  const activeBook = orderedBooks.find((book) => book.userStatus.status === "reading");
  const nextUnread = orderedBooks.find((book) => !["read", "dnf"].includes(book.userStatus.status));
  const queuedBooks = orderedBooks.filter((book) => book.id !== nextUnread?.id && book.userStatus.status !== "read").slice(0, 2);

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Saga hub</Text>
        <Text style={styles.title}>{saga?.name ?? "Series"}</Text>
        {saga?.description ? <Text style={styles.subtitle}>{saga.description}</Text> : null}

        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>{completed}/{sagaBooks.length} finished</Text>
          <Text style={styles.progressPct}>{completion}%</Text>
        </View>
        <View style={styles.completionTrack}>
          <View style={[styles.completionFill, { width: `${completion}%` }]} />
        </View>

        <View style={styles.statRow}>
          <StatChip label="Owned" value={String(owned)} accent={c.teal} styles={styles} />
          <StatChip label="Unread" value={String(Math.max(sagaBooks.length - completed, 0))} accent={c.gold} styles={styles} />
          <StatChip label="Upcoming" value={String(upcoming.length)} accent={c.coral} styles={styles} />
        </View>
      </View>

      <View style={styles.shelfCard}>
        <View style={styles.sectionTopline}>
          <Text style={styles.sectionTitle}>Saga shelf</Text>
          <Text style={styles.sectionMeta}>{order}</Text>
        </View>
        <View style={styles.coverRail}>
          {orderedBooks.map((book) => (
            <Pressable key={book.id} onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}>
              <BookCover book={book} size="sm" style={styles.railCover} />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.pathCard}>
        <View style={styles.sectionTopline}>
          <Text style={styles.sectionTitle}>Your path through this saga</Text>
          <Text style={styles.sectionMeta}>{order === "Reading order" ? "Best reading flow" : "Publication timeline"}</Text>
        </View>

        {activeBook ? (
          <View style={styles.activeRow}>
            <View style={styles.activePill}>
              <Ionicons name="book-outline" size={14} color={c.card} />
              <Text style={styles.activePillText}>Currently reading</Text>
            </View>
            <Text style={styles.activeTitle}>{activeBook.title}</Text>
            <Text style={styles.activeMeta}>
              {getAuthor(activeBook.authorId)?.name} · {activeBook.userStatus.progressPercent}% complete
            </Text>
            <View style={styles.activeTrack}>
              <View style={[styles.activeFill, { width: `${activeBook.userStatus.progressPercent}%` }]} />
            </View>
          </View>
        ) : nextUnread ? (
          <View style={styles.activeRow}>
            <View style={[styles.activePill, styles.activePillSoft]}>
              <Ionicons name="sparkles-outline" size={14} color={c.navy} />
              <Text style={[styles.activePillText, styles.activePillTextSoft]}>Best next pick</Text>
            </View>
            <Text style={styles.activeTitle}>{nextUnread.title}</Text>
            <Text style={styles.activeMeta}>
              {getAuthor(nextUnread.authorId)?.name} · {nextUnread.pages} pages
            </Text>
          </View>
        ) : (
          <View style={styles.activeRow}>
            <View style={[styles.activePill, { backgroundColor: c.green }]}>
              <Ionicons name="trophy-outline" size={14} color={c.card} />
              <Text style={styles.activePillText}>Saga complete</Text>
            </View>
            <Text style={styles.activeTitle}>You have finished this saga path.</Text>
            <Text style={styles.activeMeta}>Now Booklio can help with rereads, ownership, and upcoming entries.</Text>
          </View>
        )}

        {queuedBooks.length > 0 ? (
          <View style={styles.queueWrap}>
            <Text style={styles.queueLabel}>After that</Text>
            {queuedBooks.map((book, index) => (
              <Pressable
                key={book.id}
                style={styles.queueRow}
                onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}
              >
                <Text style={styles.queueIndex}>#{index + 2}</Text>
                <View style={styles.queueCopy}>
                  <Text style={styles.queueTitle}>{book.title}</Text>
                  <Text style={styles.queueMeta}>
                    {order === "Reading order" ? `Reading order ${book.sagaOrder ?? "—"}` : `Published ${book.publishedDate.slice(0, 4)}`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.muted} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.orderRail}>
        <FilterChip label="Reading order" selected={order === "Reading order"} onPress={() => setOrder("Reading order")} />
        <FilterChip label="Release order" selected={order === "Release order"} onPress={() => setOrder("Release order")} />
      </View>

      <View style={styles.roadmapCard}>
        <View style={styles.sectionTopline}>
          <Text style={styles.sectionTitle}>Roadmap</Text>
          <Text style={styles.sectionMeta}>Reading vs release</Text>
        </View>

        {orderedBooks.map((book) => (
          <SagaRoadmapRow
            key={book.id}
            book={book}
            order={order}
            authorName={getAuthor(book.authorId)?.name ?? ""}
            onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}
          />
        ))}
      </View>

      {upcoming.length > 0 ? (
        <View style={styles.upcomingCard}>
          <View style={styles.sectionTopline}>
            <Text style={styles.sectionTitle}>Upcoming in this saga</Text>
            <Text style={styles.sectionMeta}>{upcoming.length} tracked</Text>
          </View>
          {upcoming.map((book) => (
            <Pressable
              key={book.id}
              style={styles.upcomingRow}
              onPress={() => navigation.navigate("BookDetail", { bookId: book.id })}
            >
              <View style={styles.upcomingDateChip}>
                <Text style={styles.upcomingDateText}>{(book.upcomingReleaseDate ?? book.publishedDate).slice(0, 4)}</Text>
              </View>
              <View style={styles.upcomingCopy}>
                <Text style={styles.upcomingTitle}>{book.title}</Text>
                <Text style={styles.upcomingMeta}>
                  {getAuthor(book.authorId)?.name} · {book.publisher}
                </Text>
              </View>
              <Ionicons name="calendar-outline" size={18} color={c.gold} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function StatChip({
  label,
  value,
  accent,
  styles
}: {
  label: string;
  value: string;
  accent: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.statChip}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SagaRoadmapRow({
  book,
  order,
  authorName,
  onPress
}: {
  book: Book;
  order: OrderMode;
  authorName: string;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const orderValue = order === "Reading order" ? book.sagaOrder : book.releaseOrder;

  return (
    <Pressable style={styles.roadmapRow} onPress={onPress}>
      <BookCover book={book} size="sm" style={styles.rowCover} />
      <View style={styles.roadmapCopy}>
        <View style={styles.orderBadgeRow}>
          <View style={styles.orderBadge}>
            <Text style={styles.orderBadgeText}>Read #{book.sagaOrder ?? "—"}</Text>
          </View>
          <View style={[styles.orderBadge, styles.orderBadgeAlt]}>
            <Text style={[styles.orderBadgeText, styles.orderBadgeTextAlt]}>Release #{book.releaseOrder ?? "—"}</Text>
          </View>
        </View>
        <Text style={styles.bookTitle}>{book.title}</Text>
        <Text style={styles.bookMeta}>
          {authorName} · {book.publishedDate.slice(0, 4)} · {book.pages} pages
        </Text>
        <View style={styles.badges}>
          <Badge label={`${order === "Reading order" ? "Current lane" : "Current release"} ${orderValue ?? "—"}`} tone="navy" />
          <Badge label={formatStatusLabel(book.userStatus.status)} tone={book.userStatus.status === "read" ? "green" : "gray"} />
          {book.userStatus.ownership === "owned" ? <Badge label="Owned" tone="green" /> : null}
        </View>
        {book.userStatus.status === "reading" ? (
          <View style={styles.rowProgressTrack}>
            <View style={[styles.rowProgressFill, { width: `${book.userStatus.progressPercent}%` }]} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
  hero: {
    ...shadows.card,
    backgroundColor: c.navy,
    borderRadius: radii.lg,
    padding: spacing.lg
  },
  eyebrow: {
    color: c.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  title: {
    color: c.card,
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38,
    marginTop: spacing.sm
  },
  subtitle: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm
  },
  progressHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.lg
  },
  progressTitle: {
    color: c.card,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "900"
  },
  progressPct: {
    color: c.gold,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900"
  },
  completionTrack: {
    backgroundColor: "rgba(248,243,234,0.18)",
    borderRadius: radii.pill,
    height: 12,
    marginTop: spacing.sm,
    overflow: "hidden"
  },
  completionFill: {
    backgroundColor: c.gold,
    borderRadius: radii.pill,
    height: "100%"
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  statChip: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 11
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900"
  },
  statLabel: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    textTransform: "uppercase"
  },
  shelfCard: {
    ...shadows.card,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md
  },
  sectionTopline: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  sectionTitle: {
    color: c.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900"
  },
  sectionMeta: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  coverRail: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  railCover: {
    width: 62,
    height: 92
  },
  pathCard: {
    ...shadows.card,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md
  },
  activeRow: {
    marginTop: spacing.md
  },
  activePill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: c.navy,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  activePillSoft: {
    backgroundColor: c.gold
  },
  activePillText: {
    color: c.card,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  activePillTextSoft: {
    color: c.navy
  },
  activeTitle: {
    color: c.ink,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 32,
    marginTop: spacing.sm
  },
  activeMeta: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4
  },
  activeTrack: {
    backgroundColor: c.border,
    borderRadius: radii.pill,
    height: 8,
    marginTop: spacing.sm,
    overflow: "hidden"
  },
  activeFill: {
    backgroundColor: c.teal,
    borderRadius: radii.pill,
    height: "100%"
  },
  queueWrap: {
    marginTop: spacing.md
  },
  queueLabel: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  queueRow: {
    alignItems: "center",
    backgroundColor: c.surfaceAlt,
    borderColor: c.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12
  },
  queueIndex: {
    color: c.gold,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "900",
    width: 28
  },
  queueCopy: {
    flex: 1
  },
  queueTitle: {
    color: c.ink,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  },
  queueMeta: {
    color: c.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginTop: 2
  },
  orderRail: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  roadmapCard: {
    marginTop: spacing.md
  },
  roadmapRow: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md
  },
  rowCover: {
    width: 76,
    height: 112
  },
  roadmapCopy: {
    flex: 1
  },
  orderBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  orderBadge: {
    backgroundColor: c.gold + "22",
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  orderBadgeAlt: {
    backgroundColor: c.teal + "18"
  },
  orderBadgeText: {
    color: c.gold,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "900"
  },
  orderBadgeTextAlt: {
    color: c.teal,
  },
  bookTitle: {
    color: c.ink,
    fontFamily: fonts.display,
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 24,
    marginTop: 6
  },
  bookMeta: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: spacing.sm
  },
  rowProgressTrack: {
    backgroundColor: c.border,
    borderRadius: radii.pill,
    height: 7,
    marginTop: spacing.sm,
    overflow: "hidden"
  },
  rowProgressFill: {
    backgroundColor: c.teal,
    borderRadius: radii.pill,
    height: "100%"
  },
  upcomingCard: {
    ...shadows.card,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md
  },
  upcomingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  upcomingDateChip: {
    alignItems: "center",
    backgroundColor: c.gold + "22",
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.sm
  },
  upcomingDateText: {
    color: c.gold,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "900"
  },
  upcomingCopy: {
    flex: 1
  },
  upcomingTitle: {
    color: c.ink,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  },
  upcomingMeta: {
    color: c.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginTop: 2
  }
  });
}
