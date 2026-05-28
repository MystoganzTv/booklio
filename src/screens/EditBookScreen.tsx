import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BookCover } from "../components/BookCover";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { useI18n } from "../i18n/LocalizationContext";
import { RootStackParamList } from "../navigation/types";
import { CoreTrackingStatus, OwnershipStatus, ReadingFormat } from "../types/models";
import { useColors } from "../theme/ThemeContext";
import {
  canFetchMetadata,
  isPlaceholderGenreList,
  isPlaceholderText,
  resolveBookMetadata
} from "../utils/bookMetadata";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function EditBookScreen() {
  const c = useColors();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(c), [c]);
  const route = useRoute<RouteProp<RootStackParamList, "EditBook">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getAuthor, getBook, updateBook, deleteBook } = useBooklio();

  const statusOptions: { value: CoreTrackingStatus; label: string }[] = [
    { value: "want-to-read", label: t("editBook.statusWant") },
    { value: "reading",       label: t("editBook.statusReading") },
    { value: "read",          label: t("editBook.statusRead") },
    { value: "wishlist",      label: t("editBook.statusWishlist") },
    { value: "want-to-buy",   label: t("editBook.statusBuy") },
    { value: "dnf",           label: t("editBook.statusDnf") },
    { value: "upcoming-release", label: t("editBook.statusUpcoming") },
  ];

  const formatOptions: { value: ReadingFormat; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: "physical",  label: t("logSession.formatPhysical"),  icon: "book-outline" },
    { value: "kindle",    label: t("logSession.formatKindle"),    icon: "tablet-portrait-outline" },
    { value: "audiobook", label: t("logSession.formatAudiobook"), icon: "headset-outline" },
  ];
  const book = getBook(route.params.bookId);

  const [title, setTitle] = useState(book?.title ?? "");
  const [authorName, setAuthorName] = useState(book ? getAuthor(book.authorId)?.name ?? "" : "");
  const [seriesName, setSeriesName] = useState(book?.seriesName ?? "");
  const [seriesNumber, setSeriesNumber] = useState(book?.seriesNumber ? String(book.seriesNumber) : "");
  const [genre, setGenre] = useState(book?.genre.join(", ") ?? "");
  const [pages, setPages] = useState(book ? String(book.pages) : "");
  const [publishedDate, setPublishedDate] = useState(book?.publishedDate ?? "");
  const [publisher, setPublisher] = useState(book?.publisher ?? "");
  const [language, setLanguage] = useState(book?.language ?? "English");
  const [isbn, setIsbn] = useState(book?.isbn ?? "");
  const [format, setFormat] = useState<ReadingFormat>(book?.format ?? "physical");
  const [coverImageUri, setCoverImageUri] = useState(book?.coverImageUri ?? "");
  const [synopsis, setSynopsis] = useState(book?.synopsis ?? "");
  const [status, setStatus] = useState<CoreTrackingStatus>(book?.userStatus.status ?? "want-to-read");
  const [ownership, setOwnership] = useState<OwnershipStatus>(book?.userStatus.ownership ?? "owned");
  const [wishlist, setWishlist] = useState(Boolean(book?.userStatus.wishlist));
  const [wantToBuy, setWantToBuy] = useState(Boolean(book?.userStatus.wantToBuy));
  const [rating, setRating] = useState(book?.userStatus.rating ? String(book.userStatus.rating) : "");
  const [personalRanking, setPersonalRanking] = useState(book?.userStatus.personalRanking ? String(book.userStatus.personalRanking) : "");
  const [startDate, setStartDate] = useState(book?.userStatus.startDate ?? "");
  const [finishDate, setFinishDate] = useState(book?.userStatus.finishDate ?? "");
  const [progressPercent, setProgressPercent] = useState(book ? String(book.userStatus.progressPercent) : "0");
  const [notes, setNotes] = useState(book?.userStatus.notes ?? "");
  const [favoriteQuotes, setFavoriteQuotes] = useState(book?.userStatus.favoriteQuotes.join("\n") ?? "");
  const [isBestseller, setIsBestseller] = useState(Boolean(book?.isBestseller));
  const [isSequel, setIsSequel] = useState(
    book?.isSequel ?? (book?.seriesNumber !== undefined ? book.seriesNumber > 1 : false)
  );
  const [tags, setTags] = useState(book?.tags?.join(", ") ?? "");
  const [isFetching, setIsFetching] = useState(false);

  // A field is considered "empty/placeholder" if it has no real user-entered value
  const isBlank = (val: string) => isPlaceholderText(val) || val === "0";

  const fetchInfo = async () => {
    if (!canFetchMetadata({ isbn, title, authorName })) {
      Alert.alert(t("editBook.fetchNeedClue"), t("editBook.fetchNeedClueBody"));
      return;
    }

    setIsFetching(true);
    let meta;

    try {
      meta = await resolveBookMetadata({ isbn, title: title || book?.title, authorName });
    } catch (err) {
      console.warn("[Fetch Info] error:", err);
    }

    setIsFetching(false);

    if (!meta) {
      Alert.alert(
        t("editBook.fetchNoResult"),
        Platform.OS === "web"
          ? t("editBook.fetchNoResultBodyDev")
          : t("editBook.fetchNoResultBody")
      );
      return;
    }

    // Fill any field that is blank/placeholder OR where we have better data
    const filled: string[] = [];
    const skipped: string[] = [];

    if (meta.title && isBlank(title)) {
      setTitle(meta.title); filled.push("title");
    }
    if (meta.pages && meta.pages > 0) {
      if (isBlank(pages) || pages === "0") { setPages(String(meta.pages)); filled.push("pages"); }
      else skipped.push(`pages (kept ${pages})`);
    }
    if (meta.genre?.length) {
      if (isPlaceholderGenreList(splitList(genre))) { setGenre(meta.genre.join(", ")); filled.push("genres"); }
      else skipped.push("genres (already set)");
    }
    if (meta.publisher) {
      if (isBlank(publisher)) { setPublisher(meta.publisher); filled.push("publisher"); }
    }
    if (meta.publishedDate) {
      if (isBlank(publishedDate)) { setPublishedDate(meta.publishedDate); filled.push("published date"); }
    }
    if (meta.synopsis && meta.synopsis.length > 30) {
      if (isBlank(synopsis) || synopsis.length < 60) { setSynopsis(meta.synopsis); filled.push("synopsis"); }
    }
    if (meta.coverImageUri) {
      if (isBlank(coverImageUri)) { setCoverImageUri(meta.coverImageUri); filled.push("cover image"); }
    }
    if (meta.isbn) {
      if (isBlank(isbn)) { setIsbn(meta.isbn); filled.push("ISBN"); }
    }
    if (meta.authorName && isBlank(authorName)) {
      setAuthorName(meta.authorName); filled.push("author name");
    }
    if (meta.tags?.length) {
      if (isBlank(tags)) { setTags(meta.tags.join(", ")); filled.push("awards & badges"); }
      else skipped.push("awards & badges (already set)");
    }
    if (meta.isBestseller && !isBestseller) {
      setIsBestseller(true); filled.push("bestseller signal");
    }

    if (filled.length === 0) {
      Alert.alert(
        t("editBook.fetchAllFilled"),
        skipped.length
          ? `Nothing was empty to fill.\n\n${skipped.join("\n")}\n\nTo refill a field, clear it first then tap Fetch again.`
          : t("editBook.fetchAllFilledBody")
      );
    } else {
      Alert.alert(
        t("editBook.fetchUpdated"),
        `Updated: ${filled.join(", ")}.`
      );
    }
  };

  if (!book) {
    return (
      <Screen>
        <Text style={styles.emptyText}>Book not found.</Text>
      </Screen>
    );
  }

  const previewBook = {
    ...book,
    title: title || book.title,
    coverImageUri: coverImageUri.trim() || undefined,
    format,
    userStatus: {
      ...book.userStatus,
      status,
      ownership,
      wishlist,
      wantToBuy,
      rating: parseNumber(rating),
      personalRanking: parseNumber(personalRanking),
      progressPercent: Math.min(100, Math.max(0, parseNumber(progressPercent) ?? book.userStatus.progressPercent)),
      notes,
      favoriteQuotes: favoriteQuotes.split("\n").map((quote) => quote.trim()).filter(Boolean)
    }
  };

  const onSave = () => {
    updateBook(book.id, {
      title,
      authorName,
      synopsis,
      genre: splitList(genre),
      pages: parseNumber(pages) ?? book.pages,
      publishedDate,
      publisher,
      language,
      isbn,
      format,
      coverImageUri,
      seriesName,
      seriesNumber: parseNumber(seriesNumber),
      isBestseller,
      isSequel,
      tags: splitList(tags),
      status,
      ownership,
      wishlist,
      wantToBuy,
      rating: parseNumber(rating),
      personalRanking: parseNumber(personalRanking),
      startDate,
      finishDate,
      progressPercent: parseNumber(progressPercent) ?? book.userStatus.progressPercent,
      notes,
      favoriteQuotes: favoriteQuotes.split("\n").map((quote) => quote.trim()).filter(Boolean)
    });
    Alert.alert(t("editBook.savedTitle"), `${title || book.title} has been updated.`);
    navigation.goBack();
  };

  const onDelete = () => {
    Alert.alert(
      t("editBook.deleteTitle"),
      `Booklio will remove ${title || book.title}, its reading sessions, and its review from your library.`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("editBook.deleteConfirm"),
          style: "destructive",
          onPress: () => {
            deleteBook(book.id);
            navigation.reset({
              index: 0,
              routes: [{ name: "MainTabs" }]
            });
          }
        }
      ]
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <BookCover book={previewBook} size="md" />
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{t("nav.stack.editBook")}</Text>
          <Text style={styles.title} numberOfLines={3}>{title || book.title}</Text>
          <Text style={styles.author} numberOfLines={1}>{authorName || t("editBook.unknownAuthor")}</Text>
        </View>
      </View>

      <Pressable
        style={[styles.fetchButton, isFetching && styles.fetchButtonBusy]}
        onPress={fetchInfo}
        disabled={isFetching}
      >
        {isFetching
          ? <ActivityIndicator size="small" color={c.teal} />
          : <Ionicons name="cloud-download-outline" size={16} color={c.teal} />
        }
        <Text style={styles.fetchButtonText}>
          {isFetching ? t("editBook.fetchBtnSearching") : t("editBook.fetchBtn")}
        </Text>
      </Pressable>

      <SectionTitle title={t("editBook.sectionMetadata")} />
      <Field label="Title" value={title} onChangeText={setTitle} />
      <Field label="Author" value={authorName} onChangeText={setAuthorName} />
      <Field label="Series / saga" value={seriesName} onChangeText={setSeriesName} />
      <Field label="Series number" value={seriesNumber} onChangeText={setSeriesNumber} keyboardType="number-pad" />
      <Field label="Genres" value={genre} onChangeText={setGenre} hint="Separate genres with commas" />
      <Field label="Pages" value={pages} onChangeText={setPages} keyboardType="number-pad" />
      <Field label="Published date" value={publishedDate} onChangeText={setPublishedDate} hint="YYYY-MM-DD or year" />
      <Field label="Publisher" value={publisher} onChangeText={setPublisher} />
      <Field label="Language" value={language} onChangeText={setLanguage} />
      <Field label="ISBN" value={isbn} onChangeText={setIsbn} />
      <Field label="Cover image URL" value={coverImageUri} onChangeText={setCoverImageUri} autoCapitalize="none" />
      <Field label="Synopsis" value={synopsis} onChangeText={setSynopsis} multiline />
      <Field
        label="Tags"
        value={tags}
        onChangeText={setTags}
        hint="Separate with commas — e.g. thriller, bestseller, slow-burn, award-winner"
      />

      <View style={styles.toggleRow}>
        <Toggle label={t("editBook.toggleBestseller")} active={isBestseller} onPress={() => setIsBestseller((v) => !v)} />
        <Toggle label={t("editBook.toggleSequel")}     active={isSequel}     onPress={() => setIsSequel((v) => !v)} />
      </View>

      <SectionTitle title={t("editBook.sectionTracking")} />
      <View style={styles.optionGrid}>
        {statusOptions.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.option, status === option.value && styles.optionActive]}
            onPress={() => setStatus(option.value)}
          >
            <Text style={[styles.optionText, status === option.value && styles.optionTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.formatRow}>
        {formatOptions.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.formatChip, format === option.value && styles.formatChipActive]}
            onPress={() => setFormat(option.value)}
          >
            <Ionicons name={option.icon} size={14} color={format === option.value ? c.card : c.muted} />
            <Text style={[styles.formatText, format === option.value && styles.formatTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.toggleRow}>
        <Toggle label={t("editBook.toggleOwned")}     active={ownership === "owned"} onPress={() => setOwnership(ownership === "owned" ? "not-owned" : "owned")} />
        <Toggle label={t("editBook.toggleWishlist")}  active={wishlist}   onPress={() => setWishlist((current) => !current)} />
        <Toggle label={t("editBook.toggleWantToBuy")} active={wantToBuy}  onPress={() => setWantToBuy((current) => !current)} />
      </View>

      <Field label="Rating" value={rating} onChangeText={setRating} keyboardType="numeric" hint="1-5" />
      <Field label="Personal rank" value={personalRanking} onChangeText={setPersonalRanking} keyboardType="number-pad" />
      <Field label="Start date" value={startDate} onChangeText={setStartDate} hint="YYYY-MM-DD" />
      <Field label="Finish date" value={finishDate} onChangeText={setFinishDate} hint="YYYY-MM-DD" />
      <Field label="Progress percent" value={progressPercent} onChangeText={setProgressPercent} keyboardType="number-pad" />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      <Field label="Favorite quotes" value={favoriteQuotes} onChangeText={setFavoriteQuotes} multiline hint="One quote per line" />

      <Pressable style={styles.saveButton} onPress={onSave}>
        <Text style={styles.saveButtonText}>{t("editBook.saveBtn")}</Text>
      </Pressable>

      <View style={styles.dangerZone}>
        <Text style={styles.dangerEyebrow}>{t("settings.dangerEyebrow")}</Text>
        <Text style={styles.dangerTitle}>{t("editBook.deleteTitle")}</Text>
        <Text style={styles.dangerBody}>{t("editBook.deleteBody")}</Text>
        <Pressable style={styles.deleteButton} onPress={onDelete}>
          <Ionicons name="trash-outline" size={16} color={c.coral} />
          <Text style={styles.deleteButtonText}>{t("editBook.deleteConfirm")}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function SectionTitle({ title }: { title: string }) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
  keyboardType?: "default" | "number-pad" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
};

function Field({
  label,
  value,
  onChangeText,
  hint,
  keyboardType = "default",
  autoCapitalize = "sentences",
  multiline = false
}: FieldProps) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholderTextColor={c.gray}
        style={[styles.input, multiline && styles.textArea]}
        value={value}
      />
    </View>
  );
}

function Toggle({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  return (
    <Pressable style={[styles.toggle, active && styles.toggleActive]} onPress={onPress}>
      <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={15} color={active ? c.card : c.muted} />
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    header: {
      ...shadows.card,
      alignItems: "center",
      backgroundColor: c.navy,
      borderRadius: radii.lg,
      flexDirection: "row",
      gap: spacing.md,
      marginBottom: spacing.lg,
      padding: spacing.md
    },
    headerCopy: {
      flex: 1
    },
    eyebrow: {
      color: c.gold,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
      textTransform: "uppercase"
    },
    title: {
      color: c.card,
      fontFamily: fonts.display,
      fontSize: 24,
      fontWeight: "900",
      lineHeight: 29,
      marginTop: 4
    },
    author: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 13,
      marginTop: 5
    },
    sectionTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 22,
      fontWeight: "900",
      marginBottom: spacing.sm,
      marginTop: spacing.sm
    },
    field: {
      marginBottom: spacing.md
    },
    fieldLabel: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.8,
      marginBottom: 4,
      textTransform: "uppercase"
    },
    fieldHint: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 12,
      marginBottom: 6
    },
    input: {
      ...shadows.card,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.md,
      borderWidth: 1,
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "700",
      minHeight: 50,
      paddingHorizontal: spacing.md,
      paddingVertical: 13
    },
    textArea: {
      minHeight: 108,
      textAlignVertical: "top"
    },
    optionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.md
    },
    option: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 10
    },
    optionActive: {
      backgroundColor: c.navy,
      borderColor: c.teal
    },
    optionText: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900"
    },
    optionTextActive: {
      color: c.card
    },
    formatRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md
    },
    formatChip: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flex: 1,
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      paddingVertical: 11
    },
    formatChipActive: {
      backgroundColor: c.tealDark,
      borderColor: c.tealDark
    },
    formatText: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900"
    },
    formatTextActive: {
      color: c.card
    },
    toggleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.md
    },
    toggle: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 10
    },
    toggleActive: {
      backgroundColor: c.gold,
      borderColor: c.gold
    },
    toggleText: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900"
    },
    toggleTextActive: {
      color: c.navy
    },
    saveButton: {
      alignItems: "center",
      backgroundColor: c.gold,
      borderRadius: radii.pill,
      marginTop: spacing.sm,
      paddingVertical: 15
    },
    saveButtonText: {
      color: c.navy,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900"
    },
    dangerZone: {
      borderTopColor: c.coral + "55",
      borderTopWidth: 1,
      marginTop: spacing.xl,
      paddingBottom: spacing.lg,
      paddingTop: spacing.lg
    },
    dangerEyebrow: {
      color: c.coral,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 1,
      textTransform: "uppercase"
    },
    dangerTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 26,
      fontWeight: "900",
      marginTop: 6
    },
    dangerBody: {
      color: c.muted,
      fontFamily: fonts.bodyRegular,
      fontSize: 14,
      lineHeight: 22,
      marginTop: 10
    },
    deleteButton: {
      alignItems: "center",
      backgroundColor: c.coral + "10",
      borderColor: c.coral + "55",
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      marginTop: spacing.md,
      paddingVertical: 15
    },
    deleteButtonText: {
      color: c.coral,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900"
    },
    emptyText: {
      color: c.muted,
      fontFamily: fonts.body,
      padding: spacing.lg
    },
    fetchButton: {
      alignItems: "center",
      backgroundColor: c.teal + "14",
      borderColor: c.teal + "44",
      borderRadius: radii.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      marginBottom: spacing.lg,
      paddingVertical: 13
    },
    fetchButtonBusy: {
      opacity: 0.7
    },
    fetchButtonText: {
      color: c.teal,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900"
    }
  });
}
