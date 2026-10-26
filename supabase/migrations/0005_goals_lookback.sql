-- Allow the Goals page's years and categories, and the Looking Back page's months.
alter table public.entries drop constraint if exists entries_kind_check;
alter table public.entries add constraint entries_kind_check
  check (kind in ('events', 'todos', 'money', 'goals', 'trips', 'books', 'journal', 'wins', 'notes', 'lists', 'goalyears', 'goalcats', 'lookback'));
