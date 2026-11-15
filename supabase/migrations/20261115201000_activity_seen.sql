-- When a person last looked at "your quote was accepted or declined" news, so a
-- professional is told once about each customer decision. One row per person.
create table if not exists public.activity_seen (
  user_id uuid primary key references auth.users(id) on delete cascade,
  quote_responses_seen_at timestamptz not null default now()
);

alter table public.activity_seen enable row level security;

create policy "people read their own seen mark" on public.activity_seen
  for select to authenticated using (user_id = (select auth.uid()));
create policy "people write their own seen mark" on public.activity_seen
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "people update their own seen mark" on public.activity_seen
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
