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
  assert.ok(card.querySelector('.track-label.tip[data-tip*="Critical hit slots"]'));
  assert.ok(card.querySelector('.ability.tip[data-tip*="Autocannon"]'));
  assert.ok(card.querySelector('.ability.tip[data-tip*="Indirect fire"]'));
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

test("renderCard renders heat buttons and crit slots", () => {
  let entry = createEntry(unit);
  entry = { ...entry, heat: "S", crits: Array(12).fill(false).map((_, i) => i === 2) };
  const card = render(unit, entry);
  const heatBtns = card.querySelectorAll(".heat-btn");
  assert.equal(heatBtns.length, 4);
  assert.ok(card.querySelector('.heat-btn[data-heat="S"].active.shutdown'));
  const crits = card.querySelectorAll(".crit-slot");
  assert.equal(crits.length, 12);
  assert.ok(card.querySelector('.crit-slot[data-crit="2"].filled'));
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
  assert.ok(card.querySelector('.crit-slot[data-crit="11"]'));
});
