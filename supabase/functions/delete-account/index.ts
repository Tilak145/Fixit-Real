// Deletes the signed-in caller's account and data. The app calls it from its
// account screen, and ExaSpark's public account-deletion page calls it after
// an email code. Identity comes from Auth, never from the request body.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
Deno.serve(async (request: Request) => {
  const reply = (body: object, status = 200) => Response.json(body, { status, headers: cors });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authorization = request.headers.get('authorization') || '';
  const verified = await fetch(`${url}/auth/v1/user`, { headers: { apikey: admin, authorization } });
  if (!verified.ok) return reply({ error: 'Please sign in again' }, 401);
  const user = await verified.json();
  if (typeof user.id !== 'string') return reply({ error: 'Please sign in again' }, 401);
  const headers = { apikey: admin, authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' };
  // The application migration owns all user data and declares ON DELETE CASCADE.
  // Each private upload uses the user ID as its first path segment.
  const buckets = await fetch(`${url}/storage/v1/bucket`, { headers });
  if (!buckets.ok) return reply({ error: 'Could not prepare deletion. Please retry.' }, 503);
  for (const bucket of await buckets.json()) {
    // Files are flat under the user prefix. Batches bound each Storage request.
    while (true) {
      const listing = await fetch(`${url}/storage/v1/object/list/${encodeURIComponent(bucket.id)}`, {
        method: 'POST', headers, body: JSON.stringify({ prefix: user.id + '/', limit: 100, offset: 0 }),
      });
      if (!listing.ok) return reply({ error: 'Could not remove uploaded files. Please retry.' }, 503);
      const files = await listing.json();
      if (!files.length) break;
      if (files.some((file: { id: string | null }) => !file.id)) return reply({ error: 'Application file cleanup needs an update. Contact the app creator.' }, 409);
      const removed = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket.id)}`, {
        method: 'DELETE', headers, body: JSON.stringify({ prefixes: files.map((file: { name: string }) => `${user.id}/${file.name}`) }),
      });
      if (!removed.ok) return reply({ error: 'Could not remove uploaded files. Please retry.' }, 503);
    }
  }
  const deleted = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE', headers });
  return deleted.ok ? reply({ deleted: true }) : reply({ error: 'Could not delete your account. Please retry.' }, 503);
});
