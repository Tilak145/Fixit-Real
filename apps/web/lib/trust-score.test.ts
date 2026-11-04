import assert from "node:assert/strict";
import test from "node:test";
import {
  isVerified,
  reviewRecencyWeight,
  trustScore,
  TRUST_LEVEL_LABEL,
  type TrustEvidence,
} from "./trust-score.ts";

const NOW = new Date("2026-10-27T12:00:00Z");

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
    joinedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

test("a professional with no evidence scores zero and is called new", () => {
  const result = trustScore(evidence(), NOW);
  assert.equal(result.score, 0);
  assert.equal(result.level, "new");
  assert.equal(result.checksPassed, 0);
  assert.equal(TRUST_LEVEL_LABEL[result.level], "New to FixIt");
});

test("nothing is called verified until both checks have actually passed", () => {
  assert.equal(isVerified(evidence()), false);
  // One check is not enough to carry the badge.
  assert.equal(isVerified(evidence({ licenseChecked: true })), false);
  assert.equal(isVerified(evidence({ insuranceChecked: true })), false);
  assert.equal(isVerified(evidence({ licenseChecked: true, insuranceChecked: true })), true);
});

test("a reported job is never counted as a completed job", () => {
  const reported = trustScore(evidence({ unverifiedJobs: 3 }), NOW);
  const confirmed = trustScore(evidence({ verifiedJobs: 3 }), NOW);
  assert.ok(confirmed.score > reported.score);
  // The unconfirmed work is named honestly rather than scored.
  assert.ok(reported.factors.find((f) => f.key === "jobs")?.detail.includes("not yet confirmed"));
});

test("missing evidence is shown as missing, not as a low quality", () => {
  const result = trustScore(evidence({ verifiedJobs: 1, visitsCompleted: 1 }), NOW);
  const licence = result.factors.find((f) => f.key === "license");
  assert.equal(licence?.missing, true);
  assert.equal(licence?.detail, "Not yet checked against the state register.");
  assert.equal(result.checksPassed, 2);
  assert.equal(result.checksTotal, 6);
});

test("an unanswered job is missing evidence, not a slow response", () => {
  const result = trustScore(evidence(), NOW);
  const response = result.factors.find((f) => f.key === "response");
  assert.equal(response?.missing, true);
  assert.equal(response?.detail, "Has not answered a job yet.");
});

test("answering quickly earns more than answering slowly", () => {
  const fast = trustScore(evidence({ medianResponseHours: 1 }), NOW);
  const slow = trustScore(evidence({ medianResponseHours: 40 }), NOW);
  assert.ok(fast.score > slow.score);
  assert.equal(fast.factors.find((f) => f.key === "response")?.detail, "Usually answers within an hour.");
  assert.equal(slow.factors.find((f) => f.key === "response")?.detail, "Usually answers within 40 hours.");
});

test("a perfect record reaches the top level", () => {
  const result = trustScore(
    evidence({
      licenseChecked: true,
      insuranceChecked: true,
      verifiedJobs: 6,
      visitsCompleted: 4,
      medianResponseHours: 1,
      reviewCount: 12,
      reviewAverage: 4.9,
      lastReviewAt: "2026-10-01T00:00:00Z",
    }),
    NOW,
  );
  assert.equal(result.score, 100);
  assert.equal(result.level, "highly-trusted");
  assert.equal(TRUST_LEVEL_LABEL[result.level], "Highly trusted");
});

test("an old review counts for less than a fresh one", () => {
  const fresh = reviewRecencyWeight("2026-10-01T00:00:00Z", NOW);
  const old = reviewRecencyWeight("2024-01-01T00:00:00Z", NOW);
  assert.equal(fresh, 1);
  assert.ok(old < fresh && old >= 0.2);

  const recent = trustScore(
    evidence({ reviewCount: 5, reviewAverage: 5, lastReviewAt: "2026-10-01T00:00:00Z" }),
    NOW,
  );
  const stale = trustScore(
    evidence({ reviewCount: 5, reviewAverage: 5, lastReviewAt: "2024-01-01T00:00:00Z" }),
    NOW,
  );
  assert.ok(recent.score > stale.score);
});

test("only upheld complaints count against a professional", () => {
  const noComplaint = trustScore(evidence({ verifiedJobs: 3, disputesRaised: 2 }), NOW);
  const upheld = trustScore(evidence({ verifiedJobs: 3, upheldComplaints: 1 }), NOW);
  // A dispute raised and dismissed is not held against anyone.
  assert.ok(upheld.score < noComplaint.score);
  assert.equal(noComplaint.factors.some((f) => f.key === "complaints"), false);
  assert.equal(upheld.factors.some((f) => f.key === "complaints"), true);
});

test("cancelled visits reduce the turn-up factor but never below zero", () => {
  const cancelled = trustScore(evidence({ visitsCancelled: 5 }), NOW);
  const visits = cancelled.factors.find((f) => f.key === "visits");
  assert.equal(visits?.earned, 0);
  assert.ok(cancelled.score >= 0);
});

test("the score never exceeds one hundred", () => {
  const result = trustScore(
    evidence({
      licenseChecked: true,
      insuranceChecked: true,
      verifiedJobs: 40,
      visitsCompleted: 40,
      medianResponseHours: 0.5,
      reviewCount: 50,
      reviewAverage: 5,
      lastReviewAt: "2026-10-20T00:00:00Z",
    }),
    NOW,
  );
  assert.equal(result.score, 100);
});

test("the next step names the most useful missing check, in order", () => {
  assert.equal(trustScore(evidence(), NOW).nextStep, "Confirm the licence against the state register.");
  assert.equal(
    trustScore(evidence({ licenseChecked: true }), NOW).nextStep,
    "Upload the insurance certificate.",
  );
  assert.equal(
    trustScore(evidence({ licenseChecked: true, insuranceOnFile: true }), NOW).nextStep,
    "Have the insurance certificate reviewed.",
  );
  assert.equal(
    trustScore(
      evidence({
        licenseChecked: true,
        insuranceChecked: true,
        verifiedJobs: 2,
        visitsCompleted: 2,
        medianResponseHours: 1,
        reviewCount: 3,
        reviewAverage: 5,
        lastReviewAt: "2026-10-01T00:00:00Z",
      }),
      NOW,
    ).nextStep,
    null,
  );
});

test("a brand-new business is building, not untrustworthy", () => {
  const result = trustScore(evidence({ licenseChecked: true, insuranceChecked: true }), NOW);
  assert.equal(result.level, "building");
  assert.equal(TRUST_LEVEL_LABEL[result.level], "Building a record");
});
