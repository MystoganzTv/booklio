import { Camera, BarcodeType } from "expo-camera";
import { Platform } from "react-native";
import { NewBookInput } from "../types/models";
import {
  applyMetadataToBookInput,
  metadataToBookInput,
  normalizeIsbn,
  resolveBookMetadata
} from "./bookMetadata";

type VisionProviderResponse = {
  title?: string;
  authorName?: string;
  isbn?: string;
  synopsis?: string;
  publisher?: string;
  publishedDate?: string;
  language?: string;
  genre?: string[];
};

export type BookPhotoIntakeResult = {
  draft: NewBookInput;
  strategy: "barcode-image" | "vision-provider" | "manual-review";
  matched: boolean;
  notes: string[];
};

const BARCODE_TYPES: BarcodeType[] = ["ean13", "ean8", "upc_a", "upc_e"];
const VISION_ENDPOINT = process.env.EXPO_PUBLIC_BOOKLIO_VISION_ENDPOINT?.trim();

export function getBookPhotoSupportSummary() {
  return {
    imageBarcodeIsbnSupported: Platform.OS !== "ios",
    visionProviderConfigured: Boolean(VISION_ENDPOINT)
  };
}

export async function analyzeBookPhoto(input: {
  uri: string;
  base64?: string | null;
  fileName?: string | null;
}): Promise<BookPhotoIntakeResult> {
  const detectedIsbn = await scanIsbnFromImage(input.uri);
  if (detectedIsbn) {
    const metadata = await resolveBookMetadata({ isbn: detectedIsbn });
    if (metadata) {
      const draft = metadataToBookInput(metadata, "photo", { coverImageUri: input.uri });
      return {
        draft,
        strategy: "barcode-image",
        matched: true,
        notes: [
          "Booklio found an ISBN inside the photo and matched it with Open Library.",
          "Review the details before saving in case this edition differs from your copy."
        ]
      };
    }

    return {
      draft: {
        title: `ISBN Book ${detectedIsbn}`,
        authorName: "Author to identify",
        isbn: detectedIsbn,
        genre: ["Uncategorized"],
        language: "English",
        synopsis: "Booklio detected an ISBN from the photo, but the edition still needs metadata.",
        coverImageUri: input.uri,
        source: "photo",
        ownership: "owned"
      },
      strategy: "barcode-image",
      matched: false,
      notes: [
        "Booklio detected an ISBN in the image.",
        "Open Library did not return full metadata for that code, so this draft still needs review."
      ]
    };
  }

  const providerResult = await scanWithVisionProvider(input);
  if (providerResult) {
    const metadata = await resolveBookMetadata({
      isbn: providerResult.isbn,
      title: providerResult.title,
      authorName: providerResult.authorName
    });

    const providerDraft = {
      title: providerResult.title ?? "Book from photo",
      authorName: providerResult.authorName ?? "Author to identify",
      isbn: providerResult.isbn,
      genre: providerResult.genre ?? ["Uncategorized"],
      publisher: providerResult.publisher,
      publishedDate: providerResult.publishedDate,
      language: providerResult.language ?? "English",
      synopsis: providerResult.synopsis ?? "Metadata inferred from a photo by the configured vision provider.",
      coverImageUri: input.uri,
      source: "photo" as const,
      ownership: "owned" as const
    };

    const draft = metadata ? applyMetadataToBookInput(providerDraft, metadata) : providerDraft;
    return {
      draft,
      strategy: "vision-provider",
      matched: Boolean(metadata || providerResult.title || providerResult.isbn),
      notes: [
        "Booklio used the configured vision provider to read clues from the photo.",
        "Please verify title, author, and edition before saving."
      ]
    };
  }

  return {
    draft: {
      title: "Book from photo",
      authorName: "Needs identification",
      genre: ["Uncategorized"],
      language: "English",
      synopsis:
        Platform.OS === "ios"
          ? "Booklio saved your photo, but iPhone photo ISBN scanning is limited. Try the live ISBN scanner or add a title, then refresh metadata."
          : "Booklio saved your photo, but could not read an ISBN from this image. Try the back cover, the copyright page, or enter a title and refresh metadata.",
      coverImageUri: input.uri,
      source: "photo",
      ownership: "owned"
    },
    strategy: "manual-review",
    matched: false,
    notes: buildFallbackNotes()
  };
}

async function scanIsbnFromImage(uri: string) {
  try {
    const results = await Camera.scanFromURLAsync(uri, BARCODE_TYPES);
    const isbnCandidate = results
      .map((result) => normalizeIsbn(result.data))
      .find((value) => isLikelyIsbn(value));
    return isbnCandidate;
  } catch {
    return undefined;
  }
}

async function scanWithVisionProvider(input: {
  base64?: string | null;
  fileName?: string | null;
}): Promise<VisionProviderResponse | undefined> {
  if (!VISION_ENDPOINT || !input.base64) return undefined;

  try {
    const response = await fetch(VISION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        imageBase64: input.base64,
        fileName: input.fileName
      })
    });

    if (!response.ok) return undefined;
    const data = (await response.json()) as VisionProviderResponse;
    if (!data.title && !data.authorName && !data.isbn) return undefined;
    return data;
  } catch {
    return undefined;
  }
}

function buildFallbackNotes() {
  if (Platform.OS === "ios") {
    return [
      "Booklio kept the photo, but iOS static image barcode scanning is limited.",
      "For the most reliable detection on iPhone, use Scan ISBN or connect a vision provider."
    ];
  }

  return [
    "Booklio inspected the image for ISBN barcodes.",
    "No barcode was found, so this draft is ready for manual review or a later metadata refresh."
  ];
}

function isLikelyIsbn(value?: string) {
  if (!value) return false;
  return value.length === 10 || value.length === 13;
}
