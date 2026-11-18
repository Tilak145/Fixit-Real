/**
 * FixIt address lookup for the Android app.
 *
 * The app asks the project's own lookup function, which runs the OpenStreetMap
 * search service (Nominatim) on the server. Nominatim is the source that carries
 * real US house numbers, but it sends no CORS header and asks for a descriptive
 * User-Agent, so it cannot be called from the device directly; the function
 * answers with one merged list and keeps the phone off two third parties.
 *
 * The parsing is pure so it can be tested in Node, and nothing here invents an
 * address: a suggestion is only offered when a service returned one.
 */

export interface AddressSuggestion {
  /** The readable address saved to the request and shown to the customer. */
  label: string;
  line1: string;
  /** The city on its own, e.g. "Akron". */
  city: string;
  /** The city as the app matches on, e.g. "Akron, OH". */
  cityLabel: string;
  state: string;
  postcode: string;
  key: string;
}

export const MIN_LOOKUP_LENGTH = 4;

/** The subset of a Nominatim place this module reads. */
interface NominatimAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  state?: string;
  postcode?: string;
  country_code?: string;
}

interface NominatimPlace {
  osm_type?: string;
  osm_id?: number;
  address?: NominatimAddress;
}

const STATE_CODES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'district of columbia': 'DC',
};

function shortState(state: string): string {
  if (state.length <= 2) return state.toUpperCase();
  return STATE_CODES[state.toLowerCase()] ?? state;
}

/** A street line that begins with a house number. */
export function hasHouseNumber(line: string): boolean {
  return /^\s*\d+[A-Za-z]?\b/u.test(line);
}

/**
 * Read one Nominatim place into a suggestion. A place is only usable when it
 * names a street and a city: the city is what the request is matched on, and an
 * address without one would reach no professional.
 */
export function parseNominatimPlace(place: NominatimPlace): AddressSuggestion | null {
  const address = place?.address;
  if (!address) return null;
  if (address.country_code && address.country_code.toLowerCase() !== 'us') return null;

  const house = (address.house_number ?? '').trim();
  const road = (address.road ?? address.pedestrian ?? '').trim();
  const line1 = [house, road].filter(Boolean).join(' ').trim();
  const city = (address.city ?? address.town ?? address.village ?? address.hamlet ?? address.municipality ?? '').trim();
  if (!line1 || !city) return null;

  const state = shortState((address.state ?? '').trim());
  const postcode = (address.postcode ?? '').trim();
  const stateZip = [state, postcode].filter(Boolean).join(' ');
  const label = [line1, [city, stateZip].filter(Boolean).join(', ')].filter(Boolean).join(', ');

  return {
    label,
    line1,
    city,
    cityLabel: [city, state].filter(Boolean).join(', '),
    state,
    postcode,
    key: 'nominatim-' + (place.osm_type ?? '') + '-' + (place.osm_id ?? label),
  };
}

/**
 * Read a Nominatim response into suggestions. Results without a house number
 * are kept too: they are the street-level fallback while the customer is still
 * typing, and the caller decides which of the two to show.
 */
export function parseNominatimSuggestions(body: unknown, limit = 5): AddressSuggestion[] {
  const places = Array.isArray(body) ? (body as NominatimPlace[]) : [];
  const out: AddressSuggestion[] = [];
  const seen = new Set<string>();
  for (const place of places) {
    const suggestion = parseNominatimPlace(place);
    if (!suggestion) continue;
    const dedupeKey = suggestion.label.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(suggestion);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Choose what to show the customer. A confirmed house number is the address
 * they are typing, so when there is one it is the whole answer: adding
 * street-level results beside it would offer a different house number on the
 * same street and read as the app disagreeing with itself. Street-level results
 * are the fallback for the mid-typing moment the geocoder cannot match yet.
 */
export function chooseSuggestions(
  confirmed: AddressSuggestion[],
  streets: AddressSuggestion[],
  limit = 6,
): AddressSuggestion[] {
  const source = confirmed.length > 0 ? confirmed : streets;
  const out: AddressSuggestion[] = [];
  const seen = new Set<string>();
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
export function keepTypedHouseNumber(typed: string, suggestion: AddressSuggestion): AddressSuggestion {
  const typedNumber = /^\s*(\d+[A-Za-z]?)\b/u.exec(typed.trim())?.[1];
  if (!typedNumber || hasHouseNumber(suggestion.line1)) return suggestion;
  const line1 = typedNumber + ' ' + suggestion.line1;
  return { ...suggestion, line1, label: line1 + ', ' + suggestion.cityLabel + ' ' + suggestion.postcode };
}
