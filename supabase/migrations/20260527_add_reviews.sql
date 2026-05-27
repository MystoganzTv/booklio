-- Migration: add booklio_reviews table
-- Reviews were only persisted locally; this wires them into Supabase cloud sync.

create table if not exists public.booklio_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  book_id text not null,
  rating integer not null default 0,
  title text not null default '',
  body text not null default '',
  created_at text not null default '',
  synced_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create or replace trigger trg_booklio_reviews_synced_at
before update on public.booklio_reviews
for each row execute function public.booklio_set_updated_at();

alter table public.booklio_reviews enable row level security;

drop policy if exists "booklio_reviews_select_own" on public.booklio_reviews;
create policy "booklio_reviews_select_own"
on public.booklio_reviews for select using (auth.uid() = user_id);

drop policy if exists "booklio_reviews_insert_own" on public.booklio_reviews;
create policy "booklio_reviews_insert_own"
on public.booklio_reviews for insert with check (auth.uid() = user_id);

drop policy if exists "booklio_reviews_update_own" on public.booklio_reviews;
create policy "booklio_reviews_update_own"
on public.booklio_reviews for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "booklio_reviews_delete_own" on public.booklio_reviews;
create policy "booklio_reviews_delete_own"
on public.booklio_reviews for delete using (auth.uid() = user_id);
