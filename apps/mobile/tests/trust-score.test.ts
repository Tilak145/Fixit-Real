import assert from 'node:assert/strict';
import test from 'node:test';
import { isVerified, trustScore, type TrustEvidence } from '../lib/trust-score.ts';

const NOW = new Date('2026-10-27T12:00:00Z');

function evidence(overrides: Partial<TrustEvidence> = {}): TrustEvidence {
  return {
    licenseChecked: false,
    insuranceChecked: false,
    insuranceOnFile: false,
    verifiedJobs: 0,
    unverifiedJobs: 0,
    medianResponseHours: null,
    visitsCompleted: 0,
    visitsCancelled: 0,
    quotesSent: 0,
    reviewCount: 0,
    reviewAverage: 0,
    lastReviewAt: null,
    disputesRaised: 0,
    upheldComplaints: 0,
    joinedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

test('an unproven professional scores zero rather than being flattered', () => {
  const result = trustScore(evidence(), NOW);
  assert.equal(result.score, 0);
  assert.equal(result.level, 'new');
  assert.equal(result.checksPassed, 0);
});

test('one check is never enough for the verified badge', () => {
  assert.equal(isVerified(evidence()), false);
  assert.equal(isVerified(evidence({ licenseChecked: true })), false);
  assert.equal(isVerified(evidence({ insuranceChecked: true })), false);
  assert.equal(isVerified(evidence({ licenseChecked: true, insuranceChecked: true })), true);
});

test('a reported job is not counted as a completed job', () => {
  const reported = trustScore(evidence({ unverifiedJobs: 2 }), NOW);
  const confirmed = trustScore(evidence({ verifiedJobs: 2 }), NOW);
  assert.ok(confirmed.score > reported.score);
});

test('a perfect record can reach one hundred and no further', () => {
  const result = trustScore(
    evidence({
      licenseChecked: true,
      insuranceChecked: true,
      verifiedJobs: 10,
      visitsCompleted: 10,
      medianResponseHours: 1,
      reviewCount: 20,
      reviewAverage: 5,
      lastReviewAt: '2026-10-20T00:00:00Z',
    }),
    NOW,
  );
  assert.equal(result.score, 100);
  assert.equal(result.level, 'highly-trusted');
});

test('only upheld complaints count against anyone', () => {
  const clean = trustScore(evidence({ verifiedJobs: 3, disputesRaised: 3 }), NOW);
  const upheld = trustScore(evidence({ verifiedJobs: 3, upheldComplaints: 1 }), NOW);
  assert.ok(upheld.score < clean.score);
  assert.equal(clean.factors.some(factor => factor.key === 'complaints'), false);
});
