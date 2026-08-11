import test from "node:test";
import assert from "node:assert/strict";
import { filterUnits, uniqueTypes, uniqueValues } from "../site/js/search.js";

const units = [
  { id: "atlas-as7-d", class: "ATLAS", variant: "AS7-D", type: "BM", pv: 52, tech: "Inner Sphere", era: "Star League", role: "Juggernaut", size: 4 },
  { id: "atlas-as7-k", class: "ATLAS", variant: "AS7-K", type: "BM", pv: 49, tech: "Inner Sphere", era: "Clan Invasion", role: "Sniper", size: 4 },
  { id: "awesome-aws-8q", class: "AWESOME", variant: "AWS-8Q", type: "BM", pv: 44, tech: "Inner Sphere", era: "Star League", role: "Sniper", size: 4 },
  { id: "demolisher-heavy-tank", class: "Demolisher Heavy Tank", variant: "Std", type: "CV", pv: 36, tech: "Clan", era: "Clan Invasion", role: "Juggernaut", size: 4 },
  { id: "trooper-tp-1r", class: "Trooper", variant: "TP-1R", type: "UNK", pv: 14, tech: "", era: "", role: "Scout", size: 1 },
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

test("filterUnits era filter", () => {
  assert.deepEqual(filterUnits(units, { era: "Star League" }).map(u => u.id), ["atlas-as7-d", "awesome-aws-8q"]);
  assert.deepEqual(filterUnits(units, { era: "Clan Invasion" }).map(u => u.id), ["atlas-as7-k", "demolisher-heavy-tank"]);
});

test("filterUnits side filter", () => {
  assert.deepEqual(filterUnits(units, { side: "Clan" }).map(u => u.id), ["demolisher-heavy-tank"]);
  assert.deepEqual(filterUnits(units, { side: "Inner Sphere" }).map(u => u.id), ["atlas-as7-d", "atlas-as7-k", "awesome-aws-8q"]);
});

test("filterUnits role filter", () => {
  assert.deepEqual(filterUnits(units, { role: "Sniper" }).map(u => u.id), ["atlas-as7-k", "awesome-aws-8q"]);
});

test("filterUnits size filter", () => {
  assert.deepEqual(filterUnits(units, { size: "1" }).map(u => u.id), ["trooper-tp-1r"]);
  assert.deepEqual(filterUnits(units, { size: "4" }).length, 4);
});

test("filterUnits combines multiple filters", () => {
  assert.deepEqual(filterUnits(units, { side: "Inner Sphere", era: "Star League", role: "Juggernaut" }).map(u => u.id), ["atlas-as7-d"]);
  assert.deepEqual(filterUnits(units, { side: "Clan", era: "Star League" }), []);
});

test("uniqueTypes returns sorted non-UNK types", () => {
  assert.deepEqual(uniqueTypes(units), ["BM", "CV"]);
});

test("uniqueValues returns sorted non-empty values", () => {
  assert.deepEqual(uniqueValues(units, "era"), ["Clan Invasion", "Star League"]);
  assert.deepEqual(uniqueValues(units, "tech"), ["Clan", "Inner Sphere"]);
  assert.deepEqual(uniqueValues(units, "role"), ["Juggernaut", "Scout", "Sniper"]);
});
