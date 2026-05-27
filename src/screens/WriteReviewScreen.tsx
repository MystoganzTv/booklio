import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, spacing } from "../theme/theme";

type RouteP = RouteProp<RootStackParamList, "WriteReview">;

function StarRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={stars.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={8}>
          <Ionicons
            name={n <= value ? "star" : "star-outline"}
            size={36}
            color={n <= value ? colors.gold : colors.border}
          />
        </Pressable>
      ))}
    </View>
  );
}

export function WriteReviewScreen() {
  const route = useRoute<RouteP>();
  const navigation = useNavigation();
  const { getBook, getReviewForBook, addReview, updateReview, deleteReview } = useBooklio();

  const { bookId } = route.params;
  const book = getBook(bookId);
  const existing = getReviewForBook(bookId);

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");

  const canSave = rating > 0 && title.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const payload = { bookId, rating, title: title.trim(), body: body.trim() };
    if (existing) {
      updateReview(existing.id, payload);
    } else {
      addReview(payload);
    }
    navigation.goBack();
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert(
      "Delete review?",
      "This will permanently remove your review for this book.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteReview(existing.id);
            navigation.goBack();
          }
        }
      ]
    );
  };

  return (
    <Screen
      headerRight={
        <View style={styles.headerActions}>
          {canSave ? (
            <Pressable style={styles.headerSaveButton} onPress={handleSave} hitSlop={8}>
              <Text style={styles.headerSaveButtonText}>{existing ? "Update" : "Save"}</Text>
            </Pressable>
          ) : null}
          {existing ? (
            <Pressable onPress={handleDelete} hitSlop={12}>
              <Ionicons name="trash-outline" size={20} color={colors.danger ?? "#EF4444"} />
            </Pressable>
          ) : undefined}
        </View>
      }
    >
      {/* Book title hint */}
      {book ? (
        <View style={styles.bookHint}>
          <Text style={styles.bookHintLabel}>Reviewing</Text>
          <Text style={styles.bookHintTitle} numberOfLines={1}>{book.title}</Text>
        </View>
      ) : null}

      {/* Star rating */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Your rating</Text>
        <StarRow value={rating} onChange={setRating} />
        {rating > 0 ? (
          <Text style={styles.ratingHint}>
            {["", "Didn't enjoy it", "It was okay", "Liked it", "Really liked it", "Loved it"][rating]}
          </Text>
        ) : null}
      </View>

      {/* Title */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Give your review a headline…"
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          returnKeyType="next"
        />
      </View>

      {/* Body */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Your thoughts</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="What did you think? What stayed with you?"
          placeholderTextColor={colors.muted}
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
          maxLength={2000}
        />
        <Text style={styles.charCount}>{body.length} / 2000</Text>
      </View>

      {/* Save */}
      <Pressable
        style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!canSave}
      >
        <Ionicons name="checkmark-circle-outline" size={18} color={canSave ? colors.navy : colors.muted} style={{ marginRight: 8 }} />
        <Text style={[styles.saveButtonText, !canSave && styles.saveButtonTextDisabled]}>
          {existing ? "Update Review" : "Save Review"}
        </Text>
      </Pressable>
    </Screen>
  );
}

const stars = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.sm
  }
});

const styles = StyleSheet.create({
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  headerSaveButton: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  headerSaveButtonText: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
  },
  bookHint: {
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  bookHintLabel: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  bookHintTitle: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2
  },
  section: {
    marginBottom: spacing.md
  },
  sectionLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: "uppercase"
  },
  ratingHint: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800",
    marginTop: spacing.xs
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  inputMultiline: {
    height: 160,
    paddingTop: spacing.sm
  },
  charCount: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 4,
    textAlign: "right"
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.sm,
    paddingVertical: 16
  },
  saveButtonDisabled: {
    backgroundColor: colors.border,
    opacity: 0.7
  },
  saveButtonText: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: "900"
  },
  saveButtonTextDisabled: {
    color: colors.muted
  }
});
