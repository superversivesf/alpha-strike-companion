import { CRIT_TYPES, critCap, isEntryValid, isGroupValid } from "./state.js";

export const STORAGE_KEY = "as-companion-state-v1";

export const DEFAULT_STATE = { roster: [], groups: [] };

export function loadState(ls = globalThis.localStorage) {
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.roster)) return DEFAULT_STATE;
    return { roster: parsed.roster, groups: Array.isArray(parsed.groups) ? parsed.groups : [] };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state, ls = globalThis.localStorage) {
  ls.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function validateState(obj, unitById) {
  if (!obj || !Array.isArray(obj.roster)) return false;
  if (!obj.roster.every(entry => {
    const unit = unitById.get(entry.unitId);
    return unit && isEntryValid(entry, unit);
  })) return false;
  if (obj.groups !== undefined && !Array.isArray(obj.groups)) return false;
  if (Array.isArray(obj.groups) && !obj.groups.every(g => isGroupValid(g))) return false;
  return true;
}

export function sanitizeState(obj, unitById) {
  if (!obj || !Array.isArray(obj.roster)) return DEFAULT_STATE;
  const seen = new Set();
  const roster = obj.roster
    .filter(entry => entry && unitById.has(entry.unitId))
    .filter(entry => {
      const id = typeof entry.id === "string" && entry.id ? entry.id : null;
      if (id && seen.has(id)) return false;
      if (id) seen.add(id);
      return true;
    })
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
      const skill = typeof entry.skill === "number" ? Math.max(0, Math.min(6, Math.floor(entry.skill))) : (typeof unit.skill === "number" ? unit.skill : 4);
      const skillSet = Boolean(entry.skillSet);
      const id = typeof entry.id === "string" && entry.id
        ? entry.id
        : `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      return { id, unitId: entry.unitId, armorDamage, structDamage, heat, crits, skill, skillSet };
    });
  const rosterIds = new Set(roster.map(e => e.id));
  const groups = Array.isArray(obj.groups)
    ? obj.groups
        .filter(g => isGroupValid(g))
        .map(g => {
          const size = Math.max(1, Math.min(10, Math.floor(Number(g.size) || 4)));
          const seenIds = new Set();
          return {
            id: g.id,
            name: typeof g.name === "string" ? g.name : "",
            size,
            unitIds: g.unitIds
              .filter(id => rosterIds.has(id))
              .filter(id => {
                if (seenIds.has(id)) return false;
                seenIds.add(id);
                return true;
              })
              .slice(0, size),
          };
        })
    : [];
  return { roster, groups };
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
