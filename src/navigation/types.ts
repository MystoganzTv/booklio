export type RootStackParamList = {
  MainTabs: undefined;
  BookDetail: { bookId: string };
  ReadingLog: { bookId?: string };
  AddReadingSession: { bookId?: string; sessionId?: string };
  BookIntake: undefined;
  SeriesTracker: { seriesId: string };
  EditProfile: undefined;
  EditBook: { bookId: string };
  Achievements: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Library: undefined;
  Add: undefined;
  Stats: undefined;
  Profile: undefined;
};
