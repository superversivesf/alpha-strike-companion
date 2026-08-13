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

function open(doc, e = entry) {
  openSatorDialog({ doc, attacker: atlas, attackerEntry: e });
  return ensureSatorDialog(doc);
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

test("wizard shows six step pills in order", () => {
  const doc = setup();
  ensureSatorDialog(doc);
  const letters = [...doc.querySelectorAll(".sator-pill")].map(p => p.dataset.step);
  assert.deepEqual(letters, ["S", "A", "T", "O", "R", "#"]);
});

test("only the current step panel is visible", () => {
  const doc = setup();
  open(doc);
  const visible = [...doc.querySelectorAll(".sator-panel")].filter(p => !p.hidden).map(p => p.dataset.step);
  assert.deepEqual(visible, ["S"]);
  doc.querySelector("#sator-next").click();
  assert.deepEqual([...doc.querySelectorAll(".sator-panel")].filter(p => !p.hidden).map(p => p.dataset.step), ["A"]);
  doc.querySelector("#sator-next").click();
  assert.deepEqual([...doc.querySelectorAll(".sator-panel")].filter(p => !p.hidden).map(p => p.dataset.step), ["T"]);
  doc.querySelector("#sator-next").click();
  assert.deepEqual([...doc.querySelectorAll(".sator-panel")].filter(p => !p.hidden).map(p => p.dataset.step), ["O"]);
  doc.querySelector("#sator-next").click();
  assert.deepEqual([...doc.querySelectorAll(".sator-panel")].filter(p => !p.hidden).map(p => p.dataset.step), ["R"]);
  doc.querySelector("#sator-next").click();
  assert.deepEqual([...doc.querySelectorAll(".sator-panel")].filter(p => !p.hidden).map(p => p.dataset.step), ["#"]);
});

test("range step changes TN and breakdown", () => {
  const doc = setup();
  open(doc);
  const overlay = ensureSatorDialog(doc);
  doc.querySelector("#sator-next").click(); // A
  doc.querySelector("#sator-next").click(); // T
  doc.querySelector("#sator-next").click(); // O
  doc.querySelector("#sator-next").click(); // R
  overlay.querySelector('input[name="sator-range"][value="M"]').click();
  assert.equal(overlay.querySelector("#sator-run-tn").textContent, "6"); // 4 + 2
  assert.match(overlay.querySelector("#sator-breakdown").textContent, /\+2 \(Range\)/);
  overlay.querySelector('input[name="sator-range"][value="L"]').click();
  assert.equal(overlay.querySelector("#sator-run-tn").textContent, "8"); // 4 + 4
});

test("openSatorDialog unhides and prefills attacker skill", () => {
  const doc = setup();
  const overlay = open(doc);
  assert.equal(overlay.hidden, false);
  assert.equal(overlay.querySelector(".sator-panel[data-step=\"S\"] .sator-skill-value").textContent, "4");
});

test("running TN appears in footer and updates with movement", () => {
  const doc = setup();
  open(doc);
  const overlay = ensureSatorDialog(doc);
  assert.equal(overlay.querySelector("#sator-run-tn").textContent, "4");
  doc.querySelector("#sator-next").click();
  overlay.querySelector('input[name="sator-atk-move"][value="standstill"]').click();
  assert.equal(overlay.querySelector("#sator-run-tn").textContent, "3");
  overlay.querySelector('input[name="sator-atk-move"][value="jump"]').click();
  assert.equal(overlay.querySelector("#sator-run-tn").textContent, "6");
});

test("min TN clamps at 2 for skill 0", () => {
  const doc = setup();
  const overlay = open(doc, { ...entry, skill: 0 });
  assert.equal(overlay.querySelector("#sator-run-tn").textContent, "2");
});

test("destroyed attacker shows cannot-attack", () => {
  const doc = setup();
  const overlay = open(doc, { ...entry, armorDamage: 10, structDamage: 8 });
  assert.equal(overlay.querySelector("#sator-tn").textContent, "\u2014");
  assert.match(overlay.querySelector("#sator-breakdown").textContent, /destroyed/i);
});

test("target modes reveal TMM and jets conditionally", () => {
  const doc = setup();
  open(doc);
  const overlay = ensureSatorDialog(doc);
  doc.querySelector("#sator-next").click(); // A
  doc.querySelector("#sator-next").click(); // T
  const tmmGroup = overlay.querySelector(".sator-tmm-group");
  const jetsRow = overlay.querySelector(".sator-jets");
  assert.equal(tmmGroup.hidden, false, "ground shows TMM");
  assert.equal(jetsRow.hidden, true, "ground hides jets");
  overlay.querySelector('input[name="sator-target-mode"][value="jump"]').click();
  assert.equal(jetsRow.hidden, false, "jump shows jets");
  assert.equal(overlay.querySelector("#sator-jets-label").textContent, "JMP #");
  assert.equal(overlay.querySelector("#sator-run-tn").textContent, "5"); // 4 + jump(tmm0+1)
  overlay.querySelector('input[name="sator-target-mode"][value="submersible"]').click();
  assert.equal(jetsRow.hidden, false, "submersible shows jets");
  assert.equal(overlay.querySelector("#sator-jets-label").textContent, "SUB #");
  overlay.querySelector('input[name="sator-target-mode"][value="immobile"]').click();
  assert.equal(tmmGroup.hidden, true, "immobile hides TMM");
  assert.equal(jetsRow.hidden, true, "immobile hides jets");
  assert.equal(overlay.querySelector("#sator-run-tn").textContent, "2"); // 4 - 4 = 0 -> clamp 2
});

test("jet stepper buttons adjust the jets value", () => {
  const doc = setup();
  open(doc);
  const overlay = ensureSatorDialog(doc);
  doc.querySelector("#sator-next").click();
  doc.querySelector("#sator-next").click();
  overlay.querySelector('input[name="sator-target-mode"][value="jump"]').click();
  const jetsInput = overlay.querySelector("#sator-jets");
  assert.equal(jetsInput.value, "0");
  overlay.querySelector(".sator-stepper-btn[aria-label=\"Increase jet modifier\"]").click();
  assert.equal(jetsInput.value, "1");
  assert.equal(overlay.querySelector("#sator-run-tn").textContent, "6"); // 4 + 1 + 1
  overlay.querySelector(".sator-stepper-btn[aria-label=\"Decrease jet modifier\"]").click();
  assert.equal(jetsInput.value, "0");
});

test("jet stepper clamps to data range -3..2", () => {
  const doc = setup();
  open(doc);
  const overlay = ensureSatorDialog(doc);
  doc.querySelector("#sator-next").click();
  doc.querySelector("#sator-next").click();
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

test("back pill navigates to previous step", () => {
  const doc = setup();
  open(doc);
  doc.querySelector("#sator-next").click();
  doc.querySelector("#sator-next").click();
  assert.equal(ensureSatorDialog(doc).querySelector(".sator-panel:not([hidden])").dataset.step, "T");
  doc.querySelector("#sator-back").click();
  assert.equal(ensureSatorDialog(doc).querySelector(".sator-panel:not([hidden])").dataset.step, "A");
  doc.querySelector("#sator-back").click();
  assert.equal(ensureSatorDialog(doc).querySelector(".sator-panel:not([hidden])").dataset.step, "S");
  assert.equal(doc.querySelector("#sator-back").disabled, true, "back disabled on first step");
});

test("pill click jumps to that step", () => {
  const doc = setup();
  open(doc);
  doc.querySelector('.sator-pill[data-step="T"]').click();
  assert.equal(ensureSatorDialog(doc).querySelector(".sator-panel:not([hidden])").dataset.step, "T");
});

test("Escape key closes the dialog", () => {
  const doc = setup();
  open(doc);
  const overlay = ensureSatorDialog(doc);
  doc.dispatchEvent(new doc.defaultView.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(overlay.hidden, true);
});

test("close button closes the dialog", () => {
  const doc = setup();
  open(doc);
  const overlay = ensureSatorDialog(doc);
  overlay.querySelector(".sator-close").dispatchEvent(new doc.defaultView.MouseEvent("click", { bubbles: true }));
  assert.equal(overlay.hidden, true);
});

test("backdrop click closes the dialog", () => {
  const doc = setup();
  open(doc);
  const overlay = ensureSatorDialog(doc);
  overlay.dispatchEvent(new doc.defaultView.MouseEvent("click", { bubbles: true }));
  assert.equal(overlay.hidden, true);
});

test("finish on the final step closes the dialog", () => {
  const doc = setup();
  open(doc);
  for (let i = 0; i < 5; i++) doc.querySelector("#sator-next").click();
  const next = doc.querySelector("#sator-next");
  assert.equal(next.textContent, "\u2713");
  next.click();
  assert.equal(ensureSatorDialog(doc).hidden, true);
});

test("openSatorDialog stores return focus", () => {
  const doc = setup();
  const btn = doc.createElement("button");
  doc.body.append(btn);
  btn.focus();
  open(doc);
  const overlay = ensureSatorDialog(doc);
  assert.equal(overlay.__returnFocus, btn);
});

test("closeSatorDialog hides and returns focus", () => {
  const doc = setup();
  const btn = doc.createElement("button");
  doc.body.append(btn);
  btn.focus();
  open(doc);
  closeSatorDialog(doc);
  const overlay = ensureSatorDialog(doc);
  assert.equal(overlay.hidden, true);
  assert.equal(doc.activeElement, btn);
});
