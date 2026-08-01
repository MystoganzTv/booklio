# PROJECT HANDOFF — Bookliz

## Project Name
**Bookliz** (formerly Booklio — interno en Supabase/iOS aún dice "Booklio")

## Vision
App de lectura para iOS (indie, solo). Biblioteca personal con metadatos reales de Google Books + Open Library. Escaneo, búsqueda, organización y tracking de libros físicos, ebooks y audiolibros.

## Tech Stack
| Capa | Tecnología |
|------|-----------|
| Framework | React Native + Expo (bare workflow, iOS prebuilt) |
| Lenguaje | TypeScript |
| Backend | Supabase (`owrnbqgzxjitpnhlzrvd.supabase.co`) |
| Navegación | React Navigation — native stack + bottom tabs |
| APIs externas | Google Books API (`EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY`) · Open Library |

**Env vars en `.env`:**
```
EXPO_PUBLIC_SUPABASE_URL=https://owrnbqgzxjitpnhlzrvd.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<key>
EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY=<key>
```

**Cómo correr:**
```bash
cd /Users/enrique/Documents/Homework/Coding/MyProjects/Bookliz
npm install
npx expo start --clear
# presiona i → iOS simulator
```

**TypeScript:** ✅ 0 errores

---

## Screens & Components

### Screens
- `src/screens/HomeScreen.tsx` — streak, annual goal, carriles personalizados, "Based on your interests"
- `src/screens/DiscoverScreen.tsx` — moods, genres, trending (rotación diaria por dayOfYear), "Picked for you", empty states
- `src/screens/LibraryScreen.tsx` — list view por defecto, grid toggle, 4 tabs: All/In progress/Finished/Wish list, botón Get con Amazon affiliate, long press → delete dialog
- `src/screens/BookIntakeScreen.tsx` — scanner, búsqueda, review flow (Edit details colapsado, CompactLanguageModal, sanitizeSynopsis, duplicate detection)
- `src/screens/BookDetailScreen.tsx` — detalle con stats y reviews
- `src/screens/GenreBrowseScreen.tsx` — catálogo paginado, curated titles, isHighSignalCatalogBook, totalItems cap "500+"
- `src/screens/ProfileScreen.tsx` — stats, racha, logros
- `src/screens/SettingsScreen.tsx` — identity card al top, appearance, language, notifications, Google, clear demo data, delete all
- `src/screens/AddReadingSessionScreen.tsx`, `EditBookScreen.tsx`, `WelcomeScreen.tsx`, 3× onboarding

### Components
- `src/components/CatalogBookCard.tsx` — card para carriles; `onError → null` si imagen rota
- `src/components/BookCover.tsx` — soporta `hideProgress` prop; ProgressRing solo cuando progress > 0
- `src/components/BooklizDialog.tsx` — dialog temático con soporte `onCancel` + `variant="destructive"`
- `src/components/BooklioDialog.tsx` — igual que BooklizDialog (mismo código, dos nombres por historia del proyecto)
- `src/components/BookCard.tsx`, `RecommendationCard.tsx`, `HeroRecommendationCard.tsx`
- `src/components/MoodBooksSheet.tsx`, `CuratedListSheet.tsx`, `BookEditionsSheet.tsx`
- `src/components/CreateListSheet.tsx` (KeyboardAvoidingView fix)
- `src/components/Screen.tsx`, `SectionHeader.tsx`, `SessionRow.tsx`, `Badge.tsx`, `FilterChip.tsx`
- `src/components/GoogleConnectionCard.tsx` (stub sin TS declarations)

---

## Architecture

### BookIntake — pipeline de búsqueda (el más inteligente)
`src/services/bookMetadataAggregator.ts`:
```
BUCKET_ISBN=1000 · BUCKET_EXACT_TITLE=490 · BUCKET_TRANSLATION=480 · BUCKET_AUTHOR=300 · BUCKET_FUZZY=100
```
- `intitle:"phrase"` y `inauthor:"name"` con comillas
- `findMergeableIdx` — no fusiona libros con título igual pero autor distinto
- `preferLang` — prioriza edición en idioma de la búsqueda
- `gbRank` preservado dentro de cada bucket

### Duplicate detection
`BooklizContext.findDuplicateBook(input)` — devuelve el libro existente si es duplicado real:
- Mismo ISBN + mismo idioma → duplicado
- Mismo título + mismo autor + mismo idioma → duplicado
- Mismo ISBN en idioma distinto → permitido (edición diferente)
- `addBook` también es language-aware en su merge logic

### Recommendation engine (`src/services/recommendationEngine.ts`)
**Tres capas de defensa:**
1. `fetchByGenre`/`fetchByKeyword` requieren `imageLinks.thumbnail` (fuente)
2. `isHighSignalCatalogBook` — exportado, usado en GenreBrowseScreen también:
   - Patterns: SERIAL, GENERIC_TITLE, STORY_COLLECTION, COLLECTION, LOW_SIGNAL, NON_FICTION_JUNK, GENERIC_AUTHOR
   - Rechazo duro year < 1950
   - `hasQualitySignal`: ratings≥100 OR (rating≥3.8 AND ratings≥15) OR (year≥2020 AND ratings≥5)
3. `CatalogBookCard.onError → null` (render)

**Queries estructuradas:**
- `because-you-read` → `inauthor:"X" subject:genre` — SOLO si status read/reading
- `more-from-author` → `inauthor:"X"` — SOLO si status read/reading
- `popular-in-genre` / `short-reads` → `subject:genre`
- Curated seeds → `intitle:"X" inauthor:"Y"`
- `GENRE_TO_GB_SUBJECT` map + `subjectQuery()` helper

**Parámetros:** `fetchLimit:40, booksPerSection:6, minBooksPerSection:2`

### Library screen
- **Default view: list** (`useState<ViewMode>("list")`)
- **4 tabs simples:** All · In progress · Finished · Wish list (pill gold cuando activo)
- **List row:** cover 80×80 cuadrado, borderRadius 12, título bold, autor gris, progress bar gold, "Finished"/"Did not finish" text, botón "Get" pill gold
- **Grid tile:** cover `aspectRatio:0.75` responsivo, borderRadius 16, título + autor + "Book N · Series" en teal, SIN ProgressRing (`hideProgress`)
- **Long press → BooklioDialog** temático: "Remove this book from your library?" + "Keep it" / "Remove"
- **"Get" button** → Amazon search: `https://www.amazon.com/s?k=${title+author}&tag=bookliz-20`
  - **⚠️ PENDIENTE:** cambiar `bookliz-20` por el tag real de Amazon Associates del usuario

### BookIntake review flow
- `showEditDetails` — "Edit details" colapsado por defecto
- `CompactLanguageModal` — botón `English ▼` abre bottom sheet, idiomas priorizados por `tasteProfile.preferredLanguages`
- `sanitizeSynopsis()` — filtra donation records, provenance notes de catálogos de biblioteca
- Duplicate check en `confirmReviewBook` antes de añadir — muestra `BooklizDialog` con opción "Add anyway"

### Settings screen
- **Identity card** al top — avatar (foto o iniciales), nombre, email, badge "Connected"
- **"Clear demo data"** → `clearLibrary()` — borra library, mantiene cuenta + prefs
- **"Delete everything"** → `resetApp()` — wipe completo

### Trending (DiscoverScreen)
- `TRENDING_POOL` — 30 libros · 8 géneros
- `pickTrendingTitles()` — 1 por género, rota por `dayOfYear` (determinista)

### Datos / Supabase
- Tablas: `booklio_*` (nombre anterior — cosmético)
- Upsert + orphan cleanup — nunca delete-all-then-insert
- `src/utils/offlineQueue.ts` — cola offline

### Tema visual
- Navy `#0F172A` / Teal `#14B8A6` / Gold `#FFC857` / Coral `#FF7A59`
- **NUNCA `c.card`** en elementos activos — siempre `useColors()`
- Lora (display) + Nunito (body) · Light + Dark mode

---

## Done — Sesión completa 2026-06-02

- **`src/services/googleBooksProvider.ts`**: filtro `imageLinks.thumbnail` en fetchByGenre/fetchByKeyword
- **`src/components/CatalogBookCard.tsx`** (nuevo): `onError → null`
- **`src/services/recommendationEngine.ts`**: queries inauthor:/subject:, NON_FICTION_JUNK_PATTERN, hasQualitySignal 100 ratings, minBooksPerSection 2
- **`src/screens/DiscoverScreen.tsx`**: TRENDING_POOL 30 libros, empty state sin CTA button, structured curated queries
- **`src/screens/GenreBrowseScreen.tsx`**: isHighSignalCatalogBook reemplaza filtros locales, totalItems cap "500+", structured curated queries
- **`src/screens/BookIntakeScreen.tsx`**: Edit details colapsado, CompactLanguageModal, sanitizeSynopsis, BarcodeType fix, duplicate detection + BooklizDialog
- **`src/components/BooklizDialog.tsx`**: actualizado con onCancel + variant="destructive" (dos botones)
- **`src/components/BooklioDialog.tsx`**: mismo upgrade (ambos componentes son iguales ahora)
- **`src/screens/SettingsScreen.tsx`**: identity card, clearLibrary button
- **`src/data/BooklizContext.tsx`**: `clearLibrary()`, `findDuplicateBook()`, `deleteBook` expuesto, language-aware duplicate merge
- **`src/screens/LibraryScreen.tsx`**: list view default, 4 tabs simples, LibraryRowCard rediseñado (flat rows, progress bar gold, cover 80×80, "Get" button Amazon), GridBookTile (author + series label, hideProgress, aspectRatio:0.75), BooklioDialog para delete, long press → delete
- **`src/components/BookCover.tsx`**: prop `hideProgress`, ProgressRing solo cuando progress > 0

---

## Pending / Next

### Alta prioridad
1. **Amazon Associates tag** — cambiar `bookliz-20` en `LibraryScreen.tsx` (línea con `tag=bookliz-20`) por el tag real del usuario tras registrarse en affiliate-program.amazon.com
2. **Verificar simulator** — list view, grid view, tabs, duplicate detection, delete dialog

### ROADMAP — Fase siguiente: Media (audio/ebook/iCloud)
Esta fase es grande (~2-3 semanas) y debe planearse bien antes de codear:

**3a. Libros físicos** (ya funciona parcialmente):
- "Get" → Amazon physical book link ✅ (ya implementado)

**3b. Ebooks:**
- Formato: `.epub`
- Almacenamiento: iCloud Drive (via `expo-file-system` + `expo-document-picker`)
- Reader: `react-native-epub-reader` o WebView con epub.js
- Link si no tienen: Amazon Kindle edition (mismo tag de afiliado)

**3c. Audiolibros:**
- Formato: `.m4b` (compatible con BookPlayer, Libro.fm, etc.)
- Almacenamiento: iCloud Drive
- Player: `expo-av` para playback básico, o integración con BookPlayer via URL scheme
- Link si no tienen: Amazon Audible edition

**Lógica del botón por tipo:**
```
if (format === "audiobook" && hasLocalFile) → Play button
if (format === "audiobook" && !hasLocalFile) → "Get" → Amazon Audible link
if (format === "kindle" && hasLocalFile) → Read button
if (format === "kindle" && !hasLocalFile) → "Get" → Amazon Kindle link
if (format === "physical") → "Get" → Amazon physical link
```

**Campos a añadir al modelo Book:**
- `localFilePath?: string` — ruta al archivo local en iCloud
- `fileFormat?: "epub" | "m4b" | "pdf"`

### Media prioridad
3. Test 6 casos BookIntake: ISBN 9786073925020, "The Secret of Secrets", "Dan Brown", "Harry Potter", "Alas de Sangre", "Fourth Wing"
4. Library grid — iterar si sigue viéndose mal
5. Confidence badges en search results — todos salen "LOW"

---

## Known Issues

### Funcionales pendientes
- **Foto de página de copyright** — `analyzeBookPhoto` solo barcode scan, no OCR
- **node_modules incompleto** — si `npm install` fue cancelado, volver a correr

### Cosméticos (no tocar)
- iOS Xcode project llamado "Booklio" en `ios/Booklio/`
- Tablas Supabase `booklio_*`
- `expo-apple-authentication` y `expo-auth-session/providers/google` sin declaraciones TS en GoogleConnectionCard.tsx
- `BooklizDialog` y `BooklioDialog` son el mismo componente con dos nombres — unificar cuando haya tiempo

---

## Key Decisions

| Decisión | Razón |
|----------|-------|
| Library default: list view | Usuario prefiere el look de Audible (list con progress bar) |
| 4 tabs simples (All/In progress/Finished/Wish list) | Audible UX — limpio vs. los 8 filtros anteriores |
| "Get" → Amazon con affiliate tag | Monetización vía Amazon Associates |
| Grid hideProgress | Cover ring redundante en grid; la info de progreso está en list view |
| Duplicate check language-aware | Mismo ISBN en español + inglés = dos libros diferentes (ediciones distintas) |
| `findDuplicateBook` separado de `addBook` | UI puede preguntar antes de añadir, con opción "Add anyway" |
| `clearLibrary` separado de `resetApp` | Demo-friendly: borrar datos sin perder cuenta |

---

## Last Updated
2026-06-02 — Library redesign completo (list/grid, tabs, Get button, delete), BookCover hideProgress, duplicate detection, Settings identity card, 0 TS errors. Roadmap de media (audio/ebook/iCloud) documentado para próxima sesión.
