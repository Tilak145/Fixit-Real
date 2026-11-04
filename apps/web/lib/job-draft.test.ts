import assert from "node:assert/strict";
import test from "node:test";
import { JOB_DRAFT_MAX_AGE_MS, readJobDraft } from "./job-draft.ts";

const now = new Date("2026-11-03T12:00:00Z");
const draft = {
  categorySlug: "plumbing",
  description: "Kitchen faucet leaking",
  city: "Akron, OH",
  address: "350 South Main Street, Akron, OH 44311",
  emergency: true,
  budgetId: "under-500",
  customMin: "",
  customMax: "",
  lat: 41.07,
  lng: -81.52,
  savedAt: new Date(now.getTime() - 60_000).toISOString(),
};

test("a half-filled job comes back as it was typed", () => {
  const restored = readJobDraft(JSON.stringify(draft), now);
  assert.ok(restored);
  assert.equal(restored.description, "Kitchen faucet leaking");
  assert.equal(restored.address, "350 South Main Street, Akron, OH 44311");
  assert.equal(restored.city, "Akron, OH");
  assert.equal(restored.emergency, true);
  assert.equal(restored.budgetId, "under-500");
  assert.equal(restored.lat, 41.07);
});

test("missing, broken, empty and stale drafts are ignored", () => {
  assert.equal(readJobDraft(null, now), null);
  assert.equal(readJobDraft("not json", now), null);
  assert.equal(readJobDraft(JSON.stringify({ savedAt: draft.savedAt }), now), null);
  const stale = { ...draft, savedAt: new Date(now.getTime() - JOB_DRAFT_MAX_AGE_MS - 1).toISOString() };
  assert.equal(readJobDraft(JSON.stringify(stale), now), null);
});

test("a draft without an address point does not invent one", () => {
  const restored = readJobDraft(JSON.stringify({ ...draft, lat: "41", lng: null }), now);
  assert.ok(restored);
  assert.equal(restored.lat, null);
  assert.equal(restored.lng, null);
});
