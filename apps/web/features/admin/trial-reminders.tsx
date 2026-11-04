"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Crown, Mail, Plug, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { requireSupabase } from "@/lib/supabase";

interface Reminder {
  provider_id: string;
  business_name: string | null;
  email: string | null;
  plan: string;
  price_per_month: number;
  trial_ends_at: string;
  days_left: number;
  reminder_id: string | null;
  reminder_status: string;
  message: string | null;
}

interface MailStatus {
  ready: boolean;
  provider: string | null;
  from_address: string | null;
  has_key: boolean;
  updated_at: string | null;
}

interface SendResult {
  mailReady: boolean;
  due: number;
  sent: number;
  message?: string;
}

async function listTrialReminders(): Promise<Reminder[]> {
  const { data, error } = await requireSupabase().rpc("trial_reminders");
  if (error) throw new Error(error.message);
  return (data ?? []) as Reminder[];
}

async function getMailStatus(): Promise<MailStatus | null> {
  const { data, error } = await requireSupabase().rpc("mail_status");
  if (error) throw new Error(error.message);
  return ((data ?? []) as MailStatus[])[0] ?? null;
}

async function saveMailSettings(input: { apiKey: string; from: string; replyTo: string }) {
  const { error } = await requireSupabase().rpc("set_mail_settings", {
    p_api_key: input.apiKey || null,
    p_from_address: input.from,
    p_reply_to: input.replyTo || null,
  });
  if (error) throw new Error(error.message);
}

/** Runs the sender: it records what is due, and emails whatever the provider accepts. */
async function sendReminders(): Promise<SendResult> {
  const supabase = requireSupabase();
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("Sign in again to send reminders.");
  const { data, error } = await supabase.functions.invoke("trial-reminders", {
    headers: { Authorization: `Bearer ${token}` },
    body: {},
  });
  if (error) {
    const response = (error as { context?: Response }).context;
    const detail = await response?.json?.().catch(() => null) as { error?: string } | null;
    throw new Error(detail?.error ?? error.message);
  }
  return data as SendResult;
}

async function recordReminder(id: string) {
  const { error } = await requireSupabase().rpc("mark_trial_reminder_sent", { p_id: id });
  if (error) throw new Error(error.message);
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

/**
 * Trial reminders. Nobody is charged when a Founding Pro free period ends, so
 * the pro has to be told before the date. This lists every free period with 14
 * days or fewer left, the message they get, and whether it has gone. The sender
 * runs here (and on a schedule once an email account is connected); without one,
 * the message can be copied or emailed by hand and recorded as done.
 */
export function AdminTrialReminders() {
  const queryClient = useQueryClient();
  const [connectOpen, setConnectOpen] = useState(false);
  const [form, setForm] = useState({ apiKey: "", from: "", replyTo: "" });

  const reminders = useQuery({ queryKey: ["admin-trial-reminders"], queryFn: listTrialReminders });
  const mail = useQuery({ queryKey: ["admin-mail-status"], queryFn: getMailStatus });

  const markSent = useMutation({
    mutationFn: recordReminder,
    onSuccess: async () => {
      toast.success("Recorded as contacted.");
      await queryClient.invalidateQueries({ queryKey: ["admin-trial-reminders"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not record that."),
  });

  const send = useMutation({
    mutationFn: sendReminders,
    onSuccess: async (result) => {
      if (!result.mailReady) toast.message(result.message ?? "No email account is connected yet.");
      else toast.success(result.due === 0 ? "Nothing is due today." : `Emailed ${result.sent} of ${result.due} reminders.`);
      await queryClient.invalidateQueries({ queryKey: ["admin-trial-reminders"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "The sender could not run."),
  });

  const connect = useMutation({
    mutationFn: saveMailSettings,
    onSuccess: async () => {
      toast.success("Email settings saved.");
      setConnectOpen(false);
      setForm({ apiKey: "", from: "", replyTo: "" });
      await queryClient.invalidateQueries({ queryKey: ["admin-mail-status"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save those settings."),
  });

  if (reminders.isPending) return <LoadingState title="Loading free periods…" />;
  if (reminders.isError) {
    return <ErrorState title="Could not load free periods" description={reminders.error instanceof Error ? reminders.error.message : "Try again."} />;
  }

  const rows = reminders.data ?? [];
  const ending = rows.filter((row) => row.days_left <= 14);
  const later = rows.filter((row) => row.days_left > 14);
  const status = mail.data ?? null;
  const ready = Boolean(status?.ready);

  async function copy(row: Reminder) {
    if (!row.message) return;
    try {
      await navigator.clipboard.writeText(row.message);
      toast.success("Message copied.");
    } catch {
      toast.error("The browser blocked copying — select the text and copy it by hand.");
    }
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="max-w-[660px]">
            <h3 className="font-display text-lg font-semibold">Automatic email</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {ready
                ? `Connected as ${status?.from_address ?? "your email provider"}. The sender records each free period when it comes due, emails it once, and never emails the same pro twice.`
                : "No email account is connected yet, so nothing is sent. Connect one and the sender can email reminders for you; until then, copy the message below or email it by hand, then record it."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setConnectOpen(true)}>
              <Plug className="h-3.5 w-3.5" aria-hidden="true" /> {ready ? "Change email account" : "Connect email"}
            </Button>
            <Button size="sm" onClick={() => send.mutate()} disabled={send.isPending}>
              <Send className="h-3.5 w-3.5" aria-hidden="true" /> {send.isPending ? "Sending…" : "Run sender now"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-display text-lg font-semibold">Ending in the next 14 days</h3>
          <p className="mb-4 mt-1 text-[13px] text-muted-foreground">
            Nothing is charged automatically at the end of a free period. Contact each pro before the date, then record it here.
          </p>
          {ending.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">No free periods end in the next two weeks.</p>
          ) : (
            <ul className="grid gap-3">
              {ending.map((row) => (
                <ReminderRow key={row.provider_id} row={row} onCopy={copy} onMarkSent={(id) => markSent.mutate(id)} busy={markSent.isPending} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-display text-lg font-semibold">Still in their free period</h3>
          <p className="mb-4 mt-1 text-[13px] text-muted-foreground">
            These pros are not due a reminder yet. It appears automatically as the date comes closer.
          </p>
          {later.length === 0 ? (
            <EmptyState title="No other free periods" description="New Founding Pro places will show here." />
          ) : (
            <ul className="grid gap-2">
              {later.map((row) => (
                <li key={row.provider_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border px-4 py-3 text-[13.5px]">
                  <span className="font-semibold">{row.business_name?.trim() || "Unnamed business"}</span>
                  <span className="text-muted-foreground">{row.email ?? "No email"}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    ends {day(row.trial_ends_at)} · {row.days_left} days
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Connect an email account</DialogTitle>
            <DialogDescription>
              FixIt sends with Resend, a free plan is enough to start. Create an account, copy its API key, and give the verified
              sending address here. The key is stored where only the server can read it and is never shown on any screen again.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!form.from.includes("@")) {
                toast.error("Give the sending address your provider verified.");
                return;
              }
              connect.mutate(form);
            }}
          >
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-bold text-foreground/70">API key</span>
              <Input
                type="password"
                autoComplete="off"
                value={form.apiKey}
                onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
                placeholder={status?.has_key ? "Saved — leave blank to keep it" : "re_…"}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-bold text-foreground/70">Sending address</span>
              <Input
                type="text"
                value={form.from}
                onChange={(event) => setForm({ ...form, from: event.target.value })}
                placeholder="FixIt <hello@yourdomain.com>"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-bold text-foreground/70">Reply-to (optional)</span>
              <Input
                type="email"
                value={form.replyTo}
                onChange={(event) => setForm({ ...form, replyTo: event.target.value })}
                placeholder="support@yourdomain.com"
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConnectOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={connect.isPending}>{connect.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReminderRow({
  row,
  onCopy,
  onMarkSent,
  busy,
}: {
  row: Reminder;
  onCopy: (row: Reminder) => void;
  onMarkSent: (id: string) => void;
  busy: boolean;
}) {
  const handled = row.reminder_status === "sent";
  return (
    <li className="rounded-xl border border-[#F0DCB6] bg-[#FFF7EC] p-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Crown className="h-4 w-4 text-[#B26A00]" aria-hidden="true" />
        <span className="font-display text-[15px] font-semibold">{row.business_name?.trim() || "Unnamed business"}</span>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-bold text-[#7A4A00]">
          {row.days_left === 1 ? "1 day left" : `${row.days_left} days left`}
        </span>
        {handled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F4EA] px-2.5 py-0.5 text-[12px] font-bold text-[#2E9E4F]">
            <Check className="h-3 w-3" aria-hidden="true" /> Reminder sent
          </span>
        ) : null}
        <span className="ml-auto text-[12.5px] tabular-nums text-[#7A4A00]/80">ends {day(row.trial_ends_at)}</span>
      </div>
      <p className="mb-1 text-[12.5px] text-[#7A4A00]/80">
        Moves to {row.plan.charAt(0).toUpperCase() + row.plan.slice(1)} at ${row.price_per_month} a month · {row.email ?? "no email on file"}
      </p>
      <p className="rounded-lg bg-white/70 p-3 text-[13.5px] leading-relaxed text-foreground/85">{row.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onCopy(row)}>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy message
        </Button>
        {row.email ? (
          <Button size="sm" variant="outline" asChild>
            <a href={`mailto:${row.email}?subject=${encodeURIComponent("Your FixIt free period ends soon")}&body=${encodeURIComponent(row.message ?? "")}`}>
              <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Email it
            </a>
          </Button>
        ) : null}
        {!handled && row.reminder_id ? (
          <Button size="sm" disabled={busy} onClick={() => onMarkSent(row.reminder_id as string)}>
            Record as contacted
          </Button>
        ) : null}
      </div>
    </li>
  );
}
