import test from "node:test";
import assert from "node:assert/strict";
import { filterUnits, uniqueTypes } from "../site/js/search.js";

const units = [
  { id: "atlas-as7-d", class: "ATLAS", variant: "AS7-D", type: "BM", pv: 52 },
  { id: "atlas-as7-k", class: "ATLAS", variant: "AS7-K", type: "BM", pv: 49 },
  { id: "awesome-aws-8q", class: "AWESOME", variant: "AWS-8Q", type: "BM", pv: 44 },
  { id: "demolisher-heavy-tank", class: "Demolisher Heavy Tank", variant: "Std", type: "CV", pv: 36 },
  { id: "trooper-tp-1r", class: "Trooper", variant: "TP-1R", type: "UNK", pv: 14 },
];

test("filterUnits matches substring case-insensitive on class+variant", () => {
  assert.deepEqual(filterUnits(units, { query: "atlas" }).map(u => u.id), ["atlas-as7-d", "atlas-as7-k"]);
  assert.deepEqual(filterUnits(units, { query: "AS7" }).map(u => u.id), ["atlas-as7-d", "atlas-as7-k"]);
  assert.deepEqual(filterUnits(units, { query: "heavy tank" }).map(u => u.id), ["demolisher-heavy-tank"]);
});

test("filterUnits empty query returns all", () => {
  assert.equal(filterUnits(units, { query: "", type: "" }).length, units.length);
});

test("filterUnits type filter is exact", () => {
  assert.deepEqual(filterUnits(units, { query: "", type: "BM" }).map(u => u.id), ["atlas-as7-d", "atlas-as7-k", "awesome-aws-8q"]);
});

test("filterUnits combines query and type", () => {
  assert.deepEqual(filterUnits(units, { query: "atlas", type: "CV" }), []);
  assert.deepEqual(filterUnits(units, { query: "a", type: "BM" }).length, 3);
});

test("uniqueTypes returns sorted non-UNK types", () => {
  assert.deepEqual(uniqueTypes(units), ["BM", "CV"]);
});
