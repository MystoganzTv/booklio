import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts, radii, spacing } from "../theme/theme";

const EMOJI_PICKS = ["📚", "⭐", "🌙", "🔥", "💎", "🧠", "🌿", "🎯", "✨", "🗺️", "🏔️", "❤️"];

type Props = {
  open: boolean;
  initialName?: string;
  initialEmoji?: string;
  mode?: "create" | "rename";
  onSave: (name: string, emoji: string) => void;
  onClose: () => void;
};

export function CreateListSheet({ open, initialName = "", initialEmoji = "📚", mode = "create", onSave, onClose }: Props) {
  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState(initialEmoji);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setEmoji(initialEmoji || "📚");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, initialName, initialEmoji]);

  const canSave = name.trim().length > 0;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{mode === "rename" ? "Rename list" : "New list"}</Text>

          {/* Emoji picker */}
          <View style={styles.emojiRow}>
            {EMOJI_PICKS.map((e) => (
              <Pressable
                key={e}
                style={[styles.emojiChip, emoji === e && styles.emojiChipActive]}
                onPress={() => setEmoji(e)}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </Pressable>
            ))}
          </View>

          {/* Name input */}
          <View style={styles.inputWrap}>
            <Text style={styles.selectedEmoji}>{emoji}</Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="List name"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={() => canSave && (onSave(name.trim(), emoji), onClose())}
            />
          </View>

          <Pressable
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={() => {
              if (canSave) {
                onSave(name.trim(), emoji);
                onClose();
              }
            }}
            disabled={!canSave}
          >
            <Text style={styles.saveBtnText}>{mode === "rename" ? "Save changes" : "Create list"}</Text>
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
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
  title: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: spacing.md
  },
  emojiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.md
  },
  emojiChip: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 2,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  emojiChipActive: {
    borderColor: colors.teal,
    backgroundColor: colors.teal + "18"
  },
  emojiText: {
    fontSize: 22
  },
  inputWrap: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14
  },
  selectedEmoji: {
    fontSize: 22
  },
  input: {
    color: colors.navy,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: "800"
  },
  saveBtn: {
    alignItems: "center",
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    paddingVertical: 15
  },
  saveBtnDisabled: {
    opacity: 0.4
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  },
  cancelBtn: {
    alignItems: "center",
    marginTop: spacing.sm,
    paddingVertical: 10
  },
  cancelText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  }
});
