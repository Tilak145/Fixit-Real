/**
 * Where a professional's shop is, and how far a job is from it.
 *
 * Emergency work is routed by distance: the nearest shop that is open, accepts
 * emergency calls and offers the trade gets the job first. That keeps a water
 * leak from waiting behind a booking, and keeps a crew from crossing the county
 * for a ten-minute repair.
 *
 * Coordinates are only ever used for that comparison. A professional's exact
 * address is never text-matched; it is geocoded once, by the server, from the
 * address the business entered.
 */

/** The service's answer to "where is this address", in order of trust. */
export interface ServiceLocation {
  lat?: number | null;
  lng?: number | null;
  /** The city label a job would carry, e.g. "Akron, OH". */
  city?: string | null;
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_MILES = 3958.8;

/** A usable point, or null when either number is missing or out of range. */
export function toPoint(location: ServiceLocation | null | undefined): RoutePoint | null {
  if (!location) return null;
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  // 0,0 is null island: almost always a blank or failed lookup, never a shop.
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** Straight-line miles between two points, rounded to a tenth. */
export function milesBetween(from: RoutePoint, to: RoutePoint): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  const miles = 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
  return Math.round(miles * 10) / 10;
}

/**
 * Minutes to drive a distance, allowing for the fact that a road is not a
 * ruler: local trips run near 25 mph average, which includes lights and the
 * last mile. It is an estimate, and the screens say so.
 */
export function driveMinutes(miles: number): number {
  const minutes = (miles / 25) * 60 + 4;
  return Math.max(3, Math.round(minutes));
}

/** "6 min · 1.8 mi", or null when either end is unknown. */
export function routeLabel(from: ServiceLocation | null | undefined, to: ServiceLocation | null | undefined): string | null {
  const a = toPoint(from);
  const b = toPoint(to);
  if (!a || !b) return null;
  const miles = milesBetween(a, b);
  return `${driveMinutes(miles)} min · ${miles.toFixed(1)} mi`;
}
