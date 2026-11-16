/**
 * How a city is written when the owner adds one.
 *
 * A city's label ("Akron, OH") is its identity: requests and service areas
 * store it and matching is an exact compare. So the owner types only the name
 * and picks the state, and the label is always built here, the same way.
 */

export const US_STATES: [code: string, name: string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];

export function stateName(code: string): string | null {
  return US_STATES.find(([c]) => c === code.trim().toUpperCase())?.[1] ?? null;
}

/**
 * Tidy what the owner typed into a city name: "  cuyahoga   falls, oh " becomes
 * "Cuyahoga Falls". A state typed after a comma is dropped, since the state is
 * picked separately. Capitals the owner typed inside a word ("McDonald") stay.
 */
export function cleanCityName(typed: string): string {
  const name = typed.split(",")[0].replace(/\s+/gu, " ").trim();
  return name
    .split(" ")
    .map((word) => word.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("-"))
    .join(" ");
}

/** The stored label: "Akron, OH". Empty when there is no usable name or state. */
export function cityLabel(typed: string, state: string): string {
  const name = cleanCityName(typed);
  const code = state.trim().toUpperCase();
  if (name.length < 2 || !stateName(code)) return "";
  return `${name}, ${code}`;
}

/** Whether a label is already on the list, ignoring capitals and spacing. */
export function cityAlreadyListed(label: string, existing: string[]): boolean {
  const key = (value: string) => value.toLowerCase().replace(/\s+/gu, "");
  return existing.some((item) => key(item) === key(label));
}
