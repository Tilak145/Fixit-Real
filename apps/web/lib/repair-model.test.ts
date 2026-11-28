import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachmentPath,
  attachmentProblem,
  canShareWithPros,
  dollarsToCents,
  filterRepairs,
  plainDate,
  repairActions,
  type Repair,
} from "./repair-model.ts";

const repair = (id: string, over: Partial<Repair> = {}): Repair => ({
  id, property_id: "p1", unit_id: null, category_slug: "plumbing", title: id, description: "Leaking pipe",
  priority: "normal", status: "submitted", preferred_date: null, availability: null,
  estimated_cost_cents: null, final_cost_cents: null, quote_request_id: null,
  created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z", ...over,
});

test("a new repair can be edited, sent or cancelled but not finished", () => {
  assert.deepEqual(repairActions({ status: "submitted", quote_request_id: null }), {
    edit: true, send: true, cancel: true, start: false, complete: false, finalCost: false,
  });
});

test("once a price is accepted it can be started and finished, not cancelled or resent", () => {
  assert.deepEqual(repairActions({ status: "assigned", quote_request_id: "job" }), {
    edit: false, send: false, cancel: false, start: true, complete: true, finalCost: true,
  });
  assert.equal(repairActions({ status: "cancelled", quote_request_id: null }).send, false);
});

test("repairs filter by status, property and words, newest first", () => {
  const list = [
    repair("Sink"),
    repair("Roof", { property_id: "p2", status: "completed", created_at: "2026-11-02T00:00:00Z", description: "Shingles" }),
  ];
  assert.deepEqual(filterRepairs(list, { search: "", status: "all", propertyId: "all" }).map((r) => r.id), ["Roof", "Sink"]);
  assert.deepEqual(filterRepairs(list, { search: "pipe", status: "all", propertyId: "all" }).map((r) => r.id), ["Sink"]);
  assert.deepEqual(filterRepairs(list, { search: "", status: "completed", propertyId: "p1" }), []);
});

test("attachments are limited by type and size", () => {
  assert.equal(attachmentProblem({ name: "a.jpg", type: "image/jpeg", size: 10 }), null);
  assert.match(attachmentProblem({ name: "a.exe", type: "application/x-msdownload", size: 10 }) ?? "", /photo/);
  assert.match(attachmentProblem({ name: "a.mp4", type: "video/mp4", size: 26 * 1024 * 1024 }) ?? "", /25 MB/);
});

test("only photos and short videos are offered to professionals", () => {
  assert.equal(canShareWithPros({ mime_type: "image/png", size_bytes: 1 }), true);
  assert.equal(canShareWithPros({ mime_type: "video/mp4", size_bytes: 16 * 1024 * 1024 }), false);
  assert.equal(canShareWithPros({ mime_type: "application/pdf", size_bytes: 1 }), false);
});

test("file paths start with the organization and are made safe", () => {
  assert.equal(attachmentPath("org", "req", "my photo (1).jpg", 7), "org/repairs/req/7-my_photo__1_.jpg");
});

test("typed money becomes cents", () => {
  assert.equal(dollarsToCents("$1,250.50"), 125_050);
  assert.equal(dollarsToCents("  "), null);
  assert.ok(Number.isNaN(dollarsToCents("about 40")));
});

test("a plain date keeps its day", () => {
  assert.equal(plainDate("2026-12-01"), "Dec 1, 2026");
});
