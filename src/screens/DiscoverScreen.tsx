/**
 * DiscoverScreen
 *
 * A catalog browse experience — NOT your personal library.
 * Everything here searches the global Google Books catalog.
 *
 * Sections:
 *   - Real search bar → catalog keyword search
 *   - Browse by mood  → catalog search with mood keywords
 *   - Browse by genre → catalog subject browse
 *   - Popular searches → quick chips
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { RootStackParamList, MainTabParamList } from "../navigation/types";
import { AppColors, fonts, radii, shadows, spacing } from "../theme/theme";
import { useColors } from "../theme/ThemeContext";

// ─── Mood → catalog query ─────────────────────────────────────────────────────

type Mood = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  grad: [string, string];
  catalogQuery: string;
};

const MOODS: Mood[] = [
  { id: "exciting",   label: "Exciting",             icon: "flash",          grad: ["#E65C00", "#F9D423"], catalogQuery: "thrilling adventure action packed"        },
  { id: "scary",      label: "Scary",                icon: "moon",           grad: ["#0D0D1A", "#1a0533"], catalogQuery: "horror scary supernatural dark"            },
  { id: "thought",    label: "Thought-provoking",    icon: "bulb-outline",   grad: ["#134E5E", "#71B280"], catalogQuery: "thought provoking philosophical literary"  },
  { id: "inspiring",  label: "Inspiring",            icon: "sunny",          grad: ["#B34700", "#FFB347"], catalogQuery: "inspiring uplifting motivational memoir"    },
  { id: "heartfelt",  label: "Heartfelt",            icon: "heart",          grad: ["#833ab4", "#fd1d1d"], catalogQuery: "emotional heartfelt love story romance"     },
  { id: "dark",       label: "Dark & Grim",          icon: "thunderstorm",   grad: ["#0f0c29", "#302b63"], catalogQuery: "dark fantasy grimdark grim gothic"          },
  { id: "feelgood",   label: "Feel-good",            icon: "happy",          grad: ["#1D976C", "#93F9B9"], catalogQuery: "feel good uplifting cozy warm"              },
  { id: "gripping",   label: "Emotionally gripping", icon: "musical-notes",  grad: ["#4B0082", "#8A2BE2"], catalogQuery: "gripping page turner emotional drama"       },
  { id: "funny",      label: "Funny",                icon: "happy-outline",  grad: ["#FF512F", "#F09819"], catalogQuery: "funny humorous comedy satire witty"         },
  { id: "cozy",       label: "Cozy",                 icon: "cafe",           grad: ["#6f4e37", "#c8a97e"], catalogQuery: "cozy mystery cozy fantasy comfort read"      },
  { id: "fastpaced",  label: "Fast-paced",           icon: "speedometer",    grad: ["#8B0000", "#FF4500"], catalogQuery: "fast paced action thriller suspense"         },
  { id: "epic",       label: "Epic",                 icon: "shield",         grad: ["#1a1a2e", "#16213e"], catalogQuery: "epic fantasy adventure saga series"          },
];

// ─── Genre catalog list (hardcoded — not from user's library) ─────────────────

const CATALOG_GENRES: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { label: "Fantasy",          icon: "sparkles-outline",   color: "#7F77DD" },
  { label: "Science Fiction",  icon: "planet-outline",     color: "#2196F3" },
  { label: "Mystery",          icon: "search-outline",     color: "#9B59B6" },
  { label: "Thriller",         icon: "warning-outline",    color: "#C0392B" },
  { label: "Romance",          icon: "heart-outline",      color: "#E91E63" },
  { label: "Horror",           icon: "moon-outline",       color: "#B71C1C" },
  { label: "Historical Fiction",icon: "time-outline",      color: "#856404" },
  { label: "Literary Fiction", icon: "book-outline",       color: "#37474F" },
  { label: "Biography",        icon: "person-outline",     color: "#0E9E93" },
  { label: "Nonfiction",       icon: "newspaper-outline",  color: "#3D6B30" },
  { label: "Adventure",        icon: "compass-outline",    color: "#E65C00" },
  { label: "Young Adult",      icon: "star-outline",       color: "#F59E0B" },
];

// ─── Popular search chips ─────────────────────────────────────────────────────

const POPULAR_SEARCHES = [
  "Award winners 2024",
  "Book club picks",
  "Dark academia",
  "Cozy mysteries",
  "Enemies to lovers",
  "Sci-fi classics",
  "Historical thrillers",
  "True crime",
  "Coming of age",
  "Magical realism",
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export function DiscoverScreen() {
  const c = useColors();
  const navigation = useNavigation<NavigationProp<RootStackParamList & MainTabParamList>>();
  const styles = useMemo(() => createStyles(c), [c]);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  function goToCatalog(query: string, title?: string) {
    if (!query.trim()) return;
    navigation.navigate("GenreBrowse", {
      genre: title ?? query,
      title: title ?? query,
      catalogQuery: query,
    });
    setSearchQuery("");
    inputRef.current?.blur();
  }

  function goToGenre(genre: string) {
    navigation.navigate("GenreBrowse", { genre });
  }

  return (
    <Screen>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <Text style={styles.headerSub}>Millions of books. Find your next obsession.</Text>
      </View>

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={c.muted} style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          style={[styles.searchInput, { color: c.ink }]}
          placeholder="Search any book, author, genre…"
          placeholderTextColor={c.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => goToCatalog(searchQuery)}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.trim().length > 0 && (
          <Pressable
            style={[styles.searchGoBtn, { backgroundColor: c.teal }]}
            onPress={() => goToCatalog(searchQuery)}
          >
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </Pressable>
        )}
      </View>

      {/* ── Browse by mood ─────────────────────────────────────────────────── */}
      <SectionHeader title="Browse by mood" />
      <View style={styles.moodGrid}>
        {MOODS.map((mood) => (
          <Pressable
            key={mood.id}
            style={styles.moodItem}
            onPress={() => goToCatalog(mood.catalogQuery, mood.label)}
          >
            <LinearGradient
              colors={mood.grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.moodIcon}
            >
              <Ionicons name={mood.icon} size={28} color="rgba(255,255,255,0.92)" />
            </LinearGradient>
            <Text style={[styles.moodLabel, { color: c.ink }]}>{mood.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── Browse by genre ────────────────────────────────────────────────── */}
      <SectionHeader title="Browse by genre" />
      <View style={styles.genreGrid}>
        {CATALOG_GENRES.map((g) => (
          <Pressable
            key={g.label}
            style={[styles.genreCard, { backgroundColor: g.color + "18", borderColor: g.color + "44" }]}
            onPress={() => goToGenre(g.label)}
          >
            <Ionicons name={g.icon} size={18} color={g.color} />
            <Text style={[styles.genreLabel, { color: g.color }]} numberOfLines={1}>{g.label}</Text>
            <Ionicons name="chevron-forward" size={13} color={g.color} style={{ opacity: 0.5, marginLeft: "auto" }} />
          </Pressable>
        ))}
      </View>

      {/* ── Popular searches ───────────────────────────────────────────────── */}
      <SectionHeader title="Popular searches" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        {POPULAR_SEARCHES.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, { borderColor: c.border, backgroundColor: c.surface }]}
            onPress={() => goToCatalog(s, s)}
          >
            <Text style={[styles.chipText, { color: c.ink }]}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    header: {
      marginBottom: spacing.lg,
    },
    headerTitle: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 30,
      fontWeight: "900",
    },
    headerSub: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 4,
    },

    // ── Search ─────────────────────────────────────────────────────────────
    searchRow: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: radii.md,
      borderWidth: 1,
      flexDirection: "row",
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.md,
      ...shadows.card,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "700",
      paddingVertical: 14,
    },
    searchGoBtn: {
      alignItems: "center",
      borderRadius: 10,
      height: 34,
      justifyContent: "center",
      marginLeft: 8,
      width: 34,
    },

    // ── Mood grid ──────────────────────────────────────────────────────────
    moodGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginBottom: spacing.sm,
    },
    moodItem: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      paddingVertical: 9,
      width: "50%",
    },
    moodIcon: {
      alignItems: "center",
      borderRadius: 14,
      height: 64,
      justifyContent: "center",
      overflow: "hidden",
      width: 64,
    },
    moodLabel: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
      lineHeight: 19,
    },

    // ── Genre grid ──────────────────────────────────────────────────────────
    genreGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: spacing.lg,
    },
    genreCard: {
      alignItems: "center",
      borderRadius: radii.sm,
      borderWidth: 1,
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 13,
      width: "47%",
    },
    genreLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900",
    },

    // ── Popular chips ───────────────────────────────────────────────────────
    chipsScroll: { marginHorizontal: -spacing.md, marginBottom: spacing.xl },
    chipsContent: { gap: 8, paddingHorizontal: spacing.md, paddingBottom: 4 },
    chip: {
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    chipText: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
    },
  });
}
