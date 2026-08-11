export const HEAT_LEVELS = [1, 2, 3, "S"];
export const CRIT_SLOTS = 12;

export function slugifyUnit(className, variant) {
  return `${className} ${variant}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createEntry(unit) {
  return {
    unitId: unit.id,
    armorDamage: 0,
    structDamage: 0,
    heat: 0,
    crits: Array(CRIT_SLOTS).fill(false),
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

export function toggleCrit(entry, index) {
  const crits = entry.crits.slice();
  crits[index] = !crits[index];
  return { ...entry, crits };
}

export function isEntryValid(entry, unit) {
  if (typeof entry.armorDamage !== "number" || entry.armorDamage < 0 || entry.armorDamage > unit.armor) return false;
  if (typeof entry.structDamage !== "number" || entry.structDamage < 0 || entry.structDamage > unit.structure) return false;
  if (!(entry.heat === 0 || entry.heat === 1 || entry.heat === 2 || entry.heat === 3 || entry.heat === "S")) return false;
  if (!Array.isArray(entry.crits) || entry.crits.length !== CRIT_SLOTS) return false;
  return entry.crits.every(c => typeof c === "boolean");
}
