// Emails professionals what FixIt decided about their business (license,
// insurance, registration, approval). Woken by the database as soon as a notice
// is saved, and once a minute for retries.
//
// It needs no secret to be called: it only sends notices already in the queue,
// each one is claimed by a single call, and an extra call finds nothing to do.

import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/u, "") || "https://www.fixitls.com";
const MAX_ATTEMPTS = 5;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface Claimed { id: string; provider_id: string; title: string; body: string; tone: string; email_attempts: number }

Deno.serve(async () => {
  if (!url || !serviceKey) return json({ error: "Not configured." }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let apiKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  let from = (Deno.env.get("MAIL_FROM") ?? "").trim();
  let replyTo: string | null = Deno.env.get("MAIL_REPLY_TO") ?? null;
  if (!apiKey || !from) {
    const { data } = await admin.from("mail_settings").select("api_key, from_address, reply_to").limit(1).maybeSingle();
    apiKey = data?.api_key ?? "";
    from = data?.from_address ?? "";
    replyTo = data?.reply_to ?? null;
  }
  if (!apiKey || !from) return json({ error: "No email provider is connected." }, 200);

  const { data: claimed, error } = await admin.rpc("claim_notice_emails", { p_limit: 25 });
  if (error) return json({ error: error.message }, 500);
  const notices = (claimed ?? []) as Claimed[];
  if (notices.length === 0) return json({ sent: 0 });

  const { data: providers } = await admin
    .from("providers")
    .select("id, email, business_name")
    .in("id", [...new Set(notices.map((n) => n.provider_id))]);
  const byId = new Map((providers ?? []).map((p) => [p.id as string, p]));

  let sent = 0;
  for (const notice of notices) {
    const mark = (email_status: string, email_detail: string | null) =>
      admin.from("provider_notices").update({ email_status, email_detail }).eq("id", notice.id);
    const provider = byId.get(notice.provider_id);
    const to = (provider?.email as string | null)?.trim();
    if (!to) {
      await mark("failed", "No email address on the business.");
      continue;
    }
    const colour = notice.tone === "good" ? "#1e6b36" : notice.tone === "bad" ? "#8a1f11" : "#0b2545";
    const link = `${APP_URL}/pro/dashboard`;
    const html = `<!doctype html><html><body style="font:16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b2430;background:#f6f8fb;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;border:1px solid #e5e9f0">
    <div style="font-weight:800;font-size:20px;color:#0d2c54;margin-bottom:16px">FixIt <span style="font-weight:500;font-size:13px;color:#6b7785">LOCAL SERVICES</span></div>
    <p style="margin:0 0 8px;font-size:19px;font-weight:800;color:${colour}">${esc(notice.title)}</p>
    <p style="margin:0">${esc(notice.body)}</p>
    <p style="margin:22px 0 0"><a href="${link}" style="display:inline-block;background:#f7941d;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Open my dashboard</a></p>
    <p style="margin:20px 0 0;font-size:13px;color:#6b7785">About ${esc(String(provider?.business_name ?? "your business"))}.</p>
  </div></body></html>`;
    let problem = "";
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "idempotency-key": `notice-${notice.id}`,
        },
        body: JSON.stringify({
          from,
          to: [to],
          ...(replyTo ? { reply_to: replyTo } : {}),
          subject: `${notice.title} - FixIt`,
          text: `${notice.title}\n\n${notice.body}\n\nOpen your dashboard: ${link}`,
          html,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) problem = `The email provider answered ${response.status}.`;
    } catch {
      problem = "Could not reach the email provider.";
    }
    if (!problem) {
      await mark("sent", null);
      sent += 1;
    } else {
      await mark(notice.email_attempts >= MAX_ATTEMPTS ? "failed" : "pending", problem);
    }
  }
  return json({ claimed: notices.length, sent });
});
