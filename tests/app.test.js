import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { slugifyUnit } from "../site/js/state.js";

const UNITS = [
  { id: slugifyUnit("ATLAS", "AS7-D"), class: "ATLAS", variant: "AS7-D", type: "BM", size: 4, tmm: 1, move: "6", role: "Juggernaut", skill: 4, damage: { s: 5, m: 5, l: 2 }, overheat: 0, armor: 10, structure: 8, pv: 52, abilities: [], image: "" },
  { id: slugifyUnit("ATLAS", "AS7-K"), class: "ATLAS", variant: "AS7-K", type: "BM", size: 4, tmm: 1, move: "6", role: "Sniper", skill: 4, damage: { s: 4, m: 4, l: 3 }, overheat: 0, armor: 10, structure: 8, pv: 49, abilities: [], image: "" },
  { id: slugifyUnit("Trooper", "TP-1R"), class: "Trooper", variant: "TP-1R", type: "UNK", size: 1, tmm: 0, move: "12\"", role: "Scout", skill: 4, damage: { s: 1, m: 1, l: 0 }, overheat: 0, armor: 2, structure: 1, pv: 14, abilities: [], image: "" },
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
    loadState: () => state,
    saveState: s => saved.push(s),
  };
  await app.init({ doc: window.document, storage });
  return { window, document: window.document, saved, app };
}

test("init loads units, populates type filter and picker", async () => {
  const { document } = await boot();
  const options = [...document.querySelectorAll("#type-filter option")].map(o => o.value);
  assert.deepEqual(options, ["", "BM"]);
  const items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 3);
  assert.match(items[0].textContent, /ATLAS/);
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
  const { document } = await boot();
  const first = document.querySelector("#picker-list li button");
  first.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  first.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const cards = document.querySelectorAll("#roster .card");
  assert.equal(cards.length, 2);
  assert.equal(document.getElementById("force-pv").textContent, "Force PV: 104");
  assert.equal(document.getElementById("roster-empty").style.display, "none");
});

test("roster click delegation applies armor damage and saves", async () => {
  const { document, saved } = await boot();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const pip = document.querySelector('#roster .card .pip[data-action="armor"][data-index="2"]');
  pip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll('#roster .card .pip[data-action="armor"].damaged').length, 3);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].roster[0].armorDamage, 3);
});

test("heat, crit, and remove actions", async () => {
  const { document } = await boot();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const heatBtn = document.querySelector('#roster .heat-btn[data-heat="2"]');
  heatBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.ok(document.querySelector('#roster .heat-btn[data-heat="2"].active'));
  const crit = document.querySelector('#roster .crit-slot[data-crit="4"]');
  crit.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.ok(document.querySelector('#roster .crit-slot[data-crit="4"].filled'));
  document.querySelector('#roster .card-remove').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 0);
  assert.equal(document.getElementById("roster-empty").style.display, "");
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
