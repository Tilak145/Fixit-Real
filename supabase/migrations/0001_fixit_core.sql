-- FixIt core schema: service categories, providers, quote requests, leads, reviews
create table if not exists public.service_categories (
  slug text primary key,
  name text not null,
  icon text not null default 'wrench',
  sort_order int not null default 0
);

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  address text,
  description text,
  years_in_business text,
  employees text,
  logo_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  plan text not null default 'starter' check (plan in ('starter','professional','business')),
  rating numeric(3,2) not null default 0,
  review_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_services (
  provider_id uuid not null references public.providers(id) on delete cascade,
  category_slug text not null references public.service_categories(slug),
  primary key (provider_id, category_slug)
);

create table if not exists public.provider_service_areas (
  provider_id uuid not null references public.providers(id) on delete cascade,
  city text not null,
  primary key (provider_id, city)
);

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null references public.service_categories(slug),
  description text not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  city text not null,
  status text not null default 'new' check (status in ('new','claimed','completed')),
  claimed_by uuid references public.providers(id),
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  author_name text not null,
  rating int not null check (rating between 1 and 5),
  comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  quote_request_id uuid references public.quote_requests(id),
  title text not null,
  customer_name text not null,
  city text not null,
  scheduled_for timestamptz not null,
  created_at timestamptz not null default now()
);

-- Categories are reference data readable by everyone
alter table public.service_categories enable row level security;
create policy "categories are public" on public.service_categories for select using (true);

-- Approved providers are public profiles; providers manage their own row
alter table public.providers enable row level security;
create policy "approved providers are public" on public.providers for select using (status = 'approved' or auth_user_id = auth.uid());
create policy "providers insert own row" on public.providers for insert with check (auth_user_id = auth.uid());
create policy "providers update own row" on public.providers for update using (auth_user_id = auth.uid());

alter table public.provider_services enable row level security;
create policy "provider services readable" on public.provider_services for select using (true);
create policy "providers manage own services" on public.provider_services for all using (
  exists (select 1 from public.providers p where p.id = provider_id and p.auth_user_id = auth.uid())
);
alter table public.provider_service_areas enable row level security;
create policy "areas readable" on public.provider_service_areas for select using (true);
create policy "providers manage own areas" on public.provider_service_areas for all using (
  exists (select 1 from public.providers p where p.id = provider_id and p.auth_user_id = auth.uid())
);

-- Quote requests: anyone can submit; claiming providers see leads matching their services/areas
alter table public.quote_requests enable row level security;
create policy "anyone can submit a quote request" on public.quote_requests for insert with check (true);
create policy "providers see matching leads" on public.quote_requests for select using (
  exists (
    select 1 from public.providers p
    join public.provider_services s on s.provider_id = p.id
    join public.provider_service_areas a on a.provider_id = p.id
    where p.auth_user_id = auth.uid()
      and s.category_slug = quote_requests.category_slug
      and a.city = quote_requests.city
  ) or claimed_by in (select id from public.providers where auth_user_id = auth.uid())
);
create policy "claiming provider updates lead" on public.quote_requests for update using (
  claimed_by in (select id from public.providers where auth_user_id = auth.uid())
);

alter table public.reviews enable row level security;
create policy "reviews are public" on public.reviews for select using (true);
create policy "customers can leave a review" on public.reviews for insert with check (true);

alter table public.appointments enable row level security;
create policy "providers manage own appointments" on public.appointments for all using (
  exists (select 1 from public.providers p where p.id = provider_id and p.auth_user_id = auth.uid())
);
