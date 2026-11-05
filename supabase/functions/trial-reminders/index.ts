// Sends the Founding Pro reminders that are due, once a day.
//
// Nobody is charged when a free period ends, so the email is the notice that
// keeps the next step a decision rather than a surprise. A reminder is recorded
// once per free period by public.sweep_trial_reminders(); one is marked 'sent'
// only after the email provider accepts it, so a retry, two schedulers racing
// or a failed send can never email the same pro twice by mistake - and a failed
// send stays pending for the next run.
//
// Settings come from the environment first (RESEND_API_KEY, MAIL_FROM,
// MAIL_REPLY_TO), then from public.mail_settings, which only the server can
// read. With no provider configured it reports that honestly and sends nothing.
//
// How to call it:
//   POST                                    -> send what is due (scheduler or owner)
//   POST ?dry=1                             -> list what would be sent, send nothing
//   Authorization: Bearer <user token>      -> the owner may run it
//   x-reminder-key: <TRIAL_REMINDER_KEY>    -> a scheduler with the shared secret
//
// Requires 0053-0056.

import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const schedulerKey = Deno.env.get("TRIAL_REMINDER_KEY") ?? "";
const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/u, "");
const RESEND_URL = "https://api.resend.com/emails";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-reminder-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

interface MailConfig {
  apiKey: string;
  from: string;
  replyTo: string | null;
}

interface Reminder {
  id: string;
  plan: string;
  price_per_month: number;
  message: string | null;
  email_to: string | null;
}

function html(message: string, actionUrl: string): string {
  const body = message
    .split("\n")
    .map((line) => (line.trim() ? `<p style="margin:0 0 12px">${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : ""))
    .join("");
  return `<!doctype html><html><body style="font:16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b2430;background:#f6f8fb;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;border:1px solid #e5e9f0">
    <div style="font-weight:800;font-size:20px;color:#0d2c54;margin-bottom:18px">FixIt <span style="font-weight:500;font-size:13px;color:#6b7785">LOCAL SERVICES</span></div>
    ${body}
    <p style="margin:22px 0 0"><a href="${actionUrl}" style="display:inline-block;background:#f7941d;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Review my plan</a></p>
    <p style="margin:22px 0 0;font-size:13px;color:#6b7785">You are getting this because your business took one of the first 100 Founding Pro places.</p>
  </div></body></html>`;
}

// deno-lint-ignore no-explicit-any
async function readConfig(admin: any): Promise<MailConfig | null> {
  const envKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  const envFrom = (Deno.env.get("MAIL_FROM") ?? "").trim();
  if (envKey && envFrom) return { apiKey: envKey, from: envFrom, replyTo: Deno.env.get("MAIL_REPLY_TO") ?? null };
  const { data, error } = await admin.from("mail_settings").select("api_key, from_address, reply_to").limit(1).maybeSingle();
  if (error || !data) return null;
  const row = data as { api_key: string | null; from_address: string | null; reply_to: string | null };
  if (!row.api_key || !row.from_address) return null;
  return { apiKey: row.api_key, from: row.from_address, replyTo: row.reply_to };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!url || !serviceKey) return json({ error: "Reminders are not configured." }, 500);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Who is calling: a dashboard manager, or a scheduler with its own key.
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const key = request.headers.get("x-reminder-key") ?? "";
  let caller = "scheduler";
  if (token) {
    const { data: user, error } = await admin.auth.getUser(token);
    if (error || !user.user) return json({ error: "Sign in first." }, 401);
    const { data: role } = await admin.from("app_roles").select("role").eq("user_id", user.user.id).maybeSingle();
    // Trial reminders is an owner-only screen: staff ("manager") are on app_roles too.
    if (role?.role !== "admin") return json({ error: "Only the owner may run trial reminders." }, 403);
    caller = "dashboard";
  } else if (!schedulerKey || key !== schedulerKey) {
    return json({ error: "Sign in first." }, 401);
  }

  const dryRun = new URL(request.url).searchParams.get("dry") === "1";

  const { data: created, error: sweepError } = await admin.rpc("sweep_trial_reminders");
  if (sweepError) return json({ error: sweepError.message }, 400);

  const { data: due, error: dueError } = await admin
    .from("pro_trial_reminders")
    .select("id, plan, price_per_month, message, email_to")
    .eq("status", "pending")
    .lte("remind_on", new Date().toISOString().slice(0, 10))
    .order("remind_on", { ascending: true });
  if (dueError) return json({ error: dueError.message }, 400);

  // A stored message is preferred; one recorded before the column existed is
  // described here so a reminder is never dropped for being blank.
  const rows = ((due ?? []) as Reminder[]).map((row) => ({
    ...row,
    message: row.message ?? "Your FixIt Founding Pro free period is ending soon. Nothing is charged automatically - review your plan on your FixIt dashboard.",
  }));
  const config = await readConfig(admin);
  if (!config) {
    return json({
      caller,
      dryRun,
      mailReady: false,
      recorded: typeof created === "number" ? created : 0,
      due: rows.length,
      sent: 0,
      message: "No email provider is connected yet, so nothing was sent. Connect one to start sending automatically.",
      preview: rows.map((row) => ({ to: row.email_to, subject: "Your FixIt free period ends soon", message: row.message })),
    });
  }

  const results: Array<{ id: string; to: string | null; sent: boolean; reason?: string }> = [];
  for (const row of rows) {
    const to = row.email_to?.trim() || null;
    if (!to) {
      results.push({ id: row.id, to: null, sent: false, reason: "No email address on the business profile." });
      continue;
    }
    if (dryRun) {
      results.push({ id: row.id, to, sent: false, reason: "Dry run - not sent." });
      continue;
    }
    let delivered = false;
    try {
      const response = await fetch(RESEND_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: config.from,
          to: [to],
          ...(config.replyTo ? { reply_to: config.replyTo } : {}),
          subject: "Your FixIt free period ends soon",
          text: row.message,
          html: html(row.message ?? "", `${APP_URL}/pro/dashboard`),
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) {
        delivered = true;
      } else {
        const detail = await response.json().catch(() => null) as { message?: string } | null;
        results.push({ id: row.id, to, sent: false, reason: detail?.message ?? `The email provider answered ${response.status}.` });
      }
    } catch {
      results.push({ id: row.id, to, sent: false, reason: "Could not reach the email provider." });
    }
    if (!delivered) continue;
    // Only an accepted email is marked sent: a failure stays pending for tomorrow.
    const { error: updateError } = await admin
      .from("pro_trial_reminders")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "pending");
    results.push({ id: row.id, to, sent: !updateError, ...(updateError ? { reason: updateError.message } : {}) });
  }

  return json({
    caller,
    dryRun,
    mailReady: true,
    recorded: typeof created === "number" ? created : 0,
    due: rows.length,
    sent: results.filter((result) => result.sent).length,
    results,
  });
});
