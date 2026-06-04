export type RootStackParamList = {
  OnboardingWelcome: undefined;
  OnboardingName: undefined;
  OnboardingGenres: { name: string };
  Welcome: undefined;
  AppTabs: undefined;
  BookDetail: { bookId: string };
  ReadingLog: { bookId?: string };
  AddReadingSession: { bookId?: string; sessionId?: string };
  BookIntake:
    | {
        autoRun?: boolean;
        initialMode?: "search";
        initialQuery?: string;
        initialSearchIntent?: "auto" | "author" | "series";
        initialBookSelection?: {
          title: string;
          authorName: string;
          isbn?: string;
          pages?: number;
          genre?: string[];
          publishedDate?: string;
          language?: string;
          synopsis?: string;
          coverImageUri?: string;
        };
      }
    | undefined;
  SeriesTracker: { seriesId: string };
  EditProfile: undefined;
  Settings: undefined;
  EditBook: { bookId: string };
  Achievements: undefined;
  WriteReview: { bookId: string };
  GenreBrowse: {
    genre: string;
    /** Optional display title override (e.g. "Funny Books") */
    title?: string;
    /** If provided, does a keyword search instead of subject search */
    catalogQuery?: string;
    /** Optional editorial seed titles to prioritize first */
    curatedTitles?: Array<{ title: string; author?: string }>;
  };
};

export type MainTabParamList = {
  Home: undefined;
  Library: undefined;
  Add: undefined;
  Discover: undefined;
  Profile: undefined;
};
