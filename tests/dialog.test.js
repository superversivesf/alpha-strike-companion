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

test("dialog shows five SATOR letter boxes in order", () => {
  const doc = setup();
  ensureSatorDialog(doc);
  const letters = [...doc.querySelectorAll(".sator-letter")].map(l => l.textContent);
  assert.deepEqual(letters, ["S", "A", "T", "O", "R"]);
});

test("letter boxes carry descriptive tooltips", () => {
  const doc = setup();
  ensureSatorDialog(doc);
  const tips = [...doc.querySelectorAll(".sator-letter")].map(l => l.dataset.tip);
  assert.equal(tips.length, 5);
  assert.match(tips[0], /^Skill —/);
  assert.match(tips[1], /^Attacker —/);
  assert.match(tips[2], /^Target —/);
  assert.match(tips[3], /^Other —/);
  assert.match(tips[4], /^Roll —/);
});

test("openSatorDialog unhides and prefills attacker skill", () => {
  const doc = setup();
  openSatorDialog({ doc, attacker: atlas, attackerEntry: entry });
  const overlay = ensureSatorDialog(doc);
  assert.equal(overlay.hidden, false);
  assert.equal(overlay.querySelector(".sator-skill-value").textContent, "4");
});

test("TN equals skill and probability shows", () => {
  const doc = setup();
  openSatorDialog({ doc, attacker: atlas, attackerEntry: entry });
  const overlay = ensureSatorDialog(doc);
  assert.equal(overlay.querySelector("#sator-tn").textContent, "4");
  assert.match(overlay.querySelector("#sator-breakdown").textContent, /4 \(Skill\) = 4/);
  assert.match(overlay.querySelector("#sator-prob").textContent, /2d6 \u2265 4/);
});

test("attacker movement changes TN live", () => {
  const doc = setup();
  openSatorDialog({ doc, attacker: atlas, attackerEntry: entry });
  const overlay = ensureSatorDialog(doc);
  overlay.querySelector('input[name="sator-atk-move"][value="standstill"]').click();
  assert.equal(overlay.querySelector("#sator-tn").textContent, "3");
  assert.match(overlay.querySelector("#sator-breakdown").textContent, /-1 \(Move\)/);
  overlay.querySelector('input[name="sator-atk-move"][value="ground"]').click();
  assert.equal(overlay.querySelector("#sator-tn").textContent, "4");
  overlay.querySelector('input[name="sator-atk-move"][value="jump"]').click();
  assert.equal(overlay.querySelector("#sator-tn").textContent, "6");
  assert.match(overlay.querySelector("#sator-breakdown").textContent, /\+2 \(Move\)/);
});

test("min TN clamps at 2 for skill 0", () => {
  const doc = setup();
  const e = { ...entry, skill: 0 };
  openSatorDialog({ doc, attacker: atlas, attackerEntry: e });
  const overlay = ensureSatorDialog(doc);
  assert.equal(overlay.querySelector("#sator-tn").textContent, "2");
});

test("destroyed attacker shows cannot-attack", () => {
  const doc = setup();
  const destroyed = { ...entry, armorDamage: 10, structDamage: 8 };
  openSatorDialog({ doc, attacker: atlas, attackerEntry: destroyed });
  const overlay = ensureSatorDialog(doc);
  assert.equal(overlay.querySelector("#sator-tn").textContent, "\u2014");
  assert.match(overlay.querySelector("#sator-breakdown").textContent, /destroyed/i);
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

test("jet stepper buttons adjust the jets value", () => {
  const doc = setup();
  openSatorDialog({ doc, attacker: atlas, attackerEntry: entry });
  const overlay = ensureSatorDialog(doc);
  const mode = overlay.querySelector("#sator-target-mode");
  mode.value = "jump";
  mode.dispatchEvent(new doc.defaultView.Event("change", { bubbles: true }));
  const jetsInput = overlay.querySelector("#sator-jets");
  assert.equal(jetsInput.value, "0");
  overlay.querySelector(".sator-stepper-btn[aria-label=\"Increase jet modifier\"]").click();
  assert.equal(jetsInput.value, "1");
  assert.equal(overlay.querySelector("#sator-tn").textContent, "6"); // skill 4 + jump (tmm 0 +1) + jets 1 = 6
  overlay.querySelector(".sator-stepper-btn[aria-label=\"Decrease jet modifier\"]").click();
  overlay.querySelector(".sator-stepper-btn[aria-label=\"Decrease jet modifier\"]").click();
  assert.equal(jetsInput.value, "-1");
});

test("jet stepper clamps to data range -3..2", () => {
  const doc = setup();
  openSatorDialog({ doc, attacker: atlas, attackerEntry: entry });
  const overlay = ensureSatorDialog(doc);
  const jetsInput = overlay.querySelector("#sator-jets");
  const inc = overlay.querySelector(".sator-stepper-btn[aria-label=\"Increase jet modifier\"]");
  const dec = overlay.querySelector(".sator-stepper-btn[aria-label=\"Decrease jet modifier\"]");
  jetsInput.value = "2";
  inc.click();
  assert.equal(jetsInput.value, "2", "cannot exceed +2");
  jetsInput.value = "-3";
  dec.click();
  assert.equal(jetsInput.value, "-3", "cannot go below -3");
});
