import { ImageSourcePropType } from "react-native";
import { Achievement } from "../types/models";

const achievementIconSources: Partial<Record<Achievement["id"], ImageSourcePropType>> = {
  "ach-1-book": require("../../assets/achievements/first-book.png"),
  "ach-daily": require("../../assets/achievements/streak-7.png"),
  "ach-night-reading": require("../../assets/achievements/night-reading.png"),
  "ach-early-bird": require("../../assets/achievements/morning-reader.png"),
  "ach-10-books": require("../../assets/achievements/ten-books.png"),
  "ach-50-books": require("../../assets/achievements/fifty-books.png"),
  "ach-100-books": require("../../assets/achievements/hundred-books.png"),
  "ach-1k-pages": require("../../assets/achievements/thousand-pages.png"),
  "ach-saga-1": require("../../assets/achievements/saga-finished.png"),
  "ach-fantasy": require("../../assets/achievements/fantasy-explorer.png"),
  "ach-scifi": require("../../assets/achievements/scifi-traveler.png"),
  "ach-romance": require("../../assets/achievements/romance-reader.png"),
  "ach-mystery": require("../../assets/achievements/mystery-hunter.png"),
  "ach-around-world": require("../../assets/achievements/around-world.png"),
  "ach-genre-5": require("../../assets/achievements/genre-explorer.png"),
  "ach-first-review": require("../../assets/achievements/first-review.png"),
  "ach-quote-collector": require("../../assets/achievements/quote-collector.png"),
  "ach-deep-thinker": require("../../assets/achievements/deep-thinker.png"),
  "ach-goal-hit": require("../../assets/achievements/annual-goal.png"),
  "ach-epic-saga-master": require("../../assets/achievements/saga-finished.png"),
  "ach-streak-30": require("../../assets/achievements/streak-30.png"),
  "ach-marathon": require("../../assets/achievements/marathon-reader.png"),
  "ach-cozy-reader": require("../../assets/achievements/cozy-reader.png"),
  "ach-midnight": require("../../assets/achievements/midnight-reader.png"),
  "ach-speed-55": require("../../assets/achievements/speed-reader.png"),
  "ach-collector": require("../../assets/achievements/collector.png"),
  "ach-book-hunter": require("../../assets/achievements/book-hunter.png"),
  "ach-audiobook": require("../../assets/achievements/audiobook-explorer.png"),
  "ach-digital": require("../../assets/achievements/digital-reader.png"),
  "ach-big-book": require("../../assets/achievements/big-book.png"),
  "ach-night-owl": require("../../assets/achievements/night-owl.png"),
  "ach-whale-reader": require("../../assets/achievements/whale-reader.png"),
  "ach-library-builder": require("../../assets/achievements/library-builder.png"),
  "ach-legend-reader": require("../../assets/achievements/legend-reader.png"),
  "ach-reading-places": require("../../assets/achievements/reading-places.png"),
  "ach-traveller-reader": require("../../assets/achievements/traveller-reader.png"),
  "ach-coffee-shop": require("../../assets/achievements/cozy-reader.png"),
  "ach-home-reader": require("../../assets/achievements/library-builder.png"),
  "ach-park-reader": require("../../assets/achievements/reading-places.png"),
  "ach-sessions-50": require("../../assets/achievements/streak-30.png"),
  "ach-rereader": require("../../assets/achievements/first-book.png")
};

export function getAchievementIconSource(achievement: Achievement) {
  return achievementIconSources[achievement.id];
}
