import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BookCover } from "../components/BookCover";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { CoreTrackingStatus, OwnershipStatus, ReadingFormat } from "../types/models";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

const statusOptions: { value: CoreTrackingStatus; label: string }[] = [
  { value: "want-to-read", label: "Want" },
  { value: "reading", label: "Reading" },
  { value: "read", label: "Read" },
  { value: "wishlist", label: "Wishlist" },
  { value: "want-to-buy", label: "Buy" },
  { value: "dnf", label: "DNF" },
  { value: "upcoming-release", label: "Upcoming" }
];

const formatOptions: { value: ReadingFormat; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "physical", label: "Physical", icon: "book-outline" },
  { value: "kindle", label: "Kindle", icon: "tablet-portrait-outline" },
  { value: "audiobook", label: "Audio", icon: "headset-outline" }
];

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
  const route = useRoute<RouteProp<RootStackParamList, "EditBook">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getAuthor, getBook, updateBook } = useBooklio();
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
    Alert.alert("Saved", `${title || book.title} has been updated.`);
    navigation.goBack();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <BookCover book={previewBook} size="md" />
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Edit book</Text>
          <Text style={styles.title} numberOfLines={3}>{title || book.title}</Text>
          <Text style={styles.author} numberOfLines={1}>{authorName || "Unknown author"}</Text>
        </View>
      </View>

      <SectionTitle title="Book metadata" />
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

      <SectionTitle title="Tracking" />
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
            <Ionicons name={option.icon} size={14} color={format === option.value ? colors.card : colors.muted} />
            <Text style={[styles.formatText, format === option.value && styles.formatTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.toggleRow}>
        <Toggle label="Owned" active={ownership === "owned"} onPress={() => setOwnership(ownership === "owned" ? "not-owned" : "owned")} />
        <Toggle label="Wishlist" active={wishlist} onPress={() => setWishlist((current) => !current)} />
        <Toggle label="Want to buy" active={wantToBuy} onPress={() => setWantToBuy((current) => !current)} />
      </View>

      <Field label="Rating" value={rating} onChangeText={setRating} keyboardType="numeric" hint="1-5" />
      <Field label="Personal rank" value={personalRanking} onChangeText={setPersonalRanking} keyboardType="number-pad" />
      <Field label="Start date" value={startDate} onChangeText={setStartDate} hint="YYYY-MM-DD" />
      <Field label="Finish date" value={finishDate} onChangeText={setFinishDate} hint="YYYY-MM-DD" />
      <Field label="Progress percent" value={progressPercent} onChangeText={setProgressPercent} keyboardType="number-pad" />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      <Field label="Favorite quotes" value={favoriteQuotes} onChangeText={setFavoriteQuotes} multiline hint="One quote per line" />

      <Pressable style={styles.saveButton} onPress={onSave}>
        <Text style={styles.saveButtonText}>Save book</Text>
      </Pressable>
    </Screen>
  );
}

function SectionTitle({ title }: { title: string }) {
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
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholderTextColor={colors.gray}
        style={[styles.input, multiline && styles.textArea]}
        value={value}
      />
    </View>
  );
}

function Toggle({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.toggle, active && styles.toggleActive]} onPress={onPress}>
      <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={15} color={active ? colors.card : colors.muted} />
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    ...shadows.card,
    alignItems: "center",
    backgroundColor: colors.navy,
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
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  title: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 29,
    marginTop: 4
  },
  author: {
    color: "#D8D2C8",
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 5
  },
  sectionTitle: {
    color: colors.navy,
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
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: "uppercase"
  },
  fieldHint: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginBottom: 6
  },
  input: {
    ...shadows.card,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
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
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  optionActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  optionText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  optionTextActive: {
    color: colors.card
  },
  formatRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  formatChip: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 11
  },
  formatChipActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark
  },
  formatText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  formatTextActive: {
    color: colors.card
  },
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  toggle: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  toggleActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  toggleText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  toggleTextActive: {
    color: colors.navy
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
    paddingVertical: 15
  },
  saveButtonText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fonts.body,
    padding: spacing.lg
  }
});
