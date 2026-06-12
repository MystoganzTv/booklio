/**
 * identityRecommendations — pins the Phase 2 S1 contract:
 * deterministic specs from identity, reason codes everywhere, negatives and
 * recencyPolicy enforced, library never re-recommended.
 */
import {
  buildIdentitySectionSpecs,
  passesIdentityFilters,
  rankCandidate,
  IdentitySectionSpec,
} from "../identityRecommendations";
import { GenreBookResult } from "../googleBooksProvider";
import { ReadingIdentity } from "../../utils/readingIdentity";

const NOW_YEAR = 2026;

const identity = (over: Partial<ReadingIdentity> = {}): ReadingIdentity => ({
  version: 1,
  computedAt: "2026-06-10T00:00:00.000Z",
  genres: [{ name: "Fantasy", weight: 100 }, { name: "Thriller", weight: 70 }],
  authors: [{ name: "Rebecca Yarros", weight: 100 }, { name: "David Baldacci", weight: 45 }],
  series: [{ name: "The Empyrean", progress: 50, completed: false, weight: 6 }],
  formats: [{ format: "audio", share: 0.5 }],
  languages: [{ language: "Spanish", share: 0.6 }],
  negatives: [{ kind: "genre", name: "Horror", weight: 100 }, { kind: "author", name: "Stephen King", weight: 100 }],
  pace: { minutesPerSessionAvg: 30, sessionsPerWeek: 4, preferredSessionLength: "medium", typicalBookLength: 500 },
  habits: { currentStreak: 2, longestStreak: 10, finishRate: 0.8 },
  summaryKeys: [],
  ...over,
});

const candidate = (over: Partial<GenreBookResult> & { id: string }): GenreBookResult =>
  ({
    title: over.id, authors: ["Someone"], genres: ["Fantasy"],
    googleBooksId: over.id, language: "Spanish", coverUrl: "https://c",
    publishedYear: 2022, pageCount: 400,
    ...over,
  } as GenreBookResult);

const emptyLibrary = { isbnSet: new Set<string>(), normalizedTitleSet: new Set<string>() };
const specOf = (specs: IdentitySectionSpec[], reason: string) => specs.find((s) => s.reason === reason)!;

describe("buildIdentitySectionSpecs — deterministic sections with reason codes", () => {
  const specs = buildIdentitySectionSpecs(identity());

  it("creates the requested section families from real signals", () => {
    const reasons = specs.map((s) => s.reason);
    expect(reasons).toContain("author-loved");
    expect(reasons).toContain("series-continue");
    expect(reasons).toContain("genre-match");
    expect(reasons).toContain("new-release");
    expect(reasons).toContain("long-immersive"); // typicalBookLength 500
  });

  it("every spec carries a reason code and i18n keys — no free copy", () => {
    for (const spec of specs) {
      expect(spec.reason).toBeTruthy();
      expect(spec.titleKey).toMatch(/^recs\./);
      expect(spec.subtitleKey).toMatch(/^recs\./);
    }
  });

  it("series sections use the age-exempt context", () => {
    expect(specOf(specs, "series-continue").context).toBe("series-continuation");
  });

  it("new releases use the 3-year context", () => {
    expect(specOf(specs, "new-release").context).toBe("new-releases");
  });

  it("genre sections restrict to the reader's top language", () => {
    expect(specOf(specs, "genre-match").langCode).toBe("es");
  });

  it("weak signals create no sections (no fabricated taste)", () => {
    const weak = identity({ authors: [{ name: "X", weight: 10 }], genres: [{ name: "Y", weight: 10 }], series: [] });
    expect(buildIdentitySectionSpecs(weak)).toHaveLength(0);
  });

  it("is deterministic", () => {
    expect(buildIdentitySectionSpecs(identity())).toEqual(specs);
  });
});

describe("passesIdentityFilters — recency policy", () => {
  const specs = buildIdentitySectionSpecs(identity());
  const defaultSpec = specOf(specs, "author-loved");
  const seriesSpec = specOf(specs, "series-continue");
  const newSpec = specOf(specs, "new-release");

  it("old books are filtered from default recommendations", () => {
    expect(passesIdentityFilters(candidate({ id: "old", publishedYear: 1900 }), identity(), defaultSpec, emptyLibrary, NOW_YEAR)).toBe(false);
    expect(passesIdentityFilters(candidate({ id: "old2", publishedYear: 1985 }), identity(), defaultSpec, emptyLibrary, NOW_YEAR)).toBe(false);
  });

  it("old books CAN appear when continuing a series", () => {
    expect(passesIdentityFilters(candidate({ id: "dune", publishedYear: 1965 }), identity(), seriesSpec, emptyLibrary, NOW_YEAR)).toBe(true);
  });

  it("new releases only show recent books", () => {
    expect(passesIdentityFilters(candidate({ id: "fresh", publishedYear: 2025 }), identity(), newSpec, emptyLibrary, NOW_YEAR)).toBe(true);
    expect(passesIdentityFilters(candidate({ id: "stale", publishedYear: 2019 }), identity(), newSpec, emptyLibrary, NOW_YEAR)).toBe(false);
  });

  it("unknown year is never punished", () => {
    expect(passesIdentityFilters(candidate({ id: "noyear", publishedYear: undefined }), identity(), defaultSpec, emptyLibrary, NOW_YEAR)).toBe(true);
  });
});

describe("passesIdentityFilters — negative signals & library dedupe", () => {
  const spec = specOf(buildIdentitySectionSpecs(identity()), "genre-match");

  it("excludes DNF-repelled genres", () => {
    expect(passesIdentityFilters(candidate({ id: "h", genres: ["Horror"] }), identity(), spec, emptyLibrary, NOW_YEAR)).toBe(false);
  });

  it("excludes DNF-repelled authors", () => {
    expect(passesIdentityFilters(candidate({ id: "k", authors: ["Stephen King"] }), identity(), spec, emptyLibrary, NOW_YEAR)).toBe(false);
  });

  it("never recommends books already in the library (by ISBN or title)", () => {
    const lib = { isbnSet: new Set(["9781234567890"]), normalizedTitleSet: new Set(["amanecer rojo"]) };
    expect(passesIdentityFilters(candidate({ id: "a", isbn13: "9781234567890" }), identity(), spec, lib, NOW_YEAR)).toBe(false);
    expect(passesIdentityFilters(candidate({ id: "b", title: "Amanecer Rojo" }), identity(), spec, lib, NOW_YEAR)).toBe(false);
  });
});

describe("passesIdentityFilters — page-length sections", () => {
  const short: IdentitySectionSpec = { ...specOf(buildIdentitySectionSpecs(identity({ pace: { minutesPerSessionAvg: 10, sessionsPerWeek: 2, preferredSessionLength: "short" } })), "short-read") };
  it("short-reads rejects long books", () => {
    expect(passesIdentityFilters(candidate({ id: "long", pageCount: 600 }), identity(), short, emptyLibrary, NOW_YEAR)).toBe(false);
    expect(passesIdentityFilters(candidate({ id: "ok", pageCount: 250 }), identity(), short, emptyLibrary, NOW_YEAR)).toBe(true);
  });
});

describe("rankCandidate — modern, covered, popular, language-matched float up", () => {
  it("prefers newer over pre-1990 and language match over mismatch", () => {
    const fresh = rankCandidate(candidate({ id: "f", publishedYear: 2025 }), identity(), NOW_YEAR);
    const ancient = rankCandidate(candidate({ id: "a", publishedYear: 1900 }), identity(), NOW_YEAR);
    expect(fresh).toBeGreaterThan(ancient);

    const es = rankCandidate(candidate({ id: "es", language: "Spanish" }), identity(), NOW_YEAR);
    const en = rankCandidate(candidate({ id: "en", language: "English" }), identity(), NOW_YEAR);
    expect(es).toBeGreaterThan(en);
  });
});
