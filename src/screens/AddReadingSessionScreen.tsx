import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BookCover } from "../components/BookCover";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { ReadingFormat } from "../types/models";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

const FORMAT_OPTIONS: { value: ReadingFormat; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "physical",  label: "Physical",  icon: "book-outline" },
  { value: "kindle",    label: "Kindle",    icon: "tablet-portrait-outline" },
  { value: "audiobook", label: "Audiobook", icon: "headset-outline" }
];

const QUICK_MINUTES = [15, 30, 45, 60, 90, 120];

export function AddReadingSessionScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "AddReadingSession">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { addReadingSession, books, getBook, getAuthor } = useBooklio();

  const preferredBookId =
    route.params?.bookId ??
    books.find((b) => b.userStatus.status === "reading")?.id ??
    books[0]?.id;

  const [bookId, setBookId] = useState(preferredBookId);
  const selectedBook = getBook(bookId);

  const totalPages = selectedBook?.pages ?? 1;

  // ── Page mode (Physical / Kindle) ────────────────────────────────────
  const lastPage = selectedBook
    ? Math.max(1, Math.round((selectedBook.userStatus.progressPercent / 100) * selectedBook.pages))
    : 1;
  const [currentPage, setCurrentPage] = useState(
    lastPage + 30 > totalPages ? totalPages : lastPage + 30
  );
  const pagesRead = Math.max(0, currentPage - lastPage);
  const progressPct = Math.min(100, Math.round((currentPage / totalPages) * 100));

  const nudgePage = (delta: number) => {
    setCurrentPage((p) => Math.min(totalPages, Math.max(lastPage, p + delta)));
  };

  // ── Audiobook mode ────────────────────────────────────────────────────
  const lastPct = selectedBook?.userStatus.progressPercent ?? 0;
  const [currentPct, setCurrentPct] = useState(lastPct);
  const gainedPct = Math.max(0, currentPct - lastPct);

  const nudgePct = (delta: number) => {
    setCurrentPct((p) => Math.min(100, Math.max(lastPct, p + delta)));
  };

  // ── Shared ────────────────────────────────────────────────────────────
  const [minutes, setMinutes] = useState(45);
  const [customMinutes, setCustomMinutes] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [format, setFormat] = useState<ReadingFormat>(selectedBook?.format ?? "physical");

  const isAudiobook = format === "audiobook";
  const effectiveMinutes = useCustom ? Number(customMinutes) || 0 : minutes;
  const speed = !isAudiobook && effectiveMinutes > 0
    ? Math.round((pagesRead / effectiveMinutes) * 60)
    : 0;

  const switchBook = (book: typeof selectedBook) => {
    if (!book) return;
    setBookId(book.id);
    const lp = Math.max(1, Math.round((book.userStatus.progressPercent / 100) * book.pages));
    setCurrentPage(Math.min(book.pages, lp + 30));
    setCurrentPct(book.userStatus.progressPercent);
  };

  const handleSave = () => {
    if (!selectedBook) return;

    if (isAudiobook) {
      if (gainedPct === 0) {
        Alert.alert("No progress logged", "Move the progress forward to log your session.");
        return;
      }
      const startPage = Math.round((lastPct / 100) * totalPages);
      const endPage = Math.round((currentPct / 100) * totalPages);
      addReadingSession({
        bookId,
        date: new Date().toISOString().split("T")[0],
        startPage,
        endPage,
        minutesRead: effectiveMinutes,
        location: "—", mood: "—", format, notes: "",
        difficulty: "moderate", enjoymentRating: 7
      });
      Alert.alert(
        "Session logged!",
        `+${gainedPct}% progress · ${effectiveMinutes} min listened`,
        [{ text: "Done", onPress: () => navigation.goBack() }]
      );
      return;
    }

    // Physical / Kindle
    if (pagesRead === 0) {
      Alert.alert("No pages logged", "Move the page forward to log a session.");
      return;
    }
    addReadingSession({
      bookId,
      date: new Date().toISOString().split("T")[0],
      startPage: lastPage,
      endPage: currentPage,
      minutesRead: effectiveMinutes,
      location: "—", mood: "—", format, notes: "",
      difficulty: "moderate", enjoymentRating: 7
    });
    Alert.alert(
      "Session logged!",
      `${pagesRead} pages · ${speed} pp/h · ${progressPct}% through the book`,
      [{ text: "Done", onPress: () => navigation.goBack() }]
    );
  };

  const readingBooks = books.filter((b) => b.userStatus.status === "reading");
  const otherBooks   = books.filter((b) => b.userStatus.status !== "reading");

  const hasProgress = isAudiobook ? gainedPct > 0 : pagesRead > 0;

  return (
    <Screen>
      {/* Book selector */}
      {readingBooks.length + otherBooks.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bookRail}>
          {[...readingBooks, ...otherBooks].map((book) => (
            <Pressable
              key={book.id}
              style={[styles.bookChip, bookId === book.id && styles.bookChipActive]}
              onPress={() => switchBook(book)}
            >
              <Text
                style={[styles.bookChipText, bookId === book.id && styles.bookChipTextActive]}
                numberOfLines={1}
              >
                {book.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Book hero */}
      {selectedBook ? (
        <View style={styles.bookHero}>
          <BookCover book={selectedBook} size="md" />
          <View style={styles.bookInfo}>
            <Text style={styles.bookTitle} numberOfLines={2}>{selectedBook.title}</Text>
            <Text style={styles.bookAuthor}>{getAuthor(selectedBook.authorId)?.name}</Text>
            {!isAudiobook && (
              <Text style={styles.bookMeta}>{selectedBook.pages} pages total</Text>
            )}
            <View style={styles.progressBar}>
              {isAudiobook ? (
                <>
                  <View style={[styles.progressFill, { width: `${lastPct}%` }]} />
                  {gainedPct > 0 && (
                    <View style={[styles.progressNew, { left: `${lastPct}%`, width: `${gainedPct}%` }]} />
                  )}
                </>
              ) : (
                <>
                  <View style={[styles.progressFill, { width: `${Math.round((lastPage / totalPages) * 100)}%` }]} />
                  {pagesRead > 0 && (
                    <View style={[styles.progressNew, {
                      left: `${Math.round((lastPage / totalPages) * 100)}%`,
                      width: `${Math.round((pagesRead / totalPages) * 100)}%`
                    }]} />
                  )}
                </>
              )}
            </View>
            <Text style={styles.progressLabel}>
              {isAudiobook ? `${currentPct}% complete` : `${progressPct}% complete`}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Format chips — placed before the stepper so the stepper adapts */}
      <View style={styles.formatRow}>
        {FORMAT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.formatChip, format === opt.value && styles.formatChipActive]}
            onPress={() => setFormat(opt.value)}
          >
            <Ionicons
              name={opt.icon}
              size={15}
              color={format === opt.value ? colors.card : colors.muted}
            />
            <Text style={[styles.formatChipText, format === opt.value && styles.formatChipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Audiobook: progress % stepper ── */}
      {isAudiobook ? (
        <View style={styles.stepperCard}>
          <Text style={styles.stepperLabel}>I listened up to</Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepBtn} onPress={() => nudgePct(-5)}>
              <Text style={styles.stepBtnText}>−5%</Text>
            </Pressable>
            <Pressable style={styles.stepBtnSm} onPress={() => nudgePct(-1)}>
              <Ionicons name="remove" size={18} color={colors.navy} />
            </Pressable>
            <View style={styles.pageDisplay}>
              <Text style={styles.pageNumber}>{currentPct}%</Text>
              <Text style={styles.pageOf}>of the book</Text>
            </View>
            <Pressable style={styles.stepBtnSm} onPress={() => nudgePct(1)}>
              <Ionicons name="add" size={18} color={colors.navy} />
            </Pressable>
            <Pressable style={styles.stepBtn} onPress={() => nudgePct(5)}>
              <Text style={styles.stepBtnText}>+5%</Text>
            </Pressable>
          </View>
          {gainedPct > 0 && (
            <Text style={styles.pagesReadPill}>+{gainedPct}% from last session</Text>
          )}
        </View>
      ) : (
        /* ── Physical / Kindle: page stepper ── */
        <View style={styles.stepperCard}>
          <Text style={styles.stepperLabel}>I read up to page</Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepBtn} onPress={() => nudgePage(-10)}>
              <Text style={styles.stepBtnText}>−10</Text>
            </Pressable>
            <Pressable style={styles.stepBtnSm} onPress={() => nudgePage(-1)}>
              <Ionicons name="remove" size={18} color={colors.navy} />
            </Pressable>
            <View style={styles.pageDisplay}>
              <Text style={styles.pageNumber}>{currentPage}</Text>
              <Text style={styles.pageOf}>/ {totalPages}</Text>
            </View>
            <Pressable style={styles.stepBtnSm} onPress={() => nudgePage(1)}>
              <Ionicons name="add" size={18} color={colors.navy} />
            </Pressable>
            <Pressable style={styles.stepBtn} onPress={() => nudgePage(10)}>
              <Text style={styles.stepBtnText}>+10</Text>
            </Pressable>
          </View>
          {pagesRead > 0 && (
            <Text style={styles.pagesReadPill}>+{pagesRead} pages from last session</Text>
          )}
        </View>
      )}

      {/* Time chips */}
      <View style={styles.minutesCard}>
        <Text style={styles.minutesLabel}>
          {isAudiobook ? "Time listened" : "Time spent"}
        </Text>
        <View style={styles.minutesRow}>
          {QUICK_MINUTES.map((m) => (
            <Pressable
              key={m}
              style={[styles.minuteChip, !useCustom && minutes === m && styles.minuteChipActive]}
              onPress={() => { setMinutes(m); setUseCustom(false); }}
            >
              <Text style={[styles.minuteChipText, !useCustom && minutes === m && styles.minuteChipTextActive]}>
                {m < 60 ? `${m}m` : `${m / 60}h`}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.minuteChip, useCustom && styles.minuteChipActive]}
            onPress={() => setUseCustom(true)}
          >
            <Text style={[styles.minuteChipText, useCustom && styles.minuteChipTextActive]}>
              {useCustom && customMinutes ? `${customMinutes}m` : "Other"}
            </Text>
          </Pressable>
        </View>
        {useCustom && (
          <TextInput
            autoFocus
            keyboardType="number-pad"
            placeholder="Minutes..."
            placeholderTextColor={colors.gray}
            style={styles.customInput}
            value={customMinutes}
            onChangeText={setCustomMinutes}
          />
        )}
      </View>

      {/* Stats strip */}
      {hasProgress && effectiveMinutes > 0 && (
        <View style={styles.statsRow}>
          {isAudiobook ? (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{effectiveMinutes}m</Text>
                <Text style={styles.statLbl}>listened</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: colors.green }]}>{currentPct}%</Text>
                <Text style={styles.statLbl}>progress</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{pagesRead}</Text>
                <Text style={styles.statLbl}>pages</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{speed}</Text>
                <Text style={styles.statLbl}>pp/h</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: colors.green }]}>{progressPct}%</Text>
                <Text style={styles.statLbl}>progress</Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Save */}
      <Pressable style={[styles.saveButton, !hasProgress && styles.saveButtonDisabled]} onPress={handleSave}>
        <Text style={styles.saveButtonText}>
          {hasProgress
            ? "Save Session"
            : isAudiobook
              ? "Adjust progress to log"
              : "Adjust the page to log"}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bookRail: {
    marginBottom: spacing.md
  },
  bookChip: {
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginRight: spacing.sm,
    maxWidth: 160,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  bookChipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  bookChipText: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800"
  },
  bookChipTextActive: {
    color: colors.card
  },
  bookHero: {
    ...shadows.card,
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  bookInfo: {
    flex: 1
  },
  bookTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 21
  },
  bookAuthor: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 3
  },
  bookMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2
  },
  progressBar: {
    backgroundColor: "#EEE7DB",
    borderRadius: radii.pill,
    height: 8,
    marginTop: spacing.sm,
    overflow: "hidden",
    position: "relative"
  },
  progressFill: {
    backgroundColor: "#D5CCBE",
    borderRadius: radii.pill,
    height: "100%",
    position: "absolute"
  },
  progressNew: {
    backgroundColor: colors.teal,
    height: "100%",
    position: "absolute"
  },
  progressLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4
  },
  stepperCard: {
    ...shadows.card,
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg
  },
  stepperLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    textTransform: "uppercase"
  },
  stepper: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  stepBtn: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  stepBtnText: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  },
  stepBtnSm: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  pageDisplay: {
    alignItems: "center",
    minWidth: 90
  },
  pageNumber: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 52,
    fontWeight: "900",
    lineHeight: 56
  },
  pageOf: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800"
  },
  pagesReadPill: {
    backgroundColor: colors.teal + "22",
    borderRadius: radii.pill,
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  minutesCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  minutesLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    textTransform: "uppercase"
  },
  minutesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  minuteChip: {
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 9
  },
  minuteChipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  minuteChipText: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  minuteChipTextActive: {
    color: colors.card
  },
  customInput: {
    backgroundColor: "#F7F4EF",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: "800",
    marginTop: spacing.sm,
    padding: spacing.md
  },
  formatRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  formatChip: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 10
  },
  formatChipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  formatChipText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  formatChipTextActive: {
    color: colors.card
  },
  statsRow: {
    ...shadows.card,
    alignItems: "center",
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    flexDirection: "row",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  statItem: {
    alignItems: "center",
    flex: 1
  },
  statVal: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: "900"
  },
  statLbl: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2
  },
  statDivider: {
    backgroundColor: "rgba(255,255,255,0.15)",
    height: 36,
    width: 1
  },
  saveButton: {
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    paddingVertical: 16
  },
  saveButtonDisabled: {
    backgroundColor: colors.gray,
    opacity: 0.5
  },
  saveButtonText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center"
  }
});
