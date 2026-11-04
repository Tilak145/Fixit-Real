// Address suggestions for the FixIt apps.
//
// The OpenStreetMap search service (Nominatim) is consulted because it is the
// source that carries real US house numbers — the part a customer most needs
// right ("740 W Market St", not "W Market St"). It sends no CORS header and
// asks for a descriptive User-Agent, so it cannot be called from a browser or
// from React Native directly; running on the server lets both apps use it and
// keeps the caller to one merged list: confirmed house numbers first, streets
// only while the customer is still typing.

const NOMINATIM =
  "https://nominatim.openstreetmap.org/search" +
  "?format=jsonv2&addressdetails=1&limit=6&countrycodes=us&q=";
const MIN_LOOKUP_LENGTH = 4;
// Nominatim's usage policy asks for a way to contact the caller, and it is
// needed from a datacentre address or the request is refused.
const USER_AGENT = "FixIt/1.0 (https://spk-920030597d19ec794a3e.exaspark.app; support@fixit.example)";

const STATE_CODES = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};

function shortState(state) {
  if (state.length <= 2) return state.toUpperCase();
  return STATE_CODES[state.toLowerCase()] ?? state;
}

function hasHouseNumber(line) {
  return /^\s*\d+[A-Za-z]?\b/u.test(line);
}

/** Read one Nominatim place into a suggestion, or null when unusable. */
function parsePlace(place) {
  const address = place?.address;
  if (!address) return null;
  if (address.country_code && address.country_code.toLowerCase() !== "us") return null;
  const house = (address.house_number ?? "").trim();
  const road = (address.road ?? address.pedestrian ?? "").trim();
  const line1 = [house, road].filter(Boolean).join(" ").trim();
  const city = (address.city ?? address.town ?? address.village ?? address.hamlet ?? address.municipality ?? "").trim();
  if (!line1 || !city) return null;
  const state = shortState((address.state ?? "").trim());
  const postcode = (address.postcode ?? "").trim();
  const stateZip = [state, postcode].filter(Boolean).join(" ");
  const label = [line1, [city, stateZip].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  // Coordinates are used only for emergency dispatch: the nearest crew first.
  const lat = Number.parseFloat(place?.lat ?? "");
  const lng = Number.parseFloat(place?.lon ?? "");
  return {
    label,
    line1,
    city,
    cityLabel: [city, state].filter(Boolean).join(", "),
    state,
    postcode,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    key: "nominatim-" + (place.osm_type ?? "") + "-" + (place.osm_id ?? label),
  };
}

function parseNominatim(body, limit = 5) {
  const places = Array.isArray(body) ? body : [];
  const out = [];
  const seen = new Set();
  for (const place of places) {
    const suggestion = parsePlace(place);
    if (!suggestion) continue;
    const dedupeKey = suggestion.label.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(suggestion);
    if (out.length >= limit) break;
  }
  return out;
}

/** A confirmed house number is the answer; streets only fill in while typing. */
function choose(confirmed, streets, limit = 6) {
  const source = confirmed.length > 0 ? confirmed : streets;
  const out = [];
  const seen = new Set();
  for (const suggestion of source) {
    const key = suggestion.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(suggestion);
    if (out.length >= limit) break;
  }
  return out;
}

/** Keep the house number the customer typed when a result omits it. */
function keepTypedHouseNumber(typed, suggestion) {
  const typedNumber = /^\s*(\d+[A-Za-z]?)\b/u.exec(typed.trim())?.[1];
  if (!typedNumber || hasHouseNumber(suggestion.line1)) return suggestion;
  const line1 = typedNumber + " " + suggestion.line1;
  return { ...suggestion, line1, label: line1 + ", " + suggestion.cityLabel + " " + suggestion.postcode };
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    // Unreachable or slow: the caller simply gets no suggestions.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query.length < MIN_LOOKUP_LENGTH) return json({ suggestions: [] });

  const places = parseNominatim(await fetchJson(NOMINATIM + encodeURIComponent(query), 8000));
  const confirmed = places.filter((suggestion) => hasHouseNumber(suggestion.line1));
  const streets = places
    .filter((suggestion) => !hasHouseNumber(suggestion.line1))
    .map((suggestion) => keepTypedHouseNumber(query, suggestion));

  return json({ suggestions: choose(confirmed, streets) });
});
