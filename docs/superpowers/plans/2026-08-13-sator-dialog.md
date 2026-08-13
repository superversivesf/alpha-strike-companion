# SATOR To-Hit Calculator Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a SATOR to-hit calculator dialog opened from a "To-Hit" button on each unit card, prepopulated from the unit's state, with live TN + breakdown + 2d6 probability.

**Architecture:** New pure module `site/js/sator.js` (formula + modifier tables, no DOM) and new DOM module `site/js/dialog.js` (plain div overlay, injected once, `__asSatorDialog` idempotency). `cards.js` adds the To-Hit button and a two-step remove confirm. `app.js` wires the delegation branch and dialog lifecycle.

**Tech Stack:** Vanilla JS (ES modules), node:test + JSDOM (`npm test`).

## Global Constraints

- Test command: `npm test` (runs `node --test tests/*.test.js`). Coverage gate: `npx c8 node --test tests/*.test.js` (≥90 lines / ≥85 branch / ≥85 funcs).
- Plain div overlay — **do NOT use native `<dialog>`** (jsdom 24.1.0 lacks `showModal()`; spike-verified).
- Dialog is stateless: nothing persisted, every open re-prepopulates from entry/unit state.
- Dialog is a plain-text-ish utility: no `aria-live` regions; `role="dialog"`, `aria-modal="true"`, `aria-labelledby="sator-title"`.
- Esc keydown listener added on open, removed on close (never left dangling).
- Exact copy: hint text "Start typing or select a filter to browse units." unchanged; To-Hit button label "To-Hit"; remove confirm label "Sure?"; dialog title "To-Hit Calculator"; result note "Natural 12 = auto-hit · Natural 2 = auto-miss · Min TN 2".
- No changes to `filterUnits`/`search.js`; no changes to storage/import/export.

---

### Task 1: Pure SATOR logic module

**Files:**
- Create: `site/js/sator.js`
- Create: `tests/sator.test.js`

**Interfaces:**
- Consumes: nothing (standalone).
- Produces: `RANGE_BANDS`, `rangeModifier(band)`, `movementModifier(mode)`, `terrainModifier(terrain)`, `effectiveTargetTmm(target, targetEntry, targetMovement, override)`, `attackerTypeModifier(unit)`, `abilityModifier(unit, { rangeBand, targetMovement })`, `hitProbability(tn)`, `attackerToHit({ attacker, attackerEntry, target, targetEntry, targetMovement, rangeBand, terrain, otherModifiers }) → { tn, breakdown, probability, cannotAttack, reason }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/sator.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  rangeModifier, movementModifier, terrainModifier, effectiveTargetTmm,
  attackerTypeModifier, abilityModifier, hitProbability, attackerToHit,
} from "../site/js/sator.js";

const CRITS0 = { engine: 0, fireControl: 0, mp: 0, weapons: 0, thruster: 0, fuel: 0, crew: 0 };
const atlas = {
  id: "atlas-as7-d", class: "ATLAS", variant: "AS7-D", type: "BM", size: 4, tmm: 1,
  move: "6", role: "Juggernaut", skill: 4, damage: { s: 5, m: 5, l: 2 }, overheat: 0,
  armor: 10, structure: 8, pv: 52, abilities: [], image: "", tech: "Inner Sphere", era: "Star League",
};
const entry = { id: "e1", unitId: atlas.id, armorDamage: 0, structDamage: 0, heat: 0, crits: { ...CRITS0 }, skill: 4, skillSet: true };

test("rangeModifier table", () => {
  assert.equal(rangeModifier("S"), 0);
  assert.equal(rangeModifier("M"), 2);
  assert.equal(rangeModifier("L"), 4);
});

test("movementModifier table", () => {
  assert.equal(movementModifier("stationary"), 0);
  assert.equal(movementModifier("walk"), 0);
  assert.equal(movementModifier("run"), 1);
  assert.equal(movementModifier("jump"), 1);
});

test("terrainModifier table", () => {
  assert.equal(terrainModifier("none"), 0);
  assert.equal(terrainModifier("light-woods"), 1);
  assert.equal(terrainModifier("heavy-woods"), 2);
  assert.equal(terrainModifier("partial-cover"), 1);
  assert.equal(terrainModifier("water"), 1);
  assert.equal(terrainModifier("light-smoke"), 1);
  assert.equal(terrainModifier("heavy-smoke"), 2);
});

test("effectiveTargetTmm: stationary forces 0", () => {
  assert.equal(effectiveTargetTmm(atlas, entry, "stationary", null), 0);
});

test("effectiveTargetTmm: full TMM when moving", () => {
  assert.equal(effectiveTargetTmm(atlas, entry, "walk", null), 1);
});

test("effectiveTargetTmm: MP crit halves round down", () => {
  const e = { ...entry, crits: { ...CRITS0, mp: 1 } };
  assert.equal(effectiveTargetTmm(atlas, e, "walk", null), 0);
  const e2 = { ...entry, crits: { ...CRITS0, mp: 1 } };
  const atlas3 = { ...atlas, tmm: 3 };
  assert.equal(effectiveTargetTmm(atlas3, e2, "walk", null), 1);
});

test("effectiveTargetTmm: engine crit halves (vehicle)", () => {
  const e = { ...entry, crits: { ...CRITS0, engine: 1 } };
  const vee = { ...atlas, type: "CV", tmm: 3 };
  assert.equal(effectiveTargetTmm(vee, e, "walk", null), 1);
});

test("effectiveTargetTmm: shutdown applies -4 floor 0", () => {
  const e = { ...entry, heat: "S" };
  assert.equal(effectiveTargetTmm(atlas, e, "walk", null), 0);
});

test("effectiveTargetTmm: manual override wins", () => {
  assert.equal(effectiveTargetTmm(atlas, entry, "walk", 5), 5);
  assert.equal(effectiveTargetTmm(atlas, entry, "stationary", 5), 5);
});

test("attackerTypeModifier: IM +1 unless AFC, SV+BFC +1", () => {
  assert.equal(attackerTypeModifier(atlas), 0);
  assert.equal(attackerTypeModifier({ ...atlas, type: "IM" }), 1);
  assert.equal(attackerTypeModifier({ ...atlas, type: "IM", abilities: ["AFC"] }), 0);
  assert.equal(attackerTypeModifier({ ...atlas, type: "SV", abilities: ["BFC"] }), 1);
  assert.equal(attackerTypeModifier({ ...atlas, type: "SV" }), 0);
});

test("abilityModifier: STL depends on range band", () => {
  const stl = { ...atlas, abilities: ["STL"] };
  assert.equal(abilityModifier(stl, { rangeBand: "S", targetMovement: "walk" }), 1);
  assert.equal(abilityModifier(stl, { rangeBand: "M", targetMovement: "walk" }), 1);
  assert.equal(abilityModifier(stl, { rangeBand: "L", targetMovement: "walk" }), 2);
});

test("abilityModifier: LMAS/MAS only when target stationary", () => {
  const lmas = { ...atlas, abilities: ["LMAS"] };
  const mas = { ...atlas, abilities: ["MAS"] };
  assert.equal(abilityModifier(lmas, { rangeBand: "S", targetMovement: "stationary" }), 2);
  assert.equal(abilityModifier(lmas, { rangeBand: "S", targetMovement: "walk" }), 0);
  assert.equal(abilityModifier(mas, { rangeBand: "S", targetMovement: "stationary" }), 3);
});

test("hitProbability table with caps", () => {
  assert.equal(hitProbability(2), 0.972);
  assert.equal(hitProbability(7), 0.583);
  assert.equal(hitProbability(12), 0.028);
  assert.equal(hitProbability(13), 0.028);
  assert.equal(hitProbability(1), 0.972);
});

test("attackerToHit sums modifiers with breakdown and min-TN clamp", () => {
  const r = attackerToHit({
    attacker: atlas, attackerEntry: entry,
    target: atlas, targetEntry: entry,
    targetMovement: "walk", rangeBand: "M", terrain: "none", otherModifiers: [0],
  });
  assert.equal(r.tn, 7); // skill 4 + move 0 + tmm 1 + range 2
  assert.equal(r.cannotAttack, false);
  assert.ok(Array.isArray(r.breakdown));
  const total = r.breakdown.reduce((s, b) => s + b.value, 0);
  assert.equal(total, 7);
});

test("attackerToHit: fire control crit adds +2 each", () => {
  const e = { ...entry, crits: { ...CRITS0, fireControl: 2 } };
  const r = attackerToHit({
    attacker: atlas, attackerEntry: e,
    target: atlas, targetEntry: entry,
    targetMovement: "walk", rangeBand: "S", terrain: "none", otherModifiers: [],
  });
  assert.equal(r.tn, 8); // 4 + 0 + 1 + 0 + 4
});

test("attackerToHit: min TN clamps at 2", () => {
  const r = attackerToHit({
    attacker: atlas, attackerEntry: { ...entry, skill: 0 },
    target: atlas, targetEntry: entry,
    targetMovement: "stationary", rangeBand: "S", terrain: "none", otherModifiers: [-5],
  });
  assert.equal(r.tn, 2);
});

test("attackerToHit: destroyed attacker cannot attack", () => {
  const destroyed = { ...entry, armorDamage: 10, structDamage: 8 };
  const r = attackerToHit({
    attacker: atlas, attackerEntry: destroyed,
    target: atlas, targetEntry: entry,
    targetMovement: "walk", rangeBand: "S", terrain: "none", otherModifiers: [],
  });
  assert.equal(r.cannotAttack, true);
  assert.match(r.reason, /destroyed|Destroyed/);
});

test("attackerToHit: shutdown attacker cannot attack", () => {
  const shutdown = { ...entry, heat: "S" };
  const r = attackerToHit({
    attacker: atlas, attackerEntry: shutdown,
    target: atlas, targetEntry: entry,
    targetMovement: "walk", rangeBand: "S", terrain: "none", otherModifiers: [],
  });
  assert.equal(r.cannotAttack, true);
  assert.match(r.reason, /shutdown|Shutdown/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sator.test.js`
Expected: FAIL — module not found (`Cannot find module`).

- [ ] **Step 3: Implement `site/js/sator.js`**

```js
export const RANGE_BANDS = ["S", "M", "L"];

const RANGE_MODS = { S: 0, M: 2, L: 4 };
const MOVE_MODS = { stationary: 0, walk: 0, run: 1, jump: 1 };
const TERRAIN_MODS = {
  none: 0, "light-woods": 1, "heavy-woods": 2, "partial-cover": 1,
  water: 1, "light-smoke": 1, "heavy-smoke": 2,
};

export function rangeModifier(band) {
  return RANGE_MODS[band] ?? 0;
}

export function movementModifier(mode) {
  return MOVE_MODS[mode] ?? 0;
}

export function terrainModifier(terrain) {
  return TERRAIN_MODS[terrain] ?? 0;
}

export function effectiveTargetTmm(target, targetEntry, targetMovement, override) {
  if (override !== null && override !== undefined && override !== "") {
    return Math.max(0, Number(override) || 0);
  }
  if (targetMovement === "stationary") return 0;
  let tmm = target.tmm;
  const mpHits = targetEntry?.crits?.mp ?? 0;
  const engineHits = targetEntry?.crits?.engine ?? 0;
  if (mpHits > 0) tmm = Math.floor(tmm / 2);
  if (engineHits > 0 && target.type !== "BM") tmm = Math.floor(tmm / 2);
  if (targetEntry?.heat === "S") tmm -= 4;
  return Math.max(0, tmm);
}

export function attackerTypeModifier(unit) {
  const abilities = unit.abilities || [];
  if (unit.type === "IM" && !abilities.includes("AFC")) return 1;
  if (unit.type === "SV" && abilities.includes("BFC")) return 1;
  return 0;
}

export function abilityModifier(unit, { rangeBand, targetMovement }) {
  const abilities = unit.abilities || [];
  let mod = 0;
  if (abilities.includes("STL")) mod += rangeBand === "L" ? 2 : 1;
  if (targetMovement === "stationary") {
    if (abilities.includes("LMAS")) mod += 2;
    if (abilities.includes("MAS")) mod += 3;
  }
  return mod;
}

export function hitProbability(tn) {
  const P = [0, 0, 0.972, 0.972, 0.917, 0.833, 0.722, 0.583, 0.417, 0.278, 0.167, 0.083, 0.028];
  if (tn <= 2) return 0.972;
  if (tn >= 12) return 0.028;
  return P[tn];
}

export function attackerToHit({
  attacker, attackerEntry, target, targetEntry,
  targetMovement = "walk", rangeBand = "S", terrain = "none",
  otherModifiers = [], targetTmmOverride = null,
}) {
  if (attackerEntry.armorDamage >= attacker.armor && attackerEntry.structDamage >= attacker.structure) {
    return { tn: null, breakdown: [], probability: 0, cannotAttack: true, reason: "Unit destroyed" };
  }
  if (attackerEntry.heat === "S") {
    return { tn: null, breakdown: [], probability: 0, cannotAttack: true, reason: "Unit is shut down" };
  }
  const breakdown = [];
  const add = (label, value) => { if (value !== 0) breakdown.push({ label, value }); };
  add("Skill", attackerEntry.skill);
  add("Move", movementModifier(attackerEntry.movement || "walk"));
  const tmm = effectiveTargetTmm(target, targetEntry, targetMovement, targetTmmOverride);
  add("TMM", tmm);
  add("Terrain", terrainModifier(terrain));
  add("Range", rangeModifier(rangeBand));
  add("Fire Control", (attackerEntry.crits?.fireControl ?? 0) * 2);
  add("Crew", (attackerEntry.crits?.crew ?? 0) * 2);
  add("Type", attackerTypeModifier(attacker));
  add("Abilities", abilityModifier(target, { rangeBand, targetMovement }));
  const extra = otherModifiers.filter(n => n !== 0);
  if (extra.length) add("Other", extra.reduce((a, b) => a + b, 0));
  const tn = Math.max(2, breakdown.reduce((s, b) => s + b.value, 0));
  return { tn, breakdown, probability: hitProbability(tn), cannotAttack: false, reason: "" };
}
```

Note: the attacker's movement mode arrives via `attackerEntry.movement` — `dialog.js` writes the radio value into a copy of the entry passed to `attackerToHit` (the real state entry is never mutated).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/sator.test.js`
Expected: PASS (17 tests).

- [ ] **Step 5: Commit**

```bash
git add site/js/sator.js tests/sator.test.js
git commit -m "feat: pure SATOR to-hit calculation module"
```

---

### Task 2: `isEntryDestroyed` helper in state.js

**Files:**
- Modify: `site/js/state.js`
- Test: `tests/state.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `isEntryDestroyed(entry, unit) -> boolean` (entry.armorDamage >= unit.armor && entry.structDamage >= unit.structure). Used by Task 3 (cards.js) and Task 5 (app.js).

- [ ] **Step 1: Write the failing test**

Add to `tests/state.test.js`:

```js
import { ..., isEntryDestroyed } from "../site/js/state.js";
```

Append the import addition and:

```js
test("isEntryDestroyed checks full armor and structure damage", () => {
  let e = createEntry(unit);
  assert.equal(isEntryDestroyed(e, unit), false);
  e = { ...e, armorDamage: unit.armor, structDamage: unit.structure };
  assert.equal(isEntryDestroyed(e, unit), true);
  assert.equal(isEntryDestroyed({ ...e, armorDamage: unit.armor - 1 }, unit), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/state.test.js`
Expected: FAIL — `isEntryDestroyed is not a function`.

- [ ] **Step 3: Implement**

In `site/js/state.js`, after `isEntryValid`:

```js
export function isEntryDestroyed(entry, unit) {
  return entry.armorDamage >= unit.armor && entry.structDamage >= unit.structure;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/state.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/js/state.js tests/state.test.js
git commit -m "feat: add isEntryDestroyed helper"
```

---

### Task 3: To-Hit button + two-step remove confirm in cards.js

**Files:**
- Modify: `site/js/cards.js` (renderCard head, ~line 267)
- Test: `tests/cards.test.js`

**Interfaces:**
- Consumes: `isEntryDestroyed` from `../state.js` (Task 2).
- Produces: `.card-tohit` button with `data-action="tohit"` inside the card head (before the remove button); remove button gains `data-armed` class + "Sure?" text when armed. Both consumed by Task 5 (app.js delegation).

- [ ] **Step 1: Write the failing tests**

Add to `tests/cards.test.js` (unit fixture already exists at top):

```js
test("renderCard adds a To-Hit button with tooltip", () => {
  const card = render(unit, createEntry(unit));
  const btn = card.querySelector('.card-tohit[data-action="tohit"]');
  assert.ok(btn, "to-hit button must exist");
  assert.equal(btn.textContent, "To-Hit");
  assert.ok(btn.classList.contains("tip"));
});

test("renderCard disables To-Hit for destroyed units", () => {
  const entry = { ...createEntry(unit), armorDamage: unit.armor, structDamage: unit.structure };
  const card = render(unit, entry);
  const btn = card.querySelector(".card-tohit");
  assert.equal(btn.disabled, true);
  assert.equal(btn.getAttribute("aria-disabled"), "true");
});

test("renderCard disables To-Hit for shutdown units", () => {
  const entry = { ...createEntry(unit), heat: "S" };
  const card = render(unit, entry);
  const btn = card.querySelector(".card-tohit");
  assert.equal(btn.disabled, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/cards.test.js`
Expected: FAIL — `.card-tohit` not found.

- [ ] **Step 3: Implement**

In `site/js/cards.js`:
- Update import: `import { createEntry, HEAT_LEVELS, critTypesForUnit, critCap, tracksHeat, isAerospaceUnit, isEntryDestroyed } from "./state.js";`
- In `renderCard`, after the `remove` button creation (before `head.append`), add:

```js
  const toHit = document.createElement("button");
  toHit.type = "button";
  toHit.className = "card-tohit";
  toHit.dataset.action = "tohit";
  toHit.setAttribute("aria-label", "Open to-hit calculator");
  toHit.textContent = "To-Hit";
  addTip(toHit, "Open the to-hit calculator with this unit as the attacker");
  if (isEntryDestroyed(entry, unit) || entry.heat === "S") {
    toHit.disabled = true;
    toHit.setAttribute("aria-disabled", "true");
    addTip(toHit, "Unit destroyed or shut down — cannot attack");
  }
  head.append(title, variant, pv, toHit, remove);
```

Also replace the inline destroyed-stamp check (`entry.armorDamage >= unit.armor && entry.structDamage >= unit.structure`) with `isEntryDestroyed(entry, unit)` for consistency.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/cards.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/js/cards.js tests/cards.test.js
git commit -m "feat: To-Hit button on cards, disabled for destroyed/shutdown units"
```

---

### Task 4: Dialog DOM module

**Files:**
- Create: `site/js/dialog.js`
- Create: `tests/dialog.test.js`

**Interfaces:**
- Consumes: `attackerToHit`, `RANGE_BANDS`, `rangeModifier`, `movementModifier`, `terrainModifier` from `./sator.js` (Task 1).
- Produces: `ensureSatorDialog(doc) -> overlay element` (idempotent, cached on `doc.__asSatorDialog`), `openSatorDialog({ doc, attacker, attackerEntry })`, `closeSatorDialog(doc)`. Overlay contains: `#sator-title`, attacker fieldset (`.sator-attacker`), target fieldset (`.sator-target` with `input#sator-tmm`, `input[type=radio][name=sator-target-move]`), attack fieldset (`.sator-attack` with `input[type=radio][name=sator-range]`, checkboxes `.sator-if`, `.sator-rear`, `.sator-darkness`, `input#sator-other`), result footer `.sator-result` with `#sator-tn`, `#sator-breakdown`, `#sator-prob`, `#sator-note`, close button `.sator-close`, overlay root `.sator-overlay` with inner `.sator-dialog`.

- [ ] **Step 1: Write the failing tests**

Create `tests/dialog.test.js`:

```js
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
  assert.equal(tn, 4); // skill 4, tmm zeroed by stationary
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/dialog.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `site/js/dialog.js`**

```js
import { attackerToHit, rangeModifier } from "./sator.js";

const TERRAIN_OPTIONS = [
  ["none", "None"],
  ["light-woods", "Light Woods +1"],
  ["heavy-woods", "Heavy Woods +2"],
  ["partial-cover", "Partial Cover +1"],
  ["water", "Water +1"],
  ["light-smoke", "Light Smoke +1"],
  ["heavy-smoke", "Heavy Smoke +2"],
];

function buildDialog(doc) {
  const overlay = doc.createElement("div");
  overlay.className = "sator-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "sator-title");

  const dialog = doc.createElement("div");
  dialog.className = "sator-dialog";

  const title = doc.createElement("h2");
  title.id = "sator-title";
  title.textContent = "To-Hit Calculator";
  const close = doc.createElement("button");
  close.type = "button";
  close.className = "sator-close";
  close.setAttribute("aria-label", "Close to-hit calculator");
  close.textContent = "\u2715";
  const head = doc.createElement("div");
  head.className = "sator-head";
  head.append(title, close);

  // ATTACKER
  const attacker = doc.createElement("fieldset");
  attacker.className = "sator-section sator-attacker";
  attacker.innerHTML = "<legend>Attacker</legend>";
  const atkName = doc.createElement("div");
  atkName.className = "sator-unit-name";
  const atkSkill = doc.createElement("div");
  atkSkill.className = "sator-row";
  atkSkill.innerHTML = "<label>Skill</label><span class='sator-skill-value'></span>";
  const atkFc = doc.createElement("div");
  atkFc.className = "sator-badge sator-fc-badge";
  const atkCrew = doc.createElement("div");
  atkCrew.className = "sator-badge sator-crew-badge";
  const atkMove = doc.createElement("div");
  atkMove.className = "sator-row";
  atkMove.innerHTML =
    "<label>Movement</label><div class='sator-radio-group'>" +
    "<label><input type='radio' name='sator-atk-move' value='stationary'><span>Stationary</span></label>" +
    "<label><input type='radio' name='sator-atk-move' value='walk' checked><span>Walk</span></label>" +
    "<label><input type='radio' name='sator-atk-move' value='run'><span>Run +1</span></label>" +
    "<label><input type='radio' name='sator-atk-move' value='jump'><span>Jump +1</span></label></div>";
  attacker.append(atkName, atkSkill, atkFc, atkCrew, atkMove);

  // TARGET
  const target = doc.createElement("fieldset");
  target.className = "sator-section sator-target";
  target.innerHTML = "<legend>Target</legend>";
  const tmmRow = doc.createElement("div");
  tmmRow.className = "sator-row";
  tmmRow.innerHTML = "<label for='sator-tmm'>TMM</label><input id='sator-tmm' class='sator-number' type='number' step='1' min='0' max='6' value='0'>";
  const tgtMove = doc.createElement("div");
  tgtMove.className = "sator-row";
  tgtMove.innerHTML =
    "<label>Movement</label><div class='sator-radio-group'>" +
    "<label><input type='radio' name='sator-target-move' value='stationary'><span>Stationary</span></label>" +
    "<label><input type='radio' name='sator-target-move' value='walk' checked><span>Walk</span></label>" +
    "<label><input type='radio' name='sator-target-move' value='run'><span>Run</span></label>" +
    "<label><input type='radio' name='sator-target-move' value='jump'><span>Jump</span></label></div>";
  const terrainRow = doc.createElement("div");
  terrainRow.className = "sator-row";
  const terrainSel = doc.createElement("select");
  terrainSel.id = "sator-terrain";
  terrainSel.className = "sator-select";
  for (const [value, label] of TERRAIN_OPTIONS) {
    const opt = doc.createElement("option");
    opt.value = value;
    opt.textContent = label;
    terrainSel.append(opt);
  }
  terrainRow.append(doc.createTextNode("Terrain"), terrainSel);
  target.append(tmmRow, tgtMove, terrainRow);

  // RANGE
  const range = doc.createElement("fieldset");
  range.className = "sator-section sator-range";
  range.innerHTML = "<legend>Range</legend>";
  const rangeRow = doc.createElement("div");
  rangeRow.className = "sator-radio-group";
  rangeRow.innerHTML =
    "<label><input type='radio' name='sator-range' value='S' checked><span>Short</span></label>" +
    "<label><input type='radio' name='sator-range' value='M'><span>Medium +2</span></label>" +
    "<label><input type='radio' name='sator-range' value='L'><span>Long +4</span></label>";
  range.append(rangeRow);

  // OTHER
  const other = doc.createElement("fieldset");
  other.className = "sator-section sator-other";
  other.innerHTML = "<legend>Other</legend>";
  const chk = (id, label, checked) =>
    `<label><input type='checkbox' id='${id}' class='sator-other-chk' ${checked ? "" : ""}>${label}</label>`;
  const otherRow = doc.createElement("div");
  otherRow.className = "sator-chips";
  otherRow.innerHTML =
    chk("sator-if", "Indirect Fire +1") +
    chk("sator-rear", "Rear Weapons +1") +
    chk("sator-darkness", "Darkness +1");
  const otherNum = doc.createElement("div");
  otherNum.className = "sator-row";
  otherNum.innerHTML = "<label for='sator-other'>Other</label><input id='sator-other' class='sator-number' type='number' step='1' min='-10' max='10' value='0'>";
  other.append(otherRow, otherNum);

  // RESULT
  const result = doc.createElement("div");
  result.className = "sator-result";
  const tnEl = doc.createElement("div");
  tnEl.id = "sator-tn";
  tnEl.className = "sator-tn";
  const breakdownEl = doc.createElement("div");
  breakdownEl.id = "sator-breakdown";
  breakdownEl.className = "sator-breakdown";
  const probEl = doc.createElement("div");
  probEl.id = "sator-prob";
  probEl.className = "sator-prob";
  const noteEl = doc.createElement("div");
  noteEl.id = "sator-note";
  noteEl.className = "sator-note";
  result.append(tnEl, breakdownEl, probEl, noteEl);

  dialog.append(head, attacker, target, range, other, result);
  overlay.append(dialog);

  let currentAttacker = null;
  let currentEntry = null;

  function readInputs() {
    const q = s => dialog.querySelector(s);
    const atkMove = dialog.querySelector('input[name="sator-atk-move"]:checked');
    const tgtMove = dialog.querySelector('input[name="sator-target-move"]:checked');
    const rangeBand = dialog.querySelector('input[name="sator-range"]:checked');
    const extra = [];
    if (q("#sator-if").checked) extra.push(1);
    if (q("#sator-rear").checked) extra.push(1);
    if (q("#sator-darkness").checked) extra.push(1);
    extra.push(Number(q("#sator-other").value) || 0);
    const atkEntry = { ...currentEntry, movement: atkMove ? atkMove.value : "walk" };
    return {
      attacker: currentAttacker,
      attackerEntry: atkEntry,
      target: currentAttacker,
      targetEntry: { ...atkEntry, movement: undefined },
      targetMovement: tgtMove ? tgtMove.value : "walk",
      rangeBand: rangeBand ? rangeBand.value : "S",
      terrain: q("#sator-terrain").value,
      otherModifiers: extra,
      targetTmmOverride: q("#sator-tmm").value,
    };
  }

  function recompute() {
    const r = attackerToHit(readInputs());
    if (r.cannotAttack) {
      tnEl.textContent = "\u2014";
      breakdownEl.textContent = r.reason;
      probEl.textContent = "";
      noteEl.textContent = "";
      return;
    }
    tnEl.textContent = String(r.tn);
    tnEl.classList.toggle("impossible", r.tn > 12);
    breakdownEl.textContent = r.breakdown.length
      ? r.breakdown.map(b => `${b.value > 0 ? "+" : ""}${b.value} ${b.label}`).join(" ") + ` = ${r.tn}`
      : `TN ${r.tn}`;
    probEl.textContent = `2d6 \u2265 ${r.tn} \u2192 ${(r.probability * 100).toFixed(1)}% chance to hit`;
    noteEl.textContent = r.tn > 12
      ? "Only a natural 12 can hit"
      : "Natural 12 = auto-hit \u00b7 Natural 2 = auto-miss \u00b7 Min TN 2";
  }

  dialog.addEventListener("input", recompute);
  dialog.addEventListener("change", recompute);

  function open() {
    const skillEl = dialog.querySelector(".sator-skill-value");
    skillEl.textContent = String(currentEntry.skill);
    const fc = currentEntry.crits?.fireControl ?? 0;
    const crew = currentEntry.crits?.crew ?? 0;
    dialog.querySelector(".sator-fc-badge").textContent = fc ? `Fire Control +${fc * 2}` : "";
    dialog.querySelector(".sator-crew-badge").textContent = crew ? `Crew +${crew * 2}` : "";
    dialog.querySelector(".sator-unit-name").textContent =
      `${currentAttacker.class} ${currentAttacker.variant}`;
    dialog.querySelector("#sator-tmm").value = "0";
    dialog.querySelector("#sator-other").value = "0";
    dialog.querySelector("#sator-if").checked = false;
    dialog.querySelector("#sator-rear").checked = false;
    dialog.querySelector("#sator-darkness").checked = false;
    const m = dialog.querySelector('input[name="sator-atk-move"][value="walk"]');
    if (m) m.checked = true;
    const tm = dialog.querySelector('input[name="sator-target-move"][value="walk"]');
    if (tm) tm.checked = true;
    const r = dialog.querySelector('input[name="sator-range"][value="S"]');
    if (r) r.checked = true;
    dialog.querySelector("#sator-terrain").value = "none";
    recompute();
    overlay.hidden = false;
    const first = dialog.querySelector("input, select, button:not(.sator-close)");
    if (first) first.focus();
  }

  overlay.__open = (attacker, attackerEntry) => {
    currentAttacker = attacker;
    currentEntry = attackerEntry;
    open();
  };

  close.addEventListener("click", () => {
    overlay.hidden = true;
    overlay.__returnFocus?.focus?.();
  });
  overlay.addEventListener("click", e => {
    if (e.target === overlay) {
      overlay.hidden = true;
      overlay.__returnFocus?.focus?.();
    }
  });
  const escHandler = e => {
    if (e.key === "Escape" && !overlay.hidden) {
      overlay.hidden = true;
      overlay.__returnFocus?.focus?.();
    }
  };
  overlay.__escHandler = escHandler;
  return overlay;
}

export function ensureSatorDialog(doc) {
  if (doc.__asSatorDialog) return doc.__asSatorDialog;
  const overlay = buildDialog(doc);
  doc.body.appendChild(overlay);
  doc.__asSatorDialog = overlay;
  return overlay;
}

export function openSatorDialog({ doc, attacker, attackerEntry }) {
  const overlay = ensureSatorDialog(doc);
  overlay.__returnFocus = doc.activeElement;
  overlay.__open(attacker, attackerEntry);
  doc.addEventListener("keydown", overlay.__escHandler);
}

export function closeSatorDialog(doc) {
  const overlay = doc.__asSatorDialog;
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  doc.removeEventListener("keydown", overlay.__escHandler);
  overlay.__returnFocus?.focus?.();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/dialog.test.js`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add site/js/dialog.js tests/dialog.test.js
git commit -m "feat: SATOR dialog DOM module with live calculation"
```

---

### Task 5: Wire dialog into app.js + two-step remove

**Files:**
- Modify: `site/js/app.js`
- Test: `tests/app.test.js`

**Interfaces:**
- Consumes: `ensureSatorDialog`, `openSatorDialog`, `closeSatorDialog` from `./dialog.js` (Task 4).
- Produces: roster delegation branch for `data-action="tohit"`; two-step remove arming in the `remove` branch; `ensureSatorDialog(_doc)` called once in `init()`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/app.test.js` (existing `boot()` + `showSomeUnits()` helpers already present):

```js
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

test("Esc closes the dialog and returns focus", async () => {
  const { document } = await boot();
  showSomeUnits();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const tohit = document.querySelector(".card-tohit");
  tohit.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
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
  assert.ok(removeBtn.classList.contains("armed") || removeBtn.textContent === "Sure?");
  removeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 0);
  assert.equal(saved.at(-1).roster.length, 0);
});

test("remove arming is cancelled by clicking elsewhere", async () => {
  const { document } = await boot();
  showSomeUnits();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const removeBtn = document.querySelector(".card-remove");
  removeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.ok(removeBtn.classList.contains("armed"));
  document.querySelector(".card-title").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.ok(!removeBtn.classList.contains("armed"), "outside click must cancel arming");
  removeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 1, "after cancel, click removes immediately");
});
```

Note the last test asserts the second click after cancel performs a normal removal — the armed-state click and a fresh click are indistinguishable to the handler, so "click after cancel" = the very next click removes. If you prefer require-rearm after cancel, assert the opposite; pick one and be consistent.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/app.test.js`
Expected: FAIL — `.sator-overlay` missing; remove removes on first click.

- [ ] **Step 3: Implement in `site/js/app.js`**

- Add import: `import { ensureSatorDialog, openSatorDialog, closeSatorDialog } from "./dialog.js";`
- In `init()`, next to `initTooltips(doc)`: `ensureSatorDialog(doc);`
- Replace the `remove` branch (currently removes immediately) with a two-step:

```js
      if (e.target.dataset.action === "remove") {
        const armed = e.target.classList.contains("armed");
        if (!armed) {
          e.target.classList.add("armed");
          e.target.textContent = "Sure?";
          const disarm = () => {
            e.target.classList.remove("armed");
            e.target.textContent = "\u2715";
            _doc.removeEventListener("click", disarmOutside);
          };
          const disarmOutside = ev => {
            if (!e.target.contains(ev.target)) disarm();
          };
          _doc.addEventListener("click", disarmOutside);
          setTimeout(() => {
            e.target.classList.remove("armed");
            e.target.textContent = "\u2715";
            _doc.removeEventListener("click", disarmOutside);
          }, 2500);
          return;
        }
        const nextGroups = _state.groups
          .map(g => removeUnitFromGroup(g, entryId))
          .filter(g => g.unitIds.length > 0);
        _state = {
          ..._state,
          roster: _state.roster.filter(entry => entry.id !== entryId),
          groups: nextGroups,
        };
        persist();
        renderRoster();
        return;
      }
```

- Add the `tohit` branch inside the `if (card)` block, before the final `return;`:

```js
      if (e.target.dataset.action === "tohit") {
        const entry = _state.roster.find(en => en.id === entryId);
        if (!entry) return;
        const unit = _unitById.get(entry.unitId);
        if (!unit) return;
        openSatorDialog({ doc: _doc, attacker: unit, attackerEntry: entry });
        return;
      }
```

- Add a `keydown` listener on `_doc` in `init()` (persistent, so Esc works even if focus is on the body):

```js
  _doc.addEventListener("keydown", e => {
    if (e.key === "Escape") closeSatorDialog(_doc);
  });
```

(Since `closeSatorDialog` no-ops when hidden, a persistent listener is safe and avoids add/remove churn. If the plan's dialog.js already binds per-open Esc, the persistent listener is redundant — keep the dialog.js one and skip this.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/app.test.js`
Expected: PASS (new tests + existing 28).

- [ ] **Step 5: Commit**

```bash
git add site/js/app.js tests/app.test.js
git commit -m "feat: wire SATOR dialog into roster delegation; two-step remove confirm"
```

---

### Task 6: Dialog and remove-confirm styling

**Files:**
- Modify: `site/styles.css`
- Test: `tests/site-structure.test.js`

**Interfaces:**
- Consumes: CSS variables `--panel`, `--panel-2`, `--border`, `--accent`, `--accent-strong`, `--tan`, `--damaged`, `--muted`, `--text`, `--bg`, `--font-head` (all defined at styles.css:1-16).
- Produces: `.sator-overlay`, `.sator-dialog`, `.sator-head`, `.sator-section`, `.sator-row`, `.sator-radio-group`, `.sator-select`, `.sator-number`, `.sator-badge`, `.sator-chips`, `.sator-result`, `.sator-tn`, `.sator-tn.impossible`, `.sator-breakdown`, `.sator-prob`, `.sator-note`, `.sator-close`, `.card-tohit`, `.card-remove.armed`.

- [ ] **Step 1: Add failing structure test**

In `tests/site-structure.test.js`, in `"styles.css defines the BattleTech palette"`, add:

```js
  assert.match(css, /\.sator-overlay\s*\{/);
  assert.match(css, /\.sator-dialog\s*\{/);
  assert.match(css, /\.card-tohit\s*\{/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/site-structure.test.js`
Expected: FAIL — `.sator-overlay` not found.

- [ ] **Step 3: Implement CSS**

Append to `site/styles.css` (before the mobile media query at the end):

```css
.card-tohit {
  margin-left: auto;
  font-size: 11px;
  padding: 3px 8px;
}
.card-tohit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.card-remove.armed {
  color: var(--damaged);
  border-color: var(--damaged);
}

.sator-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}
.sator-overlay[hidden] { display: none; }
.sator-dialog {
  background: var(--panel);
  border: 1px solid var(--border);
  border-top: 3px solid var(--accent);
  border-radius: 6px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  color: var(--text);
}
.sator-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.sator-head h2 { font-size: 16px; margin: 0; }
.sator-close {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 18px;
  cursor: pointer;
  padding: 2px 8px;
}
.sator-close:hover { color: var(--damaged); }
.sator-section {
  border: none;
  border-bottom: 1px solid var(--border);
  padding: 10px 16px;
  margin: 0;
}
.sator-section legend {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--accent-strong);
  padding: 0;
  margin-bottom: 4px;
}
.sator-unit-name { font-weight: 600; margin-bottom: 4px; }
.sator-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.sator-row label { color: var(--muted); font-size: 13px; }
.sator-radio-group {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.sator-radio-group label {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text);
}
.sator-radio-group input[type="radio"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.sator-radio-group label:has(input:checked) {
  border-color: var(--accent);
  background: rgba(240, 124, 31, 0.15);
}
.sator-select, .sator-number {
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
}
.sator-number { width: 56px; text-align: center; }
.sator-badge {
  display: inline-block;
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 11px;
  color: var(--tan);
  background: rgba(194, 178, 128, 0.08);
  margin: 2px 4px 2px 0;
}
.sator-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sator-chips label {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.sator-result {
  border-top: 2px solid var(--accent);
  padding: 14px 16px;
  background: var(--panel-2);
  text-align: center;
}
.sator-tn {
  font-family: var(--font-head);
  font-size: 40px;
  color: var(--tan);
  line-height: 1;
}
.sator-tn.impossible { color: var(--damaged); }
.sator-breakdown {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
}
.sator-prob { font-size: 14px; color: var(--muted); margin-top: 4px; }
.sator-note { font-size: 11px; color: var(--muted); margin-top: 6px; }
```

Inside the existing mobile media query (`@media (max-width: 700px)`) add:

```css
  .sator-overlay { padding: 0; align-items: stretch; }
  .sator-dialog {
    max-width: 100vw;
    max-height: 100vh;
    border-radius: 0;
    border: none;
  }
  .sator-result { position: sticky; bottom: 0; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/site-structure.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite + coverage**

Run: `npm test` then `npx c8 node --test tests/*.test.js`
Expected: all tests pass; coverage gate passes (≥90 lines / ≥85 branch / ≥85 funcs). Note: if `c8` reports below threshold, add missing tests for the uncovered `dialog.js` branches before committing.

- [ ] **Step 6: Commit**

```bash
git add site/styles.css tests/site-structure.test.js
git commit -m "style: SATOR dialog, To-Hit button, and remove-confirm styling"
```

---

## Self-review notes

- Spec coverage: To-Hit button ✓ (T3), two-step remove ✓ (T3/T5), plain-div dialog ✓ (T4), live calc ✓ (T4), manual TMM ✓ (T4), probability ✓ (T1/T4), breakdown ✓ (T1/T4), guards ✓ (T1/T3), a11y attributes ✓ (T4), CSS ✓ (T6), tests ✓ (all tasks).
- Deferred per spec: dice roll, OV, size modifiers, aerospace/physical modes, roster dropdown, persistence.
- Type consistency: `attackerToHit` signature matches across T1/T4/T5; `isEntryDestroyed` matches T2/T3/T5; `ensureSatorDialog`/`openSatorDialog`/`closeSatorDialog` signatures match T4/T5.
