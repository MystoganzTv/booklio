import { Ionicons } from "@expo/vector-icons";
import { CameraView, BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BooklioDialog } from "../components/BooklioDialog";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { useI18n } from "../i18n/LocalizationContext";
import { RootStackParamList } from "../navigation/types";
import { AppColors, colors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors, useTheme } from "../theme/ThemeContext";
import { NewBookInput, ReadingFormat } from "../types/models";
import { analyzeBookPhoto, getBookPhotoSupportSummary } from "../utils/bookPhotoIntake";
import {
  applyEditionOptionToBookInput,
  canFetchMetadata,
  enrichBookInput,
  fetchBookMetadataByEditionKey,
  fetchBookMetadataByIsbn,
  fetchEditionOptionsByWorkKey,
  metadataToBookInput,
  OPEN_LIBRARY_PAGE_SIZE,
  searchBookMetadata,
  SearchMode,
  summarizeMetadataChanges
} from "../utils/bookMetadata";

type IntakeMode = "menu" | "isbn" | "manual" | "search" | "review";
type IconName = keyof typeof Ionicons.glyphMap;

const booklioLogo = require("../../assets/brand/booklio-logo.png");

const mockIsbnCatalog: Record<string, Omit<NewBookInput, "source">> = {
  "9780441172719": {
    title: "Dune",
    authorName: "Frank Herbert",
    isbn: "9780441172719",
    pages: 896,
    genre: ["Science Fiction", "Saga"],
    publisher: "Ace",
    publishedDate: "1965-08-01",
    language: "English",
    synopsis: "Paul Atreides enters the desert politics, ecology, prophecy, and danger of Arrakis."
  },
  "9780451524935": {
    title: "1984",
    authorName: "George Orwell",
    isbn: "9780451524935",
    pages: 328,
    genre: ["Dystopian", "Classic"],
    publisher: "Signet Classics",
    publishedDate: "1949-06-08",
    language: "English",
    synopsis: "A chilling portrait of surveillance, language control, and resistance under Big Brother."
  },
  "9780735211292": {
    title: "Atomic Habits",
    authorName: "James Clear",
    isbn: "9780735211292",
    pages: 320,
    genre: ["Personal Growth", "Nonfiction"],
    publisher: "Avery",
    publishedDate: "2018-10-16",
    language: "English",
    synopsis: "A practical system for building better habits through small, repeatable improvements."
  },
  "9780547928227": {
    title: "The Hobbit",
    authorName: "J. R. R. Tolkien",
    isbn: "9780547928227",
    pages: 300,
    genre: ["Fantasy", "Adventure"],
    publisher: "Mariner Books",
    publishedDate: "1937-09-21",
    language: "English",
    synopsis: "Bilbo Baggins leaves the Shire for dragons, dwarves, riddles, and a very consequential ring."
  },
  "9780756404741": {
    title: "The Name of the Wind",
    authorName: "Patrick Rothfuss",
    isbn: "9780756404741",
    pages: 662,
    genre: ["Fantasy", "Saga"],
    publisher: "DAW Books",
    publishedDate: "2007-03-27",
    language: "English",
    synopsis: "Kvothe recounts the first day of his life story: music, magic, reputation, and loss."
  },
  "9780590353427": {
    title: "Harry Potter and the Sorcerer's Stone",
    authorName: "J. K. Rowling",
    isbn: "9780590353427",
    pages: 309,
    genre: ["Fantasy", "Young Adult"],
    publisher: "Scholastic",
    publishedDate: "1998-09-01",
    language: "English",
    synopsis: "A boy discovers a hidden magical world and begins his first year at Hogwarts."
  },
  "9780143127741": {
    title: "Sapiens",
    authorName: "Yuval Noah Harari",
    isbn: "9780143127741",
    pages: 464,
    genre: ["History", "Nonfiction"],
    publisher: "Harper",
    publishedDate: "2015-02-10",
    language: "English",
    synopsis: "A sweeping history of humankind, from cognitive revolution to modern civilization."
  }
};

const featuredExamples = [
  "9780441172719",
  "9780451524935",
  "9780735211292",
  "9780547928227",
  "9780756404741"
];

const COMMON_LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian",
  "Portuguese", "Russian", "Japanese", "Chinese", "Korean",
  "Arabic", "Dutch", "Swedish", "Polish", "Turkish"
];

const REVIEW_FORMATS: { value: ReadingFormat; label: string; icon: IconName }[] = [
  { value: "physical", label: "Physical", icon: "book-outline" },
  { value: "kindle", label: "Kindle", icon: "tablet-portrait-outline" },
  { value: "audiobook", label: "Audiobook", icon: "headset-outline" }
];

const sourceLabel: Record<NewBookInput["source"], string> = {
  photo: "Cover photo",
  isbn: "ISBN scan",
  manual: "Manual entry",
  search: "Book search"
};

export function BookIntakeScreen() {
  const c = useColors();
  const { isDark } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { addBook } = useBooklio();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<IntakeMode>("menu");
  const [scanned, setScanned] = useState(false);
  const [coverUri, setCoverUri] = useState<string | undefined>();
  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("general");
  const [searchResults, setSearchResults] = useState<NewBookInput[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchOffset, setSearchOffset] = useState(0);
  const [reviewBook, setReviewBook] = useState<NewBookInput | null>(null);
  const [reviewInsight, setReviewInsight] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ title: string; body: string } | null>(null);
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [manual, setManual] = useState({
    title: "",
    authorName: "",
    isbn: "",
    pages: "",
    genre: "",
    publisher: ""
  });

  const photoSupport = getBookPhotoSupportSummary();
  const dialogNode = (
    <BooklioDialog
      open={Boolean(dialog)}
      title={dialog?.title ?? ""}
      body={dialog?.body ?? ""}
      onConfirm={() => setDialog(null)}
    />
  );

  const openDialog = (title: string, body: string) => {
    setDialog({ title, body });
  };

  const stageBook = async (input: NewBookInput, insight?: string | null) => {
    const draft: NewBookInput = {
      ownership: "owned",
      wishlist: false,
      wantToBuy: false,
      format: "physical",
      language: "English",
      ...input
    };
    setReviewBook(draft);
    setReviewInsight(insight ?? null);
    setMode("review");
  };

  const confirmAndOpen = (input: NewBookInput) => {
    const book = addBook(input);
    // Reset so back-press from BookDetail lands on Library, not the Add tab
    navigation.reset({
      index: 1,
      routes: [
        {
          name: "MainTabs",
          state: {
            index: 1, // Library tab (0=Home, 1=Library, 2=Add, 3=Stats, 4=Profile)
            routes: [
              { name: "Home" },
              { name: "Library" },
              { name: "Add" },
              { name: "Stats" },
              { name: "Profile" }
            ]
          }
        },
        { name: "BookDetail", params: { bookId: book.id } }
      ]
    });
  };

  const addFromIsbn = async (isbn: string) => {
    const clean = isbn.replace(/[^0-9X]/gi, "");
    setIsBusy(true);
    let found: NewBookInput | undefined;
    try {
      const metadata = await fetchBookMetadataByIsbn(clean);
      found = metadata ? metadataToBookInput(metadata, "isbn", { isbn: metadata.isbn ?? clean }) : undefined;
    } catch {
      found = undefined;
    } finally {
      setIsBusy(false);
    }

    const fallback = mockIsbnCatalog[clean];
    stageBook({
      ...(found ?? fallback ?? {
        title: `ISBN Book ${clean}`,
        authorName: "Author to identify",
        isbn: clean,
        pages: 320,
        genre: ["Uncategorized"],
        publisher: "Publisher pending confirmation",
        synopsis: "ISBN captured. Ready to be completed from a live metadata provider."
      }),
      source: "isbn"
    }, found ? "Booklio matched this ISBN with live metadata." : "Booklio captured the ISBN. Review and complete any missing details.");
  };

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsBusy(true);
    setSearchOffset(0);
    try {
      const { results, total } = await searchBookMetadata(searchQuery.trim(), searchMode, 0);
      setSearchResults(results);
      setSearchTotal(total);
      if (!results.length) {
        openDialog("No results yet", "Booklio couldn't find a match in Open Library. Try a different title, author, or ISBN.");
      }
    } catch {
      setSearchResults([]);
      setSearchTotal(0);
      openDialog(
        "Connection issue",
        Platform.OS === "web"
          ? "Couldn't reach metadata search. In the web demo, start `npm run metadata-proxy` and try again, or use manual entry."
          : "Couldn't reach Open Library right now. Try again or use manual entry."
      );
    } finally {
      setIsBusy(false);
    }
  };

  const loadMoreResults = async () => {
    if (isLoadingMore) return;
    const nextOffset = searchOffset + OPEN_LIBRARY_PAGE_SIZE;
    setIsLoadingMore(true);
    try {
      const { results } = await searchBookMetadata(searchQuery.trim(), searchMode, nextOffset);
      setSearchResults((prev) => [...prev, ...results]);
      setSearchOffset(nextOffset);
    } catch {
      // silent — keep existing results
    } finally {
      setIsLoadingMore(false);
    }
  };

  const selectSearchResult = async (book: NewBookInput) => {
    setIsBusy(true);
    try {
      await stageBook(await enrichBookInput(book));
    } catch {
      await stageBook(book);
    } finally {
      setIsBusy(false);
    }
  };

  const takeCoverPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      base64: true,
      quality: 0.85
    });
    if (result.canceled) return;
    await processPhotoAsset(result.assets[0]);
  };

  const pickCoverPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [3, 4],
      base64: true,
      quality: 0.85
    });
    if (result.canceled) return;
    await processPhotoAsset(result.assets[0]);
  };

  const handleBarcode = ({ data }: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    addFromIsbn(data);
  };

  const saveManual = () => {
    void stageBook({
      title: manual.title || "New book",
      authorName: manual.authorName || "Author to identify",
      isbn: manual.isbn || undefined,
      pages: manual.pages ? Number(manual.pages) : undefined,
      genre: manual.genre ? manual.genre.split(",").map((item) => item.trim()).filter(Boolean) : ["Uncategorized"],
      publisher: manual.publisher || undefined,
      source: "manual"
    }, "This draft started from manual entry. You can still refresh metadata before saving.");
  };

  const updateReviewBook = (patch: Partial<NewBookInput>) => {
    setReviewBook((current) => (current ? { ...current, ...patch } : current));
  };

  const refreshReviewMetadata = async () => {
    if (!reviewBook || !canFetchMetadata(reviewBook)) {
      openDialog("Need a clue first", "Add an ISBN or at least a title before refreshing metadata.");
      return;
    }

    setIsRefreshingMetadata(true);
    try {
      const enriched = await enrichBookInput(reviewBook);
      const changes = summarizeMetadataChanges(reviewBook, enriched);
      setReviewBook(enriched);
      if (changes.length) {
        openDialog("Metadata refreshed", `Updated: ${changes.join(", ")}.`);
      } else {
        openDialog("No changes found", "Booklio couldn't find any additional details for this draft.");
      }
    } catch {
      openDialog(
        "Connection issue",
        Platform.OS === "web"
          ? "Couldn't reach metadata search. In the web demo, start `npm run metadata-proxy` and try again."
          : "Couldn't reach Open Library right now. Try again in a moment."
      );
    } finally {
      setIsRefreshingMetadata(false);
    }
  };

  const selectReviewLanguage = async (language: string) => {
    if (!reviewBook) return;

    const draftWithLanguage = { ...reviewBook, language };
    setReviewBook(draftWithLanguage);

    if (!reviewBook.workKey) {
      setReviewInsight(`Language changed to ${language}. ISBN and publisher stay as-is until a matching edition is found.`);
      return;
    }

    setIsRefreshingMetadata(true);
    try {
      const options = await fetchEditionOptionsByWorkKey(reviewBook.workKey, 30);
      const exactMatch = options.find((option) => option.language?.toLowerCase() === language.toLowerCase());

      if (!exactMatch) {
        setReviewInsight(`Language changed to ${language}. Booklio could not find a matching edition, so ISBN and publisher were kept from the current version.`);
        return;
      }

      let nextDraft = applyEditionOptionToBookInput(draftWithLanguage, exactMatch);
      const detailedMetadata = exactMatch.isbn
        ? await fetchBookMetadataByIsbn(exactMatch.isbn)
        : await fetchBookMetadataByEditionKey(exactMatch.editionKey);

      if (detailedMetadata) {
        nextDraft = {
          ...nextDraft,
          title: detailedMetadata.title ?? nextDraft.title,
          authorName: detailedMetadata.authorName ?? nextDraft.authorName,
          isbn: detailedMetadata.isbn ?? nextDraft.isbn,
          pages: detailedMetadata.pages ?? nextDraft.pages,
          genre: detailedMetadata.genre?.length ? detailedMetadata.genre : nextDraft.genre,
          publisher: detailedMetadata.publisher ?? nextDraft.publisher,
          publishedDate: detailedMetadata.publishedDate ?? nextDraft.publishedDate,
          language: detailedMetadata.language ?? language,
          synopsis: detailedMetadata.synopsis ?? nextDraft.synopsis,
          coverImageUri: detailedMetadata.coverImageUri ?? nextDraft.coverImageUri,
          format: detailedMetadata.format ?? nextDraft.format,
          workKey: detailedMetadata.workKey ?? nextDraft.workKey,
          editionKey: detailedMetadata.editionKey ?? nextDraft.editionKey,
          editionCount: detailedMetadata.editionCount ?? nextDraft.editionCount,
          isBestseller: detailedMetadata.isBestseller ?? nextDraft.isBestseller,
          tags: detailedMetadata.tags?.length
            ? Array.from(new Set([...(nextDraft.tags ?? []), ...detailedMetadata.tags]))
            : nextDraft.tags
        };
      }

      setReviewBook(nextDraft);
      setReviewInsight(`Matched a ${language} edition. ISBN, publisher, and edition details were updated where Open Library had them.`);
    } catch {
      setReviewInsight(`Language changed to ${language}. Booklio could not refresh the edition metadata right now.`);
    } finally {
      setIsRefreshingMetadata(false);
    }
  };

  const confirmReviewBook = () => {
    if (!reviewBook || isSubmittingReview) return;
    setIsSubmittingReview(true);
    try {
      confirmAndOpen({
        ...reviewBook,
        title: reviewBook.title.trim() || "Untitled Book",
        authorName: reviewBook.authorName.trim() || "Author to identify",
        genre: reviewBook.genre?.length ? reviewBook.genre : ["Uncategorized"],
        pages: reviewBook.pages && reviewBook.pages > 0 ? reviewBook.pages : 320
      });
    } finally {
      setTimeout(() => setIsSubmittingReview(false), 500);
    }
  };

  const processPhotoAsset = async (asset?: ImagePicker.ImagePickerAsset) => {
    const uri = asset?.uri;
    if (!uri) return;

    setCoverUri(uri);
    setIsAnalyzingPhoto(true);

    try {
      const result = await analyzeBookPhoto({
        uri,
        base64: asset?.base64,
        fileName: asset?.fileName
      });
      await stageBook(result.draft, result.notes.join(" "));
    } catch {
      await stageBook({
        title: "Book from photo",
        authorName: "Needs identification",
        genre: ["Uncategorized"],
        language: "English",
        synopsis: "Booklio saved your photo, but detection failed this time. Review the draft and refresh metadata once you add a title or ISBN.",
        coverImageUri: uri,
        source: "photo",
        ownership: "owned"
      }, "Booklio could not inspect that image right now, but your photo is attached and ready for review.");
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  if (mode === "review" && reviewBook) {
    return (
      <Screen>
      {dialogNode}
      <View style={styles.reviewHeader}>
          {reviewBook.coverImageUri ? (
            <Image source={{ uri: reviewBook.coverImageUri }} style={styles.reviewCover} />
          ) : (
            <View style={styles.reviewCoverFallback}>
              <Ionicons name="book-outline" size={28} color={c.gold} />
            </View>
          )}
        <View style={styles.reviewHeaderCopy}>
          <Text style={styles.pageEyebrow}>Review & edit</Text>
          <Text style={styles.reviewTitle} numberOfLines={3}>{reviewBook.title}</Text>
          <Text style={styles.reviewAuthor} numberOfLines={1}>{reviewBook.authorName}</Text>
          <View style={styles.reviewSourcePill}>
            <Ionicons name="sparkles-outline" size={14} color={c.gold} />
            <Text style={styles.reviewSourceText}>{sourceLabel[reviewBook.source]}</Text>
          </View>
        </View>
      </View>

      {reviewInsight ? (
        <View style={styles.reviewInsightCard}>
          <Ionicons name="sparkles-outline" size={16} color={c.tealDark} />
          <Text style={styles.reviewInsightText}>{reviewInsight}</Text>
        </View>
      ) : null}

      <View style={styles.metadataStrip}>
        <View style={styles.metadataItem}>
          <Text style={styles.metadataLabel}>Pages</Text>
          <Text style={styles.metadataValue}>{reviewBook.pages ?? "—"}</Text>
        </View>
        <View style={styles.metadataDivider} />
        <View style={styles.metadataItem}>
          <Text style={styles.metadataLabel}>ISBN</Text>
          <Text style={styles.metadataValue} numberOfLines={1}>{reviewBook.isbn ?? "Pending"}</Text>
        </View>
        <View style={styles.metadataDivider} />
        <View style={styles.metadataItem}>
          <Text style={styles.metadataLabel}>Publisher</Text>
          <Text style={styles.metadataValue} numberOfLines={1}>{reviewBook.publisher ?? "Pending"}</Text>
        </View>
      </View>

        <Pressable
          style={[styles.fetchMetaButton, isRefreshingMetadata && styles.fetchMetaButtonBusy]}
          onPress={refreshReviewMetadata}
          disabled={isRefreshingMetadata}
        >
          {isRefreshingMetadata
            ? <ActivityIndicator size="small" color={c.tealDark} />
            : <Ionicons name="sparkles-outline" size={16} color={c.tealDark} />
          }
          <Text style={styles.fetchMetaButtonText}>
            {isRefreshingMetadata ? "Refreshing metadata..." : "Refresh metadata"}
          </Text>
        </Pressable>

        <Text style={styles.reviewSectionTitle}>Verify details</Text>
        <Field label="Title" value={reviewBook.title} onChangeText={(title) => updateReviewBook({ title })} />
        <Field label="Author" value={reviewBook.authorName} onChangeText={(authorName) => updateReviewBook({ authorName })} />
        <Field
          label="Genres"
          value={reviewBook.genre?.join(", ") ?? ""}
          onChangeText={(value) => updateReviewBook({ genre: splitList(value) })}
          hint="Separate genres with commas"
        />
        <Field
          label="Pages"
          keyboardType="number-pad"
          value={reviewBook.pages ? String(reviewBook.pages) : ""}
          onChangeText={(value) => updateReviewBook({ pages: Number(value) || undefined })}
        />
        <Field label="Synopsis" value={reviewBook.synopsis ?? ""} onChangeText={(synopsis) => updateReviewBook({ synopsis })} multiline />

        <Text style={styles.reviewSectionTitle}>Preferences</Text>
        <LanguagePicker
          selected={reviewBook.language ?? "English"}
          onSelect={selectReviewLanguage}
        />

        <Text style={styles.reviewSectionTitle}>Format</Text>
        <View style={styles.reviewChoiceGrid}>
          {REVIEW_FORMATS.map((option) => (
            <Choice
              key={option.value}
              active={reviewBook.format === option.value}
              icon={option.icon}
              label={option.label}
              onPress={() => updateReviewBook({ format: option.value })}
            />
          ))}
        </View>

        <Text style={styles.reviewSectionTitle}>Shelf</Text>
        <View style={styles.reviewChoiceGrid}>
          <Choice
            active={reviewBook.ownership === "owned"}
            icon="checkmark-circle-outline"
            label="Owned"
            onPress={() => updateReviewBook({ ownership: "owned", wishlist: false, wantToBuy: false })}
          />
          <Choice
            active={Boolean(reviewBook.wishlist)}
            icon="bookmark-outline"
            label="Wishlist"
            onPress={() => updateReviewBook({ ownership: "not-owned", wishlist: true, wantToBuy: false })}
          />
          <Choice
            active={Boolean(reviewBook.wantToBuy)}
            icon="cart-outline"
            label="Want to buy"
            onPress={() => updateReviewBook({ ownership: "not-owned", wishlist: false, wantToBuy: true })}
          />
        </View>

        <View style={styles.reviewActions}>
          <Pressable
            style={[styles.primaryReviewButton, isSubmittingReview && styles.primaryReviewButtonBusy]}
            onPress={confirmReviewBook}
            disabled={isSubmittingReview}
          >
            {isSubmittingReview ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="library-outline" size={18} color="#FFFFFF" />
            )}
            <Text style={styles.primaryReviewButtonText}>{isSubmittingReview ? "Saving..." : "Add to library"}</Text>
          </Pressable>
          <Pressable style={styles.secondaryReviewButton} onPress={() => setMode("menu")}>
            <Ionicons name="close-outline" size={18} color={c.muted} />
            <Text style={styles.secondaryReviewButtonText}>Cancel this draft</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (mode === "isbn") {
    return (
      <Screen>
        {dialogNode}
        <View style={styles.pageHeader}>
          <Text style={styles.pageEyebrow}>{t("addBook.scanIsbn")}</Text>
          <Text style={styles.pageTitle}>{t("addBook.scanIsbn")}</Text>
        </View>

        {!permission?.granted ? (
          <View style={styles.permissionCard}>
            <Text style={styles.cardTitle}>Camera access needed</Text>
            <Text style={styles.cardCopy}>Allow camera access to scan ISBN codes or photograph physical book covers.</Text>
            <Pressable style={styles.primaryButton} onPress={requestPermission}>
              <Text style={styles.primaryButtonText}>Allow camera</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.scannerCard}>
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarcode}
              barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "qr"] }}
            />
            <View style={styles.scanFrame} />
          </View>
        )}

        <View style={styles.manualIsbnCard}>
          <Text style={styles.cardTitle}>You can also paste it</Text>
          <TextInput
            keyboardType="number-pad"
            placeholder="9780756404741"
            placeholderTextColor={c.gray}
            style={styles.input}
            value={manual.isbn}
            onChangeText={(isbn) => setManual((current) => ({ ...current, isbn }))}
          />
          <Pressable style={styles.secondaryButton} onPress={() => addFromIsbn(manual.isbn || "9780756404741")}>
            <Text style={styles.secondaryButtonText}>{isBusy ? "Searching..." : "Search by ISBN"}</Text>
          </Pressable>
          {scanned ? (
            <Pressable style={styles.ghostButton} onPress={() => setScanned(false)}>
              <Text style={styles.ghostButtonText}>Scan another code</Text>
            </Pressable>
          ) : null}
        </View>
      </Screen>
    );
  }

  if (mode === "manual") {
    return (
      <Screen>
        {dialogNode}
        <View style={styles.pageHeader}>
          <Text style={styles.pageEyebrow}>{t("addBook.manual")}</Text>
          <Text style={styles.pageTitle}>{t("addBook.manual")}</Text>
        </View>

        <Field label="Title" value={manual.title} onChangeText={(v) => setManual((c) => ({ ...c, title: v }))} />
        <Field label="Author" value={manual.authorName} onChangeText={(v) => setManual((c) => ({ ...c, authorName: v }))} />
        <Field label="Pages" keyboardType="number-pad" value={manual.pages} onChangeText={(v) => setManual((c) => ({ ...c, pages: v }))} />
        <Field label="Genre(s), comma separated" value={manual.genre} onChangeText={(v) => setManual((c) => ({ ...c, genre: v }))} />
        <Field label="Publisher" value={manual.publisher} onChangeText={(v) => setManual((c) => ({ ...c, publisher: v }))} />
        <Field label="ISBN (optional)" value={manual.isbn} onChangeText={(v) => setManual((c) => ({ ...c, isbn: v }))} />

        <Pressable style={styles.saveButton} onPress={saveManual}>
          <Text style={styles.saveButtonText}>Review book</Text>
        </Pressable>
      </Screen>
    );
  }

  if (mode === "search") {
    const displayResults = searchResults.length
      ? searchResults
      : featuredExamples.map((isbn) => ({ ...mockIsbnCatalog[isbn], source: "search" as const }));

    return (
      <Screen>
        {dialogNode}
        <View style={styles.pageHeader}>
          <Text style={styles.pageEyebrow}>{t("addBook.search")}</Text>
          <Text style={styles.pageTitle}>{t("addBook.search")}</Text>
        </View>

        {/* Mode toggle */}
        <View style={styles.searchModeRow}>
          {(["general", "author"] as SearchMode[]).map((m) => (
            <Pressable
              key={m}
              style={[styles.searchModeChip, searchMode === m && styles.searchModeChipActive]}
              onPress={() => setSearchMode(m)}
            >
              <Ionicons
                name={m === "author" ? "person-outline" : "search-outline"}
                size={13}
                color={searchMode === m ? "#FFFFFF" : c.muted}
              />
              <Text style={[styles.searchModeText, searchMode === m && styles.searchModeTextActive]}>
                {m === "author" ? "By author" : "Title / keyword"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.searchRow}>
          <TextInput
            autoFocus
            placeholder={searchMode === "author" ? "David Baldacci, J.K. Rowling…" : "Dune, Memory Man, ISBN…"}
            placeholderTextColor={c.gray}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={runSearch}
            returnKeyType="search"
          />
          <Pressable style={[styles.searchBtn, isBusy && { opacity: 0.6 }]} onPress={runSearch} disabled={isBusy}>
            <Ionicons name={isBusy ? "hourglass-outline" : "search"} size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {isBusy ? (
          <View style={styles.busyRow}>
            <Ionicons name="hourglass-outline" size={18} color={c.muted} />
            <Text style={styles.busyText}>Searching Open Library…</Text>
          </View>
        ) : (
          <View style={styles.resultsWrap}>
            {!searchResults.length && (
              <Text style={styles.resultsHint}>
                {searchQuery.trim() ? "Showing example books — tap Search to find yours." : "Try searching above. Results come from Open Library."}
              </Text>
            )}
            {searchResults.length > 0 && (
              <Text style={styles.resultCount}>
                {searchResults.length} of {searchTotal.toLocaleString()} results
              </Text>
            )}
            {displayResults.map((book) => (
              <Pressable
                key={`${book.title}-${book.isbn}`}
                style={styles.resultCard}
                onPress={() => selectSearchResult(book)}
              >
                {book.coverImageUri
                  ? <Image source={{ uri: book.coverImageUri }} style={styles.resultCover} />
                  : <View style={styles.resultCoverFallback}><Ionicons name="book-outline" size={22} color="#FFFFFF" /></View>}
                <View style={styles.resultCopy}>
                  <Text numberOfLines={2} style={styles.resultTitle}>{book.title}</Text>
                  <Text numberOfLines={1} style={styles.resultAuthor}>{book.authorName}</Text>
                  <Text numberOfLines={1} style={styles.resultMeta}>
                    {book.language ? `${book.language}` : ""}
                    {book.language && (book.pages || book.publisher || book.publishedDate) ? " · " : ""}
                    {book.pages ? `${book.pages} pg` : ""}
                    {book.publisher ? ` · ${book.publisher}` : ""}
                    {book.publishedDate ? ` · ${String(book.publishedDate).slice(0, 4)}` : ""}
                  </Text>
                  {!!book.editionCount && (
                    <View style={styles.resultEditionPill}>
                      <Ionicons name="layers-outline" size={12} color={c.tealDark} />
                      <Text style={styles.resultEditionText}>
                        {book.editionCount} edition{book.editionCount === 1 ? "" : "s"}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.resultAction}>
                  <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                </View>
              </Pressable>
            ))}
            {searchResults.length > 0 && searchResults.length < searchTotal && (
              <Pressable
                style={[styles.loadMoreBtn, isLoadingMore && { opacity: 0.6 }]}
                onPress={loadMoreResults}
                disabled={isLoadingMore}
              >
                {isLoadingMore
                  ? <Ionicons name="hourglass-outline" size={15} color={c.tealDark} />
                  : <Ionicons name="chevron-down-circle-outline" size={15} color={c.tealDark} />
                }
                <Text style={styles.loadMoreText}>
                  {isLoadingMore ? "Loading…" : `Load more (${(searchTotal - searchResults.length).toLocaleString()} remaining)`}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      {dialogNode}
      <View style={styles.pageHeader}>
        <Text style={styles.pageEyebrow}>{t("addBook.eyebrow")}</Text>
        <Text style={styles.pageTitle}>{t("addBook.title")}</Text>
      </View>

      <View style={styles.pathGrid}>
        <IntakePath
          accent={c.teal}
          icon="camera"
          title={t("addBook.takePhoto")}
          description={t("addBook.takePhotoBody")}
          onPress={takeCoverPhoto}
        />
        <IntakePath
          accent={c.gold}
          icon="barcode"
          title={t("addBook.scanIsbn")}
          description={t("addBook.scanIsbnBody")}
          onPress={() => setMode("isbn")}
        />
        <IntakePath
          accent={c.coral}
          icon="search"
          title={t("addBook.search")}
          description={t("addBook.searchBody")}
          onPress={() => setMode("search")}
        />
        <IntakePath
          accent={isDark ? c.surface : c.navy}
          icon="image"
          title={t("addBook.importPhoto")}
          description={t("addBook.importPhotoBody")}
          onPress={pickCoverPhoto}
        />
        <IntakePath
          accent={c.green}
          icon="create"
          title={t("addBook.manual")}
          description={t("addBook.manualBody")}
          onPress={() => setMode("manual")}
        />
      </View>

      {isAnalyzingPhoto ? (
        <View style={styles.photoBusyCard}>
          <ActivityIndicator size="small" color={c.tealDark} />
          <Text style={styles.photoBusyText}>Inspecting photo for ISBN and book clues…</Text>
        </View>
      ) : null}

      {!photoSupport.imageBarcodeIsbnSupported || !photoSupport.visionProviderConfigured ? (
        <View style={styles.photoHintCard}>
          <Text style={styles.photoHintTitle}>{t("addBook.photoTips")}</Text>
          <Text style={styles.photoHintCopy}>
            {photoSupport.imageBarcodeIsbnSupported
              ? t("addBook.photoTipsGeneral")
              : t("addBook.photoTipsIos")}
          </Text>
          {!photoSupport.visionProviderConfigured ? (
            <Text style={styles.photoHintCopy}>
              {t("addBook.coverOcrHint")}
            </Text>
          ) : null}
        </View>
      ) : null}

      {coverUri ? <Image source={{ uri: coverUri }} style={styles.preview} /> : null}
    </Screen>
  );
}

type IntakePathProps = {
  title: string;
  description: string;
  icon: IconName;
  accent: string;
  onPress: () => void;
};

function IntakePath({ title, description, icon, accent, onPress }: IntakePathProps) {
  const c = useColors();
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  return (
    <Pressable style={styles.pathCard} onPress={onPress}>
      <View style={[styles.pathIcon, { backgroundColor: accent, borderColor: isDark && accent === c.surface ? c.border : "transparent", borderWidth: isDark && accent === c.surface ? 1 : 0 }]}>
        <Ionicons color={isDark && accent === c.surface ? c.ink : "#FFFFFF"} name={icon} size={24} />
      </View>
      <Text style={styles.pathTitle}>{title}</Text>
      <Text style={styles.pathDescription}>{description}</Text>
    </Pressable>
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
  const c = useColors();
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={c.gray}
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function LanguagePicker({ selected, onSelect }: { selected: string; onSelect: (lang: string) => void | Promise<void> }) {
  const c = useColors();
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(!COMMON_LANGUAGES.includes(selected));

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Language</Text>
      <View style={styles.languageGrid}>
        {COMMON_LANGUAGES.map((lang) => {
          const active = !showCustom && selected === lang;
          return (
            <Pressable
              key={lang}
              style={[styles.languageChip, active && styles.languageChipActive]}
              onPress={() => { void onSelect(lang); setShowCustom(false); }}
            >
              <Text style={[styles.languageChipText, active && styles.languageChipTextActive]}>
                {lang}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          style={[styles.languageChip, showCustom && styles.languageChipActive]}
          onPress={() => setShowCustom(true)}
        >
          <Text style={[styles.languageChipText, showCustom && styles.languageChipTextActive]}>Other…</Text>
        </Pressable>
      </View>
      {showCustom && (
        <TextInput
          autoFocus
          placeholder="Type language…"
          placeholderTextColor={c.gray}
          style={[styles.input, { marginTop: spacing.sm }]}
          value={custom}
          onChangeText={(v) => { setCustom(v); void onSelect(v); }}
        />
      )}
    </View>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Choice({
  active,
  icon,
  label,
  onPress
}: {
  active: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const c = useColors();
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  return (
    <Pressable style={[styles.choice, active && styles.choiceActive]} onPress={onPress}>
      <Ionicons name={icon} size={16} color={active ? c.ink : c.muted} />
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(c: AppColors, isDark: boolean) {
  const darkInteractiveFill = "rgba(20,184,166,0.16)";
  const darkInteractiveBorder = "rgba(20,184,166,0.34)";
  const darkInteractiveText = c.ink;

  return StyleSheet.create({
  pageHeader: {
    marginBottom: spacing.md
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
  pathGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.lg
  },
  pathCard: {
    backgroundColor: c.surfaceAlt,
    borderColor: c.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
    width: "47%"
  },
  pathIcon: {
    alignItems: "center",
    borderRadius: 20,
    height: 44,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 44
  },
  reviewHeader: {
    ...shadows.card,
    alignItems: "center",
    backgroundColor: c.navy,
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md
  },
  reviewCover: {
    backgroundColor: c.surfaceAlt,
    borderRadius: radii.md,
    height: 148,
    width: 98
  },
  reviewCoverFallback: {
    alignItems: "center",
    backgroundColor: c.navy2,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: radii.md,
    borderWidth: 1,
    height: 148,
    justifyContent: "center",
    width: 98
  },
  reviewHeaderCopy: {
    flex: 1
  },
  reviewTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.display,
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 30,
    marginTop: 4
  },
  reviewAuthor: {
    color: "rgba(255,255,255,0.74)",
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 5
  },
  reviewSourcePill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  reviewSourceText: {
    color: c.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  metadataStrip: {
    ...shadows.card,
    alignItems: "stretch",
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  reviewInsightCard: {
    alignItems: "flex-start",
    backgroundColor: c.teal + "14",
    borderColor: c.teal + "32",
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  reviewInsightText: {
    color: c.tealDark,
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19
  },
  metadataItem: {
    flex: 1
  },
  metadataLabel: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  metadataValue: {
    color: c.ink,
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4
  },
  metadataDivider: {
    backgroundColor: c.border,
    marginHorizontal: spacing.sm,
    width: 1
  },
  reviewSectionTitle: {
    color: c.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: spacing.sm,
    marginTop: spacing.sm
  },
  fetchMetaButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: c.teal + "14",
    borderColor: c.teal + "32",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11
  },
  fetchMetaButtonBusy: {
    opacity: 0.8
  },
  fetchMetaButtonText: {
    color: c.tealDark,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  reviewChoiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  choice: {
    alignItems: "center",
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  choiceActive: {
    backgroundColor: isDark ? darkInteractiveFill : c.gold,
    borderColor: isDark ? darkInteractiveBorder : c.gold
  },
  choiceText: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  choiceTextActive: {
    color: c.ink
  },
  reviewActions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingBottom: spacing.lg
  },
  primaryReviewButton: {
    alignItems: "center",
    backgroundColor: c.navy,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 15
  },
  primaryReviewButtonBusy: {
    opacity: 0.8
  },
  primaryReviewButtonText: {
    color: "#FFFFFF",
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  },
  secondaryReviewButton: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 6
  },
  secondaryReviewButtonText: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  resultsWrap: {
    gap: spacing.md,
    marginTop: spacing.lg
  },
  resultCard: {
    alignItems: "center",
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  resultCover: {
    backgroundColor: c.surfaceAlt,
    borderRadius: radii.md,
    height: 104,
    width: 70
  },
  resultCoverFallback: {
    backgroundColor: c.navy,
    borderRadius: radii.md,
    height: 104,
    width: 70
  },
  resultCopy: {
    flex: 1
  },
  resultTitle: {
    color: c.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26
  },
  resultAuthor: {
    color: c.tealDark,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 5
  },
  resultMeta: {
    color: c.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginTop: 5
  },
  resultEditionPill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: c.teal + "14",
    borderColor: c.teal + "32",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  resultEditionText: {
    color: c.tealDark,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "900"
  },
  resultAction: {
    alignItems: "center",
    backgroundColor: c.navy,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  pathTitle: {
    color: c.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "900"
  },
  pathDescription: {
    color: c.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5
  },
  preview: {
    alignSelf: "center",
    borderRadius: radii.lg,
    height: 220,
    marginTop: spacing.lg,
    width: 160
  },
  photoBusyCard: {
    alignItems: "center",
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md
  },
  photoBusyText: {
    color: c.tealDark,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  photoHintCard: {
    backgroundColor: c.surfaceAlt,
    borderColor: c.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md
  },
  photoHintTitle: {
    color: c.ink,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "900"
  },
  photoHintCopy: {
    color: c.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6
  },
  sessionCard: {
    backgroundColor: c.navy,
    borderRadius: radii.lg,
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg
  },
  backendCard: {
    backgroundColor: c.gold + "18",
    borderColor: c.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md
  },
  hero: {
    ...shadows.card,
    backgroundColor: c.navy,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  eyebrow: {
    color: c.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  title: {
    color: "#FFFFFF",
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 39,
    marginTop: spacing.sm
  },
  subtitle: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm
  },
  permissionCard: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg
  },
  scannerCard: {
    backgroundColor: c.navy,
    borderRadius: radii.lg,
    height: 360,
    overflow: "hidden"
  },
  camera: {
    flex: 1
  },
  scanFrame: {
    borderColor: c.gold,
    borderRadius: radii.lg,
    borderWidth: 3,
    height: 132,
    left: "12%",
    position: "absolute",
    right: "12%",
    top: 112
  },
  manualIsbnCard: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md
  },
  cardTitle: {
    color: c.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    marginTop: spacing.sm
  },
  cardCopy: {
    color: c.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5
  },
  primaryButton: {
    backgroundColor: c.teal,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingVertical: 13
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  secondaryButton: {
    backgroundColor: c.gold,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingVertical: 13
  },
  secondaryButtonText: {
    color: c.ink,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  ghostButton: {
    borderColor: c.teal,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingVertical: 12
  },
  ghostButtonText: {
    color: c.tealDark,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  saveButton: {
    backgroundColor: c.navy,
    borderRadius: radii.pill,
    marginTop: spacing.lg,
    paddingVertical: 15
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center"
  },
  field: {
    marginBottom: spacing.md
  },
  fieldLabel: {
    color: c.tealDark,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 7,
    textTransform: "uppercase"
  },
  fieldHint: {
    color: c.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginBottom: 6
  },
  input: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: c.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "700",
    minHeight: 50,
    padding: spacing.md
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top"
  },
  searchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  searchInput: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: c.ink,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "700",
    padding: spacing.md
  },
  searchBtn: {
    alignItems: "center",
    backgroundColor: c.navy,
    borderRadius: radii.md,
    height: 50,
    justifyContent: "center",
    width: 50
  },
  searchModeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  searchModeChip: {
    alignItems: "center",
    backgroundColor: c.surfaceAlt,
    borderColor: c.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 9
  },
  searchModeChipActive: {
    backgroundColor: isDark ? darkInteractiveFill : c.navy,
    borderColor: isDark ? darkInteractiveBorder : c.navy
  },
  searchModeText: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  searchModeTextActive: {
    color: isDark ? darkInteractiveText : "#FFFFFF"
  },
  busyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    paddingVertical: spacing.xl
  },
  busyText: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800"
  },
  resultCount: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: spacing.sm,
    textAlign: "center"
  },
  loadMoreBtn: {
    alignItems: "center",
    backgroundColor: c.teal + "12",
    borderColor: c.teal + "44",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.sm,
    paddingVertical: 13
  },
  loadMoreText: {
    color: c.tealDark,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  resultsHint: {
    color: c.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    marginBottom: spacing.md,
    textAlign: "center"
  },
  languageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  languageChip: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  languageChipActive: {
    backgroundColor: c.tealDark,
    borderColor: c.tealDark
  },
  languageChipText: {
    color: c.ink,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800"
  },
  languageChipTextActive: {
    color: "#FFFFFF"
  }
  });
}
