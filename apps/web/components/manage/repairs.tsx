"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Columns3, List, Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { Organization, Property, Unit } from "@/lib/manage-model";
import {
  attachmentProblem,
  ATTACHMENT_TYPES,
  filterRepairs,
  PRIORITIES,
  priorityLabel,
  REPAIR_STATUSES,
  statusOf,
  type Priority,
  type Repair,
  type RepairStatus,
} from "@/lib/repair-model";
import { listProperties, listUnits } from "@/components/manage/data";
import {
  addAttachment,
  createRepair,
  listCategories,
  listRepairs,
  updateRepair,
  type RepairInput,
} from "@/components/manage/repair-data";
import { RepairDetail } from "@/components/manage/repair-detail";
import { Card, EmptyState, ErrorState, field, Loading, primaryButton, quietButton } from "@/components/manage/ui";

const bare = field.replace("mt-1 ", "").replace("w-full", "w-auto");

export function StatusPill({ status }: { status: string }) {
  const info = statusOf(status);
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-bold ${info.tone}`}>{info.label}</span>;
}

export function PriorityText({ priority }: { priority: string }) {
  return <span className={priority === "urgent" ? "font-bold text-[#B42318]" : "text-[#475569]"}>{priorityLabel(priority)}</span>;
}

export function Repairs({ organization }: { organization: Organization }) {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("repair");
  const creating = params.get("new") === "1";

  const repairs = useQuery({
    queryKey: ["manage", "repairs", organization.id],
    queryFn: () => listRepairs(organization.id),
    refetchInterval: 20_000,
  });
  const properties = useQuery({ queryKey: ["manage", "properties", organization.id], queryFn: () => listProperties(organization.id) });
  const units = useQuery({ queryKey: ["manage", "units", organization.id], queryFn: () => listUnits(organization.id) });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RepairStatus | "all">("all");
  const [propertyId, setPropertyId] = useState("all");
  const [board, setBoard] = useState(false);

  if (repairs.isPending || properties.isPending || units.isPending) return <Loading label="Loading your repairs…" />;
  const failed = repairs.error ?? properties.error ?? units.error;
  if (failed) return <ErrorState message={(failed as Error).message} onRetry={() => repairs.refetch()} />;

  const all = repairs.data ?? [];
  const propertyName = (id: string) => (properties.data ?? []).find((property) => property.id === id)?.name ?? "Property";
  const unitName = (id: string | null) => (units.data ?? []).find((unit) => unit.id === id)?.label ?? null;
  const where = (repair: Repair) => [propertyName(repair.property_id), unitName(repair.unit_id)].filter(Boolean).join(", ");

  if (creating) {
    return (
      <>
        <h1 className="mb-5 font-display text-[28px] font-bold">New service request</h1>
        <RepairForm
          organization={organization}
          properties={(properties.data ?? []).filter((property) => !property.archived_at)}
          units={(units.data ?? []).filter((unit) => !unit.archived_at)}
          onDone={(id) => router.push(id ? `/manage?view=repairs&repair=${id}` : "/manage?view=repairs")}
        />
      </>
    );
  }

  const opened = all.find((repair) => repair.id === openId);
  if (opened) {
    return (
      <RepairDetail
        key={opened.id}
        organization={organization}
        repair={opened}
        properties={properties.data ?? []}
        units={units.data ?? []}
        where={where(opened)}
      />
    );
  }

  const shown = filterRepairs(all, { search, status, propertyId });
  const href = (repair: Repair) => `/manage?view=repairs&repair=${repair.id}`;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[28px] font-bold">Maintenance</h1>
        <Link href="/manage?view=repairs&new=1" className={primaryButton}>
          <Plus className="h-4 w-4" aria-hidden="true" /> New service request
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-[#D8DFEA] bg-white px-3">
          <Search className="h-4 w-4 text-[#5B6880]" aria-hidden="true" />
          <input aria-label="Search repairs" placeholder="Search repairs" value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 w-full bg-transparent text-[14px] outline-none" />
        </label>
        <select aria-label="Property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className={bare + " max-w-full"}>
          <option value="all">All properties</option>
          {(properties.data ?? []).map((property) => (
            <option key={property.id} value={property.id}>{property.name}</option>
          ))}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as RepairStatus | "all")} className={bare}>
          <option value="all">All statuses</option>
          {REPAIR_STATUSES.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button type="button" onClick={() => setBoard((value) => !value)} className={quietButton}>
          {board ? <List className="h-4 w-4" aria-hidden="true" /> : <Columns3 className="h-4 w-4" aria-hidden="true" />}
          {board ? "Table view" : "Board view"}
        </button>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? "No repairs yet" : "Nothing matches"}
          body={all.length === 0 ? "Create a service request when something needs fixing." : "Try a different search or filter."}
        />
      ) : board ? (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {REPAIR_STATUSES.filter((column) => status === "all" || column.value === status).map((column) => {
            const items = shown.filter((repair) => repair.status === column.value);
            return (
              <section key={column.value} aria-label={column.label} className="w-[240px] flex-none rounded-2xl bg-[#E9EEF6] p-3">
                <h2 className="mb-2 flex justify-between text-[13px] font-bold">
                  {column.label} <span className="text-[#5B6880]">{items.length}</span>
                </h2>
                <ul className="space-y-2">
                  {items.map((repair) => (
                    <li key={repair.id}>
                      <Link href={href(repair)} className="block rounded-xl border border-[#E4E9F1] bg-white p-3 shadow-sm hover:border-[#F26B1D]">
                        <strong className="block break-words text-[14px]">{repair.title}</strong>
                        <span className="block truncate text-[12.5px] text-[#475569]">{where(repair)}</span>
                        <span className="text-[12.5px]"><PriorityText priority={repair.priority} /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#E4E9F1] bg-white shadow-sm">
          <table className="w-full text-left text-[13.5px]">
            <thead className="bg-[#F8FAFD] text-[12px] uppercase tracking-wide text-[#5B6880]">
              <tr>
                <th scope="col" className="px-4 py-3">Repair</th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">Property</th>
                <th scope="col" className="hidden px-4 py-3 sm:table-cell">Priority</th>
                <th scope="col" className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF1F7]">
              {shown.map((repair) => (
                <tr key={repair.id}>
                  <td className="px-4 py-3">
                    <Link href={href(repair)} className="font-bold text-[#1457C0] hover:underline">{repair.title}</Link>
                    <span className="block text-[12.5px] text-[#475569] md:hidden">{where(repair)}</span>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{where(repair)}</td>
                  <td className="hidden px-4 py-3 sm:table-cell"><PriorityText priority={repair.priority} /></td>
                  <td className="px-4 py-3"><StatusPill status={repair.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Creates a repair, or edits one that has not been sent yet. */
export function RepairForm({
  organization,
  properties,
  units,
  repair,
  onDone,
}: {
  organization: Organization;
  properties: Property[];
  units: Unit[];
  repair?: Repair;
  /** The saved repair's id, or null when cancelled. */
  onDone: (id: string | null) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ["manage", "categories"], queryFn: listCategories, staleTime: 5 * 60_000 });
  const [input, setInput] = useState<RepairInput>({
    propertyId: repair?.property_id ?? (properties.length === 1 ? properties[0].id : ""),
    unitId: repair?.unit_id ?? "",
    category: repair?.category_slug ?? "",
    title: repair?.title ?? "",
    description: repair?.description ?? "",
    priority: repair?.priority ?? "normal",
    preferredDate: repair?.preferred_date ?? "",
    availability: repair?.availability ?? "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  // Remembered so that trying again after a failed upload does not add the repair twice.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const set = (patch: Partial<RepairInput>) => setInput((current) => ({ ...current, ...patch }));

  const save = useMutation({
    mutationFn: async () => {
      let id = repair?.id ?? createdId;
      if (id) {
        await updateRepair(id, input);
      } else {
        id = await createRepair(organization.id, user!.id, input);
        setCreatedId(id);
      }
      const remaining = [...files];
      while (remaining.length > 0) {
        await addAttachment(organization.id, user!.id, id, remaining[0]);
        remaining.shift();
        setFiles([...remaining]);
      }
      return id;
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ["manage"] });
      onDone(id);
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: ["manage"] }),
  });

  if (properties.length === 0) {
    return (
      <EmptyState title="Add a property first" body="A repair always belongs to one of your properties. Open Properties to add one." />
    );
  }
  const unitChoices = units.filter((unit) => unit.property_id === input.propertyId);

  return (
    <Card title={repair ? "Edit repair" : "What needs fixing?"}>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label className="block text-[13px] font-bold">
          Property
          <select required disabled={Boolean(repair || createdId)} value={input.propertyId} onChange={(e) => set({ propertyId: e.target.value, unitId: "" })} className={field}>
            <option value="" disabled>Choose a property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>{property.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] font-bold">
          Unit (optional)
          <select value={input.unitId} onChange={(e) => set({ unitId: e.target.value })} className={field}>
            <option value="">Whole property</option>
            {unitChoices.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] font-bold">
          Type of work
          <select required value={input.category} onChange={(e) => set({ category: e.target.value })} className={field}>
            <option value="" disabled>Choose a service</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.slug} value={category.slug}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] font-bold">
          Priority
          <select value={input.priority} onChange={(e) => set({ priority: e.target.value as Priority })} className={field}>
            {PRIORITIES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] font-bold sm:col-span-2">
          Short title
          <input required minLength={3} maxLength={150} placeholder="For example: Kitchen sink is leaking" value={input.title} onChange={(e) => set({ title: e.target.value })} className={field} />
        </label>
        <label className="block text-[13px] font-bold sm:col-span-2">
          Describe the problem (professionals will read this)
          <textarea required minLength={5} maxLength={4000} rows={4} value={input.description} onChange={(e) => set({ description: e.target.value })} className={field + " h-auto py-2"} />
        </label>
        <label className="block text-[13px] font-bold">
          Preferred date (optional)
          <input type="date" value={input.preferredDate} onChange={(e) => set({ preferredDate: e.target.value })} className={field} />
        </label>
        <label className="block text-[13px] font-bold">
          When someone is there (optional)
          <input maxLength={500} placeholder="For example: weekdays after 3pm" value={input.availability} onChange={(e) => set({ availability: e.target.value })} className={field} />
        </label>
        {repair ? null : (
          <label className="block text-[13px] font-bold sm:col-span-2">
            Photos, video or PDF (optional, up to 25 MB each)
            <input
              type="file"
              multiple
              accept={ATTACHMENT_TYPES.join(",")}
              onChange={(event) => {
                const chosen = Array.from(event.target.files ?? []);
                setProblem(chosen.map(attachmentProblem).find(Boolean) ?? null);
                setFiles(chosen.filter((file) => !attachmentProblem(file)));
              }}
              className="mt-1 block w-full text-[13px] font-normal"
            />
          </label>
        )}
        {problem ? <p role="alert" className="text-[13.5px] text-[#B42318] sm:col-span-2">{problem}</p> : null}
        {save.isError ? (
          <p role="alert" className="text-[13.5px] text-[#B42318] sm:col-span-2">
            {createdId ? "The repair was saved, but a file did not upload: " : ""}
            {(save.error as Error).message}
          </p>
        ) : null}
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={save.isPending} className={primaryButton}>
            {save.isPending ? "Saving…" : repair ? "Save changes" : "Save repair"}
          </button>
          <button type="button" onClick={() => onDone(repair?.id ?? createdId)} className={quietButton}>Cancel</button>
        </div>
        {repair ? null : (
          <p className="text-[12.5px] text-[#475569] sm:col-span-2">
            Saving does not contact anyone yet. On the next screen you choose when to send it to professionals.
          </p>
        )}
      </form>
    </Card>
  );
}
