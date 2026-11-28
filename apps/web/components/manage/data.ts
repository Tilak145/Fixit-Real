// Everything the property dashboard reads and writes. The database decides what
// each person may see; these calls simply ask for their organization's rows.
import { requireSupabase } from "@/lib/supabase";
import {
  propertyPhotoPath,
  type Organization,
  type OrganizationKind,
  type Property,
  type PropertyKind,
  type Unit,
} from "@/lib/manage-model";

const PROPERTY_FIELDS = "id,name,kind,address,city,description,photo_path,archived_at";
const UNIT_FIELDS = "id,property_id,label,notes,archived_at";

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** The signed-in person's property organization, or null when they have none yet. */
export async function getMyOrganization(userId: string): Promise<Organization | null> {
  const { data, error } = await requireSupabase()
    .from("organization_members")
    // Filtered to this person: a FixIt staff account may read every membership.
    .select("organizations(id,kind,name,phone,status)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  check(error);
  return ((data as unknown as { organizations: Organization } | null)?.organizations) ?? null;
}

export async function createOrganization(input: { kind: OrganizationKind; name: string; phone: string }): Promise<void> {
  const { error } = await requireSupabase().rpc("create_organization", {
    p_kind: input.kind,
    p_name: input.name,
    p_phone: input.phone,
  });
  check(error);
}

export async function listProperties(organizationId: string): Promise<Property[]> {
  const { data, error } = await requireSupabase().from("properties").select(PROPERTY_FIELDS).eq("organization_id", organizationId);
  check(error);
  return (data ?? []) as Property[];
}

export async function listUnits(organizationId: string): Promise<Unit[]> {
  const { data, error } = await requireSupabase().from("property_units").select(UNIT_FIELDS).eq("organization_id", organizationId);
  check(error);
  return (data ?? []) as Unit[];
}

export async function listServedCities(): Promise<string[]> {
  const { data, error } = await requireSupabase().from("service_cities").select("label,is_active,sort_order").order("sort_order");
  check(error);
  return (data ?? []).filter((city) => city.is_active).map((city) => city.label as string);
}

export interface PropertyInput {
  name: string;
  kind: PropertyKind;
  address: string;
  city: string;
  description: string;
}

function propertyRow(input: PropertyInput) {
  return {
    name: input.name.trim(),
    kind: input.kind,
    address: input.address.trim(),
    city: input.city,
    description: input.description.trim() || null,
  };
}

/** Adds or edits a property, and uploads its photo when one was chosen. */
export async function saveProperty(
  organizationId: string,
  input: PropertyInput,
  photo: File | null,
  existingId?: string,
): Promise<void> {
  const supabase = requireSupabase();
  let id = existingId;
  if (id) {
    const { error } = await supabase
      .from("properties")
      .update({ ...propertyRow(input), updated_at: new Date().toISOString() })
      .eq("id", id);
    check(error);
  } else {
    const { data, error } = await supabase
      .from("properties")
      .insert({ ...propertyRow(input), organization_id: organizationId })
      .select("id")
      .single();
    check(error);
    id = data!.id as string;
  }
  if (!photo) return;
  const path = propertyPhotoPath(organizationId, id!, photo.name);
  const upload = await supabase.storage.from("property-files").upload(path, photo, { contentType: photo.type });
  if (upload.error) throw new Error(`The property was saved, but the photo did not upload: ${upload.error.message}`);
  const { error } = await supabase.from("properties").update({ photo_path: path }).eq("id", id!);
  check(error);
}

export async function setPropertyArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await requireSupabase()
    .from("properties")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  check(error);
}

/** Short-lived links for the private photos. */
export async function photoLinks(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await requireSupabase().storage.from("property-files").createSignedUrls(paths, 3600);
  check(error);
  const links: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) links[row.path] = row.signedUrl;
  }
  return links;
}

export async function addUnit(organizationId: string, propertyId: string, label: string): Promise<void> {
  const { error } = await requireSupabase()
    .from("property_units")
    .insert({ organization_id: organizationId, property_id: propertyId, label: label.trim() });
  if (error?.code === "23505") throw new Error("This property already has a unit with that name.");
  check(error);
}

export async function setUnitArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await requireSupabase()
    .from("property_units")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  check(error);
}
