import test from "node:test";
import assert from "node:assert/strict";
import { pointOnScrollbar } from "./popup-scrollbar.ts";

test("a press inside the content area is background, not the scrollbar", () => {
  assert.equal(pointOnScrollbar(100, 0, 1185), false);
  assert.equal(pointOnScrollbar(1184, 0, 1185), false);
});

test("a press in the strip past the content is the scrollbar", () => {
  assert.equal(pointOnScrollbar(1185, 0, 1185), true);
  assert.equal(pointOnScrollbar(1195, 0, 1185), true);
});

test("an element that does not start at the left edge is measured from its own left", () => {
  assert.equal(pointOnScrollbar(300, 100, 200), true);
  assert.equal(pointOnScrollbar(299, 100, 200), false);
});
