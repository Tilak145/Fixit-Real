import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCity } from '../lib/city-choice.ts';

const active = ['Akron, OH', 'Cuyahoga Falls, OH'];

test('the remembered city wins when it is still served', () => {
  assert.equal(resolveCity(active, 'Cuyahoga Falls, OH'), 'Cuyahoga Falls, OH');
});

test('with nothing remembered the first city the owner offers is used', () => {
  assert.equal(resolveCity(active, null), 'Akron, OH');
  assert.equal(resolveCity(active, undefined), 'Akron, OH');
});

test('a remembered city that is no longer served is ignored', () => {
  assert.equal(resolveCity(active, 'Stow, OH'), 'Akron, OH');
});

test('with no cities at all there is no city', () => {
  assert.equal(resolveCity([], 'Akron, OH'), null);
});
