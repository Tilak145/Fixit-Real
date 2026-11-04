-- 0018 revoked SELECT on just the two contact columns, which does nothing while
-- a table-level SELECT grant exists: in PostgreSQL a table-level privilege
-- covers every column, so a column revoke is silently ignored. This closes the
-- same hole properly, by revoking the table-level SELECT and granting back only
-- the columns a reader may see. Contact details now come from
-- quote_request_contacts, where a row-level rule waits for the lead to be
-- claimed.

revoke select on public.quote_requests from anon, authenticated;

-- Everything except the customer's contact details. The client never asks for
-- those columns, so nothing that works today stops working.
grant select (
  id,
  category_slug,
  description,
  customer_name,
  city,
  status,
  claimed_by,
  created_at,
  customer_user_id
) on public.quote_requests to anon, authenticated;
