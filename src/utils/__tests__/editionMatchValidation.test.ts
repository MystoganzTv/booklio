/**
 * editionMatchValidation — pins the final same-book gate:
 * same series is NOT enough; only exact translations / same volume / same
 * work may be applied; author-sweep results never outrank real matches.
 *
 * Uses the real knownWorks curated catalog (The Empyrean: Fourth Wing #1,
 * Iron Flame #2, Onyx Storm #3 + Spanish title variants) — structural data
 * only, allowed by policy.
 */
import {
  assessSameBook,
  groupEditionCandidates,
  EditionCandidate,
} from "../editionMatchValidation";
import { GenreBookResult } from "../../services/googleBooksProvider";

const YARROS = "Rebecca Yarros";

const candidate = (
  over: Partial<GenreBookResult> & { id: string; title: string; origin: EditionCandidate["origin"] }
): EditionCandidate =>
  ({
    authors: [YARROS], genres: ["Fantasy"], googleBooksId: over.id,
    language: "English",
    ...over,
  } as EditionCandidate);

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {}); // silence [EDITION_SWITCH_VALIDATE]
});
afterEach(() => {
  (console.log as jest.Mock).mockRestore?.();
});

describe("assessSameBook — the required block/allow table", () => {
  it("Fourth Wing Spanish -> Fourth Wing English: ALLOWED (trusted translation)", () => {
    const verdict = assessSameBook(
      { title: "Alas de sangre", authorName: YARROS },
      { title: "Fourth Wing" }
    );
    expect(["trusted-translation", "same-volume", "same-title"]).toContain(verdict);
  });

  it("Fourth Wing Spanish -> Onyx Storm English: BLOCKED (series sibling)", () => {
    expect(assessSameBook(
      { title: "Alas de sangre", authorName: YARROS },
      { title: "Onyx Storm" }
    )).toBe("series-sibling");
  });

  it("Fourth Wing -> Iron Flame: BLOCKED", () => {
    expect(assessSameBook(
      { title: "Fourth Wing", authorName: YARROS },
      { title: "Iron Flame" }
    )).toBe("series-sibling");
  });

  it("Onyx Storm Spanish -> Onyx Storm English: ALLOWED", () => {
    const verdict = assessSameBook(
      { title: "Tormenta de ónix", authorName: YARROS },
      { title: "Onyx Storm" }
    );
    expect(["trusted-translation", "same-volume", "same-title"]).toContain(verdict);
  });

  it("Onyx Storm Spanish -> Fourth Wing English: BLOCKED", () => {
    expect(assessSameBook(
      { title: "Tormenta de ónix", authorName: YARROS },
      { title: "Fourth Wing" }
    )).toBe("series-sibling");
  });

  it("the series veto beats everything: explicit user series data also blocks", () => {
    expect(assessSameBook(
      { title: "Some Edition Title", authorName: YARROS, seriesName: "The Empyrean", seriesNumber: 1 },
      { title: "Onyx Storm" }
    )).toBe("series-sibling");
  });

  it("subtitle extensions of the same title are the same book", () => {
    expect(assessSameBook(
      { title: "Fourth Wing", authorName: YARROS },
      { title: "Fourth Wing: Alas de sangre" }
    )).toBe("same-title");
  });

  it("same-work origins (OL editions of THIS work) are same book by construction", () => {
    expect(assessSameBook(
      { title: "Red Rising", authorName: "Pierce Brown" },
      { title: "Amanecer rojo", origin: "ol-work" }
    )).toBe("same-work");
  });

  it("an unknown different title from the author sweep is NOT provably the same book", () => {
    expect(assessSameBook(
      { title: "Red Rising", authorName: "Pierce Brown" },
      { title: "Golden Son", origin: "author-sweep" }
    )).toBe("unrelated");
  });
});

describe("groupEditionCandidates — picker groups + ranking", () => {
  const source = { title: "Alas de sangre", authorName: YARROS, seriesName: "The Empyrean", seriesNumber: 1 };

  it("exact translations are applicable; series siblings are separated; noise is dropped", () => {
    const groups = groupEditionCandidates(source, [
      candidate({ id: "fw", title: "Fourth Wing", origin: "title-query" }),
      candidate({ id: "onyx", title: "Onyx Storm", origin: "author-sweep" }),
      candidate({ id: "iron", title: "Iron Flame", origin: "author-sweep" }),
      candidate({ id: "noise", title: "A Completely Different Novel", origin: "author-sweep" }),
    ]);

    expect(groups.exact.map((b) => b.id)).toEqual(["fw"]);
    expect(groups.seriesSiblings.map((b) => b.id).sort()).toEqual(["iron", "onyx"]);
    // "noise" appears nowhere
    expect([...groups.exact, ...groups.seriesSiblings].some((b) => b.id === "noise")).toBe(false);
  });

  it("author-sweep results never outrank title/work matches — even with richer data", () => {
    const sweepWithSynopsis = candidate({
      id: "sweep", title: "Cuarta Ala", origin: "author-sweep",
      description: "x".repeat(200), coverUrl: "https://c", ratingsCount: 99999,
    });
    const titleQueryBare = candidate({ id: "tq", title: "Fourth Wing", origin: "title-query" });
    const olWorkBare = candidate({ id: "ol", title: "Alas de sangre: edición especial", origin: "ol-work" });

    const groups = groupEditionCandidates(source, [sweepWithSynopsis, titleQueryBare, olWorkBare]);

    expect(groups.exact.length).toBe(3);
    // The author-sweep candidate is LAST despite synopsis/cover/popularity.
    expect(groups.exact[groups.exact.length - 1].id).toBe("sweep");
    expect(groups.exact[0].id).not.toBe("sweep");
  });
});
