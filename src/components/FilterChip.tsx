import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fonts, radii } from "../theme/theme";

type FilterChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function FilterChip({ label, selected = false, onPress }: FilterChipProps) {
  return (
    <Pressable style={[styles.chip, selected && styles.selected]} onPress={onPress}>
      <Text style={[styles.text, selected && styles.selectedText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  selected: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  text: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800"
  },
  selectedText: {
    color: colors.card
  }
});
