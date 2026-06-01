export type RootStackParamList = {
  OnboardingWelcome: undefined;
  OnboardingName: undefined;
  OnboardingGenres: { name: string };
  Welcome: undefined;
  MainTabs: undefined;
  BookDetail: { bookId: string };
  ReadingLog: { bookId?: string };
  AddReadingSession: { bookId?: string; sessionId?: string };
  BookIntake: undefined;
  SeriesTracker: { seriesId: string };
  EditProfile: undefined;
  Settings: undefined;
  EditBook: { bookId: string };
  Achievements: undefined;
  WriteReview: { bookId: string };
  GenreBrowse: { genre: string };
};

export type MainTabParamList = {
  Home: undefined;
  Library: undefined;
  Add: undefined;
  Discover: undefined;
  Profile: undefined;
};
