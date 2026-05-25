import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { NewBookInput } from "../types/models";
import { colors, fonts, radii, spacing } from "../theme/theme";

type OwnershipChoice = {
  ownership: NewBookInput["ownership"];
  wishlist: boolean;
  wantToBuy: boolean;
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const OPTIONS: OwnershipChoice[] = [
  {
    ownership: "owned",
    wishlist:  false,
    wantToBuy: false,
    label: "I own it",
    sub:   "Physical, digital, or borrowed copy",
    icon:  "checkmark-circle-outline",
    color: colors.green
  },
  {
    ownership: "not-owned",
    wishlist:  true,
    wantToBuy: false,
    label: "Wishlist",
    sub:   "I want to read this someday",
    icon:  "bookmark-outline",
    color: colors.teal
  },
  {
    ownership: "not-owned",
    wishlist:  false,
    wantToBuy: true,
    label: "Want to buy",
    sub:   "On my radar, not purchased yet",
    icon:  "cart-outline",
    color: colors.gold
  }
];

type Props = {
  open: boolean;
  bookTitle: string;
  onSelect: (choice: Pick<NewBookInput, "ownership" | "wishlist" | "wantToBuy">) => void;
  onClose: () => void;
};

export function BookOwnershipSheet({ open, bookTitle, onSelect, onClose }: Props) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle} numberOfLines={2}>Add "{bookTitle}"</Text>
          <Text style={styles.sheetSub}>How do you want to track it?</Text>

          <View style={styles.options}>
            {OPTIONS.map((opt) => (
              <Pressable
                key={opt.label}
                style={styles.option}
                onPress={() => onSelect({ ownership: opt.ownership, wishlist: opt.wishlist, wantToBuy: opt.wantToBuy })}
              >
                <View style={[styles.optionIcon, { backgroundColor: opt.color + "22" }]}>
                  <Ionicons name={opt.icon} size={22} color={opt.color} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                  <Text style={styles.optionSub}>{opt.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    flex: 1,
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 44,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    width: "100%"
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    height: 4,
    marginBottom: spacing.lg,
    width: 40
  },
  sheetTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28
  },
  sheetSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: spacing.lg,
    marginTop: 4
  },
  options: {
    gap: spacing.sm
  },
  option: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  optionIcon: {
    alignItems: "center",
    borderRadius: 20,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  optionCopy: {
    flex: 1
  },
  optionLabel: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "900"
  },
  optionSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2
  }
});
