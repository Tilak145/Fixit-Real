// The rules of repair requests that need no database, so Node can test them.

export type RepairStatus =
  | "submitted"
  | "awaiting_quotes"
  | "awaiting_approval"
  | "assigned"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export const REPAIR_STATUSES: Array<{ value: RepairStatus; label: string; tone: string }> = [
  { value: "submitted", label: "Submitted", tone: "bg-[#E8EDF5] text-[#33466B]" },
  { value: "awaiting_quotes", label: "Awaiting quotes", tone: "bg-[#E3EEFD] text-[#1457C0]" },
  { value: "awaiting_approval", label: "Awaiting approval", tone: "bg-[#EEE8FB] text-[#5B3FB0]" },
  { value: "assigned", label: "Contractor assigned", tone: "bg-[#FFF0E3] text-[#9A3D06]" },
  { value: "scheduled", label: "Scheduled", tone: "bg-[#E0F4F4] text-[#0B6366]" },
  { value: "in_progress", label: "In progress", tone: "bg-[#FFF4D6] text-[#7A5200]" },
  { value: "completed", label: "Completed", tone: "bg-[#DCF3E2] text-[#136C34]" },
  { value: "cancelled", label: "Cancelled", tone: "bg-[#F1F1F1] text-[#555555]" },
];

export function statusOf(value: string) {
  return REPAIR_STATUSES.find((status) => status.value === value) ?? REPAIR_STATUSES[0];
}

export type Priority = "low" | "normal" | "high" | "urgent";

export const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function priorityLabel(value: string): string {
  return PRIORITIES.find((priority) => priority.value === value)?.label ?? value;
}

export interface Repair {
  id: string;
  property_id: string;
  unit_id: string | null;
  category_slug: string;
  title: string;
  description: string;
  priority: Priority;
  status: RepairStatus;
  preferred_date: string | null;
  availability: string | null;
  estimated_cost_cents: number | null;
  final_cost_cents: number | null;
  quote_request_id: string | null;
  created_at: string;
  updated_at: string;
}

/** What the owner may do next; the database refuses anything else. */
export function repairActions(repair: Pick<Repair, "status" | "quote_request_id">) {
  const { status } = repair;
  return {
    edit: status === "submitted" && !repair.quote_request_id,
    send: status === "submitted" && !repair.quote_request_id,
    cancel: ["submitted", "awaiting_quotes", "awaiting_approval"].includes(status),
    start: ["assigned", "scheduled"].includes(status),
    complete: ["assigned", "scheduled", "in_progress"].includes(status),
    finalCost: ["assigned", "scheduled", "in_progress", "completed"].includes(status),
  };
}

export interface RepairFilter {
  search: string;
  status: RepairStatus | "all";
  propertyId: string | "all";
}

/** Newest first, after search and filters. */
export function filterRepairs(repairs: Repair[], filter: RepairFilter): Repair[] {
  const words = filter.search.trim().toLowerCase();
  return repairs
    .filter((repair) => filter.status === "all" || repair.status === filter.status)
    .filter((repair) => filter.propertyId === "all" || repair.property_id === filter.propertyId)
    .filter((repair) => !words || `${repair.title} ${repair.description}`.toLowerCase().includes(words))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export const ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
];
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

export function attachmentProblem(file: { type: string; size: number; name: string }): string | null {
  if (!ATTACHMENT_TYPES.includes(file.type)) return `${file.name}: choose a photo, a video or a PDF.`;
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > ATTACHMENT_MAX_BYTES) return `${file.name} is larger than 25 MB.`;
  return null;
}

/** Only photos, and videos up to 15 MB, can be shown to professionals. */
export function canShareWithPros(file: { mime_type: string; size_bytes: number }): boolean {
  if (file.mime_type.startsWith("image/")) return true;
  return file.mime_type.startsWith("video/") && file.size_bytes <= 15 * 1024 * 1024;
}

export function attachmentPath(organizationId: string, requestId: string, fileName: string, now: number = Date.now()): string {
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80) || "file";
  return `${organizationId}/repairs/${requestId}/${now}-${safe}`;
}

/** "$1,250.50" typed by a person to cents; null when blank, NaN when not money. */
export function dollarsToCents(text: string): number | null {
  const clean = text.replace(/[$,\s]/g, "");
  if (!clean) return null;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(clean)) return Number.NaN;
  return Math.round(Number(clean) * 100);
}

export function money(cents: number | null): string {
  return cents === null ? "—" : `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** A date with no time, shown as written rather than shifted by the time zone. */
export function plainDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
