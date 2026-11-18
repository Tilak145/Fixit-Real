"use client";

import { composeDescription, hasAnswers, parseDescription, type JobAnswers } from "@/lib/job-questions";

/**
 * What the customer told us about the job, shown inside the quote form once the
 * questions popup has closed, with a way back into it. With no answers yet it
 * invites them to answer the quick questions.
 */
export function JobSummary({
  categorySlug,
  serviceName,
  answers,
  onOpen,
}: {
  categorySlug: string;
  serviceName: string;
  answers: JobAnswers;
  onOpen: () => void;
}) {
  if (!hasAnswers(categorySlug, answers)) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3.5"
        data-testid="job-summary-empty"
      >
        <p className="text-[13px] text-foreground/80">
          <strong className="font-semibold text-foreground">Tell the pros more about your {serviceName.toLowerCase()} job.</strong>{" "}
          A few quick taps gets you more accurate prices.
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-md border border-primary px-4 py-2 text-[13px] font-bold text-primary hover:bg-primary/5"
        >
          Answer a few questions
        </button>
      </div>
    );
  }
  const { details } = parseDescription(composeDescription(categorySlug, answers, ""));
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3.5" data-testid="job-summary">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="text-[12px] font-bold uppercase tracking-wide text-foreground/60">Your {serviceName.toLowerCase()} job</p>
        <button type="button" onClick={onOpen} className="text-[13px] font-bold text-primary hover:underline">
          Change
        </button>
      </div>
      <ul className="grid gap-0.5 text-[13.5px] text-foreground/85">
        {details.map((detail) => (
          <li key={detail.label}>
            <strong className="font-semibold text-foreground">{detail.label}:</strong> {detail.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
