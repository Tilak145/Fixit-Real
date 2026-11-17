import test from "node:test";
import assert from "node:assert/strict";
import { planFitProblem, planLimits } from "../features/plans.ts";

test("the limits match what the database enforces", () => {
  assert.deepEqual(planLimits("starter"), { cities: 1, services: 2 });
  assert.deepEqual(planLimits("professional"), { cities: 5, services: 3 });
  assert.deepEqual(planLimits("founding"), { cities: 5, services: 2 });
  assert.deepEqual(planLimits("business"), { cities: null, services: null });
});

test("picks that fit the plan raise nothing", () => {
  assert.equal(planFitProblem("starter", 1, 2), null);
  assert.equal(planFitProblem("professional", 5, 3), null);
  assert.equal(planFitProblem("business", 40, 10), null);
});

test("too many cities or services is said plainly", () => {
  assert.equal(
    planFitProblem("starter", 3, 2),
    "Starter covers 1 city and 2 services. You picked 3 cities. Go back and remove some, or choose a bigger plan.",
  );
  assert.match(planFitProblem("professional", 6, 4) ?? "", /You picked 6 cities and 4 services\./u);
});
