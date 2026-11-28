"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, FileText, Send } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { Organization, Property, Unit } from "@/lib/manage-model";
import {
  attachmentProblem,
  ATTACHMENT_TYPES,
  dollarsToCents,
  money,
  plainDate,
  repairActions,
  statusOf,
  type Repair,
  type RepairStatus,
} from "@/lib/repair-model";
import { QuoteComparison } from "@/components/fixit/quote-comparison";
import { MessageThread } from "@/components/fixit/thread";
import {
  addAttachment,
  addNote,
  getJob,
  listActivity,
  listAttachments,
  listNotes,
  removeAttachment,
  saveFinalCost,
  sendToProfessionals,
  setRepairStatus,
  type Activity,
} from "@/components/manage/repair-data";
import { PriorityText, RepairForm, StatusPill } from "@/components/manage/repairs";
import { Card, field, primaryButton, quietButton } from "@/components/manage/ui";

function Problem({ error }: { error: unknown }) {
  return error ? <p role="alert" className="mt-2 text-[13.5px] text-[#B42318]">{(error as Error).message}</p> : null;
}

function historyLine(entry: Activity): string {
  if (entry.action === "created") return "Repair created";
  if (entry.action === "note_added") return "Note added";
  return `Changed to ${statusOf(entry.detail ?? "").label}`;
}

const when = (value: string) =>
  new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function RepairDetail({
  organization,
  repair,
  properties,
  units,
  where,
}: {
  organization: Organization;
  repair: Repair;
  properties: Property[];
  units: Unit[];
  where: string;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["manage"] });
  const can = repairActions(repair);
  const [editing, setEditing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [sharePhotos, setSharePhotos] = useState(true);
  const [unshared, setUnshared] = useState(0);

  const job = useQuery({
    queryKey: ["manage", "job", repair.quote_request_id],
    enabled: Boolean(repair.quote_request_id),
    queryFn: () => getJob(repair.quote_request_id!),
    refetchInterval: 15_000,
  });
  const send = useMutation({
    mutationFn: () => sendToProfessionals(repair.id, sharePhotos),
    onSuccess: (result) => setUnshared(result.failed),
    onSettled: refresh,
  });
  const change = useMutation({
    mutationFn: (status: RepairStatus) => setRepairStatus(repair.id, status),
    onSuccess: () => setConfirmingCancel(false),
    onSettled: refresh,
  });

  return (
    <>
      <Link href="/manage?view=repairs" className="mb-3 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[#1457C0] hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All repairs
      </Link>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="break-words font-display text-[26px] font-bold">{repair.title}</h1>
        <StatusPill status={repair.status} />
      </div>
      <p className="mb-4 text-[14px] text-[#475569]">{where}</p>

      {editing && can.edit ? (
        <RepairForm
          organization={organization}
          properties={properties}
          units={units.filter((unit) => !unit.archived_at || unit.id === repair.unit_id)}
          repair={repair}
          onDone={() => setEditing(false)}
        />
      ) : (
        <Card title="Details">
          <p className="mb-3 whitespace-pre-wrap break-words text-[14px]">{repair.description}</p>
          <dl className="grid grid-cols-2 gap-3 text-[13.5px] lg:grid-cols-4">
            <div><dt className="text-[#5B6880]">Priority</dt><dd><PriorityText priority={repair.priority} /></dd></div>
            <div><dt className="text-[#5B6880]">Preferred date</dt><dd>{plainDate(repair.preferred_date)}</dd></div>
            <div><dt className="text-[#5B6880]">Accepted price</dt><dd>{money(repair.estimated_cost_cents)}</dd></div>
            <div><dt className="text-[#5B6880]">Final cost</dt><dd>{money(repair.final_cost_cents)}</dd></div>
          </dl>
          {repair.availability ? <p className="mt-3 text-[13.5px]"><span className="text-[#5B6880]">Availability: </span>{repair.availability}</p> : null}

          {can.send ? (
            <div className="mt-4 rounded-xl border border-[#F0DCB6] bg-[#FFF7EC] p-3">
              <label className="mb-2 flex items-center gap-2 text-[13.5px]">
                <input type="checkbox" checked={sharePhotos} onChange={(e) => setSharePhotos(e.target.checked)} />
                Show the attached photos and videos to professionals
              </label>
              <button type="button" disabled={send.isPending || organization.status !== "approved"} onClick={() => send.mutate()} className={primaryButton}>
                <Send className="h-4 w-4" aria-hidden="true" /> {send.isPending ? "Sending…" : "Send to professionals"}
              </button>
              <p className="mt-2 text-[12.5px] text-[#6B4A10]">
                {organization.status === "approved"
                  ? "Local pros for this service can then send you a price. Your notes stay private."
                  : "You can send jobs once FixIt has approved your company."}
              </p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {can.edit ? <button type="button" onClick={() => setEditing(true)} className={quietButton}>Edit</button> : null}
            {can.start && repair.status !== "in_progress" ? (
              <button type="button" disabled={change.isPending} onClick={() => change.mutate("in_progress")} className={quietButton}>Mark in progress</button>
            ) : null}
            {can.complete ? (
              <button type="button" disabled={change.isPending} onClick={() => change.mutate("completed")} className={quietButton}>Mark completed</button>
            ) : null}
            {can.cancel && !confirmingCancel ? (
              <button type="button" onClick={() => setConfirmingCancel(true)} className={quietButton}>Cancel repair</button>
            ) : null}
            {can.cancel && confirmingCancel ? (
              <span className="flex flex-wrap items-center gap-2 text-[13.5px]">
                {repair.quote_request_id ? "Cancel it? No more prices will arrive." : "Cancel this repair?"}
                <button type="button" disabled={change.isPending} onClick={() => change.mutate("cancelled")} className={quietButton + " !border-[#B42318] !text-[#B42318]"}>Yes, cancel it</button>
                <button type="button" onClick={() => setConfirmingCancel(false)} className={quietButton}>Keep it</button>
              </span>
            ) : null}
          </div>
          <Problem error={send.error ?? change.error} />
          {unshared > 0 ? <p role="alert" className="mt-2 text-[13.5px] text-[#8A4B00]">Sent, but {unshared} file(s) could not be shown to professionals.</p> : null}
          {can.finalCost ? <FinalCost repair={repair} onSaved={refresh} /> : null}
        </Card>
      )}

      {repair.quote_request_id ? (
        <Card title="Prices and visits">
          {job.isPending ? <p role="status" className="text-[13.5px] text-[#475569]">Loading…</p> : null}
          <Problem error={job.error} />
          {job.data ? (
            <>
              {job.data.claimedName ? <p className="text-[14px]">Professional: <strong>{job.data.claimedName}</strong></p> : null}
              {job.data.visits.map((visit) => (
                <p key={visit.id} className="mt-2 flex items-center gap-2 text-[13.5px]">
                  <CalendarDays className="h-4 w-4 flex-none text-[#0B6366]" aria-hidden="true" />
                  {visit.title}: {when(visit.scheduled_for)} ({visit.status})
                </p>
              ))}
              {job.data.quotes.length > 0 ? (
                <QuoteComparison quotes={job.data.quotes} onResponded={refresh} />
              ) : (
                <p className="mt-2 text-[13.5px] text-[#475569]">
                  {repair.status === "cancelled" ? "No prices were received." : "Waiting for the first price. You will see it here and in the bell."}
                </p>
              )}
              {job.data.claimedName && !["completed", "cancelled"].includes(repair.status) ? (
                <div className="mt-4">
                  <MessageThread requestId={repair.quote_request_id} role="customer" counterpart={job.data.claimedName} />
                </div>
              ) : null}
            </>
          ) : null}
        </Card>
      ) : null}

      <Files organization={organization} repair={repair} />
      <Notes organization={organization} repair={repair} onChanged={refresh} />
      <History repair={repair} />
    </>
  );
}

function FinalCost({ repair, onSaved }: { repair: Repair; onSaved: () => void }) {
  const [text, setText] = useState(repair.final_cost_cents === null ? "" : String(repair.final_cost_cents / 100));
  const cents = dollarsToCents(text);
  const save = useMutation({ mutationFn: () => saveFinalCost(repair.id, cents), onSuccess: onSaved });
  return (
    <form
      className="mt-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!Number.isNaN(cents)) save.mutate();
      }}
    >
      <label className="block text-[13px] font-bold">
        What it actually cost (optional)
        <span className="mt-1 flex flex-wrap gap-2">
          <input inputMode="decimal" placeholder="250.00" value={text} onChange={(e) => setText(e.target.value)} className={field.replace("mt-1 ", "") + " max-w-[160px]"} />
          <button type="submit" disabled={save.isPending || Number.isNaN(cents)} className={quietButton}>Save cost</button>
        </span>
      </label>
      {Number.isNaN(cents) ? <p role="alert" className="mt-1 text-[13px] text-[#B42318]">Type an amount such as 250 or 250.50.</p> : null}
      <Problem error={save.error} />
    </form>
  );
}

function Files({ organization, repair }: { organization: Organization; repair: Repair }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ["manage", "attachments", repair.id];
  const files = useQuery({ queryKey: key, queryFn: () => listAttachments(repair.id) });
  const [problem, setProblem] = useState<string | null>(null);
  const reload = () => queryClient.invalidateQueries({ queryKey: key });
  const add = useMutation({
    mutationFn: async (chosen: File[]) => {
      for (const file of chosen) await addAttachment(organization.id, user!.id, repair.id, file);
    },
    onSettled: reload,
  });
  const remove = useMutation({ mutationFn: removeAttachment, onSettled: reload });

  return (
    <Card title="Photos and files">
      {files.isPending ? <p role="status" className="text-[13.5px] text-[#475569]">Loading…</p> : null}
      {files.data && files.data.length === 0 ? <p className="text-[13.5px] text-[#475569]">Nothing attached.</p> : null}
      <ul className="flex flex-wrap gap-3">
        {(files.data ?? []).map((file) => (
          <li key={file.id} className="w-[140px] text-[12.5px]">
            <a href={file.url ?? undefined} target="_blank" rel="noreferrer" className="block">
              {file.url && file.mime_type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.url} alt={file.file_name} className="h-[100px] w-full rounded-lg object-cover" />
              ) : (
                <span className="grid h-[100px] place-items-center rounded-lg bg-[#E9EEF6]">
                  <FileText className="h-8 w-8 text-[#5B6880]" aria-hidden="true" />
                </span>
              )}
              <span className="mt-1 block truncate">{file.file_name}</span>
            </a>
            <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(file)} className="font-bold text-[#B42318] hover:underline">
              Remove
            </button>
          </li>
        ))}
      </ul>
      <label className="mt-3 block text-[13px] font-bold">
        Add files
        <input
          type="file"
          multiple
          disabled={add.isPending}
          accept={ATTACHMENT_TYPES.join(",")}
          onChange={(event) => {
            const chosen = Array.from(event.target.files ?? []);
            event.target.value = "";
            setProblem(chosen.map(attachmentProblem).find(Boolean) ?? null);
            const good = chosen.filter((file) => !attachmentProblem(file));
            if (good.length > 0) add.mutate(good);
          }}
          className="mt-1 block w-full text-[13px] font-normal"
        />
      </label>
      {add.isPending ? <p role="status" className="mt-1 text-[13px]">Uploading…</p> : null}
      {problem ? <p role="alert" className="mt-1 text-[13.5px] text-[#B42318]">{problem}</p> : null}
      <Problem error={files.error ?? add.error ?? remove.error} />
      {repair.quote_request_id ? <p className="mt-2 text-[12.5px] text-[#475569]">Files added after sending stay private to you.</p> : null}
    </Card>
  );
}

function Notes({ organization, repair, onChanged }: { organization: Organization; repair: Repair; onChanged: () => void }) {
  const { user } = useAuth();
  const notes = useQuery({ queryKey: ["manage", "notes", repair.id], queryFn: () => listNotes(repair.id) });
  const [body, setBody] = useState("");
  const add = useMutation({
    mutationFn: () => addNote(organization.id, user!.id, repair.id, body),
    onSuccess: () => {
      setBody("");
      onChanged();
    },
  });
  return (
    <Card title="Private notes">
      <p className="mb-2 text-[12.5px] text-[#475569]">Only your property account sees these. Professionals never do.</p>
      <ul className="mb-3 space-y-2">
        {(notes.data ?? []).map((note) => (
          <li key={note.id} className="rounded-lg bg-[#F3F6FB] p-3 text-[13.5px]">
            <p className="whitespace-pre-wrap break-words">{note.body}</p>
            <span className="text-[12px] text-[#5B6880]">{when(note.created_at)}</span>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (body.trim()) add.mutate();
        }}
      >
        <textarea aria-label="New note" rows={2} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} className={field + " h-auto py-2"} />
        <button type="submit" disabled={add.isPending || !body.trim()} className={quietButton + " mt-2"}>
          {add.isPending ? "Adding…" : "Add note"}
        </button>
      </form>
      <Problem error={notes.error ?? add.error} />
    </Card>
  );
}

function History({ repair }: { repair: Repair }) {
  // The key includes the last change, so history reloads when the repair moves on.
  const history = useQuery({ queryKey: ["manage", "history", repair.id, repair.updated_at], queryFn: () => listActivity(repair.id) });
  return (
    <Card title="History">
      <ul className="space-y-1.5 text-[13.5px]">
        {(history.data ?? []).map((entry) => (
          <li key={entry.id} className="flex flex-wrap justify-between gap-2">
            <span>{historyLine(entry)}</span>
            <span className="text-[#5B6880]">{when(entry.created_at)}</span>
          </li>
        ))}
      </ul>
      <Problem error={history.error} />
    </Card>
  );
}
