import assert from "node:assert/strict";
import { test } from "node:test";
import { filterProperties, photoProblem, propertyPhotoPath, type Property } from "./manage-model.ts";

const property = (name: string, over: Partial<Property> = {}): Property => ({
  id: name, name, kind: "residential", address: "1 Main St", city: "Akron, OH",
  description: null, photo_path: null, archived_at: null, ...over,
});

test("archived properties are only shown when asked for", () => {
  const list = [property("Oak"), property("Elm", { archived_at: "2026-11-01T00:00:00Z" })];
  assert.deepEqual(filterProperties(list, { search: "", kind: "all", archived: false }).map((p) => p.name), ["Oak"]);
  assert.deepEqual(filterProperties(list, { search: "", kind: "all", archived: true }).map((p) => p.name), ["Elm"]);
});

test("search looks at name, address and city, and the kind filter applies", () => {
  const list = [property("Oak", { city: "Kent, OH" }), property("Maple", { kind: "apartment", address: "9 Elm Road" })];
  assert.deepEqual(filterProperties(list, { search: "kent", kind: "all", archived: false }).map((p) => p.name), ["Oak"]);
  assert.deepEqual(filterProperties(list, { search: "elm road", kind: "apartment", archived: false }).map((p) => p.name), ["Maple"]);
  assert.deepEqual(filterProperties(list, { search: "", kind: "commercial", archived: false }), []);
});

test("a photo path starts with the organization", () => {
  assert.equal(propertyPhotoPath("org", "prop", "House.JPG", 5), "org/properties/prop-5.jpg");
});

test("only pictures of a sensible size are accepted", () => {
  assert.equal(photoProblem({ type: "image/png", size: 1000 }), null);
  assert.match(photoProblem({ type: "application/pdf", size: 1000 }) ?? "", /JPG/);
  assert.match(photoProblem({ type: "image/png", size: 9 * 1024 * 1024 }) ?? "", /8 MB/);
});
