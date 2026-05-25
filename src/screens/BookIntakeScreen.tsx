import { Ionicons } from "@expo/vector-icons";
import { CameraView, BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Badge } from "../components/Badge";
import { Screen } from "../components/Screen";
import { useBooklio } from "../data/BooklioContext";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, shadows, spacing } from "../theme/theme";
import { NewBookInput } from "../types/models";

type IntakeMode = "menu" | "isbn" | "manual" | "search";
type IconName = keyof typeof Ionicons.glyphMap;

const booklioLogo = require("../../assets/brand/booklio-logo.png");

const mockIsbnCatalog: Record<string, Omit<NewBookInput, "source">> = {
  "9780441172719": {
    title: "Dune",
    authorName: "Frank Herbert",
    isbn: "9780441172719",
    pages: 896,
    genre: ["Science Fiction", "Saga"],
    publisher: "Ace",
    publishedDate: "1965-08-01",
    language: "English",
    synopsis: "Paul Atreides enters the desert politics, ecology, prophecy, and danger of Arrakis."
  },
  "9780451524935": {
    title: "1984",
    authorName: "George Orwell",
    isbn: "9780451524935",
    pages: 328,
    genre: ["Dystopian", "Classic"],
    publisher: "Signet Classics",
    publishedDate: "1949-06-08",
    language: "English",
    synopsis: "A chilling portrait of surveillance, language control, and resistance under Big Brother."
  },
  "9780735211292": {
    title: "Atomic Habits",
    authorName: "James Clear",
    isbn: "9780735211292",
    pages: 320,
    genre: ["Personal Growth", "Nonfiction"],
    publisher: "Avery",
    publishedDate: "2018-10-16",
    language: "English",
    synopsis: "A practical system for building better habits through small, repeatable improvements."
  },
  "9780547928227": {
    title: "The Hobbit",
    authorName: "J. R. R. Tolkien",
    isbn: "9780547928227",
    pages: 300,
    genre: ["Fantasy", "Adventure"],
    publisher: "Mariner Books",
    publishedDate: "1937-09-21",
    language: "English",
    synopsis: "Bilbo Baggins leaves the Shire for dragons, dwarves, riddles, and a very consequential ring."
  },
  "9780756404741": {
    title: "The Name of the Wind",
    authorName: "Patrick Rothfuss",
    isbn: "9780756404741",
    pages: 662,
    genre: ["Fantasy", "Saga"],
    publisher: "DAW Books",
    publishedDate: "2007-03-27",
    language: "English",
    synopsis: "Kvothe recounts the first day of his life story: music, magic, reputation, and loss."
  },
  "9780590353427": {
    title: "Harry Potter and the Sorcerer's Stone",
    authorName: "J. K. Rowling",
    isbn: "9780590353427",
    pages: 309,
    genre: ["Fantasy", "Young Adult"],
    publisher: "Scholastic",
    publishedDate: "1998-09-01",
    language: "English",
    synopsis: "A boy discovers a hidden magical world and begins his first year at Hogwarts."
  },
  "9780143127741": {
    title: "Sapiens",
    authorName: "Yuval Noah Harari",
    isbn: "9780143127741",
    pages: 464,
    genre: ["History", "Nonfiction"],
    publisher: "Harper",
    publishedDate: "2015-02-10",
    language: "English",
    synopsis: "A sweeping history of humankind, from cognitive revolution to modern civilization."
  }
};

const featuredExamples = [
  "9780441172719",
  "9780451524935",
  "9780735211292",
  "9780547928227",
  "9780756404741"
];

type OpenLibraryIsbnResponse = {
  title?: string;
  authors?: { key: string }[];
  covers?: number[];
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  subjects?: string[];
  description?: string | { value?: string };
  isbn_13?: string[];
  isbn_10?: string[];
};

type OpenLibrarySearchResponse = {
  docs?: {
    title?: string;
    author_name?: string[];
    isbn?: string[];
    cover_i?: number;
    first_publish_year?: number;
    publisher?: string[];
    number_of_pages_median?: number;
    subject?: string[];
  }[];
};

const coverUrl = (coverId?: number) => (coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined);

const readDescription = (description?: string | { value?: string }) => {
  if (!description) return undefined;
  return typeof description === "string" ? description : description.value;
};

async function fetchAuthorName(authorKey?: string) {
  if (!authorKey) return undefined;
  try {
    const response = await fetch(`https://openlibrary.org${authorKey}.json`);
    const data = (await response.json()) as { name?: string };
    return data.name;
  } catch {
    return undefined;
  }
}

async function lookupByIsbn(isbn: string): Promise<NewBookInput | undefined> {
  const response = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
  if (!response.ok) return undefined;
  const data = (await response.json()) as OpenLibraryIsbnResponse;
  const authorName = await fetchAuthorName(data.authors?.[0]?.key);

  return {
    title: data.title ?? `Libro ISBN ${isbn}`,
    authorName: authorName ?? "Autor por identificar",
    isbn: data.isbn_13?.[0] ?? data.isbn_10?.[0] ?? isbn,
    pages: data.number_of_pages,
    genre: data.subjects?.slice(0, 3) ?? ["Por clasificar"],
    publisher: data.publishers?.[0],
    publishedDate: data.publish_date,
    language: "English",
    synopsis: readDescription(data.description) ?? "Metadata importada desde Open Library.",
    coverImageUri: coverUrl(data.covers?.[0]),
    source: "isbn",
    ownership: "owned"
  };
}

async function searchOpenLibrary(query: string): Promise<NewBookInput[]> {
  const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`);
  if (!response.ok) return [];
  const data = (await response.json()) as OpenLibrarySearchResponse;
  return (data.docs ?? [])
    .filter((doc) => doc.title && doc.author_name?.[0])
    .map((doc) => ({
      title: doc.title ?? "Libro sin titulo",
      authorName: doc.author_name?.[0] ?? "Autor por identificar",
      isbn: doc.isbn?.[0],
      pages: doc.number_of_pages_median,
      genre: doc.subject?.slice(0, 3) ?? ["Por clasificar"],
      publisher: doc.publisher?.[0],
      publishedDate: doc.first_publish_year ? `${doc.first_publish_year}-01-01` : undefined,
      language: "English",
      synopsis: "Resultado importado desde Open Library. Puedes editarlo luego en Booklio.",
      coverImageUri: coverUrl(doc.cover_i),
      source: "search",
      ownership: "owned"
    }));
}

export function BookIntakeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { addBook } = useBooklio();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<IntakeMode>("menu");
  const [scanned, setScanned] = useState(false);
  const [coverUri, setCoverUri] = useState<string | undefined>();
  const [isBusy, setIsBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("Dune");
  const [searchResults, setSearchResults] = useState<NewBookInput[]>([]);
  const [manual, setManual] = useState({
    title: "",
    authorName: "",
    isbn: "",
    pages: "",
    genre: "",
    publisher: ""
  });

  const addAndOpen = (input: NewBookInput) => {
    const book = addBook(input);
    Alert.alert("Libro agregado", `${book.title} ya esta en tu biblioteca.`);
    navigation.navigate("BookDetail", { bookId: book.id });
  };

  const addFromIsbn = async (isbn: string) => {
    const clean = isbn.replace(/[^0-9X]/gi, "");
    setIsBusy(true);
    let found: NewBookInput | undefined;
    try {
      found = await lookupByIsbn(clean);
    } catch {
      found = undefined;
    } finally {
      setIsBusy(false);
    }

    const fallback = mockIsbnCatalog[clean];
    addAndOpen({
      ...(found ?? fallback ?? {
        title: `Libro ISBN ${clean}`,
        authorName: "Autor por identificar",
        isbn: clean,
        pages: 320,
        genre: ["Por clasificar"],
        publisher: "Editorial por confirmar",
        synopsis: "ISBN capturado. Listo para completar metadata desde un proveedor externo."
      }),
      source: "isbn",
      ownership: "owned"
    });
  };

  const runSearch = async () => {
    setIsBusy(true);
    try {
      const results = await searchOpenLibrary(searchQuery);
      setSearchResults(results);
      if (!results.length) {
        Alert.alert("Sin resultados", "No encontre libros en Open Library. Prueba titulo, autor o ISBN.");
      }
    } catch {
      setSearchResults([]);
      Alert.alert("Sin conexion", "No pude consultar Open Library ahora. Puedes usar los ejemplos reales o entrada manual.");
    } finally {
      setIsBusy(false);
    }
  };

  const takeCoverPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    setCoverUri(uri);
    addAndOpen({
      ...mockIsbnCatalog["9780441172719"],
      coverImageUri: uri,
      source: "photo",
      synopsis: "Ejemplo real detectado desde foto de portada. En produccion, este flujo usaria vision/OCR para confirmar titulo, autor e ISBN.",
      ownership: "owned"
    });
  };

  const pickCoverPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    setCoverUri(uri);
    addAndOpen({
      ...mockIsbnCatalog["9780451524935"],
      coverImageUri: uri,
      source: "photo",
      synopsis: "Ejemplo real importado desde una imagen. Luego podemos reemplazar esto por reconocimiento visual real.",
      ownership: "owned"
    });
  };

  const handleBarcode = ({ data }: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    addFromIsbn(data);
  };

  const saveManual = () => {
    addAndOpen({
      title: manual.title || "Libro nuevo",
      authorName: manual.authorName || "Autor por identificar",
      isbn: manual.isbn || undefined,
      pages: manual.pages ? Number(manual.pages) : undefined,
      genre: manual.genre ? manual.genre.split(",").map((item) => item.trim()).filter(Boolean) : ["Por clasificar"],
      publisher: manual.publisher || undefined,
      source: "manual",
      ownership: "owned"
    });
  };

  if (mode === "isbn") {
    return (
      <Screen>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Escanear ISBN</Text>
          <Text style={styles.title}>Apunta al codigo del libro.</Text>
          <Text style={styles.subtitle}>Booklio detecta EAN/ISBN y crea una ficha editable en tu biblioteca.</Text>
        </View>

        {!permission?.granted ? (
          <View style={styles.permissionCard}>
            <Text style={styles.cardTitle}>Necesitamos camara</Text>
            <Text style={styles.cardCopy}>Permite acceso para escanear codigos ISBN o fotografiar portadas fisicas.</Text>
            <Pressable style={styles.primaryButton} onPress={requestPermission}>
              <Text style={styles.primaryButtonText}>Permitir camara</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.scannerCard}>
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarcode}
              barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "qr"] }}
            />
            <View style={styles.scanFrame} />
          </View>
        )}

        <View style={styles.manualIsbnCard}>
          <Text style={styles.cardTitle}>Tambien puedes pegarlo</Text>
          <TextInput
            keyboardType="number-pad"
            placeholder="9780756404741"
            placeholderTextColor={colors.gray}
            style={styles.input}
            value={manual.isbn}
            onChangeText={(isbn) => setManual((current) => ({ ...current, isbn }))}
          />
          <Pressable style={styles.secondaryButton} onPress={() => addFromIsbn(manual.isbn || "9780756404741")}>
            <Text style={styles.secondaryButtonText}>{isBusy ? "Buscando..." : "Buscar por ISBN"}</Text>
          </Pressable>
          {scanned ? (
            <Pressable style={styles.ghostButton} onPress={() => setScanned(false)}>
              <Text style={styles.ghostButtonText}>Escanear otro codigo</Text>
            </Pressable>
          ) : null}
        </View>
      </Screen>
    );
  }

  if (mode === "manual") {
    return (
      <Screen>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Entrada manual</Text>
          <Text style={styles.title}>Crea una ficha rapida.</Text>
          <Text style={styles.subtitle}>Ideal para libros raros, ediciones especiales, preventas o libros sin codigo visible.</Text>
        </View>

        <Field label="Titulo" value={manual.title} onChangeText={(title) => setManual((current) => ({ ...current, title }))} />
        <Field label="Autor" value={manual.authorName} onChangeText={(authorName) => setManual((current) => ({ ...current, authorName }))} />
        <Field label="ISBN" value={manual.isbn} onChangeText={(isbn) => setManual((current) => ({ ...current, isbn }))} />
        <Field label="Paginas" keyboardType="number-pad" value={manual.pages} onChangeText={(pages) => setManual((current) => ({ ...current, pages }))} />
        <Field label="Generos separados por coma" value={manual.genre} onChangeText={(genre) => setManual((current) => ({ ...current, genre }))} />
        <Field label="Editorial" value={manual.publisher} onChangeText={(publisher) => setManual((current) => ({ ...current, publisher }))} />

        <Pressable style={styles.saveButton} onPress={saveManual}>
          <Text style={styles.saveButtonText}>Agregar a mi biblioteca</Text>
        </Pressable>
      </Screen>
    );
  }

  if (mode === "search") {
    return (
      <Screen>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Buscar libro</Text>
          <Text style={styles.title}>Titulo, autor, saga o ISBN.</Text>
          <Text style={styles.subtitle}>Booklio consulta Open Library y crea fichas con portada, metadata y estado inicial.</Text>
        </View>

        <Text style={styles.fieldLabel}>Busqueda</Text>
        <TextInput
          placeholder="Dune, George Orwell, Atomic Habits..."
          placeholderTextColor={colors.gray}
          style={styles.input}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Pressable style={styles.secondaryButton} onPress={runSearch}>
          <Text style={styles.secondaryButtonText}>{isBusy ? "Buscando..." : "Buscar en Open Library"}</Text>
        </Pressable>

        <View style={styles.resultsWrap}>
          {(searchResults.length ? searchResults : featuredExamples.map((isbn) => ({ ...mockIsbnCatalog[isbn], source: "search" as const }))).map((book) => (
            <Pressable key={`${book.title}-${book.isbn}`} style={styles.resultCard} onPress={() => addAndOpen(book)}>
              {book.coverImageUri ? <Image source={{ uri: book.coverImageUri }} style={styles.resultCover} /> : <View style={styles.resultCoverFallback} />}
              <View style={styles.resultCopy}>
                <Text numberOfLines={2} style={styles.resultTitle}>{book.title}</Text>
                <Text numberOfLines={1} style={styles.resultAuthor}>{book.authorName}</Text>
                <Text numberOfLines={1} style={styles.resultMeta}>{book.publisher ?? "Open Library"} {book.pages ? `- ${book.pages} pags.` : ""}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <LinearGradient colors={[colors.cream, "#FFF8EA"]} style={styles.brandHero}>
        <Image source={booklioLogo} style={styles.brandLogo} resizeMode="contain" />
        <Text style={styles.brandCopy}>Agrega libros fisicos con foto, ISBN, busqueda o entrada manual. Cada libro cuenta tu historia.</Text>
      </LinearGradient>

      <View style={styles.pathGrid}>
        <IntakePath
          accent={colors.teal}
          icon="camera"
          title="Tomar foto"
          description="Fotografia la portada del libro fisico y crea una ficha editable."
          onPress={takeCoverPhoto}
        />
        <IntakePath
          accent={colors.gold}
          icon="barcode"
          title="Escanear ISBN"
          description="Lee el codigo de barras ISBN/EAN para completar metadata."
          onPress={() => setMode("isbn")}
        />
        <IntakePath
          accent={colors.navy}
          icon="image"
          title="Importar foto"
          description="Usa una foto existente de portada o lomo desde tu galeria."
          onPress={pickCoverPhoto}
        />
        <IntakePath
          accent={colors.coral}
          icon="search"
          title="Buscar libro"
          description="Busca por titulo, autor o saga usando ejemplos reales por ahora."
          onPress={() => setMode("search")}
        />
        <IntakePath
          accent={colors.green}
          icon="create"
          title="Manual"
          description="Agrega ediciones raras, preventas o libros sin ISBN."
          onPress={() => setMode("manual")}
        />
      </View>

      <View style={styles.examplesCard}>
        <Text style={styles.cardTitle}>Ejemplos reales</Text>
        <Text style={styles.cardCopy}>Mientras conectamos una API de libros, estos ejemplos crean fichas reales con metadata coherente.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exampleRail}>
          {featuredExamples.map((isbn) => {
            const example = mockIsbnCatalog[isbn];
            return (
              <Pressable key={isbn} style={styles.examplePill} onPress={() => addFromIsbn(isbn)}>
                <Text style={styles.exampleTitle}>{example.title}</Text>
                <Text style={styles.exampleAuthor}>{example.authorName}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {coverUri ? <Image source={{ uri: coverUri }} style={styles.preview} /> : null}

      <View style={styles.sessionCard}>
        <View>
          <Badge label="Lectura" tone="teal" />
          <Text style={styles.cardTitle}>Registrar sesion de lectura</Text>
          <Text style={styles.cardCopy}>Si ya tienes el libro en tu biblioteca, entra directo al log de paginas, minutos, mood y progreso.</Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("AddReadingSession", {})}>
          <Text style={styles.primaryButtonText}>Log session</Text>
        </Pressable>
      </View>

      <View style={styles.backendCard}>
        <Text style={styles.cardTitle}>Backend-ready</Text>
        <Text style={styles.cardCopy}>
          Este flujo puede conectarse a Google Books, Open Library, ISBNdb, OCR/vision para portada y una cola de revision manual.
        </Text>
      </View>
    </Screen>
  );
}

type IntakePathProps = {
  title: string;
  description: string;
  icon: IconName;
  accent: string;
  onPress: () => void;
};

function IntakePath({ title, description, icon, accent, onPress }: IntakePathProps) {
  return (
    <Pressable style={styles.pathCard} onPress={onPress}>
      <View style={[styles.pathIcon, { backgroundColor: accent }]}>
        <Ionicons color={colors.card} name={icon} size={24} />
      </View>
      <Text style={styles.pathTitle}>{title}</Text>
      <Text style={styles.pathDescription}>{description}</Text>
    </Pressable>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "number-pad";
};

function Field({ label, value, onChangeText, keyboardType = "default" }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        placeholderTextColor={colors.gray}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  brandHero: {
    ...shadows.card,
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg
  },
  brandLogo: {
    height: 190,
    marginBottom: spacing.sm,
    width: "100%"
  },
  brandCopy: {
    color: colors.navy,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.md,
    textAlign: "center"
  },
  pathGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.lg
  },
  pathCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
    width: "47%"
  },
  pathIcon: {
    alignItems: "center",
    borderRadius: 20,
    height: 44,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 44
  },
  examplesCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md
  },
  exampleRail: {
    marginTop: spacing.md
  },
  examplePill: {
    backgroundColor: "#FFFBF4",
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginRight: spacing.sm,
    padding: spacing.md,
    width: 170
  },
  exampleTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "900"
  },
  exampleAuthor: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 5
  },
  resultsWrap: {
    gap: spacing.md,
    marginTop: spacing.lg
  },
  resultCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  resultCover: {
    backgroundColor: colors.cream,
    borderRadius: radii.md,
    height: 104,
    width: 70
  },
  resultCoverFallback: {
    backgroundColor: colors.navy,
    borderRadius: radii.md,
    height: 104,
    width: 70
  },
  resultCopy: {
    flex: 1
  },
  resultTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26
  },
  resultAuthor: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 5
  },
  resultMeta: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginTop: 5
  },
  pathTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "900"
  },
  pathDescription: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5
  },
  preview: {
    alignSelf: "center",
    borderRadius: radii.lg,
    height: 220,
    marginTop: spacing.lg,
    width: 160
  },
  sessionCard: {
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg
  },
  backendCard: {
    backgroundColor: "#FCF0D8",
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md
  },
  hero: {
    ...shadows.card,
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  title: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 39,
    marginTop: spacing.sm
  },
  subtitle: {
    color: "#F3E9D2",
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm
  },
  permissionCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg
  },
  scannerCard: {
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    height: 360,
    overflow: "hidden"
  },
  camera: {
    flex: 1
  },
  scanFrame: {
    borderColor: colors.gold,
    borderRadius: radii.lg,
    borderWidth: 3,
    height: 132,
    left: "12%",
    position: "absolute",
    right: "12%",
    top: 112
  },
  manualIsbnCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md
  },
  cardTitle: {
    color: colors.navy,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    marginTop: spacing.sm
  },
  cardCopy: {
    color: colors.muted,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5
  },
  primaryButton: {
    backgroundColor: colors.teal,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingVertical: 13
  },
  primaryButtonText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  secondaryButton: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingVertical: 13
  },
  secondaryButtonText: {
    color: colors.navy,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  ghostButton: {
    borderColor: colors.teal,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingVertical: 12
  },
  ghostButtonText: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  saveButton: {
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    marginTop: spacing.lg,
    paddingVertical: 15
  },
  saveButtonText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center"
  },
  field: {
    marginBottom: spacing.md
  },
  fieldLabel: {
    color: colors.tealDark,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 7,
    textTransform: "uppercase"
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "700",
    padding: spacing.md
  }
});
