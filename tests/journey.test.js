import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { slugifyUnit } from "../site/js/state.js";
import { makeStorage } from "../site/js/storage.js";

const UNITS = [
  { id: slugifyUnit("ATLAS", "AS7-D"), class: "ATLAS", variant: "AS7-D", type: "BM", size: 4, tmm: 1, move: "6", role: "Juggernaut", skill: 4, damage: { s: 5, m: 5, l: 2 }, overheat: 0, armor: 10, structure: 8, pv: 52, abilities: ["AC2/2/-", "IF1"], image: "" },
  { id: slugifyUnit("AWESOME", "AWS-8Q"), class: "AWESOME", variant: "AWS-8Q", type: "BM", size: 4, tmm: 0, move: "5", role: "Sniper", skill: 4, damage: { s: 5, m: 5, l: 5 }, overheat: 1, armor: 12, structure: 10, pv: 44, abilities: ["ENE"], image: "" },
  { id: slugifyUnit("Demolisher Heavy Tank", "Std"), class: "Demolisher Heavy Tank", variant: "Std", type: "CV", size: 4, tmm: 0, move: "4\"", role: "Juggernaut", skill: 4, damage: { s: 6, m: 4, l: 2 }, overheat: 0, armor: 10, structure: 6, pv: 36, abilities: [], image: "" },
];

async function boot(ls) {
  const html = readFileSync("site/index.html", "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  if (ls) {
    Object.defineProperty(window, 'localStorage', { value: ls, writable: false });
  }
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ units: UNITS }) });
  window.__AS_MANUAL__ = true;
  const app = await import("../site/js/app.js");
  const storage = makeStorage(new Map(UNITS.map(u => [u.id, u])), window.localStorage);
  await app.init({ doc: window.document, storage });
  return { window, document: window.document, storage };
}

function click(el, win) {
  el.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
}

async function settle() {
  await new Promise(r => setTimeout(r, 200));
}

test("JOURNEY: full game night — deploy, damage, heat, crits, refresh, export/import", async () => {
  const { window, document, storage } = await boot();
  const ls = window.localStorage;

  // Deploy an Atlas and an Awesome via search
  const search = document.getElementById("search");
  search.value = "atlas";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  await settle();
  let items = [...document.querySelectorAll("#picker-list li button")];
  assert.equal(items.length, 1);
  click(items[0], window);

  search.value = "awesome";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  await settle();
  items = [...document.querySelectorAll("#picker-list li button")];
  assert.equal(items.length, 1);
  click(items[0], window);

  assert.equal(document.querySelectorAll("#roster .card").length, 2);
  assert.equal(document.getElementById("force-pv").textContent, "Force PV: 96");

  // Fight: Atlas takes 6 armor, 2 structure, heat 2, 3 crits (re-query after each mutation)
  let atlasCard = document.querySelector('#roster .card[data-unit-id="atlas-as7-d"]');
  click(atlasCard.querySelector('.pip[data-action="armor"][data-index="5"]'), window);
  atlasCard = document.querySelector('#roster .card[data-unit-id="atlas-as7-d"]');
  click(atlasCard.querySelector('.pip[data-action="struct"][data-index="1"]'), window);
  atlasCard = document.querySelector('#roster .card[data-unit-id="atlas-as7-d"]');
  click(atlasCard.querySelector('.heat-btn[data-heat="2"]'), window);
  atlasCard = document.querySelector('#roster .card[data-unit-id="atlas-as7-d"]');
  for (const t of ["engine", "weapons", "mp"]) {
    click(atlasCard.querySelector(`.crit-slot[data-crit="${t}"][data-index="0"]`), window);
    atlasCard = document.querySelector('#roster .card[data-unit-id="atlas-as7-d"]');
  }

  // Awesome untouched
  const awesomeCard = document.querySelector('#roster .card[data-unit-id="awesome-aws-8q"]');
  assert.equal(awesomeCard.querySelectorAll(".pip.damaged").length, 0);

  // Verify Atlas state
  assert.equal(atlasCard.querySelectorAll('.pip[data-action="armor"].damaged').length, 6);
  assert.equal(atlasCard.querySelectorAll('.pip[data-action="struct"].damaged').length, 2);
  assert.ok(atlasCard.querySelector('.heat-btn[data-heat="2"].active'));
  assert.equal(atlasCard.querySelectorAll(".crit-slot.filled").length, 3);
  assert.ok(atlasCard.querySelector('.crit-slot[data-crit="engine"][data-index="0"].filled'));

  // Refresh simulation: fresh app boot reads persisted localStorage
  const { document: doc2 } = await boot(ls);
  assert.equal(doc2.querySelectorAll("#roster .card").length, 2);
  const restored = doc2.querySelector('#roster .card[data-unit-id="atlas-as7-d"]');
  assert.equal(restored.querySelectorAll('.pip[data-action="armor"].damaged').length, 6);
  assert.ok(restored.querySelector('.heat-btn[data-heat="2"].active'));
  assert.equal(restored.querySelectorAll(".crit-slot.filled").length, 3);
  assert.ok(restored.querySelector('.crit-slot[data-crit="engine"][data-index="0"].filled'));
  assert.equal(doc2.getElementById("force-pv").textContent, "Force PV: 96");

  // Export from the refreshed app, import into a fresh profile
  const exported = storage.exportBlob(JSON.parse(window.localStorage.getItem("as-companion-state-v1")));
  const { window: w3, document: doc3, storage: s3 } = await boot(ls);
  const imported = s3.importState(exported.text, new Map(UNITS.map(u => [u.id, u])));
  s3.saveState(imported);
  const { document: doc4 } = await boot(ls);
  assert.equal(doc4.querySelectorAll("#roster .card").length, 2);
  const restored2 = doc4.querySelector('#roster .card[data-unit-id="atlas-as7-d"]');
  assert.equal(restored2.querySelectorAll('.pip[data-action="armor"].damaged').length, 6);
  assert.ok(restored2.querySelector('.crit-slot[data-crit="engine"][data-index="0"].filled'));

  // Clear force
  click(doc4.getElementById("btn-clear"), w3);
  assert.equal(doc4.querySelectorAll("#roster .card").length, 0);
  assert.equal(doc4.getElementById("force-pv").textContent, "Force PV: 0");
});

test("JOURNEY: units auto-group into Lances (IS) and Stars (Clan)", async () => {
  const clanUnit = { ...UNITS[0], tech: "Clan" };
  const isUnit = { ...UNITS[1], tech: "Inner Sphere" };
  const units = [clanUnit, isUnit];
  const html = readFileSync("site/index.html", "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ units }) });
  window.__AS_MANUAL__ = true;
  const app = await import("../site/js/app.js");
  const storage = makeStorage(new Map(units.map(u => [u.id, u])), window.localStorage);
  await app.init({ doc: window.document, storage });

  // Deploy 2 Clan mechs -> one Star (size 5)
  const search0 = document.getElementById("search");
  search0.value = "a";
  search0.dispatchEvent(new window.Event("input", { bubbles: true }));
  click(document.querySelector("#picker-list li button"), window);
  click(document.querySelector("#picker-list li button"), window);
  let groups = document.querySelectorAll("#roster .group");
  assert.equal(groups.length, 1);
  assert.match(groups[0].querySelector(".group-tab").textContent, /Star/);
  assert.equal(groups[0].querySelectorAll(".card").length, 2);
  assert.match(groups[0].querySelector(".group-count").textContent, /2\/5/);

  // Deploy an Inner Sphere mech -> new Lance (size 4)
  const search = document.getElementById("search");
  search.value = "awesome";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  await settle();
  click(document.querySelector("#picker-list li button"), window);
  groups = document.querySelectorAll("#roster .group");
  assert.equal(groups.length, 2);
  assert.match(groups[1].querySelector(".group-tab").textContent, /Lance/);
  assert.equal(groups[1].querySelectorAll(".card").length, 1);
  assert.match(groups[1].querySelector(".group-count").textContent, /1\/4/);

  // Rename the Star via its input
  const starName = groups[0].querySelector(".group-name");
  starName.value = "Wolf Alpha";
  starName.dispatchEvent(new window.Event("input", { bubbles: true }));
  starName.dispatchEvent(new window.Event("change", { bubbles: true }));
  const saved = JSON.parse(window.localStorage.getItem("as-companion-state-v1"));
  assert.equal(saved.groups.length, 2);
  assert.equal(saved.groups[0].name, "Wolf Alpha");
  assert.equal(saved.groups[0].size, 5);
  assert.equal(saved.groups[1].size, 4);
});

test("JOURNEY: group names are fixed at creation and stable", async () => {
  const units = [
    { ...UNITS[0], tech: "Clan", id: "clan-0", class: "ATLAS", variant: "AS7-A" },
    { ...UNITS[0], tech: "Clan", id: "clan-1", class: "ATLAS", variant: "AS7-B" },
  ];
  const html = readFileSync("site/index.html", "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ units }) });
  window.__AS_MANUAL__ = true;
  const app = await import("../site/js/app.js");
  const storage = makeStorage(new Map(units.map(u => [u.id, u])), window.localStorage);
  await app.init({ doc: window.document, storage });

  // Fill Star 1 (5 Clan mechs: add 5 clones)
  const search0 = document.getElementById("search");
  search0.value = "a";
  search0.dispatchEvent(new window.Event("input", { bubbles: true }));
  for (let i = 0; i < 5; i++) {
    click(document.querySelector("#picker-list li button"), window);
  }
  let groups = document.querySelectorAll("#roster .group");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].querySelector(".group-tab").textContent, "Star 1");

  // Create a second star: names must stay stable (no "Star 2" on the first)
  const search = document.getElementById("search");
  search.value = "AS7-B";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  await settle();
  click(document.querySelector("#picker-list li button"), window);
  groups = document.querySelectorAll("#roster .group");
  assert.equal(groups.length, 2);
  assert.equal(groups[0].querySelector(".group-tab").textContent, "Star 1");
  assert.equal(groups[1].querySelector(".group-tab").textContent, "Star 2");

  // Third star: first two must remain Star 1 / Star 2 — fill Star 2 first
  search.value = "AS7-A";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  await settle();
  for (let i = 0; i < 4; i++) {
    click(document.querySelector("#picker-list li button"), window);
  }
  search.value = "AS7-B";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  await settle();
  click(document.querySelector("#picker-list li button"), window);
  groups = document.querySelectorAll("#roster .group");
  assert.equal(groups.length, 3);
  assert.equal(groups[0].querySelector(".group-tab").textContent, "Star 1");
  assert.equal(groups[1].querySelector(".group-tab").textContent, "Star 2");
  assert.equal(groups[2].querySelector(".group-tab").textContent, "Star 3");
});

test("JOURNEY: search and type-filter interaction", async () => {
  const { window, document } = await boot();
  const search = document.getElementById("search");
  const filter = document.getElementById("type-filter");

  search.value = "a";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  await settle();
  assert.equal(document.querySelectorAll("#picker-list li").length, 3);

  filter.value = "CV";
  filter.dispatchEvent(new window.Event("change", { bubbles: true }));
  let items = [...document.querySelectorAll("#picker-list li button")];
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /Demolisher/);

  filter.value = "";
  filter.dispatchEvent(new window.Event("change", { bubbles: true }));
  search.value = "AS7";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  await settle();
  items = [...document.querySelectorAll("#picker-list li button")];
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /AS7-D/);

  // Reset both — back to the idle hint
  search.value = "";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  const idle = document.querySelectorAll("#picker-list li");
  assert.equal(idle.length, 1);
  assert.match(idle[0].className, /picker-hint/);
});
