/**
 * editionMatchValidation — final same-book gate for edition switching.
 *
 * THE RULE: an edition switch must land on the SAME BOOK. Same series is NOT
 * enough — "Alas de sangre" (Fourth Wing, #1) must never switch to
 * "Onyx Storm" (#3) just because both are The Empyrean by the same author.
 *
 * A candidate is the same book only when one of these holds:
 *   - same-title:          normalized titles are equal (or one extends the
 *                          other at a real boundary, e.g. "Fourth Wing" vs
 *                          "Fourth Wing: Alas de sangre")
 *   - trusted-translation: both titles belong to the SAME knownWorks entry
 *                          (curated structural data — allowed by policy)
 *   - same-volume:         same curated series AND same volume order
 *   - same-work:           the candidate came from a pipeline stage that is
 *                          same-work BY CONSTRUCTION (Open Library editions of
 *                          this work's workKey, or the GB re-query using the
 *                          translated title those editions revealed)
 *
 * Same series with a DIFFERENT or UNKNOWN order → series-sibling: visible in
 * the picker under "Other books in this series" but NEVER applicable.
 * Anything else → unrelated: dropped (broad author-sweep noise).
 */
import { GenreBookResult } from "../services/googleBooksProvider";
import { getTitleVariants, inferSeriesData } from "./knownWorks";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Which pipeline stage produced a candidate (set by findEditionsInLanguage). */
export type CandidateOrigin =
  | "title-query"        // GB intitle/variant/free-text queries
  | "author-sweep"       // GB broad inauthor query — weakest signal
  | "ol-work"            // Open Library editions of THIS work (same-work proof)
  | "translated-requery"; // GB re-query with the OL-discovered translated title

export type EditionCandidate = GenreBookResult & { origin: CandidateOrigin };

export type SameBookVerdict =
  | "same-title"
  | "trusted-translation"
  | "same-volume"
  | "same-work"
  | "series-sibling"
  | "unrelated";

export type EditionSwitchSource = {
  title: string;
  authorName?: string;
  seriesName?: string;
  seriesNumber?: number;
};

export type GroupedEditionCandidates = {
  /** Same book — the ONLY group that may be applied. */
  exact: EditionCandidate[];
  /** Other volumes of the same series — shown, never applicable. */
  seriesSiblings: EditionCandidate[];
};

// ─── Title normalization ──────────────────────────────────────────────────────

const normTitle = (value?: string) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Equal titles, or one extends the other at a separator boundary
 *  ("fourth wing" vs "fourth wing alas de sangre"). */
function titlesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 4) return false;
  return long.startsWith(`${short} `);
}

// ─── Verdict ──────────────────────────────────────────────────────────────────

const logValidate = (source: EditionSwitchSource, candidate: { title: string }, detail: {
  sourceSeries?: string; candidateSeries?: string;
  sourceOrder?: number; candidateOrder?: number;
  verdict: SameBookVerdict;
}) => {
  if (!__DEV__) return;
  console.log(
    `[EDITION_SWITCH_VALIDATE] sourceTitle="${source.title}" candidateTitle="${candidate.title}" ` +
    `sourceSeries=${detail.sourceSeries ?? "-"} candidateSeries=${detail.candidateSeries ?? "-"} ` +
    `sourceOrder=${detail.sourceOrder ?? "-"} candidateOrder=${detail.candidateOrder ?? "-"} ` +
    `verdict=${detail.verdict}`
  );
};

/** Is `candidate` the same book as `source`? See module docs for the table. */
export function assessSameBook(
  source: EditionSwitchSource,
  candidate: { title: string; origin?: CandidateOrigin }
): SameBookVerdict {
  const author = source.authorName ?? "";

  // Series identity first — the curated catalog knows volume orders, and a
  // DIFFERENT order must veto even title/variant coincidences.
  const sourceInferred = inferSeriesData(source.title, author);
  const sourceSeries = source.seriesName ?? sourceInferred?.seriesName;
  const sourceOrder = source.seriesNumber ?? sourceInferred?.seriesOrder;
  const candidateInferred = inferSeriesData(candidate.title, author);
  const candidateSeries = candidateInferred?.seriesName;
  const candidateOrder = candidateInferred?.seriesOrder;

  const detail = { sourceSeries, candidateSeries, sourceOrder, candidateOrder };
  const finish = (verdict: SameBookVerdict): SameBookVerdict => {
    logValidate(source, candidate, { ...detail, verdict });
    return verdict;
  };

  const sameSeries =
    Boolean(sourceSeries && candidateSeries) &&
    normTitle(sourceSeries) === normTitle(candidateSeries);
  const bothOrdersKnown = sourceOrder !== undefined && candidateOrder !== undefined;

  // HARD VETO: same series, both orders known, orders differ → another book.
  if (sameSeries && bothOrdersKnown && sourceOrder !== candidateOrder) {
    return finish("series-sibling");
  }

  // 1. Same (or boundary-extended) title.
  if (titlesMatch(normTitle(source.title), normTitle(candidate.title))) {
    return finish("same-title");
  }

  // 2. Trusted translation: both titles in the SAME knownWorks entry.
  const variants = getTitleVariants(source.title).map(normTitle);
  if (variants.length && variants.includes(normTitle(candidate.title))) {
    return finish("trusted-translation");
  }

  // 3. Same curated series + same volume order.
  if (sameSeries && bothOrdersKnown && sourceOrder === candidateOrder) {
    return finish("same-volume");
  }

  // 4. Same work by construction (OL editions of this workKey / its re-query).
  if (candidate.origin === "ol-work" || candidate.origin === "translated-requery") {
    return finish("same-work");
  }

  // Same series but order unprovable → sibling (visible, never applicable).
  if (sameSeries) return finish("series-sibling");

  return finish("unrelated");
}

// ─── Grouping + ranking ───────────────────────────────────────────────────────

const EXACT_VERDICTS: ReadonlySet<SameBookVerdict> = new Set([
  "same-title", "trusted-translation", "same-volume", "same-work",
]);

/** Author-only discoveries must never outrank title/work/series-order matches. */
const ORIGIN_RANK: Record<CandidateOrigin, number> = {
  "title-query": 0,
  "translated-requery": 0,
  "ol-work": 0,
  "author-sweep": 1,
};

const qualityRank = (a: EditionCandidate, b: EditionCandidate) =>
  (ORIGIN_RANK[a.origin] - ORIGIN_RANK[b.origin]) ||
  (Number((b.description?.length ?? 0) > 40) - Number((a.description?.length ?? 0) > 40)) ||
  (Number(Boolean(b.coverUrl)) - Number(Boolean(a.coverUrl))) ||
  ((b.ratingsCount ?? 0) - (a.ratingsCount ?? 0));

/**
 * Partition language-validated candidates into the two picker groups.
 * Unrelated candidates (author-sweep noise) are dropped.
 */
export function groupEditionCandidates(
  source: EditionSwitchSource,
  candidates: EditionCandidate[]
): GroupedEditionCandidates {
  const exact: EditionCandidate[] = [];
  const seriesSiblings: EditionCandidate[] = [];

  for (const candidate of candidates) {
    const verdict = assessSameBook(source, candidate);
    if (EXACT_VERDICTS.has(verdict)) exact.push(candidate);
    else if (verdict === "series-sibling") seriesSiblings.push(candidate);
    // unrelated → dropped
  }

  exact.sort(qualityRank);
  seriesSiblings.sort(qualityRank);
  return { exact, seriesSiblings };
}
