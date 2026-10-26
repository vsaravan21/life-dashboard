-- Backup & sync setup: run once in Supabase (SQL Editor > New query > paste > Run).
-- Safe to run more than once. It makes sure the entries table, photo storage and
-- every section of the dashboard are allowed.

-- Life Dashboard schema: one row per entry, grouped by section ("kind").
-- Every row belongs to the signed-in user; row-level security keeps each
-- person's data visible only to them.

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('events', 'todos', 'money', 'goals', 'trips', 'books', 'journal', 'wins')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entries_user_kind_idx on public.entries (user_id, kind);

create table if not exists public.prefs (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  currency text not null default 'USD',
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before update on public.entries
  for each row execute function public.touch_updated_at();

drop trigger if exists prefs_touch on public.prefs;
create trigger prefs_touch before update on public.prefs
  for each row execute function public.touch_updated_at();

alter table public.entries enable row level security;
alter table public.prefs enable row level security;

drop policy if exists "own entries" on public.entries;
create policy "own entries" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own prefs" on public.prefs;
create policy "own prefs" on public.prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Photo journal images live in a private bucket, one folder per user.
insert into storage.buckets (id, name, public)
values ('journal', 'journal', false)
on conflict (id) do nothing;

drop policy if exists "own journal photos" on storage.objects;
create policy "own journal photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);

-- Allow every section the dashboard has today.
alter table public.entries drop constraint if exists entries_kind_check;
alter table public.entries add constraint entries_kind_check
  check (kind in ('events', 'todos', 'money', 'goals', 'trips', 'books', 'journal', 'wins', 'notes', 'lists', 'goalyears', 'goalcats', 'lookback', 'flights'));
