/**
 * A job started while signed out.
 *
 * Someone who describes their repair, picks an address and then signs up must
 * not have to type any of it again. The draft is kept on the device until the
 * request is sent, then removed. Photos are not part of it: a file cannot be
 * stored this way, and a half-uploaded photo would be worse than none.
 */
export const JOB_DRAFT_KEY = "fixit.request.draft";

export interface JobDraft {
  categorySlug: string;
  description: string;
  city: string;
  address: string;
  emergency: boolean;
  budgetId: string;
  customMin: string;
  customMax: string;
  /** Where the address is, so an emergency keeps its distance to the nearest crew. */
  lat: number | null;
  lng: number | null;
  savedAt: string;
}

/** Drafts older than this are a different visit, and are ignored. */
export const JOB_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * The saved draft as this form needs it, or null when there is none, it is
 * unreadable, or it is too old to be the same job.
 */
export function readJobDraft(raw: unknown, now: Date = new Date()): JobDraft | null {
  if (typeof raw !== "string" || raw === "") return null;
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const savedAt = new Date(text(value.savedAt));
  if (Number.isNaN(savedAt.getTime())) return null;
  if (now.getTime() - savedAt.getTime() > JOB_DRAFT_MAX_AGE_MS) return null;
  const lat = typeof value.lat === "number" && Number.isFinite(value.lat) ? value.lat : null;
  const lng = typeof value.lng === "number" && Number.isFinite(value.lng) ? value.lng : null;
  const draft: JobDraft = {
    categorySlug: text(value.categorySlug),
    description: text(value.description),
    city: text(value.city),
    address: text(value.address),
    emergency: value.emergency === true,
    budgetId: text(value.budgetId),
    customMin: text(value.customMin),
    customMax: text(value.customMax),
    lat: lat != null && lng != null ? lat : null,
    lng: lat != null && lng != null ? lng : null,
    savedAt: savedAt.toISOString(),
  };
  // A draft with nothing in it is not worth bringing back.
  const empty =
    !draft.description.trim() &&
    !draft.address.trim() &&
    !draft.city.trim() &&
    !draft.budgetId &&
    !draft.emergency;
  return empty ? null : draft;
}
