// ─── Noise patterns — strip awards, lists, marketing tags ─────────────────────

const NOISE_PATTERNS = [
  /^nyt:/i,
  /new york times/i,
  /combined-print/i,
  /best ?seller/i,
  /movie tie-in/i,
  /tv tie-in/i,
  /oprah/i,
  /book club/i,
  /pulitzer/i,
  /award/i,
  /winner/i,
];

// ─── Genre classification rules ───────────────────────────────────────────────
// Order matters: more specific genres are listed first so they win over broader
// catch-alls. "Literary Fiction" is intentionally last — it only applies when
// nothing more specific matched.

const GENRE_RULES: Array<{ label: string; patterns: RegExp[] }> = [
  { label: "Fantasy",          patterns: [/\bfantasy\b/i, /\bfantas[íi]a\b/i, /\bmagic\b/i, /\bmagia\b/i, /\bdragons?\b/i, /\bdragones\b/i, /epic fantasy/i, /sword and sorcery/i, /romantasy/i] },
  { label: "Science Fiction",  patterns: [/science fiction/i, /ciencia ficci[óo]n/i, /\bsci[- ]?fi\b/i, /space opera/i, /\bdystopi/i, /\bdistop/i, /\bcyberpunk\b/i] },
  { label: "Mystery",          patterns: [/\bmystery\b/i, /\bmisterio\b/i, /\bdetective\b/i, /\bpolic[íi]ac[ao]\b/i, /crime fiction/i, /novela negra/i, /whodunit/i, /\bnoir\b/i] },
  { label: "Thriller",         patterns: [/\bthriller\b/i, /\bsuspenses?\b/i, /\bsuspensos?\b/i, /\bespionage\b/i, /\bespionaje\b/i, /\bspy\b/i, /\bconspiracy\b/i] },
  { label: "Horror",           patterns: [/\bhorror\b/i, /\bterror\b/i, /ghost stories/i, /supernatural fiction/i, /\bocult\b/i] },
  { label: "Romance",          patterns: [/\bromance\b/i, /\brom[áa]ntic[ao]s?\b/i, /love stories/i, /romantic fiction/i] },
  { label: "Historical Fiction",patterns: [/historical fiction/i, /history, fiction/i, /war stories/i, /\bhistorical\b/i] },
  { label: "Adventure",        patterns: [/\badventure\b/i, /\bquests?\b/i, /\bsurvival\b/i, /action/i] },
  { label: "Young Adult",      patterns: [/young adult/i, /\bya\b/i, /\bteen\b/i, /coming[- ]of[- ]age/i] },
  { label: "Children's",       patterns: [/\bjuvenile\b/i, /\bchildren\b/i, /picture books?/i, /middle grade/i] },
  { label: "Biography",        patterns: [/\bbiograph/i, /\bbiograf[íi]a/i, /\bmemoir\b/i, /\bmemorias\b/i, /\bautobiograph/i, /\bautobiograf/i] },
  { label: "History",          patterns: [/\bhistory\b/i, /\bcivilization\b/i, /\bworld war\b/i] },
  { label: "Nonfiction",       patterns: [/non[- ]?fiction/i, /\bessay\b/i] },
  { label: "Personal Growth",  patterns: [/self[- ]help/i, /\bautoayuda\b/i, /\bsuperaci[óo]n\b/i, /personal growth/i, /\bhabits\b/i, /\bsuccess\b/i] },
  { label: "Spirituality",     patterns: [/body,? mind (and|&) spirit/i, /\bspiritualit/i, /\bespiritualidad\b/i, /\bmindfulness\b/i, /\bmeditation\b/i, /\bmeditaci[óo]n\b/i] },
  { label: "Poetry",           patterns: [/\bpoetry\b/i, /\bpoes[íi]a\b/i, /\bpoems?\b/i, /\bverse\b/i] },
  { label: "Comics",           patterns: [/\bcomics?\b/i, /graphic novels?/i, /\bmanga\b/i] },
  // "Literary Fiction" is a catch-all — only used if nothing more specific matched
  { label: "Literary Fiction", patterns: [/\bliterary\b/i, /\bliterature\b/i, /american literature/i] },
];

// ─── Genres considered too generic to stand alone ─────────────────────────────
// If "Literary Fiction" (or "Fiction") is the ONLY result, we try to infer
// something better from the description/title before falling back to it.
// These labels are valid in combination but weak when alone.
const GENERIC_SOLE_GENRES = new Set(["Literary Fiction", "Nonfiction", "Uncategorized"]);

// Raw category strings that are pure noise as taste signals — excluded before
// the title-case fallback. Compared accent-stripped + lowercased.
const stripAccents = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const GENERIC_RAW_EXCLUDE = new Set([
  "fiction", "ficcion", "ficciones", "general", "juvenile fiction",
  "young adult", "young adult fiction", "literary collections",
  "literatura", "novela", "novelas", "no ficcion", "antologias", "anthologies",
]);

// ─── Description-based keyword inference ─────────────────────────────────────
// Scans raw description text for strong genre signals. Used as a fallback when
// the API's category list yields only a generic genre.
// Patterns are deliberately specific to avoid false positives.

const DESCRIPTION_INFERENCE: Array<{ label: string; patterns: RegExp[] }> = [
  { label: "Thriller",         patterns: [/\bmurder\b/i, /\bkilled\b/i, /\bassassin\b/i, /\bfugitive\b/i, /\bchase\b/i, /\bplot\b.*\bkill\b/i, /\bconspiracy\b/i, /\bspy\b/i, /\binvestigat/i, /\bsuspect\b/i, /\bhunted\b/i] },
  { label: "Mystery",          patterns: [/\bdetective\b/i, /\bwhodunit\b/i, /\bsolve the\b/i, /\bclue\b/i, /\bunsolve\b/i] },
  { label: "Science Fiction",  patterns: [/\bspaceship\b/i, /\bplanet\b/i, /\balien\b/i, /\btime travel\b/i, /\bartificial intelligence\b/i, /\brobot\b/i, /\bfutur/i] },
  { label: "Fantasy",          patterns: [/\bmagic\b/i, /\bdragon\b/i, /\bwizard\b/i, /\belf\b/i, /\bsorcerer\b/i, /\bquest\b/i, /\bspell\b/i] },
  { label: "Horror",           patterns: [/\bterror\b/i, /\bhaunt\b/i, /\bdemon\b/i, /\bvampire\b/i, /\bzombie\b/i] },
  { label: "Romance",          patterns: [/\bfalls? in love\b/i, /\blove affair\b/i, /\bheartbreak\b/i, /\bsoulmate\b/i] },
  { label: "Historical Fiction",patterns: [/\bworld war\b/i, /\b19th century\b/i, /\b18th century\b/i, /\bvictorian\b/i, /\bmedieval\b/i] },
  { label: "Biography",        patterns: [/\blife of\b/i, /\bborn in\b/i, /\bmemoir\b/i, /\bautobiograph/i] },
  { label: "Personal Growth",  patterns: [/\bself[- ]improvement\b/i, /\bproductivity\b/i, /\bgoals?\b/i, /\bmindset\b/i] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanGenreValue(raw: string): string {
  return raw
    .replace(/^subjects?:/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyText(text: string, rules: typeof GENRE_RULES): string[] {
  const found: string[] = [];
  for (const rule of rules) {
    if (rule.patterns.some((p) => p.test(text))) {
      found.push(rule.label);
    }
  }
  return found;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Normalize raw genre/category strings from Google Books or Open Library into
 * clean, app-friendly genre labels.
 *
 * @param genres      Raw category strings from the API.
 * @param description Optional description text — used to infer genre when the
 *                    API categories are too generic or missing.
 */
export function normalizeBookGenres(
  genres?: string[],
  description?: string
): string[] {
  // ── Step 1: classify from API categories ──────────────────────────────────
  const collected: string[] = [];

  for (const raw of genres ?? []) {
    const cleaned = cleanGenreValue(raw);
    if (!cleaned) continue;
    if (NOISE_PATTERNS.some((p) => p.test(cleaned))) continue;

    const matched = classifyText(cleaned, GENRE_RULES);
    if (matched.length) {
      collected.push(...matched);
      continue;
    }

    // Generic catch-all categories must never pass through as raw "genres" —
    // they say nothing about taste (Fiction / Ficción / General / etc.).
    if (GENERIC_RAW_EXCLUDE.has(stripAccents(cleaned.toLowerCase()))) continue;

    // Keep short, plain strings that don't match any rule as-is
    if (cleaned.includes(":")) continue;
    if (cleaned.length > 32) continue;

    const fallback = cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
    collected.push(fallback);
  }

  // ── Step 2: deduplicate ───────────────────────────────────────────────────
  const unique = Array.from(new Set(collected)).slice(0, 4);

  // ── Step 3: fallback — infer from description if result is too generic ────
  // If the only genre we have is a weak catch-all ("Literary Fiction",
  // "Nonfiction", "Uncategorized"), try to find something better by scanning
  // the description text for strong genre signals.
  const isTooGeneric =
    unique.length === 0 ||
    (unique.length === 1 && GENERIC_SOLE_GENRES.has(unique[0]!));

  if (isTooGeneric && description) {
    const inferred = classifyText(description, DESCRIPTION_INFERENCE);
    if (inferred.length) {
      // Return inferred genres. Keep the original weak genre only if nothing
      // was inferred so we always have at least one label.
      const merged = Array.from(new Set([...inferred, ...unique])).slice(0, 4);
      return merged;
    }
  }

  return unique.length ? unique : ["Uncategorized"];
}
