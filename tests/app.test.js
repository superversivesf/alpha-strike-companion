import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { slugifyUnit } from "../site/js/state.js";

const UNITS = [
  { id: slugifyUnit("ATLAS", "AS7-D"), class: "ATLAS", variant: "AS7-D", type: "BM", size: 4, tmm: 1, move: "6", role: "Juggernaut", skill: 4, damage: { s: 5, m: 5, l: 2 }, overheat: 0, armor: 10, structure: 8, pv: 52, abilities: [], image: "", tech: "Inner Sphere", era: "Star League" },
  { id: slugifyUnit("ATLAS", "AS7-K"), class: "ATLAS", variant: "AS7-K", type: "BM", size: 4, tmm: 1, move: "6", role: "Sniper", skill: 4, damage: { s: 4, m: 4, l: 3 }, overheat: 0, armor: 10, structure: 8, pv: 49, abilities: [], image: "", tech: "Inner Sphere", era: "Star League" },
  { id: slugifyUnit("Trooper", "TP-1R"), class: "Trooper", variant: "TP-1R", type: "UNK", size: 1, tmm: 0, move: "12\"", role: "Scout", skill: 4, damage: { s: 1, m: 1, l: 0 }, overheat: 0, armor: 2, structure: 1, pv: 14, abilities: [], image: "", tech: "Clan", era: "Clan Invasion" },
];

async function boot({ state = { roster: [] } } = {}) {
  const html = readFileSync("site/index.html", "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ units: UNITS }) });
  window.__AS_MANUAL__ = true;
  const app = await import("../site/js/app.js");
  const saved = [];
  const storage = {
    importState: text => JSON.parse(text),
    exportBlob: () => ({}),
    loadState: () => state,
    saveState: s => saved.push(s),
  };
  await app.init({ doc: window.document, storage });
  return { window, document: window.document, saved, app };
}

test("init loads units, populates filters and picker", async () => {
  const { document } = await boot();
  const typeOptions = [...document.querySelectorAll("#type-filter option")].map(o => o.value);
  assert.deepEqual(typeOptions, ["", "BM"]);
  const typeLabels = [...document.querySelectorAll("#type-filter option")].map(o => o.textContent);
  assert.deepEqual(typeLabels, ["All types", "BattleMech (BM)"]);
  const eraOptions = [...document.querySelectorAll("#era-filter option")].map(o => o.value);
  assert.deepEqual(eraOptions, ["", "Clan Invasion", "Star League"]);
  const sideOptions = [...document.querySelectorAll("#side-filter option")].map(o => o.value);
  assert.deepEqual(sideOptions, ["", "Clan", "Inner Sphere"]);
  const roleOptions = [...document.querySelectorAll("#role-filter option")].map(o => o.value);
  assert.deepEqual(roleOptions, ["", "Juggernaut", "Scout", "Sniper"]);
  const sizeOptions = [...document.querySelectorAll("#size-filter option")].map(o => o.value);
  assert.deepEqual(sizeOptions, ["", "1", "2", "3", "4"]);
  const items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 3);
  assert.match(items[0].textContent, /ATLAS/);
  assert.match(items[0].textContent, /BattleMech/);
});

test("picker filters narrow the unit list", async () => {
  const { document } = await boot();
  const era = document.getElementById("era-filter");
  era.value = "Clan Invasion";
  era.dispatchEvent(new window.Event("change", { bubbles: true }));
  let items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /Trooper/);
  era.value = "";
  era.dispatchEvent(new window.Event("change", { bubbles: true }));

  const side = document.getElementById("side-filter");
  side.value = "Inner Sphere";
  side.dispatchEvent(new window.Event("change", { bubbles: true }));
  items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 2);
  side.value = "";
  side.dispatchEvent(new window.Event("change", { bubbles: true }));

  const role = document.getElementById("role-filter");
  role.value = "Sniper";
  role.dispatchEvent(new window.Event("change", { bubbles: true }));
  items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /AS7-K/);
  role.value = "";
  role.dispatchEvent(new window.Event("change", { bubbles: true }));

  const size = document.getElementById("size-filter");
  size.value = "1";
  size.dispatchEvent(new window.Event("change", { bubbles: true }));
  items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /Trooper/);

  // Combined: Clan + size 1
  side.value = "Clan";
  side.dispatchEvent(new window.Event("change", { bubbles: true }));
  items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /Trooper/);
});

test("search narrows picker; type filter excludes UNK", async () => {
  const { document } = await boot();
  const input = document.getElementById("search");
  input.value = "as7-k";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  let items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /AS7-K/);
  input.value = "";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  const filter = document.getElementById("type-filter");
  filter.value = "BM";
  filter.dispatchEvent(new window.Event("change", { bubbles: true }));
  items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 2);
});

test("adding units renders cards and updates force PV", async () => {
  const { document, saved } = await boot();
  const first = document.querySelector("#picker-list li button");
  first.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  first.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const cards = document.querySelectorAll("#roster .card");
  assert.equal(cards.length, 2);
  assert.equal(document.getElementById("force-pv").textContent, "Force PV: 104");
  assert.equal(document.getElementById("roster-empty").style.display, "none");
  assert.equal(saved.length, 2);
  assert.equal(saved[0].roster.length, 1);
});

test("roster click delegation applies armor damage and saves", async () => {
  const { document, saved } = await boot();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const pip = document.querySelector('#roster .card .pip[data-action="armor"][data-index="2"]');
  pip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll('#roster .card .pip[data-action="armor"].damaged').length, 3);
  assert.equal(saved.length, 2);
  assert.equal(saved[1].roster[0].armorDamage, 3);
});

test("heat, crit, and remove actions", async () => {
  const { document } = await boot();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const heatBtn = document.querySelector('#roster .heat-btn[data-heat="2"]');
  heatBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.ok(document.querySelector('#roster .heat-btn[data-heat="2"].active'));
  const crit = document.querySelector('#roster .crit-slot[data-crit="weapons"][data-index="0"]');
  crit.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.ok(document.querySelector('#roster .crit-slot[data-crit="weapons"][data-index="0"].filled'));
  document.querySelector('#roster .card-remove').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 0);
  assert.equal(document.getElementById("roster-empty").style.display, "");
});

test("set-skill fixes the skill and persists", async () => {
  const { document, saved } = await boot();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const select = document.querySelector('#roster .card .skill-select');
  select.value = "3";
  const setBtn = document.querySelector('#roster .card .skill-set');
  setBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelector('#roster .card .skill-value').textContent, "3");
  assert.equal(document.querySelectorAll('#roster .card .skill-select').length, 0);
  assert.equal(saved.at(-1).roster[0].skill, 3);
  assert.equal(saved.at(-1).roster[0].skillSet, true);
});

test("removing one duplicate unit keeps the other", async () => {
  const { document } = await boot();
  const first = document.querySelector("#picker-list li button");
  first.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  first.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 2);
  const cards = document.querySelectorAll("#roster .card");
  cards[0].querySelector(".card-remove").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 1);
  assert.equal(document.querySelectorAll("#roster .group")[0].querySelectorAll(".card").length, 1);
});

test("removing the last unit deletes its group", async () => {
  const { document } = await boot();
  const first = document.querySelector("#picker-list li button");
  first.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .group").length, 1);
  document.querySelector("#roster .card-remove").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .group").length, 0);
  assert.equal(document.querySelectorAll("#roster .card").length, 0);
});

test("picker toggle collapses the list", async () => {
  const { document } = await boot();
  const picker = document.getElementById("picker");
  assert.ok(!picker.classList.contains("collapsed"));
  document.getElementById("picker-toggle").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.ok(picker.classList.contains("collapsed"));
});

test("clear force empties roster and saves", async () => {
  const { document, saved } = await boot();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  document.getElementById("btn-clear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 0);
  assert.deepEqual(saved.at(-1).roster, []);
});

test("import via file input renders imported roster", async () => {
  const { document, window } = await boot();
  const importState = { roster: [{ id: "e-import-1", unitId: "atlas-as7-d", armorDamage: 2, structDamage: 1, heat: 0, crits: { engine: 0, fireControl: 0, mp: 0, weapons: 0, thruster: 0, fuel: 0, crew: 0 } }] };
  const file = new window.File([JSON.stringify(importState)], "test.json", { type: "application/json" });
  file.text = async () => JSON.stringify(importState);
  const input = document.getElementById("import-file");
  Object.defineProperty(input, "files", { value: [file], writable: false });
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
  await new Promise(r => setTimeout(r, 50));
  const cards = document.querySelectorAll("#roster .card");
  assert.equal(cards.length, 1);
  assert.match(cards[0].querySelector(".card-title").textContent, /ATLAS/);
  assert.equal(document.querySelectorAll(".pip.damaged").length, 3);
});
