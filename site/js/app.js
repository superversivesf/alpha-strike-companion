import { filterUnits, uniqueTypes, uniqueValues } from "./search.js";
import { renderCard } from "./cards.js";
import { initTooltips } from "./tooltips.js";
import {
  createEntry, damageArmor, damageStruct, setHeat, toggleCrit, setSkill, slugifyUnit,
  createGroup, addUnitToGroup, removeUnitFromGroup, setGroupName, groupNameForUnit, groupSizeForUnit,
} from "./state.js";
import { makeStorage } from "./storage.js";

const SAVE_DEBOUNCE_MS = 0;

let _doc = null;
let _storage = null;
let _units = [];
let _unitById = new Map();
let _state = { roster: [], groups: [] };
let _saveTimer = null;
let _groupCounter = 0;

function el(id) {
  return _doc.getElementById(id);
}

function persist() {
  _storage.saveState(_state);
}

function groupLabel(group) {
  if (group.size === 5) return "Star";
  if (group.size === 4) return "Lance";
  return "Group";
}

function nameGroup(group) {
  const label = groupLabel(group);
  const n = _state.groups.filter(g => groupLabel(g) === label).length + 1;
  return `${label} ${n}`;
}

function targetGroupFor(unit) {
  const size = groupSizeForUnit(unit);
  for (let i = _state.groups.length - 1; i >= 0; i--) {
    const g = _state.groups[i];
    if (g.size === size && g.unitIds.length < g.size) return g;
  }
  return null;
}

function renderGroupSection(group, entries) {
  const section = _doc.createElement("section");
  section.className = "group";
  section.dataset.groupId = group ? group.id : "ungrouped";

  const tab = _doc.createElement("div");
  tab.className = "group-tab";
  tab.textContent = group ? (group.name || groupLabel(group)) : "UNGROUPED";
  section.append(tab);

  const head = _doc.createElement("div");
  head.className = "group-head";
  if (group) {
    const nameInput = _doc.createElement("input");
    nameInput.className = "group-name";
    nameInput.value = group.name || groupLabel(group);
    nameInput.setAttribute("aria-label", "Group name");
    head.append(nameInput);
    const type = _doc.createElement("span");
    type.className = "group-type";
    type.textContent = groupLabel(group);
    head.append(type);
    const count = _doc.createElement("span");
    count.className = "group-count";
    count.textContent = `${entries.length}/${group.size}`;
    head.append(count);
    const del = _doc.createElement("button");
    del.type = "button";
    del.className = "group-delete";
    del.dataset.action = "delete-group";
    del.textContent = "\u2715";
    del.setAttribute("aria-label", "Delete group");
    head.append(del);
  } else {
    const type = _doc.createElement("span");
    type.className = "group-type";
    type.textContent = "Ungrouped";
    head.append(type);
  }
  section.append(head);

  const cards = _doc.createElement("div");
  cards.className = "group-cards";
  for (const entry of entries) {
    const unit = _unitById.get(entry.unitId);
    if (!unit) continue;
    cards.append(renderCard(unit, entry));
  }
  section.append(cards);
  return section;
}

function renderPicker() {
  const query = el("search").value;
  const type = el("type-filter").value;
  const era = el("era-filter").value;
  const side = el("side-filter").value;
  const role = el("role-filter").value;
  const size = el("size-filter").value;
  const list = el("picker-list");
  list.innerHTML = "";
  const matches = filterUnits(_units, { query, type, era, side, role, size });
  for (const unit of matches) {
    const li = _doc.createElement("li");
    const btn = _doc.createElement("button");
    btn.type = "button";
    btn.dataset.unitId = unit.id;
    const label = _doc.createElement("span");
    label.textContent = `${unit.class} ${unit.variant}`;
    const typeTag = _doc.createElement("span");
    typeTag.className = "type";
    typeTag.textContent = unit.type;
    const pv = _doc.createElement("span");
    pv.className = "pv";
    pv.textContent = `PV ${unit.pv}`;
    btn.append(label, typeTag, pv);
    li.append(btn);
    list.append(li);
  }
}

function renderRoster() {
  const roster = el("roster");
  roster.querySelectorAll(".group").forEach(s => s.remove());
  const empty = el("roster-empty");
  let totalPv = 0;

  const byGroup = new Map();
  const ungrouped = [];
  for (const entry of _state.roster) {
    const g = _state.groups.find(grp => grp.unitIds.includes(entry.id));
    if (g) {
      if (!byGroup.has(g.id)) byGroup.set(g.id, []);
      byGroup.get(g.id).push(entry);
    } else {
      ungrouped.push(entry);
    }
    const unit = _unitById.get(entry.unitId);
    if (unit) totalPv += unit.pv;
  }

  for (const group of _state.groups) {
    roster.append(renderGroupSection(group, byGroup.get(group.id) || []));
  }
  if (ungrouped.length) {
    roster.append(renderGroupSection(null, ungrouped));
  }

  el("force-pv").textContent = `Force PV: ${totalPv}`;
  empty.style.display = _state.roster.length ? "none" : "";
}

function updateEntry(entryId, mutate) {
  const idx = _state.roster.findIndex(e => e.id === entryId);
  if (idx === -1) return;
  const unit = _unitById.get(_state.roster[idx].unitId);
  const next = mutate(_state.roster[idx], unit);
  _state = { ..._state, roster: _state.roster.map((e, i) => (i === idx ? next : e)) };
  persist();
  renderRoster();
}

export async function init({ doc, storage }) {
  _doc = doc;
  _storage = storage;
  initTooltips(doc);
  const res = await fetch("data/units.json");
  if (!res.ok) throw new Error(`Failed to load units.json: ${res.status}`);
  const payload = await res.json();
  _units = payload.units;
  _unitById = new Map(_units.map(u => [u.id, u]));
  if (!storage.importState) {
    _storage = makeStorage(_unitById, _doc.defaultView.localStorage);
  }
  _state = _storage.loadState() || { roster: [], groups: [] };
  if (!Array.isArray(_state.groups)) _state = { ..._state, groups: [] };
  _groupCounter = _state.groups.length;

  const typeFilter = el("type-filter");
  const eraFilter = el("era-filter");
  const sideFilter = el("side-filter");
  const roleFilter = el("role-filter");
  const sizeFilter = el("size-filter");

  function populateFilter(select, values) {
    for (const v of values) {
      const opt = _doc.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.append(opt);
    }
  }
  populateFilter(typeFilter, uniqueTypes(_units));
  populateFilter(eraFilter, uniqueValues(_units, "era"));
  populateFilter(sideFilter, uniqueValues(_units, "tech"));
  populateFilter(roleFilter, uniqueValues(_units, "role"));
  for (const size of ["1", "2", "3", "4"]) {
    const opt = _doc.createElement("option");
    opt.value = size;
    opt.textContent = `Size ${size}`;
    sizeFilter.append(opt);
  }

  el("search").addEventListener("input", renderPicker);
  for (const f of [typeFilter, eraFilter, sideFilter, roleFilter, sizeFilter]) {
    f.addEventListener("change", renderPicker);
  }

  el("picker-list").addEventListener("click", e => {
    const btn = e.target.closest("button[data-unit-id]");
    if (!btn) return;
    const unit = _unitById.get(btn.dataset.unitId);
    if (!unit) return;
    const entry = createEntry(unit);
    let groups = _state.groups;
    const target = targetGroupFor(unit);
    if (target) {
      groups = groups.map(g => (g.id === target.id ? addUnitToGroup(g, entry.id) : g));
    } else {
      const g = createGroup(unit);
      g.name = nameGroup(g);
      g.unitIds = [entry.id];
      groups = [...groups, g];
    }
    _state = { ..._state, roster: [..._state.roster, entry], groups };
    persist();
    renderRoster();
  });

  el("roster").addEventListener("click", e => {
    const card = e.target.closest(".card");
    if (card) {
      const entryId = card.dataset.entryId;
      if (e.target.dataset.action === "remove") {
        const nextGroups = _state.groups
          .map(g => removeUnitFromGroup(g, entryId))
          .filter(g => g.unitIds.length > 0);
        _state = {
          ..._state,
          roster: _state.roster.filter(entry => entry.id !== entryId),
          groups: nextGroups,
        };
        persist();
        renderRoster();
        return;
      }
      if (e.target.dataset.action === "armor") {
        updateEntry(entryId, (entry, unit) => damageArmor(entry, unit, Number(e.target.dataset.index)));
        return;
      }
      if (e.target.dataset.action === "struct") {
        updateEntry(entryId, (entry, unit) => damageStruct(entry, unit, Number(e.target.dataset.index)));
        return;
      }
      if (e.target.dataset.heat) {
        updateEntry(entryId, entry => setHeat(entry, e.target.dataset.heat === "S" ? "S" : Number(e.target.dataset.heat)));
        return;
      }
      if (e.target.dataset.action === "set-skill") {
        const select = card.querySelector(".skill-select");
        if (!select) return;
        updateEntry(entryId, entry => setSkill(entry, Number(select.value)));
        return;
      }
      if (e.target.dataset.crit) {
        updateEntry(entryId, (entry, unit) => toggleCrit(entry, unit, e.target.dataset.crit, Number(e.target.dataset.index)));
      }
      return;
    }
    const del = e.target.closest('[data-action="delete-group"]');
    if (del) {
      const section = del.closest(".group");
      const gid = section && section.dataset.groupId;
      if (gid && gid !== "ungrouped") {
        _state = { ..._state, groups: _state.groups.filter(g => g.id !== gid) };
        persist();
        renderRoster();
      }
      return;
    }
    const nameInput = e.target.closest(".group-name");
    if (nameInput) {
      const section = nameInput.closest(".group");
      const gid = section && section.dataset.groupId;
      if (gid && gid !== "ungrouped") {
        _state = {
          ..._state,
          groups: _state.groups.map(g => (g.id === gid ? setGroupName(g, nameInput.value) : g)),
        };
        persist();
      }
    }
  });

  el("roster").addEventListener("input", e => {
    const nameInput = e.target.closest(".group-name");
    if (!nameInput) return;
    const section = nameInput.closest(".group");
    const gid = section && section.dataset.groupId;
    if (gid && gid !== "ungrouped") {
      _state = {
        ..._state,
        groups: _state.groups.map(g => (g.id === gid ? setGroupName(g, nameInput.value) : g)),
      };
      persist();
    }
  });

  el("btn-clear").addEventListener("click", () => {
    _state = { roster: [], groups: [] };
    persist();
    renderRoster();
  });

  el("picker-toggle").addEventListener("click", () => {
    el("picker").classList.toggle("collapsed");
  });

  el("btn-export").addEventListener("click", () => {
    const { exportBlob } = _storage;
    if (!exportBlob) return;
    const { filename, text } = exportBlob(_state);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = _doc.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  el("btn-import").addEventListener("click", () => el("import-file").click());
  el("import-file").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      _state = _storage.importState(text);
      if (!Array.isArray(_state.groups)) _state = { ..._state, groups: [] };
      persist();
      renderRoster();
    } catch (err) {
      window.alert(`Import failed: ${err.message}`);
    }
    e.target.value = "";
  });

  renderPicker();
  renderRoster();
}

if (typeof window !== "undefined" && !window.__AS_MANUAL__) {
  init({ doc: document, storage: { loadState: () => JSON.parse(localStorage.getItem("as-companion-state-v1") || "null"), saveState: s => localStorage.setItem("as-companion-state-v1", JSON.stringify(s)), exportBlob: s => ({ filename: "as-companion-state.json", text: JSON.stringify(s, null, 2) }) } });
}
