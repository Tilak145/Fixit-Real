"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  commissionCents,
  createDispute,
  formatCents,
  formatRate,
  getCommissionSettings,
  listMyCommissions,
  listMyLeadUsage,
  listMyLeads,
  saveJobReport,
  type CommissionSettings,
  type JobOutcome,
  type MyCommission,
  type MyLeadRow,
} from "@/lib/commission";

/** A titled card, matching the rest of the dashboard. */
function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <strong className="block font-display text-[15px]">{title}</strong>
        {action}
      </div>
      {children}
    </div>
  );
}

const OUTCOMES: Array<{ value: JobOutcome; label: string }> = [
  { value: "completed", label: "Completed" },
  { value: "not_completed", label: "Did not complete" },
  { value: "cancelled", label: "Cancelled" },
];

const OUTCOME_LABEL: Record<JobOutcome, string> = {
  completed: "Completed",
  not_completed: "Not completed",
  cancelled: "Cancelled",
};

const VERIFICATION_LABEL: Record<string, string> = {
  pending: "Awaiting review",
  verified: "Verified",
  disputed: "In dispute",
  rejected: "Rejected",
};

const COMMISSION_LABEL: Record<string, string> = {
  pending: "Pending verification",
  payable: "Payable",
  paid: "Paid",
  waived: "Waived",
  void: "Void",
};

function dollarsToCents(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
}

/**
 * Reporting a completed job and seeing what it costs.
 *
 * The contractor enters the figures once; the database records them as an
 * unverified claim, and management verifies before anything is charged. Editing
 * the figures sends it back for review, so a charge never rests on an unread
 * edit.
 */
function JobReportForm({ lead, providerId, onDone }: { lead: MyLeadRow; providerId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["commission-settings"], queryFn: getCommissionSettings });
  const [outcome, setOutcome] = useState<JobOutcome>("completed");
  const [subtotal, setSubtotal] = useState("");
  const [tax, setTax] = useState("");
  const [refunded, setRefunded] = useState("");
  const [completedOn, setCompletedOn] = useState("");

  const settingsForPlan: CommissionSettings | undefined = useMemo(() => {
    const all = settings.data ?? [];
    return all.find((s) => s.plan_key === lead.plan_key) ?? all.find((s) => s.plan_key === "default");
  }, [settings.data, lead.plan_key]);

  // What the commission would be, shown before it is filed, so there is no
  // surprise. The authoritative figure is computed by the database on verify.
  const preview = useMemo(() => {
    if (!settingsForPlan) return null;
    return commissionCents(
      dollarsToCents(subtotal),
      dollarsToCents(refunded),
      settingsForPlan.commission_rate_bps,
      settingsForPlan.commission_cap_cents,
    );
  }, [settingsForPlan, subtotal, refunded]);

  const save = useMutation({
    mutationFn: () =>
      saveJobReport({
        leadLedgerId: lead.id,
        providerId,
        quoteRequestId: lead.quote_request_id,
        outcome,
        jobSubtotalCents: dollarsToCents(subtotal),
        salesTaxCents: dollarsToCents(tax),
        refundedCents: dollarsToCents(refunded),
        completedOn: completedOn || null,
      }),
    onSuccess: async () => {
      toast.success("Job reported. We will review it before any commission is charged.");
      await queryClient.invalidateQueries({ queryKey: ["my-leads"] });
      await queryClient.invalidateQueries({ queryKey: ["my-commissions"] });
      onDone();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save the report."),
  });

  return (
    <form
      className="mt-3 rounded-lg border border-border bg-muted/40 p-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-foreground/70">What happened?</span>
          <select
            className="h-[40px] w-full rounded-md border border-input bg-input px-3 text-sm"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value as JobOutcome)}
          >
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-foreground/70">Completion date</span>
          <input
            type="date"
            className="h-[40px] w-full rounded-md border border-input bg-input px-3 text-sm"
            value={completedOn}
            onChange={(event) => setCompletedOn(event.target.value)}
          />
        </label>
        {outcome === "completed" ? (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-foreground/70">Job subtotal (before tax)</span>
              <input
                inputMode="decimal"
                placeholder="1250.00"
                className="h-[40px] w-full rounded-md border border-input bg-input px-3 text-sm"
                value={subtotal}
                onChange={(event) => setSubtotal(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-foreground/70">Sales tax collected</span>
              <input
                inputMode="decimal"
                placeholder="0.00"
                className="h-[40px] w-full rounded-md border border-input bg-input px-3 text-sm"
                value={tax}
                onChange={(event) => setTax(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-foreground/70">Refunded to customer</span>
              <input
                inputMode="decimal"
                placeholder="0.00"
                className="h-[40px] w-full rounded-md border border-input bg-input px-3 text-sm"
                value={refunded}
                onChange={(event) => setRefunded(event.target.value)}
              />
            </label>
          </>
        ) : null}
      </div>

      {outcome === "completed" && preview ? (
        <p className="mt-3 rounded-md bg-[#E9F1FB] px-3 py-2 text-[12.5px] text-foreground/80">
          Commission on this job would be{" "}
          <strong className="tabular-nums">{formatCents(preview.amountCents)}</strong> ({formatRate(settingsForPlan!.commission_rate_bps)}{" "}
          of {formatCents(preview.baseCents)}
          {preview.capApplied ? `, capped at ${formatCents(settingsForPlan!.commission_cap_cents ?? 0)}` : ""}
          {dollarsToCents(tax) > 0 ? ". Sales tax is not included." : "."}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Submit report"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function LeadUsage({ plan }: { plan: string }) {
  const usage = useQuery({ queryKey: ["my-lead-usage"], queryFn: listMyLeadUsage });
  const settings = useQuery({ queryKey: ["commission-settings"], queryFn: getCommissionSettings });
  const mine = (settings.data ?? []).find((s) => s.plan_key === plan) ?? (settings.data ?? []).find((s) => s.plan_key === "default");
  const current = (usage.data ?? [])[0];
  const included = mine?.included_leads ?? 0;
  const used = current?.total ?? 0;
  const remaining = Math.max(included - used, 0);

  return (
    <Panel title="Your plan and allowance">
      <dl className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Leads used this month", value: String(used) },
          { label: "Included commission-free", value: String(included) },
          { label: "Leads remaining", value: String(remaining) },
          { label: "Commission rate", value: mine ? formatRate(mine.commission_rate_bps) : "—" },
        ].map((item) => (
          <div key={item.label}>
            <dt className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[12.5px] text-muted-foreground">
        Your plan includes {included} commission-free leads each calendar month
        {mine?.commission_cap_cents != null
          ? `. After that, completed jobs carry ${formatRate(mine.commission_rate_bps)} of the job subtotal, capped at ${formatCents(mine.commission_cap_cents)} per job.`
          : `. After that, completed jobs carry ${mine ? formatRate(mine.commission_rate_bps) : ""} of the job subtotal.`}{" "}
        Leads already counted this month stay counted if you change plan, renew or cancel.
      </p>
    </Panel>
  );
}

function Commissions({ providerId }: { providerId: string }) {
  const queryClient = useQueryClient();
  const commissions = useQuery({
    queryKey: ["my-commissions", providerId],
    queryFn: () => listMyCommissions(providerId),
  });
  const [disputing, setDisputing] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const dispute = useMutation({
    mutationFn: (commissionId: string) =>
      createDispute({ commissionId, providerId, reason: reason.trim() }),
    onSuccess: async () => {
      toast.success("Dispute filed. We will review it and reply here.");
      setDisputing(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["my-commissions"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not file the dispute."),
  });

  if (commissions.isPending) return <p className="text-sm text-muted-foreground">Loading commissions…</p>;
  if (commissions.isError) {
    return <p className="text-sm text-[#D93025]">{(commissions.error as Error).message}</p>;
  }
  const rows = commissions.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No commissions yet. Completed jobs beyond your included allowance will appear here.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {rows.map((c: MyCommission) => (
        <div key={c.id} className="flex flex-wrap items-center gap-3 py-3.5">
          <span className="min-w-[200px] flex-1">
            <strong className="block text-[14.5px] tabular-nums">{formatCents(c.amount_cents)}</strong>
            <span className="block text-[12px] text-muted-foreground">
              {formatRate(c.rate_bps)} of {formatCents(c.base_cents)}
              {c.cap_applied ? " · capped" : ""} · {new Date(c.created_at).toLocaleDateString()}
            </span>
          </span>
          <span
            className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${
              c.status === "paid"
                ? "bg-[#E6F4EA] text-[#2E9E4F]"
                : c.status === "void" || c.status === "waived"
                  ? "bg-muted text-muted-foreground"
                  : "bg-[#FDF3D7] text-[#B8860B]"
            }`}
          >
            {COMMISSION_LABEL[c.status] ?? c.status}
          </span>
          {c.status === "paid" && c.payment_reference ? (
            <span className="text-[12px] text-muted-foreground">Ref {c.payment_reference}</span>
          ) : null}
          {c.dispute_status ? (
            <span className="text-[12px] font-bold text-[#B35C00]">Dispute {c.dispute_status}</span>
          ) : c.status !== "paid" && c.status !== "void" ? (
            <button
              onClick={() => setDisputing(disputing === c.id ? null : c.id)}
              className="text-[12.5px] font-bold text-primary hover:underline"
            >
              Dispute
            </button>
          ) : null}
          {disputing === c.id ? (
            <div className="w-full">
              <textarea
                rows={3}
                className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm"
                placeholder="What is wrong with this charge?"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  disabled={dispute.isPending || reason.trim().length < 5}
                  onClick={() => dispute.mutate(c.id)}
                >
                  {dispute.isPending ? "Filing…" : "File dispute"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDisputing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * The contractor's commission section: what they have used, what they owe, and
 * the one place they report what happened on a job.
 */
export function CommissionSection({ plan, providerId }: { plan: string; providerId: string }) {
  const queryClient = useQueryClient();
  const leads = useQuery({ queryKey: ["my-leads"], queryFn: listMyLeads });
  const [reporting, setReporting] = useState<string | null>(null);
  const pending = useQuery({
    queryKey: ["my-commissions", providerId],
    queryFn: () => listMyCommissions(providerId),
  });

  const outstanding = (pending.data ?? [])
    .filter((c) => c.status === "pending" || c.status === "payable")
    .reduce((sum, c) => sum + c.amount_cents, 0);
  const paid = (pending.data ?? [])
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + c.amount_cents, 0);

  return (
    <>
      <LeadUsage plan={plan} />

      <Panel title="Commission summary">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
              Pending commissions
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{formatCents(outstanding)}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Charged only after we verify a completed job.
            </p>
          </div>
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
              Paid to date
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{formatCents(paid)}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Confirmed by our payment provider.
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="Your counted leads">
        {leads.isPending ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading leads…</p>
        ) : leads.isError ? (
          <p className="py-6 text-center text-sm text-[#D93025]">{(leads.error as Error).message}</p>
        ) : (leads.data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No leads counted yet. Accepting a lead adds it here, once.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {(leads.data ?? []).map((lead) => (
              <div key={lead.id} className="py-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-[180px] flex-1">
                    <strong className="block text-[14px]">
                      Lead counted {new Date(lead.counted_at).toLocaleDateString()}
                    </strong>
                    <span className="block text-[12px] text-muted-foreground">
                      {lead.plan_key} plan · {lead.allowance_period.slice(0, 7)}
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${
                      lead.allowance_status === "included"
                        ? "bg-[#E6F4EA] text-[#2E9E4F]"
                        : "bg-[#FFF3E0] text-[#B35C00]"
                    }`}
                  >
                    {lead.allowance_status === "included" ? "Included" : "Commissionable"}
                  </span>
                  {lead.outcome ? (
                    <span className="text-[12px] text-muted-foreground">
                      {OUTCOME_LABEL[lead.outcome]} · {VERIFICATION_LABEL[lead.verification_status ?? "pending"]}
                    </span>
                  ) : null}
                  {lead.outcome ? (
                    <button
                      onClick={() => setReporting(reporting === lead.id ? null : lead.id)}
                      className="text-[12.5px] font-bold text-primary hover:underline"
                    >
                      Update
                    </button>
                  ) : reporting === lead.id ? null : (
                    <button
                      onClick={() => setReporting(lead.id)}
                      className="rounded-md bg-primary px-3.5 py-2 text-[12.5px] font-bold text-white"
                    >
                      Report job
                    </button>
                  )}
                </div>
                {reporting === lead.id ? (
                  <JobReportForm
                    lead={lead}
                    providerId={providerId}
                    onDone={() => {
                      setReporting(null);
                      void queryClient.invalidateQueries({ queryKey: ["my-leads"] });
                    }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Payment history"
        action={
          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" aria-hidden="true" /> Verified and settled charges
          </span>
        }
      >
        <Commissions providerId={providerId} />
      </Panel>
    </>
  );
}


/**
 * The commission terms, shown wherever a contractor is asked to choose a plan.
 * These have to be visible before checkout, not buried in a policy page: a
 * commission is real money, and agreeing to it without seeing it is not a
 * choice anyone can make.
 */
export function CommissionTerms({ planKey, className }: { planKey?: string; className?: string }) {
  const settings = useQuery({
    queryKey: ["commission-settings"],
    queryFn: getCommissionSettings,
    staleTime: 5 * 60_000,
  });

  if (!settings.data || settings.data.length === 0) return null;
  const row =
    (planKey ? settings.data.find((s) => s.plan_key === planKey) : undefined) ??
    settings.data.find((s) => s.plan_key === "default") ??
    settings.data[0];
  const cap = row.commission_cap_cents;

  return (
    <div className={className}>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Commission:</strong> {formatRate(row.commission_rate_bps)} of a completed
        job&apos;s subtotal
        {cap != null ? `, never more than ${formatCents(cap)} per job` : ""}. Charged on the job subtotal after
        refunds — sales tax is never included, and cancelled or uncompleted jobs are never charged. Your plan includes{" "}
        {row.included_leads} commission-free leads each month; leads are counted once each and stay counted across plan
        changes and renewals.
      </p>
    </div>
  );
}
