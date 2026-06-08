# Bookliz

Bookliz is a premium, mobile-first Expo app for personal book tracking, collection management, reading session logs, saga tracking, stats, wishlists, and recommendations.

## Run

```sh
npm install
npm run start
```

## Verify

```sh
npm run typecheck
npx expo export --platform ios --output-dir dist
```

## Included

- React Native + Expo + TypeScript app structure.
- Bottom tab navigation: Home, Library, Add, Stats, Profile.
- Stack flows for Book Detail, Reading Log, Add Reading Session, and Saga Tracker.
- Backend-ready TypeScript models for books, authors, series, user status, sessions, logs, reviews, achievements, recommendations, and profile data.
- Local mock data with 13 books and 10 detailed reading sessions.
- In-memory session logging that recalculates pages read, pages/hour, progress, status, streaks, and stats.
