/**
 * readingIdentity — pins the Phase 1 contract:
 * real signals in, honest profile out; DNF = negative; generic genres ignored;
 * recency decay favors current taste; summaryKeys are i18n keys, never prose.
 */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import { computeReadingIdentity } from "../readingIdentity";
import { Author, Book, ReadingSession, Review } from "../../types/models";

const NOW = new Date("2026-06-10T12:00:00Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString().slice(0, 10);

const author = (id: string, name: string): Author =>
  ({ id, name, bio: "", favoriteGenres: [] } as Author);

const book = (over: Partial<Book> & { id: string; authorId: string }): Book =>
  ({
    title: over.id,
    synopsis: "",
    genre: [],
    pages: 400,
    publishedDate: "",
    publisher: "",
    language: "English",
    isbn: "",
    format: "paperback",
    coverGradient: ["#000", "#111"],
    userStatus: {
      status: "want-to-read",
      ownership: "owned",
      wishlist: false,
      wantToBuy: false,
      readCount: 0,
      progressPercent: 0,
      notes: "",
      favoriteQuotes: [],
      ...(over.userStatus ?? {}),
    },
    ...over,
  } as Book);

const session = (over: Partial<ReadingSession> & { id: string; bookId: string; date: string }): ReadingSession =>
  ({
    startPage: 1, endPage: 30, pagesRead: 30, minutesRead: 30,
    location: "Home", mood: "—", format: "paperback", notes: "",
    difficulty: "moderate", enjoymentRating: 7, pagesPerHour: 60,
    ...over,
  } as ReadingSession);

const fixtures = () => {
  const authors = [author("a-yarros", "Rebecca Yarros"), author("a-tolle", "Eckhart Tolle"), author("a-king", "Stephen King")];
  const books: Book[] = [
    book({ id: "b1", authorId: "a-yarros", genre: ["Fantasy", "Romance", "Fiction"], seriesName: "The Empyrean", seriesNumber: 1,
      userStatus: { status: "read", rating: 5, finishDate: daysAgo(10) } as Book["userStatus"], format: "kindle", language: "Spanish" }),
    book({ id: "b2", authorId: "a-yarros", genre: ["Fantasy", "Fiction"], seriesName: "The Empyrean", seriesNumber: 2,
      userStatus: { status: "reading", startDate: daysAgo(3), progressPercent: 40 } as Book["userStatus"], format: "audiobook", language: "Spanish" }),
    book({ id: "b3", authorId: "a-tolle", genre: ["Self-Help", "Nonfiction"],
      userStatus: { status: "read", rating: 3, finishDate: daysAgo(300) } as Book["userStatus"], language: "English" }),
    book({ id: "b4", authorId: "a-king", genre: ["Horror", "Fiction"],
      userStatus: { status: "dnf", startDate: daysAgo(20) } as Book["userStatus"], language: "English" }),
  ];
  const sessions: ReadingSession[] = [
    session({ id: "s1", bookId: "b1", date: daysAgo(12), format: "kindle", pagesPerHour: 55, minutesRead: 40 }),
    session({ id: "s2", bookId: "b1", date: daysAgo(11), format: "kindle", pagesPerHour: 65, minutesRead: 50 }),
    session({ id: "s3", bookId: "b2", date: daysAgo(2), format: "audiobook", pagesPerHour: 0, minutesRead: 60 }),
    session({ id: "s4", bookId: "b2", date: daysAgo(1), format: "audiobook", pagesPerHour: 0, minutesRead: 55 }),
  ];
  const reviews: Review[] = [
    { id: "r1", bookId: "b1", rating: 5, title: "Wow", body: "…", createdAt: daysAgo(9) } as Review,
  ];
  return { authors, books, readingSessions: sessions, reviews };
};

describe("computeReadingIdentity", () => {
  const identity = computeReadingIdentity(fixtures(), NOW);

  it("ranks Fantasy on top and ignores generic 'Fiction'", () => {
    expect(identity.genres[0]?.name).toBe("Fantasy");
    expect(identity.genres.find((g) => g.name.toLowerCase() === "fiction")).toBeUndefined();
  });

  it("recency decay: recent fantasy outweighs the 300-day-old self-help read", () => {
    const fantasy = identity.genres.find((g) => g.name === "Fantasy")!.weight;
    const selfHelp = identity.genres.find((g) => g.name === "Self-Help")?.weight ?? 0;
    expect(fantasy).toBeGreaterThan(selfHelp);
  });

  it("top author is the loved one, with the real entity id", () => {
    expect(identity.authors[0]?.name).toBe("Rebecca Yarros");
    expect(identity.authors[0]?.authorId).toBe("a-yarros");
  });

  it("DNF produces negative signals — and never positive ones", () => {
    expect(identity.negatives.some((n) => n.kind === "genre" && n.name === "Horror")).toBe(true);
    expect(identity.negatives.some((n) => n.kind === "author" && n.name === "Stephen King")).toBe(true);
    expect(identity.genres.find((g) => g.name === "Horror")).toBeUndefined();
  });

  it("tracks series progress honestly", () => {
    const empyrean = identity.series.find((s) => s.name === "The Empyrean");
    expect(empyrean).toBeDefined();
    expect(empyrean!.progress).toBe(50); // 1 of 2 read
    expect(empyrean!.completed).toBe(false);
  });

  it("computes pace from real sessions only", () => {
    expect(identity.pace.pagesPerHourDigital).toBe(60); // (55+65)/2
    expect(identity.pace.pagesPerHourPrint).toBeUndefined(); // no print sessions
    expect(identity.pace.minutesPerSessionAvg).toBeGreaterThan(0);
  });

  it("habits: finish rate counts read vs dnf", () => {
    expect(identity.habits.finishRate).toBeCloseTo(2 / 3, 2); // 2 read, 1 dnf
    expect(identity.habits.favoriteLocation).toBe("Home");
  });

  it("language and format shares reflect the library", () => {
    expect(identity.languages[0]?.language).toBe("Spanish"); // 2 of 4
    expect(identity.formats.some((f) => f.format === "audio")).toBe(true);
  });

  it("summaryKeys are i18n keys with params — never free prose", () => {
    expect(identity.summaryKeys.length).toBeGreaterThan(0);
    for (const sk of identity.summaryKeys) {
      expect(sk.key).toMatch(/^identity\./);
    }
    const top = identity.summaryKeys.find((sk) => sk.key === "identity.topGenres");
    expect(top?.params?.a).toBe("Fantasy");
  });

  it("is deterministic for a fixed clock", () => {
    const again = computeReadingIdentity(fixtures(), NOW);
    expect(again).toEqual(identity);
  });

  it("handles an empty library without fabricating taste", () => {
    const empty = computeReadingIdentity({ authors: [], books: [], readingSessions: [], reviews: [] }, NOW);
    expect(empty.genres).toHaveLength(0);
    expect(empty.authors).toHaveLength(0);
    expect(empty.negatives).toHaveLength(0);
  });
});
