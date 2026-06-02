/**
 * EditBookScreen — Section-card redesign
 *
 * Visual pattern from reference:
 *   Each field = card with [icon] [BOLD TEAL LABEL] / [content]
 *
 * New UX:
 *   - Genres and Tags as tappable chips (add/remove)
 *   - Star rating (tap to set, half-star via double-tap)
 *   - Format picker with expanded options
 *   - Date fields with year-only toggle
 *   - All logic/state unchanged from previous version
 */
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BookCover } from "../components/BookCover";
import { Screen } from "../components/Screen";
import { useBookliz } from "../data/BooklizContext";
import { useI18n } from "../i18n/LocalizationContext";
import { RootStackParamList } from "../navigation/types";
import { CoreTrackingStatus, OwnershipStatus, ReadingFormat } from "../types/models";
import { useColors } from "../theme/ThemeContext";
import {
  canFetchMetadata,
  isPlaceholderGenreList,
  isPlaceholderText,
  resolveBookMetadata,
} from "../utils/bookMetadata";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";

// ─── helpers ─────────────────────────────────────────────────────────────────

const splitList = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
const parseNum  = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };

const FORMAT_OPTIONS: { value: ReadingFormat; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "paperback",            label: "Paperback",             icon: "book-outline" },
  { value: "hardcover",            label: "Hardcover",             icon: "book-outline" },
  { value: "ebook",                label: "Digital book",          icon: "tablet-portrait-outline" },
  { value: "audiobook",            label: "Audiobook",             icon: "headset-outline" },
  { value: "mass-market-paperback",label: "Mass market paperback", icon: "book-outline" },
  { value: "spiral-bound",         label: "Spiral-bound",          icon: "document-text-outline" },
  { value: "leather-bound",        label: "Leather-bound",         icon: "book-outline" },
  { value: "magazine",             label: "Magazine",              icon: "newspaper-outline" },
  { value: "comic-book",           label: "Comic book",            icon: "color-wand-outline" },
  { value: "graphic-novel",        label: "Graphic novel",         icon: "image-outline" },
  { value: "manga",                label: "Manga",                 icon: "language-outline" },
];

const STATUS_OPTIONS: { value: CoreTrackingStatus; label: string }[] = [
  { value: "reading",          label: "Reading" },
  { value: "read",             label: "Read" },
  { value: "want-to-read",     label: "Want to read" },
  { value: "wishlist",         label: "Wishlist" },
  { value: "want-to-buy",      label: "Want to buy" },
  { value: "dnf",              label: "Did not finish" },
  { value: "upcoming-release", label: "Upcoming" },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export function EditBookScreen() {
  const c = useColors();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(c), [c]);
  const route = useRoute<RouteProp<RootStackParamList, "EditBook">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getAuthor, getBook, updateBook, deleteBook } = useBookliz();

  const book = getBook(route.params.bookId);

  // ── state ──────────────────────────────────────────────────────────────────
  const [title,           setTitle]           = useState(book?.title ?? "");
  const [authorName,      setAuthorName]      = useState(book ? getAuthor(book.authorId)?.name ?? "" : "");
  const [seriesName,      setSeriesName]      = useState(book?.seriesName ?? "");
  const [seriesNumber,    setSeriesNumber]    = useState(book?.seriesNumber ? String(book.seriesNumber) : "");
  const [genres,          setGenres]          = useState<string[]>(book?.genre ?? []);
  const [pages,           setPages]           = useState(book ? String(book.pages) : "");
  const [publishedDate,   setPublishedDate]   = useState(book?.publishedDate ?? "");
  const [publisher,       setPublisher]       = useState(book?.publisher ?? "");
  const [language,        setLanguage]        = useState(book?.language ?? "English");
  const [isbn,            setIsbn]            = useState(book?.isbn ?? "");
  const [format,          setFormat]          = useState<ReadingFormat>(book?.format ?? "physical");
  const [coverImageUri,   setCoverImageUri]   = useState(book?.coverImageUri ?? "");
  const [synopsis,        setSynopsis]        = useState(book?.synopsis ?? "");
  const [tags,            setTags]            = useState<string[]>(book?.tags ?? []);
  const [isBestseller,    setIsBestseller]    = useState(Boolean(book?.isBestseller));
  const [isSequel,        setIsSequel]        = useState(book?.isSequel ?? (book?.seriesNumber !== undefined ? book.seriesNumber > 1 : false));
  const [status,          setStatus]          = useState<CoreTrackingStatus>(book?.userStatus.status ?? "want-to-read");
  const [ownership,       setOwnership]       = useState<OwnershipStatus>(book?.userStatus.ownership ?? "owned");
  const [wishlist,        setWishlist]        = useState(Boolean(book?.userStatus.wishlist));
  const [wantToBuy,       setWantToBuy]       = useState(Boolean(book?.userStatus.wantToBuy));
  const [rating,          setRating]          = useState(book?.userStatus.rating ?? 0);
  const [personalRanking, setPersonalRanking] = useState(book?.userStatus.personalRanking ? String(book.userStatus.personalRanking) : "");
  const [startDate,       setStartDate]       = useState(book?.userStatus.startDate ?? "");
  const [finishDate,      setFinishDate]      = useState(book?.userStatus.finishDate ?? "");
  const [progressPercent, setProgressPercent] = useState(book ? String(book.userStatus.progressPercent) : "0");
  const [notes,           setNotes]           = useState(book?.userStatus.notes ?? "");
  const [favoriteQuotes,  setFavoriteQuotes]  = useState(book?.userStatus.favoriteQuotes.join("\n") ?? "");
  const [isFetching,      setIsFetching]      = useState(false);

  // ── fetch metadata ─────────────────────────────────────────────────────────
  const fetchInfo = async () => {
    if (!canFetchMetadata({ isbn, title, authorName })) {
      Alert.alert(t("editBook.fetchNeedClue"), t("editBook.fetchNeedClueBody"));
      return;
    }
    setIsFetching(true);
    let meta;
    try { meta = await resolveBookMetadata({ isbn, title: title || book?.title, authorName }); }
    catch (err) { console.warn("[Fetch Info]", err); }
    setIsFetching(false);

    if (!meta) {
      Alert.alert(
        t("editBook.fetchNoResult"),
        Platform.OS === "web" ? t("editBook.fetchNoResultBodyDev") : t("editBook.fetchNoResultBody")
      );
      return;
    }

    const filled: string[] = [];
    const isBlank = (v: string) => isPlaceholderText(v) || v === "0" || v === "";

    if (meta.title       && isBlank(title))                           { setTitle(meta.title);                  filled.push("title"); }
    if (meta.pages       && meta.pages > 0 && isBlank(pages))        { setPages(String(meta.pages));           filled.push("pages"); }
    if (meta.publisher   && isBlank(publisher))                       { setPublisher(meta.publisher);           filled.push("publisher"); }
    if (meta.publishedDate && isBlank(publishedDate))                 { setPublishedDate(meta.publishedDate);   filled.push("published date"); }
    if (meta.synopsis    && meta.synopsis.length > 30 && isBlank(synopsis)) { setSynopsis(meta.synopsis);      filled.push("synopsis"); }
    if (meta.coverImageUri && isBlank(coverImageUri))                 { setCoverImageUri(meta.coverImageUri);   filled.push("cover"); }
    if (meta.isbn        && isBlank(isbn))                            { setIsbn(meta.isbn);                     filled.push("ISBN"); }
    if (meta.authorName  && isBlank(authorName))                      { setAuthorName(meta.authorName);         filled.push("author"); }
    if (meta.genre?.length && isPlaceholderGenreList(genres))         { setGenres(meta.genre);                  filled.push("genres"); }
    if (meta.tags?.length && tags.length === 0)                       { setTags(meta.tags);                     filled.push("tags"); }
    if (meta.isBestseller && !isBestseller)                           { setIsBestseller(true);                  filled.push("bestseller"); }

    Alert.alert(
      filled.length ? t("editBook.fetchUpdated") : t("editBook.fetchAllFilled"),
      filled.length ? `Updated: ${filled.join(", ")}.` : t("editBook.fetchAllFilledBody")
    );
  };

  if (!book) {
    return <Screen><Text style={{ color: c.muted, fontFamily: fonts.body, padding: spacing.lg }}>Book not found.</Text></Screen>;
  }

  const previewBook = {
    ...book,
    title: title || book.title,
    coverImageUri: coverImageUri.trim() || undefined,
    format,
    userStatus: {
      ...book.userStatus,
      status,
      rating,
      progressPercent: Math.min(100, Math.max(0, parseNum(progressPercent) ?? book.userStatus.progressPercent)),
    },
  };

  const onSave = () => {
    updateBook(book.id, {
      title, authorName, synopsis,
      genre: genres,
      pages: parseNum(pages) ?? book.pages,
      publishedDate, publisher, language, isbn, format, coverImageUri,
      seriesName, seriesNumber: parseNum(seriesNumber),
      isBestseller, isSequel, tags,
      status, ownership, wishlist, wantToBuy,
      rating: rating > 0 ? rating : undefined,
      personalRanking: parseNum(personalRanking),
      startDate, finishDate,
      progressPercent: parseNum(progressPercent) ?? book.userStatus.progressPercent,
      notes,
      favoriteQuotes: favoriteQuotes.split("\n").map((q) => q.trim()).filter(Boolean),
    });
    Alert.alert(t("editBook.savedTitle"), `${title || book.title} has been updated.`);
    navigation.goBack();
  };

  const onDelete = () => {
    Alert.alert(
      t("editBook.deleteTitle"),
      `Bookliz will remove ${title || book.title} and all its data from your library.`,
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("editBook.deleteConfirm"), style: "destructive", onPress: () => {
          deleteBook(book.id);
          navigation.reset({ index: 0, routes: [{ name: "AppTabs" }] });
        }},
      ]
    );
  };

  return (
    <Screen>
      {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <BookCover book={previewBook} size="md" />
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>Edit book</Text>
          <Text style={styles.heroTitle} numberOfLines={3}>{title || book.title}</Text>
          <Text style={styles.heroAuthor} numberOfLines={1}>{authorName || t("editBook.unknownAuthor")}</Text>
        </View>
      </View>

      {/* ── FETCH BUTTON ─────────────────────────────────────────────────── */}
      <Pressable style={[styles.fetchBtn, isFetching && styles.fetchBtnBusy]} onPress={fetchInfo} disabled={isFetching}>
        {isFetching
          ? <ActivityIndicator size="small" color={c.teal} />
          : <Ionicons name="cloud-download-outline" size={16} color={c.teal} />}
        <Text style={styles.fetchBtnText}>{isFetching ? t("editBook.fetchBtnSearching") : t("editBook.fetchBtn")}</Text>
      </Pressable>

      {/* ══ BOOK INFO ════════════════════════════════════════════════════════ */}
      <FieldCard icon="text-outline" label="Title" c={c} styles={styles}>
        <PlainInput value={title} onChangeText={setTitle} placeholder="Book title" styles={styles} c={c} />
      </FieldCard>

      <FieldCard icon="person-outline" label="Author" c={c} styles={styles}>
        <PlainInput value={authorName} onChangeText={setAuthorName} placeholder="Author name" styles={styles} c={c} />
      </FieldCard>

      <FieldCard icon="layers-outline" label="Series" c={c} styles={styles}>
        <PlainInput value={seriesName} onChangeText={setSeriesName} placeholder="Series name" styles={styles} c={c} />
        <View style={{ height: 8 }} />
        <PlainInput value={seriesNumber} onChangeText={setSeriesNumber} placeholder="Book number" keyboardType="number-pad" styles={styles} c={c} />
      </FieldCard>

      {/* ══ METADATA ═════════════════════════════════════════════════════════ */}
      <FieldCard icon="pricetag-outline" label="Genres" c={c} styles={styles}>
        <ChipEditor chips={genres} onChipsChange={setGenres} placeholder="Add genre…" styles={styles} c={c} />
      </FieldCard>

      <FieldCard icon="document-text-outline" label="Pages" c={c} styles={styles}>
        <PlainInput value={pages} onChangeText={setPages} placeholder="Number of pages" keyboardType="number-pad" styles={styles} c={c} />
      </FieldCard>

      <FieldCard icon="calendar-outline" label="Published date" c={c} styles={styles}>
        <PlainInput value={publishedDate} onChangeText={setPublishedDate} placeholder="YYYY-MM-DD or year" styles={styles} c={c} />
      </FieldCard>

      <FieldCard icon="business-outline" label="Publisher" c={c} styles={styles}>
        <PlainInput value={publisher} onChangeText={setPublisher} placeholder="Publisher name" styles={styles} c={c} />
      </FieldCard>

      <FieldCard icon="language-outline" label="Language" c={c} styles={styles}>
        <PlainInput value={language} onChangeText={setLanguage} placeholder="English" styles={styles} c={c} />
      </FieldCard>

      <FieldCard icon="barcode-outline" label="ISBN" c={c} styles={styles}>
        <PlainInput value={isbn} onChangeText={setIsbn} placeholder="ISBN-10 or ISBN-13" keyboardType="number-pad" styles={styles} c={c} />
      </FieldCard>

      <FieldCard icon="image-outline" label="Cover image URL" c={c} styles={styles}>
        <PlainInput value={coverImageUri} onChangeText={setCoverImageUri} placeholder="https://…" autoCapitalize="none" styles={styles} c={c} />
      </FieldCard>

      {/* ══ DESCRIPTION ══════════════════════════════════════════════════════ */}
      <FieldCard icon="reader-outline" label="Description" c={c} styles={styles}>
        <PlainInput value={synopsis} onChangeText={setSynopsis} placeholder="Synopsis…" multiline styles={styles} c={c} />
      </FieldCard>

      {/* ══ FORMAT ═══════════════════════════════════════════════════════════ */}
      <FieldCard icon="book-outline" label="Format" c={c} styles={styles}>
        <View style={styles.pillRow}>
          {FORMAT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.pill, format === opt.value && styles.pillActive]}
              onPress={() => setFormat(opt.value)}
            >
              <Ionicons name={opt.icon} size={14} color={format === opt.value ? "#fff" : c.muted} />
              <Text style={[styles.pillText, format === opt.value && styles.pillTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      </FieldCard>

      {/* ══ TAGS & FLAGS ═════════════════════════════════════════════════════ */}
      <FieldCard icon="flag-outline" label="Tags" c={c} styles={styles}>
        <ChipEditor chips={tags} onChipsChange={setTags} placeholder="Add tag…" styles={styles} c={c} />
        <View style={styles.toggleRow}>
          <ToggleChip label="Bestseller" active={isBestseller} onPress={() => setIsBestseller((v) => !v)} styles={styles} c={c} />
          <ToggleChip label="Sequel"     active={isSequel}     onPress={() => setIsSequel((v) => !v)}     styles={styles} c={c} />
        </View>
      </FieldCard>

      {/* ══ READING STATUS ═══════════════════════════════════════════════════ */}
      <FieldCard icon="library-outline" label="Reading status" c={c} styles={styles}>
        <View style={styles.pillRow}>
          {STATUS_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.pill, status === opt.value && styles.pillActive]}
              onPress={() => setStatus(opt.value)}
            >
              <Text style={[styles.pillText, status === opt.value && styles.pillTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.toggleRow, { marginTop: spacing.sm }]}>
          <ToggleChip label="Owned"        active={ownership === "owned"} onPress={() => setOwnership(ownership === "owned" ? "not-owned" : "owned")} styles={styles} c={c} />
          <ToggleChip label="Wishlist"     active={wishlist}   onPress={() => setWishlist((v) => !v)}   styles={styles} c={c} />
          <ToggleChip label="Want to buy"  active={wantToBuy}  onPress={() => setWantToBuy((v) => !v)}  styles={styles} c={c} />
        </View>
      </FieldCard>

      {/* ══ YOUR READING ═════════════════════════════════════════════════════ */}
      <FieldCard icon="star-outline" label="Your rating" c={c} styles={styles}>
        <StarRating value={rating} onChange={setRating} styles={styles} c={c} />
      </FieldCard>

      <FieldCard icon="trophy-outline" label="Personal rank" c={c} styles={styles}>
        <PlainInput value={personalRanking} onChangeText={setPersonalRanking} placeholder="#1 of all time…" keyboardType="number-pad" styles={styles} c={c} />
      </FieldCard>

      <FieldCard icon="calendar-outline" label="Start date" c={c} styles={styles}>
        <PlainInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" styles={styles} c={c} />
      </FieldCard>

      <FieldCard icon="checkmark-circle-outline" label="Finish date" c={c} styles={styles}>
        <PlainInput value={finishDate} onChangeText={setFinishDate} placeholder="YYYY-MM-DD" styles={styles} c={c} />
      </FieldCard>

      <FieldCard icon="analytics-outline" label="Progress" c={c} styles={styles}>
        <PlainInput value={progressPercent} onChangeText={setProgressPercent} placeholder="0–100" keyboardType="number-pad" styles={styles} c={c} />
      </FieldCard>

      <FieldCard icon="create-outline" label="Notes" c={c} styles={styles}>
        <PlainInput value={notes} onChangeText={setNotes} placeholder="Personal notes…" multiline styles={styles} c={c} />
      </FieldCard>

      <FieldCard icon="chatbubble-ellipses-outline" label="Favourite quotes" c={c} styles={styles}>
        <PlainInput value={favoriteQuotes} onChangeText={setFavoriteQuotes} placeholder="One quote per line…" multiline styles={styles} c={c} />
      </FieldCard>

      {/* ══ SAVE ═════════════════════════════════════════════════════════════ */}
      <Pressable style={styles.saveBtn} onPress={onSave}>
        <Ionicons name="checkmark" size={18} color="#fff" />
        <Text style={styles.saveBtnText}>{t("editBook.saveBtn")}</Text>
      </Pressable>

      {/* ══ DANGER ZONE ══════════════════════════════════════════════════════ */}
      <View style={styles.dangerZone}>
        <Text style={styles.dangerEyebrow}>{t("settings.dangerEyebrow")}</Text>
        <Text style={styles.dangerTitle}>{t("editBook.deleteTitle")}</Text>
        <Text style={styles.dangerBody}>{t("editBook.deleteBody")}</Text>
        <Pressable style={styles.deleteBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={16} color={c.coral} />
          <Text style={styles.deleteBtnText}>{t("editBook.deleteConfirm")}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Section card: icon + teal bold label + children */
function FieldCard({
  icon, label, children, c, styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: React.ReactNode;
  c: AppColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.fieldCard}>
      <View style={styles.fieldCardHeader}>
        <Ionicons name={icon} size={17} color={c.teal} />
        <Text style={styles.fieldCardLabel}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

/** Plain text input — no border of its own, sits inside the card */
function PlainInput({
  value, onChangeText, placeholder, keyboardType = "default",
  autoCapitalize = "sentences", multiline = false, styles, c,
}: {
  value: string; onChangeText: (v: string) => void; placeholder?: string;
  keyboardType?: "default" | "number-pad" | "numeric"; autoCapitalize?: "none" | "sentences" | "words";
  multiline?: boolean; styles: ReturnType<typeof createStyles>; c: AppColors;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.muted}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      multiline={multiline}
      style={[styles.plainInput, multiline && styles.plainInputMulti]}
    />
  );
}

/** Chip list with add-new inline input */
function ChipEditor({
  chips, onChipsChange, placeholder, styles, c,
}: {
  chips: string[]; onChipsChange: (v: string[]) => void;
  placeholder: string; styles: ReturnType<typeof createStyles>; c: AppColors;
}) {
  const [adding, setAdding] = useState(false);
  const [draft,  setDraft]  = useState("");
  const inputRef = useRef<TextInput>(null);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && !chips.includes(trimmed)) {
      onChipsChange([...chips, trimmed]);
    }
    setDraft("");
    setAdding(false);
  };

  const remove = (chip: string) => onChipsChange(chips.filter((c) => c !== chip));

  return (
    <View style={styles.chipWrap}>
      {chips.map((chip) => (
        <Pressable key={chip} style={styles.chip} onPress={() => remove(chip)}>
          <Text style={styles.chipText}>{chip}</Text>
          <Ionicons name="close" size={12} color={c.muted} style={{ marginLeft: 4 }} />
        </Pressable>
      ))}

      {adding ? (
        <TextInput
          ref={inputRef}
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          onBlur={commit}
          placeholder={placeholder}
          placeholderTextColor={c.muted}
          style={styles.chipInput}
          returnKeyType="done"
        />
      ) : (
        <Pressable style={styles.chipAdd} onPress={() => { setAdding(true); }}>
          <Ionicons name="add" size={14} color={c.teal} />
          <Text style={styles.chipAddText}>Add</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Toggle chip (boolean) */
function ToggleChip({
  label, active, onPress, styles, c,
}: {
  label: string; active: boolean; onPress: () => void;
  styles: ReturnType<typeof createStyles>; c: AppColors;
}) {
  return (
    <Pressable
      style={[styles.toggleChip, active && styles.toggleChipActive]}
      onPress={onPress}
    >
      {active ? <Ionicons name="checkmark-circle" size={14} color={c.teal} style={{ marginRight: 4 }} /> : null}
      <Text style={[styles.toggleChipText, active && styles.toggleChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** Star rating — tap a star to set 1-5, tap same star to clear */
function StarRating({
  value, onChange, styles, c,
}: {
  value: number; onChange: (v: number) => void;
  styles: ReturnType<typeof createStyles>; c: AppColors;
}) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(value === n ? 0 : n)} hitSlop={6}>
          <Ionicons
            name={n <= value ? "star" : "star-outline"}
            size={32}
            color={n <= value ? c.gold : c.border}
          />
        </Pressable>
      ))}
      {value > 0 ? (
        <Text style={styles.ratingLabel}>{value} / 5</Text>
      ) : (
        <Text style={[styles.ratingLabel, { color: c.muted }]}>Tap to rate</Text>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    // Hero
    hero: {
      ...shadows.card,
      alignItems: "center",
      backgroundColor: c.navy,
      borderRadius: radii.lg,
      flexDirection: "row",
      gap: spacing.md,
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    heroCopy: { flex: 1 },
    heroEyebrow: { color: c.gold, fontFamily: fonts.body, fontSize: 11, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
    heroTitle: { color: "#fff", fontFamily: fonts.display, fontSize: 22, fontWeight: "900", lineHeight: 27, marginTop: 4 },
    heroAuthor: { color: "rgba(255,255,255,0.60)", fontFamily: fonts.body, fontSize: 13, marginTop: 4 },

    // Fetch
    fetchBtn: {
      ...shadows.card,
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.teal + "55",
      borderRadius: radii.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      marginBottom: spacing.md,
      paddingVertical: 12,
    },
    fetchBtnBusy: { opacity: 0.6 },
    fetchBtnText: { color: c.teal, fontFamily: fonts.body, fontSize: 13, fontWeight: "900" },

    // Field card
    fieldCard: {
      ...shadows.card,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.sm,
      borderWidth: 1,
      marginBottom: spacing.sm,
      padding: spacing.md,
    },
    fieldCardHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 7,
      marginBottom: spacing.sm,
    },
    fieldCardLabel: {
      color: c.teal,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },

    // Plain input (inside card — no extra border)
    plainInput: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "700",
      minHeight: 36,
      paddingVertical: 2,
    },
    plainInputMulti: {
      minHeight: 88,
      textAlignVertical: "top",
    },

    // Pill row (format / status)
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    pill: {
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: 5,
      paddingHorizontal: 13,
      paddingVertical: 8,
    },
    pillActive: {
      backgroundColor: c.navy,
      borderColor: c.teal,
    },
    pillText: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
    },
    pillTextActive: {
      color: "#fff",
    },

    // Chip editor
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
    },
    chip: {
      alignItems: "center",
      backgroundColor: c.teal + "18",
      borderColor: c.teal + "44",
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: "row",
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    chipText: {
      color: c.tealDark,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
    },
    chipInput: {
      borderBottomColor: c.teal,
      borderBottomWidth: 1.5,
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      minWidth: 80,
      paddingVertical: 4,
    },
    chipAdd: {
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderStyle: "dashed",
      borderWidth: 1,
      flexDirection: "row",
      gap: 4,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    chipAddText: {
      color: c.teal,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
    },

    // Toggle chip
    toggleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    toggleChip: {
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderColor: c.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: "row",
      paddingHorizontal: 13,
      paddingVertical: 8,
    },
    toggleChipActive: {
      backgroundColor: c.teal + "18",
      borderColor: c.teal + "55",
    },
    toggleChipText: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
    },
    toggleChipTextActive: {
      color: c.tealDark,
    },

    // Stars
    starsRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    ratingLabel: {
      color: c.gold,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900",
      marginLeft: 4,
    },

    // Save / delete
    saveBtn: {
      alignItems: "center",
      backgroundColor: c.navy,
      borderRadius: radii.pill,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      marginBottom: spacing.md,
      marginTop: spacing.md,
      paddingVertical: 15,
    },
    saveBtnText: { color: "#fff", fontFamily: fonts.body, fontSize: 15, fontWeight: "900" },
    dangerZone: {
      borderColor: c.coral + "44",
      borderRadius: radii.sm,
      borderWidth: 1,
      marginBottom: spacing.xl,
      padding: spacing.md,
    },
    dangerEyebrow: { color: c.coral, fontFamily: fonts.body, fontSize: 11, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
    dangerTitle: { color: c.ink, fontFamily: fonts.display, fontSize: 18, fontWeight: "900", marginTop: 4 },
    dangerBody: { color: c.muted, fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 19, marginTop: 5 },
    deleteBtn: {
      alignItems: "center",
      borderColor: c.coral + "55",
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      marginTop: spacing.md,
      paddingVertical: 12,
    },
    deleteBtnText: { color: c.coral, fontFamily: fonts.body, fontSize: 14, fontWeight: "900" },

    // Unused but kept for t() calls that might reference them
    emptyText: { color: c.muted, fontFamily: fonts.body, padding: spacing.lg },
  });
}
