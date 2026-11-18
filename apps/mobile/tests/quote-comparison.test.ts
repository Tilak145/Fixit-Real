import assert from 'node:assert/strict';
import test from 'node:test';
import { formatQuoteCents, partsMatchTotal, quoteGaps, quoteLines, validity } from '../lib/quote-comparison.ts';

test('only the parts actually charged are listed', () => {
  const labels = quoteLines({ amount_cents: 50000, labour_cents: 40000, materials_cents: 10000 }).map(
    line => line.label,
  );
  assert.deepEqual(labels, ['Labour', 'Materials']);
});

test('an unnamed other charge reads plainly, a named one keeps its name', () => {
  assert.equal(quoteLines({ amount_cents: 1000, other_cents: 1000 })[0].label, 'Other');
  assert.equal(
    quoteLines({ amount_cents: 1000, other_cents: 1000, other_label: 'Permit' })[0].label,
    'Permit',
  );
});

test('the parts must add up to the total', () => {
  assert.equal(partsMatchTotal({ amount_cents: 50000, labour_cents: 50000 }), true);
  assert.equal(partsMatchTotal({ amount_cents: 50000, labour_cents: 40000 }), false);
});

test('a labour-only quote still lists the questions worth asking', () => {
  const gaps = quoteGaps({ amount_cents: 40000, labour_cents: 40000 });
  assert.equal(gaps.length, 5);
  assert.ok(gaps.some(gap => gap.includes('Materials')));
});

test('a complete quote has nothing to ask about', () => {
  const gaps = quoteGaps({
    amount_cents: 50000,
    labour_cents: 40000,
    materials_cents: 10000,
    earliest_start: '2026-11-02',
    completion_note: 'About four hours',
    warranty: '12 months on labour',
    payment_terms: 'Half on arrival, half on completion',
  });
  assert.deepEqual(gaps, []);
});

test('validity includes the last day, and is absent with no date', () => {
  const now = new Date('2026-11-10T09:00:00Z');
  assert.equal(validity({ amount_cents: 1 }, now), 'none');
  assert.equal(validity({ amount_cents: 1, valid_until: '2026-11-10' }, now), 'valid');
  assert.equal(validity({ amount_cents: 1, valid_until: '2026-11-09' }, now), 'expired');
});

test('money is shown in whole cents, never rounded away', () => {
  assert.equal(formatQuoteCents(52500), '$525.00');
  assert.equal(formatQuoteCents(5), '$0.05');
});
