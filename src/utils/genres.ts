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
  /winner/i
];

const GENRE_RULES: Array<{ label: string; patterns: RegExp[] }> = [
  { label: "Fantasy", patterns: [/fantasy/i, /magic/i, /dragons?/i, /epic fantasy/i] },
  { label: "Science Fiction", patterns: [/science fiction/i, /\bsci[- ]?fi\b/i, /space opera/i, /dystopi/i] },
  { label: "Mystery", patterns: [/mystery/i, /detective/i, /crime fiction/i, /whodunit/i] },
  { label: "Thriller", patterns: [/thriller/i, /suspense/i, /espionage/i] },
  { label: "Historical Fiction", patterns: [/historical/i, /history, fiction/i, /war stories/i] },
  { label: "Romance", patterns: [/romance/i, /love stories/i] },
  { label: "Horror", patterns: [/horror/i, /ghost stories/i, /supernatural fiction/i] },
  { label: "Adventure", patterns: [/adventure/i, /quests?/i, /survival/i] },
  { label: "Literary Fiction", patterns: [/literature/i, /literary/i, /\bfiction\b/i, /american literature/i] },
  { label: "Young Adult", patterns: [/young adult/i, /\bya\b/i, /teen/i] },
  { label: "Children's", patterns: [/juvenile/i, /children/i, /picture books?/i, /middle grade/i] },
  { label: "Biography", patterns: [/biograph/i, /memoir/i, /autobiograph/i] },
  { label: "Nonfiction", patterns: [/non[- ]?fiction/i] },
  { label: "History", patterns: [/history/i, /civilization/i] },
  { label: "Poetry", patterns: [/poetry/i, /poems?/i] },
  { label: "Comics", patterns: [/comics?/i, /graphic novels?/i, /manga/i] },
  { label: "Personal Growth", patterns: [/self-help/i, /personal growth/i, /habits/i, /success/i] }
];

function cleanGenreValue(raw: string) {
  return raw
    .replace(/^subjects?:/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeBookGenres(genres?: string[]) {
  if (!genres?.length) return ["Uncategorized"];

  const collected: string[] = [];

  for (const raw of genres) {
    const cleaned = cleanGenreValue(raw);
    if (!cleaned) continue;
    if (NOISE_PATTERNS.some((pattern) => pattern.test(cleaned))) continue;

    const matchedRule = GENRE_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(cleaned)));
    if (matchedRule) {
      collected.push(matchedRule.label);
      continue;
    }

    if (cleaned.includes(":")) continue;
    if (cleaned.length > 32) continue;

    const fallback = cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
    collected.push(fallback);
  }

  const unique = Array.from(new Set(collected)).slice(0, 4);
  return unique.length ? unique : ["Uncategorized"];
}
