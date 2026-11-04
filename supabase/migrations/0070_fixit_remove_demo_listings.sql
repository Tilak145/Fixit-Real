-- A new database starts with no made-up businesses or reviews.
--
-- 0002 seeded four demo professionals and their reviews, and later migrations
-- build on those rows, so they are removed here rather than edited out of the
-- history. Their reviews, service areas and hours go with them by cascade.
-- Only accountless rows are touched, so a real business can never match.
delete from public.providers
where auth_user_id is null
  and id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444'
  );
