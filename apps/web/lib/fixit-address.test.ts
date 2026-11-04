import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAddressSuggestions,
  parseNominatimSuggestions,
  formatNominatimPlace,
  formatSuggestion,
  keepTypedHouseNumber,
  mergeSuggestions,
  hasHouseNumber,
  chooseSuggestions,
} from "./fixit-address.ts";

test("formats a US address the way the app stores it", () => {
  const s = formatSuggestion({
    osm_type: "W",
    osm_id: 1,
    housenumber: "123",
    street: "N Main St",
    city: "Akron",
    state: "Ohio",
    postcode: "44308",
    countrycode: "us",
  });
  assert.equal(s?.label, "123 N Main St, Akron, OH 44308");
  assert.equal(s?.line1, "123 N Main St");
  assert.equal(s?.city, "Akron");
  assert.equal(s?.state, "OH");
  // Service areas are stored as "Akron, OH", so a picked address must produce
  // the same shape or the request would match no professional.
  assert.equal(s?.cityLabel, "Akron, OH");
});

test("falls back to the locality when the service has no city", () => {
  const s = formatSuggestion({ street: "Ellet Ave", locality: "Ellet", state: "OH" });
  assert.equal(s?.city, "Ellet");
  assert.equal(s?.cityLabel, "Ellet, OH");
  assert.equal(s?.label, "Ellet Ave, Ellet, OH");
});

test("a named place with no street is still usable", () => {
  const s = formatSuggestion({ name: "Akron Civic Theatre", city: "Akron", state: "Ohio" });
  assert.equal(s?.line1, "Akron Civic Theatre");
  assert.equal(s?.label, "Akron Civic Theatre, Akron, OH");
});

test("a suggestion without a street or a city is dropped", () => {
  assert.equal(formatSuggestion({ state: "Ohio", postcode: "44308" }), null);
  assert.equal(formatSuggestion({ street: "N Main St" }), null);
});

test("keeps only US addresses, drops duplicates, and respects the limit", () => {
  const body = {
    features: [
      { properties: { street: "A St", city: "Akron", state: "Ohio", countrycode: "us", osm_id: 1 } },
      { properties: { street: "A St", city: "Akron", state: "Ohio", countrycode: "us", osm_id: 2 } },
      { properties: { street: "Rue de Paris", city: "Paris", state: "Ile-de-France", countrycode: "fr", osm_id: 3 } },
      { properties: { street: "B St", city: "Akron", state: "Ohio", countrycode: "us", osm_id: 4 } },
    ],
  };
  const out = parseAddressSuggestions(body);
  assert.deepEqual(out.map((s) => s.label), ["A St, Akron, OH", "B St, Akron, OH"]);
  assert.equal(parseAddressSuggestions(body, 1).length, 1);
});

test("an empty or malformed response yields no suggestions", () => {
  assert.deepEqual(parseAddressSuggestions(null), []);
  assert.deepEqual(parseAddressSuggestions({}), []);
  assert.deepEqual(parseAddressSuggestions({ features: [] }), []);
});

test("the Nominatim results keep the real house number", () => {
  const body = [
    {
      osm_type: "way",
      osm_id: 780752298,
      address: {
        house_number: "740",
        road: "West Market Street",
        city: "Akron",
        state: "Ohio",
        postcode: "44303",
        country_code: "us",
      },
    },
    {
      osm_type: "way",
      osm_id: 2,
      address: {
        house_number: "3400",
        road: "Massillon Road",
        city: "Akron",
        state: "Ohio",
        postcode: "44312",
        country_code: "us",
      },
    },
  ];
  const out = parseNominatimSuggestions(body);
  assert.deepEqual(out.map((s) => s.label), [
    "740 West Market Street, Akron, OH 44303",
    "3400 Massillon Road, Akron, OH 44312",
  ]);
  assert.equal(out[0].line1, "740 West Market Street");
  assert.equal(out[0].city, "Akron");
  assert.equal(out[0].cityLabel, "Akron, OH");
  assert.equal(out[0].postcode, "44303");
});

test("a town or village stands in for the city when Nominatim has no city", () => {
  const out = parseNominatimSuggestions([
    { address: { house_number: "12", road: "Main St", town: "Copley", state: "Ohio", country_code: "us" } },
    { address: { house_number: "5", road: "Elm St", village: "Richfield", state: "Ohio", country_code: "us" } },
  ]);
  assert.equal(out[0].cityLabel, "Copley, OH");
  assert.equal(out[1].cityLabel, "Richfield, OH");
});

test("a street with no house number is still a usable suggestion", () => {
  const out = parseNominatimSuggestions([
    { address: { road: "Ghent Road", city: "Akron", state: "Ohio", postcode: "44333", country_code: "us" } },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].line1, "Ghent Road");
  assert.equal(hasHouseNumber(out[0].line1), false);
});

test("malformed Nominatim responses yield nothing", () => {
  assert.deepEqual(parseNominatimSuggestions(null), []);
  assert.deepEqual(parseNominatimSuggestions({}), []);
  assert.deepEqual(parseNominatimSuggestions([]), []);
  // No city, no street, or a foreign country is not offered.
  assert.deepEqual(parseNominatimSuggestions([{ address: { road: "Main St", state: "Ohio" } }]), []);
  assert.deepEqual(parseNominatimSuggestions([{ address: { city: "Akron", state: "Ohio" } }]), []);
  assert.deepEqual(
    parseNominatimSuggestions([{ address: { road: "Rue de Paris", city: "Paris", country_code: "fr" } }]),
    [],
  );
  assert.equal(formatNominatimPlace({}), null);
});

test("confirmed house numbers come before street-only suggestions", () => {
  const confirmed = parseNominatimSuggestions([
    { address: { house_number: "740", road: "West Market Street", city: "Akron", state: "Ohio", country_code: "us" } },
  ]);
  const street = formatSuggestion({ street: "W Market St", city: "Akron", state: "Ohio", postcode: "44303" })!;
  const merged = mergeSuggestions(confirmed, [street]);
  assert.equal(merged[0].line1, "740 West Market Street");
  assert.equal(merged.length, 2);
});

test("merging drops exact duplicates and respects the limit", () => {
  const a = formatSuggestion({ housenumber: "1", street: "A St", city: "Akron", state: "Ohio" })!;
  const b = formatSuggestion({ housenumber: "2", street: "B St", city: "Akron", state: "Ohio" })!;
  assert.equal(mergeSuggestions([a], [a, b], 1).length, 1);
  assert.equal(mergeSuggestions([a], [b]).length, 2);
});

test("a typed house number is not lost when the street service omits it", () => {
  const streetOnly = formatSuggestion({ street: "W Market St", city: "Akron", state: "Ohio", postcode: "44303" })!;
  const kept = keepTypedHouseNumber("740 W Market St Akron", streetOnly);
  assert.equal(kept.line1, "740 W Market St");
  assert.equal(kept.label, "740 W Market St, Akron, OH 44303");

  // A suggestion that already carries a house number is left alone.
  const withNumber = formatSuggestion({ housenumber: "492", street: "W Market St", city: "Akron", state: "Ohio" })!;
  assert.equal(keepTypedHouseNumber("740 W Market St", withNumber).line1, "492 W Market St");
});

test("house numbers are recognised in a line of text", () => {
  assert.equal(hasHouseNumber("740 W Market St"), true);
  assert.equal(hasHouseNumber("12A Elm Rd"), true);
  assert.equal(hasHouseNumber("W Market St"), false);
  assert.equal(hasHouseNumber("Akron Civic Theatre"), false);
});

test("a confirmed match is shown on its own, without conflicting streets", () => {
  const confirmed = parseNominatimSuggestions([
    { address: { house_number: "740", road: "West Market Street", city: "Akron", state: "Ohio", country_code: "us" } },
  ]);
  const street = formatSuggestion({ housenumber: "492", street: "West Market Street", city: "Akron", state: "Ohio" })!;
  const shown = chooseSuggestions(confirmed, [street]);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].line1, "740 West Market Street");
});

test("while typing, before a house number can be matched, streets are shown", () => {
  const street = formatSuggestion({ street: "West Market Street", city: "Akron", state: "Ohio" })!;
  const shown = chooseSuggestions([], [street]);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].line1, "West Market Street");
});
