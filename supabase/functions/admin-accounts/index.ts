// Account administration for the management dashboard: who signed up, and
// blocking someone. It runs here because the hosted Auth admin API needs a
// privileged key that must never reach a browser. Every request is verified and
// checked against app_roles before anything happens.
//
// Deploy with deploy_edge_function. Requires 0000_admin_roles.sql.

import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
// Injected by the hosted function runtime; set it as a function secret when the
// runtime does not provide it.
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const BLOCK_DURATION = "876000h";
const PAGE_SIZE = 50;
// ponytail: a search scans at most this many pages (2500 accounts). Past that,
// filter in the database with a view over auth.users instead of scanning here.
const SEARCH_PAGE_LIMIT = 50;

function account(user: {
  id: string;
  email?: string | null;
  created_at: string;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
}) {
  return {
    id: user.id,
    email: user.email ?? null,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at ?? null,
    blocked: Boolean(user.banned_until && Date.parse(user.banned_until) > Date.now()),
  };
}

// supabase-js sends `apikey` and `x-client-info` alongside the bearer token, so
// the preflight has to name them or the browser never issues the call at all.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!url || !serviceKey) {
    return json({ error: "Account administration is not configured." }, 500);
  }

  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return json({ error: "Sign in first." }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) return json({ error: "Sign in first." }, 401);

  const { data: role } = await admin
    .from("app_roles")
    .select("role")
    .eq("user_id", caller.user.id)
    .maybeSingle();
  if (!role) return json({ error: "You do not have access to this dashboard." }, 403);

  const body = await request.json().catch(() => ({})) as {
    action?: string;
    accountId?: string;
    blocked?: boolean;
    search?: string;
    page?: number;
  };

  if (body.action === "list") {
    const search = (body.search ?? "").trim().toLowerCase();

    if (!search) {
      const { data, error } = await admin.auth.admin.listUsers({
        page: Math.max(1, body.page ?? 1),
        perPage: PAGE_SIZE,
      });
      if (error) return json({ error: error.message }, 400);
      // A full page may or may not be the last one; the dashboard says so on
      // the page that turns out to be empty rather than guessing here.
      return json({
        accounts: data.users.map((user) => account(user)),
        hasMore: data.users.length === PAGE_SIZE,
      });
    }

    // The Auth admin API cannot filter, so a search has to walk the pages
    // itself. Filtering a single page — which is what this used to do — reports
    // "no accounts" for everyone who happens to sit on page two.
    const matches: ReturnType<typeof account>[] = [];
    let page = 1;
    for (; page <= SEARCH_PAGE_LIMIT; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
      if (error) return json({ error: error.message }, 400);
      for (const user of data.users) {
        if ((user.email ?? "").toLowerCase().includes(search)) matches.push(account(user));
      }
      if (data.users.length < PAGE_SIZE) break;
    }
    return json({ accounts: matches, truncated: page > SEARCH_PAGE_LIMIT });
  }

  if (body.action === "block") {
    if (!body.accountId) return json({ error: "Missing account." }, 400);
    if (body.accountId === caller.user.id) {
      return json({ error: "An administrator cannot block their own account." }, 400);
    }
    const { error } = await admin.auth.admin.updateUserById(body.accountId, {
      ban_duration: body.blocked ? BLOCK_DURATION : "none",
    });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "Unknown action." }, 400);
});
