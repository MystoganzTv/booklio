/**
 * genres — canonical genre normalization. Pins the Spanish/accent mappings and
 * the generic-category exclusions that ReadingIdentity depends on.
 */
import { normalizeBookGenres } from "../genres";

describe("Spanish/English genre equivalence", () => {
  it("maps accented Spanish categories to canonical English labels", () => {
    expect(normalizeBookGenres(["Fantasía"])).toContain("Fantasy");
    expect(normalizeBookGenres(["Ciencia ficción"])).toContain("Science Fiction");
    expect(normalizeBookGenres(["Misterio"])).toContain("Mystery");
    expect(normalizeBookGenres(["Suspenso"])).toContain("Thriller");
    expect(normalizeBookGenres(["Terror"])).toContain("Horror");
    expect(normalizeBookGenres(["Novela romántica"])).toContain("Romance");
    expect(normalizeBookGenres(["Autoayuda"])).toContain("Personal Growth");
    expect(normalizeBookGenres(["Biografía"])).toContain("Biography");
    expect(normalizeBookGenres(["Poesía"])).toContain("Poetry");
  });

  it("English equivalents land on the same canonical label", () => {
    expect(normalizeBookGenres(["Fantasy"])).toEqual(normalizeBookGenres(["Fantasía"]));
    expect(normalizeBookGenres(["Thriller"])).toEqual(normalizeBookGenres(["Suspenso"]));
  });
});

describe("'Body, Mind & Spirit' normalization", () => {
  it("becomes Spirituality, never raw category text", () => {
    const out = normalizeBookGenres(["Body, Mind & Spirit"]);
    expect(out).toContain("Spirituality");
    expect(out.join(" ")).not.toMatch(/body/i);
  });
  it("Spanish spirituality maps the same way", () => {
    expect(normalizeBookGenres(["Espiritualidad"])).toContain("Spirituality");
  });
});

describe("generic category exclusion", () => {
  it("drops pure catch-alls instead of passing them through", () => {
    for (const generic of ["Fiction", "Ficción", "Ficciones", "General", "Literary Collections", "Young Adult Fiction", "Novela"]) {
      const out = normalizeBookGenres([generic, "Fantasy"]);
      expect(out).toContain("Fantasy");
      expect(out.map((g) => g.toLowerCase())).not.toContain(generic.toLowerCase());
    }
  });
  it("'Juvenile Fiction' alone classifies as Children's, not as raw text", () => {
    const out = normalizeBookGenres(["Juvenile Fiction"]);
    expect(out.join(" ")).not.toMatch(/juvenile fiction/i);
  });
});
