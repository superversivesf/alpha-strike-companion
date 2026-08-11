export const HEAT_LEVELS = [1, 2, 3, "S"];

export const CRIT_TYPES = ["engine", "fireControl", "mp", "weapons", "thruster", "fuel", "crew"];

const GROUND_CRIT_CAPS = { engine: 1, fireControl: 4, mp: 4, weapons: 4 };
const AEROSPACE_CRIT_CAPS = { engine: 2, fireControl: 4, weapons: 4, thruster: 1, fuel: 1, crew: 2 };

export const GROUND_CRITS = ["engine", "fireControl", "mp", "weapons"];
export const AEROSPACE_CRITS = ["engine", "fireControl", "weapons", "thruster", "fuel", "crew"];

const AEROSPACE_TYPES = ["AF", "CF", "DS", "DA", "SC"];

export const HEAT_TRACKING_TYPES = ["BM", "IM", "AF"];

export function isAerospaceUnit(unit) {
  return AEROSPACE_TYPES.includes(unit.type);
}

export function critCap(unit, type) {
  const caps = isAerospaceUnit(unit) ? AEROSPACE_CRIT_CAPS : GROUND_CRIT_CAPS;
  return caps[type] ?? 3;
}

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
  return isAerospaceUnit(unit) ? AEROSPACE_CRITS : GROUND_CRITS;
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
    skill: typeof unit.skill === "number" ? unit.skill : 4,
    skillSet: false,
  };
}

export function setSkill(entry, value) {
  const v = Math.max(0, Math.min(6, Math.floor(Number(value) || 0)));
  return { ...entry, skill: v, skillSet: true };
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

export function toggleCrit(entry, unit, type, index) {
  const cap = critCap(unit, type);
  if (index < 0 || index >= cap) return entry;
  const current = entry.crits[type] ?? 0;
  const target = index + 1;
  const next = current === target ? current - 1 : target;
  return { ...entry, crits: { ...entry.crits, [type]: next } };
}

export function isClanUnit(unit) {
  return (unit.tech || "").toLowerCase().includes("clan");
}

export function groupSizeForUnit(unit) {
  return isClanUnit(unit) ? 5 : 4;
}

export function groupNameForUnit(unit) {
  return isClanUnit(unit) ? "Star" : "Lance";
}

export function createGroup(unit) {
  return {
    id: `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    size: groupSizeForUnit(unit),
    unitIds: [],
  };
}

export function addUnitToGroup(group, unitId) {
  if (group.unitIds.length >= group.size) return group;
  if (group.unitIds.includes(unitId)) return group;
  return { ...group, unitIds: [...group.unitIds, unitId] };
}

export function removeUnitFromGroup(group, unitId) {
  return { ...group, unitIds: group.unitIds.filter(id => id !== unitId) };
}

export function setGroupName(group, name) {
  return { ...group, name };
}

export function isGroupValid(group) {
  return Boolean(
    group &&
    typeof group.id === "string" &&
    typeof group.size === "number" &&
    group.size >= 1 &&
    Array.isArray(group.unitIds) &&
    group.unitIds.every(id => typeof id === "string")
  );
}

export function isEntryValid(entry, unit) {
  if (typeof entry.armorDamage !== "number" || entry.armorDamage < 0 || entry.armorDamage > unit.armor) return false;
  if (typeof entry.structDamage !== "number" || entry.structDamage < 0 || entry.structDamage > unit.structure) return false;
  if (!(entry.heat === 0 || entry.heat === 1 || entry.heat === 2 || entry.heat === 3 || entry.heat === "S")) return false;
  if (!entry.crits || typeof entry.crits !== "object") return false;
  for (const type of CRIT_TYPES) {
    const v = entry.crits[type];
    if (typeof v !== "number" || v < 0 || v > critCap(unit, type)) return false;
  }
  if (typeof entry.skill !== "number" || entry.skill < 0 || entry.skill > 6) return false;
  return true;
}
