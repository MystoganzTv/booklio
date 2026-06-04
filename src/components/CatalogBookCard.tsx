/**
 * CatalogBookCard
 *
 * A small book card used in recommendation / discovery rails.
 * Renders null if the cover image fails to load — keeps rails clean
 * with no blank squares or "image not available" placeholders.
 */

import React, { useState } from "react";
import {
  Image,
  ImageStyle,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { GenreBookResult } from "../services/googleBooksProvider";

type CatalogBookCardProps = {
  book: GenreBookResult;
  onPress: (book: GenreBookResult) => void;
  cardStyle?: StyleProp<ViewStyle>;
  coverStyle?: StyleProp<ImageStyle>;
  titleStyle?: StyleProp<TextStyle>;
  authorStyle?: StyleProp<TextStyle>;
  metaStyle?: StyleProp<TextStyle>;
  showYear?: boolean;
};

export function CatalogBookCard({
  book,
  onPress,
  cardStyle,
  coverStyle,
  titleStyle,
  authorStyle,
  metaStyle,
  showYear = false,
}: CatalogBookCardProps) {
  const [coverError, setCoverError] = useState(false);

  // Hide the entire card if the cover fails to load — no blank squares in rails
  if (coverError) return null;

  return (
    <Pressable style={cardStyle} onPress={() => onPress(book)}>
      <Image
        source={{ uri: book.coverUrl }}
        style={coverStyle}
        resizeMode="cover"
        onError={() => setCoverError(true)}
      />
      <Text style={[styles.title, titleStyle]} numberOfLines={2}>
        {book.title}
      </Text>
      <Text style={[styles.author, authorStyle]} numberOfLines={1}>
        {book.authors[0] ?? ""}
      </Text>
      {showYear && book.publishedYear ? (
        <Text style={metaStyle}>{book.publishedYear}</Text>
      ) : null}
    </Pressable>
  );
}

// Base styles — screens override via cardStyle / coverStyle / titleStyle / authorStyle
const styles = StyleSheet.create({
  title: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  author: {
    fontSize: 11,
    marginTop: 2,
  },
});
