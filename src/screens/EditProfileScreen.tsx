import { Ionicons } from "@expo/vector-icons";
import { useDialog } from "../components/DialogProvider";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "../components/Screen";
import { useBookliz } from "../data/BooklizContext";
import { useI18n } from "../i18n/LocalizationContext";
import { RootStackParamList } from "../navigation/types";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

type EditProfileStyles = ReturnType<typeof createStyles>;

export function EditProfileScreen() {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { t } = useI18n();
  const dialog = useDialog();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { updateUserProfile, userProfile } = useBookliz();
  const [name, setName] = useState(userProfile.name);
  const [avatarInitials, setAvatarInitials] = useState(userProfile.avatarInitials);
  const [yearlyGoal, setYearlyGoal] = useState(String(userProfile.yearlyGoal));
  const [favoriteAuthors, setFavoriteAuthors] = useState(userProfile.favoriteAuthors.join(", "));
  const [favoriteGenres, setFavoriteGenres] = useState(userProfile.favoriteGenres.join(", "));

  const onSave = () => {
    updateUserProfile({
      name,
      avatarInitials,
      yearlyGoal: Number(yearlyGoal) || userProfile.yearlyGoal,
      favoriteAuthors: splitList(favoriteAuthors),
      favoriteGenres: splitList(favoriteGenres)
    });
    dialog.alert(t("editProfile.savedTitle"), t("editProfile.savedBody"));
    navigation.goBack();
  };

  return (
    <Screen>
      <View style={styles.pageHeader}>
        <Text style={styles.pageEyebrow}>{t("editProfile.eyebrow")}</Text>
        <Text style={styles.pageTitle}>{t("editProfile.title")}</Text>
      </View>

      <Field styles={styles} colors={c} label={t("editProfile.name")} value={name} onChangeText={setName} />
      <Field
        styles={styles}
        colors={c}
        label={t("editProfile.initials")}
        value={avatarInitials}
        onChangeText={setAvatarInitials}
        autoCapitalize="characters"
        hint={t("editProfile.initialsHint")}
      />
      <Field
        styles={styles}
        colors={c}
        label={t("editProfile.yearlyGoal")}
        value={yearlyGoal}
        onChangeText={setYearlyGoal}
        keyboardType="number-pad"
        hint={t("editProfile.yearlyGoalHint")}
      />
      <Field
        styles={styles}
        colors={c}
        label={t("editProfile.favoriteAuthors")}
        value={favoriteAuthors}
        onChangeText={setFavoriteAuthors}
        multiline
        hint={t("editProfile.favoriteAuthorsHint")}
      />
      <Field
        styles={styles}
        colors={c}
        label={t("editProfile.favoriteGenres")}
        value={favoriteGenres}
        onChangeText={setFavoriteGenres}
        multiline
        hint={t("editProfile.favoriteGenresHint")}
      />

      <Pressable accessibilityRole="button" style={styles.saveButton} onPress={onSave}>
        <Text style={styles.saveButtonText}>{t("editProfile.save")}</Text>
      </Pressable>
    </Screen>
  );
}

type FieldProps = {
  styles: EditProfileStyles;
  colors: AppColors;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
  keyboardType?: "default" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
};

function Field({
  styles,
  colors: c,
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
        placeholderTextColor={c.gray}
        style={[styles.input, multiline && styles.textArea]}
        value={value}
      />
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    pageHeader: {
      marginBottom: spacing.lg
    },
    pageEyebrow: {
      color: c.tealDark,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.3,
      textTransform: "uppercase"
    },
    pageTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 26,
      fontWeight: "900",
      marginTop: 2
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
      minHeight: 90,
      textAlignVertical: "top"
    },
    saveButton: {
      alignItems: "center",
      backgroundColor: c.navy,
      borderRadius: radii.pill,
      marginTop: spacing.sm,
      paddingVertical: 15
    },
    saveButtonText: {
      color: "#FFFFFF",
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900"
    }
  });
}
