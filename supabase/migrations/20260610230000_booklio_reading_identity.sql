-- Phase 1 (BOOKLIZ_PLATFORM_ROADMAP.md): cross-device copy of the on-device
-- ReadingIdentity. The app NEVER depends on this table — identity is computed
-- and stored locally; this row only enables restore on a new device and future
-- server-side features (taste neighbors, Phase 3).
--
-- Run in the Supabase SQL editor (or `supabase db push`) BEFORE wiring the
-- repository sync for this table.

create table if not exists booklio_reading_identity (
  user_id uuid primary key references auth.users (id) on delete cascade,
  identity jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

alter table booklio_reading_identity enable row level security;

create policy "Users read own identity"
  on booklio_reading_identity for select
  using (auth.uid() = user_id);

create policy "Users upsert own identity"
  on booklio_reading_identity for insert
  with check (auth.uid() = user_id);

create policy "Users update own identity"
  on booklio_reading_identity for update
  using (auth.uid() = user_id);

create policy "Users delete own identity"
  on booklio_reading_identity for delete
  using (auth.uid() = user_id);
