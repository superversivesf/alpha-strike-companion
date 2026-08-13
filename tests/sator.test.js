import test from "node:test";
import assert from "node:assert/strict";
import {
  rangeModifier, movementModifier, terrainModifier, effectiveTargetTmm,
  attackerTypeModifier, abilityModifier, hitProbability, attackerToHit, attackerMoveMod,
  targetMoveMod, targetUsesTmm, heatMod,
} from "../site/js/sator.js";

const CRITS0 = { engine: 0, fireControl: 0, mp: 0, weapons: 0, thruster: 0, fuel: 0, crew: 0 };
const atlas = {
  id: "atlas-as7-d", class: "ATLAS", variant: "AS7-D", type: "BM", size: 4, tmm: 1,
  move: "6", role: "Juggernaut", skill: 4, damage: { s: 5, m: 5, l: 2 }, overheat: 0,
  armor: 10, structure: 8, pv: 52, abilities: [], image: "", tech: "Inner Sphere", era: "Star League",
};
const entry = { id: "e1", unitId: atlas.id, armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: true };

test("rangeModifier table", () => {
  assert.equal(rangeModifier("S"), 0);
  assert.equal(rangeModifier("M"), 2);
  assert.equal(rangeModifier("L"), 4);
});

test("movementModifier table", () => {
  assert.equal(movementModifier("stationary"), 0);
  assert.equal(movementModifier("walk"), 0);
  assert.equal(movementModifier("run"), 1);
  assert.equal(movementModifier("jump"), 1);
});

test("attackerMoveMod table", () => {
  assert.equal(attackerMoveMod("standstill"), -1);
  assert.equal(attackerMoveMod("ground"), 0);
  assert.equal(attackerMoveMod("jump"), 2);
  assert.equal(attackerMoveMod("bogus"), 0);
});

test("heatMod maps heat level to TN modifier", () => {
  assert.equal(heatMod(0), 0);
  assert.equal(heatMod(1), 1);
  assert.equal(heatMod(2), 2);
  assert.equal(heatMod(3), 3);
  assert.equal(heatMod("S"), 0, "shutdown is handled by cannotAttack, not a modifier");
  assert.equal(heatMod(99), 3, "clamped at 3");
});

test("targetUsesTmm identifies TMM-consuming modes", () => {
  assert.equal(targetUsesTmm("ground"), true);
  assert.equal(targetUsesTmm("jump"), true);
  assert.equal(targetUsesTmm("submersible"), true);
  assert.equal(targetUsesTmm("standstill"), false);
  assert.equal(targetUsesTmm("hull-down"), false);
  assert.equal(targetUsesTmm("immobile"), false);
  assert.equal(targetUsesTmm("dropped"), false);
});

test("targetMoveMod table", () => {
  assert.equal(targetMoveMod("ground", 3, 0), 3);
  assert.equal(targetMoveMod("standstill", 3, 0), 0);
  assert.equal(targetMoveMod("hull-down", 3, 0), 0);
  assert.equal(targetMoveMod("jump", 3, 0), 4); // TMM +1
  assert.equal(targetMoveMod("jump", 3, 2), 6); // TMM +1 + jets
  assert.equal(targetMoveMod("jump", 3, -2), 2); // JMPW-2
  assert.equal(targetMoveMod("submersible", 2, 0), 2);
  assert.equal(targetMoveMod("submersible", 2, 3), 5); // SUBS
  assert.equal(targetMoveMod("submersible", 2, -1), 1); // SUBW
  assert.equal(targetMoveMod("immobile", 3, 0), -4);
  assert.equal(targetMoveMod("dropped", 3, 0), 3);
  assert.equal(targetMoveMod("bogus", 3, 0), 0);
});

test("terrainModifier table", () => {
  assert.equal(terrainModifier("none"), 0);
  assert.equal(terrainModifier("light-woods"), 1);
  assert.equal(terrainModifier("heavy-woods"), 2);
  assert.equal(terrainModifier("partial-cover"), 1);
  assert.equal(terrainModifier("water"), 1);
  assert.equal(terrainModifier("light-smoke"), 1);
  assert.equal(terrainModifier("heavy-smoke"), 2);
});

test("effectiveTargetTmm: stationary forces 0", () => {
  assert.equal(effectiveTargetTmm(atlas, entry, "stationary", null), 0);
});

test("effectiveTargetTmm: immobile forces 0 even with override", () => {
  assert.equal(effectiveTargetTmm(atlas, entry, "immobile", null), 0);
  assert.equal(effectiveTargetTmm(atlas, entry, "immobile", 3), 0);
});

test("effectiveTargetTmm: full TMM when moving", () => {
  assert.equal(effectiveTargetTmm(atlas, entry, "walk", null), 1);
});

test("effectiveTargetTmm: MP crit halves round down", () => {
  const e = { ...entry, crits: { ...CRITS0, mp: 1 } };
  assert.equal(effectiveTargetTmm(atlas, e, "walk", null), 0);
  const e2 = { ...entry, crits: { ...CRITS0, mp: 1 } };
  const atlas3 = { ...atlas, tmm: 3 };
  assert.equal(effectiveTargetTmm(atlas3, e2, "walk", null), 1);
});

test("effectiveTargetTmm: engine crit halves (vehicle)", () => {
  const e = { ...entry, crits: { ...CRITS0, engine: 1 } };
  const vee = { ...atlas, type: "CV", tmm: 3 };
  assert.equal(effectiveTargetTmm(vee, e, "walk", null), 1);
});

test("effectiveTargetTmm: shutdown applies -4 floor 0", () => {
  const e = { ...entry, heat: "S" };
  assert.equal(effectiveTargetTmm(atlas, e, "walk", null), 0);
});

test("effectiveTargetTmm: manual override wins", () => {
  assert.equal(effectiveTargetTmm(atlas, entry, "walk", 5), 5);
  assert.equal(effectiveTargetTmm(atlas, entry, "stationary", 5), 0);
});

test("attackerTypeModifier: IM +1 unless AFC, SV+BFC +1", () => {
  assert.equal(attackerTypeModifier(atlas), 0);
  assert.equal(attackerTypeModifier({ ...atlas, type: "IM" }), 1);
  assert.equal(attackerTypeModifier({ ...atlas, type: "IM", abilities: ["AFC"] }), 0);
  assert.equal(attackerTypeModifier({ ...atlas, type: "SV", abilities: ["BFC"] }), 1);
  assert.equal(attackerTypeModifier({ ...atlas, type: "SV" }), 0);
});

test("abilityModifier: STL depends on range band", () => {
  const stl = { ...atlas, abilities: ["STL"] };
  assert.equal(abilityModifier(stl, { rangeBand: "S", targetMovement: "walk" }), 1);
  assert.equal(abilityModifier(stl, { rangeBand: "M", targetMovement: "walk" }), 1);
  assert.equal(abilityModifier(stl, { rangeBand: "L", targetMovement: "walk" }), 2);
});

test("abilityModifier: LMAS/MAS only when target stationary", () => {
  const lmas = { ...atlas, abilities: ["LMAS"] };
  const mas = { ...atlas, abilities: ["MAS"] };
  assert.equal(abilityModifier(lmas, { rangeBand: "S", targetMovement: "stationary" }), 2);
  assert.equal(abilityModifier(lmas, { rangeBand: "S", targetMovement: "walk" }), 0);
  assert.equal(abilityModifier(mas, { rangeBand: "S", targetMovement: "stationary" }), 3);
});

test("hitProbability table with caps", () => {
  assert.equal(hitProbability(2), 0.972);
  assert.equal(hitProbability(7), 0.583);
  assert.equal(hitProbability(12), 0.028);
  assert.equal(hitProbability(13), 0.028);
  assert.equal(hitProbability(1), 0.972);
});

test("attackerToHit sums modifiers with breakdown and min-TN clamp", () => {
  const r = attackerToHit({
    attacker: atlas, attackerEntry: entry,
    target: atlas, targetEntry: entry,
    targetMovement: "walk", rangeBand: "M", terrain: "none", otherModifiers: [0],
  });
  assert.equal(r.tn, 7); // skill 4 + move 0 + tmm 1 + range 2
  assert.equal(r.cannotAttack, false);
  assert.ok(Array.isArray(r.breakdown));
  const total = r.breakdown.reduce((s, b) => s + b.value, 0);
  assert.equal(total, 7);
});

test("attackerToHit: fire control crit adds +2 each", () => {
  const e = { ...entry, crits: { ...CRITS0, fireControl: 2 } };
  const r = attackerToHit({
    attacker: atlas, attackerEntry: e,
    target: atlas, targetEntry: entry,
    targetMovement: "walk", rangeBand: "S", terrain: "none", otherModifiers: [],
  });
  assert.equal(r.tn, 9); // 4 + 0 + 1 + 0 + 4
});

test("attackerToHit: target MP crit shows in O breakdown and lowers TN", () => {
  const targetEntry = { ...entry, crits: { ...CRITS0, mp: 1 } };
  const target = { ...atlas, tmm: 3 };
  const r = attackerToHit({
    attacker: atlas, attackerEntry: entry,
    target, targetEntry,
    targetMovement: "moved", rangeBand: "S", terrain: "none", otherModifiers: [],
  });
  assert.equal(r.tn, 3); // skill 4 + tmm 1 (3 halved) + O(crits) -2
  const oLine = r.breakdown.find(b => b.label === "O (crits)");
  assert.ok(oLine, "crit delta must appear in breakdown");
  assert.equal(oLine.value, -2);
});

test("attackerToHit: target shutdown shows O breakdown line", () => {
  const targetEntry = { ...entry, heat: "S" };
  const target = { ...atlas, tmm: 3 };
  const r = attackerToHit({
    attacker: atlas, attackerEntry: entry,
    target, targetEntry,
    targetMovement: "moved", rangeBand: "S", terrain: "none", otherModifiers: [],
  });
  const oLine = r.breakdown.find(b => b.label === "O (crits)");
  assert.ok(oLine, "shutdown delta must appear in breakdown");
  assert.equal(oLine.value, -3);
  assert.equal(r.tn, 2); // 4 + 0 - 3 = 1, clamped to min TN 2
});

test("attackerToHit: stationary target emits no crit-delta line", () => {
  const r = attackerToHit({
    attacker: atlas, attackerEntry: entry,
    target: atlas, targetEntry: { ...entry, crits: { ...CRITS0, mp: 1 } },
    targetMovement: "stationary", rangeBand: "S", terrain: "none", otherModifiers: [],
  });
  assert.equal(r.tn, 4); // skill 4, stationary TMM 0
  assert.ok(!r.breakdown.find(b => b.label === "O (crits)"), "stationary must not emit O line");
});

test("attackerToHit: min TN clamps at 2", () => {
  const r = attackerToHit({
    attacker: atlas, attackerEntry: { ...entry, skill: 0 },
    target: atlas, targetEntry: entry,
    targetMovement: "stationary", rangeBand: "S", terrain: "none", otherModifiers: [-5],
  });
  assert.equal(r.tn, 2);
});

test("attackerToHit: destroyed attacker cannot attack", () => {
  const destroyed = { ...entry, armorDamage: 10, structDamage: 8 };
  const r = attackerToHit({
    attacker: atlas, attackerEntry: destroyed,
    target: atlas, targetEntry: entry,
    targetMovement: "walk", rangeBand: "S", terrain: "none", otherModifiers: [],
  });
  assert.equal(r.cannotAttack, true);
  assert.match(r.reason, /destroyed|Destroyed/);
});

test("attackerToHit: shutdown attacker cannot attack", () => {
  const shutdown = { ...entry, heat: "S" };
  const r = attackerToHit({
    attacker: atlas, attackerEntry: shutdown,
    target: atlas, targetEntry: entry,
    targetMovement: "walk", rangeBand: "S", terrain: "none", otherModifiers: [],
  });
  assert.equal(r.cannotAttack, true);
  assert.match(r.reason, /shut.?down/i);
});
