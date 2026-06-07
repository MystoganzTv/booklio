import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CoreTrackingStatus } from "../types/models";
import { colors, fonts, radii, spacing } from "../theme/theme";

type StatusOption = {
  value: CoreTrackingStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const STATUS_OPTIONS: StatusOption[] = [
  { value: "want-to-read", label: "Want to read", icon: "bookmark-outline",         color: colors.muted  },
  { value: "reading",      label: "Reading",      icon: "book-outline",              color: colors.teal   },
  { value: "read",         label: "Read",         icon: "checkmark-circle-outline",  color: colors.green  },
  { value: "wishlist",     label: "Wishlist",     icon: "heart-outline",             color: colors.coral  }
];

type Props = {
  open: boolean;
  currentStatus: CoreTrackingStatus;
  currentRating?: number;
  onSave: (status: CoreTrackingStatus, rating?: number) => void;
  onClose: () => void;
};

export function BookStatusSheet({ open, currentStatus, currentRating, onSave, onClose }: Props) {
  const [status, setStatus] = useState<CoreTrackingStatus>(currentStatus);
  const [rating, setRating] = useState<number | undefined>(currentRating);

  // Sync local state whenever the sheet (re-)opens
  useEffect(() => {
    if (open) {
      setStatus(currentStatus);
      setRating(currentRating);
    }
  }, [open, currentStatus, currentRating]);

  const handleSave = () => {
    onSave(status, status === "read" ? rating : undefined);
    onClose();
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Update status</Text>

          {/* Status grid */}
          <View style={styles.statusGrid}>
            {STATUS_OPTIONS.map((opt) => {
              const active = status === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.statusOption, active && { borderColor: opt.color, backgroundColor: `${opt.color}18` }]}
                  onPress={() => setStatus(opt.value)}
                >
                  <Ionicons name={opt.icon} size={24} color={active ? opt.color : colors.muted} />
                  <Text style={[styles.statusLabel, active && { color: opt.color }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Star rating — only when Read */}
          {status === "read" && (
            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Your rating</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable key={star} onPress={() => setRating(star)} hitSlop={12}>
                    <Ionicons
                      name={rating !== undefined && rating >= star ? "star" : "star-outline"}
                      size={34}
                      color={rating !== undefined && rating >= star ? colors.gold : colors.border}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </Pressable>
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
    fontSize: 24,
    fontWeight: "900",
    marginBottom: spacing.md
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  statusOption: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 2,
    flex: 1,
    gap: 6,
    minWidth: "44%",
    paddingVertical: spacing.md
  },
  statusLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  ratingSection: {
    marginBottom: spacing.md
  },
  ratingLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    textTransform: "uppercase"
  },
  stars: {
    flexDirection: "row",
    gap: spacing.sm
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
  }
});
