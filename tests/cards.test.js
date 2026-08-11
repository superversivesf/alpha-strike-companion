import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderCard } from "../site/js/cards.js";
import { createEntry } from "../site/js/state.js";

const unit = {
  id: "atlas-as7-d", class: "ATLAS", variant: "AS7-D", type: "BM",
  size: 4, tmm: 1, move: "6", role: "Juggernaut", skill: 4,
  damage: { s: 5, m: 5, l: 2 }, overheat: 0,
  armor: 3, structure: 2, pv: 52,
  abilities: ["AC2/2/-", "IF1"], image: "atlas-rg.webp",
};

function render(unit, entry) {
  const dom = new JSDOM("<!DOCTYPE html><body></body>");
  globalThis.document = dom.window.document;
  return renderCard(unit, entry, () => {});
}

test("renderCard shows identity, stats, pv", () => {
  const card = render(unit, createEntry(unit));
  assert.equal(card.querySelector(".card-title").textContent, "ATLAS");
  assert.equal(card.querySelector(".card-variant").textContent, "AS7-D");
  assert.equal(card.querySelector(".card-pv").textContent, "PV 52");
  const rows = [...card.querySelectorAll(".stat-row")];
  assert.equal(rows.length, 8);
  assert.equal(rows[0].querySelector("b").textContent, "SZ");
  assert.equal(rows[0].querySelector("span").textContent, "4");
  assert.equal(rows[1].querySelector("b").textContent, "TMM");
  assert.equal(rows[1].querySelector("span").textContent, "1");
  assert.equal(rows[2].querySelector("b").textContent, "MV");
  assert.equal(rows[2].querySelector("span").textContent, "6");
  assert.equal(rows[3].querySelector("b").textContent, "Role");
  assert.equal(rows[3].querySelector("span").textContent, "Juggernaut");
  assert.equal(rows[4].querySelector("b").textContent, "S");
  assert.equal(rows[4].querySelector("span").textContent, "5");
  assert.equal(rows[5].querySelector("b").textContent, "M");
  assert.equal(rows[5].querySelector("span").textContent, "5");
  assert.equal(rows[6].querySelector("b").textContent, "L");
  assert.equal(rows[6].querySelector("span").textContent, "2");
  assert.equal(rows[7].querySelector("b").textContent, "OV");
  assert.equal(rows[7].querySelector("span").textContent, "0");
});

test("renderCard lays out details left, artwork right", () => {
  const dom = new JSDOM("<!DOCTYPE html><body></body>");
  globalThis.document = dom.window.document;
  const card = renderCard(unit, createEntry(unit));
  const body = card.querySelector(".card-body");
  assert.ok(body);
  const details = body.querySelector(".card-details");
  const art = body.querySelector(".card-art");
  assert.ok(details && art);
  assert.ok(details.compareDocumentPosition(art) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
});

test("renderCard adds tooltips to stats, tracks, heat, crits, abilities", () => {
  const card = render(unit, createEntry(unit));
  assert.ok(card.querySelector('.stat-row b.tip[data-tip*="Size"]'));
  assert.ok(card.querySelector('.track-label.tip[data-tip*="Armor points"]'));
  assert.ok(card.querySelector('.track-label.tip[data-tip*="Structure points"]'));
  assert.ok(card.querySelector('.track-label.tip[data-tip*="Heat level"]'));
  assert.ok(card.querySelector('.track-label.tip[data-tip*="critical hits"]'));
  assert.ok(card.querySelector('.ability.tip[data-tip*="Autocannon"]'));
  assert.ok(card.querySelector('.ability.tip[data-tip*="Indirect Fire"]'));
  assert.ok(card.querySelector('.card-pv.tip[data-tip*="Point Value"]'));
});

test("renderCard shows artwork when image present, placeholder when not", () => {
  const withImg = render(unit, createEntry(unit));
  assert.ok(withImg.querySelector(".card-art img"));
  assert.equal(withImg.querySelector(".card-art img").getAttribute("src"), "data/img/atlas-rg.webp");
  const noImg = render({ ...unit, image: "" }, createEntry(unit));
  assert.ok(noImg.querySelector(".card-art .placeholder"));
});

test("renderCard renders armor and structure pips with damage", () => {
  let entry = createEntry(unit);
  entry = { ...entry, armorDamage: 2, structDamage: 1 };
  const card = render(unit, entry);
  const armorPips = card.querySelectorAll('.pip[data-action="armor"]');
  assert.equal(armorPips.length, 3);
  assert.equal(card.querySelectorAll('.pip[data-action="armor"].damaged').length, 2);
  const structPips = card.querySelectorAll('.pip[data-action="struct"]');
  assert.equal(structPips.length, 2);
  assert.equal(card.querySelectorAll('.pip[data-action="struct"].damaged').length, 1);
});

test("renderCard renders heat buttons and crit boxes", () => {
  let entry = createEntry(unit);
  entry = { ...entry, heat: "S", crits: { ...entry.crits, engine: 1, weapons: 2 } };
  const card = render(unit, entry);
  const heatBtns = card.querySelectorAll(".heat-btn");
  assert.equal(heatBtns.length, 4);
  assert.ok(card.querySelector('.heat-btn[data-heat="S"].active.shutdown'));
  const rows = [...card.querySelectorAll(".crit-row")];
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map(r => r.querySelector(".crit-label").textContent), ["ENGINE", "F.CONTROL", "MP", "WEAPONS"]);
  const engineBoxes = card.querySelectorAll('.crit-slot[data-crit="engine"]');
  assert.equal(engineBoxes.length, 1);
  assert.ok(engineBoxes[0].classList.contains("filled"));
  const weaponsBoxes = card.querySelectorAll('.crit-slot[data-crit="weapons"]');
  assert.equal(weaponsBoxes.length, 4);
  assert.equal(card.querySelectorAll('.crit-slot[data-crit="weapons"].filled').length, 2);
  assert.equal(card.querySelectorAll('.crit-slot[data-crit="fireControl"]').length, 4);
  assert.equal(card.querySelectorAll('.crit-slot[data-crit="mp"]').length, 4);
});

test("renderCard hides heat for non-tracking units", () => {
  const cv = { ...unit, type: "CV" };
  const card = render(cv, createEntry(cv));
  assert.equal(card.querySelectorAll(".heat-btn").length, 0);
});

test("renderCard uses aerospace crit boxes for aerospace units", () => {
  const af = { ...unit, type: "AF" };
  const card = render(af, createEntry(af));
  const rows = [...card.querySelectorAll(".crit-row")].map(r => r.querySelector(".crit-label").textContent);
  assert.deepEqual(rows, ["ENGINE", "F.CONTROL", "WEAPONS", "THRUSTER", "FUEL", "CREW"]);
  assert.equal(card.querySelectorAll('.crit-slot[data-crit="engine"]').length, 2);
  assert.equal(card.querySelectorAll('.crit-slot[data-crit="thruster"]').length, 1);
  assert.equal(card.querySelectorAll('.crit-slot[data-crit="fuel"]').length, 1);
  assert.equal(card.querySelectorAll('.crit-slot[data-crit="crew"]').length, 2);
});

test("renderCard renders ability chips", () => {
  const card = render(unit, createEntry(unit));
  const chips = [...card.querySelectorAll(".ability")].map(e => e.textContent);
  assert.deepEqual(chips, ["AC2/2/-", "IF1"]);
});

test("renderCard wires data attributes for delegation", () => {
  const card = render(unit, createEntry(unit));
  assert.equal(card.getAttribute("data-unit-id"), "atlas-as7-d");
  assert.ok(card.querySelector('.card-remove[data-action="remove"]'));
  assert.ok(card.querySelector('.pip[data-action="armor"][data-index="0"]'));
  assert.ok(card.querySelector('.pip[data-action="struct"][data-index="0"]'));
  assert.ok(card.querySelector('.crit-slot[data-crit="weapons"][data-index="0"]'));
});
