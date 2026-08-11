import test from "node:test";
import assert from "node:assert/strict";
import {
  slugifyUnit, createEntry, damageArmor, damageStruct,
  setHeat, toggleCrit, isEntryValid,
} from "../site/js/state.js";

const unit = {
  id: "atlas-as7-d", class: "ATLAS", variant: "AS7-D", type: "BM",
  size: 4, tmm: 1, move: "6", role: "Juggernaut", skill: 4,
  damage: { s: 5, m: 5, l: 2 }, overheat: 0,
  armor: 10, structure: 8, pv: 52,
  abilities: ["AC2/2/-"], image: "atlas-rg.webp",
};

test("slugifyUnit produces lowercase dash id", () => {
  assert.equal(slugifyUnit("ATLAS", "AS7-D"), "atlas-as7-d");
  assert.equal(slugifyUnit("Phoenix Hawk LAM", "PHX-HK2M"), "phoenix-hawk-lam-phx-hk2m");
  assert.equal(slugifyUnit("Ara\u00f1a", "ARA-S-1 MilitiaMech"), "arana-ara-s-1-militiamech");
});

test("createEntry starts clean", () => {
  const e = createEntry(unit);
  assert.equal(e.unitId, "atlas-as7-d");
  assert.equal(e.armorDamage, 0);
  assert.equal(e.structDamage, 0);
  assert.equal(e.heat, 0);
  assert.deepEqual(e.crits, Array(12).fill(false));
});

test("damageArmor click semantics and clamping", () => {
  let e = createEntry(unit);
  e = damageArmor(e, unit, 0);
  assert.equal(e.armorDamage, 1);
  e = damageArmor(e, unit, 3);
  assert.equal(e.armorDamage, 4);
  e = damageArmor(e, unit, 9);
  assert.equal(e.armorDamage, 10);
  e = damageArmor(e, unit, 3);
  assert.equal(e.armorDamage, 3);
});

test("damageStruct clamps to structure", () => {
  let e = createEntry(unit);
  e = damageStruct(e, unit, 7);
  assert.equal(e.structDamage, 8);
  e = damageStruct(e, unit, 7);
  assert.equal(e.structDamage, 7);
});

test("setHeat cycles levels and resets on re-click", () => {
  let e = createEntry(unit);
  e = setHeat(e, 1); assert.equal(e.heat, 1);
  e = setHeat(e, 2); assert.equal(e.heat, 2);
  e = setHeat(e, "S"); assert.equal(e.heat, "S");
  e = setHeat(e, "S"); assert.equal(e.heat, 0);
  e = setHeat(e, 3); assert.equal(e.heat, 3);
});

test("toggleCrit flips slot", () => {
  let e = createEntry(unit);
  e = toggleCrit(e, 3);
  assert.equal(e.crits[3], true);
  e = toggleCrit(e, 3);
  assert.equal(e.crits[3], false);
});

test("isEntryValid enforces bounds", () => {
  const e = createEntry(unit);
  assert.equal(isEntryValid(e, unit), true);
  assert.equal(isEntryValid({ ...e, armorDamage: 11 }, unit), false);
  assert.equal(isEntryValid({ ...e, structDamage: 9 }, unit), false);
  assert.equal(isEntryValid({ ...e, heat: "X" }, unit), false);
  assert.equal(isEntryValid({ ...e, crits: [true] }, unit), false);
});
