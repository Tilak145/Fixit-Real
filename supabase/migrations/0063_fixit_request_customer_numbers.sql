-- The customer's six-digit number beside each request, so whoever takes a call
-- can look the account up without searching names.
--
-- A number is only ever shown for a request the caller may already read: this
-- function follows the same rule as the requests table itself, and is limited
-- to dashboard staff so it cannot be used to probe other people's numbers.

create or replace function public.request_customer_numbers(p_request_ids uuid[])
returns table (request_id uuid, customer_number integer, customer_user_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only dashboard staff may see customer numbers.';
  end if;
  return query
    select q.id, c.customer_number, q.customer_user_id
    from public.quote_requests q
    join public.customer_profiles c on c.user_id = q.customer_user_id
    where q.id = any(p_request_ids);
end;
$$;

revoke all on function public.request_customer_numbers(uuid[]) from public;
grant execute on function public.request_customer_numbers(uuid[]) to authenticated;
