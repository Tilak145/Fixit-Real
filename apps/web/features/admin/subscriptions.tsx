"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import {
  formatCents,
  listFraudReviews,
  listJobReportsForReview,
  listSubscriptionOverview,
  upsertFraudReview,
  verifyJobReport,
} from "@/lib/commission";
import { StatusPill } from "./ui";

type Tab = "subscriptions" | "jobs" | "fraud";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "subscriptions", label: "Subscriptions" },
  { key: "jobs", label: "Job verification" },
  { key: "fraud", label: "Fraud review" },
];

/** Confirm the job value a contractor reported. */
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
        description="When a contractor reports a completed job, it appears here for verification."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {rows.map((report) => (
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
            <div className="grid gap-3 text-[13px] sm:grid-cols-3">
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
            </div>
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

type FraudSubject = "provider" | "job_report";

function Fraud() {
  const queryClient = useQueryClient();
  const reviews = useQuery({ queryKey: ["admin-fraud"], queryFn: listFraudReviews });
  const [form, setForm] = useState({ subjectType: "provider", subjectId: "", reason: "" });

  const save = useMutation({
    mutationFn: (input: { subjectType: FraudSubject; subjectId: string; reason: string; status: "open" | "cleared" | "confirmed"; note?: string }) =>
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
                subjectType: form.subjectType as FraudSubject,
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
                  onClick={() => save.mutate({ ...r, subjectType: r.subject_type as FraudSubject, subjectId: r.subject_id, status: "cleared", note: r.note ?? undefined })}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => save.mutate({ ...r, subjectType: r.subject_type as FraudSubject, subjectId: r.subject_id, status: "confirmed", note: r.note ?? undefined })}
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

/** The owner's view of subscriptions, with job verification and fraud review. */
export function AdminSubscriptions() {
  const [tab, setTab] = useState<Tab>("subscriptions");
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
      {tab === "subscriptions" && <Subscriptions />}
      {tab === "jobs" && <JobVerification />}
      {tab === "fraud" && <Fraud />}
    </div>
  );
}
