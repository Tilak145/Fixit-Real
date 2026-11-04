# Management dashboard

A ready-made dashboard for whoever runs this product: list, create, edit and
delete the rows of the tables you give it. Wire it up in three steps.

1. Apply `supabase/migrations`, then make the first owner with the SQL in the
   project README. Add one policy per table the dashboard manages (the pattern
   is at the bottom of `0000_admin_roles.sql`). The owner can sign in with an
   email code at `/admin`.
2. Fill in `adminResources` in `config.ts` with those tables.
3. Create `app/admin/page.tsx`:

   ```tsx
   import { AdminPage } from "@/features/admin/pages";

   export default AdminPage;
   ```

Access is decided by the database, not by this page: `app_roles` says who works
here, and each table's own policy says what they may do with it. The page only
hides what the policies would refuse anyway.

## Roles and the team section

`app_roles.role` has two values (migration `0009_fixit_team_roles.sql`):

- `admin` — the owner. Everything, including the Team section, where they add
  and remove the other people who may sign in.
- `manager` — staff. Runs the marketplace; the Team section is not shown, and
  the database would refuse it if it were.

Only an owner may add someone, and the last owner cannot be removed or demoted:
a trigger enforces that so the dashboard can never lock everyone out. Both roles
sign in at the same management door (`admin-signin.tsx`); what each sees is
decided inside the dashboard and, more importantly, by the policies.

Adding someone names an account that already exists. `admin_search_accounts`
(migration `0010_admin_account_directory.sql`) reads just enough of `auth.users`
to pick the right one, and only an owner may call it.

## Sections

The sidebar has an Overview home, one entry per `adminResources` table, and:

- **Services** — the `service_categories` catalogue (keyed by `slug`, not `id`;
  a new row must supply one).
- **Activity** — a read-only trail of every change to the managed tables, written
  by the `log_activity` trigger (migration `0012_fixit_activity_log.sql`). No
  insert, update or delete policy exists, so nothing in the app can alter it.
- **Team** — owners only, described above.

## Licence checks

A professional supplies a licence number at sign-up (`onboarding-wizard.tsx`,
step 4) and it is stored on `providers.license_number`. The Overview's "Waiting
for approval" list shows the number and a **Check licence** button; approval is
blocked until it passes.

`check_provider_license` (migration `0014`) checks the shape of the number
(letters and digits, 4–24 characters, at least one digit) and whether another
provider already holds it, then records `format_ok` or `format_invalid` /
`lookup_failed` on the row. A unique index on the normalised number stops a
duplicate from being saved at all.

This is **not** a state-registry lookup: that needs an official Ohio records API
and an account to reach it, which this project does not have. The verdict says
"looks like a valid licence number" and the owner confirms it against the state
register before approving. To add a real lookup later, call it from
`check_provider_license` and record `lookup_verified` — the page already treats
that as a pass and nothing else changes.

A trigger (`providers_guard_license_status`, migration `0015`/`0016`) resets the
verdict to `unverified` whenever anyone but dashboard staff writes the row, so a
provider cannot mark their own licence as passed.

## Accounts

To also manage the people who sign in — who signed up, sending a password
reset, blocking someone — deploy `supabase/functions/admin-accounts` with
`deploy_edge_function` and set `adminAccounts = true` in `config.ts`.

Listing and blocking go through the hosted Auth admin API, which needs a
privileged key, so they run inside that function: it verifies the caller's token
and checks `app_roles` before it acts, and the key never leaves the server.
Resetting a password needs no privilege at all — the dashboard sends the same
recovery email the sign-in page sends, so only the account holder can complete
it and no administrator ever sees or sets someone else's password.

Add account features the same way. Never reach for a `service_role` key in the
browser or in project source.
