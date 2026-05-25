import { LinearGradient } from "expo-linear-gradient";
import { ImageBackground, StyleSheet, Text, View } from "react-native";
import { Book } from "../types/models";
import { colors, fonts, radii, shadows } from "../theme/theme";
import { Badge } from "./Badge";
import { ProgressRing } from "./ProgressRing";

type BookCoverProps = {
  book: Book;
  size?: "sm" | "md" | "lg";
};

const dimensions = {
  sm: { width: 82, height: 122 },
  md: { width: 112, height: 164 },
  lg: { width: 176, height: 252 }
};

const isMuted = (book: Book) =>
  ["want-to-read", "wishlist", "want-to-buy", "upcoming-release"].includes(book.userStatus.status);

export function BookCover({ book, size = "md" }: BookCoverProps) {
  const muted = isMuted(book);
  const dimmed = book.userStatus.status === "dnf";
  const gradient = muted ? (["#CBC6BE", "#827C73"] as [string, string]) : book.coverGradient;

  return (
    <View style={[styles.wrap, dimensions[size], dimmed && styles.dimmed]}>
      {book.coverImageUri ? (
        <ImageBackground source={{ uri: book.coverImageUri }} style={styles.cover} imageStyle={styles.imageCover}>
          {muted ? <View style={styles.mutedOverlay} /> : null}
          <CoverContent book={book} size={size} />
        </ImageBackground>
      ) : (
        <LinearGradient colors={gradient} style={styles.cover}>
          <CoverContent book={book} size={size} />
        </LinearGradient>
      )}
    </View>
  );
}

function CoverContent({ book, size }: BookCoverProps) {
  return (
    <>
        <View style={styles.sheen} />
        <Text numberOfLines={4} style={[styles.title, size === "sm" && styles.smallTitle]}>
          {book.title}
        </Text>
        {book.seriesNumber ? <Text style={styles.series}>Book {book.seriesNumber}</Text> : null}
        {book.userStatus.status === "reading" ? (
          <View style={styles.progress}>
            <ProgressRing progress={book.userStatus.progressPercent} size={size === "lg" ? 48 : 36} />
          </View>
        ) : null}
        {book.userStatus.status === "dnf" ? (
          <View style={styles.badge}>
            <Badge label="DNF" tone="danger" />
          </View>
        ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...shadows.card,
    borderRadius: radii.md,
    overflow: "hidden"
  },
  cover: {
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "flex-end",
    overflow: "hidden",
    padding: 12
  },
  imageCover: {
    borderRadius: radii.md
  },
  mutedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(130,124,115,0.48)"
  },
  sheen: {
    backgroundColor: "rgba(255,255,255,0.16)",
    height: 180,
    left: -70,
    position: "absolute",
    top: -35,
    transform: [{ rotate: "24deg" }],
    width: 58
  },
  title: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 25,
    textShadowColor: "rgba(15,23,42,0.34)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8
  },
  smallTitle: {
    fontSize: 15,
    lineHeight: 18
  },
  series: {
    color: "rgba(255,255,255,0.86)",
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
    textTransform: "uppercase"
  },
  progress: {
    position: "absolute",
    right: 8,
    top: 8
  },
  badge: {
    left: 8,
    position: "absolute",
    top: 8
  },
  dimmed: {
    opacity: 0.52
  }
});
