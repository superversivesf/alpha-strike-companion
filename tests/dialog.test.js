import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { ensureSatorDialog, openSatorDialog, closeSatorDialog } from "../site/js/dialog.js";

const CRITS0 = { engine: 0, fireControl: 0, mp: 0, weapons: 0, thruster: 0, fuel: 0, crew: 0 };
const atlas = {
  id: "atlas-as7-d", class: "ATLAS", variant: "AS7-D", type: "BM", size: 4, tmm: 1,
  move: "6", role: "Juggernaut", skill: 4, damage: { s: 5, m: 5, l: 2 }, overheat: 0,
  armor: 10, structure: 8, pv: 52, abilities: [], image: "", tech: "Inner Sphere", era: "Star League",
};
const entry = { id: "e1", unitId: atlas.id, armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: true };

function setup() {
  const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  return window.document;
}

test("ensureSatorDialog is idempotent and hidden", () => {
  const doc = setup();
  const a = ensureSatorDialog(doc);
  const b = ensureSatorDialog(doc);
  assert.equal(a, b);
  assert.equal(doc.querySelectorAll(".sator-overlay").length, 1);
  assert.equal(a.hidden, true);
  assert.equal(a.getAttribute("role"), "dialog");
  assert.equal(a.getAttribute("aria-modal"), "true");
});

test("openSatorDialog unhides and prefills attacker skill", () => {
  const doc = setup();
  openSatorDialog({ doc, attacker: atlas, attackerEntry: entry });
  const overlay = ensureSatorDialog(doc);
  assert.equal(overlay.hidden, false);
  const skill = overlay.querySelector(".sator-skill-value");
  assert.equal(skill.textContent, "4");
});

test("openSatorDialog prefills fire control crit badge", () => {
  const doc = setup();
  const e = { ...entry, crits: { ...CRITS0, fireControl: 2 } };
  openSatorDialog({ doc, attacker: atlas, attackerEntry: e });
  const overlay = ensureSatorDialog(doc);
  assert.equal(overlay.querySelector(".sator-fc-badge").textContent, "Fire Control +4");
});

test("openSatorDialog stores return focus", () => {
  const doc = setup();
  const btn = doc.createElement("button");
  doc.body.append(btn);
  btn.focus();
  openSatorDialog({ doc, attacker: atlas, attackerEntry: entry });
  const overlay = ensureSatorDialog(doc);
  assert.equal(overlay.__returnFocus, btn);
});

test("closeSatorDialog hides and returns focus", () => {
  const doc = setup();
  const btn = doc.createElement("button");
  doc.body.append(btn);
  btn.focus();
  openSatorDialog({ doc, attacker: atlas, attackerEntry: entry });
  closeSatorDialog(doc);
  const overlay = ensureSatorDialog(doc);
  assert.equal(overlay.hidden, true);
  assert.equal(doc.activeElement, btn);
});

test("Escape key closes the dialog", () => {
  const doc = setup();
  openSatorDialog({ doc, attacker: atlas, attackerEntry: entry });
  const overlay = ensureSatorDialog(doc);
  doc.dispatchEvent(new doc.defaultView.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(overlay.hidden, true);
});

test("close button closes the dialog", () => {
  const doc = setup();
  openSatorDialog({ doc, attacker: atlas, attackerEntry: entry });
  const overlay = ensureSatorDialog(doc);
  overlay.querySelector(".sator-close").dispatchEvent(new doc.defaultView.MouseEvent("click", { bubbles: true }));
  assert.equal(overlay.hidden, true);
});

test("backdrop click closes the dialog", () => {
  const doc = setup();
  openSatorDialog({ doc, attacker: atlas, attackerEntry: entry });
  const overlay = ensureSatorDialog(doc);
  overlay.dispatchEvent(new doc.defaultView.MouseEvent("click", { bubbles: true }));
  assert.equal(overlay.hidden, true);
});

test("changing range updates the result TN live", () => {
  const doc = setup();
  openSatorDialog({ doc, attacker: atlas, attackerEntry: entry });
  const overlay = ensureSatorDialog(doc);
  const longRadio = overlay.querySelector('input[name="sator-range"][value="L"]');
  longRadio.checked = true;
  longRadio.dispatchEvent(new doc.defaultView.Event("change", { bubbles: true }));
  const tn = Number(overlay.querySelector("#sator-tn").textContent);
  assert.equal(tn, 9); // skill 4 + tmm 1 + range 4
});

test("target stationary zeros TMM and lowers TN", () => {
  const doc = setup();
  openSatorDialog({ doc, attacker: atlas, attackerEntry: entry });
  const overlay = ensureSatorDialog(doc);
  overlay.querySelector("#sator-tmm").value = "3";
  const stationary = overlay.querySelector('input[name="sator-target-move"][value="stationary"]');
  stationary.checked = true;
  stationary.dispatchEvent(new doc.defaultView.Event("change", { bubbles: true }));
  const tn = Number(overlay.querySelector("#sator-tn").textContent);
  assert.equal(tn, 4); // skill 4, tmm zeroed by stationary (stationary wins over manual TMM)
});

test("SRCH attacker disables and zeroes the darkness toggle", () => {
  const doc = setup();
  const srchAtlas = { ...atlas, abilities: ["SRCH"] };
  openSatorDialog({ doc, attacker: srchAtlas, attackerEntry: entry });
  const overlay = ensureSatorDialog(doc);
  const darkness = overlay.querySelector("#sator-darkness");
  assert.equal(darkness.disabled, true);
  assert.equal(darkness.checked, false);
  const tn = Number(overlay.querySelector("#sator-tn").textContent);
  assert.equal(tn, 5); // skill 4 + tmm 1, no darkness
});
