import { NextRequest, NextResponse } from "next/server";
import { SITE_EMAIL, SITE_URL } from "@/lib/site-contact";
import {
  parseAddressSuggestions,
  parseNominatimSuggestions,
  hasHouseNumber,
  chooseSuggestions,
  keepTypedHouseNumber,
  MIN_LOOKUP_LENGTH,
  type AddressSuggestion,
} from "@/lib/fixit-address";

/**
 * Address suggestions for the request form.
 *
 * Two services are consulted because neither is sufficient alone:
 *
 *   * Nominatim, the OpenStreetMap search service, is the source that carries
 *     real US house numbers ("740 W Market St", not "W Market St"), which is
 *     the part a customer most needs right. It sends no CORS header, so a
 *     browser cannot call it directly;
 *   * Photon, the OpenStreetMap-based street service, answers quickly while the
 *     customer is still typing, but for many US homes it has the street and not
 *     the house number.
 *
 * This route runs on the server, where both can be called with the descriptive
 * User-Agent Nominatim's usage policy asks for, and hands the browser one
 * merged list: confirmed house numbers first, then streets to keep suggestions
 * coming mid-typing.
 */

export const dynamic = "force-dynamic";

const NOMINATIM =
  "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=us&q=";
const PHOTON = "https://photon.komoot.io/api/?limit=6&lang=en&q=";
// Nominatim's usage policy asks for a way to contact the caller, and it is
// needed from a datacentre address or the request is refused.
const USER_AGENT = `FixIt/1.0 (${SITE_URL}; ${SITE_EMAIL})`;

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    // A slow or unreachable service must not stop the other one answering.
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < MIN_LOOKUP_LENGTH) {
    return NextResponse.json({ suggestions: [] });
  }

  const [nominatim, photon] = await Promise.all([
    fetchJson(NOMINATIM + encodeURIComponent(query), 7000),
    fetchJson(PHOTON + encodeURIComponent(query), 6000),
  ]);

  // Nominatim results with a house number are the answer; the ones without are
  // street-level and kept only to fill in while typing. Photon backs both up
  // when Nominatim is slow or cannot answer.
  const places = parseNominatimSuggestions(nominatim);
  const confirmed: AddressSuggestion[] = places.filter((suggestion) => hasHouseNumber(suggestion.line1));
  const streets: AddressSuggestion[] = [
    ...places.filter((suggestion) => !hasHouseNumber(suggestion.line1)),
    ...parseAddressSuggestions(photon).map((suggestion) => keepTypedHouseNumber(query, suggestion)),
  ];

  // A confirmed house number is the answer; streets only fill in while the
  // customer is still typing something no service can match yet.
  const suggestions = chooseSuggestions(confirmed, streets);
  return NextResponse.json(
    { suggestions },
    // A short cache keeps repeated lookups of the same text off both services.
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
