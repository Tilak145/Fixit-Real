import { NextRequest, NextResponse } from "next/server";
import { SITE_EMAIL, SITE_URL } from "@/lib/site-contact";
import { cleanCityName, stateName } from "@/lib/city-label";

/**
 * Where a city is, for the owner's "Add a city" screen.
 *
 * The owner types a name and picks a state; this looks the place up so the
 * city's map position (used to send an emergency to the nearest crew) is filled
 * in without anyone typing coordinates. Nominatim sends no CORS header and asks
 * for a descriptive User-Agent, so the lookup runs here on the server.
 */

export const dynamic = "force-dynamic";

const NOMINATIM = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=us";
const USER_AGENT = `FixIt/1.0 (${SITE_URL}; ${SITE_EMAIL})`;

interface Place {
  lat?: string;
  lon?: string;
  name?: string;
  addresstype?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const name = cleanCityName(request.nextUrl.searchParams.get("name") ?? "");
  const state = stateName(request.nextUrl.searchParams.get("state") ?? "");
  if (name.length < 2 || name.length > 60 || !state) {
    return NextResponse.json({ found: false });
  }
  try {
    const response = await fetch(
      `${NOMINATIM}&city=${encodeURIComponent(name)}&state=${encodeURIComponent(state)}`,
      {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        cache: "no-store",
        signal: AbortSignal.timeout(7000),
      },
    );
    if (!response.ok) return NextResponse.json({ found: false });
    const body = (await response.json()) as Place[];
    const place = Array.isArray(body) ? body[0] : undefined;
    const lat = Number(place?.lat);
    const lng = Number(place?.lon);
    if (!place || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ found: false });
    }
    return NextResponse.json(
      { found: true, name: place.name || name, lat, lng },
      { headers: { "cache-control": "public, max-age=3600" } },
    );
  } catch {
    // The lookup is a convenience: the city can still be added without it.
    return NextResponse.json({ found: false });
  }
}
