"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { VerifiedCheck } from "@/components/fixit/pro-card";
import { formatCents } from "@/lib/commission";
import { DECLINE_REASON_MAX, DECLINE_REASON_MIN, respondToQuote, type JobQuote } from "@/lib/fixit";
import {
  comparisonRows,
  quoteGaps,
  quoteLines,
  validity,
} from "@/lib/quote-comparison";

const QUOTE_STATUS: Record<JobQuote["status"], string> = {
  sent: "Waiting for your answer",
  accepted: "You accepted this",
  declined: "Not chosen",
  withdrawn: "Withdrawn",
};

function statusPillClass(status: JobQuote["status"]): string {
  if (status === "accepted") return "bg-[#E6F4EA] text-[#2E9E4F]";
  if (status === "sent") return "bg-[#FFF4E5] text-[#B26A00]";
  return "bg-muted text-muted-foreground";
}

/** The parts of one price, shown as a small table rather than prose. */
function Breakdown({ quote }: { quote: JobQuote }) {
  const lines = quoteLines(quote);
  if (lines.length <= 1) return null;
  return (
    <dl className="mt-2 space-y-1">
      {lines.map((line) => (
        <div key={line.key} className="flex items-center justify-between text-[13px]">
          <dt className="text-muted-foreground">{line.label}</dt>
          <dd className="tabular-nums">{formatCents(line.cents)}</dd>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-border pt-1 text-[13px] font-bold">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatCents(quote.amount_cents)}</dd>
      </div>
    </dl>
  );
}

/** The terms a homeowner weighs, each said plainly. */
function Terms({ quote, now }: { quote: JobQuote; now: Date }) {
  const state = validity(quote, now);
  const rows: Array<{ label: string; value: string; warn?: boolean }> = [
    { label: "Can start", value: quote.earliest_start ?? "Not stated", warn: !quote.earliest_start },
    { label: "How long", value: quote.completion_note?.trim() || "Not stated", warn: !quote.completion_note },
    { label: "Warranty", value: quote.warranty?.trim() || "Not stated", warn: !quote.warranty },
    { label: "Payment", value: quote.payment_terms?.trim() || "Not stated", warn: !quote.payment_terms },
  ];
  if (state !== "none") {
    rows.push({
      label: "Price valid",
      value: quote.valid_until + (state === "expired" ? " · expired" : ""),
      warn: state === "expired",
    });
  }
  return (
    <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {row.label}
          </dt>
          <dd className={"text-[13px] " + (row.warn ? "text-[#B26A00]" : "text-foreground/90")}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Common reasons, offered as a start so declining stays one tap and a word. */
const DECLINE_REASONS = [
  "The price is too high",
  "I need it done sooner",
  "I chose another professional",
  "I no longer need the work",
];

/**
 * Why the customer is declining. A decline is not sent without a reason: the
 * professional reads it beside their quote, and it is what lets them come back
 * with a better price instead of guessing.
 */
function DeclineForm({
  quote,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  quote: JobQuote;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const ready = reason.trim().length >= DECLINE_REASON_MIN;
  const fieldId = "decline-reason-" + quote.id;
  return (
    <form
      className="mt-3 rounded-lg border border-border bg-background p-3.5"
      data-testid="decline-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !pending) onSubmit(reason.trim());
      }}
    >
      <label htmlFor={fieldId} className="block text-[13px] font-bold">
        Why are you declining {quote.provider_name ?? "this pro"}’s {formatCents(quote.amount_cents)} price?
      </label>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
        The professional will see your reason, and may send you a new price.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {DECLINE_REASONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setReason(option)}
            aria-pressed={reason === option}
            className={
              "rounded-full border px-3 py-1.5 text-[12.5px] font-semibold " +
              (reason === option
                ? "border-primary bg-primary text-white"
                : "border-border text-foreground/80 hover:bg-muted")
            }
          >
            {option}
          </button>
        ))}
      </div>
      <textarea
        id={fieldId}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={DECLINE_REASON_MAX}
        rows={2}
        required
        placeholder="Pick a reason above or write your own"
        className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]"
        data-testid="decline-reason"
      />
      {error ? (
        <p role="alert" className="mt-1 text-[12.5px] text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={!ready || pending} data-testid="confirm-decline">
          {pending ? "Saving…" : "Decline this price"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={pending}>
          Keep it
        </Button>
      </div>
    </form>
  );
}

/**
 * The prices on one request, side by side.
 *
 * One price is shown as a full card, because there is nothing to compare. Two
 * or more get a table first, so the differences are legible at a glance, with
 * each quote's own accept button underneath. Nothing here ranks or recommends:
 * the cheapest line and the best terms are not the same offer, and that choice
 * is the customer's.
 */
export function QuoteComparison({ quotes }: { quotes: JobQuote[] }) {
  const queryClient = useQueryClient();
  const now = useMemo(() => new Date(), []);
  // The quote the customer is in the middle of declining, if any.
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const respond = useMutation({
    mutationFn: (input: { quoteId: string; response: "accepted" | "declined"; reason?: string }) =>
      respondToQuote(input),
    onSuccess: async () => {
      setDecliningId(null);
      await queryClient.invalidateQueries({ queryKey: ["my-requests"] });
    },
  });

  if (quotes.length === 0) return null;

  const declining = quotes.find((quote) => quote.id === decliningId && quote.status === "sent") ?? null;
  const declineForm = declining ? (
    <DeclineForm
      key={declining.id}
      quote={declining}
      pending={respond.isPending}
      error={respond.isError ? (respond.error as Error).message : null}
      onCancel={() => {
        respond.reset();
        setDecliningId(null);
      }}
      onSubmit={(reason) => respond.mutate({ quoteId: declining.id, response: "declined", reason })}
    />
  ) : null;

  if (quotes.length === 1) {
    const quote = quotes[0];
    const gaps = quoteGaps(quote);
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <strong className="font-display text-[22px] font-bold tabular-nums">
            {formatCents(quote.amount_cents)}
          </strong>
          <span className="text-[13px] text-muted-foreground">
            from {quote.provider_name ?? "your pro"}
            {quote.provider_verified ? <VerifiedCheck /> : null}
          </span>
          <span className={"rounded-full px-2.5 py-1 text-[11px] font-bold " + statusPillClass(quote.status)}>
            {QUOTE_STATUS[quote.status]}
          </span>
        </div>
        <Breakdown quote={quote} />
        <Terms quote={quote} now={now} />
        {quote.note ? (
          <p className="mt-2 text-[13px] leading-relaxed text-foreground/80">{quote.note}</p>
        ) : null}
        {gaps.length > 0 && quote.status === "sent" ? (
          <details className="mt-3 rounded-md bg-[#FFF4E5] px-3 py-2 text-[12.5px] text-[#B26A00]">
            <summary className="cursor-pointer font-bold">
              Worth checking before you accept ({gaps.length})
            </summary>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              {gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </details>
        ) : null}
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          Only one price so far. More local pros can quote this job, and each price will appear here
          to compare side by side.
        </p>
        {quote.status === "declined" && quote.decline_reason ? (
          <p className="mt-3 text-[12.5px] text-muted-foreground" data-testid="decline-reason-shown">
            Reason given: {quote.decline_reason}
          </p>
        ) : null}
        {quote.status === "sent" && !declining ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => respond.mutate({ quoteId: quote.id, response: "accepted" })}
              disabled={respond.isPending}
              data-testid="accept-quote"
            >
              {respond.isPending ? "Saving…" : "Accept " + formatCents(quote.amount_cents)}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDecliningId(quote.id)}
              disabled={respond.isPending}
              data-testid="decline-quote"
            >
              Decline
            </Button>
          </div>
        ) : null}
        {declineForm}
        {respond.isError && !declining ? (
          <p role="alert" className="mt-2 text-[12.5px] text-destructive">
            {(respond.error as Error).message}
          </p>
        ) : null}
      </div>
    );
  }

  // The comparison itself. It scrolls sideways on a phone rather than crushing
  // the columns, because a comparison nobody can read is not a comparison.
  const rows = comparisonRows(quotes, formatCents, now);
  return (
    <div className="mt-3">
      <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-foreground/80">
        <Clock className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        {quotes.length} prices to compare
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="bg-muted/60">
              <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Compared
              </th>
              {quotes.map((quote) => (
                <th key={quote.id} className="px-3 py-2.5 align-bottom">
                  <span className="block text-[13px] font-bold">
                    {quote.provider_name ?? "A local pro"}
                    {quote.provider_verified ? <VerifiedCheck /> : null}
                  </span>
                  <span
                    className={"mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold " + statusPillClass(quote.status)}
                  >
                    {QUOTE_STATUS[quote.status]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.label}
                className={
                  "border-t border-border " +
                  (row.differs ? "" : "text-muted-foreground ") +
                  (index === 0 ? "bg-[#F7F9FC] font-bold" : "")
                }
              >
                <th
                  scope="row"
                  className="px-3 py-2.5 text-[12.5px] font-bold text-foreground/70"
                >
                  {row.label}
                  {index > 0 && row.differs ? (
                    <span className="ml-1.5 text-[11px] font-normal text-[#B26A00]">differs</span>
                  ) : null}
                </th>
                {row.values.map((value, i) => (
                  <td key={i} className="px-3 py-2.5 text-[13px] tabular-nums">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <th className="px-3 py-3" />
              {quotes.map((quote) => (
                <td key={quote.id} className="px-3 py-3 align-top">
                  {quote.status === "sent" ? (
                    <span className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => respond.mutate({ quoteId: quote.id, response: "accepted" })}
                        disabled={respond.isPending}
                        data-testid="accept-quote"
                      >
                        {respond.isPending ? "Saving…" : "Accept"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          respond.reset();
                          setDecliningId(quote.id);
                        }}
                        disabled={respond.isPending}
                        data-testid="decline-quote"
                      >
                        Decline
                      </Button>
                    </span>
                  ) : quote.status === "accepted" ? (
                    <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#2E9E4F]">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" /> Chosen
                    </span>
                  ) : (
                    <span className="block text-[12.5px] text-muted-foreground">
                      Not chosen
                      {quote.decline_reason ? (
                        <span className="mt-0.5 block text-[12px]">Reason given: {quote.decline_reason}</span>
                      ) : null}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {declineForm}
      <p className="mt-2 flex items-start gap-1.5 text-[12px] text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3 w-3 flex-none text-accent" aria-hidden="true" />
        <span>
          A row marked “differs” is where the quotes are not the same offer. Accepting one closes the
          others and releases your contact details to that professional.
        </span>
      </p>
      {respond.isError && !declining ? (
        <p role="alert" className="mt-2 text-[12.5px] text-destructive">
          {(respond.error as Error).message}
        </p>
      ) : null}
    </div>
  );
}
