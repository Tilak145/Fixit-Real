import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chooseSuggestions,
  hasHouseNumber,
  keepTypedHouseNumber,
  parseNominatimPlace,
  parseNominatimSuggestions,
} from '../lib/address.ts';

test('a Nominatim result keeps the real house number', () => {
  const out = parseNominatimSuggestions([
    { osm_type: 'way', osm_id: 1, address: { house_number: '740', road: 'West Market Street', city: 'Akron', state: 'Ohio', postcode: '44303', country_code: 'us' } },
    { osm_type: 'way', osm_id: 2, address: { house_number: '3400', road: 'Massillon Road', city: 'Akron', state: 'Ohio', postcode: '44312', country_code: 'us' } },
  ]);
  assert.deepEqual(out.map(s => s.label), [
    '740 West Market Street, Akron, OH 44303',
    '3400 Massillon Road, Akron, OH 44312',
  ]);
  assert.equal(out[0].line1, '740 West Market Street');
  assert.equal(out[0].cityLabel, 'Akron, OH');
  assert.equal(out[0].postcode, '44303');
});

test('a town or village stands in for the city when there is none', () => {
  const out = parseNominatimSuggestions([
    { address: { house_number: '12', road: 'Main St', town: 'Copley', state: 'Ohio', country_code: 'us' } },
    { address: { house_number: '5', road: 'Elm St', village: 'Richfield', state: 'Ohio', country_code: 'us' } },
  ]);
  assert.equal(out[0].cityLabel, 'Copley, OH');
  assert.equal(out[1].cityLabel, 'Richfield, OH');
});

test('a street with no house number is still shown while typing', () => {
  const out = parseNominatimSuggestions([
    { address: { road: 'Ghent Road', city: 'Akron', state: 'Ohio', postcode: '44333', country_code: 'us' } },
  ]);
  assert.equal(out.length, 1);
  assert.equal(hasHouseNumber(out[0].line1), false);
});

test('malformed responses yield nothing', () => {
  assert.deepEqual(parseNominatimSuggestions(null), []);
  assert.deepEqual(parseNominatimSuggestions({}), []);
  assert.deepEqual(parseNominatimSuggestions([]), []);
  // No city, no street, or a foreign country is not offered.
  assert.deepEqual(parseNominatimSuggestions([{ address: { road: 'Main St', state: 'Ohio' } }]), []);
  assert.deepEqual(parseNominatimSuggestions([{ address: { city: 'Akron', state: 'Ohio' } }]), []);
  assert.deepEqual(
    parseNominatimSuggestions([{ address: { road: 'Rue de Paris', city: 'Paris', country_code: 'fr' } }]),
    [],
  );
  assert.equal(parseNominatimPlace({}), null);
});

test('a confirmed house number is shown alone, without conflicting streets', () => {
  const confirmed = parseNominatimSuggestions([
    { address: { house_number: '740', road: 'West Market Street', city: 'Akron', state: 'Ohio', country_code: 'us' } },
  ]);
  const streets = parseNominatimSuggestions([
    { address: { house_number: '492', road: 'West Market Street', city: 'Akron', state: 'Ohio', country_code: 'us' } },
  ]);
  const shown = chooseSuggestions(confirmed, streets);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].line1, '740 West Market Street');
});

test('while typing, before a house number can be matched, streets are shown', () => {
  const streets = parseNominatimSuggestions([
    { address: { road: 'West Market Street', city: 'Akron', state: 'Ohio', country_code: 'us' } },
  ]);
  const shown = chooseSuggestions([], streets);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].line1, 'West Market Street');
});

test('a typed house number is not lost when the result omits it', () => {
  const streets = parseNominatimSuggestions([
    { address: { road: 'West Market Street', city: 'Akron', state: 'Ohio', postcode: '44303', country_code: 'us' } },
  ]);
  const kept = keepTypedHouseNumber('740 W Market St Akron', streets[0]);
  assert.equal(kept.line1, '740 West Market Street');
  assert.equal(kept.label, '740 West Market Street, Akron, OH 44303');
});

test('house numbers are recognised in a line of text', () => {
  assert.equal(hasHouseNumber('740 W Market St'), true);
  assert.equal(hasHouseNumber('12A Elm Rd'), true);
  assert.equal(hasHouseNumber('W Market St'), false);
});
