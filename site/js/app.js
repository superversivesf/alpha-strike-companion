import { filterUnits, uniqueTypes } from "./search.js";
import { renderCard } from "./cards.js";
import { initTooltips } from "./tooltips.js";
import {
  createEntry, damageArmor, damageStruct, setHeat, toggleCrit, setSkill, slugifyUnit,
} from "./state.js";
import { makeStorage } from "./storage.js";

const SAVE_DEBOUNCE_MS = 0;

let _doc = null;
let _storage = null;
let _units = [];
let _unitById = new Map();
let _state = { roster: [] };
let _saveTimer = null;

function el(id) {
  return _doc.getElementById(id);
}

function persist() {
  _storage.saveState(_state);
}
function renderPicker() {
  const query = el("search").value;
  const type = el("type-filter").value;
  const list = el("picker-list");
  list.innerHTML = "";
  const matches = filterUnits(_units, { query, type });
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
  roster.querySelectorAll(".card").forEach(c => c.remove());
  const empty = el("roster-empty");
  let totalPv = 0;
  for (const entry of _state.roster) {
    const unit = _unitById.get(entry.unitId);
    if (!unit) continue;
    totalPv += unit.pv;
    roster.append(renderCard(unit, entry));
  }
  el("force-pv").textContent = `Force PV: ${totalPv}`;
  empty.style.display = _state.roster.length ? "none" : "";
}

function updateEntry(unitId, mutate) {
  const idx = _state.roster.findIndex(e => e.unitId === unitId);
  if (idx === -1) return;
  const unit = _unitById.get(unitId);
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
  _state = _storage.loadState() || { roster: [] };

  const typeFilter = el("type-filter");
  for (const type of uniqueTypes(_units)) {
    const opt = _doc.createElement("option");
    opt.value = type;
    opt.textContent = type;
    typeFilter.append(opt);
  }

  el("search").addEventListener("input", renderPicker);
  typeFilter.addEventListener("change", renderPicker);

  el("picker-list").addEventListener("click", e => {
    const btn = e.target.closest("button[data-unit-id]");
    if (!btn) return;
    const unit = _unitById.get(btn.dataset.unitId);
    if (!unit) return;
    _state = { ..._state, roster: [..._state.roster, createEntry(unit)] };
    persist();
    renderRoster();
    /* no re-render of picker */
  });

  el("roster").addEventListener("click", e => {
    const card = e.target.closest(".card");
    if (!card) return;
    const unitId = card.dataset.unitId;
    if (e.target.dataset.action === "remove") {
      _state = { ..._state, roster: _state.roster.filter(entry => entry.unitId !== unitId) };
      persist();
      renderRoster();
      return;
    }
    if (e.target.dataset.action === "armor") {
      updateEntry(unitId, (entry, unit) => damageArmor(entry, unit, Number(e.target.dataset.index)));
      return;
    }
    if (e.target.dataset.action === "struct") {
      updateEntry(unitId, (entry, unit) => damageStruct(entry, unit, Number(e.target.dataset.index)));
      return;
    }
    if (e.target.dataset.heat) {
      updateEntry(unitId, entry => setHeat(entry, e.target.dataset.heat === "S" ? "S" : Number(e.target.dataset.heat)));
      return;
    }
    if (e.target.dataset.action === "set-skill") {
      const select = card.querySelector(".skill-select");
      if (!select) return;
      updateEntry(unitId, entry => setSkill(entry, Number(select.value)));
      return;
    }
    if (e.target.dataset.crit) {
      updateEntry(unitId, (entry, unit) => toggleCrit(entry, unit, e.target.dataset.crit, Number(e.target.dataset.index)));
    }
  });

  el("btn-clear").addEventListener("click", () => {
    _state = { roster: [] };
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
