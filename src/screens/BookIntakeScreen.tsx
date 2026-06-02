import { Ionicons } from "@expo/vector-icons";
import { CameraView, BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BooklizDialog } from "../components/BooklizDialog";
import { Screen } from "../components/Screen";
import { useBookliz } from "../data/BooklizContext";
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
import {
  BookMatch,
  bookMatchToNewBookInput,
} from "../services/bookLookupService";
import {
  lookupByIsbn as aggregatorLookupByIsbn,
  lookupByQuery as aggregatorLookupByQuery,
  workEditionToNewBookInput,
  detectQueryIntent,
} from "../services/bookMetadataAggregator";
import { BookEdition, BookWork, WorkLookupResult } from "../types/bookMetadata";
import { BookEditionsSheet } from "../components/BookEditionsSheet";
import { parseIsbn, formatIsbn13 } from "../utils/isbnUtils";

type IntakeMode = "menu" | "isbn" | "manual" | "search" | "matches" | "review";
type IconName = keyof typeof Ionicons.glyphMap;

const booklizLogo = require("../../assets/brand/bookliz-logo.png");

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

// ─── Discover data ───────────────────────────────────────────────────────────

const DISCOVER_GENRES: { label: string; icon: IconName; color: string; query: string }[] = [
  { label: "Fantasy",         icon: "sparkles-outline",     color: "#14B8A6", query: "fantasy novels" },
  { label: "Science Fiction", icon: "planet-outline",        color: "#6366F1", query: "science fiction" },
  { label: "Mystery",         icon: "search-outline",        color: "#F59E0B", query: "mystery thriller" },
  { label: "Romance",         icon: "heart-outline",         color: "#EC4899", query: "romance novels" },
  { label: "Historical",      icon: "time-outline",          color: "#8B5CF6", query: "historical fiction" },
  { label: "Horror",          icon: "moon-outline",          color: "#EF4444", query: "horror books" },
  { label: "Nonfiction",      icon: "newspaper-outline",     color: "#10B981", query: "nonfiction bestsellers" },
  { label: "Biography",       icon: "person-outline",        color: "#F97316", query: "biography memoir" },
  { label: "Thriller",        icon: "warning-outline",       color: "#DC2626", query: "psychological thriller" },
  { label: "Self-Help",       icon: "trending-up-outline",   color: "#0EA5E9", query: "self improvement" },
  { label: "Adventure",       icon: "compass-outline",       color: "#06B6D4", query: "adventure novels" },
  { label: "Crime",           icon: "shield-outline",        color: "#64748B", query: "crime fiction" },
];

const DISCOVER_SUGGESTIONS = [
  "Epic fantasy sagas",
  "Cozy mysteries",
  "Historical thrillers",
  "Sci-fi classics",
  "Feel-good romance",
  "True crime",
  "Award-winning novels",
  "Dark academia",
  "Coming of age",
  "Psychological thrillers",
];

const DISCOVER_MOODS = [
  "Exciting", "Heartfelt", "Thought-provoking",
  "Funny", "Scary", "Inspiring", "Feel-good", "Gripping",
];

const DISCOVER_SERIES = [
  "Harry Potter", "Lord of the Rings", "Dune Saga",
  "A Court of Thorns and Roses", "The Witcher", "Mistborn",
  "Percy Jackson", "Stormlight Archive", "Sherlock Holmes", "Jack Reacher",
];

// ─── Animated scan line ───────────────────────────────────────────────────────

function ScanLine() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: "#14B8A6",
        opacity: 0.85,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 100],
            }),
          },
        ],
      }}
    />
  );
}

export function BookIntakeScreen() {
  const c = useColors();
  const { isDark } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { addBook } = useBookliz();
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
  const [torchOn, setTorchOn] = useState(false);
  const [scanZoom, setScanZoom] = useState<0 | 0.05 | 0.12>(0);
  // "camera" = show viewfinder; "manual" = hide camera, show keyboard-friendly input
  const [isbnInputMode, setIsbnInputMode] = useState<"camera" | "manual">("camera");
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  // Book lookup / match confirmation
  const [matches, setMatches] = useState<BookMatch[]>([]);
  const [matchLookupLabel, setMatchLookupLabel] = useState("");
  const [matchReturnMode, setMatchReturnMode] = useState<"menu" | "isbn" | "search">("menu");
  // True when the last search was an author query — adapts result headings and badges.
  const isAuthorQuery = useMemo(
    () => detectQueryIntent(matchLookupLabel) === "author",
    [matchLookupLabel]
  );
  // Book Intelligence Engine — work result + editions sheet
  const [lookupResult, setLookupResult] = useState<WorkLookupResult | null>(null);
  const [isEditionsSheetVisible, setIsEditionsSheetVisible] = useState(false);
  const [isLoadingEditions, setIsLoadingEditions] = useState(false);
  // Debounce: prevents re-processing the same barcode within 2 s
  const lastScanRef = useRef<number>(0);
  const [manual, setManual] = useState({
    title: "",
    authorName: "",
    isbn: "",
    pages: "",
    genre: "",
    publisher: ""
  });

  // Reset everything when the user navigates away mid-flow (taps another tab, etc.)
  // so that returning to the Add tab always shows the main menu, never a stuck mode.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setMode("menu");
        setScanned(false);
        setCoverUri(undefined);
        setIsBusy(false);
        setIsLoadingMore(false);
        setSearchQuery("");
        setSearchResults([]);
        setSearchTotal(0);
        setSearchOffset(0);
        setReviewBook(null);
        setReviewInsight(null);
        setIsAnalyzingPhoto(false);
        setIsSubmittingReview(false);
        setTorchOn(false);
        setScanZoom(0);
        setIsbnInputMode("camera");
        setScanFeedback(null);
        setMatches([]);
        setMatchLookupLabel("");
        setLookupResult(null);
        setIsEditionsSheetVisible(false);
        setIsLoadingEditions(false);
        setManual({ title: "", authorName: "", isbn: "", pages: "", genre: "", publisher: "" });
      };
    }, [])
  );

  const photoSupport = getBookPhotoSupportSummary();
  const dialogNode = (
    <BooklizDialog
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
            index: 1, // Library tab (0=Home, 1=Library, 2=Add, 3=Discover, 4=Profile)
            routes: [
              { name: "Home" },
              { name: "Library" },
              { name: "Add" },
              { name: "Discover" },
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
    }, found ? "Bookliz matched this ISBN with live metadata." : "Bookliz captured the ISBN. Review and complete any missing details.");
  };

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    await lookupAndShowMatches(searchQuery.trim(), "search", "query");
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

  /**
   * Fetch matches via the Book Intelligence Engine and navigate to the "matches" mode.
   * Stores the full WorkLookupResult in `lookupResult` and also populates the legacy
   * `matches` array (BookMatch[]) so the existing MatchCard UI keeps working.
   */
  const lookupAndShowMatches = async (
    query: string,
    returnMode: "menu" | "isbn" | "search",
    type: "isbn" | "query" = "query"
  ) => {
    setMatches([]);
    setLookupResult(null);
    setMatchLookupLabel(query);
    setMatchReturnMode(returnMode);
    setMode("matches");
    setScanFeedback(null); // clear scanner badge when moving to results
    setIsBusy(true);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 15_000)
    );

    try {
      const result = await Promise.race([
        type === "isbn"
          ? aggregatorLookupByIsbn(query)
          : aggregatorLookupByQuery(query),
        timeout
      ]);
      setLookupResult(result);
      // One match card per unique BookWork (different books), using each
      // work's own author, title, and best edition — not flatEditions which
      // mixes all editions from all books with the wrong author.
      const isAuthor = detectQueryIntent(query) === "author";
      const works = result.works.length ? result.works : result.work ? [result.work] : [];
      // For author queries show ALL results (full catalog); for title queries cap at 8.
      const sliced = isAuthor ? works : works.slice(0, 8);
      const legacyMatches: BookMatch[] = sliced
        .map((work) => {
          const best = work.bestEdition ?? work.editions[0];
          return {
            id: work.workKey ?? best?.id ?? work.title,
            title: work.title,
            subtitle: work.subtitle,
            authors: work.authors,                    // ← correct per-work author
            isbn13: best?.isbn13,
            isbn10: best?.isbn10,
            coverUrl: best?.coverUrl,
            description: work.description,
            genres: work.genres ?? [],
            pageCount: best?.pageCount,
            publisher: best?.publisher,
            publishedDate: best?.publishedDate,
            language: best?.language,
            source: best?.source ?? "google-books",
            sourceId: best?.editionKey ?? best?.googleBooksId,
            workKey: work.workKey,
            editionKey: best?.editionKey,
            score: work.score,
            confidence: work.score >= 90 ? "high" : work.score >= 70 ? "medium" : "low",
          };
        });
      setMatches(legacyMatches);
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === "timeout";
      openDialog(
        isTimeout ? "Búsqueda tardó demasiado" : "Sin conexión",
        isTimeout
          ? "Las bases de datos no respondieron a tiempo. Intenta de nuevo."
          : Platform.OS === "web"
          ? "Couldn't reach book databases. In the web demo, start `npm run metadata-proxy` or try again."
          : "No pudimos conectar con las bases de libros. Revisa tu conexión."
      );
    } finally {
      setIsBusy(false);
      setScanFeedback(null); // always clear on finish
    }
  };

  /**
   * Stage the chosen BookMatch for review.
   */
  const selectMatch = (match: BookMatch) => {
    // When the user manually picks a result from the match list they have already
    // made an informed choice — a scary "low-confidence" warning is misleading.
    // Use a neutral prompt instead. The confidence system only makes sense for
    // fully automatic ISBN lookups with no human review step.
    const insight = "Verify details before adding.";
    void stageBook(
      bookMatchToNewBookInput(match, "isbn"),
      insight
    );
  };

  /**
   * ISBN barcode handler — debounced (2 s), validates before lookup.
   */
  const handleBarcode = ({ data }: BarcodeScanningResult) => {
    const now = Date.now();
    if (now - lastScanRef.current < 2000) return; // debounce

    const parsed = parseIsbn(data);
    if (!parsed) return; // not a valid book ISBN — ignore

    lastScanRef.current = now;
    void lookupAndShowMatches(parsed.isbn13, "isbn", "isbn");
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
        openDialog("No changes found", "Bookliz couldn't find any additional details for this draft.");
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
        setReviewInsight(`Language changed to ${language}. Bookliz could not find a matching edition, so ISBN and publisher were kept from the current version.`);
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
      setReviewInsight(`Language changed to ${language}. Bookliz could not refresh the edition metadata right now.`);
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

    // On iOS without a configured vision provider, static-image barcode detection
    // doesn't work (Apple OS limitation) and AI cover recognition is unavailable.
    // Skip the misleading spinner and go directly to the review screen with the
    // photo saved as the cover art.
    if (!photoSupport.imageBarcodeIsbnSupported && !photoSupport.visionProviderConfigured) {
      await stageBook({
        title: "",
        authorName: "",
        genre: ["Uncategorized"],
        language: "English",
        coverImageUri: uri,
        source: "photo",
        ownership: "owned"
      }, "Photo saved as cover art. Type the title (and ISBN if you have it) then tap “Refresh metadata” to fill in the rest automatically.");
      return;
    }

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
        synopsis: "Bookliz saved your photo, but detection failed this time. Review the draft and refresh metadata once you add a title or ISBN.",
        coverImageUri: uri,
        source: "photo",
        ownership: "owned"
      }, "Bookliz could not inspect that image right now, but your photo is attached and ready for review.");
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
          {reviewBook?.source === "isbn" ? (
            <Pressable style={styles.scanAgainBtn} onPress={() => { setScanned(false); setMode("isbn"); }}>
              <Ionicons name="barcode-outline" size={16} color={c.tealDark} />
              <Text style={styles.scanAgainText}>Wrong book? Scan again</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.secondaryReviewButton} onPress={() => setMode("menu")}>
            <Ionicons name="close-outline" size={18} color={c.muted} />
            <Text style={styles.secondaryReviewButtonText}>Cancel this draft</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (mode === "matches") {
    const primaryMatch = matches[0];
    const otherMatches = matches.slice(1, 7);
    const backLabel =
      matchReturnMode === "isbn" ? "Scanner" :
      matchReturnMode === "search" ? "Search" : "All options";

    return (
      <Screen>
        {dialogNode}
        <Pressable style={styles.backButton} onPress={() => {
          if (matchReturnMode === "isbn") setScanned(false);
          setMode(matchReturnMode);
        }}>
          <Ionicons name="chevron-back" size={20} color={c.tealDark} />
          <Text style={styles.backButtonText}>{backLabel}</Text>
        </Pressable>

        <View style={styles.pageHeader}>
          {/* Editable query — tap to refine and re-search without going back */}
          <View style={styles.inlineSearchRow}>
            <TextInput
              style={styles.inlineSearchInput}
              value={matchLookupLabel}
              onChangeText={setMatchLookupLabel}
              returnKeyType="search"
              onSubmitEditing={() => {
                if (matchLookupLabel.trim()) {
                  void lookupAndShowMatches(matchLookupLabel.trim(), matchReturnMode, "query");
                }
              }}
              placeholderTextColor={c.muted}
              placeholder="Search again…"
              selectTextOnFocus
            />
            {isBusy ? (
              <ActivityIndicator size="small" color={c.teal} style={{ marginRight: 4 }} />
            ) : (
              <Pressable
                onPress={() => {
                  if (matchLookupLabel.trim()) {
                    void lookupAndShowMatches(matchLookupLabel.trim(), matchReturnMode, "query");
                  }
                }}
                style={styles.inlineSearchBtn}
              >
                <Ionicons name="search" size={16} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Scan again shortcut — only when result came from ISBN scanner */}
        {matchReturnMode === "isbn" && !isBusy && matches.length > 0 ? (
          <Pressable
            style={styles.scanAgainBtn}
            onPress={() => { setScanned(false); setMode("isbn"); }}
          >
            <Ionicons name="barcode-outline" size={16} color={c.tealDark} />
            <Text style={styles.scanAgainText}>Wrong book? Scan again</Text>
          </Pressable>
        ) : null}

        {isBusy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator size="small" color={c.tealDark} />
            <Text style={styles.busyText}>Checking Google Books & Open Library…</Text>
          </View>
        ) : matches.length === 0 ? (
          <View style={styles.noMatchCard}>
            {/* Decorative rings + icon — badge anchored to this container */}
            <View style={styles.noMatchIconWrap}>
              <View style={styles.noMatchRingOuter}>
                <View style={styles.noMatchRingInner}>
                  <Image
                    source={require("../../assets/brand/bookliz-icon.png")}
                    style={styles.noMatchIcon}
                    resizeMode="contain"
                  />
                </View>
              </View>
              <View style={styles.noMatchBadge}>
                <Ionicons name="search-outline" size={13} color="#fff" />
              </View>
            </View>

            <Text style={styles.noMatchTitle}>Sin resultados</Text>
            <Text style={styles.noMatchSub}>
              {matchLookupLabel
                ? `No encontramos "${matchLookupLabel}" en nuestras fuentes`
                : "Prueba con un título, autor diferente, o agrégalo manualmente"}
            </Text>
            <Pressable
              style={[styles.primaryButton, { alignSelf: "stretch", marginTop: spacing.sm }]}
              onPress={() => {
                setMatches([]);
                setMatchLookupLabel("");
                setLookupResult(null);
                if (matchReturnMode === "isbn") {
                  setIsbnInputMode("camera");
                  setScanned(false);
                  setMode("isbn");
                } else {
                  setMode("search");
                }
              }}
            >
              <Text style={styles.primaryButtonText}>Buscar de nuevo</Text>
            </Pressable>
            <Pressable style={[styles.ghostButton, { alignSelf: "stretch" }]} onPress={() => setMode("manual")}>
              <Text style={styles.ghostButtonText}>Agregar manualmente</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Author query: "Books by [Name]" heading; title query: count + confidence label */}
            {isAuthorQuery ? (
              <Text style={styles.reviewSectionTitle}>
                {`Books by ${matchLookupLabel}`}
              </Text>
            ) : (
              <Text style={styles.matchCount}>
                {matches.length === 1 ? "1 result" : `${matches.length} results`}
                {" · sorted by confidence"}
              </Text>
            )}

            {/* Primary (top) result */}
            {primaryMatch ? (
              <MatchCard
                match={primaryMatch}
                isPrimary
                hideConfidence={isAuthorQuery}
                onSelect={() => selectMatch(primaryMatch)}
              />
            ) : null}

            {/* Secondary results */}
            {otherMatches.length > 0 ? (
              <>
                {!isAuthorQuery && (
                  <Text style={styles.reviewSectionTitle}>Other editions</Text>
                )}
                {otherMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    hideConfidence={isAuthorQuery}
                    onSelect={() => selectMatch(match)}
                  />
                ))}
              </>
            ) : null}

            {/* View all editions — shown when the Intelligence Engine found a work */}
            {lookupResult?.work ? (
              <Pressable
                style={styles.viewEditionsBtn}
                onPress={() => setIsEditionsSheetVisible(true)}
              >
                <Ionicons name="layers-outline" size={15} color={c.tealDark} />
                <Text style={styles.viewEditionsBtnText}>
                  View all editions
                  {(lookupResult.work?.editions?.length ?? 0) > 0
                    ? ` (${lookupResult.work!.editions.length})`
                    : ""}
                </Text>
              </Pressable>
            ) : null}

            <Pressable style={styles.editManuallyBtn} onPress={() => setMode("manual")}>
              <Ionicons name="create-outline" size={15} color={c.muted} />
              <Text style={styles.editManuallyText}>Not what you're looking for? Edit manually</Text>
            </Pressable>
          </>
        )}

        <BookEditionsSheet
          visible={isEditionsSheetVisible}
          work={lookupResult?.work ?? null}
          isLoadingEditions={isLoadingEditions}
          onSelectEdition={(edition) => {
            setIsEditionsSheetVisible(false);
            if (lookupResult?.work) {
              const input = workEditionToNewBookInput(
                lookupResult.work,
                edition,
                edition.isbn13 ? "isbn" : "search"
              );
              void stageBook(
                input,
                `Edition confirmed: ${edition.language ?? ""}${edition.publisher ? ` · ${edition.publisher}` : ""}.`
              );
            }
          }}
          onAddManually={() => {
            setIsEditionsSheetVisible(false);
            setMode("manual");
          }}
          onClose={() => setIsEditionsSheetVisible(false)}
        />
      </Screen>
    );
  }

  if (mode === "isbn") {
    // ── Manual ISBN input (no camera) ──────────────────────────────────────
    if (isbnInputMode === "manual") {
      return (
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: c.bg }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Screen>
            {dialogNode}
            <Pressable style={styles.backButton} onPress={() => setIsbnInputMode("camera")}>
              <Ionicons name="chevron-back" size={20} color={c.tealDark} />
              <Text style={styles.backButtonText}>Scanner</Text>
            </Pressable>
            <View style={styles.pageHeader}>
              <Text style={styles.pageEyebrow}>Enter ISBN</Text>
              <Text style={styles.pageTitle}>Type or paste ISBN</Text>
            </View>
            <Text style={[styles.cardCopy, { marginBottom: spacing.md }]}>
              Find it on the back cover, above the barcode — 13 digits starting with 978 or 979.
            </Text>
            <TextInput
              autoFocus
              keyboardType="number-pad"
              placeholder="9780756404741"
              placeholderTextColor={c.gray}
              style={[styles.input, { fontSize: 20, letterSpacing: 2, textAlign: "center", paddingVertical: 18 }]}
              value={manual.isbn}
              maxLength={13}
              onChangeText={(raw) => {
                // Strip everything except digits (and X for ISBN-10 check digit)
                const clean = raw.replace(/[^0-9X]/gi, "").slice(0, 13);
                setManual((current) => ({ ...current, isbn: clean }));
              }}
              returnKeyType="done"
            />
            {/* Live validation hint */}
            {manual.isbn.length > 0 && manual.isbn.length !== 10 && manual.isbn.length !== 13 ? (
              <Text style={styles.isbnHint}>
                {manual.isbn.length}/13 — ISBN must be 10 or 13 digits
              </Text>
            ) : manual.isbn.length === 10 || manual.isbn.length === 13 ? (
              <Text style={[styles.isbnHint, { color: c.tealDark }]}>
                ✓ Valid ISBN length
              </Text>
            ) : null}
            <Pressable
              style={[styles.primaryButton, { marginTop: spacing.sm }]}
              onPress={() => { if (manual.isbn.length === 10 || manual.isbn.length === 13) void lookupAndShowMatches(manual.isbn, "isbn", "isbn"); }}
              disabled={isBusy || (manual.isbn.length !== 10 && manual.isbn.length !== 13)}
            >
              {isBusy
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.primaryButtonText}>Search by ISBN</Text>
              }
            </Pressable>
          </Screen>
        </KeyboardAvoidingView>
      );
    }

    // ── Camera scanner ─────────────────────────────────────────────────────
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {dialogNode}

        {/* Back button overlay */}
        <Pressable
          style={styles.scannerBackBtn}
          onPress={() => { setScanned(false); setMode("menu"); }}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
          <Text style={styles.scannerBackText}>Back</Text>
        </Pressable>

        {!permission?.granted ? (
          <View style={[styles.permissionCard, { margin: spacing.md, marginTop: 80 }]}>
            <Text style={styles.cardTitle}>Camera access needed</Text>
            <Text style={styles.cardCopy}>Allow camera access to scan ISBN barcodes.</Text>
            <Pressable style={styles.primaryButton} onPress={requestPermission}>
              <Text style={styles.primaryButtonText}>Allow camera</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            autofocus="on"
            enableTorch={torchOn}
            zoom={scanZoom}
            onBarcodeScanned={scanned ? undefined : (result) => {
              setScanned(true); // lock immediately — prevents re-fire while lookup runs
              setScanFeedback("Barcode found — searching…");
              handleBarcode(result);
            }}
            barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "isbn13", "qr"] }}
          />
        )}

        {/* Scan frame */}
        {permission?.granted && (
          <View style={styles.scanOverlay}>
            {/* Top darken */}
            <View style={styles.scanDim} />
            {/* Middle row: dim | frame | dim */}
            <View style={styles.scanMiddleRow}>
              <View style={styles.scanDim} />
              <View style={styles.scanFrameBox}>
                {/* Corner marks */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                {/* Animated scan line */}
                <ScanLine />
              </View>
              <View style={styles.scanDim} />
            </View>
            {/* Bottom darken */}
            <View style={styles.scanDim} />
          </View>
        )}

        {/* Feedback label */}
        {scanFeedback ? (
          <View style={styles.scanFeedbackBadge}>
            <ActivityIndicator size="small" color={c.teal} />
            <Text style={styles.scanFeedbackText}>{scanFeedback}</Text>
          </View>
        ) : (
          <View style={styles.scanHintBadge}>
            <Text style={styles.scanHintText}>Point at the barcode on the back cover</Text>
          </View>
        )}

        {/* Controls: torch + zoom + manual */}
        {permission?.granted && (
          <View style={styles.scanControls}>
            <Pressable style={styles.scanControlBtn} onPress={() => setTorchOn((v) => !v)}>
              <Ionicons
                name={torchOn ? "flashlight" : "flashlight-outline"}
                size={22}
                color={torchOn ? c.gold : "#FFFFFF"}
              />
            </Pressable>
            <View style={styles.zoomRow}>
              {([0, 0.05, 0.12] as const).map((z, i) => (
                <Pressable
                  key={z}
                  style={[styles.zoomBtn, scanZoom === z && styles.zoomBtnActive]}
                  onPress={() => setScanZoom(z)}
                >
                  <Text style={[styles.zoomBtnText, scanZoom === z && styles.zoomBtnTextActive]}>
                    {i + 1}×
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.scanControlBtn} onPress={() => setIsbnInputMode("manual")}>
              <Ionicons name="keypad-outline" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  if (mode === "manual") {
    return (
      <Screen>
        {dialogNode}
        <Pressable style={styles.backButton} onPress={() => setMode("menu")}>
          <Ionicons name="chevron-back" size={20} color={c.tealDark} />
          <Text style={styles.backButtonText}>All options</Text>
        </Pressable>
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
    const hasQuery = searchQuery.trim().length > 0;
    return (
      <Screen>
        {dialogNode}
        <Pressable style={styles.backButton} onPress={() => setMode("menu")}>
          <Ionicons name="chevron-back" size={20} color={c.tealDark} />
          <Text style={styles.backButtonText}>All options</Text>
        </Pressable>

        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Find your next read</Text>
        </View>

        {/* Search bar — auto-detects title vs author name */}
        <View style={styles.searchRow}>
          <TextInput
            autoFocus={hasQuery}
            placeholder="Dan Brown, Dune, J.K. Rowling…"
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

        {/* Discover content — hidden when user is actively typing */}
        {!hasQuery ? (
          <>
            {/* ── Try searching for ── */}
            <Text style={styles.discoverSectionTitle}>✨  Try searching for</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowContent}>
              {DISCOVER_SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  style={styles.suggestionChip}
                  onPress={() => void lookupAndShowMatches(s, "search", "query")}
                >
                  <Text style={styles.suggestionChipText}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* ── Browse by genre ── */}
            <Text style={styles.discoverSectionTitle}>📚  Browse by genre</Text>
            <View style={styles.genreGrid}>
              {DISCOVER_GENRES.map((g) => (
                <Pressable
                  key={g.label}
                  style={styles.genreItem}
                  onPress={() => void lookupAndShowMatches(g.query, "search", "query")}
                >
                  <View style={[styles.genreIconCircle, { backgroundColor: g.color + "22" }]}>
                    <Ionicons name={g.icon} size={19} color={g.color} />
                  </View>
                  <Text style={styles.genreLabel} numberOfLines={1}>{g.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* ── Browse by mood ── */}
            <Text style={styles.discoverSectionTitle}>🎭  Browse by mood</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowContent}>
              {DISCOVER_MOODS.map((m) => (
                <Pressable
                  key={m}
                  style={styles.moodChip}
                  onPress={() => void lookupAndShowMatches(`${m.toLowerCase()} books`, "search", "query")}
                >
                  <Text style={styles.moodChipText}>{m}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* ── Popular series ── */}
            <Text style={styles.discoverSectionTitle}>📖  Popular series</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRowContent, { paddingBottom: spacing.xl }]}>
              {DISCOVER_SERIES.map((s) => (
                <Pressable
                  key={s}
                  style={styles.seriesChip}
                  onPress={() => void lookupAndShowMatches(s, "search", "query")}
                >
                  <Ionicons name="book-outline" size={13} color={c.gold} />
                  <Text style={styles.seriesChipText}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : (
          <Text style={styles.resultsHint}>
            Booklio detects author names automatically. Tap Search or press return.
          </Text>
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

// ─── MatchCard ────────────────────────────────────────────────────────────────

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "#22C55E",
  medium: "#F59E0B",
  low: "#94A3B8",
};

const SOURCE_LABELS: Record<string, string> = {
  "google-books": "Google Books",
  "open-library": "Open Library",
};

function MatchCard({
  match,
  onSelect,
  isPrimary = false,
  hideConfidence = false,
}: {
  match: BookMatch;
  onSelect: () => void;
  isPrimary?: boolean;
  /** When true, suppresses the confidence dot/badge (e.g. for author queries). */
  hideConfidence?: boolean;
}) {
  const c = useColors();
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const confidenceColor = CONFIDENCE_COLORS[match.confidence] ?? CONFIDENCE_COLORS.low;
  const year = match.publishedDate ? match.publishedDate.slice(0, 4) : null;
  const isbnDisplay = match.isbn13
    ? formatIsbn13(match.isbn13)
    : match.isbn10 ?? null;

  return (
    <View style={[styles.matchCard, isPrimary && styles.matchCardPrimary]}>
      {/* Cover */}
      <View style={styles.matchCoverWrap}>
        {match.coverUrl ? (
          <Image source={{ uri: match.coverUrl }} style={styles.matchCover} />
        ) : (
          <View style={styles.matchCoverFallback}>
            <Ionicons name="book-outline" size={24} color="rgba(255,255,255,0.6)" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.matchInfo}>
        {/* Badges */}
        <View style={styles.matchBadgeRow}>
          {!hideConfidence ? (
            <View style={[styles.matchConfidenceBadge, { backgroundColor: confidenceColor + "22", borderColor: confidenceColor + "55" }]}>
              <View style={[styles.matchConfidenceDot, { backgroundColor: confidenceColor }]} />
              <Text style={[styles.matchConfidenceText, { color: confidenceColor }]}>
                {match.confidence.toUpperCase()}
              </Text>
            </View>
          ) : null}
          <View style={styles.matchSourceBadge}>
            <Text style={styles.matchSourceText}>
              {SOURCE_LABELS[match.source] ?? match.source}
            </Text>
          </View>
        </View>

        {/* Title & author */}
        <Text style={styles.matchTitle} numberOfLines={2}>{match.title}</Text>
        {match.subtitle ? (
          <Text style={styles.matchSubtitle} numberOfLines={1}>{match.subtitle}</Text>
        ) : null}
        <Text style={styles.matchAuthor} numberOfLines={1}>
          {match.authors.join(", ") || "Unknown author"}
        </Text>

        {/* Metadata row */}
        <Text style={styles.matchMeta} numberOfLines={2}>
          {[
            match.language,
            match.publisher,
            year,
            match.pageCount ? `${match.pageCount} pp` : null,
          ].filter(Boolean).join(" · ")}
        </Text>

        {isbnDisplay ? (
          <Text style={styles.matchIsbn}>ISBN {isbnDisplay}</Text>
        ) : null}

        {/* CTA */}
        <Pressable style={[styles.matchSelectBtn, isPrimary && styles.matchSelectBtnPrimary]} onPress={onSelect}>
          <Ionicons
            name="library-outline"
            size={14}
            color={isPrimary ? "#FFFFFF" : c.tealDark}
          />
          <Text style={[styles.matchSelectText, isPrimary && styles.matchSelectTextPrimary]}>
            {isPrimary ? "Add this edition" : "Select"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
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
  inlineSearchRow: {
    alignItems: "center",
    backgroundColor: c.surfaceAlt,
    borderColor: c.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  inlineSearchInput: {
    color: c.ink,
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "900",
    paddingHorizontal: spacing.sm,
    paddingVertical: 8
  },
  inlineSearchBtn: {
    alignItems: "center",
    backgroundColor: c.teal,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    width: 34
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
  // ── Full-screen scanner overlay ────────────────────────────────────────
  scannerBackBtn: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    left: spacing.md,
    position: "absolute",
    top: 60,
    zIndex: 20,
  },
  scannerBackText: {
    color: "#fff",
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: "900",
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  scanDim: {
    backgroundColor: "rgba(0,0,0,0.55)",
    flex: 1,
  },
  scanMiddleRow: {
    flexDirection: "row",
    height: 120,
  },
  scanFrameBox: {
    borderColor: "rgba(255,255,255,0.0)",
    overflow: "hidden",
    width: 280,
  },
  corner: {
    borderColor: "#14B8A6",
    height: 24,
    position: "absolute",
    width: 24,
  },
  cornerTL: { borderLeftWidth: 3, borderTopWidth: 3, left: 0, top: 0 },
  cornerTR: { borderRightWidth: 3, borderTopWidth: 3, right: 0, top: 0 },
  cornerBL: { borderBottomWidth: 3, borderLeftWidth: 3, bottom: 0, left: 0 },
  cornerBR: { borderBottomWidth: 3, borderRightWidth: 3, bottom: 0, right: 0 },
  scanHintBadge: {
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: radii.pill,
    bottom: 130,
    paddingHorizontal: 18,
    paddingVertical: 9,
    position: "absolute",
    zIndex: 20,
  },
  scanHintText: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "700",
  },
  scanFeedbackBadge: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    borderColor: "rgba(20,184,166,0.4)",
    borderRadius: radii.pill,
    borderWidth: 1,
    bottom: 130,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
    position: "absolute",
    zIndex: 20,
  },
  scanFeedbackText: {
    color: "#14B8A6",
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
  },
  scanControls: {
    alignItems: "center",
    bottom: 56,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 20,
  },
  scanControlBtn: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 24,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  zoomRow: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  zoomBtn: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 40,
  },
  zoomBtnActive: {
    backgroundColor: c.gold,
  },
  zoomBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
  },
  zoomBtnTextActive: {
    color: c.navy,
  },
  // Legacy — no longer used but kept to avoid TS errors if referenced
  scannerCard: { backgroundColor: c.navy, borderRadius: radii.lg, height: 360, overflow: "hidden" },
  camera: { flex: 1 },
  scanFrame: { borderColor: c.gold, borderRadius: radii.lg, borderWidth: 3, height: 132, left: "8%", position: "absolute", right: "8%", top: 112 },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 2,
    marginBottom: spacing.sm
  },
  backButtonText: {
    color: c.tealDark,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900"
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
  },
  // ── Match confirmation ──
  matchCount: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: spacing.md,
    textAlign: "center"
  },
  noMatchCard: {
    alignItems: "center",
    backgroundColor: c.surfaceAlt,
    borderColor: c.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg
  },
  noMatchIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs
  },
  noMatchRingOuter: {
    alignItems: "center",
    backgroundColor: c.navy + "14",
    borderColor: c.teal + "30",
    borderRadius: 64,
    borderWidth: 1.5,
    height: 128,
    justifyContent: "center",
    width: 128
  },
  noMatchRingInner: {
    alignItems: "center",
    backgroundColor: c.navy,
    borderRadius: 48,
    height: 96,
    justifyContent: "center",
    width: 96
  },
  noMatchIcon: {
    height: 56,
    opacity: 0.6,
    width: 56
  },
  noMatchBadge: {
    alignItems: "center",
    backgroundColor: c.coral,
    borderColor: c.surfaceAlt,
    borderRadius: 14,
    borderWidth: 2.5,
    bottom: 4,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 4,
    width: 28
  },
  noMatchTitle: {
    color: c.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center"
  },
  noMatchSub: {
    color: c.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.xs,
    textAlign: "center"
  },
  isbnHint: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.xs,
    textAlign: "center"
  },
  matchCard: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  matchCardPrimary: {
    ...shadows.card,
    borderColor: c.teal + "55",
    borderWidth: 2
  },
  matchCoverWrap: {
    flexShrink: 0
  },
  matchCover: {
    borderRadius: radii.md,
    height: 120,
    width: 80
  },
  matchCoverFallback: {
    alignItems: "center",
    backgroundColor: c.navy,
    borderRadius: radii.md,
    height: 120,
    justifyContent: "center",
    width: 80
  },
  matchInfo: {
    flex: 1,
    gap: 4
  },
  matchBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4
  },
  matchConfidenceBadge: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  matchConfidenceDot: {
    borderRadius: 4,
    height: 6,
    width: 6
  },
  matchConfidenceText: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6
  },
  matchSourceBadge: {
    backgroundColor: c.surfaceAlt,
    borderColor: c.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  matchSourceText: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "800"
  },
  matchTitle: {
    color: c.ink,
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22
  },
  matchSubtitle: {
    color: c.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12
  },
  matchAuthor: {
    color: c.tealDark,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  matchMeta: {
    color: c.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    lineHeight: 16
  },
  matchIsbn: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginTop: 2
  },
  matchSelectBtn: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: c.teal + "18",
    borderColor: c.teal + "44",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  matchSelectBtnPrimary: {
    backgroundColor: c.navy,
    borderColor: c.navy
  },
  matchSelectText: {
    color: c.tealDark,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900"
  },
  matchSelectTextPrimary: {
    color: "#FFFFFF"
  },
  editManuallyBtn: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    paddingVertical: 8
  },
  editManuallyText: {
    color: c.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800"
  },
  viewEditionsBtn: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: c.teal + "12",
    borderColor: c.teal + "38",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11
  },
  viewEditionsBtnText: {
    color: c.tealDark,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  scanAgainBtn: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: c.coral + "12",
    borderColor: c.coral + "44",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  scanAgainText: {
    color: c.tealDark,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
  },
  // ── Discover screen ──────────────────────────────────────────────────────
  discoverSectionTitle: {
    color: c.ink,
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "900",
    marginTop: spacing.lg,
    marginBottom: spacing.sm
  },
  chipRowContent: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: 4
  },
  suggestionChip: {
    backgroundColor: c.teal + "16",
    borderColor: c.teal + "40",
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  suggestionChipText: {
    color: c.tealDark,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  genreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  genreItem: {
    alignItems: "center",
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    width: "48.5%"
  },
  genreIconCircle: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  genreLabel: {
    color: c.ink,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  moodChip: {
    backgroundColor: c.gold + "16",
    borderColor: c.gold + "44",
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  moodChipText: {
    color: isDark ? c.gold : "#92620A",
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  },
  seriesChip: {
    alignItems: "center",
    backgroundColor: c.navy,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  seriesChipText: {
    color: "#FFFFFF",
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900"
  }
  });
}
