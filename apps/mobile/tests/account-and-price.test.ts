import assert from 'node:assert/strict';
import test from 'node:test';
import { authReducer, initialAuthState } from '../lib/auth-state.ts';
import { priceLabel } from '../lib/price.ts';

test('sign-up confirmation preserves its resend purpose through errors and retries', () => {
  let state = authReducer(initialAuthState, { type: 'mode', mode: 'register' });
  state = authReducer(state, { type: 'pending' });
  assert.equal(state.pending, true);
  state = authReducer(state, { type: 'done', message: 'Check email', code: true });
  assert.equal(state.mode, 'code');
  assert.equal(state.signupCode, true);
  state = authReducer(state, { type: 'error', message: 'Expired code' });
  assert.equal(state.pending, false);
  assert.equal(state.mode, 'code');
  state = authReducer(state, { type: 'pending' });
  assert.equal(state.message, null);
  state = authReducer(state, { type: 'done', message: 'Resent' });
  assert.equal(state.signupCode, true);
  assert.equal(state.pending, false);
  assert.deepEqual(authReducer(state, { type: 'signed-out' }), initialAuthState);
});

test('passwordless sign-in resends a login code rather than registering another account', () => {
  const state = authReducer(initialAuthState, { type: 'done', message: 'Check email', code: false });
  assert.equal(state.mode, 'code');
  assert.equal(state.signupCode, false);
});

test('prices honor Stripe minor units and the API recurring fields', () => {
  assert.match(priceLabel({ currency: 'usd', unitAmount: 499, recurringInterval: 'month', recurringIntervalCount: 3 }), /4\.99.* \/ 3 months$/);
  assert.match(priceLabel({ currency: 'jpy', unitAmount: 499 }), /499/);
  assert.doesNotMatch(priceLabel({ currency: 'jpy', unitAmount: 499 }), /4\.99/);
  assert.match(priceLabel({ currency: 'ugx', unitAmount: 10000 }), /100\.00/);
});
