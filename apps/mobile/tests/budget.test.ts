import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDollarsToCents, presetRange, formatBudgetRange, validateBudgetRange } from '../lib/budget.ts';

test('a typed amount becomes cents', () => {
  assert.equal(parseDollarsToCents('1200'), 120_000);
  assert.equal(parseDollarsToCents('$1,200'), 120_000);
});

test('a blank amount is no budget', () => {
  assert.equal(parseDollarsToCents(''), null);
  assert.equal(parseDollarsToCents(null), null);
});

test('a preset becomes a range', () => {
  assert.deepEqual(presetRange('250-500'), { minCents: 25_000, maxCents: 50_000 });
  assert.deepEqual(presetRange('2500-plus'), { minCents: 250_000, maxCents: null });
  assert.deepEqual(presetRange('unknown'), { minCents: null, maxCents: null });
});

test('a range reads plainly', () => {
  assert.equal(formatBudgetRange({ minCents: 50_000, maxCents: 100_000 }), '$500 to $1,000');
  assert.equal(formatBudgetRange(null), 'Budget not given');
});

test('a backwards range is caught', () => {
  assert.ok(validateBudgetRange(100_000, 50_000));
  assert.equal(validateBudgetRange(50_000, 100_000), null);
});

