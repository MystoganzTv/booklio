import { useNavigation, useRoute } from "@react-navigation/native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { FilterChip } from "../components/FilterChip";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";
import { DifficultyLevel, ReadingFormat } from "../types/models";

const moods = ["absorbed", "curious", "cozy", "restless", "reflective", "delighted"];
const locations = ["Bedroom chair", "Cafe window", "Sofa", "Train", "Park bench", "Library"];
const formats: ReadingFormat[] = ["physical", "kindle", "audiobook"];
const difficulties: DifficultyLevel[] = ["easy", "moderate", "challenging", "demanding"];

export function AddReadingSessionScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "AddReadingSession">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { addReadingSession, books, getBook } = useBooklio();
  const preferredBook = route.params?.bookId ?? books.find((book) => book.userStatus.status === "reading")?.id ?? books[0]?.id;
  const [bookId, setBookId] = useState(preferredBook);
  const selectedBook = getBook(bookId);
  const [date, setDate] = useState("2026-05-24");
  const [startPage, setStartPage] = useState(selectedBook ? String(Math.max(1, Math.round((selectedBook.userStatus.progressPercent / 100) * selectedBook.pages) + 1)) : "1");
  const [endPage, setEndPage] = useState(selectedBook ? String(Math.min(selectedBook.pages, Number(startPage) + 32)) : "32");
  const [minutesRead, setMinutesRead] = useState("45");
  const [location, setLocation] = useState(locations[0]);
  const [mood, setMood] = useState(moods[0]);
  const [format, setFormat] = useState<ReadingFormat>(selectedBook?.format ?? "physical");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("moderate");
  const [enjoymentRating, setEnjoymentRating] = useState("8");
  const [notes, setNotes] = useState("");
  const [favoriteQuote, setFavoriteQuote] = useState("");
  const pagesRead = Math.max(0, Number(endPage) - Number(startPage) + 1);
  const speed = Number(minutesRead) > 0 ? Math.round((pagesRead / Number(minutesRead)) * 60) : 0;
  const progress = selectedBook ? Math.min(100, Math.round((Number(endPage) / selectedBook.pages) * 100)) : 0;
  const selectBookForSession = (nextBookId: string) => {
    const nextBook = getBook(nextBookId);
    setBookId(nextBookId);
    if (!nextBook) return;
    const nextStartPage = Math.max(1, Math.round((nextBook.userStatus.progressPercent / 100) * nextBook.pages) + 1);
    setStartPage(String(nextStartPage));
    setEndPage(String(Math.min(nextBook.pages, nextStartPage + 32)));
    setFormat(nextBook.format);
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Add session</Text>
        <Text style={styles.title}>Log the reading, not just the book.</Text>
        <Text style={styles.subtitle}>Pages, minutes, place, mood, quote, speed, and progress update together.</Text>
      </View>

      <Text style={styles.label}>Book</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail}>
        {books.map((book) => (
          <FilterChip key={book.id} label={book.title} selected={bookId === book.id} onPress={() => selectBookForSession(book.id)} />
        ))}
      </ScrollView>

      <View style={styles.formGrid}>
        <Field label="Date" value={date} onChangeText={setDate} />
        <Field label="Start page" keyboardType="number-pad" value={startPage} onChangeText={setStartPage} />
        <Field label="End page" keyboardType="number-pad" value={endPage} onChangeText={setEndPage} />
        <Field label="Minutes read" keyboardType="number-pad" value={minutesRead} onChangeText={setMinutesRead} />
      </View>

      <ChoiceRail label="Location" options={locations} selected={location} onSelect={setLocation} />
      <ChoiceRail label="Mood" options={moods} selected={mood} onSelect={setMood} />
      <ChoiceRail label="Format" options={formats} selected={format} onSelect={setFormat} />
      <ChoiceRail label="Difficulty" options={difficulties} selected={difficulty} onSelect={setDifficulty} />

      <Text style={styles.label}>Enjoyment rating</Text>
      <View style={styles.ratingRow}>
        {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => (
          <Pressable key={rating} style={[styles.ratingPill, Number(enjoymentRating) === rating && styles.ratingPillActive]} onPress={() => setEnjoymentRating(String(rating))}>
            <Text style={[styles.ratingText, Number(enjoymentRating) === rating && styles.ratingTextActive]}>{rating}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Notes</Text>
      <TextInput multiline placeholder="What happened in this session?" placeholderTextColor={colors.gray} style={styles.textArea} value={notes} onChangeText={setNotes} />
      <Text style={styles.label}>Favorite quote</Text>
      <TextInput multiline placeholder="Capture a line worth keeping." placeholderTextColor={colors.gray} style={styles.textArea} value={favoriteQuote} onChangeText={setFavoriteQuote} />

      <View style={styles.calcCard}>
        <Text style={styles.calcTitle}>Auto-calculated</Text>
        <Text style={styles.calcLine}>{pagesRead} pages read</Text>
        <Text style={styles.calcLine}>{speed} pages per hour</Text>
        <Text style={styles.calcLine}>{progress}% book progress after save</Text>
      </View>

      <Pressable
        style={styles.saveButton}
        onPress={() => {
          if (!selectedBook) return;
          const session = addReadingSession({
            bookId,
            date,
            startPage: Number(startPage),
            endPage: Number(endPage),
            minutesRead: Number(minutesRead),
            location,
            mood,
            format,
            notes: notes || "Logged from Booklio mobile.",
            favoriteQuote: favoriteQuote || undefined,
            difficulty,
            enjoymentRating: Number(enjoymentRating)
          });
          Alert.alert("Session logged", `${session.pagesRead} pages at ${session.pagesPerHour} pages/hour. Progress updated to ${progress}%.`);
          navigation.navigate("ReadingLog", { bookId });
        }}
      >
        <Text style={styles.saveButtonText}>Save Reading Session</Text>
      </Pressable>
    </Screen>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "number-pad";
};

function Field({ label, value, onChangeText, keyboardType = "default" }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput keyboardType={keyboardType} style={styles.input} value={value} onChangeText={onChangeText} />
    </View>
  );
}

type ChoiceRailProps<T extends string> = {
  label: string;
  options: T[];
  selected: T;
  onSelect: (value: T) => void;
};

function ChoiceRail<T extends string>({ label, options, selected, onSelect }: ChoiceRailProps<T>) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail}>
        {options.map((option) => (
          <FilterChip key={option} label={option} selected={selected === option} onPress={() => onSelect(option)} />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    ...shadows.card,
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  title: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 33,
    fontWeight: "900",
    lineHeight: 37,
    marginTop: spacing.sm
  },
  subtitle: {
    color: "#D8D2C8",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm
  },
  label: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    textTransform: "uppercase"
  },
  rail: {
    marginBottom: spacing.sm
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  field: {
    width: "47%"
  },
  fieldLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "700",
    padding: spacing.md
  },
  ratingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  ratingPill: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  ratingPillActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  ratingText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  ratingTextActive: {
    color: colors.navy
  },
  textArea: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    minHeight: 96,
    padding: spacing.md,
    textAlignVertical: "top"
  },
  calcCard: {
    backgroundColor: "#EFE6D7",
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md
  },
  calcTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8
  },
  calcLine: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 24
  },
  saveButton: {
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    marginTop: spacing.lg,
    paddingVertical: 16
  },
  saveButtonText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center"
  }
});
