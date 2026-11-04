"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/commission";
import { quoteTotalCents, sendQuote, type JobQuote, type QuoteDraft } from "@/lib/fixit";

/** A money field, in dollars, that turns into whole cents on submit. */
function MoneyField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1 block text-[12.5px] font-bold text-foreground/80">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
          $
        </span>
        <input
          id={id}
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0.00"
          className="h-10 w-full rounded-md border border-input bg-input pl-6 pr-3 text-sm outline-none ring-ring focus:ring-2"
        />
      </span>
      {hint ? <span className="mt-0.5 block text-[11.5px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1 block text-[12.5px] font-bold text-foreground/80">{label}</span>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-input bg-input px-3 text-sm outline-none ring-ring focus:ring-2"
      />
      {hint ? <span className="mt-0.5 block text-[11.5px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

const toCents = (dollars: string): number => {
  const value = Number(dollars);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
};

/**
 * The professional's itemised price. The parts are asked for separately because
 * that is what lets a homeowner compare two quotes honestly: "labour only" and
 * "all-in" are different offers, and a single box hides the difference.
 *
 * The parts are added up here and the total is shown live, so the professional
 * can see exactly what the customer will see before sending it.
 */
export function QuoteComposer({
  requestId,
  existing,
  onDone,
  onError,
}: {
  requestId: string;
  existing?: JobQuote | null;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const dollars = (cents: number | null | undefined) =>
    cents && cents > 0 ? (cents / 100).toFixed(2) : "";

  const [labour, setLabour] = useState(dollars(existing?.labour_cents));
  const [materials, setMaterials] = useState(dollars(existing?.materials_cents));
  const [serviceCall, setServiceCall] = useState(dollars(existing?.service_call_cents));
  const [emergency, setEmergency] = useState(dollars(existing?.emergency_fee_cents));
  const [other, setOther] = useState(dollars(existing?.other_cents));
  const [otherLabel, setOtherLabel] = useState(existing?.other_label ?? "");
  const [earliestStart, setEarliestStart] = useState(existing?.earliest_start ?? "");
  const [completionNote, setCompletionNote] = useState(existing?.completion_note ?? "");
  const [warranty, setWarranty] = useState(existing?.warranty ?? "");
  const [paymentTerms, setPaymentTerms] = useState(existing?.payment_terms ?? "");
  const [validUntil, setValidUntil] = useState(existing?.valid_until ?? "");
  const [note, setNote] = useState(existing?.note ?? "");

  const draft: QuoteDraft = {
    labourCents: toCents(labour),
    materialsCents: toCents(materials),
    serviceCallCents: toCents(serviceCall),
    emergencyFeeCents: toCents(emergency),
    otherCents: toCents(other),
    otherLabel,
    earliestStart: earliestStart || null,
    completionNote,
    warranty,
    paymentTerms,
    validUntil: validUntil || null,
    note,
  };
  const total = quoteTotalCents(draft);

  const save = useMutation({
    mutationFn: () => sendQuote({ requestId, draft }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-leads"] });
      await queryClient.invalidateQueries({ queryKey: ["my-quotes"] });
      onDone();
    },
    onError: (error: Error) => onError(error.message),
  });

  const missingTerms = [
    !toCents(materials) && "materials",
    !earliestStart && "a start date",
    !completionNote.trim() && "how long it will take",
    !warranty.trim() && "your warranty",
    !paymentTerms.trim() && "payment terms",
  ].filter(Boolean) as string[];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (total <= 0) return;
        save.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <MoneyField id="q-labour" label="Labour" value={labour} onChange={setLabour} />
        <MoneyField
          id="q-materials"
          label="Materials"
          hint="Leave blank if the customer supplies them"
          value={materials}
          onChange={setMaterials}
        />
        <MoneyField
          id="q-service"
          label="Service call"
          hint="Call-out or diagnostic charge"
          value={serviceCall}
          onChange={setServiceCall}
        />
        <MoneyField
          id="q-emergency"
          label="Emergency fee"
          hint="Only if this job is after hours"
          value={emergency}
          onChange={setEmergency}
        />
        <MoneyField id="q-other" label="Other" value={other} onChange={setOther} />
        <TextField
          id="q-other-label"
          label="What is the other charge?"
          value={otherLabel}
          onChange={setOtherLabel}
          placeholder="Permit, disposal, lift hire…"
        />
        <label className="block" htmlFor="q-start">
          <span className="mb-1 block text-[12.5px] font-bold text-foreground/80">Earliest start</span>
          <input
            id="q-start"
            type="date"
            value={earliestStart}
            onChange={(event) => setEarliestStart(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-input px-3 text-sm outline-none ring-ring focus:ring-2"
          />
        </label>
        <label className="block" htmlFor="q-valid">
          <span className="mb-1 block text-[12.5px] font-bold text-foreground/80">
            Price valid until
          </span>
          <input
            id="q-valid"
            type="date"
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-input px-3 text-sm outline-none ring-ring focus:ring-2"
          />
        </label>
        <TextField
          id="q-duration"
          label="How long will it take?"
          value={completionNote}
          onChange={setCompletionNote}
          placeholder="About four hours, same day"
        />
        <TextField
          id="q-warranty"
          label="Warranty"
          value={warranty}
          onChange={setWarranty}
          placeholder="12 months on labour"
        />
        <div className="sm:col-span-2">
          <TextField
            id="q-payment"
            label="Payment terms"
            value={paymentTerms}
            onChange={setPaymentTerms}
            placeholder="Half on arrival, half on completion"
          />
        </div>
      </div>

      <label className="mt-3 block" htmlFor="q-note">
        <span className="mb-1 block text-[12.5px] font-bold text-foreground/80">
          Anything else the customer should know
        </span>
        <textarea
          id="q-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Includes hauling away the old unit."
          className="w-full rounded-md border border-input bg-input p-3 text-sm outline-none ring-ring focus:ring-2"
        />
      </label>

      <div className="mt-4 flex items-center justify-between rounded-lg bg-muted px-4 py-3">
        <span className="text-[13px] font-bold text-foreground/80">Total the customer sees</span>
        <strong className="font-display text-[22px] font-bold tabular-nums">{formatCents(total)}</strong>
      </div>

      {missingTerms.length > 0 ? (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-[#FFF4E5] px-3.5 py-2.5 text-[12.5px] text-[#B26A00]">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
          <span>
            You have not stated {missingTerms.join(", ")}. The customer can still accept, but quotes
            that answer these are the ones people choose.
          </span>
        </p>
      ) : null}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onDone}
          className="h-[46px] flex-1 rounded-lg border border-border text-sm font-bold text-foreground/70"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={save.isPending || total <= 0}
          className="h-[46px] flex-1 rounded-lg bg-primary text-sm font-bold text-white disabled:opacity-60"
        >
          {save.isPending ? "Sending…" : existing ? "Update quote" : "Send quote"}
        </button>
      </div>
      {total <= 0 ? (
        <p className="mt-2 text-center text-[12px] text-muted-foreground">
          Enter at least one amount to send your price.
        </p>
      ) : null}
    </form>
  );
}
