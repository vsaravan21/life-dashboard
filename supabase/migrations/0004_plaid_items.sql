-- Bank connections for the Finance page. Each row holds a Plaid access token,
-- so the browser must never read this table: row-level security is on with no
-- policies, which leaves it to the server (service-role key) only.
create table if not exists public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null unique,
  access_token text not null,
  institution_name text,
  created_at timestamptz not null default now()
);

create index if not exists plaid_items_user_idx on public.plaid_items (user_id);

alter table public.plaid_items enable row level security;
revoke all on public.plaid_items from anon, authenticated;
