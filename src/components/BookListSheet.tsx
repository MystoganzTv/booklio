import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useBooklio } from "../data/BooklioContext";
import { useI18n } from "../i18n/LocalizationContext";
import { colors, fonts, radii, spacing } from "../theme/theme";
import { CreateListSheet } from "./CreateListSheet";

type Props = {
  open: boolean;
  bookId: string;
  onClose: () => void;
};

export function BookListSheet({ open, bookId, onClose }: Props) {
  const { t } = useI18n();
  const { userLists, addBookToList, removeBookFromList, createUserList } = useBooklio();
  const [createOpen, setCreateOpen] = useState(false);

  const handleToggle = (listId: string, isIn: boolean) => {
    if (isIn) {
      removeBookFromList(listId, bookId);
    } else {
      addBookToList(listId, bookId);
    }
  };

  const handleCreate = (name: string, emoji: string) => {
    const newList = createUserList(name, emoji);
    // Auto-add current book to the newly created list
    addBookToList(newList.id, bookId);
    setCreateOpen(false);
  };

  return (
    <>
      <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

          <View style={styles.sheet}>
            <View style={styles.handle} />
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
                    <Pressable
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

            {/* New list quick-create row */}
            <Pressable style={styles.newListRow} onPress={() => setCreateOpen(true)}>
              <View style={styles.newListIcon}>
                <Ionicons name="add" size={18} color={colors.teal} />
              </View>
              <Text style={styles.newListText}>{t("lists.newList")}</Text>
            </Pressable>

            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>{t("lists.done")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Nested sheet for creating a list */}
      <CreateListSheet
        open={createOpen}
        onSave={handleCreate}
        onClose={() => setCreateOpen(false)}
      />
    </>
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
    maxHeight: "75%",
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
    paddingVertical: spacing.md,
    marginTop: spacing.xs
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
  doneBtnText: {
    color: "#FFFFFF",
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  }
});
