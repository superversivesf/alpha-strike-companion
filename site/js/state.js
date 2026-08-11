export const HEAT_LEVELS = [1, 2, 3, "S"];

export const CRIT_TYPES = ["engine", "fireControl", "mp", "weapons", "thruster", "fuel", "crew"];

export const CRIT_CAPS = {
  engine: 2,
  fireControl: 3,
  mp: 3,
  weapons: 3,
  thruster: 1,
  fuel: 1,
  crew: 2,
};

export const GROUND_CRITS = ["engine", "fireControl", "mp", "weapons"];
export const AEROSPACE_CRITS = ["engine", "fireControl", "weapons", "thruster", "fuel", "crew"];

export const HEAT_TRACKING_TYPES = ["BM", "IM", "AF"];

export function slugifyUnit(className, variant) {
  return `${className} ${variant}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function tracksHeat(unit) {
  return HEAT_TRACKING_TYPES.includes(unit.type);
}

export function critTypesForUnit(unit) {
  const aerospace = ["AF", "CF", "DS", "DA", "SC"].includes(unit.type);
  return aerospace ? AEROSPACE_CRITS : GROUND_CRITS;
}

export function createEntry(unit) {
  const crits = {};
  for (const type of CRIT_TYPES) crits[type] = 0;
  return {
    unitId: unit.id,
    armorDamage: 0,
    structDamage: 0,
    heat: 0,
    crits,
  };
}

function clickTrack(current, index) {
  const next = index + 1;
  if (current === next) return current - 1;
  if (index < current) return index;
  return next;
}

export function damageArmor(entry, unit, index) {
  return {
    ...entry,
    armorDamage: Math.max(0, Math.min(unit.armor, clickTrack(entry.armorDamage, index))),
  };
}

export function damageStruct(entry, unit, index) {
  return {
    ...entry,
    structDamage: Math.max(0, Math.min(unit.structure, clickTrack(entry.structDamage, index))),
  };
}

export function setHeat(entry, level) {
  return { ...entry, heat: entry.heat === level ? 0 : level };
}

export function toggleCrit(entry, type) {
  const cap = CRIT_CAPS[type] ?? 3;
  const current = entry.crits[type] ?? 0;
  const next = (current + 1) % (cap + 1);
  return { ...entry, crits: { ...entry.crits, [type]: next } };
}

export function isEntryValid(entry, unit) {
  if (typeof entry.armorDamage !== "number" || entry.armorDamage < 0 || entry.armorDamage > unit.armor) return false;
  if (typeof entry.structDamage !== "number" || entry.structDamage < 0 || entry.structDamage > unit.structure) return false;
  if (!(entry.heat === 0 || entry.heat === 1 || entry.heat === 2 || entry.heat === 3 || entry.heat === "S")) return false;
  if (!entry.crits || typeof entry.crits !== "object") return false;
  for (const type of CRIT_TYPES) {
    const v = entry.crits[type];
    if (typeof v !== "number" || v < 0 || v > (CRIT_CAPS[type] ?? 3)) return false;
  }
  return true;
}
