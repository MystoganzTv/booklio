import { Ionicons } from "@expo/vector-icons";
import { CameraView, BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";
import { NewBookInput, ReadingFormat } from "../types/models";

type IntakeMode = "menu" | "isbn" | "manual" | "search" | "review";
type SearchMode = "general" | "author";
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

type OpenLibraryIsbnResponse = {
  title?: string;
  authors?: { key: string }[];
  covers?: number[];
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  subjects?: string[];
  description?: string | { value?: string };
  isbn_13?: string[];
  isbn_10?: string[];
};

type OpenLibrarySearchResponse = {
  numFound?: number;
  docs?: {
    title?: string;
    author_name?: string[];
    isbn?: string[];
    cover_i?: number;
    first_publish_year?: number;
    publisher?: string[];
    number_of_pages_median?: number;
    subject?: string[];
  }[];
};

const coverUrl = (coverId?: number) => (coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined);

const readDescription = (description?: string | { value?: string }) => {
  if (!description) return undefined;
  return typeof description === "string" ? description : description.value;
};

async function fetchAuthorName(authorKey?: string) {
  if (!authorKey) return undefined;
  try {
    const response = await fetch(`https://openlibrary.org${authorKey}.json`);
    const data = (await response.json()) as { name?: string };
    return data.name;
  } catch {
    return undefined;
  }
}

async function lookupByIsbn(isbn: string): Promise<NewBookInput | undefined> {
  const response = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
  if (!response.ok) return undefined;
  const data = (await response.json()) as OpenLibraryIsbnResponse;
  const authorName = await fetchAuthorName(data.authors?.[0]?.key);

  return {
    title: data.title ?? `ISBN Book ${isbn}`,
    authorName: authorName ?? "Author to identify",
    isbn: data.isbn_13?.[0] ?? data.isbn_10?.[0] ?? isbn,
    pages: data.number_of_pages,
    genre: data.subjects?.slice(0, 3) ?? ["Uncategorized"],
    publisher: data.publishers?.[0],
    publishedDate: data.publish_date,
    language: "English",
    synopsis: readDescription(data.description) ?? "Metadata imported from Open Library.",
    coverImageUri: coverUrl(data.covers?.[0]),
    source: "isbn",
    ownership: "owned"
  };
}

const OL_PAGE_SIZE = 50;

async function searchOpenLibrary(
  query: string,
  mode: SearchMode = "general",
  offset = 0
): Promise<{ results: NewBookInput[]; total: number }> {
  const fields = "title,author_name,isbn,cover_i,first_publish_year,publisher,number_of_pages_median,subject";
  // Author mode: no cap — paginate until done. General: single page of 25.
  const limit = mode === "author" ? OL_PAGE_SIZE : 25;
  const param = mode === "author"
    ? `author=${encodeURIComponent(query)}`
    : `q=${encodeURIComponent(query)}`;
  const response = await fetch(
    `https://openlibrary.org/search.json?${param}&limit=${limit}&offset=${offset}&fields=${fields}`
  );
  if (!response.ok) return { results: [], total: 0 };
  const data = (await response.json()) as OpenLibrarySearchResponse;
  const results = (data.docs ?? [])
    .filter((doc) => doc.title && doc.author_name?.[0])
    .map((doc) => ({
      title: doc.title ?? "Untitled Book",
      authorName: doc.author_name?.[0] ?? "Author to identify",
      isbn: doc.isbn?.[0],
      pages: doc.number_of_pages_median,
      genre: doc.subject?.slice(0, 3) ?? ["Uncategorized"],
      publisher: doc.publisher?.[0],
      publishedDate: doc.first_publish_year ? `${doc.first_publish_year}-01-01` : undefined,
      language: "English",
      synopsis: undefined,
      coverImageUri: coverUrl(doc.cover_i),
      source: "search" as const,
      ownership: "owned" as const
    }));
  return { results, total: data.numFound ?? results.length };
}

async function enrichFromIsbn(isbn: string, base: NewBookInput): Promise<NewBookInput> {
  try {
    const response = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
    if (!response.ok) return base;
    const data = (await response.json()) as OpenLibraryIsbnResponse;
    const authorName = await fetchAuthorName(data.authors?.[0]?.key);
    return {
      ...base,
      title: data.title ?? base.title,
      authorName: authorName ?? base.authorName,
      isbn: data.isbn_13?.[0] ?? data.isbn_10?.[0] ?? isbn,
      pages: data.number_of_pages ?? base.pages,
      genre: data.subjects?.slice(0, 4) ?? base.genre,
      publisher: data.publishers?.[0] ?? base.publisher,
      publishedDate: data.publish_date ?? base.publishedDate,
      synopsis: readDescription(data.description) ?? base.synopsis,
      coverImageUri: coverUrl(data.covers?.[0]) ?? base.coverImageUri
    };
  } catch {
    return base;
  }
}

export function BookIntakeScreen() {
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
  const [manual, setManual] = useState({
    title: "",
    authorName: "",
    isbn: "",
    pages: "",
    genre: "",
    publisher: ""
  });

  const stageBook = (input: NewBookInput) => {
    setReviewBook({
      ownership: "owned",
      wishlist: false,
      wantToBuy: false,
      format: "physical",
      language: "English",
      ...input
    });
    setMode("review");
  };

  const confirmAndOpen = (input: NewBookInput) => {
    const book = addBook(input);
    Alert.alert("Book added", `${book.title} is now in your library.`);
    navigation.navigate("BookDetail", { bookId: book.id });
  };

  const addFromIsbn = async (isbn: string) => {
    const clean = isbn.replace(/[^0-9X]/gi, "");
    setIsBusy(true);
    let found: NewBookInput | undefined;
    try {
      found = await lookupByIsbn(clean);
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
    });
  };

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsBusy(true);
    setSearchOffset(0);
    try {
      const { results, total } = await searchOpenLibrary(searchQuery.trim(), searchMode, 0);
      setSearchResults(results);
      setSearchTotal(total);
      if (!results.length) {
        Alert.alert("No results", "Couldn't find books in Open Library. Try a different title or author name.");
      }
    } catch {
      setSearchResults([]);
      setSearchTotal(0);
      Alert.alert("Connection issue", "Couldn't reach Open Library right now. Try again or use manual entry.");
    } finally {
      setIsBusy(false);
    }
  };

  const loadMoreResults = async () => {
    if (isLoadingMore) return;
    const nextOffset = searchOffset + OL_PAGE_SIZE;
    setIsLoadingMore(true);
    try {
      const { results } = await searchOpenLibrary(searchQuery.trim(), searchMode, nextOffset);
      setSearchResults((prev) => [...prev, ...results]);
      setSearchOffset(nextOffset);
    } catch {
      // silent — keep existing results
    } finally {
      setIsLoadingMore(false);
    }
  };

  const selectSearchResult = async (book: NewBookInput) => {
    if (book.isbn) {
      setIsBusy(true);
      try {
        const enriched = await enrichFromIsbn(book.isbn, book);
        stageBook(enriched);
      } catch {
        stageBook(book);
      } finally {
        setIsBusy(false);
      }
    } else {
      stageBook(book);
    }
  };

  const takeCoverPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    setCoverUri(uri);
    stageBook({
      ...mockIsbnCatalog["9780441172719"],
      coverImageUri: uri,
      source: "photo",
      synopsis: "Real example detected from a cover photo. In production, this flow would use OCR or vision to confirm title, author, and ISBN."
    });
  };

  const pickCoverPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    setCoverUri(uri);
    stageBook({
      ...mockIsbnCatalog["9780451524935"],
      coverImageUri: uri,
      source: "photo",
      synopsis: "Real example imported from an image. Later we can replace this with actual visual recognition."
    });
  };

  const handleBarcode = ({ data }: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    addFromIsbn(data);
  };

  const saveManual = () => {
    stageBook({
      title: manual.title || "New book",
      authorName: manual.authorName || "Author to identify",
      isbn: manual.isbn || undefined,
      pages: manual.pages ? Number(manual.pages) : undefined,
      genre: manual.genre ? manual.genre.split(",").map((item) => item.trim()).filter(Boolean) : ["Uncategorized"],
      publisher: manual.publisher || undefined,
      source: "manual"
    });
  };

  const updateReviewBook = (patch: Partial<NewBookInput>) => {
    setReviewBook((current) => (current ? { ...current, ...patch } : current));
  };

  const confirmReviewBook = () => {
    if (!reviewBook) return;
    confirmAndOpen({
      ...reviewBook,
      title: reviewBook.title.trim() || "Untitled Book",
      authorName: reviewBook.authorName.trim() || "Author to identify",
      genre: reviewBook.genre?.length ? reviewBook.genre : ["Uncategorized"],
      pages: reviewBook.pages && reviewBook.pages > 0 ? reviewBook.pages : 320
    });
  };

  if (mode === "review" && reviewBook) {
    return (
      <Screen>
        <View style={styles.reviewHeader}>
          {reviewBook.coverImageUri ? (
            <Image source={{ uri: reviewBook.coverImageUri }} style={styles.reviewCover} />
          ) : (
            <View style={styles.reviewCoverFallback}>
              <Ionicons name="book-outline" size={28} color={colors.gold} />
            </View>
          )}
        <View style={styles.reviewHeaderCopy}>
          <Text style={styles.pageEyebrow}>Review & edit</Text>
          <Text style={styles.reviewTitle} numberOfLines={3}>{reviewBook.title}</Text>
          <Text style={styles.reviewAuthor} numberOfLines={1}>{reviewBook.authorName}</Text>
          <View style={styles.reviewSourcePill}>
            <Ionicons name="sparkles-outline" size={14} color={colors.gold} />
            <Text style={styles.reviewSourceText}>{sourceLabel[reviewBook.source]}</Text>
          </View>
        </View>
      </View>

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
          onSelect={(language) => updateReviewBook({ language })}
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
          <Pressable style={styles.cancelButton} onPress={() => setMode("menu")}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.saveButton} onPress={confirmReviewBook}>
            <Text style={styles.saveButtonText}>Add book</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (mode === "isbn") {
    return (
      <Screen>
        <View style={styles.pageHeader}>
          <Text style={styles.pageEyebrow}>Scan ISBN</Text>
          <Text style={styles.pageTitle}>Point at the barcode.</Text>
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
            placeholderTextColor={colors.gray}
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
        <View style={styles.pageHeader}>
          <Text style={styles.pageEyebrow}>Manual entry</Text>
          <Text style={styles.pageTitle}>Add a book by hand.</Text>
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
        <View style={styles.pageHeader}>
          <Text style={styles.pageEyebrow}>Search</Text>
          <Text style={styles.pageTitle}>Find your book.</Text>
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
                color={searchMode === m ? colors.card : colors.muted}
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
            placeholderTextColor={colors.gray}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={runSearch}
            returnKeyType="search"
          />
          <Pressable style={[styles.searchBtn, isBusy && { opacity: 0.6 }]} onPress={runSearch} disabled={isBusy}>
            <Ionicons name={isBusy ? "hourglass-outline" : "search"} size={18} color={colors.card} />
          </Pressable>
        </View>

        {isBusy ? (
          <View style={styles.busyRow}>
            <Ionicons name="hourglass-outline" size={18} color={colors.muted} />
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
                  : <View style={styles.resultCoverFallback}><Ionicons name="book-outline" size={22} color={colors.card} /></View>}
                <View style={styles.resultCopy}>
                  <Text numberOfLines={2} style={styles.resultTitle}>{book.title}</Text>
                  <Text numberOfLines={1} style={styles.resultAuthor}>{book.authorName}</Text>
                  <Text numberOfLines={1} style={styles.resultMeta}>
                    {book.pages ? `${book.pages} pg` : ""}
                    {book.publisher ? ` · ${book.publisher}` : ""}
                    {book.publishedDate ? ` · ${String(book.publishedDate).slice(0, 4)}` : ""}
                  </Text>
                </View>
                <Ionicons name="add-circle" size={26} color={colors.teal} />
              </Pressable>
            ))}
            {searchResults.length > 0 && searchResults.length < searchTotal && (
              <Pressable
                style={[styles.loadMoreBtn, isLoadingMore && { opacity: 0.6 }]}
                onPress={loadMoreResults}
                disabled={isLoadingMore}
              >
                {isLoadingMore
                  ? <Ionicons name="hourglass-outline" size={15} color={colors.tealDark} />
                  : <Ionicons name="chevron-down-circle-outline" size={15} color={colors.tealDark} />
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
      <View style={styles.pageHeader}>
        <Text style={styles.pageEyebrow}>Add book</Text>
        <Text style={styles.pageTitle}>How do you want to add it?</Text>
      </View>

      <View style={styles.pathGrid}>
        <IntakePath
          accent={colors.teal}
          icon="camera"
          title="Take Photo"
          description="Photograph the cover to create an entry."
          onPress={takeCoverPhoto}
        />
        <IntakePath
          accent={colors.gold}
          icon="barcode"
          title="Scan ISBN"
          description="Scan the barcode to fill in metadata."
          onPress={() => setMode("isbn")}
        />
        <IntakePath
          accent={colors.coral}
          icon="search"
          title="Search"
          description="Search by title, author, or ISBN."
          onPress={() => setMode("search")}
        />
        <IntakePath
          accent={colors.navy}
          icon="image"
          title="Import Photo"
          description="Use an existing cover photo."
          onPress={pickCoverPhoto}
        />
        <IntakePath
          accent={colors.green}
          icon="create"
          title="Manual"
          description="No barcode? Enter the details yourself."
          onPress={() => setMode("manual")}
        />
      </View>

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
  return (
    <Pressable style={styles.pathCard} onPress={onPress}>
      <View style={[styles.pathIcon, { backgroundColor: accent }]}>
        <Ionicons color={colors.card} name={icon} size={24} />
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
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={colors.gray}
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function LanguagePicker({ selected, onSelect }: { selected: string; onSelect: (lang: string) => void }) {
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
              onPress={() => { onSelect(lang); setShowCustom(false); }}
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
          placeholderTextColor={colors.gray}
          style={[styles.input, { marginTop: spacing.sm }]}
          value={custom}
          onChangeText={(v) => { setCustom(v); onSelect(v); }}
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
  return (
    <Pressable style={[styles.choice, active && styles.choiceActive]} onPress={onPress}>
      <Ionicons name={icon} size={16} color={active ? colors.navy : colors.muted} />
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    marginBottom: spacing.md
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
  pathGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.lg
  },
  pathCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
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
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md
  },
  reviewCover: {
    backgroundColor: colors.cream,
    borderRadius: radii.md,
    height: 148,
    width: 98
  },
  reviewCoverFallback: {
    alignItems: "center",
    backgroundColor: colors.navy2,
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
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 30,
    marginTop: 4
  },
  reviewAuthor: {
    color: "#D8D2C8",
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
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  metadataStrip: {
    ...shadows.card,
    alignItems: "stretch",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  metadataItem: {
    flex: 1
  },
  metadataLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  metadataValue: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4
  },
  metadataDivider: {
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
    width: 1
  },
  reviewSectionTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: spacing.sm,
    marginTop: spacing.sm
  },
  reviewChoiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  choice: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  choiceActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  choiceText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  choiceTextActive: {
    color: colors.navy
  },
  reviewActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  cancelButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 15
  },
  cancelButtonText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
  },
  resultsWrap: {
    gap: spacing.md,
    marginTop: spacing.lg
  },
  resultCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  resultCover: {
    backgroundColor: colors.cream,
    borderRadius: radii.md,
    height: 104,
    width: 70
  },
  resultCoverFallback: {
    backgroundColor: colors.navy,
    borderRadius: radii.md,
    height: 104,
    width: 70
  },
  resultCopy: {
    flex: 1
  },
  resultTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26
  },
  resultAuthor: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 5
  },
  resultMeta: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginTop: 5
  },
  pathTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "900"
  },
  pathDescription: {
    color: colors.muted,
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
  sessionCard: {
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg
  },
  backendCard: {
    backgroundColor: "#FCF0D8",
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md
  },
  hero: {
    ...shadows.card,
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  title: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 39,
    marginTop: spacing.sm
  },
  subtitle: {
    color: "#F3E9D2",
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm
  },
  permissionCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg
  },
  scannerCard: {
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    height: 360,
    overflow: "hidden"
  },
  camera: {
    flex: 1
  },
  scanFrame: {
    borderColor: colors.gold,
    borderRadius: radii.lg,
    borderWidth: 3,
    height: 132,
    left: "12%",
    position: "absolute",
    right: "12%",
    top: 112
  },
  manualIsbnCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md
  },
  cardTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    marginTop: spacing.sm
  },
  cardCopy: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5
  },
  primaryButton: {
    backgroundColor: colors.teal,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingVertical: 13
  },
  primaryButtonText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  secondaryButton: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingVertical: 13
  },
  secondaryButtonText: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  ghostButton: {
    borderColor: colors.teal,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingVertical: 12
  },
  ghostButtonText: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  saveButton: {
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    marginTop: spacing.lg,
    paddingVertical: 15
  },
  saveButtonText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center"
  },
  field: {
    marginBottom: spacing.md
  },
  fieldLabel: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 7,
    textTransform: "uppercase"
  },
  fieldHint: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginBottom: 6
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
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
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "700",
    padding: spacing.md
  },
  searchBtn: {
    alignItems: "center",
    backgroundColor: colors.navy,
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
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 9
  },
  searchModeChipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  searchModeText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  searchModeTextActive: {
    color: colors.card
  },
  busyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    paddingVertical: spacing.xl
  },
  busyText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800"
  },
  resultCount: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: spacing.sm,
    textAlign: "center"
  },
  loadMoreBtn: {
    alignItems: "center",
    backgroundColor: colors.teal + "12",
    borderColor: colors.teal + "44",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.sm,
    paddingVertical: 13
  },
  loadMoreText: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  resultsHint: {
    color: colors.muted,
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
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  languageChipActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark
  },
  languageChipText: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800"
  },
  languageChipTextActive: {
    color: colors.card
  }
});
