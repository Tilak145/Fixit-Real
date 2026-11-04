-- Reviews come from a real account. The original policy allowed an anonymous
-- insert, which lets anyone post a rating without ever hiring; tying the row to
-- the reviewer's account also lets the dashboard see who wrote it.
--
-- The pro's average and count are refreshed by trigger so the profile listing
-- never drifts from the reviews it shows.

alter table public.reviews
  add column if not exists author_user_id uuid references auth.users(id) on delete set null;

drop policy if exists "customers can leave a review" on public.reviews;
create policy "customers can leave a review" on public.reviews
  for insert to authenticated
  with check (author_user_id = (select auth.uid()));

drop policy if exists "customers update their review" on public.reviews;
create policy "customers update their review" on public.reviews
  for update to authenticated
  using (author_user_id = (select auth.uid()))
  with check (author_user_id = (select auth.uid()));

-- One review per customer per professional.
create unique index if not exists reviews_author_provider_idx
  on public.reviews (author_user_id, provider_id)
  where author_user_id is not null;

create or replace function public.refresh_provider_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.provider_id, old.provider_id);
begin
  update public.providers p set
    rating = coalesce((select round(avg(rating), 2) from public.reviews r where r.provider_id = target), 0),
    review_count = (select count(*) from public.reviews r where r.provider_id = target)
  where p.id = target;
  return null;
end;
$$;

drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_provider_rating();
