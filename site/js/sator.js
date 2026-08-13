export const RANGE_BANDS = ["S", "M", "L"];

const RANGE_MODS = { S: 0, M: 2, L: 4 };
const MOVE_MODS = { stationary: 0, walk: 0, run: 1, jump: 1 };
const TERRAIN_MODS = {
  none: 0, "light-woods": 1, "heavy-woods": 2, "partial-cover": 1,
  water: 1, "light-smoke": 1, "heavy-smoke": 2,
};

export function rangeModifier(band) {
  return RANGE_MODS[band] ?? 0;
}

export function movementModifier(mode) {
  return MOVE_MODS[mode] ?? 0;
}

export function terrainModifier(terrain) {
  return TERRAIN_MODS[terrain] ?? 0;
}

export function effectiveTargetTmm(target, targetEntry, targetMovement, override) {
  if (override !== null && override !== undefined && override !== "") {
    return Math.max(0, Number(override) || 0);
  }
  if (targetMovement === "stationary") return 0;
  let tmm = target.tmm;
  const mpHits = targetEntry?.crits?.mp ?? 0;
  const engineHits = targetEntry?.crits?.engine ?? 0;
  if (mpHits > 0) tmm = Math.floor(tmm / 2);
  if (engineHits > 0 && target.type !== "BM") tmm = Math.floor(tmm / 2);
  if (targetEntry?.heat === "S") tmm -= 4;
  return Math.max(0, tmm);
}

export function attackerTypeModifier(unit) {
  const abilities = unit.abilities || [];
  if (unit.type === "IM" && !abilities.includes("AFC")) return 1;
  if (unit.type === "SV" && abilities.includes("BFC")) return 1;
  return 0;
}

export function abilityModifier(unit, { rangeBand, targetMovement }) {
  const abilities = unit.abilities || [];
  let mod = 0;
  if (abilities.includes("STL")) mod += rangeBand === "L" ? 2 : 1;
  if (targetMovement === "stationary") {
    if (abilities.includes("LMAS")) mod += 2;
    if (abilities.includes("MAS")) mod += 3;
  }
  return mod;
}

export function hitProbability(tn) {
  const P = [0, 0, 0.972, 0.972, 0.917, 0.833, 0.722, 0.583, 0.417, 0.278, 0.167, 0.083, 0.028];
  if (tn <= 2) return 0.972;
  if (tn >= 12) return 0.028;
  return P[tn];
}

export function attackerToHit({
  attacker, attackerEntry, target, targetEntry,
  targetMovement = "walk", rangeBand = "S", terrain = "none",
  otherModifiers = [], targetTmmOverride = null,
}) {
  if (attackerEntry.armorDamage >= attacker.armor && attackerEntry.structDamage >= attacker.structure) {
    return { tn: null, breakdown: [], probability: 0, cannotAttack: true, reason: "Unit destroyed" };
  }
  if (attackerEntry.heat === "S") {
    return { tn: null, breakdown: [], probability: 0, cannotAttack: true, reason: "Unit is shut down" };
  }
  const breakdown = [];
  const add = (label, value) => { if (value !== 0) breakdown.push({ label, value }); };
  add("Skill", attackerEntry.skill);
  add("Move", movementModifier(attackerEntry.movement || "walk"));
  const tmm = effectiveTargetTmm(target, targetEntry, targetMovement, targetTmmOverride);
  add("TMM", tmm);
  add("Terrain", terrainModifier(terrain));
  add("Range", rangeModifier(rangeBand));
  add("Fire Control", (attackerEntry.crits?.fireControl ?? 0) * 2);
  add("Crew", (attackerEntry.crits?.crew ?? 0) * 2);
  add("Type", attackerTypeModifier(attacker));
  add("Abilities", abilityModifier(target, { rangeBand, targetMovement }));
  const extra = otherModifiers.filter(n => n !== 0);
  if (extra.length) add("Other", extra.reduce((a, b) => a + b, 0));
  const tn = Math.max(2, breakdown.reduce((s, b) => s + b.value, 0));
  return { tn, breakdown, probability: hitProbability(tn), cannotAttack: false, reason: "" };
}
