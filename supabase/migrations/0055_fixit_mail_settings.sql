-- Where any mail sender running for FixIt finds its settings.
--
-- Sending mail needs an account with an email provider, which the site owner
-- creates. The settings live here rather than in a browser: row security is on
-- with no policy at all, so only the server-side sender (whose key bypasses
-- row security) can read the API key. A person can write it through the
-- functions below, either as a manager in the dashboard or with the owner
-- token, and can never read it back.

create table if not exists public.mail_settings (
  id boolean primary key default true check (id),
  provider text not null check (provider in ('resend')),
  api_key text,
  -- e.g. "FixIt <hello@yourdomain.com>". Must be an address the provider has verified.
  from_address text,
  reply_to text,
  updated_at timestamptz not null default now()
);

alter table public.mail_settings enable row level security;
-- Deliberately no policies: nobody in the browser can read or write the key.

revoke all on table public.mail_settings from anon, authenticated;

-- Whether mail is ready, without exposing the key. Safe for the dashboard.
create or replace function public.mail_status()
returns table (ready boolean, provider text, from_address text, has_key boolean, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  row public.mail_settings;
begin
  if not (select public.is_admin()) then
    raise exception 'Only dashboard staff may see mail settings.';
  end if;
  select * into row from public.mail_settings limit 1;
  return query select
    coalesce(row.api_key is not null and row.from_address is not null, false),
    row.provider,
    row.from_address,
    row.api_key is not null,
    row.updated_at;
end;
$$;

revoke all on function public.mail_status() from public;
grant execute on function public.mail_status() to authenticated;

-- Save the settings. From the dashboard a manager may set or replace them; from
-- a terminal, the site owner's own session token (the 'owner' claim) may too.
-- The key is only written when one is supplied, so re-saving the address does
-- not require pasting the key again.
create or replace function public.set_mail_settings(p_api_key text, p_from_address text, p_reply_to text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
begin
  if not (select public.is_admin()) and coalesce(claims ->> 'role', '') <> 'owner' then
    raise exception 'Only the site owner may change mail settings.';
  end if;
  if p_from_address is null or position('@' in p_from_address) = 0 then
    raise exception 'Give a From address the email provider has verified.';
  end if;
  insert into public.mail_settings (id, provider, api_key, from_address, reply_to, updated_at)
  values (true, 'resend', nullif(btrim(p_api_key), ''), btrim(p_from_address), nullif(btrim(p_reply_to), ''), now())
  on conflict (id) do update
    set api_key = coalesce(nullif(btrim(excluded.api_key), ''), public.mail_settings.api_key),
        from_address = excluded.from_address,
        reply_to = excluded.reply_to,
        updated_at = now();
end;
$$;

revoke all on function public.set_mail_settings(text, text, text) from public;
grant execute on function public.set_mail_settings(text, text, text) to authenticated;
