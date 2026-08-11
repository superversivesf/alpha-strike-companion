export function filterUnits(units, { query = "", type = "" } = {}) {
  const q = query.trim().toLowerCase();
  return units.filter(u => {
    if (type && u.type !== type) return false;
    if (!q) return true;
    return `${u.class} ${u.variant}`.toLowerCase().includes(q);
  });
}

export function uniqueTypes(units) {
  return [...new Set(units.map(u => u.type).filter(t => t && t !== "UNK"))].sort();
}
