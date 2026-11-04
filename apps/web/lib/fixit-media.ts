/**
 * Small display helpers for the media a customer sends with a job.
 *
 * Kept away from the upload code so a component can format a file size without
 * pulling in the Supabase client, and so the arithmetic is testable directly.
 */

/** "1.2 MB" reads better than the raw byte count on a thumbnail. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // Bytes are whole; the larger units get one decimal place, and no trailing .0.
  const rounded = unit === 0 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
  return rounded + " " + units[unit];
}

/**
 * How many more files a request may take. Empty slots are shown to the customer
 * rather than a silent refusal after the upload has started.
 */
export const MAX_PHOTOS_PER_REQUEST = 8;
export const MAX_VIDEOS_PER_REQUEST = 1;

export function remainingMediaSlots(media: Array<{ kind: "photo" | "video" }>): {
  photos: number;
  videos: number;
} {
  const photos = media.filter((item) => item.kind === "photo").length;
  const videos = media.filter((item) => item.kind === "video").length;
  return {
    photos: Math.max(0, MAX_PHOTOS_PER_REQUEST - photos),
    videos: Math.max(0, MAX_VIDEOS_PER_REQUEST - videos),
  };
}

/** The little of a file this logic needs, so it works for a File and a test stub. */
export interface MediaFileLike {
  type: string;
  size: number;
  name: string;
}

/** A file the customer has chosen but not yet sent. */
export interface PendingMedia<F extends MediaFileLike = MediaFileLike> {
  id: string;
  kind: "photo" | "video";
  /** The original file, kept until the request is submitted. */
  file: F;
  /** A local preview, only for a photo. */
  previewUrl: string;
}

/**
 * Whether one more file may be added, and why not if it may not. A limit that
 * silently drops a photo is worse than one that says "eight is plenty".
 */
export function mediaSlotError(
  pending: Array<{ kind: "photo" | "video" }>,
  file: Pick<MediaFileLike, "type">,
): string | null {
  if (file.type.startsWith("image/")) {
    return remainingMediaSlots(pending).photos <= 0
      ? "That is " + MAX_PHOTOS_PER_REQUEST + " photos already — plenty for one job."
      : null;
  }
  if (file.type.startsWith("video/")) {
    return remainingMediaSlots(pending).videos <= 0
      ? "One video per job is enough. Remove the clip you added to send a different one."
      : null;
  }
  return "Please choose a photo or a video.";
}
