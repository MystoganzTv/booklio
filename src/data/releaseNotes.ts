/**
 * Booklio release notes.
 *
 * Each entry maps to an app version string (must match app.json `version`).
 * Sections: "new" (blue), "improved" (gold), "fixed" (green).
 */

export type ReleaseSection = {
  type: "new" | "improved" | "fixed";
  items: string[];
};

export type ReleaseEntry = {
  version: string;
  label: string;   // display date or subtitle
  sections: ReleaseSection[];
};

export const RELEASE_NOTES: ReleaseEntry[] = [
  {
    version: "1.0.0",
    label: "May 2026",
    sections: [
      {
        type: "new",
        items: [
          "Multi-source ISBN lookup — Google Books and Open Library searched in parallel",
          "Match confidence scores — High, Medium, Low ranked results before you save",
          "Torch & zoom controls on the ISBN scanner for small barcodes",
          "Cover photo intake — your photo is saved as cover art, ready for metadata refresh",
          "What's New screen — see what changed each time you update",
          "Custom reading lists — organize your library into any collection you create",
        ],
      },
      {
        type: "improved",
        items: [
          "Book search now draws from two sources for broader results",
          "ISBN scanner debounces duplicates and validates before looking anything up",
          "Navigating away from Add Book resets the flow automatically",
          "Reading level is earned automatically based on books completed — not self-assigned",
        ],
      },
    ],
  },
];
