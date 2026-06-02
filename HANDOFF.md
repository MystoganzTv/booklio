# PROJECT HANDOFF — Bookliz

## Project Name
**Bookliz** (formerly Booklio — nombre interno en Supabase/iOS aún dice "Booklio")

## Vision
App de lectura para iOS (indie, solo) que permite a lectores hispanohablantes escanear, buscar, organizar y rastrear sus libros. Funciona como una biblioteca personal con metadatos reales de Google Books + Open Library.

## Current Objective
Motor de búsqueda funcionando correctamente para los 6 casos de prueba del spec. Pipeline jerárquico de buckets con intento de búsqueda correcto (autor vs título).

---

## Tech Stack
| Capa | Tecnología |
|------|-----------|
| Framework | React Native + Expo (bare workflow, iOS prebuilt) |
| Lenguaje | TypeScript |
| Backend | Supabase (URL: `owrnbqgzxjitpnhlzrvd.supabase.co`) |
| Navegación | React Navigation — native stack + bottom tabs |
| APIs externas | Google Books API (`EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY`) · Open Library |
| Fuente de datos offline | `src/utils/knownWorks.ts` (catálogo curado) |

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

---

## Architecture Decisions

### Navegación
- **Tab nav:** Home · Library · Add (BookIntake) · Discover · Profile
- **Stack screens:** BookDetail · ReadingLog · AddReadingSession · SeriesTracker · EditBook · EditProfile · Settings · Achievements · WriteReview · Stats · Welcome · Onboarding (3 pantallas) · GenreBrowse
- `RootStackParamList` y `MainTabParamList` en `src/navigation/types.ts`

### Tema visual
- Navy `#0F172A` / Teal `#14B8A6` / Gold `#FFC857` / Coral `#FF7A59`
- Light + Dark mode · Lora (display) + Nunito (body)
- **NUNCA usar `c.card`** para texto/fondo en elementos activos (en dark mode es muy oscuro)
- **Siempre `useColors()`** para tokens de tema — nunca importar `colors` de theme.ts directo

### Pipeline de búsqueda (refactorizado en sesión actual)
Archivos clave:
- `src/services/bookMetadataAggregator.ts` — orquestador principal
- `src/services/bookMatchScorer.ts` — scoring + constantes de bucket
- `src/services/googleBooksProvider.ts` — proveedor Google Books
- `src/services/openLibraryProvider.ts` — proveedor Open Library (enriquecimiento)
- `src/utils/knownWorks.ts` — catálogo offline (solo fallback/enriquecimiento)

**Arquitectura jerárquica por buckets:**
```
BUCKET_ISBN        = 1000  → match exacto de ISBN
BUCKET_EXACT_TITLE =  490  → resultados primarios intitle: de GB
BUCKET_TRANSLATION =  480  → expansión de título traducido
BUCKET_AUTHOR      =  300  → búsqueda por autor
BUCKET_FUZZY       =  100  → solo-OL o sin match en GB
```
- Dentro de cada bucket: ordenar por `gbRank` (posición nativa de Google, 0=mejor)
- Google Books usa `intitle:word1+intitle:word2` para precisión en búsquedas de título
- Merge de obras: requiere similitud de título ≥70% **Y** similitud de autor ≥20% (evita mezclar libros distintos con el mismo título)
- `knownWorks` solo para: expansión de traducciones, hint de autor, enriquecimiento de serie

### Datos / Supabase
- Tablas: `booklio_profiles` · `booklio_books` · `booklio_authors` · `booklio_reading_sessions` · `booklio_reviews` · `booklio_user_lists`
- **Upsert + orphan cleanup** — nunca delete-all-then-insert (riesgo de pérdida de datos)
- `pruneOrphans(table, userId, keepIds)` — errores son no-fatales
- Offline queue en `src/utils/offlineQueue.ts` — encola en falla, flush en AppState "active"

### Componentes de pantalla
- `Screen` component envuelve todas las pantallas. `scroll={false}` para cámara.
- `BooklizContext` — única fuente de verdad para todos los datos del usuario
- `result.works` = array de BookWork únicos (un book por título)
- `result.flatEditions` = todas las ediciones del work top solamente (para EditionsSheet)
- `legacyMatches` = `result.works.slice(0,8)`, una tarjeta por libro con su propio autor

---

## Completed Work

### Sesión 2026-06-01 (sesión actual)

#### Search Engine Refactor (completo)
- **`bookMatchScorer.ts`**: Añadidas constantes `BUCKET_*` exportadas. Eliminado bonus de +20/+10 por exact-title match que causaba falsos positivos.
- **`googleBooksProvider.ts`**: `fetchWorksByQuery` en modo título ahora usa `intitle:word1+intitle:word2` en lugar de `q=texto libre`. Retorna `gbRank` (posición 0-based en response de Google).
- **`bookMetadataAggregator.ts`**: `lookupByQuery` reescrito con pipeline jerárquico de buckets. Nueva función `findMergeableIdx` con protección de conflicto de autor. `pickBestEdition` ahora acepta `preferLang` para selección consciente del idioma. `buildWork` propaga `preferLang`. Expansión de traducción separada en `BUCKET_TRANSLATION`.

#### Correcciones previas (misma sesión)
- **CreateListSheet keyboard fix** — `KeyboardAvoidingView` wraps modal
- **Library grid redesign** — badges/author removidos, `borderRadius` en covers
- **Library no-match empty state** — ícono Bookliz + badge coral + botón clear
- **Library UI simplification** — sin shelf cards, rail de pills, 2 botones
- **Library search validation** — mín 2 chars, maxLength 60, `clearButtonMode`
- **Supabase save upsert+orphan cleanup** — reemplazó delete+reinsert
- **ISBN validation** — solo dígitos, maxLength 13, valida 10/13
- **BookIntake no-match card redesign** — ícono on-brand, "Buscar de nuevo" reset inteligente
- **Scanner stuck fix** — `setScanned(true)` inmediato, timeout 15s
- **Zoom blur fix** — valores `0|0.05|0.12` (era `0|0.25|0.5`)
- **Match cards desde works** — `result.works` no `flatEditions`
- **Inline search bar en results** — TextInput editable reemplaza label estático
- **Google Books API key** — añadida a `.env` (era quota anónima agotada)

---

## Current Work
Nada en progreso. Última acción: fix completo de búsqueda por autor — inauthor multi-term URL, filtro reforzado para biographies, UI adaptada (sin badge LOW, heading correcto).

---

## Known Issues

### Pre-existentes (no tocar, documentados)
- TS error `src/services/bookMetadataAggregator.ts` — tipo `Promise<never>[]` en fetchPromises (solo tipo, no afecta runtime)
- TS error `src/screens/BookIntakeScreen.tsx` línea ~1157 — `barcodeScannerSettings` type mismatch (pre-existente, scanner funciona)
- `expo-apple-authentication` y `expo-auth-session/providers/google` — stubs sin declaraciones TS (GoogleConnectionCard.tsx)
- iOS Xcode project internamente llamado "Booklio" en `ios/Booklio/` — cosmético
- Tablas Supabase se llaman `booklio_*` (nombre anterior) — cosmético

### Funcionales pendientes
- **Foto de página de copyright no soportada** — `analyzeBookPhoto` usa `Camera.scanFromURLAsync` (solo barcode, no OCR). Necesitaría Claude Vision API o Google Cloud Vision en `EXPO_PUBLIC_BOOKLIO_VISION_ENDPOINT`.
- **node_modules puede estar incompleto** — si `npm install` fue cancelado, volver a correr.

---

## Fixed Issues

| Problema | Solución |
|----------|----------|
| "The Secret of Secrets" retornaba Rajneesh antes que Dan Brown | Pipeline jerárquico + intitle: + gbRank preservado |
| Libros con mismo título pero diferente autor se fusionaban | `findMergeableIdx` con protección de conflicto de autor (similaridad < 20% → no merge) |
| "Alas de sangre" no mostraba edición española primero | `queryLang` detectado → `preferLang` en `pickBestEdition` + expansión en `BUCKET_TRANSLATION` |
| Dan Brown 2025 aparecía como "Other editions" del libro de Rajneesh | Mismo fix de conflicto de autor |
| Score de exact-title bonus causaba falsos positivos | Eliminado — bucket system lo reemplaza |
| Google Books retornaba resultados irrelevantes para títulos | `intitle:` por palabra en lugar de `q=texto libre` |
| "Dan Brown" retornaba biografías en lugar de libros del autor | `inauthor:"Dan Brown"` con comillas (quoted phrase) + filtro post-fetch que rechaza obras donde authors[] no contiene al autor buscado |
| `intitle:` por palabra podía omitir resultados con frases exactas | Cambiado a `intitle:"phrase"` (quoted) para precisión máxima |
| Label "BOOK LOOKUP" redundante en resultados de búsqueda | Eliminado `pageEyebrow` en ambas instancias de BookIntakeScreen |

---

## Next Tasks (recomendados)

### Alta prioridad
1. **Probar los 6 test cases del spec** en dispositivo/simulator:
   - `9786073925020` → Fourth Wing edición especial MX
   - `The Secret of Secrets` → Dan Brown primero
   - `Dan Brown` → autor primero
   - `Harry Potter` → serie de libros
   - `Alas de Sangre` → edición española primero
   - `Fourth Wing` → edición inglesa primero

2. **"Dan Brown" como autor en BookIntake** — verificar que `detectQueryIntent` lo clasifica como `"author"` correctamente (2 palabras capitalizadas, sin artículo).

### Media prioridad
3. **Library grid "more luxury"** — usuario dijo que el grid aún se ve "overwhelming". Más iteración de diseño si se desea.
4. **Confidence badges** — actualmente todos salen "LOW" porque el score 0-100 se calcula distinto al bucket. Considerar si mostrar o esconder el badge.

### Baja prioridad
5. **OCR para fotos de páginas de copyright** — requiere Vision API externa.
6. **Serie Harry Potter** — añadir `knownWorks.ts` entry para que el seriesName se enriquezca correctamente.

---

## Session Summary

### Sesión 2026-06-01
**Objetivo:** Hacer que el motor de búsqueda devuelva resultados correctos (ejemplo: "The Secret of Secrets" debe retornar Dan Brown, no Rajneesh).

**Diagnóstico:** El sistema anterior usaba scoring flat — todos los resultados competían por score, y libros con más ediciones en OL (catálogos más ricos) ganaban sobre libros recientes aunque el título fuera exactamente el buscado. Además, libros con mismo título pero diferente autor se fusionaban incorrectamente.

**Solución implementada:** Pipeline jerárquico de buckets que preserva el orden nativo de Google dentro de cada categoría. El bucket determina el rango principal; Google decide el orden interno. `knownWorks` degradado a solo enriquecimiento post-búsqueda.

**Estado al cierre:** Todos los tests de TypeScript pasan (0 errores nuevos). Código en producción en `/Users/enrique/Documents/Homework/Coding/MyProjects/Bookliz/`.

---

## Last Updated
2026-06-01 — Fix búsqueda por autor: URL multi-term, filtro biographies reforzado, UI sin badge LOW, headings "More books by this author".
