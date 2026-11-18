/**
 * Small display helpers for the media a customer sends with a job.
 *
 * Kept out of the upload code so a component can format a file size without
 * pulling in the Supabase client, and so the arithmetic is testable directly.
 */

/** "1.2 MB" reads better than the raw byte count on a thumbnail. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, '');
  return rounded + ' ' + units[unit];
}

/** How many files one job may carry. Eight photos and one clip is plenty. */
export const MAX_PHOTOS_PER_REQUEST = 8;
export const MAX_VIDEOS_PER_REQUEST = 1;
