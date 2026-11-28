"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Building2, Home, MapPin, Pencil, Plus, RotateCcw, Search, Store, Sun } from "lucide-react";
import {
  filterProperties,
  photoProblem,
  PROPERTY_KINDS,
  propertyKindLabel,
  type Organization,
  type Property,
  type PropertyKind,
  type Unit,
} from "@/lib/manage-model";
import {
  addUnit,
  listProperties,
  listServedCities,
  listUnits,
  photoLinks,
  saveProperty,
  setPropertyArchived,
  setUnitArchived,
  type PropertyInput,
} from "@/components/manage/data";
import { Card, EmptyState, ErrorState, field, Loading, primaryButton, quietButton } from "@/components/manage/ui";

const KIND_ICON = { residential: Home, apartment: Building2, commercial: Store, vacation: Sun };

export function Properties({ organization }: { organization: Organization }) {
  const queryClient = useQueryClient();
  const properties = useQuery({ queryKey: ["manage", "properties", organization.id], queryFn: () => listProperties(organization.id) });
  const units = useQuery({ queryKey: ["manage", "units", organization.id], queryFn: () => listUnits(organization.id) });
  const paths = (properties.data ?? []).map((p) => p.photo_path).filter((p): p is string => Boolean(p));
  const photos = useQuery({ queryKey: ["manage", "photos", paths], enabled: paths.length > 0, queryFn: () => photoLinks(paths), staleTime: 30 * 60_000 });

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<PropertyKind | "all">("all");
  const [archived, setArchived] = useState(false);
  // "new" opens an empty form; a property opens it for editing.
  const [editing, setEditing] = useState<Property | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["manage"] });
  const archive = useMutation({
    mutationFn: (input: { id: string; archived: boolean }) => setPropertyArchived(input.id, input.archived),
    onSuccess: refresh,
  });

  if (properties.isPending || units.isPending) return <Loading label="Loading your properties…" />;
  if (properties.isError) return <ErrorState message={(properties.error as Error).message} onRetry={() => properties.refetch()} />;

  const all = properties.data ?? [];
  const shown = filterProperties(all, { search, kind, archived });
  const unitsOf = (propertyId: string) => (units.data ?? []).filter((unit) => unit.property_id === propertyId);
  const opened = all.find((property) => property.id === openId) ?? null;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[28px] font-bold">Properties</h1>
        <button type="button" onClick={() => setEditing("new")} className={primaryButton}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add property
        </button>
      </div>

      {editing ? (
        <PropertyForm
          organization={organization}
          property={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[#D8DFEA] bg-white px-3">
          <Search className="h-4 w-4 text-[#5B6880]" aria-hidden="true" />
          <input
            aria-label="Search properties"
            placeholder="Search by name or address"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full bg-transparent text-[14px] outline-none"
          />
        </label>
        <select aria-label="Property type" value={kind} onChange={(event) => setKind(event.target.value as PropertyKind | "all")} className={field.replace("mt-1 ", "").replace("w-full", "w-auto")}>
          <option value="all">All types</option>
          {PROPERTY_KINDS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[13.5px] font-bold text-[#33466B]">
          <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
          Show archived
        </label>
      </div>

      {archive.isError ? <p role="alert" className="mb-3 text-[13.5px] text-[#B42318]">{(archive.error as Error).message}</p> : null}

      {shown.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? "No properties yet" : "Nothing matches"}
          body={all.length === 0 ? "Add your first property to start keeping track of its units and repairs." : "Try a different search or filter."}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((property) => {
            const Icon = KIND_ICON[property.kind] ?? Home;
            const count = unitsOf(property.id).filter((unit) => !unit.archived_at).length;
            const photo = property.photo_path ? photos.data?.[property.photo_path] : undefined;
            return (
              <li key={property.id} className="overflow-hidden rounded-2xl border border-[#E4E9F1] bg-white shadow-sm">
                <div className="grid h-36 place-items-center bg-gradient-to-b from-[#D6E4F7] to-[#B9C7E3] text-white">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt={property.name} className="h-36 w-full object-cover" />
                  ) : (
                    <Icon className="h-14 w-14" aria-hidden="true" />
                  )}
                </div>
                <div className="p-4">
                  <strong className="block text-[16.5px]">{property.name}</strong>
                  <span className="flex items-center gap-1.5 text-[13px] text-[#475569]">
                    <MapPin className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                    <span className="truncate">{property.address}, {property.city}</span>
                  </span>
                  <span className="mt-1 block text-[13px] text-[#475569]">
                    {propertyKindLabel(property.kind)} • {count} {count === 1 ? "unit" : "units"}
                  </span>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setOpenId(openId === property.id ? null : property.id)} aria-expanded={openId === property.id} className={quietButton}>
                      Units
                    </button>
                    <button type="button" onClick={() => setEditing(property)} className={quietButton}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                    </button>
                    <button
                      type="button"
                      disabled={archive.isPending}
                      onClick={() => {
                        if (!property.archived_at && !window.confirm(`Archive ${property.name}? Its history is kept and you can restore it.`)) return;
                        archive.mutate({ id: property.id, archived: !property.archived_at });
                      }}
                      className={quietButton}
                    >
                      {property.archived_at ? <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> : <Archive className="h-3.5 w-3.5" aria-hidden="true" />}
                      {property.archived_at ? "Restore" : "Archive"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {opened ? <Units organization={organization} property={opened} units={unitsOf(opened.id)} onChanged={refresh} /> : null}
    </>
  );
}

function PropertyForm({
  organization,
  property,
  onClose,
  onSaved,
}: {
  organization: Organization;
  property: Property | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const cities = useQuery({ queryKey: ["manage", "cities"], queryFn: listServedCities, staleTime: 5 * 60_000 });
  const [input, setInput] = useState<PropertyInput>({
    name: property?.name ?? "",
    kind: property?.kind ?? "residential",
    address: property?.address ?? "",
    city: property?.city ?? "",
    description: property?.description ?? "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => saveProperty(organization.id, input, photo, property?.id),
    onSuccess: onSaved,
  });
  const set = (patch: Partial<PropertyInput>) => setInput((current) => ({ ...current, ...patch }));

  return (
    <Card title={property ? `Edit ${property.name}` : "Add a property"}>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label className="block text-[13px] font-bold">
          Property name
          <input required minLength={2} maxLength={120} value={input.name} onChange={(e) => set({ name: e.target.value })} className={field} />
        </label>
        <label className="block text-[13px] font-bold">
          Type
          <select value={input.kind} onChange={(e) => set({ kind: e.target.value as PropertyKind })} className={field}>
            {PROPERTY_KINDS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] font-bold">
          Street address
          <input required minLength={3} maxLength={300} value={input.address} onChange={(e) => set({ address: e.target.value })} className={field} />
        </label>
        <label className="block text-[13px] font-bold">
          City
          <select required value={input.city} onChange={(e) => set({ city: e.target.value })} className={field}>
            <option value="" disabled>Choose a city FixIt serves</option>
            {(cities.data ?? []).map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] font-bold sm:col-span-2">
          Description (optional)
          <textarea rows={3} maxLength={2000} value={input.description} onChange={(e) => set({ description: e.target.value })} className={field + " h-auto py-2"} />
        </label>
        <label className="block text-[13px] font-bold sm:col-span-2">
          Photo (optional, JPG, PNG or WebP, up to 8 MB)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              const bad = file ? photoProblem(file) : null;
              setProblem(bad);
              setPhoto(bad ? null : file);
            }}
            className="mt-1 block w-full text-[13px] font-normal"
          />
        </label>
        {problem || save.isError ? (
          <p role="alert" className="text-[13.5px] text-[#B42318] sm:col-span-2">{problem ?? (save.error as Error).message}</p>
        ) : null}
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={save.isPending} className={primaryButton}>
            {save.isPending ? "Saving…" : "Save property"}
          </button>
          <button type="button" onClick={onClose} className={quietButton}>Cancel</button>
        </div>
      </form>
    </Card>
  );
}

function Units({
  organization,
  property,
  units,
  onChanged,
}: {
  organization: Organization;
  property: Property;
  units: Unit[];
  onChanged: () => void;
}) {
  const [label, setLabel] = useState("");
  const add = useMutation({
    mutationFn: () => addUnit(organization.id, property.id, label),
    onSuccess: () => {
      setLabel("");
      onChanged();
    },
  });
  const archive = useMutation({
    mutationFn: (input: { id: string; archived: boolean }) => setUnitArchived(input.id, input.archived),
    onSuccess: onChanged,
  });
  const ordered = [...units].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  return (
    <div className="mt-4">
      <Card title={`Units in ${property.name}`}>
        <form
          className="mb-3 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (label.trim()) add.mutate();
          }}
        >
          <input
            aria-label="New unit name"
            placeholder="For example: Unit 1 or Upstairs"
            maxLength={40}
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              add.reset();
            }}
            className={field.replace("mt-1 ", "") + " max-w-[280px]"}
          />
          <button type="submit" disabled={add.isPending || !label.trim()} className={primaryButton}>
            {add.isPending ? "Adding…" : "Add unit"}
          </button>
        </form>
        {add.isError ? <p role="alert" className="mb-2 text-[13.5px] text-[#B42318]">{(add.error as Error).message}</p> : null}
        {archive.isError ? <p role="alert" className="mb-2 text-[13.5px] text-[#B42318]">{(archive.error as Error).message}</p> : null}
        {ordered.length === 0 ? (
          <p className="text-[13.5px] text-[#475569]">No units yet. A single house can have just one, or none.</p>
        ) : (
          <ul className="divide-y divide-[#EDF1F7]">
            {ordered.map((unit) => (
              <li key={unit.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className={unit.archived_at ? "text-[#5B6880] line-through" : "font-bold"}>{unit.label}</span>
                <button
                  type="button"
                  disabled={archive.isPending}
                  onClick={() => archive.mutate({ id: unit.id, archived: !unit.archived_at })}
                  className={quietButton}
                >
                  {unit.archived_at ? "Restore" : "Archive"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
