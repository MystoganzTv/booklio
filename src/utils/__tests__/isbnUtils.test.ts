/** isbnUtils — checksum math and parsing. Real ISBNs, no mocks. */
import {
  cleanIsbn,
  isbn10ToIsbn13,
  isbn13ToIsbn10,
  isValidIsbn,
  parseIsbn,
  validateIsbn10,
  validateIsbn13,
} from "../isbnUtils";

describe("cleanIsbn", () => {
  it("strips separators and noise", () => {
    expect(cleanIsbn("978-0-7564-0474-1")).toBe("9780756404741");
    expect(cleanIsbn(" 0 7564 0474 X ")).toBe("0756404 74X".replace(/\s/g, "").toUpperCase().replace(/[^0-9X]/g, "") || cleanIsbn("075640474X"));
  });
});

describe("validateIsbn13 / validateIsbn10", () => {
  it("accepts real ISBNs", () => {
    expect(validateIsbn13("9780756404741")).toBe(true); // The Name of the Wind
    expect(validateIsbn13("9780441172719")).toBe(true); // Dune
    expect(validateIsbn10("0756404746")).toBe(true);
  });
  it("rejects bad checksums and lengths", () => {
    expect(validateIsbn13("9780756404742")).toBe(false);
    expect(validateIsbn13("978075640474")).toBe(false);
    expect(validateIsbn10("0756404745")).toBe(false);
  });
});

describe("isbn10 ↔ isbn13 conversion", () => {
  it("round-trips", () => {
    const thirteen = isbn10ToIsbn13("0756404746");
    expect(thirteen).toBe("9780756404741");
    expect(isbn13ToIsbn10("9780756404741")).toBe("0756404746");
  });
  it("returns null for invalid input", () => {
    expect(isbn10ToIsbn13("not-an-isbn")).toBeNull();
  });
});

describe("parseIsbn", () => {
  it("parses 13-digit input", () => {
    const parsed = parseIsbn("978-0-7564-0474-1");
    expect(parsed?.isbn13).toBe("9780756404741");
  });
  it("parses 10-digit input and derives the 13", () => {
    const parsed = parseIsbn("0756404746");
    expect(parsed?.isbn13).toBe("9780756404741");
  });
  it("rejects garbage", () => {
    expect(parseIsbn("hello world")).toBeNull();
    expect(parseIsbn("12345")).toBeNull();
  });
});

describe("isValidIsbn", () => {
  it("matches parseIsbn behavior", () => {
    expect(isValidIsbn("9780441172719")).toBe(true);
    expect(isValidIsbn("12345")).toBe(false);
  });
});
