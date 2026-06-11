/**
 * recencyPolicy — age rules for recommendations. Pins the contract:
 * old books are filtered from DEFAULT recs, never from search/classics/series.
 */
import {
  agePreferenceScore,
  allowsByAge,
  DEFAULT_MIN_YEAR,
  NEW_RELEASE_WINDOW_YEARS,
} from "../recencyPolicy";

const NOW_YEAR = 2026;

describe("allowsByAge — default recommendations", () => {
  it("excludes pre-1990 books by default", () => {
    expect(allowsByAge(1900, "default", {}, NOW_YEAR)).toBe(false);
    expect(allowsByAge(1985, "default", {}, NOW_YEAR)).toBe(false);
    expect(allowsByAge(DEFAULT_MIN_YEAR - 1, "default", {}, NOW_YEAR)).toBe(false);
  });
  it("allows modern books", () => {
    expect(allowsByAge(1990, "default", {}, NOW_YEAR)).toBe(true);
    expect(allowsByAge(2015, "default", {}, NOW_YEAR)).toBe(true);
    expect(allowsByAge(2026, "default", {}, NOW_YEAR)).toBe(true);
  });
  it("never punishes missing metadata", () => {
    expect(allowsByAge(undefined, "default", {}, NOW_YEAR)).toBe(true);
    expect(allowsByAge(0, "default", {}, NOW_YEAR)).toBe(true);
  });
});

describe("allowsByAge — search is NEVER age-filtered (user intent wins)", () => {
  it("allows arbitrarily old books in search", () => {
    expect(allowsByAge(1900, "search", {}, NOW_YEAR)).toBe(true);
    expect(allowsByAge(1851, "search", {}, NOW_YEAR)).toBe(true);
  });
});

describe("allowsByAge — classics sections welcome old books", () => {
  it("allows pre-1990 books in a classics context", () => {
    expect(allowsByAge(1900, "classics", {}, NOW_YEAR)).toBe(true);
    expect(allowsByAge(1960, "classics", {}, NOW_YEAR)).toBe(true);
  });
});

describe("allowsByAge — new releases require the last 3 years", () => {
  it("allows only recent years", () => {
    expect(allowsByAge(NOW_YEAR, "new-releases", {}, NOW_YEAR)).toBe(true);
    expect(allowsByAge(NOW_YEAR - NEW_RELEASE_WINDOW_YEARS, "new-releases", {}, NOW_YEAR)).toBe(true);
    expect(allowsByAge(NOW_YEAR - NEW_RELEASE_WINDOW_YEARS - 1, "new-releases", {}, NOW_YEAR)).toBe(false);
    expect(allowsByAge(2010, "new-releases", {}, NOW_YEAR)).toBe(false);
  });
});

describe("allowsByAge — series continuation and canonical works override age", () => {
  it("never blocks the next volume of a series", () => {
    expect(allowsByAge(1965, "series-continuation", {}, NOW_YEAR)).toBe(true);
    expect(allowsByAge(1965, "default", { knownSeriesContinuation: true }, NOW_YEAR)).toBe(true);
  });
  it("allows curated canonical works", () => {
    expect(allowsByAge(1954, "default", { isCanonicalWork: true }, NOW_YEAR)).toBe(true);
  });
});

describe("agePreferenceScore — modern books float up in ranking", () => {
  it("orders fresh > recent > modern > old-but-allowed > pre-1990", () => {
    const fresh = agePreferenceScore(NOW_YEAR - 1, NOW_YEAR);
    const recent = agePreferenceScore(NOW_YEAR - 8, NOW_YEAR);
    const modern = agePreferenceScore(NOW_YEAR - 20, NOW_YEAR);
    const oldAllowed = agePreferenceScore(1992, NOW_YEAR);
    const ancient = agePreferenceScore(1900, NOW_YEAR);
    expect(fresh).toBeGreaterThan(recent);
    expect(recent).toBeGreaterThan(modern);
    expect(modern).toBeGreaterThan(oldAllowed);
    expect(oldAllowed).toBeGreaterThan(ancient);
    expect(ancient).toBeLessThan(0);
  });
  it("unknown year gets neither boost nor penalty", () => {
    expect(agePreferenceScore(undefined, NOW_YEAR)).toBe(0);
  });
});
