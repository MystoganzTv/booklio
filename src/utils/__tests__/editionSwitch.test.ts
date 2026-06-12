/**
 * editionSwitch — pins the edition-switch contract that fixes the
 * "Spanish language with English cover" bug: edition-locked fields switch
 * together; absent fields become EMPTY, never inherited; user data and work
 * identity are never touched.
 */
import { buildEditionSwitchPatch } from "../editionSwitch";
import { GenreBookResult } from "../../services/googleBooksProvider";
import { Book } from "../../types/models";

const edition = (over: Partial<GenreBookResult> & { id: string; title: string }): GenreBookResult =>
  ({
    authors: ["Pierce Brown"],
    genres: ["Science Fiction"],
    googleBooksId: over.id,
    ...over,
  } as GenreBookResult);

const EN = edition({
  id: "gb-en", title: "Red Rising", language: "English",
  isbn13: "9781444759006", coverUrl: "https://covers/en.jpg",
  pageCount: 382, publisher: "Hodder", publishedYear: 2014,
  description: "Darrow is a Red, a member of the lowest caste in the color-coded society of the future…",
});

const ES = edition({
  id: "gb-es", title: "Amanecer rojo", language: "Spanish",
  isbn13: "9788490566372", coverUrl: "https://covers/es.jpg",
  pageCount: 439, publisher: "RBA", publishedYear: 2015,
  description: "Darrow es un Rojo, un miembro de la casta más baja de la sociedad del futuro…",
});

/** A Spanish edition that GB serves with NO cover/publisher/description. */
const ES_SPARSE = edition({
  id: "gb-es-sparse", title: "Amanecer rojo", language: "Spanish",
  isbn13: "9788490566999",
});

describe("English → Spanish edition switch", () => {
  const patch = buildEditionSwitchPatch(ES, "Spanish");
  it("every locked field comes from the Spanish edition", () => {
    expect(patch.language).toBe("Spanish");
    expect(patch.title).toBe("Amanecer rojo");
    expect(patch.isbn13).toBe("9788490566372");
    expect(patch.coverImageUri).toBe("https://covers/es.jpg");
    expect(patch.publisher).toBe("RBA");
    expect(patch.pages).toBe("439");
    expect(patch.publishedDate).toBe("2015");
    expect(patch.synopsis).toMatch(/Darrow es un Rojo/);
    expect(patch.needsSynopsisBackfill).toBe(false);
  });
});

describe("Spanish → English edition switch", () => {
  const patch = buildEditionSwitchPatch(EN, "English");
  it("every locked field comes from the English edition", () => {
    expect(patch.title).toBe("Red Rising");
    expect(patch.isbn13).toBe("9781444759006");
    expect(patch.coverImageUri).toBe("https://covers/en.jpg");
    expect(patch.publisher).toBe("Hodder");
    expect(patch.synopsis).toMatch(/Darrow is a Red/);
  });
});

describe("NO metadata leakage between editions (the root-cause bug)", () => {
  it("a sparse edition CLEARS cover/publisher/synopsis — never inherits them", () => {
    const patch = buildEditionSwitchPatch(ES_SPARSE, "Spanish");
    expect(patch.coverImageUri).toBe("");   // ← was: kept the English cover
    expect(patch.publisher).toBe("");       // ← was: kept the English publisher
    expect(patch.pages).toBe("");
    expect(patch.publishedDate).toBe("");
    expect(patch.synopsis).toBe("");
    expect(patch.needsSynopsisBackfill).toBe(true);
  });

  it("ISBN-10 is always cleared (it belongs to the previous edition)", () => {
    expect(buildEditionSwitchPatch(ES, "Spanish").isbn10).toBe("");
    expect(buildEditionSwitchPatch(ES_SPARSE, "Spanish").isbn10).toBe("");
  });

  it("the stale editionKey pointer is always cleared", () => {
    expect(buildEditionSwitchPatch(ES, "Spanish").editionKey).toBeUndefined();
  });
});

describe("multiple editions of the same work", () => {
  it("round-trip EN→ES→EN reproduces each edition exactly (no drift)", () => {
    const toEs = buildEditionSwitchPatch(ES, "Spanish");
    const backToEn = buildEditionSwitchPatch(EN, "English");
    expect(toEs.coverImageUri).toBe("https://covers/es.jpg");
    expect(backToEn.coverImageUri).toBe("https://covers/en.jpg");
    expect(backToEn.isbn13).toBe("9781444759006");
    // determinism: same input, same patch
    expect(buildEditionSwitchPatch(ES, "Spanish")).toEqual(toEs);
  });
});

describe("covers match the selected language edition", () => {
  it("cover is either the selected edition's or empty — never another language's", () => {
    expect(buildEditionSwitchPatch(ES, "Spanish").coverImageUri).toBe(ES.coverUrl);
    expect(buildEditionSwitchPatch(ES_SPARSE, "Spanish").coverImageUri).toBe("");
  });
});

describe("user data and work identity are untouchable", () => {
  it("the patch contains no user-level or work-level fields", () => {
    const patch = buildEditionSwitchPatch(ES, "Spanish") as Record<string, unknown>;
    for (const forbidden of ["userStatus", "id", "workKey", "notes", "favoriteQuotes", "tags", "rating", "progressPercent", "status"]) {
      expect(patch).not.toHaveProperty(forbidden === "editionKey" ? "x" : forbidden);
    }
  });

  it("applying the patch over a Book preserves id, workKey and userStatus verbatim", () => {
    const userBook = {
      id: "b-red-rising-123",
      workKey: "/works/OL17081100W",
      userStatus: {
        status: "reading", progressPercent: 64, rating: 5,
        notes: "mis notas", favoriteQuotes: ["Por la Obsidiana"],
        ownership: "owned", wishlist: false, wantToBuy: false, readCount: 0,
      },
      tags: ["favs"],
    } as unknown as Book;

    const patch = buildEditionSwitchPatch(ES, "Spanish");
    const after = { ...userBook, ...patch };

    expect(after.id).toBe("b-red-rising-123");
    expect(after.workKey).toBe("/works/OL17081100W"); // same WORK, different edition
    expect(after.userStatus).toEqual(userBook.userStatus);
    expect(after.tags).toEqual(["favs"]);
  });
});
