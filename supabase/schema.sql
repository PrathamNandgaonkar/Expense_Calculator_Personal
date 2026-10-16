-- Hisaab cloud storage. Run this once in Supabase → SQL Editor → New query.
-- Each signed-in user gets exactly one row holding their whole ledger as JSON.
-- Row-level security makes sure a user can only ever read or write their own row.

create table if not exists public.hisaab_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.hisaab_state enable row level security;

drop policy if exists "read own ledger"   on public.hisaab_state;
drop policy if exists "create own ledger" on public.hisaab_state;
drop policy if exists "update own ledger" on public.hisaab_state;
drop policy if exists "delete own ledger" on public.hisaab_state;

create policy "read own ledger"   on public.hisaab_state for select using (auth.uid() = user_id);
create policy "create own ledger" on public.hisaab_state for insert with check (auth.uid() = user_id);
create policy "update own ledger" on public.hisaab_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own ledger" on public.hisaab_state for delete using (auth.uid() = user_id);
