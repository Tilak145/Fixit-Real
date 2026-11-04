import assert from "node:assert/strict";
import test from "node:test";
import {
  comparisonRows,
  partsMatchTotal,
  quoteGaps,
  quoteLines,
  validity,
} from "./quote-comparison.ts";

const dollars = (cents: number) => "$" + (cents / 100).toFixed(2);

test("only the parts actually charged are listed", () => {
  const lines = quoteLines({
    amount_cents: 50000,
    labour_cents: 40000,
    materials_cents: 10000,
    service_call_cents: 0,
  });
  assert.deepEqual(lines.map((l) => l.label), ["Labour", "Materials"]);
});

test("an unnamed other charge is labelled plainly, and a named one keeps its name", () => {
  assert.equal(quoteLines({ amount_cents: 1000, other_cents: 1000 })[0].label, "Other");
  assert.equal(
    quoteLines({ amount_cents: 1000, other_cents: 1000, other_label: "Permit" })[0].label,
    "Permit",
  );
});

test("the parts must add up to the total", () => {
  assert.equal(partsMatchTotal({ amount_cents: 50000, labour_cents: 40000, materials_cents: 10000 }), true);
  assert.equal(partsMatchTotal({ amount_cents: 50000, labour_cents: 40000 }), false);
});

test("the gaps are questions worth asking, not faults", () => {
  const labourOnly = {
    amount_cents: 40000,
    labour_cents: 40000,
  };
  const gaps = quoteGaps(labourOnly);
  // Materials, start, duration, warranty, payment terms are all unstated.
  assert.equal(gaps.length, 5);
  assert.ok(gaps.some((g) => g.includes("Materials")));
  assert.ok(gaps.some((g) => g.includes("start date")));
});

test("a complete quote has nothing to ask about", () => {
  const complete = {
    amount_cents: 50000,
    labour_cents: 40000,
    materials_cents: 10000,
    earliest_start: "2026-11-02",
    completion_note: "Same day, about four hours",
    warranty: "12 months on labour",
    payment_terms: "Half on arrival, half on completion",
  };
  assert.deepEqual(quoteGaps(complete), []);
});

test("a quote whose parts do not sum to its total is flagged", () => {
  const broken = { amount_cents: 50000, labour_cents: 30000 };
  assert.ok(quoteGaps(broken).some((g) => g.includes("do not add up")));
});

test("validity is inclusive of the last day, and absent when no date is set", () => {
  const now = new Date("2026-11-10T09:00:00Z");
  assert.equal(validity({ amount_cents: 1 }, now), "none");
  assert.equal(validity({ amount_cents: 1, valid_until: "2026-11-10" }, now), "valid");
  assert.equal(validity({ amount_cents: 1, valid_until: "2026-11-09" }, now), "expired");
});

test("the comparison shows the total first and marks what genuinely differs", () => {
  const rows = comparisonRows(
    [
      { amount_cents: 50000, labour_cents: 40000, materials_cents: 10000 },
      { amount_cents: 42000, labour_cents: 42000, materials_cents: 0 },
    ],
    dollars,
  );
  assert.equal(rows[0].label, "Total");
  assert.deepEqual(rows[0].values, ["$500.00", "$420.00"]);
  assert.equal(rows[0].differs, true);

  const materials = rows.find((r) => r.label === "Materials");
  assert.deepEqual(materials?.values, ["$100.00", "$0.00"]);
  assert.equal(materials?.differs, true);
});

test("a row where the quotes agree is not marked as a difference", () => {
  const rows = comparisonRows(
    [
      { amount_cents: 50000, labour_cents: 50000, warranty: "12 months on labour" },
      { amount_cents: 42000, labour_cents: 42000, warranty: "12 months on labour" },
    ],
    dollars,
  );
  const warranty = rows.find((r) => r.label === "Warranty");
  assert.equal(warranty?.differs, false);
  assert.equal(rows.find((r) => r.label === "Total")?.differs, true);
});

test("an unstated term reads as not stated, never as an empty cell", () => {
  const rows = comparisonRows([{ amount_cents: 1000, labour_cents: 1000 }], dollars);
  for (const label of ["Earliest start", "How long", "Warranty", "Payment terms"]) {
    assert.equal(rows.find((r) => r.label === label)?.values[0], "Not stated");
  }
});

test("an other row appears only when someone charged one", () => {
  const withoutOther = comparisonRows([{ amount_cents: 1000, labour_cents: 1000 }], dollars);
  assert.equal(withoutOther.some((r) => r.label === "Other"), false);
  const withOther = comparisonRows(
    [{ amount_cents: 1000, labour_cents: 800, other_cents: 200, other_label: "Permit" }],
    dollars,
  );
  // The row is named "Other" because it spans quotes; the amount is what differs.
  assert.equal(withOther.find((r) => r.label === "Other")?.values[0], "$2.00");
});
