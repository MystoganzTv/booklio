/**
 * languageEvidence — confidence-based language matching for catalog metadata.
 *
 * WHY: provider language labels are unreliable. Google Books sometimes labels
 * a Spanish edition "en" (and vice versa); Open Library editions often have
 * no language at all. A strict equality check then rejects LEGITIMATE
 * translations ([MERGE_POLICY] language_mismatch on real Spanish editions),
 * while still being fooled by records whose label lies the other way.
 *
 * THE SYSTEM: instead of trusting the label alone, combine three signals —
 *   1. the provider's language label (normalized),
 *   2. text evidence from the description (stopword profiling; descriptions
 *      are long enough to be reliable),
 *   3. the langRestrict we used in the query (weak — GB does not guarantee it).
 *
 * Verdicts:
 *   "match"    — label says the wanted language and nothing contradicts it.
 *   "likely"   — label missing/incorrect, but TEXT EVIDENCE shows the wanted
 *                language (e.g. GB labels "Amanecer rojo" as en but the
 *                description is plainly Spanish).
 *   "unknown"  — no label and no usable text evidence. NOT safe to use.
 *   "mismatch" — evidence points to another language. Never use.
 *
 * SAFETY INVARIANT (the strict policy is NOT relaxed): only "match"/"likely"
 * are accepted for language-locked fields, and "likely" requires REAL text
 * evidence in the wanted language — an English record can never slip into a
 * Spanish edition because English text yields an English detection.
 */
import { languageCode } from "./languageUtils";

// ─── Text-based language detection (stopword profiles) ───────────────────────

/** High-frequency function words per priority language. Diacritics kept —
 *  they are themselves evidence (e.g. "más", "está", "também"). */
const STOPWORD_PROFILES: Record<string, ReadonlySet<string>> = {
  en: new Set(["the", "and", "of", "to", "in", "is", "was", "that", "his", "her", "with", "for", "as", "are", "this", "from", "they", "she", "will", "have", "has", "who", "when", "their", "them"]),
  es: new Set(["el", "la", "los", "las", "de", "del", "y", "en", "que", "un", "una", "es", "por", "con", "para", "su", "se", "más", "como", "está", "pero", "sus", "este", "esta", "donde", "cuando"]),
  fr: new Set(["le", "la", "les", "des", "de", "du", "et", "en", "que", "un", "une", "est", "pour", "dans", "qui", "au", "sur", "avec", "son", "ses", "plus", "mais", "quand", "où", "cette"]),
  de: new Set(["der", "die", "das", "und", "ist", "von", "mit", "für", "ein", "eine", "zu", "den", "im", "auf", "nicht", "sich", "sie", "wird", "als", "auch", "dem", "des", "nach", "bei"]),
  it: new Set(["il", "lo", "la", "gli", "le", "di", "e", "che", "un", "una", "è", "per", "con", "del", "della", "nel", "si", "non", "più", "come", "suo", "sua", "ma", "dei", "alla"]),
  pt: new Set(["o", "os", "as", "de", "do", "da", "dos", "das", "e", "que", "um", "uma", "é", "para", "com", "em", "no", "na", "seu", "sua", "mais", "como", "mas", "quando", "também"]),
  nl: new Set(["de", "het", "een", "en", "van", "is", "dat", "op", "te", "met", "voor", "zijn", "niet", "aan", "door", "wordt", "ook", "naar", "uit", "als", "maar", "haar", "hij", "zij"]),
};

const MIN_WORDS_FOR_DETECTION = 12;
const MIN_HITS = 3;
const DOMINANCE = 1.5; // winner must beat runner-up by 50%

/**
 * Detect the language of a text from stopword frequency.
 * Returns an ISO 639-1 code, or undefined when the text is too short or
 * ambiguous. Designed for descriptions/synopses — NOT reliable for titles.
 */
export function detectLanguageFromText(text?: string): string | undefined {
  if (!text) return undefined;
  const words = text.toLowerCase().split(/[^a-záéíóúüñàèìòùâêîôûäöëïç]+/i).filter(Boolean);
  if (words.length < MIN_WORDS_FOR_DETECTION) return undefined;

  const scores: Array<{ code: string; hits: number }> = Object.entries(STOPWORD_PROFILES)
    .map(([code, profile]) => ({ code, hits: words.filter((w) => profile.has(w)).length }))
    .sort((a, b) => b.hits - a.hits);

  const [winner, runnerUp] = scores;
  if (!winner || winner.hits < MIN_HITS) return undefined;
  if (runnerUp && winner.hits < runnerUp.hits * DOMINANCE) return undefined;
  return winner.code;
}

// ─── Confidence verdict ───────────────────────────────────────────────────────

export type LanguageMatchVerdict = "match" | "likely" | "unknown" | "mismatch";

export type LanguageEvidenceInput = {
  /** Provider's language label (code or display name), possibly wrong/missing. */
  providerLanguage?: string;
  /** Candidate description/synopsis — the strongest text evidence. */
  description?: string;
  /** langRestrict used in the query that produced this candidate (weak signal). */
  queryLangRestrict?: string;
};

/**
 * How confident are we that this candidate is in the wanted language?
 *
 * Decision table (provider label × description detection):
 *   label=wanted + text=wanted/none  → match
 *   label=wanted + text=OTHER       → mismatch  (label lies — protects the
 *                                                 Spanish book from an English
 *                                                 record labeled "es")
 *   label=other  + text=wanted      → likely    (label lies the other way —
 *                                                 rescues real translations)
 *   label=other  + text=other/none  → mismatch
 *   no label     + text=wanted      → likely
 *   no label     + text=other       → mismatch
 *   no label     + no text          → langRestrict=wanted ? unknown : unknown
 *                                      (never auto-accepted either way)
 */
export function assessLanguageMatch(
  wantedLanguage: string,
  input: LanguageEvidenceInput
): LanguageMatchVerdict {
  const wanted = languageCode(wantedLanguage);
  if (!wanted) return "unknown";

  const label = languageCode(input.providerLanguage);
  const text = detectLanguageFromText(input.description);

  if (label === wanted) {
    return text && text !== wanted ? "mismatch" : "match";
  }
  if (label && label !== wanted) {
    return text === wanted ? "likely" : "mismatch";
  }
  // No provider label:
  if (text === wanted) return "likely";
  if (text) return "mismatch";
  return "unknown";
}

/** Locked-field gate: only confident verdicts may touch language-locked data. */
export function isLanguageAcceptable(verdict: LanguageMatchVerdict): boolean {
  return verdict === "match" || verdict === "likely";
}
