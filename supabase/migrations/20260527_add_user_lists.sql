-- Migration: add booklio_user_lists table
-- Custom user-created collections of books.

create table if not exists public.booklio_user_lists (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  emoji text,
  book_ids text[] not null default '{}',
  created_at text not null default '',
  updated_at text not null default '',
  synced_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

alter table public.booklio_user_lists enable row level security;

drop policy if exists "booklio_user_lists_select_own" on public.booklio_user_lists;
create policy "booklio_user_lists_select_own"
on public.booklio_user_lists for select using (auth.uid() = user_id);

drop policy if exists "booklio_user_lists_insert_own" on public.booklio_user_lists;
create policy "booklio_user_lists_insert_own"
on public.booklio_user_lists for insert with check (auth.uid() = user_id);

drop policy if exists "booklio_user_lists_update_own" on public.booklio_user_lists;
create policy "booklio_user_lists_update_own"
on public.booklio_user_lists for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "booklio_user_lists_delete_own" on public.booklio_user_lists;
create policy "booklio_user_lists_delete_own"
on public.booklio_user_lists for delete using (auth.uid() = user_id);
