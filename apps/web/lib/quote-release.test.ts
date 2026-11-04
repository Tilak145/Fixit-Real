import assert from "node:assert/strict";
import test from "node:test";
import { contactDetailsReleased, quoteState } from "./quote-release.ts";

test("contact details stay locked until the customer accepts a quote", () => {
  assert.equal(contactDetailsReleased({ status: "sent" }), false);
  assert.equal(contactDetailsReleased({ status: "declined" }), false);
  assert.equal(contactDetailsReleased({ status: "withdrawn" }), false);
  assert.equal(contactDetailsReleased({ status: "accepted" }), true);
});

test("a booked visit or a guest request is treated as already agreed", () => {
  // A live appointment means the two sides are meeting.
  assert.equal(contactDetailsReleased({ status: "sent", hasAppointment: true }), true);
  // A guest request has no customer account to answer a price.
  assert.equal(contactDetailsReleased({ status: "sent", guestRequest: true }), true);
  // No visit and no guest: still locked.
  assert.equal(contactDetailsReleased({ status: "sent", hasAppointment: false }), false);
});

test("a contact the database released is never hidden by the screen", () => {
  // The row shows what the database returned, so a released contact cannot be
  // hidden by a quote state the screen reads differently.
  assert.equal(contactDetailsReleased({ status: "sent", hasContactOnFile: true }), true);
});

test("the quote state reads as one of the four the product uses", () => {
  assert.equal(quoteState(null), "none");
  assert.equal(quoteState({ status: "sent" }), "sent");
  assert.equal(quoteState({ status: "accepted" }), "accepted");
  assert.equal(quoteState({ status: "declined" }), "declined");
});
