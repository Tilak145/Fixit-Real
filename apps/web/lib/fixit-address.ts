/**
 * FixIt address lookup — turning what a customer types into the full, correct
 * street address.
 *
 * A half-typed address is the single most common reason a lead reaches the
 * wrong professionals: the request is matched to pros by city, so "123 Main"
 * with no city is unusable. This module turns the response of the Nominatim
 * geocoder — the OpenStreetMap search service that carries real US house
 * numbers — into a short list of suggestions the customer can pick from, and
 * formats the chosen one the way the rest of the app stores addresses
 * ("123 N Main St, Akron, OH 44308").
 *
 * The parsing is kept apart from the network call so it can be tested without
 * a browser, and nothing here invents an address: a suggestion is only offered
 * when the service returned one.
 */

export interface AddressSuggestion {
  /** The readable address shown to the customer and saved to their profile. */
  label: string;
  /** Street number and street name, e.g. "123 N Main St". */
  line1: string;
  /** The city/town on its own, e.g. "Akron". */
  city: string;
  /**
   * The city in the form the app matches on, e.g. "Akron, OH". Service areas
   * are stored with the state, and leads are matched by an exact city, so a
   * picked address must produce the same shape or the request reaches nobody.
   */
  cityLabel: string;
  /** Two-letter state code where the service provides one. */
  state: string;
  postcode: string;
  /** Stable identity so React keys do not collide on repeated picks. */
  key: string;
  /**
   * Where the place is. Used only to route an emergency to the nearest crew;
   * the customer's exact point is never shown to a professional.
   */
  lat?: number | null;
  lng?: number | null;
}

/** The subset of a Photon feature this module reads. */
interface PhotonProperties {
  osm_type?: string;
  osm_id?: number;
  housenumber?: string;
  street?: string;
  name?: string;
  city?: string;
  locality?: string;
  district?: string;
  county?: string;
  state?: string;
  postcode?: string;
  countrycode?: string;
}

interface PhotonFeature {
  properties?: PhotonProperties;
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

/**
 * The readable address for one suggestion. Deliberately omits neighbourhood and
 * county: a customer reads "123 N Main St, Akron, OH 44308", not the census
 * hierarchy, and the shorter form is what a professional wants on the job sheet.
 */
export function formatSuggestion(props: PhotonProperties): AddressSuggestion | null {
  const street = (props.street ?? "").trim();
  const house = (props.housenumber ?? "").trim();
  // A named place with no street (a business, a building) still gives the city.
  const line1 = [house, street].filter(Boolean).join(" ").trim() || (props.name ?? "").trim();
  const city = (props.city ?? props.locality ?? props.district ?? "").trim();
  if (!line1 || !city) return null;

  const state = (props.state ?? "").trim();
  const postcode = (props.postcode ?? "").trim();
  const stateZip = [shortState(state), postcode].filter(Boolean).join(" ");
  // The display label is also the stored address: one place, one format.
  const label = [line1, [city, stateZip].filter(Boolean).join(", ")].filter(Boolean).join(", ");

  return {
    label,
    line1,
    city,
    cityLabel: [city, shortState(state)].filter(Boolean).join(", "),
    state: shortState(state),
    postcode,
    key: `${props.osm_type ?? ""}-${props.osm_id ?? label}`,
  };
}

/**
 * Photon returns the full state name ("Ohio"); the app stores the two-letter
 * code, which is also what a US postal address shows. A value that is already
 * short is passed through unchanged.
 */
const STATE_CODES: Record<string, string> = {
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

function shortState(state: string): string {
  if (state.length <= 2) return state.toUpperCase();
  return STATE_CODES[state.toLowerCase()] ?? state;
}

/**
 * Read a geocoder response into suggestions, keeping only usable US addresses
 * and dropping duplicates, which the service returns when several sources
 * describe the same building.
 */
export function parseAddressSuggestions(body: unknown, limit = 5): AddressSuggestion[] {
  const features = (body as PhotonResponse)?.features ?? [];
  const out: AddressSuggestion[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    const props = feature?.properties;
    if (!props) continue;
    if (props.countrycode && props.countrycode.toLowerCase() !== "us") continue;
    const suggestion = formatSuggestion(props);
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
 * A lookup is worth making once the customer has typed something specific
 * enough to narrow a street: below this it would return arbitrary matches.
 */
export const MIN_LOOKUP_LENGTH = 4;

/**
 * The subset of a Nominatim place this module reads. Nominatim is the
 * OpenStreetMap search service, and it is the source that carries real US house
 * numbers, either on the building itself or on its address range.
 */
export interface NominatimAddress {
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

export interface NominatimPlace {
  osm_type?: string;
  osm_id?: number;
  type?: string;
  /** Latitude and longitude as strings, the way the service sends them. */
  lat?: string;
  lon?: string;
  address?: NominatimAddress;
}

/** A street line that begins with a house number, e.g. "740 W Market St". */
export function hasHouseNumber(line: string): boolean {
  return /^\s*\d+[A-Za-z]?\b/u.test(line);
}

/**
 * Read one Nominatim place into a suggestion. A place is only usable when it
 * names a street and a city: the city is what the request is matched on, and an
 * address without one would reach no professional.
 */
export function formatNominatimPlace(place: NominatimPlace): AddressSuggestion | null {
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
  // The display label is also the stored address: one place, one format.
  const label = [line1, [city, stateZip].filter(Boolean).join(", ")].filter(Boolean).join(", ");

  const lat = Number.parseFloat(place.lat ?? "");
  const lng = Number.parseFloat(place.lon ?? "");
  return {
    label,
    line1,
    city,
    cityLabel: [city, state].filter(Boolean).join(", "),
    state,
    postcode,
    key: "nominatim-" + (place.osm_type ?? "") + "-" + (place.osm_id ?? label),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
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
    const suggestion = formatNominatimPlace(place);
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
 * Combine the two sources, keeping the order given: the house-number matches
 * come first, then whatever the street-level service found. Exact duplicates
 * are dropped.
 */
export function mergeSuggestions(
  primary: AddressSuggestion[],
  secondary: AddressSuggestion[],
  limit = 6,
): AddressSuggestion[] {
  const out: AddressSuggestion[] = [];
  const seen = new Set<string>();
  for (const suggestion of [...primary, ...secondary]) {
    const key = suggestion.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(suggestion);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Keep the house number the customer typed. The street-level service often has
 * no house number for a home, so without this a picked suggestion could drop
 * the "740" the customer had already entered.
 */
export function keepTypedHouseNumber(typed: string, suggestion: AddressSuggestion): AddressSuggestion {
  const typedNumber = /^\s*(\d+[A-Za-z]?)\b/u.exec(typed.trim())?.[1];
  if (!typedNumber) return suggestion;
  if (hasHouseNumber(suggestion.line1)) return suggestion;
  if (suggestion.line1.toLowerCase().includes(typedNumber)) return suggestion;
  const line1 = typedNumber + " " + suggestion.line1;
  return { ...suggestion, line1, label: line1 + ", " + suggestion.cityLabel + " " + suggestion.postcode };
}

/**
 * Choose what to show the customer. A confirmed house number is the address
 * they are typing, so when there is one it is the whole answer: adding
 * street-level results beside it would offer a different house number on the
 * same street ("492 W Market St" next to "740 W Market St") and read as the app
 * disagreeing with itself. Street-level results are the fallback for the
 * mid-typing moment the geocoder cannot match a house number yet.
 */
export function chooseSuggestions(
  confirmed: AddressSuggestion[],
  streets: AddressSuggestion[],
  limit = 6,
): AddressSuggestion[] {
  if (confirmed.length > 0) return mergeSuggestions(confirmed, [], limit);
  return mergeSuggestions(streets, [], limit);
}

/** The app's own endpoint, which consults both address services. */
export function addressApiUrl(query: string): string {
  return "/api/fixit/address?q=" + encodeURIComponent(query);
}

