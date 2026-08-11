import test from "node:test";
import assert from "node:assert/strict";
import {
  slugifyUnit, createEntry, damageArmor, damageStruct,
  setHeat, toggleCrit, setSkill, isEntryValid, critTypesForUnit, critCap, tracksHeat,
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
  assert.deepEqual(e.crits, { engine: 0, fireControl: 0, mp: 0, weapons: 0, thruster: 0, fuel: 0, crew: 0 });
  assert.equal(e.skill, 4);
  assert.equal(e.skillSet, false);
});

test("setSkill fixes the skill once", () => {
  let e = createEntry(unit);
  e = setSkill(e, 3);
  assert.equal(e.skill, 3);
  assert.equal(e.skillSet, true);
  e = setSkill(e, 5);
  assert.equal(e.skill, 5);
  e = setSkill(e, 99);
  assert.equal(e.skill, 6);
  e = setSkill(e, -3);
  assert.equal(e.skill, 0);
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

test("toggleCrit marks individual boxes with per-type caps", () => {
  let e = createEntry(unit);
  e = toggleCrit(e, unit, "engine", 0);
  assert.equal(e.crits.engine, 1);
  e = toggleCrit(e, unit, "engine", 0);
  assert.equal(e.crits.engine, 0);
  e = toggleCrit(e, unit, "weapons", 2);
  assert.equal(e.crits.weapons, 3);
  e = toggleCrit(e, unit, "weapons", 1);
  assert.equal(e.crits.weapons, 2);
  e = toggleCrit(e, unit, "weapons", 2);
  assert.equal(e.crits.weapons, 3);
  e = toggleCrit(e, unit, "weapons", 3);
  assert.equal(e.crits.weapons, 4);
  e = toggleCrit(e, unit, "weapons", 3);
  assert.equal(e.crits.weapons, 3);
});

test("critCap: ground mech 1 engine / 4 others; aerospace 2 engine", () => {
  assert.equal(critCap(unit, "engine"), 1);
  assert.equal(critCap(unit, "fireControl"), 4);
  assert.equal(critCap(unit, "mp"), 4);
  assert.equal(critCap(unit, "weapons"), 4);
  const af = { ...unit, type: "AF" };
  assert.equal(critCap(af, "engine"), 2);
  assert.equal(critCap(af, "thruster"), 1);
  assert.equal(critCap(af, "fuel"), 1);
  assert.equal(critCap(af, "crew"), 2);
});

test("critTypesForUnit: ground vs aerospace", () => {
  assert.deepEqual(critTypesForUnit({ type: "BM" }), ["engine", "fireControl", "mp", "weapons"]);
  assert.deepEqual(critTypesForUnit({ type: "AF" }), ["engine", "fireControl", "weapons", "thruster", "fuel", "crew"]);
  assert.deepEqual(critTypesForUnit({ type: "CV" }), ["engine", "fireControl", "mp", "weapons"]);
});

test("tracksHeat: only 'Mechs and Aerospace Fighters", () => {
  assert.equal(tracksHeat({ type: "BM" }), true);
  assert.equal(tracksHeat({ type: "IM" }), true);
  assert.equal(tracksHeat({ type: "AF" }), true);
  assert.equal(tracksHeat({ type: "CV" }), false);
  assert.equal(tracksHeat({ type: "CI" }), false);
  assert.equal(tracksHeat({ type: "BA" }), false);
});

test("isEntryValid enforces bounds", () => {
  const e = createEntry(unit);
  assert.equal(isEntryValid(e, unit), true);
  assert.equal(isEntryValid({ ...e, armorDamage: 11 }, unit), false);
  assert.equal(isEntryValid({ ...e, structDamage: 9 }, unit), false);
  assert.equal(isEntryValid({ ...e, heat: "X" }, unit), false);
  assert.equal(isEntryValid({ ...e, crits: null }, unit), false);
  assert.equal(isEntryValid({ ...e, crits: { ...e.crits, engine: 5 } }, unit), false);
  assert.equal(isEntryValid({ ...e, crits: { ...e.crits, weapons: 5 } }, unit), false);
  assert.equal(isEntryValid({ ...e, skill: 7 }, unit), false);
  assert.equal(isEntryValid({ ...e, skill: "3" }, unit), false);
});
