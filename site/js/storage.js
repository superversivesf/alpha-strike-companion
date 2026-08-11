import { CRIT_TYPES, critCap, isEntryValid } from "./state.js";

export const STORAGE_KEY = "as-companion-state-v1";

export const DEFAULT_STATE = { roster: [] };

export function loadState(ls = globalThis.localStorage) {
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.roster) ? parsed : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state, ls = globalThis.localStorage) {
  ls.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function validateState(obj, unitById) {
  if (!obj || !Array.isArray(obj.roster)) return false;
  return obj.roster.every(entry => {
    const unit = unitById.get(entry.unitId);
    return unit && isEntryValid(entry, unit);
  });
}

export function sanitizeState(obj, unitById) {
  if (!obj || !Array.isArray(obj.roster)) return DEFAULT_STATE;
  const roster = obj.roster
    .filter(entry => entry && unitById.has(entry.unitId))
    .map(entry => {
      const unit = unitById.get(entry.unitId);
      const armorDamage = Math.max(0, Math.min(unit.armor, Number(entry.armorDamage) || 0));
      const structDamage = Math.max(0, Math.min(unit.structure, Number(entry.structDamage) || 0));
      const heat = [0, 1, 2, 3, "S"].includes(entry.heat) ? entry.heat : 0;
      const crits = {};
      for (const type of CRIT_TYPES) {
        const v = entry.crits && entry.crits[type];
        const n = typeof v === "number" ? Math.floor(v) : 0;
        crits[type] = Math.max(0, Math.min(critCap(unit, type), n));
      }
      return { unitId: entry.unitId, armorDamage, structDamage, heat, crits };
    });
  return { roster };
}

export function exportBlob(state) {
  return {
    filename: "as-companion-state.json",
    text: JSON.stringify(state, null, 2),
  };
}

export function importState(text, unitById) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("parse failed");
  }
  if (!parsed || !Array.isArray(parsed.roster)) {
    throw new Error("missing roster array");
  }
  return sanitizeState(parsed, unitById);
}

export function makeStorage(unitById, ls = globalThis.localStorage) {
  return {
    loadState: () => loadState(ls),
    saveState: s => saveState(s, ls),
    validateState: obj => validateState(obj, unitById),
    sanitizeState: obj => sanitizeState(obj, unitById),
    exportBlob,
    importState: text => importState(text, unitById),
  };
}
