import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  loadState, saveState, validateState, sanitizeState, exportBlob, importState, makeStorage,
} from "../site/js/storage.js";
import { slugifyUnit } from "../site/js/state.js";

const UNITS = [
  { id: slugifyUnit("ATLAS", "AS7-D"), class: "ATLAS", variant: "AS7-D", type: "BM", size: 4, tmm: 1, move: "6", role: "Juggernaut", skill: 4, damage: { s: 5, m: 5, l: 2 }, overheat: 0, armor: 10, structure: 8, pv: 52, abilities: [], image: "" },
];
const unitById = new Map(UNITS.map(u => [u.id, u]));
const GOOD = { roster: [{ unitId: "atlas-as7-d", armorDamage: 3, structDamage: 1, heat: 2, crits: Array(12).fill(false) }] };

function freshLocalStorage() {
  const dom = new JSDOM("", { url: "http://localhost/" });
  return dom.window.localStorage;
}

test("saveState/loadState roundtrip through localStorage", () => {
  const ls = freshLocalStorage();
  saveState(GOOD, ls);
  assert.deepEqual(loadState(ls), GOOD);
});

test("loadState returns default on missing and corrupt data", () => {
  const ls = freshLocalStorage();
  assert.deepEqual(loadState(ls), { roster: [] });
  ls.setItem("as-companion-state-v1", "{not json");
  assert.deepEqual(loadState(ls), { roster: [] });
});

test("validateState rejects bad entries", () => {
  assert.equal(validateState(GOOD, unitById), true);
  assert.equal(validateState({ roster: [{ unitId: "nope", armorDamage: 0, structDamage: 0, heat: 0, crits: Array(12).fill(false) }] }, unitById), false);
  assert.equal(validateState({ roster: [{ unitId: "atlas-as7-d", armorDamage: 99, structDamage: 0, heat: 0, crits: Array(12).fill(false) }] }, unitById), false);
  assert.equal(validateState({ roster: "nope" }, unitById), false);
  assert.equal(validateState(null, unitById), false);
});

test("sanitizeState clamps and drops invalid", () => {
  const s = sanitizeState({
    roster: [
      { unitId: "atlas-as7-d", armorDamage: 99, structDamage: -2, heat: "X", crits: [true] },
      { unitId: "ghost", armorDamage: 0, structDamage: 0, heat: 0, crits: Array(12).fill(false) },
      { unitId: "atlas-as7-d", armorDamage: 4, structDamage: 2, heat: "S", crits: Array(12).fill(false).map((_, i) => i === 0) },
    ],
  }, unitById);
  assert.equal(s.roster.length, 2);
  assert.equal(s.roster[0].armorDamage, 10);
  assert.equal(s.roster[0].structDamage, 0);
  assert.equal(s.roster[0].heat, 0);
  assert.equal(s.roster[0].crits.length, 12);
  assert.equal(s.roster[1].crits[0], true);
});

test("exportBlob produces filename and JSON text", () => {
  const { filename, text } = exportBlob(GOOD);
  assert.equal(filename, "as-companion-state.json");
  assert.deepEqual(JSON.parse(text), GOOD);
});

test("importState roundtrips and throws on garbage", () => {
  assert.deepEqual(importState(JSON.stringify(GOOD), unitById), GOOD);
  assert.throws(() => importState("not json", unitById), /parse/i);
  assert.throws(() => importState("null", unitById), /roster/);
});

test("makeStorage binds methods to one object", () => {
  const ls = freshLocalStorage();
  const storage = makeStorage(unitById, ls);
  assert.equal(typeof storage.loadState, "function");
  assert.equal(typeof storage.saveState, "function");
  assert.equal(typeof storage.exportBlob, "function");
  assert.equal(typeof storage.importState, "function");
  storage.saveState(GOOD);
  assert.deepEqual(storage.loadState(), GOOD);
});
