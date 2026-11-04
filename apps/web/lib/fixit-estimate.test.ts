import { test } from "node:test";
import assert from "node:assert/strict";

import { estimateJob, formatEstimateRange } from "./fixit-estimate.ts";

test("a recognised task narrows the range to that task", () => {
  const estimate = estimateJob({ text: "my water heater stopped working, no hot water", categorySlug: "plumbing" });
  assert.ok(estimate);
  assert.equal(estimate.basis, "Water heater replacement");
  assert.equal(estimate.lowCents, 120_000);
  assert.equal(estimate.highCents, 250_000);
});

test("an unrecognised description falls back to the category range", () => {
  const estimate = estimateJob({ text: "need some plumbing help please", categorySlug: "plumbing" });
  assert.ok(estimate);
  assert.equal(estimate.basis, "General plumbing repair");
  assert.equal(estimate.lowCents, 15_000);
});

test("a more specific match beats a generic keyword", () => {
  // Contains both "pipe" (leak rule) and "sewer line" (sewer rule).
  const estimate = estimateJob({ text: "sewer line is backing up into the pipe", categorySlug: "plumbing" });
  assert.ok(estimate);
  assert.equal(estimate.basis, "Sewer line repair");
});

test("an emergency raises the range by the premium", () => {
  const normal = estimateJob({ text: "burst pipe", categorySlug: "plumbing", urgency: "soon" });
  const emergency = estimateJob({ text: "burst pipe", categorySlug: "plumbing", urgency: "emergency" });
  assert.ok(normal && emergency);
  assert.equal(emergency.emergency, true);
  assert.equal(normal.emergency, false);
  assert.ok(emergency.lowCents > normal.lowCents);
  assert.equal(emergency.highCents, Math.round(normal.highCents * 1.25));
});

test("an emergency summary still names the task", () => {
  const estimate = estimateJob({ text: "water heater leaking everywhere", categorySlug: "plumbing", urgency: "emergency" });
  assert.ok(estimate);
  assert.match(estimate.summary, /Water heater replacement/);
});

test("no category means no estimate, never a made-up figure", () => {
  assert.equal(estimateJob({ text: "something", categorySlug: "not-a-category" }), null);
});

test("every category returns a usable range even with no description", () => {
  for (const slug of [
    "plumbing",
    "electrical",
    "hvac",
    "garage-doors",
    "roofing",
    "appliance-repair",
    "handyman",
    "cleaning",
    "pest-control",
    "landscaping",
  ]) {
    const estimate = estimateJob({ text: "", categorySlug: slug });
    assert.ok(estimate, `expected an estimate for ${slug}`);
    assert.ok(estimate.highCents > estimate.lowCents, `range must span for ${slug}`);
  }
});

test("ranges render as friendly dollars", () => {
  assert.equal(formatEstimateRange(12_000, 45_000), "$120–$450");
  assert.equal(formatEstimateRange(120_000, 250_000), "$1,200–$2,500");
  assert.equal(formatEstimateRange(600_000, 1_500_000), "$6,000–$15,000");
});

test("the estimate always carries the not-a-quote caveat", () => {
  const estimate = estimateJob({ text: "leaky faucet", categorySlug: "plumbing" });
  assert.ok(estimate);
  assert.match(estimate.note, /not a quote/i);
});

test("high-value jobs round to fifty-dollar steps", () => {
  // 2000–6000 dollars stays whole; a value like 1_250 rounds to the nearest 50.
  const estimate = estimateJob({ text: "whole house repipe", categorySlug: "plumbing" });
  assert.ok(estimate);
  assert.equal(estimate.lowCents, 300_000);
  const rendered = formatEstimateRange(estimate.lowCents, estimate.highCents);
  assert.equal(rendered, "$3,000–$8,000");
});
