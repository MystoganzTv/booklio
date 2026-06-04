# PROJECT HANDOFF — Bookliz

## Project Name
**Bookliz** (formerly Booklio — nombre interno en Supabase/iOS aún dice "Booklio")

## Vision
App de lectura para iOS (indie, solo). Biblioteca personal con metadatos reales de Google Books + Open Library. Escaneo, búsqueda, organización y tracking de libros.

## Current Objective
App funcional, limpia y sin basura editorial en todas las pantallas. TypeScript sin errores.

---

## Tech Stack
| Capa | Tecnología |
|------|-----------|
| Framework | React Native + Expo (bare workflow, iOS prebuilt) |
| Lenguaje | TypeScript |
| Backend | Supabase (URL: `owrnbqgzxjitpnhlzrvd.supabase.co`) |
| Navegación | React Navigation — native stack + bottom tabs |
| APIs externas | Google Books API (`EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY`) · Open Library |
| Fuente offline | `src/utils/knownWorks.ts` (catálogo curado, solo enriquecimiento) |

**Env vars requeridas en `.env`:**
```
EXPO_PUBLIC_SUPABASE_URL=https://owrnbqgzxjitpnhlzrvd.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<key>
EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY=AIzaSyDYrmSRE8WNu07RoooDXnK3PqqmOAYw7xw
```

**Cómo correr:**
```bash
cd /Users/enrique/Documents/Homework/Coding/MyProjects/Bookliz
npm install   # si node_modules incompleto
npx expo start --clear
# presiona i → iOS simulator
```

**TypeScript:** ✅ 0 errores (todos los heredados ya resueltos)

---

## Screens & Components

### Screens
- `src/screens/HomeScreen.tsx` — streak, annual goal, carriles personalizados, "Based on your interests" (new user)
- `src/screens/DiscoverScreen.tsx` — moods, genres, trending (rotación diaria), personalized "Picked for you", empty states
- `src/screens/LibraryScreen.tsx` — grid de libros, filtros, búsqueda, empty state
- `src/screens/BookIntakeScreen.tsx` — scanner (ean13/ean8/upc_a/upc_e/qr), búsqueda, resultados con EditionsSheet
- `src/screens/BookDetailScreen.tsx` — detalle con stats y reviews
- `src/screens/GenreBrowseScreen.tsx` — catálogo paginado por género, curated titles arriba, filtro isHighSignalCatalogBook
- `src/screens/ProfileScreen.tsx` — stats anuales, racha, logros
- `src/screens/AddReadingSessionScreen.tsx`, `EditBookScreen.tsx`, `WelcomeScreen.tsx`
- Onboarding: 3 pantallas

### Components
- `src/components/CatalogBookCard.tsx` — card para carriles de recomendaciones; `onError` → card desaparece si imagen carga rota
- `src/components/BookCover.tsx`, `BookCard.tsx`, `RecommendationCard.tsx`
- `src/components/MoodBooksSheet.tsx`, `CuratedListSheet.tsx`, `BookEditionsSheet.tsx`
- `src/components/CreateListSheet.tsx` (con KeyboardAvoidingView fix)
- `src/components/BooklioDialog.tsx`, `Screen.tsx`, `SectionHeader.tsx`, `SessionRow.tsx`
- `src/components/HeroRecommendationCard.tsx`, `GoogleConnectionCard.tsx` (stub)

---

## Architecture — Search & Discovery

### BookIntake search (el más inteligente)
Archivo: `src/services/bookMetadataAggregator.ts`

Pipeline jerárquico de buckets:
```
BUCKET_ISBN        = 1000  → match exacto ISBN
BUCKET_EXACT_TITLE =  490  → intitle:"phrase" de GB
BUCKET_TRANSLATION =  480  → expansión de título traducido
BUCKET_AUTHOR      =  300  → inauthor:"name"
BUCKET_FUZZY       =  100  → solo-OL o sin match GB
```
- `intitle:"phrase"` con comillas — precisión máxima en título
- `inauthor:"name"` con comillas — libros DEL autor, no SOBRE el autor
- `findMergeableIdx` — protección de conflicto de autor (no fusiona libros distintos con mismo título)
- `preferLang` — prioriza edición en idioma de la búsqueda
- `gbRank` preservado — respeta orden nativo de Google dentro de cada bucket

### Motor de recomendaciones (`src/services/recommendationEngine.ts`)
Tres capas de defensa contra basura editorial:

**Capa 1 — Fuente (`src/services/googleBooksProvider.ts`):**
- `fetchByGenre` y `fetchByKeyword` requieren `imageLinks.thumbnail` antes de mapear
- Ningún libro sin portada entra al pipeline

**Capa 2 — `isHighSignalCatalogBook` (exportado, reutilizado en GenreBrowseScreen):**
- `SERIAL_PUBLICATION_PATTERN` — magazines, reviews, journals, weeklies, gazettes, etc.
- `GENERIC_TITLE_PATTERN` — "Bestsellers", "Publishers' Weekly" (fix apóstrofe), "Guide to..."
- `STORY_COLLECTION_PATTERN` — compilaciones de short stories
- `COLLECTION_PATTERN` — box sets, omnibus, anthologies
- `LOW_SIGNAL_PATTERN` — study guides, encyclopedias, handbooks, reader's guides
- `NON_FICTION_JUNK_PATTERN` — bike rides, cookbooks, fitness, travel guides
- `GENERIC_AUTHOR_PATTERN` — "Unknown Author", "Various Writers"
- Rechazo duro `year < 1950` — periódicos digitalizados de 1920s
- `hasQualitySignal`: ratingsCount≥200 OR (rating≥3.8 AND ratings≥20) OR (year≥2018 AND ratings≥10)

**Capa 3 — Render (`src/components/CatalogBookCard.tsx`):**
- `onError` en Image → card desaparece del rail

**Queries estructuradas (NO texto libre):**
- `because-you-read`: `inauthor:"Andy Weir" subject:science+fiction`
- `more-from-author`: `inauthor:"${topAuthor}"`
- `continue-series`: `intitle:"${series}" subject:fiction`
- `popular-in-genre` / `short-reads`: `subject:${GENRE_TO_GB_SUBJECT[genre]}`
- Curated seeds (Discover trending + GenreBrowse): `intitle:"X" inauthor:"Y"`

**Secciones personalizadas solo con lectura real:**
- `because-you-read` y `more-from-author` solo se generan si `anchorBook.status === "read" || "reading"`
- Un libro "owned" sin leer NO genera estas secciones

### Trending (DiscoverScreen)
- Pool de 30 libros en 8 géneros en `TRENDING_POOL`
- `pickTrendingTitles()` selecciona 1 por género usando `dayOfYear` como seed → rota diariamente, sin randomness
- 6 géneros cubiertos siempre: literary, romance, scifi, fantasy, thriller, historical

### GenreBrowse catálogo
- Filtro principal: `isHighSignalCatalogBook(b)` (mismo que recomendaciones)
- Fallback: `coverUrl && !COLLECTION_PATTERN` si strict deja <6 libros
- totalItems capeado a "500+" en UI (Google infla a ~1M para búsquedas amplias)
- Curated seeds usan `intitle:/inauthor:` estructurados

### Datos / Supabase
- Tablas: `booklio_profiles` · `booklio_books` · `booklio_authors` · `booklio_reading_sessions` · `booklio_reviews` · `booklio_user_lists`
- Upsert + orphan cleanup — nunca delete-all-then-insert
- Offline queue en `src/utils/offlineQueue.ts`

### Tema visual
- Navy `#0F172A` / Teal `#14B8A6` / Gold `#FFC857` / Coral `#FF7A59`
- **NUNCA `c.card`** en elementos activos (dark mode muy oscuro) — siempre `useColors()`
- Lora (display) + Nunito (body) · Light + Dark mode

---

## Done This Session (2026-06-02)

### Cover & quality filtering
- `src/services/googleBooksProvider.ts`: `fetchByGenre` + `fetchByKeyword` requieren `imageLinks.thumbnail` antes de mapear
- `src/services/recommendationEngine.ts`: `NON_FICTION_JUNK_PATTERN`, amplió `SERIAL_PUBLICATION_PATTERN` y `LOW_SIGNAL_PATTERN`, fix apóstrofe en `GENERIC_TITLE_PATTERN`, rechazo duro year<1950, `hasQualitySignal` subido a 200 ratings
- `src/components/CatalogBookCard.tsx` (NUEVO): card compartida, `onError` → null
- `src/screens/HomeScreen.tsx` + `DiscoverScreen.tsx`: usan `CatalogBookCard` en todos los carriles

### Recommendation logic
- Queries reescritas con `inauthor:/subject:` (no texto libre)
- `because-you-read` / `more-from-author` solo si status === "read" | "reading"
- `GENRE_TO_GB_SUBJECT` map + `subjectQuery()` helper

### Structured queries en curated seeds
- `src/screens/DiscoverScreen.tsx`: trending seeds usan `intitle:"X" inauthor:"Y"`
- `src/screens/GenreBrowseScreen.tsx`: curated titles usan `intitle:"X" inauthor:"Y"`

### BarcodeType fix
- `src/screens/BookIntakeScreen.tsx` line 1424: eliminado `"isbn13"` del array (no existe en BarcodeType enum; ISBN-13 ya cubierto por `"ean13"`)
- ✅ **Proyecto ahora compila con 0 errores TypeScript**

### Trending pool expansion
- `src/screens/DiscoverScreen.tsx`: `TRENDING_POOL` con 30 libros en 8 géneros
- `pickTrendingTitles()` rota diariamente por `dayOfYear`
- Géneros cubiertos: literary, romance, scifi, fantasy, thriller, historical, horror, nonfiction

### Empty states
- `src/screens/DiscoverScreen.tsx`: empty state para "Picked for you" vacío (icono + mensaje + botón "Add your first book")
- `src/screens/DiscoverScreen.tsx`: empty state para trending sin red (icono wifi + mensaje)
- Estilos: `personalizedEmpty`, `personalizedEmptyTitle/Body/Button/ButtonText`, `trendingEmpty`, `trendingEmptyText`

### GenreBrowse quality filter
- `src/screens/GenreBrowseScreen.tsx`: reemplazó filtros locales débiles por `isHighSignalCatalogBook` (importado de recommendationEngine)
- Fallback a cover-only si strict deja <6 resultados (evita páginas vacías en géneros muy nicho)
- totalItems capeado a "500+" en UI

---

## Pending / Next

1. **Verificar en simulator** — recargar con `r`, revisar Home, Discover (trending con géneros distintos), GenreBrowse, y carriles de recomendaciones
2. **Library grid** — usuario dijo que se ve "overwhelming". Nunca se terminó de iterar el diseño.
3. **Test 6 casos de BookIntake:**
   - `9786073925020` → Fourth Wing edición especial MX
   - `The Secret of Secrets` → Dan Brown primero
   - `Dan Brown` → autor primero
   - `Harry Potter` → serie de libros
   - `Alas de Sangre` → edición española primero
   - `Fourth Wing` → edición inglesa primero
4. Confidence badges — todos salen "LOW", decidir si mostrar/ocultar

---

## Known Issues

### Resueltos esta sesión
- ~~BarcodeType TS error~~ — eliminado "isbn13" del array
- ~~0 errores TypeScript~~ — ✅ proyecto limpio

### Funcionales pendientes
- **Foto de página de copyright no soportada** — `analyzeBookPhoto` usa solo barcode scan, no OCR. Necesitaría Vision API externa.
- **node_modules puede estar incompleto** — si `npm install` fue cancelado, volver a correr

### Cosméticos (no tocar)
- iOS Xcode project llamado "Booklio" en `ios/Booklio/` 
- Tablas Supabase `booklio_*` (nombre anterior)
- `expo-apple-authentication` y `expo-auth-session/providers/google` sin declaraciones TS en GoogleConnectionCard.tsx

---

## Key Decisions

| Decisión | Razón |
|----------|-------|
| `isHighSignalCatalogBook` exportado y reutilizado en GenreBrowseScreen | Una sola fuente de verdad para filtrado de calidad — evita que los filtros locales queden desactualizados |
| `CatalogBookCard` con `onError → null` | Usuario dijo "no va con lo que quiero hacer en la app" — no mostrar placeholder ni broken image |
| `pickTrendingTitles()` con dayOfYear (no random) | Determinista: el mismo usuario ve los mismos libros el mismo día; rota sin estado externo |
| Queries con `inauthor:/subject:/intitle:` en TODAS las búsquedas de catálogo | Texto libre trae revistas, guías de ciclismo y editoriales en lugar de novelas |
| `because-you-read` solo con status read/reading | Un libro "owned" sin leer no es señal de gusto — era confuso para usuarios nuevos |
| `hasQualitySignal` subido a 200 ratings | Libros con text-scan covers en lugar de portadas reales tienden a tener <200 ratings |

---

## Last Updated
2026-06-02 — GenreBrowse filtro unificado con isHighSignalCatalogBook, BarcodeType fix (0 TS errors), trending pool 30 libros rotación diaria, empty states Discover, structured queries en curated seeds.
