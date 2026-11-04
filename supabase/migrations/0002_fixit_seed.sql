-- Marketplace demo content: platform-seeded provider profiles (no auth account yet)
alter table public.providers alter column auth_user_id drop not null;
alter table public.providers drop constraint providers_auth_user_id_key;
create unique index providers_auth_user_id_key on public.providers (auth_user_id) where auth_user_id is not null;

insert into public.service_categories (slug, name, icon, sort_order) values
  ('plumbing','Plumbing','wrench',1),
  ('electrical','Electrical','zap',2),
  ('hvac','HVAC','fan',3),
  ('garage-doors','Garage Doors','warehouse',4),
  ('roofing','Roofing','home',5),
  ('appliance-repair','Appliance Repair','washing-machine',6),
  ('handyman','Handyman','hammer',7),
  ('cleaning','Cleaning','spray-can',8),
  ('pest-control','Pest Control','bug',9),
  ('landscaping','Landscaping','leaf',10)
on conflict (slug) do nothing;

-- Demo providers (approved, seeded content)
insert into public.providers (id, auth_user_id, business_name, email, phone, website, address, description, years_in_business, employees, status, plan, logo_url) values
  ('11111111-1111-4111-8111-111111111111', null, 'Akron Plumbing Pros', 'hello@akronplumbingpros.example', '(234) 555-0121', 'https://akronplumbingpros.example', 'Akron, OH', 'Family-owned plumbing crew serving Akron for over a decade. 24/7 emergency service, upfront pricing.', '10+ years', '6-10', 'approved', 'professional', '/assets/cac346852d56c22dda280cbbb86392d83ec74ab6dbea19d462325fc89f7458a9.jpg'),
  ('22222222-2222-4222-8222-222222222222', null, 'Elite HVAC Solutions', 'team@elitehvac.example', '(234) 555-0132', 'https://elitehvac.example', 'Akron, OH', 'Certified heating and cooling specialists. Same-day AC repair and seasonal maintenance plans.', '8+ years', '6-10', 'approved', 'professional', '/assets/be782792d01dd49ebcfa3131b8710678122d055151625dc7edea12b838dd083b.jpg'),
  ('33333333-3333-4333-8333-333333333333', null, 'Summit Garage Doors', 'service@summitgarage.example', '(234) 555-0143', 'https://summitgarage.example', 'Akron, OH', 'Garage door installation, opener repair and spring replacement with a 2-year workmanship warranty.', '5+ years', '2-5', 'approved', 'starter', '/assets/f5cd92936ee38a0e98f9371d1afa3a9d0589035c9f035718861e511fef89c29d.jpg'),
  ('44444444-4444-4444-8444-444444444444', null, 'Bright Electric', 'contact@brightelectric.example', '(234) 555-0154', 'https://brightelectric.example', 'Akron, OH', 'Licensed electricians for panel upgrades, lighting, EV chargers and whole-home rewiring.', '12+ years', '6-10', 'approved', 'business', '/assets/655ddbf67a0c4dc2c748201704f6aaeada01648ae69be7002ae9d1c108f1a9df.jpg')
on conflict (id) do nothing;

insert into public.provider_services (provider_id, category_slug) values
  ('11111111-1111-4111-8111-111111111111','plumbing'),
  ('22222222-2222-4222-8222-222222222222','hvac'),
  ('33333333-3333-4333-8333-333333333333','garage-doors'),
  ('44444444-4444-4444-8444-444444444444','electrical')
on conflict do nothing;

insert into public.provider_service_areas (provider_id, city) values
  ('11111111-1111-4111-8111-111111111111','Akron, OH'),
  ('11111111-1111-4111-8111-111111111111','Cuyahoga Falls, OH'),
  ('22222222-2222-4222-8222-222222222222','Akron, OH'),
  ('22222222-2222-4222-8222-222222222222','Kent, OH'),
  ('33333333-3333-4333-8333-333333333333','Akron, OH'),
  ('33333333-3333-4333-8333-333333333333','Stow, OH'),
  ('44444444-4444-4444-8444-444444444444','Akron, OH'),
  ('44444444-4444-4444-8444-444444444444','Barberton, OH')
on conflict do nothing;

insert into public.reviews (provider_id, author_name, rating, comment) values
  ('11111111-1111-4111-8111-111111111111','Jennifer K.',5,'Great service! Fixed our leaky pipe quickly and very professional.'),
  ('11111111-1111-4111-8111-111111111111','Mark L.',5,'On time, fair price, and excellent work. Highly recommend!'),
  ('22222222-2222-4222-8222-222222222222','Dan W.',5,'Had our AC running again within hours of calling.'),
  ('33333333-3333-4333-8333-333333333333','Lisa R.',4,'Very knowledgeable and friendly. Will use again!'),
  ('44444444-4444-4444-8444-444444444444','Priya S.',5,'Installed our EV charger cleanly and explained everything.')
on conflict do nothing;

update public.providers p set
  rating = round((select avg(rating) from public.reviews r where r.provider_id = p.id), 2),
  review_count = (select count(*) from public.reviews r where r.provider_id = p.id);
