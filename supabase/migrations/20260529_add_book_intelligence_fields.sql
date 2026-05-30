-- Migration: Book Intelligence Engine fields
-- Adds work_key, edition_key, language_code to booklio_books.
--
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards throughout).
-- Apply via:
--   Supabase Dashboard → SQL Editor → paste & run, OR
--   supabase db push  (if using the Supabase CLI with a linked project)

-- ─── New columns ─────────────────────────────────────────────────────────────

alter table public.booklio_books
  add column if not exists work_key text,
  add column if not exists edition_key text,
  add column if not exists language_code text;

-- work_key     — Open Library canonical work key, e.g. "/works/OL12345W"
--                NULL for books added before the Intelligence Engine,
--                or for books sourced exclusively from Google Books.
--
-- edition_key  — Open Library edition key, e.g. "/books/OL12345M"
--                NULL when the specific edition isn't in Open Library.
--
-- language_code — ISO 639-1 two-letter code, e.g. "en", "es", "fr"
--                 NULL for legacy rows (language stored as display name
--                 in the existing `language` text column).

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- Allows fast "find all editions of the same work" queries per user.
create index if not exists idx_booklio_books_work_key
  on public.booklio_books (user_id, work_key)
  where work_key is not null;

-- Allows dedup checks: "does this user already have this exact edition?"
create index if not exists idx_booklio_books_edition_key
  on public.booklio_books (user_id, edition_key)
  where edition_key is not null;

-- Supports "show me all books in Spanish" filters.
create index if not exists idx_booklio_books_language_code
  on public.booklio_books (user_id, language_code)
  where language_code is not null;

-- ─── Back-fill hint (optional, run manually if desired) ───────────────────────
-- The columns default to NULL for all pre-existing rows.
-- No automatic back-fill is performed here; the app will populate
-- work_key / edition_key / language_code the next time a book is
-- edited or re-fetched through the Book Intelligence Engine.
