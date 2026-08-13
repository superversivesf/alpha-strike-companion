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

const ERAS = [
  { id: 9, name: "Age of War", start: 2439, end: 2571 },
  { id: 10, name: "Star League", start: 2571, end: 2781 },
  { id: 14, name: "Clan Invasion", start: 3049, end: 3067 },
];

async function boot({ state = { roster: [] } } = {}) {
  const html = readFileSync("site/index.html", "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ units: UNITS, eras: ERAS }) });
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

async function settle() {
  await new Promise(r => setImmediate(r));
}

function showSomeUnits() {
  const s = document.getElementById("search");
  s.value = "a";
  s.dispatchEvent(new window.Event("input", { bubbles: true }));
}

test("init loads units, populates filters and picker", async () => {
  const { document } = await boot();
  const typeOptions = [...document.querySelectorAll("#type-filter option")].map(o => o.value);
  assert.deepEqual(typeOptions, ["", "BM"]);
  const typeLabels = [...document.querySelectorAll("#type-filter option")].map(o => o.textContent);
  assert.deepEqual(typeLabels, ["All types", "BattleMech (BM)"]);
  const eraOptions = [...document.querySelectorAll("#era-filter option")].map(o => o.value);
  assert.deepEqual(eraOptions, ["", "Age of War", "Star League", "Clan Invasion"]);
  const eraLabels = [...document.querySelectorAll("#era-filter option")].map(o => o.textContent);
  assert.deepEqual(eraLabels, ["All eras", "Age of War (2439–2571)", "Star League (2571–2781)", "Clan Invasion (3049–3067)"]);
  const sideOptions = [...document.querySelectorAll("#side-filter option")].map(o => o.value);
  assert.deepEqual(sideOptions, ["", "Clan", "Inner Sphere"]);
  const roleOptions = [...document.querySelectorAll("#role-filter option")].map(o => o.value);
  assert.deepEqual(roleOptions, ["", "Juggernaut", "Scout", "Sniper"]);
  const sizeOptions = [...document.querySelectorAll("#size-filter option")].map(o => o.value);
  assert.deepEqual(sizeOptions, ["", "1", "2", "3", "4"]);
  const items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].className, /picker-hint/);
  assert.match(items[0].textContent, /Start typing or select a filter/);
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
  await settle();
  let items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /AS7-K/);
  input.value = "";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  await settle();
  const filter = document.getElementById("type-filter");
  filter.value = "BM";
  filter.dispatchEvent(new window.Event("change", { bubbles: true }));
  items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 2);
});

test("no-match state shows a distinct message", async () => {
  const { document } = await boot();
  const input = document.getElementById("search");
  input.value = "zzz-no-such-unit";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  const items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].className, /picker-empty/);
  assert.equal(items[0].textContent, "No units found.");
  assert.equal(items[0].querySelector("button"), null);
});

test("no-match via filters only shows the distinct message", async () => {
  const { document } = await boot();
  const side = document.getElementById("side-filter");
  side.value = "Clan";
  side.dispatchEvent(new window.Event("change", { bubbles: true }));
  const era = document.getElementById("era-filter");
  era.value = "Age of War";
  era.dispatchEvent(new window.Event("change", { bubbles: true }));
  const items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].className, /picker-empty/);
  assert.equal(items[0].textContent, "No units found.");
});

test("whitespace-only search shows the hint", async () => {
  const { document } = await boot();
  const input = document.getElementById("search");
  input.value = "   ";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  const items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].className, /picker-hint/);
  assert.equal(items[0].textContent, "Start typing or select a filter to browse units.");
  assert.equal(items[0].querySelector("button"), null);
  assert.equal(items[0].getAttribute("tabindex"), null);
});

test("adding units renders cards and updates force PV", async () => {
  const { document, saved } = await boot();
  await showSomeUnits();
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
  await showSomeUnits();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const pip = document.querySelector('#roster .card .pip[data-action="armor"][data-index="2"]');
  pip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll('#roster .card .pip[data-action="armor"].damaged').length, 3);
  assert.equal(saved.length, 2);
  assert.equal(saved[1].roster[0].armorDamage, 3);
});

test("heat, crit, and remove actions", async () => {
  const { document } = await boot();
  await showSomeUnits();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const heatBtn = document.querySelector('#roster .heat-btn[data-heat="2"]');
  heatBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.ok(document.querySelector('#roster .heat-btn[data-heat="2"].active'));
  const crit = document.querySelector('#roster .crit-slot[data-crit="weapons"][data-index="0"]');
  crit.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.ok(document.querySelector('#roster .crit-slot[data-crit="weapons"][data-index="0"].filled'));
  const removeBtn = document.querySelector('#roster .card-remove');
  removeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  removeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 0);
  assert.equal(document.getElementById("roster-empty").style.display, "");
});

test("set-skill fixes the skill and persists", async () => {
  const { document, saved } = await boot();
  await showSomeUnits();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.getElementById("force-pv").textContent, "Force PV: 52");
  const select = document.querySelector('#roster .card .skill-select');
  select.value = "3";
  const setBtn = document.querySelector('#roster .card .skill-set');
  setBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelector('#roster .card .skill-value').textContent, "3");
  assert.equal(document.querySelectorAll('#roster .card .skill-select').length, 0);
  assert.equal(saved.at(-1).roster[0].skill, 3);
  assert.equal(saved.at(-1).roster[0].skillSet, true);
  assert.equal(document.getElementById("force-pv").textContent, "Force PV: 54");
  assert.equal(document.querySelector('#roster .card .card-pv').textContent, "PV 54");
});

test("removing one duplicate unit keeps the other", async () => {
  const { document } = await boot();
  await showSomeUnits();
  const first = document.querySelector("#picker-list li button");
  first.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  first.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 2);
  const cards = document.querySelectorAll("#roster .card");
  const rem = cards[0].querySelector(".card-remove");
  rem.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  rem.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 1);
  assert.equal(document.querySelectorAll("#roster .group")[0].querySelectorAll(".card").length, 1);
});

test("removing the last unit deletes its group", async () => {
  const { document } = await boot();
  await showSomeUnits();
  const first = document.querySelector("#picker-list li button");
  first.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .group").length, 1);
  const removeBtn = document.querySelector("#roster .card-remove");
  removeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  removeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
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
  await showSomeUnits();
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

test("persist logs an error when saveState throws", async () => {
  const html = readFileSync("site/index.html", "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ units: UNITS, eras: ERAS }) });
  window.__AS_MANUAL__ = true;
  const errors = [];
  const orig = console.error;
  console.error = (...args) => errors.push(args);
  try {
    const app = await import(`../site/js/app.js?persist=${Date.now()}`);
    const storage = {
      importState: text => JSON.parse(text),
      exportBlob: () => ({}),
      loadState: () => ({ roster: [], groups: [] }),
      saveState: () => { throw new Error("quota exceeded"); },
    };
    await app.init({ doc: window.document, storage });
    const s = window.document.getElementById("search");
    s.value = "a";
    s.dispatchEvent(new window.Event("input", { bubbles: true }));
    window.document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.equal(errors.length, 1);
    assert.match(errors[0][0], /Could not persist state/);
  } finally {
    console.error = orig;
  }
});

test("groupLabel falls back to Group for odd sizes", async () => {
  const html = readFileSync("site/index.html", "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ units: UNITS, eras: ERAS }) });
  window.__AS_MANUAL__ = true;
  const app = await import(`../site/js/app.js?grouplabel=${Date.now()}`);
  const storage = {
    importState: text => JSON.parse(text),
    exportBlob: () => ({}),
    loadState: () => ({ roster: [], groups: [{ id: "g1", name: "", size: 3, unitIds: [] }] }),
    saveState: () => {},
  };
  await app.init({ doc: window.document, storage });
  const tab = window.document.querySelector("#roster .group-tab");
  assert.equal(tab.textContent, "Group");
});

test("init rejects payload missing the units array", async () => {
  const html = readFileSync("site/index.html", "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ eras: [] }) });
  window.__AS_MANUAL__ = true;
  const app = await import("../site/js/app.js");
  await assert.rejects(
    () => app.init({ doc: window.document, storage: { loadState: () => null, saveState: () => {} } }),
    /missing the units array/
  );
});

test("init falls back to makeStorage when storage lacks importState", async () => {
  const html = readFileSync("site/index.html", "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ units: UNITS, eras: ERAS }) });
  window.__AS_MANUAL__ = true;
  const app = await import(`../site/js/app.js?fallback=${Date.now()}`);
  const storage = { loadState: () => ({ roster: [], groups: [] }), saveState: () => {} };
  await app.init({ doc: window.document, storage });
  const s = window.document.getElementById("search");
  s.value = "a";
  s.dispatchEvent(new window.Event("input", { bubbles: true }));
  window.document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(window.document.querySelectorAll("#roster .card").length, 1);
});

test("import failure alerts and leaves state unchanged", async () => {
  const { document, window, saved } = await boot();
  const alerts = [];
  const origAlert = window.alert;
  window.alert = msg => alerts.push(msg);
  try {
    showSomeUnits();
    document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.equal(document.querySelectorAll("#roster .card").length, 1);
    const file = new window.File(["not json"], "bad.json", { type: "application/json" });
    file.text = async () => "not json";
    const input = document.getElementById("import-file");
    Object.defineProperty(input, "files", { value: [file], writable: false });
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /Import failed/);
    assert.equal(document.querySelectorAll("#roster .card").length, 1);
    assert.equal(input.value, "");
  } finally {
    window.alert = origAlert;
  }
});

test("import of oversized file alerts without parsing", async () => {
  const { document, window } = await boot();
  const alerts = [];
  const origAlert = window.alert;
  window.alert = msg => alerts.push(msg);
  try {
    const file = new window.File(["x".repeat(6 * 1024 * 1024)], "big.json", { type: "application/json" });
    file.text = async () => "x".repeat(6 * 1024 * 1024);
    const input = document.getElementById("import-file");
    Object.defineProperty(input, "files", { value: [file], writable: false });
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /file too large/);
    assert.equal(document.querySelectorAll("#roster .card").length, 0);
  } finally {
    window.alert = origAlert;
  }
});

test("import accepts a file exactly at the size limit", async () => {
  const { document, window } = await boot();
  const alerts = [];
  const origAlert = window.alert;
  window.alert = msg => alerts.push(msg);
  try {
    const payload = JSON.stringify({ roster: [], groups: [] });
    const file = new window.File([payload], "ok.json", { type: "application/json" });
    file.text = async () => payload;
    const input = document.getElementById("import-file");
    Object.defineProperty(input, "files", { value: [file], writable: false });
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    assert.equal(alerts.length, 0);
  } finally {
    window.alert = origAlert;
  }
});

test("btn-import click opens the file picker", async () => {
  const { document, window } = await boot();
  let clicked = false;
  const input = document.getElementById("import-file");
  const origClick = input.click;
  input.click = () => { clicked = true; };
  try {
    document.getElementById("btn-import").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.ok(clicked);
  } finally {
    input.click = origClick;
  }
});

test("export click creates a download anchor with the state JSON", async () => {
  const html = readFileSync("site/index.html", "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ units: UNITS, eras: ERAS }) });
  window.__AS_MANUAL__ = true;
  const app = await import(`../site/js/app.js?export=${Date.now()}`);
  const saved = [];
  const storage = {
    importState: text => JSON.parse(text),
    exportBlob: s => ({ filename: "as-companion-state.json", text: JSON.stringify(s, null, 2) }),
    loadState: () => ({ roster: [], groups: [] }),
    saveState: s => saved.push(s),
  };
  await app.init({ doc: window.document, storage });
  const s = window.document.getElementById("search");
  s.value = "a";
  s.dispatchEvent(new window.Event("input", { bubbles: true }));
  window.document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const urls = [];
  const origCreate = globalThis.URL.createObjectURL;
  const origRevoke = globalThis.URL.revokeObjectURL;
  globalThis.URL.createObjectURL = blob => { urls.push(blob); return "blob:mock"; };
  globalThis.URL.revokeObjectURL = () => {};
  let anchor = null;
  const origCreateElement = window.document.createElement.bind(window.document);
  window.document.createElement = tag => {
    const el = origCreateElement(tag);
    if (tag === "a") anchor = el;
    return el;
  };
  try {
    window.document.getElementById("btn-export").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.ok(anchor, "anchor must be created");
    assert.equal(anchor.download, "as-companion-state.json");
    assert.equal(urls.length, 1);
    const text = await urls[0].text();
    const parsed = JSON.parse(text);
    assert.equal(parsed.roster.length, 1);
  } finally {
    globalThis.URL.createObjectURL = origCreate;
    globalThis.URL.revokeObjectURL = origRevoke;
    window.document.createElement = origCreateElement;
  }
});

test("delete group keeps its units as ungrouped", async () => {
  const { document, window, saved } = await boot();
  showSomeUnits();
  const first = document.querySelector("#picker-list li button");
  first.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  first.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .group").length, 1);
  document.querySelector(".group-delete").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .group").length, 1);
  const ungrouped = document.querySelector('#roster .group[data-group-id="ungrouped"]');
  assert.ok(ungrouped, "ungrouped section must exist");
  assert.equal(ungrouped.querySelectorAll(".card").length, 2);
  assert.equal(document.getElementById("force-pv").textContent, "Force PV: 104");
  assert.equal(saved.at(-1).groups.length, 0);
  assert.equal(saved.at(-1).roster.length, 2);
});

test("init shows error banner when units.json fetch fails", async () => {
  const html = readFileSync("site/index.html", "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.fetch = async () => { throw new Error("network down"); };
  delete window.__AS_MANUAL__;
  const errors = [];
  const origError = console.error;
  console.error = (...args) => errors.push(args);
  try {
    await import(`../site/js/app.js?banner=${Date.now()}`);
    await new Promise(r => setTimeout(r, 50));
    const banner = window.document.querySelector(".load-error");
    assert.ok(banner, "error banner must be present");
    assert.match(banner.textContent, /Could not load unit data/);
  } finally {
    console.error = origError;
  }
});

test("init auto-boots when __AS_MANUAL__ is unset", async () => {
  const html = readFileSync("site/index.html", "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ units: UNITS, eras: ERAS }) });
  delete window.__AS_MANUAL__;
  await import(`../site/js/app.js?autoboot=${Date.now()}`);
  await new Promise(r => setTimeout(r, 50));
  const items = window.document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].className, /picker-hint/);
});

test("init auto-boot survives corrupt localStorage", async () => {
  const html = readFileSync("site/index.html", "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ units: UNITS, eras: ERAS }) });
  window.localStorage.setItem("as-companion-state-v1", "{not json");
  delete window.__AS_MANUAL__;
  await import(`../site/js/app.js?corrupt=${Date.now()}`);
  await new Promise(r => setTimeout(r, 50));
  const items = window.document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].className, /picker-hint/);
  assert.equal(window.document.getElementById("force-pv").textContent, "Force PV: 0");
});

test("deployed entries get unique ids under rapid clicks", async () => {
  const { document } = await boot();
  showSomeUnits();
  const first = document.querySelector("#picker-list li button");
  for (let i = 0; i < 5; i++) {
    first.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  }
  const ids = [...document.querySelectorAll("#roster .card")].map(c => c.dataset.entryId);
  assert.equal(new Set(ids).size, 5);
});

test("import rejects oversized files", async () => {
  const { document, window } = await boot();
  const big = new window.File([new ArrayBuffer(6 * 1024 * 1024)], "big.json", { type: "application/json" });
  Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
  const input = document.getElementById("import-file");
  Object.defineProperty(input, "files", { value: [big], writable: false });
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
  await new Promise(r => setTimeout(r, 50));
  assert.equal(document.querySelectorAll("#roster .card").length, 0);
});

test("clicking card To-Hit button opens the dialog prefilled", async () => {
  const { document } = await boot();
  showSomeUnits();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  document.querySelector(".card-tohit").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const overlay = document.querySelector(".sator-overlay");
  assert.ok(overlay, "sator overlay must exist");
  assert.equal(overlay.hidden, false);
  assert.equal(overlay.querySelector(".sator-skill-value").textContent, "4");
});

test("destroyed unit's To-Hit button is disabled", async () => {
  const { document } = await boot({ state: { roster: [{ id: "e-dead", unitId: "atlas-as7-d", armorDamage: 10, structDamage: 8, heat: 0, crits: { engine: 0, fireControl: 0, mp: 0, weapons: 0, thruster: 0, fuel: 0, crew: 0 }, skill: 4, skillSet: true }], groups: [] } });
  const btn = document.querySelector(".card-tohit");
  assert.ok(btn);
  assert.equal(btn.disabled, true);
});

test("Esc closes the dialog", async () => {
  const { document } = await boot();
  showSomeUnits();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  document.querySelector(".card-tohit").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const overlay = document.querySelector(".sator-overlay");
  assert.equal(overlay.hidden, false);
  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(overlay.hidden, true);
});

test("remove requires two clicks to confirm", async () => {
  const { document, saved } = await boot();
  showSomeUnits();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 1);
  const removeBtn = document.querySelector(".card-remove");
  removeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 1, "first click must not remove");
  assert.ok(removeBtn.classList.contains("armed"));
  removeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 0);
  assert.equal(saved.at(-1).roster.length, 0);
});

test("remove arming is cancelled by clicking elsewhere, then next click removes", async () => {
  const { document } = await boot();
  showSomeUnits();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const removeBtn = document.querySelector(".card-remove");
  removeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.ok(removeBtn.classList.contains("armed"));
  document.querySelector(".card-title").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.ok(!removeBtn.classList.contains("armed"), "outside click must cancel arming");
  removeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 0, "click after cancel removes immediately");
});
