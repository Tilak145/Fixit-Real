import assert from 'node:assert/strict';
import test from 'node:test';
import { asCustomerNumber } from '../lib/customer-number-value.ts';

test('accepts the six-digit numbers the database issues', () => {
  assert.equal(asCustomerNumber(552376), 552376);
  assert.equal(asCustomerNumber(100000), 100000);
  assert.equal(asCustomerNumber(999999), 999999);
  assert.equal(asCustomerNumber('488543'), 488543);
});

test('never shows a business number or anything out of range as a customer number', () => {
  for (const value of [432502742, 99999, 1000000, 0, -552376, null, undefined, '', 'abc', 1.5, NaN]) {
    assert.equal(asCustomerNumber(value), null, `expected ${String(value)} to be refused`);
  }
});
