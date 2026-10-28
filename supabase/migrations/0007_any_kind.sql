-- Let new dashboard sections (starting with the Gratitude Board) save without
-- another database change each time. Row-level security still keeps every
-- row private to its owner.
alter table public.entries drop constraint if exists entries_kind_check;
