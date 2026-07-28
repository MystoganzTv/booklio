import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useBookliz } from "../data/BooklizContext";
import { useI18n } from "../i18n/LocalizationContext";
import { colors, fonts, radii, spacing } from "../theme/theme";

const EMOJI_PICKS = ["📚", "⭐", "🌙", "🔥", "💎", "🧠", "🌿", "🎯", "✨", "🗺️", "🏔️", "❤️"];

type Props = {
  open: boolean;
  bookId: string;
  onClose: () => void;
};

export function BookListSheet({ open, bookId, onClose }: Props) {
  const { t } = useI18n();
  const { userLists, addBookToList, removeBookFromList, createUserList } = useBookliz();
  // Single-Modal view switching — avoids iOS nested-Modal freeze bug
  const [view, setView] = useState<"list" | "create">("list");
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📚");
  const inputRef = useRef<TextInput>(null);

  // Reset to list view whenever the sheet opens
  useEffect(() => {
    if (open) {
      setView("list");
      setNewName("");
      setNewEmoji("📚");
    }
  }, [open]);

  // Auto-focus input when create view activates
  useEffect(() => {
    if (view === "create") {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [view]);

  const handleToggle = (listId: string, isIn: boolean) => {
    if (isIn) {
      removeBookFromList(listId, bookId);
    } else {
      addBookToList(listId, bookId);
    }
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    Keyboard.dismiss();
    const newList = createUserList(newName.trim(), newEmoji);
    addBookToList(newList.id, bookId);
    setView("list");
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={handleClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          {view === "list" ? (
            /* ── List view ─────────────────────────────────────── */
            <>
              <Text style={styles.title}>{t("lists.saveToList")}</Text>

              {userLists.length === 0 ? (
                <View style={styles.emptyHint}>
                  <Ionicons name="bookmarks-outline" size={32} color={colors.muted} />
                  <Text style={styles.emptyText}>{t("lists.noListsHint")}</Text>
                </View>
              ) : (
                <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
                  {userLists.map((list) => {
                    const isIn = list.bookIds.includes(bookId);
                    return (
                      <Pressable accessibilityRole="button"
                        key={list.id}
                        style={styles.listRow}
                        onPress={() => handleToggle(list.id, isIn)}
                      >
                        <Text style={styles.listEmoji}>{list.emoji ?? "📚"}</Text>
                        <View style={styles.listInfo}>
                          <Text style={styles.listName}>{list.name}</Text>
                          <Text style={styles.listCount}>
                            {list.bookIds.length} {list.bookIds.length === 1 ? "book" : "books"}
                          </Text>
                        </View>
                        <View style={[styles.checkbox, isIn && styles.checkboxActive]}>
                          {isIn ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {/* New list row — switches to create view inline */}
              <Pressable accessibilityRole="button" style={styles.newListRow} onPress={() => setView("create")}>
                <View style={styles.newListIcon}>
                  <Ionicons name="add" size={18} color={colors.teal} />
                </View>
                <Text style={styles.newListText}>{t("lists.newList")}</Text>
              </Pressable>

              <Pressable accessibilityRole="button" style={styles.doneBtn} onPress={handleClose}>
                <Text style={styles.doneBtnText}>{t("lists.done")}</Text>
              </Pressable>
            </>
          ) : (
            /* ── Create view (inline — no second Modal) ─────────── */
            <>
              <Pressable accessibilityRole="button" style={styles.backRow} onPress={() => { Keyboard.dismiss(); setView("list"); }}>
                <Ionicons name="chevron-back" size={16} color={colors.teal} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>

              <Text style={styles.title}>{t("lists.createTitle")}</Text>

              {/* Emoji picker */}
              <View style={styles.emojiRow}>
                {EMOJI_PICKS.map((e) => (
                  <Pressable accessibilityRole="button"
                    key={e}
                    style={[styles.emojiChip, newEmoji === e && styles.emojiChipActive]}
                    onPress={() => setNewEmoji(e)}
                  >
                    <Text style={styles.emojiText}>{e}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Name input */}
              <View style={styles.inputWrap}>
                <Text style={styles.selectedEmoji}>{newEmoji}</Text>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="List name"
                  placeholderTextColor={colors.muted}
                  value={newName}
                  onChangeText={setNewName}
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={handleCreate}
                />
              </View>

              <Pressable accessibilityRole="button"
                style={[styles.doneBtn, !newName.trim() && styles.doneBtnDisabled]}
                onPress={handleCreate}
                disabled={!newName.trim()}
              >
                <Text style={styles.doneBtnText}>{t("lists.createBtn")}</Text>
              </Pressable>

              <Pressable accessibilityRole="button" style={styles.cancelInlineBtn} onPress={() => { Keyboard.dismiss(); setView("list"); }}>
                <Text style={styles.cancelInlineText}>{t("common.cancel")}</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: "80%",
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
  emptyHint: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center"
  },
  listScroll: {
    maxHeight: 280
  },
  listRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: 13
  },
  listEmoji: {
    fontSize: 24
  },
  listInfo: {
    flex: 1
  },
  listName: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "800"
  },
  listCount: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginTop: 2
  },
  checkbox: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 2,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  checkboxActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal
  },
  newListRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingVertical: spacing.md
  },
  newListIcon: {
    alignItems: "center",
    backgroundColor: colors.teal + "18",
    borderColor: colors.teal,
    borderRadius: 6,
    borderWidth: 1.5,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  newListText: {
    color: colors.teal,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "800"
  },
  doneBtn: {
    alignItems: "center",
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    paddingVertical: 15
  },
  doneBtnDisabled: {
    opacity: 0.4
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  },
  // ── Create view ──────────────────────────────────────────────────────────
  backRow: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 2,
    marginBottom: spacing.sm
  },
  backText: {
    color: colors.teal,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "800"
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
    backgroundColor: colors.teal + "18",
    borderColor: colors.teal
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
  cancelInlineBtn: {
    alignItems: "center",
    marginTop: spacing.sm,
    paddingVertical: 10
  },
  cancelInlineText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  }
});
