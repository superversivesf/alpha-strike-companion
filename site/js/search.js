export function filterUnits(units, { query = "", type = "", era = "", side = "", role = "", size = "" } = {}) {
  const q = query.trim().toLowerCase();
  return units.filter(u => {
    if (type && u.type !== type) return false;
    if (era && u.era !== era) return false;
    if (side && u.tech !== side) return false;
    if (role && u.role !== role) return false;
    if (size && String(u.size) !== size) return false;
    if (!q) return true;
    return `${u.class} ${u.variant}`.toLowerCase().includes(q);
  });
}

export function uniqueTypes(units) {
  return [...new Set(units.map(u => u.type).filter(t => t && t !== "UNK"))].sort();
}

export function uniqueValues(units, key) {
  return [...new Set(units.map(u => u[key]).filter(v => v))].sort();
}
