// The rules of the property dashboard that need no database, so Node can test them.

export type OrganizationKind = "landlord" | "company";

export interface Organization {
  id: string;
  kind: OrganizationKind;
  name: string;
  phone: string | null;
  status: "pending" | "approved" | "rejected";
}

export type PropertyKind = "residential" | "apartment" | "commercial" | "vacation";

export const PROPERTY_KINDS: Array<{ value: PropertyKind; label: string }> = [
  { value: "residential", label: "Residential home" },
  { value: "apartment", label: "Apartment building" },
  { value: "commercial", label: "Commercial" },
  { value: "vacation", label: "Vacation rental" },
];

export function propertyKindLabel(value: string): string {
  return PROPERTY_KINDS.find((kind) => kind.value === value)?.label ?? value;
}

export interface Property {
  id: string;
  name: string;
  kind: PropertyKind;
  address: string;
  city: string;
  description: string | null;
  photo_path: string | null;
  archived_at: string | null;
}

export interface Unit {
  id: string;
  property_id: string;
  label: string;
  notes: string | null;
  archived_at: string | null;
}

export interface PropertyFilter {
  search: string;
  kind: PropertyKind | "all";
  archived: boolean;
}

/** The properties a search and filter leave, in name order. */
export function filterProperties(properties: Property[], filter: PropertyFilter): Property[] {
  const words = filter.search.trim().toLowerCase();
  return properties
    .filter((property) => Boolean(property.archived_at) === filter.archived)
    .filter((property) => filter.kind === "all" || property.kind === filter.kind)
    .filter((property) => !words || `${property.name} ${property.address} ${property.city}`.toLowerCase().includes(words))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A storage path for a property photo; the first part is what the access rule checks. */
export function propertyPhotoPath(organizationId: string, propertyId: string, fileName: string, now: number = Date.now()): string {
  const ending = /\.([a-z0-9]{2,5})$/iu.exec(fileName)?.[1]?.toLowerCase() ?? "jpg";
  return `${organizationId}/properties/${propertyId}-${now}.${ending}`;
}

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/** Why a photo cannot be used, or null when it can. */
export function photoProblem(file: { type: string; size: number }): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return "Choose a JPG, PNG or WebP picture.";
  if (file.size > PHOTO_MAX_BYTES) return "That picture is larger than 8 MB. Choose a smaller one.";
  return null;
}
