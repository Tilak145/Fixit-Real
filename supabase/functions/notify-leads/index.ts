// Tells professionals about new leads, by email and by phone notification.
//
// Called every minute by the 'notify-leads' schedule. Each call:
//   1. queues an alert for every (lead, pro) pair that is visible right now
//      (public.queue_lead_alerts applies the same rules as the leads policy);
//   2. sends each pending alert as an email (Resend) and a phone notification
//      (Expo push), and records what was delivered.
//
// It needs no secret to be called: it only works through the queue, an alert is
// sent at most once, and an extra call finds nothing new. It never includes the
// customer's name, phone, email or address - those are released only after the
// customer accepts a price.
//
// Mail settings come from the environment (RESEND_API_KEY, MAIL_FROM,
// MAIL_REPLY_TO) first, then public.mail_settings.

import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/u, "");
const RESEND_URL = "https://api.resend.com/emails";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH = 40;
// A failed send is retried each minute for this long, then given up on.
const GIVE_UP_MS = 20 * 60_000;

const SERVICE_NAMES: Record<string, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "HVAC",
  "garage-doors": "Garage doors",
  roofing: "Roofing",
  "appliance-repair": "Appliance repair",
  handyman: "Handyman",
  cleaning: "Cleaning",
  "pest-control": "Pest control",
  landscaping: "Landscaping",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface MailConfig { apiKey: string; from: string; replyTo: string | null }

// deno-lint-ignore no-explicit-any
async function readMailConfig(admin: any): Promise<MailConfig | null> {
  const envKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  const envFrom = (Deno.env.get("MAIL_FROM") ?? "").trim();
  if (envKey && envFrom) return { apiKey: envKey, from: envFrom, replyTo: Deno.env.get("MAIL_REPLY_TO") ?? null };
  const { data, error } = await admin.from("mail_settings").select("api_key, from_address, reply_to").limit(1).maybeSingle();
  if (error || !data) return null;
  const row = data as { api_key: string | null; from_address: string | null; reply_to: string | null };
  if (!row.api_key || !row.from_address) return null;
  return { apiKey: row.api_key, from: row.from_address, replyTo: row.reply_to };
}

interface Lead { id: string; category_slug: string; city: string; is_emergency: boolean; description: string | null }

function summary(description: string | null): string {
  const text = (description ?? "").trim();
  return text.length > 500 ? text.slice(0, 497) + "..." : text;
}

function emailBody(lead: Lead, service: string): { subject: string; text: string; html: string } {
  const tag = lead.is_emergency ? "EMERGENCY: " : "";
  const subject = `${tag}New ${service} lead in ${lead.city}`;
  const body = summary(lead.description);
  const link = APP_URL ? `${APP_URL}/pro/dashboard` : "";
  const text = [
    lead.is_emergency ? "This customer needs help today." : "A customer is looking for a price.",
    `Service: ${service}`,
    `City: ${lead.city}`,
    body ? `\n${body}` : "",
    link ? `\nOpen it and send your price: ${link}` : "\nOpen FixIt to send your price.",
    "\nYou are getting this because the request matches your services and cities. Reply fast: the first good price often wins.",
  ].join("\n");
  const lines = body.split("\n").map((l) => (l.trim() ? `<div>${esc(l)}</div>` : "")).join("");
  const html = `<!doctype html><html><body style="font:16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b2430;background:#f6f8fb;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;border:1px solid #e5e9f0">
    <div style="font-weight:800;font-size:20px;color:#0d2c54;margin-bottom:14px">FixIt <span style="font-weight:500;font-size:13px;color:#6b7785">LOCAL SERVICES</span></div>
    ${lead.is_emergency ? '<p style="margin:0 0 12px;color:#b3261e;font-weight:800">EMERGENCY - this customer needs help today</p>' : ""}
    <p style="margin:0 0 4px"><strong>${esc(service)}</strong> in <strong>${esc(lead.city)}</strong></p>
    <div style="margin:12px 0;padding:12px 14px;background:#f6f8fb;border-radius:10px;font-size:15px">${lines || "No details yet."}</div>
    ${link ? `<p style="margin:20px 0 0"><a href="${link}" style="display:inline-block;background:#f7941d;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Open it and send your price</a></p>` : ""}
    <p style="margin:20px 0 0;font-size:13px;color:#6b7785">You are getting this because the request matches your services and cities.</p>
  </div></body></html>`;
  return { subject, text, html };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok");
  if (!url || !serviceKey) return json({ error: "Not configured." }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: queued, error: queueError } = await admin.rpc("queue_lead_alerts");
  if (queueError) return json({ error: queueError.message }, 500);

  const { data: pending, error: pendingError } = await admin
    .from("lead_alerts")
    .select("request_id, provider_id, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (pendingError) return json({ error: pendingError.message }, 500);
  const alerts = (pending ?? []) as Array<{ request_id: string; provider_id: string; created_at: string }>;
  if (alerts.length === 0) return json({ queued, processed: 0 });

  const requestIds = [...new Set(alerts.map((a) => a.request_id))];
  const providerIds = [...new Set(alerts.map((a) => a.provider_id))];
  const [{ data: leadRows }, { data: providerRows }] = await Promise.all([
    admin.from("quote_requests").select("id, category_slug, city, is_emergency, description").in("id", requestIds),
    admin.from("providers").select("id, email, auth_user_id, business_name").in("id", providerIds),
  ]);
  const leads = new Map(((leadRows ?? []) as Lead[]).map((l) => [l.id, l]));
  const providers = new Map(
    ((providerRows ?? []) as Array<{ id: string; email: string | null; auth_user_id: string | null }>).map((p) => [p.id, p]),
  );
  const userIds = [...new Set([...providers.values()].map((p) => p.auth_user_id).filter((id): id is string => !!id))];
  const { data: tokenRows } = userIds.length
    ? await admin.from("push_tokens").select("token, user_id").in("user_id", userIds)
    : { data: [] as Array<{ token: string; user_id: string }> };
  const tokensByUser = new Map<string, string[]>();
  for (const row of (tokenRows ?? []) as Array<{ token: string; user_id: string }>) {
    tokensByUser.set(row.user_id, [...(tokensByUser.get(row.user_id) ?? []), row.token]);
  }
  const mail = await readMailConfig(admin);

  let sent = 0;
  let failed = 0;
  for (const alert of alerts) {
    const lead = leads.get(alert.request_id);
    const provider = providers.get(alert.provider_id);
    const mark = async (status: "sent" | "failed" | "pending", emailed: boolean, pushed: boolean, detail: string | null) => {
      await admin
        .from("lead_alerts")
        .update({ status, emailed, pushed, detail, ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}) })
        .eq("request_id", alert.request_id)
        .eq("provider_id", alert.provider_id);
    };
    if (!lead || !provider) {
      await mark("failed", false, false, "The lead or the business no longer exists.");
      failed += 1;
      continue;
    }
    const service = SERVICE_NAMES[lead.category_slug] ?? lead.category_slug;
    const message = emailBody(lead, service);
    const problems: string[] = [];
    let emailed = false;
    let pushed = false;

    const to = provider.email?.trim();
    if (to && mail) {
      try {
        const response = await fetch(RESEND_URL, {
          method: "POST",
          headers: { authorization: `Bearer ${mail.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            from: mail.from,
            to: [to],
            ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (response.ok) emailed = true;
        else problems.push(`email: provider answered ${response.status}`);
      } catch {
        problems.push("email: could not reach the provider");
      }
    } else if (!to) {
      problems.push("email: no address on the business");
    } else {
      problems.push("email: no mail provider connected");
    }

    const tokens = provider.auth_user_id ? tokensByUser.get(provider.auth_user_id) ?? [] : [];
    if (tokens.length > 0) {
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify(
            tokens.map((token) => ({
              to: token,
              title: lead.is_emergency ? `Emergency ${service} lead` : `New ${service} lead`,
              body: `${lead.city}. Tap to see it and send your price.`,
              sound: "default",
              priority: "high",
              channelId: "leads",
              data: { url: "/pro", requestId: lead.id },
            })),
          ),
          signal: AbortSignal.timeout(15000),
        });
        const result = (await response.json().catch(() => null)) as
          | { data?: Array<{ status: string; details?: { error?: string } }> }
          | null;
        const tickets = result?.data ?? [];
        tickets.forEach((ticket, index) => {
          if (ticket.status === "ok") pushed = true;
          else if (ticket.details?.error === "DeviceNotRegistered") {
            // The app was removed: stop sending to that phone.
            void admin.from("push_tokens").delete().eq("token", tokens[index]);
          }
        });
        if (!pushed) problems.push("push: not delivered");
      } catch {
        problems.push("push: could not reach the push service");
      }
    }

    if (emailed || pushed) {
      await mark("sent", emailed, pushed, problems.length ? problems.join("; ") : null);
      sent += 1;
    } else if (Date.now() - new Date(alert.created_at).getTime() > GIVE_UP_MS) {
      await mark("failed", false, false, problems.join("; ") || "Nothing could be sent.");
      failed += 1;
    } else {
      await mark("pending", false, false, problems.join("; "));
    }
  }
  return json({ queued, processed: alerts.length, sent, failed });
});
