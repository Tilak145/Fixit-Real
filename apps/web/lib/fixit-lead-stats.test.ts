import { test } from "node:test";
import assert from "node:assert/strict";

import { leadFunnel, formatFunnel } from "./fixit-lead-stats.ts";

test("the funnel counts each step of the pro's own leads", () => {
  const funnel = leadFunnel([
    { claimedByMe: false, quotedByMe: false, completed: false },
    { claimedByMe: false, quotedByMe: true, completed: false },
    { claimedByMe: true, quotedByMe: true, completed: true },
    { claimedByMe: true, quotedByMe: true, completed: false },
  ]);
  assert.equal(funnel.matched, 4);
  assert.equal(funnel.quoted, 3);
  assert.equal(funnel.won, 2);
  assert.equal(funnel.completed, 1);
  assert.equal(funnel.quoteRatePct, 75);
  assert.equal(funnel.winRatePct, 67);
});

test("rates are null when there is no denominator, not zero", () => {
  const funnel = leadFunnel([]);
  assert.equal(funnel.matched, 0);
  assert.equal(funnel.quoteRatePct, null);
  assert.equal(funnel.winRatePct, null);
});

test("a lead that was never quoted cannot count as won", () => {
  const funnel = leadFunnel([{ claimedByMe: true, quotedByMe: false, completed: true }]);
  assert.equal(funnel.won, 1);
  assert.equal(funnel.quoted, 0);
  assert.equal(funnel.winRatePct, null);
});

test("the sentence is honest when nothing has happened yet", () => {
  assert.match(formatFunnel(leadFunnel([])), /No leads have reached you yet/);
  assert.match(
    formatFunnel(leadFunnel([{ claimedByMe: false, quotedByMe: false, completed: false }])),
    /1 lead reached you/,
  );
  assert.match(
    formatFunnel(
      leadFunnel([{ claimedByMe: false, quotedByMe: true, completed: false }]),
    ),
    /customers chose you on 0 of the 1 you priced/,
  );
});

