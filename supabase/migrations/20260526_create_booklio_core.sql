create extension if not exists "pgcrypto";

create table if not exists public.booklio_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_initials text not null,
  avatar_uri text,
  email text,
  auth_provider text,
  reading_level text not null,
  yearly_goal integer not null default 12,
  favorite_authors text[] not null default '{}',
  favorite_genres text[] not null default '{}',
  top_book_ids text[] not null default '{}',
  achievements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.booklio_authors (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  bio text not null default '',
  favorite_genres text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create table if not exists public.booklio_books (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  author_id text not null,
  series_id text,
  series_name text,
  series_number integer,
  saga_order integer,
  release_order integer,
  synopsis text not null default '',
  genre text[] not null default '{}',
  pages integer not null default 0,
  published_date text not null default '',
  publisher text not null default '',
  language text not null default 'English',
  isbn text not null default '',
  format text not null default 'physical',
  cover_gradient text[] not null default '{}',
  cover_image_uri text,
  upcoming_release_date text,
  is_bestseller boolean,
  is_sequel boolean,
  tags text[] not null default '{}',
  user_status jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create table if not exists public.booklio_reading_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  book_id text not null,
  date text not null,
  start_page integer not null default 0,
  end_page integer not null default 0,
  pages_read integer not null default 0,
  minutes_read integer not null default 0,
  location text not null default '',
  mood text not null default '',
  format text not null default 'physical',
  notes text not null default '',
  favorite_quote text,
  difficulty text not null default 'moderate',
  enjoyment_rating integer not null default 0,
  pages_per_hour double precision not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create or replace function public.booklio_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_booklio_profiles_updated_at on public.booklio_profiles;
create trigger trg_booklio_profiles_updated_at
before update on public.booklio_profiles
for each row execute function public.booklio_set_updated_at();

drop trigger if exists trg_booklio_authors_updated_at on public.booklio_authors;
create trigger trg_booklio_authors_updated_at
before update on public.booklio_authors
for each row execute function public.booklio_set_updated_at();

drop trigger if exists trg_booklio_books_updated_at on public.booklio_books;
create trigger trg_booklio_books_updated_at
before update on public.booklio_books
for each row execute function public.booklio_set_updated_at();

drop trigger if exists trg_booklio_reading_sessions_updated_at on public.booklio_reading_sessions;
create trigger trg_booklio_reading_sessions_updated_at
before update on public.booklio_reading_sessions
for each row execute function public.booklio_set_updated_at();

alter table public.booklio_profiles enable row level security;
alter table public.booklio_authors enable row level security;
alter table public.booklio_books enable row level security;
alter table public.booklio_reading_sessions enable row level security;

drop policy if exists "booklio_profiles_select_own" on public.booklio_profiles;
create policy "booklio_profiles_select_own"
on public.booklio_profiles
for select
using (auth.uid() = user_id);

drop policy if exists "booklio_profiles_insert_own" on public.booklio_profiles;
create policy "booklio_profiles_insert_own"
on public.booklio_profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists "booklio_profiles_update_own" on public.booklio_profiles;
create policy "booklio_profiles_update_own"
on public.booklio_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "booklio_profiles_delete_own" on public.booklio_profiles;
create policy "booklio_profiles_delete_own"
on public.booklio_profiles
for delete
using (auth.uid() = user_id);

drop policy if exists "booklio_authors_select_own" on public.booklio_authors;
create policy "booklio_authors_select_own"
on public.booklio_authors
for select
using (auth.uid() = user_id);

drop policy if exists "booklio_authors_insert_own" on public.booklio_authors;
create policy "booklio_authors_insert_own"
on public.booklio_authors
for insert
with check (auth.uid() = user_id);

drop policy if exists "booklio_authors_update_own" on public.booklio_authors;
create policy "booklio_authors_update_own"
on public.booklio_authors
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "booklio_authors_delete_own" on public.booklio_authors;
create policy "booklio_authors_delete_own"
on public.booklio_authors
for delete
using (auth.uid() = user_id);

drop policy if exists "booklio_books_select_own" on public.booklio_books;
create policy "booklio_books_select_own"
on public.booklio_books
for select
using (auth.uid() = user_id);

drop policy if exists "booklio_books_insert_own" on public.booklio_books;
create policy "booklio_books_insert_own"
on public.booklio_books
for insert
with check (auth.uid() = user_id);

drop policy if exists "booklio_books_update_own" on public.booklio_books;
create policy "booklio_books_update_own"
on public.booklio_books
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "booklio_books_delete_own" on public.booklio_books;
create policy "booklio_books_delete_own"
on public.booklio_books
for delete
using (auth.uid() = user_id);

drop policy if exists "booklio_reading_sessions_select_own" on public.booklio_reading_sessions;
create policy "booklio_reading_sessions_select_own"
on public.booklio_reading_sessions
for select
using (auth.uid() = user_id);

drop policy if exists "booklio_reading_sessions_insert_own" on public.booklio_reading_sessions;
create policy "booklio_reading_sessions_insert_own"
on public.booklio_reading_sessions
for insert
with check (auth.uid() = user_id);

drop policy if exists "booklio_reading_sessions_update_own" on public.booklio_reading_sessions;
create policy "booklio_reading_sessions_update_own"
on public.booklio_reading_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "booklio_reading_sessions_delete_own" on public.booklio_reading_sessions;
create policy "booklio_reading_sessions_delete_own"
on public.booklio_reading_sessions
for delete
using (auth.uid() = user_id);
