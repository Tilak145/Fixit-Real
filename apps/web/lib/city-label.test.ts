import test from "node:test";
import assert from "node:assert/strict";
import { cityAlreadyListed, cityLabel, cleanCityName, stateName } from "./city-label.ts";

test("a typed name becomes a tidy city name", () => {
  assert.equal(cleanCityName("  cuyahoga   falls "), "Cuyahoga Falls");
  assert.equal(cleanCityName("hudson, oh"), "Hudson");
  assert.equal(cleanCityName("McDonald"), "McDonald");
  assert.equal(cleanCityName("winston-salem"), "Winston-Salem");
});

test("the label is the name, a comma and the state code", () => {
  assert.equal(cityLabel("hudson", "oh"), "Hudson, OH");
  assert.equal(cityLabel("Cuyahoga Falls, OH", "OH"), "Cuyahoga Falls, OH");
});

test("no label without a real name and a real state", () => {
  assert.equal(cityLabel("", "OH"), "");
  assert.equal(cityLabel("a", "OH"), "");
  assert.equal(cityLabel("Hudson", "ZZ"), "");
  assert.equal(stateName("oh"), "Ohio");
});

test("a city already on the list is spotted whatever the capitals", () => {
  assert.equal(cityAlreadyListed("Akron, OH", ["akron,  oh", "Kent, OH"]), true);
  assert.equal(cityAlreadyListed("Hudson, OH", ["Akron, OH"]), false);
});
