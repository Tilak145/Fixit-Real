import assert from "node:assert/strict";
import { test } from "node:test";
import { leadsForBusiness } from "./business-leads.ts";

const electrician = { id: "me", services: ["electrical"], cities: ["Akron, OH"] };
const row = (category_slug: string, city: string, claimed_by: string | null = null) => ({ category_slug, city, claimed_by });

test("an electrician is not shown plumbing requests, even if the account may read them", () => {
  assert.deepEqual(leadsForBusiness([row("plumbing", "Akron, OH")], electrician), []);
});

test("their own service in their own city is shown", () => {
  assert.equal(leadsForBusiness([row("electrical", "Akron, OH")], electrician).length, 1);
});

test("their service in a city they do not serve is not shown", () => {
  assert.deepEqual(leadsForBusiness([row("electrical", "Hudson, OH")], electrician), []);
});

test("a job they already took stays, even outside their current services", () => {
  assert.equal(leadsForBusiness([row("plumbing", "Hudson, OH", "me")], electrician).length, 1);
});