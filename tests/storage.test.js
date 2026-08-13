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
const CRITS0 = { engine: 0, fireControl: 0, mp: 0, weapons: 0, thruster: 0, fuel: 0, crew: 0 };
const GOOD = {
  roster: [{ id: "e1", unitId: "atlas-as7-d", armorDamage: 3, structDamage: 1, heat: 2, crits: { ...CRITS0, weapons: 1 }, skill: 4, skillSet: false }],
  groups: [{ id: "g1", name: "Lance 1", size: 4, unitIds: ["e1"] }],
};

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
  assert.deepEqual(loadState(ls), { roster: [], groups: [] });
  ls.setItem("as-companion-state-v1", "{not json");
  assert.deepEqual(loadState(ls), { roster: [], groups: [] });
});

test("sanitizeState keeps valid groups, drops orphaned unit refs", () => {
  const s = sanitizeState({
    roster: [{ id: "e1", unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: false }],
    groups: [
      { id: "g1", name: "Lance 1", size: 4, unitIds: ["e1"] },
      { id: "g2", name: "Star 1", size: 5, unitIds: ["ghost-unit"] },
      { id: "g3", name: "Bad", size: 0, unitIds: [] },
    ],
  }, unitById);
  assert.equal(s.groups.length, 2);
  assert.equal(s.groups[0].id, "g1");
  assert.deepEqual(s.groups[0].unitIds, ["e1"]);
  assert.deepEqual(s.groups[1].unitIds, []);
});

test("sanitizeState caps group unitIds to group size on import", () => {
  const s = sanitizeState({
    roster: [
      { id: "e1", unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: false },
      { id: "e2", unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: false },
      { id: "e3", unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: false },
      { id: "e4", unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: false },
      { id: "e5", unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: false },
      { id: "e6", unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: false },
    ],
    groups: [{ id: "g1", name: "Lance 1", size: 4, unitIds: ["e1", "e2", "e3", "e4", "e5", "e6"] }],
  }, unitById);
  assert.equal(s.groups[0].size, 4);
  assert.equal(s.groups[0].unitIds.length, 4);
});

test("sanitizeState generates ids for legacy entries without one", () => {
  const s = sanitizeState({
    roster: [{ unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: false }],
  }, unitById);
  assert.equal(s.roster.length, 1);
  assert.ok(typeof s.roster[0].id === "string" && s.roster[0].id.length > 0);
});

test("validateState rejects bad entries", () => {
  assert.equal(validateState(GOOD, unitById), true);
  assert.equal(validateState({ roster: [{ unitId: "nope", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 } }] }, unitById), false);
  assert.equal(validateState({ roster: [{ unitId: "atlas-as7-d", armorDamage: 99, structDamage: 0, heat: 0, crits: { ...CRITS0 } }] }, unitById), false);
  assert.equal(validateState({ roster: "nope" }, unitById), false);
  assert.equal(validateState(null, unitById), false);
  assert.equal(validateState({ roster: [], groups: "nope" }, unitById), false);
  assert.equal(validateState({ roster: [], groups: [{ id: "g", name: "", size: 0, unitIds: [] }] }, unitById), false);
});

test("sanitizeState clamps and drops invalid", () => {
  const s = sanitizeState({
    roster: [
      { unitId: "atlas-as7-d", armorDamage: 99, structDamage: -2, heat: "X", crits: [true] },
      { unitId: "ghost", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 } },
      { unitId: "atlas-as7-d", armorDamage: 4, structDamage: 2, heat: "S", crits: { ...CRITS0, engine: 9, weapons: 9 } },
    ],
  }, unitById);
  assert.equal(s.roster.length, 2);
  assert.equal(s.roster[0].armorDamage, 10);
  assert.equal(s.roster[0].structDamage, 0);
  assert.equal(s.roster[0].heat, 0);
  assert.deepEqual(s.roster[0].crits, CRITS0);
  assert.equal(s.roster[1].crits.engine, 1);
  assert.equal(s.roster[1].crits.weapons, 4);
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

test("makeStorage loadState sanitizes hostile persisted data", () => {
  const ls = freshLocalStorage();
  ls.setItem("as-companion-state-v1", JSON.stringify({
    roster: [{ id: "e1", unitId: "atlas-as7-d", armorDamage: 99, structDamage: -5, heat: "X", crits: { ...CRITS0, engine: 9 } }],
    groups: [{ id: "g1", name: "x".repeat(500), size: 4, unitIds: ["e1"] }],
  }));
  const storage = makeStorage(unitById, ls);
  const s = storage.loadState();
  assert.equal(s.roster[0].armorDamage, 10);
  assert.equal(s.roster[0].structDamage, 0);
  assert.equal(s.roster[0].heat, 0);
  assert.equal(s.roster[0].crits.engine, 1);
  assert.equal(s.groups[0].name.length, 80);
});

test("sanitizeState caps roster size and entry id length", () => {
  const big = { roster: [], groups: [] };
  for (let i = 0; i < 600; i++) {
    big.roster.push({ id: `e-${i}`, unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: false });
  }
  const s = sanitizeState(big, unitById);
  assert.equal(s.roster.length, 500);
  const longId = sanitizeState({
    roster: [{ id: "x".repeat(200), unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: false }],
  }, unitById);
  assert.equal(longId.roster[0].id.length, 64);
});

test("sanitizeState dedupes group ids and rejects empty ids", () => {
  const s = sanitizeState({
    roster: [],
    groups: [
      { id: "g1", name: "A", size: 4, unitIds: [] },
      { id: "g1", name: "B", size: 4, unitIds: [] },
      { id: "", name: "C", size: 4, unitIds: [] },
    ],
  }, unitById);
  assert.equal(s.groups.length, 1);
  assert.equal(s.groups[0].name, "A");
});

test("loadState returns default when localStorage.getItem throws", () => {
  const bad = { getItem: () => { throw new Error("denied"); } };
  assert.deepEqual(loadState(bad), { roster: [], groups: [] });
});

test("loadState returns default when localStorage access throws", () => {
  const orig = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() { throw new Error("blocked"); },
  });
  try {
    assert.deepEqual(loadState(), { roster: [], groups: [] });
  } finally {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: orig });
  }
});

test("sanitizeState dedupes unitIds within a group", () => {
  const s = sanitizeState({
    roster: [
      { id: "e1", unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: false },
      { id: "e2", unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: false },
    ],
    groups: [{ id: "g1", name: "Lance 1", size: 4, unitIds: ["e1", "e1", "e1", "e2"] }],
  }, unitById);
  assert.deepEqual(s.groups[0].unitIds, ["e1", "e2"]);
});

test("importState throws on object without roster array", () => {
  assert.throws(() => importState("{}", unitById), /missing roster array/);
});

test("empty state roundtrips through exportBlob and importState", () => {
  const empty = { roster: [], groups: [] };
  const { text } = exportBlob(empty);
  assert.deepEqual(importState(text, unitById), empty);
});

test("loadState returns default when stored value parses to null", () => {
  const ls = freshLocalStorage();
  ls.setItem("as-companion-state-v1", "null");
  assert.deepEqual(loadState(ls), { roster: [], groups: [] });
});

test("loadState coerces non-array groups to empty array", () => {
  const ls = freshLocalStorage();
  ls.setItem("as-companion-state-v1", JSON.stringify({ roster: [], groups: "nope" }));
  assert.deepEqual(loadState(ls), { roster: [], groups: [] });
});

test("sanitizeState returns default for non-array roster", () => {
  assert.deepEqual(sanitizeState({ roster: "nope" }, unitById), { roster: [], groups: [] });
  assert.deepEqual(sanitizeState(null, unitById), { roster: [], groups: [] });
});

test("sanitizeState dedupes duplicate entry ids", () => {
  const s = sanitizeState({
    roster: [
      { id: "e1", unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: false },
      { id: "e1", unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: false },
    ],
  }, unitById);
  assert.equal(s.roster.length, 1);
});

test("sanitizeState falls back to unit skill for non-numeric entry skill", () => {
  const s = sanitizeState({
    roster: [{ id: "e1", unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: "X", skillSet: false }],
  }, unitById);
  assert.equal(s.roster[0].skill, 4);
});

test("sanitizeState generates id for entry with non-string id", () => {
  const s = sanitizeState({
    roster: [{ id: 42, unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: false }],
  }, unitById);
  assert.equal(s.roster.length, 1);
  assert.ok(typeof s.roster[0].id === "string" && s.roster[0].id.length > 0);
});

test("sanitizeState clamps group size and cleans non-string names", () => {
  const s = sanitizeState({
    roster: [],
    groups: [
      { id: "g1", name: 42, size: 0, unitIds: ["ghost"] },
      { id: "g2", name: "ok", size: 99, unitIds: [] },
    ],
  }, unitById);
  assert.equal(s.groups.length, 1);
  assert.equal(s.groups[0].id, "g2");
  assert.equal(s.groups[0].size, 10);
});

test("sanitizeState drops groups with non-numeric size", () => {
  const s = sanitizeState({
    roster: [],
    groups: [{ id: "g1", name: "x".repeat(200), size: "big", unitIds: [] }],
  }, unitById);
  assert.equal(s.groups.length, 0);
});

test("sanitizeState zeroes non-numeric crit values", () => {
  const s = sanitizeState({
    roster: [{ id: "e1", unitId: "atlas-as7-d", armorDamage: 0, structDamage: 0, heat: 0, crits: { engine: "x", weapons: null }, skill: 4, skillSet: false }],
  }, unitById);
  assert.equal(s.roster[0].crits.engine, 0);
  assert.equal(s.roster[0].crits.weapons, 0);
});
