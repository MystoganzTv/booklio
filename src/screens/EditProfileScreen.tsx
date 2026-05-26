import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { GoogleConnectionCard } from "../components/GoogleConnectionCard";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export function EditProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { updateUserProfile, userProfile } = useBooklio();
  const [name, setName] = useState(userProfile.name);
  const [avatarInitials, setAvatarInitials] = useState(userProfile.avatarInitials);
  const [readingLevel, setReadingLevel] = useState(userProfile.readingLevel);
  const [yearlyGoal, setYearlyGoal] = useState(String(userProfile.yearlyGoal));
  const [favoriteAuthors, setFavoriteAuthors] = useState(userProfile.favoriteAuthors.join(", "));
  const [favoriteGenres, setFavoriteGenres] = useState(userProfile.favoriteGenres.join(", "));

  const onSave = () => {
    updateUserProfile({
      name,
      avatarInitials,
      readingLevel,
      yearlyGoal: Number(yearlyGoal) || userProfile.yearlyGoal,
      favoriteAuthors: splitList(favoriteAuthors),
      favoriteGenres: splitList(favoriteGenres)
    });
    Alert.alert("Saved", "Your profile has been updated.");
    navigation.goBack();
  };

  return (
    <Screen>
      <View style={styles.pageHeader}>
        <Text style={styles.pageEyebrow}>Edit profile</Text>
        <Text style={styles.pageTitle}>Make it yours.</Text>
      </View>

      <View style={styles.accountSection}>
        <Text style={styles.accountEyebrow}>Account</Text>
        <Text style={styles.accountTitle}>Identity</Text>
        <Text style={styles.accountBody}>
          Choose how Booklio recognizes you before anything else.
        </Text>
      </View>

      <GoogleConnectionCard />

      <Field label="Name" value={name} onChangeText={setName} />
      <Field
        label="Initials"
        value={avatarInitials}
        onChangeText={setAvatarInitials}
        autoCapitalize="characters"
        hint="2–3 characters shown on your avatar"
      />
      <Field
        label="Reading level"
        value={readingLevel}
        onChangeText={setReadingLevel}
        hint="Give it your own label — e.g. Casual, Voracious, Saga Cartographer"
      />
      <Field
        label="Yearly goal"
        value={yearlyGoal}
        onChangeText={setYearlyGoal}
        keyboardType="number-pad"
        hint="Number of books you want to read this year"
      />
      <Field
        label="Favorite authors"
        value={favoriteAuthors}
        onChangeText={setFavoriteAuthors}
        multiline
        hint="Separate names with commas"
      />
      <Field
        label="Favorite genres"
        value={favoriteGenres}
        onChangeText={setFavoriteGenres}
        multiline
        hint="Separate genres with commas"
      />

      <Pressable style={styles.saveButton} onPress={onSave}>
        <Text style={styles.saveButtonText}>Save profile</Text>
      </Pressable>
    </Screen>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
  keyboardType?: "default" | "number-pad";
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

const styles = StyleSheet.create({
  pageHeader: {
    marginBottom: spacing.lg
  },
  pageEyebrow: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    textTransform: "uppercase"
  },
  pageTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 2
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
    minHeight: 90,
    textAlignVertical: "top"
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
    paddingVertical: 15
  },
  accountSection: {
    marginBottom: spacing.sm,
    marginTop: spacing.md
  },
  accountEyebrow: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    textTransform: "uppercase"
  },
  accountTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 2
  },
  accountBody: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6
  },
  saveButtonText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  }
});
