/**
 * metadataMergePolicy — the strict language policy is a user mandate:
 * a Spanish book must NEVER silently receive English metadata, and curated
 * sources must never fabricate visible fields. These tests pin that contract.
 */
import {
  canUseFieldForLanguage,
  isLanguageLockedField,
  isVisibleMetadataField,
  mergeMetadataSafely,
  stripFabricatedVisibleFields,
} from "../metadataMergePolicy";

describe("isLanguageLockedField", () => {
  it("locks edition-specific fields", () => {
    for (const f of ["title", "synopsis", "coverImageUri", "isbn", "publisher", "publishedDate", "pages", "language"]) {
      expect(isLanguageLockedField(f)).toBe(true);
    }
  });
  it("does not lock structural fields", () => {
    for (const f of ["authorName", "workKey", "seriesName", "seriesOrder", "genre", "format"]) {
      expect(isLanguageLockedField(f)).toBe(false);
    }
  });
});

describe("isVisibleMetadataField", () => {
  it("flags everything curated sources must not fabricate", () => {
    for (const f of ["synopsis", "description", "coverUrl", "pages", "publisher", "publishedDate", "averageRating", "ratingsCount"]) {
      expect(isVisibleMetadataField(f)).toBe(true);
    }
  });
  it("allows structural fields", () => {
    for (const f of ["workKey", "seriesName", "seriesOrder", "title", "authorName"]) {
      expect(isVisibleMetadataField(f)).toBe(false);
    }
  });
});

describe("canUseFieldForLanguage", () => {
  it("allows everything when no language is selected", () => {
    expect(canUseFieldForLanguage("synopsis", "English", undefined)).toBe(true);
    expect(canUseFieldForLanguage("synopsis", undefined, undefined)).toBe(true);
  });

  it("allows structural fields regardless of language", () => {
    expect(canUseFieldForLanguage("authorName", "English", "Spanish")).toBe(true);
    expect(canUseFieldForLanguage("workKey", undefined, "Spanish")).toBe(true);
  });

  it("REJECTS locked fields from another language (the Amanecer rojo rule)", () => {
    expect(canUseFieldForLanguage("synopsis", "English", "Spanish")).toBe(false);
    expect(canUseFieldForLanguage("title", "Spanish", "English")).toBe(false);
    expect(canUseFieldForLanguage("coverImageUri", "English", "Spanish")).toBe(false);
  });

  it("REJECTS locked fields when the candidate language is unknown (strict)", () => {
    expect(canUseFieldForLanguage("synopsis", undefined, "Spanish")).toBe(false);
    expect(canUseFieldForLanguage("synopsis", "", "Spanish")).toBe(false);
  });

  it("accepts matching language across name/code spellings", () => {
    expect(canUseFieldForLanguage("synopsis", "Spanish", "Spanish")).toBe(true);
    expect(canUseFieldForLanguage("synopsis", "es", "Spanish")).toBe(true);
    expect(canUseFieldForLanguage("synopsis", "spa", "Spanish")).toBe(true);
    expect(canUseFieldForLanguage("title", "English", "en")).toBe(true);
  });
});

describe("mergeMetadataSafely", () => {
  it("fills only empty fields — never overwrites user-confirmed data", () => {
    const base = { title: "Mi título", synopsis: "" };
    const out = mergeMetadataSafely(base, { title: "Other", synopsis: "Nueva sinopsis" }, "Spanish", "Spanish");
    expect(out.title).toBe("Mi título");
    expect(out.synopsis).toBe("Nueva sinopsis");
  });

  it("blocks wrong-language fills even into empty fields", () => {
    const base = { synopsis: "", title: "Amanecer rojo" };
    const out = mergeMetadataSafely(base, { synopsis: "English text here" }, "Spanish", "English");
    expect(out.synopsis).toBe(""); // stays empty — "Find synopsis" handles it
  });

  it("allows structural fills regardless of language", () => {
    const base: Record<string, unknown> = { workKey: undefined, seriesName: undefined };
    const out = mergeMetadataSafely(base, { workKey: "OL123W", seriesName: "Red Rising Saga" }, "Spanish", "English");
    expect(out.workKey).toBe("OL123W");
    expect(out.seriesName).toBe("Red Rising Saga");
  });
});

describe("stripFabricatedVisibleFields", () => {
  it("strips visible metadata from curated records, keeps structural", () => {
    const out = stripFabricatedVisibleFields({
      title: "Fourth Wing",
      seriesName: "The Empyrean",
      seriesOrder: 1,
      workKey: "OL999W",
      synopsis: "FABRICATED",
      description: "FABRICATED",
      pages: 320,
      publisher: "FABRICATED",
      publishedDate: "2026-01-01",
      coverUrl: "https://fake",
      averageRating: 5,
      ratingsCount: 1000,
    });
    expect(out.title).toBe("Fourth Wing");
    expect(out.seriesName).toBe("The Empyrean");
    expect(out.seriesOrder).toBe(1);
    expect(out.workKey).toBe("OL999W");
    expect(out.synopsis).toBeUndefined();
    expect(out.description).toBeUndefined();
    expect(out.pages).toBeUndefined();
    expect(out.publisher).toBeUndefined();
    expect(out.publishedDate).toBeUndefined();
    expect(out.coverUrl).toBeUndefined();
    expect(out.averageRating).toBeUndefined();
    expect(out.ratingsCount).toBeUndefined();
  });
});
