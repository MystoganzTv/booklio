/**
 * languageEvidence — pins the confidence system that replaced strict label
 * equality. SAFETY INVARIANT: English metadata can never be accepted for a
 * Spanish edition; legitimate translations with lying labels are rescued.
 */
import {
  assessLanguageMatch,
  detectLanguageFromText,
  isLanguageAcceptable,
} from "../languageEvidence";

const ES_TEXT =
  "Darrow es un Rojo, un miembro de la casta más baja en la sociedad del futuro. " +
  "Trabaja en las minas de Marte para que las generaciones que vienen puedan vivir en la superficie.";
const EN_TEXT =
  "Darrow is a Red, a member of the lowest caste in the color-coded society of the future. " +
  "He works the mines of Mars so that future generations can live on the surface of the planet.";
const FR_TEXT =
  "Darrow est un Rouge, un membre de la caste la plus basse dans la société du futur. " +
  "Il travaille dans les mines de Mars pour que les générations futures puissent vivre à la surface.";

describe("detectLanguageFromText", () => {
  it("detects Spanish, English and French prose", () => {
    expect(detectLanguageFromText(ES_TEXT)).toBe("es");
    expect(detectLanguageFromText(EN_TEXT)).toBe("en");
    expect(detectLanguageFromText(FR_TEXT)).toBe("fr");
  });

  it("returns undefined for short or empty text (titles are not evidence)", () => {
    expect(detectLanguageFromText("Red Rising")).toBeUndefined();
    expect(detectLanguageFromText("Amanecer rojo")).toBeUndefined();
    expect(detectLanguageFromText("")).toBeUndefined();
    expect(detectLanguageFromText(undefined)).toBeUndefined();
  });
});

describe("assessLanguageMatch — decision table", () => {
  it("label=wanted, text agrees or absent → match", () => {
    expect(assessLanguageMatch("Spanish", { providerLanguage: "Spanish", description: ES_TEXT })).toBe("match");
    expect(assessLanguageMatch("Spanish", { providerLanguage: "es" })).toBe("match");
  });

  it("label=wanted but text is ANOTHER language → mismatch (label lies)", () => {
    // An English record labeled "es" must NOT slip into a Spanish edition.
    expect(assessLanguageMatch("Spanish", { providerLanguage: "es", description: EN_TEXT })).toBe("mismatch");
  });

  it("label=other but text IS the wanted language → likely (legit translation rescued)", () => {
    // GB labels "Amanecer rojo" as en, but the description is plainly Spanish.
    expect(assessLanguageMatch("Spanish", { providerLanguage: "en", description: ES_TEXT })).toBe("likely");
  });

  it("label=other, text agrees with label or absent → mismatch", () => {
    expect(assessLanguageMatch("Spanish", { providerLanguage: "en", description: EN_TEXT })).toBe("mismatch");
    expect(assessLanguageMatch("Spanish", { providerLanguage: "en" })).toBe("mismatch");
  });

  it("no label: text decides; nothing → unknown (never auto-accepted)", () => {
    expect(assessLanguageMatch("Spanish", { description: ES_TEXT })).toBe("likely");
    expect(assessLanguageMatch("Spanish", { description: EN_TEXT })).toBe("mismatch");
    expect(assessLanguageMatch("Spanish", {})).toBe("unknown");
    expect(assessLanguageMatch("Spanish", { queryLangRestrict: "es" })).toBe("unknown");
  });

  it("only match/likely are acceptable for locked fields", () => {
    expect(isLanguageAcceptable("match")).toBe(true);
    expect(isLanguageAcceptable("likely")).toBe(true);
    expect(isLanguageAcceptable("unknown")).toBe(false);
    expect(isLanguageAcceptable("mismatch")).toBe(false);
  });
});
