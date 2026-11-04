"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BadgeCheck, Receipt, ShieldAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import {
  formatCents,
  formatRate,
  getCommissionSettings,
  listCommissionsForAdmin,
  listDisputesForAdmin,
  listFraudReviews,
  listJobReportsForReview,
  listSubscriptionOverview,
  resolveDispute,
  settleCommission,
  updateCommissionSettings,
  upsertFraudReview,
  verifyJobReport,
} from "@/lib/commission";
import { StatusPill } from "./ui";

type Tab = "settings" | "jobs" | "commissions" | "disputes" | "subscriptions" | "fraud";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "settings", label: "Terms" },
  { key: "jobs", label: "Job verification" },
  { key: "commissions", label: "Commissions" },
  { key: "disputes", label: "Disputes" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "fraud", label: "Fraud review" },
];

const PLAN_ORDER = ["default", "founding", "starter", "professional", "business"];

/**
 * The commission terms: rate, cap and the included allowance per plan. These
 * are the numbers a contractor is shown before they choose a plan, so changing
 * one changes what new leads are charged - leads already counted keep the terms
 * they were counted under, which is why the ledger stores its own copy.
 */
function Terms() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["admin-commission-settings"], queryFn: getCommissionSettings });
  const [drafts, setDrafts] = useState<Record<string, { rate: string; cap: string; leads: string }>>({});

  const save = useMutation({
    mutationFn: (input: { planKey: string; rateBps: number; capCents: number | null; includedLeads: number }) =>
      updateCommissionSettings(input),
    onSuccess: async () => {
      toast.success("Commission terms saved. They apply to leads counted from now on.");
      await queryClient.invalidateQueries({ queryKey: ["admin-commission-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["commission-settings"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save the terms."),
  });

  if (settings.isPending) return <LoadingState title="Loading commission terms…" />;
  if (settings.isError) {
    return <ErrorState title="Could not load the terms" description={(settings.error as Error).message} />;
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        A commission is charged on a completed job&apos;s subtotal after refunds — never including sales tax. Leads
        within the included allowance are commission-free. Terms are locked onto each lead when it is counted, so
        changing them here never rewrites a contractor&apos;s past.
      </p>
      {(settings.data ?? [])
        .slice()
        .sort((a, b) => PLAN_ORDER.indexOf(a.plan_key) - PLAN_ORDER.indexOf(b.plan_key))
        .map((row) => {
          const draft = drafts[row.plan_key] ?? {
            rate: String(row.commission_rate_bps / 100),
            cap: row.commission_cap_cents === null ? "" : String(row.commission_cap_cents / 100),
            leads: String(row.included_leads),
          };
          return (
            <Card key={row.plan_key}>
              <CardContent className="gap-4 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="font-display text-[15px] capitalize">
                    {row.plan_key === "default" ? "Default (any other plan)" : row.plan_key}
                  </strong>
                  <span className="text-[12.5px] text-muted-foreground">
                    Currently {formatRate(row.commission_rate_bps)}
                    {row.commission_cap_cents != null ? ` · cap ${formatCents(row.commission_cap_cents)}` : " · no cap"} ·{" "}
                    {row.included_leads} included
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-foreground/70">Rate (%)</span>
                    <Input
                      inputMode="decimal"
                      value={draft.rate}
                      onChange={(event) =>
                        setDrafts((d) => ({ ...d, [row.plan_key]: { ...draft, rate: event.target.value } }))
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-foreground/70">Cap per job ($)</span>
                    <Input
                      inputMode="decimal"
                      placeholder="No cap"
                      value={draft.cap}
                      onChange={(event) =>
                        setDrafts((d) => ({ ...d, [row.plan_key]: { ...draft, cap: event.target.value } }))
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-foreground/70">Included leads / month</span>
                    <Input
                      inputMode="numeric"
                      value={draft.leads}
                      onChange={(event) =>
                        setDrafts((d) => ({ ...d, [row.plan_key]: { ...draft, leads: event.target.value } }))
                      }
                    />
                  </label>
                  <div className="flex items-end">
                    <Button
                      disabled={save.isPending}
                      onClick={() =>
                        save.mutate({
                          planKey: row.plan_key,
                          rateBps: Math.round(Number(draft.rate || "0") * 100),
                          capCents: draft.cap.trim() === "" ? null : Math.round(Number(draft.cap) * 100),
                          includedLeads: Math.max(0, Math.round(Number(draft.leads || "0"))),
                        })
                      }
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}

/** Verify what a contractor reported, which is what turns it into a charge. */
function JobVerification() {
  const queryClient = useQueryClient();
  const reports = useQuery({ queryKey: ["admin-job-reports"], queryFn: listJobReportsForReview });
  const [notes, setNotes] = useState<Record<string, string>>({});

  const verify = useMutation({
    mutationFn: (input: { reportId: string; status: "verified" | "disputed" | "rejected"; note?: string }) =>
      verifyJobReport(input),
    onSuccess: async () => {
      toast.success("Decision saved.");
      await queryClient.invalidateQueries({ queryKey: ["admin-job-reports"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-commissions"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save the decision."),
  });

  if (reports.isPending) return <LoadingState title="Loading job reports…" />;
  if (reports.isError) return <ErrorState title="Could not load job reports" description={(reports.error as Error).message} />;
  const rows = (reports.data ?? []).filter((r) => r.outcome === "completed");
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No completed jobs reported"
        description="When a contractor reports a completed job, it appears here for verification before any commission is charged."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {rows.map((report) => {
        const base = Math.max(report.job_subtotal_cents - report.refunded_cents, 0);
        return (
          <Card key={report.id}>
            <CardContent className="gap-3 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <strong className="block font-display text-[15px]">{report.business_name ?? "Unknown pro"}</strong>
                  <span className="block text-[12.5px] text-muted-foreground">
                    Completed {report.completed_on ?? "—"} · reported {new Date(report.reported_at).toLocaleDateString()}
                  </span>
                </div>
                <StatusPill value={report.verification_status} />
              </div>
              <div className="grid gap-3 text-[13px] sm:grid-cols-4">
                <div>
                  <span className="block text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatCents(report.job_subtotal_cents)}</span>
                </div>
                <div>
                  <span className="block text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">Sales tax</span>
                  <span className="tabular-nums">{formatCents(report.sales_tax_cents)}</span>
                </div>
                <div>
                  <span className="block text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">Refunded</span>
                  <span className="tabular-nums">{formatCents(report.refunded_cents)}</span>
                </div>
                <div>
                  <span className="block text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">Commission base</span>
                  <span className="tabular-nums font-semibold">{formatCents(base)}</span>
                </div>
              </div>
              {report.commission_amount_cents != null ? (
                <p className="rounded-md bg-[#E9F1FB] px-3 py-2 text-[12.5px]">
                  Commission: <strong className="tabular-nums">{formatCents(report.commission_amount_cents)}</strong>{" "}
                  <StatusPill value={report.commission_status ?? "pending"} className="ml-1" />
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                <Input
                  placeholder="Note (optional)"
                  value={notes[report.id] ?? ""}
                  onChange={(event) => setNotes((n) => ({ ...n, [report.id]: event.target.value }))}
                />
                <Button
                  size="sm"
                  disabled={verify.isPending}
                  onClick={() => verify.mutate({ reportId: report.id, status: "verified", note: notes[report.id] })}
                >
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Verify
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={verify.isPending}
                  onClick={() => verify.mutate({ reportId: report.id, status: "disputed", note: notes[report.id] })}
                >
                  Dispute
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={verify.isPending}
                  onClick={() => verify.mutate({ reportId: report.id, status: "rejected", note: notes[report.id] })}
                >
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Settling commissions. Marking one paid records the provider's reference; it
 * never invents a payment, because the platform cannot charge an arbitrary
 * amount and a false "paid" is worse than an honest "payable".
 */
function Commissions() {
  const queryClient = useQueryClient();
  const commissions = useQuery({ queryKey: ["admin-commissions"], queryFn: listCommissionsForAdmin });
  const [references, setReferences] = useState<Record<string, string>>({});

  const settle = useMutation({
    mutationFn: (input: { commissionId: string; status: "payable" | "paid" | "waived" | "void"; paymentReference?: string }) =>
      settleCommission(input),
    onSuccess: async () => {
      toast.success("Commission updated.");
      await queryClient.invalidateQueries({ queryKey: ["admin-commissions"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update the commission."),
  });

  if (commissions.isPending) return <LoadingState title="Loading commissions…" />;
  if (commissions.isError) {
    return <ErrorState title="Could not load commissions" description={(commissions.error as Error).message} />;
  }
  const rows = commissions.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No commissions yet"
        description="A commission appears once a completed job is verified."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {rows.map((c) => (
        <Card key={c.id}>
          <CardContent className="gap-3 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <strong className="block font-display text-[15px] tabular-nums">{formatCents(c.amount_cents)}</strong>
                <span className="block text-[12.5px] text-muted-foreground">
                  {c.business_name ?? "Unknown pro"} · {formatRate(c.rate_bps)} of {formatCents(c.base_cents)}
                  {c.cap_applied ? " · capped" : ""}
                </span>
              </div>
              <StatusPill value={c.status} />
            </div>
            {c.dispute_status ? (
              <p className="rounded-md bg-[#FFF3E0] px-3 py-2 text-[12.5px] text-[#B35C00]">
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                Dispute {c.dispute_status}
              </p>
            ) : null}
            {c.status === "paid" ? (
              <p className="text-[12.5px] text-muted-foreground">
                Paid {c.paid_at ? new Date(c.paid_at).toLocaleDateString() : ""} · ref {c.payment_reference}
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                <Input
                  placeholder="Payment reference (required to mark paid)"
                  value={references[c.id] ?? ""}
                  onChange={(event) => setReferences((r) => ({ ...r, [c.id]: event.target.value }))}
                />
                <Button
                  size="sm"
                  disabled={settle.isPending}
                  onClick={() => settle.mutate({ commissionId: c.id, status: "payable" })}
                >
                  <Receipt className="h-4 w-4" aria-hidden="true" /> Payable
                </Button>
                <Button
                  size="sm"
                  disabled={settle.isPending || !(references[c.id] ?? "").trim()}
                  onClick={() =>
                    settle.mutate({ commissionId: c.id, status: "paid", paymentReference: references[c.id] })
                  }
                >
                  Mark paid
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={settle.isPending}
                  onClick={() => settle.mutate({ commissionId: c.id, status: "waived" })}
                >
                  <Undo2 className="h-4 w-4" aria-hidden="true" /> Waive
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Disputes() {
  const queryClient = useQueryClient();
  const disputes = useQuery({ queryKey: ["admin-disputes"], queryFn: listDisputesForAdmin });
  const [notes, setNotes] = useState<Record<string, string>>({});

  const resolve = useMutation({
    mutationFn: (input: { disputeId: string; status: "resolved" | "rejected"; note: string }) => resolveDispute(input),
    onSuccess: async () => {
      toast.success("Dispute updated.");
      await queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-commissions"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update the dispute."),
  });

  if (disputes.isPending) return <LoadingState title="Loading disputes…" />;
  if (disputes.isError) return <ErrorState title="Could not load disputes" description={(disputes.error as Error).message} />;
  const rows = disputes.data ?? [];
  if (rows.length === 0) {
    return <EmptyState title="No disputes" description="A contractor disputing a charge appears here." />;
  }

  return (
    <div className="grid gap-4">
      {rows.map((d) => (
        <Card key={d.id}>
          <CardContent className="gap-3 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <strong className="block font-display text-[15px]">{d.business_name ?? "Unknown pro"}</strong>
                <span className="block text-[12.5px] text-muted-foreground">
                  {d.commission_amount_cents != null ? `Commission ${formatCents(d.commission_amount_cents)} · ` : ""}
                  {new Date(d.created_at).toLocaleDateString()}
                </span>
              </div>
              <StatusPill value={d.status} />
            </div>
            <p className="rounded-md bg-muted/60 px-3 py-2 text-[13px]">{d.reason}</p>
            {d.status === "open" ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <Input
                  placeholder="Resolution note"
                  value={notes[d.id] ?? ""}
                  onChange={(event) => setNotes((n) => ({ ...n, [d.id]: event.target.value }))}
                />
                <Button
                  size="sm"
                  disabled={resolve.isPending || !(notes[d.id] ?? "").trim()}
                  onClick={() => resolve.mutate({ disputeId: d.id, status: "resolved", note: notes[d.id] })}
                >
                  Resolve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resolve.isPending || !(notes[d.id] ?? "").trim()}
                  onClick={() => resolve.mutate({ disputeId: d.id, status: "rejected", note: notes[d.id] })}
                >
                  Reject
                </Button>
              </div>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">{d.resolution_note}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Subscriptions() {
  const subs = useQuery({ queryKey: ["admin-subscriptions"], queryFn: listSubscriptionOverview });
  if (subs.isPending) return <LoadingState title="Loading subscriptions…" />;
  if (subs.isError) return <ErrorState title="Could not load subscriptions" description={(subs.error as Error).message} />;
  const rows = subs.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No subscriptions on record"
        description="A contractor's plan appears here once Stripe confirms the subscription. Plans are changed and cancelled in the Stripe customer portal."
      />
    );
  }
  return (
    <div className="grid gap-4">
      {rows.map((s) => (
        <Card key={s.id}>
          <CardContent className="gap-3 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <strong className="block font-display text-[15px]">{s.email ?? s.user_id}</strong>
                <span className="block text-[12.5px] text-muted-foreground">
                  {s.plan_key ?? "unknown plan"} · {s.stripe_subscription_id ?? "no Stripe id"}
                </span>
              </div>
              <StatusPill value={s.status} />
            </div>
            <p className="text-[12.5px] text-muted-foreground">
              {s.cancel_at_period_end ? "Cancels at period end · " : ""}
              {s.current_period_end ? `Renews/ends ${new Date(s.current_period_end).toLocaleDateString()}` : ""}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Fraud() {
  const queryClient = useQueryClient();
  const reviews = useQuery({ queryKey: ["admin-fraud"], queryFn: listFraudReviews });
  const [form, setForm] = useState({ subjectType: "provider", subjectId: "", reason: "" });

  const save = useMutation({
    mutationFn: (input: { subjectType: "provider" | "job_report" | "commission"; subjectId: string; reason: string; status: "open" | "cleared" | "confirmed"; note?: string }) =>
      upsertFraudReview(input),
    onSuccess: async () => {
      toast.success("Fraud review saved.");
      await queryClient.invalidateQueries({ queryKey: ["admin-fraud"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save the review."),
  });

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="gap-3 pt-6">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[#B35C00]" aria-hidden="true" />
            <strong className="font-display text-[15px]">Flag something for review</strong>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <Label htmlFor="fraud-type" className="mb-1 block text-xs font-bold text-foreground/70">Subject</Label>
              <select
                id="fraud-type"
                className="h-[40px] w-full rounded-md border border-input bg-input px-3 text-sm"
                value={form.subjectType}
                onChange={(event) => setForm((f) => ({ ...f, subjectType: event.target.value }))}
              >
                <option value="provider">Professional</option>
                <option value="job_report">Job report</option>
                <option value="commission">Commission</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <Label htmlFor="fraud-id" className="mb-1 block text-xs font-bold text-foreground/70">Record ID</Label>
              <Input
                id="fraud-id"
                placeholder="Paste the row id"
                value={form.subjectId}
                onChange={(event) => setForm((f) => ({ ...f, subjectId: event.target.value }))}
              />
            </label>
            <label className="block sm:col-span-3">
              <Label htmlFor="fraud-reason" className="mb-1 block text-xs font-bold text-foreground/70">Reason</Label>
              <Input
                id="fraud-reason"
                placeholder="What looks wrong?"
                value={form.reason}
                onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))}
              />
            </label>
          </div>
          <Button
            disabled={save.isPending || !form.subjectId.trim() || form.reason.trim().length < 5}
            onClick={() =>
              save.mutate({
                subjectType: form.subjectType as "provider" | "job_report" | "commission",
                subjectId: form.subjectId.trim(),
                reason: form.reason.trim(),
                status: "open",
              })
            }
          >
            Open review
          </Button>
        </CardContent>
      </Card>

      {reviews.isPending ? (
        <LoadingState title="Loading fraud reviews…" />
      ) : (reviews.data ?? []).length === 0 ? (
        <EmptyState title="Nothing under review" description="Flagged records appear here." />
      ) : (
        (reviews.data ?? []).map((r) => (
          <Card key={r.id}>
            <CardContent className="gap-3 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <strong className="block font-display text-[15px] capitalize">{r.subject_type.replace("_", " ")}</strong>
                  <span className="block break-all text-[12px] text-muted-foreground">{r.subject_id}</span>
                </div>
                <StatusPill value={r.status} />
              </div>
              <p className="rounded-md bg-muted/60 px-3 py-2 text-[13px]">{r.reason}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => save.mutate({ ...r, subjectType: r.subject_type as "provider" | "job_report" | "commission", subjectId: r.subject_id, status: "cleared", note: r.note ?? undefined })}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => save.mutate({ ...r, subjectType: r.subject_type as "provider" | "job_report" | "commission", subjectId: r.subject_id, status: "confirmed", note: r.note ?? undefined })}
                >
                  Confirm
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

/** The management view of commission terms, charges, disputes and fraud. */
export function AdminCommissions() {
  const [tab, setTab] = useState<Tab>("settings");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-4 py-2 text-[13px] font-bold ${
              tab === t.key ? "border-primary bg-primary text-white" : "border-border text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "settings" && <Terms />}
      {tab === "jobs" && <JobVerification />}
      {tab === "commissions" && <Commissions />}
      {tab === "disputes" && <Disputes />}
      {tab === "subscriptions" && <Subscriptions />}
      {tab === "fraud" && <Fraud />}
    </div>
  );
}
