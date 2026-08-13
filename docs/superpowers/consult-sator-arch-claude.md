# SATOR To-Hit Calculator — Architecture & Integration Consult

**Author:** Claude (consult, 2026-08-13)
**Scope:** Architecture and integration only. Pure math, formulas, and UX copy are out of scope and will be handled by a separate math/UX consult. This report designs how the calculator *fits the codebase* so the implementation work can proceed in parallel.

---

## 1. Current codebase shape (facts the design rests on)

- **Stack:** vanilla JS, ES modules, no framework, no build step. `package.json` has `type: "module"`. Tests run with `node --test tests/*.test.js` + `c8` + `jsdom` (`package.json:6-12`).
- **Module layout** under `site/js/`:
  - `app.js` — orchestrator. `init({ doc, storage })`, calls `initTooltips(doc)`, fetches `data/units.json`, populates filters, wires delegation on `#roster`, `#picker-list`, `#search`, etc. (`app.js:159-313`)
  - `cards.js` — pure render functions (`renderCard`, `abilityTip`, `renderCard` is a DOM builder, ~430L, exports `renderCard` + `abilityTip`).
  - `state.js` — pure data mutators (`createEntry`, `setSkill`, `damageArmor`, `damageStruct`, `setHeat`, `toggleCrit`, group helpers, `critCap`, `tracksHeat`, `isAerospaceUnit`, `isClanUnit`). All return new objects; no DOM, no storage.
  - `storage.js` — pure-ish, wraps `localStorage`. `loadStateSafe`, `sanitizeState`, `validateState`, `exportBlob`, `importState`.
  - `search.js` — pure (`filterUnits`, `uniqueTypes`, `uniqueValues`, `typeName`).
  - `tooltips.js` — DOM-bound. Uses an `__asTooltips` idempotency flag on `doc`. Creates one floating `<div class="tooltip-float">` and listens on `document` for `mouseover`/`mouseout`/`mousemove`/`touchstart`/`scroll` (`tooltips.js:1-72`).
- **DOM convention:**
  - The "skeleton" (`<header>`, `<section id="picker">`, `<main id="roster">`) lives in `index.html`.
  - Anything that appears after a click or hover (e.g. the tooltip `<div>`) is **injected by JS into `document.body`**. There is no static `<div class="tooltip-float">` in `index.html` (confirmed — `index.html` has none).
  - The picker hint and no-match `<li>` are also injected by `renderPicker` (`app.js:99-126`).
- **Event delegation pattern:** Single `click` listener on `#roster` reads `e.target.dataset.action`, `data-action` strings drive the dispatch (`app.js:228-273`). Card chrome sets `data-unit-id` / `data-entry-id` on the `<article class="card">` and `data-action` on each interactive child (`cards.js:251-272`).
- **Testing pattern:** `tests/*.test.js` each create a `JSDOM`, set `globalThis.document = dom.window.document`, then call the pure function directly. For integration tests, `tests/app.test.js:18-39` defines a `boot()` that loads `site/index.html` into JSDOM, stubs `fetch`, sets `window.__AS_MANUAL__ = true`, then `await import("../site/js/app.js")` and calls `app.init({ doc, storage })` with a hand-rolled storage shim.
- **No modal/dialog/backdrop CSS exists yet** (confirmed by grep of `styles.css`).

This shape — pure logic module + DOM module + thin wiring in `app.js` — is the pattern every new feature follows. The calculator should follow it too.

---

## 2. Module split: pure logic vs DOM dialog

### Recommendation: two new files

```
site/js/sator.js        — pure, no DOM, no globals. The SATOR formula + helpers.
site/js/dialog.js       — DOM: renderSatorDialog(), openSatorDialog({...}), closeSatorDialog().
```

#### `site/js/sator.js` — pure

Exports:

- `RANGE_BANDS = ["S", "M", "L"]` (or similar constant — defer to math consult)
- `rangeModifier(band) -> number` (e.g. S=0, M=+2, L=+4 — also visible in `cards.js:302-305` damage-row tip labels)
- `sizeModifier(attackerSize, targetSize) -> number` (table from ASCE; math consult owns the numbers)
- `movementModifier(attackerTmm, targetMoved) -> number`
- `attackerToHit({ attacker, attackerSkill, attackerTmm, target, targetSize, rangeBand, otherModifiers }) -> { tn: number, breakdown: Array<{label, value}> }`

Why pure and in its own file:
- It is fully testable in `node:test` with no JSDOM (this is the codebase's most-established pattern; see `tests/state.test.js` for parallel).
- `cards.js` and `app.js` will both consume it (the damage-row labels reference S/M/L modifiers; future "preview TN" badges on hover would also reuse this). It belongs in a "rules" layer, not a "DOM" layer.
- The existing module split already has `state.js` (mutators) and `search.js` (queries) as pure modules. `sator.js` slots in next to them.
- Keep it small enough to hold in context: probably <150 lines including the modifier table.

The function signature should return a `breakdown` array so the dialog can render the math step-by-step (e.g. `Skill 4 + size +2 + range +2 = TN 8`). The dialog does not need to recompute anything.

#### `site/js/dialog.js` — DOM

Exports:

- `renderSatorDialog()` — returns a fresh detached `<div class="sator-overlay" hidden>...` element. No `document.body.appendChild` side effect. (Mirrors how `cards.js:249` `renderCard` returns a detached `DocumentFragment`-equivalent element the caller inserts.)
- `openSatorDialog({ doc, overlay, attacker, attackerEntry, target, targetEntry, rangeBand, otherModifiers })` — fills in fields, shows the overlay, focuses the first input, traps focus (defer focus trap decision — see §6).
- `closeSatorDialog(doc, overlay)` — hides the overlay, restores focus to the triggering card button.
- Internal: an `__asSatorDialog` idempotency flag on `doc` so a stray second `initSatorDialog(doc)` call is a no-op (mirrors `tooltips.js:2-3`).

Idempotency follows the `__asTooltips` precedent so a future second `init()` call (e.g. in a test) doesn't double-bind `keydown`/`click` listeners on `document`. Tests already rely on the same idempotency property in `tooltips.js`.

`dialog.js` imports `attackerToHit` from `./sator.js` to drive live recompute as the user toggles fields — but the math still lives in the pure module, not in the dialog.

#### Why a separate `dialog.js` and not putting the dialog in `app.js`

`app.js` is 405 lines and is already the busiest file in the repo. Putting a 100–150-line dialog module in there would push it past the point where a reader can hold it in context — exactly the "file grew too large" signal called out by the brainstorming skill. `cards.js` is the wrong home because it deals with card chrome, not transient modals. A new `dialog.js` keeps each module focused.

---

## 3. Card button integration — how `renderCard` adds "To-Hit" without breaking delegation

### The current pattern (don't break it)

- Card root: `<article class="card" data-unit-id="…" data-entry-id="…">` (`cards.js:250-253`).
- Existing chrome uses `data-action` strings as delegation tokens: `"remove"`, `"armor"`, `"struct"`, `"set-skill"` (`app.js:235-273`).
- `app.js:228-273` is a single `click` listener on `#roster`. It branches on `e.target.dataset.action` and bails on unknown actions — so any new action string can be added without touching the existing branches.

### Add a fourth "To-Hit" action

In `cards.js` `renderCard` (alongside the existing `remove` button at `cards.js:267-272`), add a button:

```js
const toHit = document.createElement("button");
toHit.type = "button";
toHit.className = "card-tohit";
toHit.dataset.action = "tohit";
toHit.setAttribute("aria-label", "Open to-hit calculator");
toHit.textContent = "To-Hit";
addTip(toHit, "Open the to-hit calculator with this unit as the attacker");
head.append(title, variant, pv, toHit, remove);
```

Place the button to the **left of `remove`** in the head. Order is `head.append(title, variant, pv, toHit, remove)` so visually it appears next to the existing PV badge.

In `app.js` `roster` click delegation (`app.js:230-273`), add a new branch **before** the closing `}` of the `if (card) { … }` block:

```js
if (e.target.dataset.action === "tohit") {
  openSatorDialog({ doc, attacker: unit, attackerEntry: entry, target: null /* prefill only — see §4 */, rangeBand: "M" });
  return;
}
```

This is additive — no existing action string changes, no existing branch's logic changes. The `return;` keeps it from falling through to the `crit` handler.

### Conflict check

- `"tohit"` does not collide with any existing `data-action` value (`remove`, `armor`, `struct`, `set-skill`, `delete-group`).
- `addTip(toHit, …)` reuses the existing tooltip system — no new tooltip module needed.
- The button is inside the `<article class="card">`, so the existing `e.target.closest(".card")` lookup still finds the entry id.

### What goes in the head vs the body

`cards.js` puts all chrome controls in `head` (title, variant, PV, remove). The new button is a chrome control → head. Putting it in the body would force the delegation handler to look in a different DOM subtree and break the pattern.

---

## 4. Dialog DOM: static skeleton or JS-injected?

### Recommendation: injected by `dialog.js`, not in `index.html`

Two precedents in the repo:

| Element | Where defined | Why |
|---|---|---|
| `<header>`, `<section id="picker">`, `<main id="roster">` | `index.html` | Always present, never duplicated. Skeleton. |
| `<div class="tooltip-float">` (`tooltips.js:7-9`) | Injected by JS | Always 0 or 1, lifecycle owned by the module. |
| `<li class="picker-hint">`, `<li class="picker-empty">` (`app.js:99-126`) | Injected by JS | Conditional, lives only when the picker is in that state. |
| `STORAGE_KEY` in `storage.js:3` (no UI but parallel pattern) | JS constant | Single source of truth. |

The SATOR dialog has the same shape as the tooltip: exactly zero or one instance, lifecycle owned by the feature, never seen by users who never click the button. **Inject it.** The alternative — a static `<dialog id="sator-dialog" hidden>` in `index.html` — would be the only interactive element in `index.html` that lives behind a feature gate, and would force `index.html` to know the dialog's structure (against the existing separation).

### Lifecycle in `dialog.js`

```js
export function ensureSatorDialog(doc) {
  if (doc.__asSatorDialog) return doc.__asSatorDialog;
  const overlay = renderSatorDialog();   // detached
  doc.body.appendChild(overlay);
  bindSatorDialogEvents(doc, overlay);
  doc.__asSatorDialog = overlay;
  return overlay;
}
```

`app.js:162` already calls `initTooltips(doc)` once at boot. Add the same one-liner: `ensureSatorDialog(doc)`. (Rename to `initSatorDialog(doc)` to match the `initTooltips` precedent, or keep `ensure` — minor.)

`renderSatorDialog` returns the overlay; the function takes `doc` so it can use `doc.createElement` (mirroring `cards.js:250` which assumes the global `document` exists; passing `doc` is better because the codebase already passes `doc` to `init` for testability — see `app.js:159` and `app.js:227` using `_doc`).

### Prefill from unit data

The dialog has two roles: "attacker" (the unit whose card was clicked) and "target" (the unit being attacked, picked from the roster). The button is on a card, so the **attacker is the unit whose card was clicked** — already known at click time:

```js
if (e.target.dataset.action === "tohit") {
  const card = e.target.closest(".card");
  const entryId = card.dataset.entryId;
  const entry = _state.roster.find(e => e.id === entryId);
  const unit = _unitById.get(entry.unitId);
  ensureSatorDialog(_doc);
  openSatorDialog({ doc: _doc, attacker: unit, attackerEntry: entry });
  return;
}
```

The dialog form needs a **target picker** — a `<select>` listing all other units in the roster (excluding the attacker, since a unit doesn't shoot itself). Pulled from `_state.roster` + `_unitById`. This is a read of state, not a write — the calculator doesn't mutate anything.

If the user wants to attack a unit that isn't on the table, the dialog can include a "Custom target" form where they enter target Size and TMM directly. Defer this UX decision to the math/UX consult, but architecturally: a `<select>` of roster units plus a manual override is two text/number inputs and one `<select>`, all inside the dialog. No new module.

---

## 5. State: stateless tool

**Recommendation: do not persist anything to `state` or `localStorage`.**

The calculator is a "compute and forget" tool. Closing the dialog discards all values; reopening gives a fresh form pre-populated only with the attacker's unit data. The roster (`_state`) is not touched. The storage layer is not touched. The import/export format is not touched (no schema migration).

Why this is the right call:
- The `STORAGE_KEY = "as-companion-state-v1"` schema in `storage.js:3` is intentionally small (roster + groups). Adding a `lastSatorInputs` field would bloat every save and every sanitization pass for zero benefit.
- The user's `lastOpened = 2026-08-13` style field would be dead code — when would you ever restore it?
- The dialog is a view, not a record. It reads from the same `roster` data the rest of the app reads from.

What the dialog *does* need is the live `roster` snapshot at open time, so the target `<select>` can list current units. That's a read, not a state write — `app.js` passes `_state.roster` to `openSatorDialog` as a parameter; the dialog closes and the reference is dropped.

If a future feature wants "save common attack profiles" (e.g. "frequently used TN modifier stacks"), that's a separate design conversation, not something to pre-bake into the schema. YAGNI applies.

---

## 6. Event wiring: delegation, open/close, and lifecycle

### Wire it in `app.js`, not in the dialog module

`dialog.js` should expose `openSatorDialog` / `closeSatorDialog` as pure functions. The click handler that calls them lives in `app.js` next to the existing `data-action === "remove"` branch. This keeps the delegation surface area in one place.

### What `dialog.js` does bind

- One `click` listener on the overlay element to catch backdrop-clicks (close if `e.target === overlay`).
- One `click` listener on a `.sator-close` button inside the dialog.
- One `keydown` listener on `document` to handle `Escape` (close).
- One `input` listener on the dialog root (delegation) to live-recompute `attackerToHit(...)` when range / target / modifier inputs change.

The `keydown` listener is the only one that lives on `document`. It must be added/removed in tandem with the dialog's open/close to avoid the same "listener never torn down" issue called out in `docs/superpowers/consult-audit-r2-claude.md:45` for `initTooltips`. Implementation: `addEventListener` at `openSatorDialog` time, `removeEventListener` at `closeSatorDialog` time. Track the handler in a module-local variable so the close path can pass the same function reference to `removeEventListener`.

### Idempotency

`ensureSatorDialog(doc)` (or `initSatorDialog(doc)`) is called once from `app.init`. The `__asSatorDialog` flag on `doc` prevents a second `init()` (which the test harness does) from creating two dialogs with two `keydown` listeners. The `__asTooltips` pattern in `tooltips.js:2-3` is the exact precedent.

### Focus management

When the dialog opens:
1. `e.target.closest(".card-tohit")` is the previously-focused element. Stash a reference on the dialog: `overlay.__returnFocus = e.target`.
2. After `overlay.hidden = false`, call `overlay.querySelector("input, select, button")`.focus().

When the dialog closes:
1. `overlay.hidden = true`.
2. `overlay.__returnFocus?.focus()`.

Focus trap (Tab/Shift+Tab cycling inside the dialog) is a nice-to-have but **not required for the first iteration**. Defer to the math/UX consult.

### Open/close API shape

```js
// in dialog.js
export function openSatorDialog({ doc, attacker, attackerEntry, target = null }) {
  const overlay = ensureSatorDialog(doc);
  fillAttackerSection(overlay, attacker, attackerEntry);
  fillTargetSection(overlay, target);
  overlay.hidden = false;
  // focus, keydown listener
}

export function closeSatorDialog(doc) {
  const overlay = doc.__asSatorDialog;
  if (!overlay) return;
  overlay.hidden = true;
  // remove keydown listener, return focus
}
```

Both are explicit and testable — `tests/dialog.test.js` can call `openSatorDialog` with a JSDOM and assert `overlay.hidden === false`, then `closeSatorDialog` and assert it flips back. No need to fire a click event to test the open/close path.

### Why not use `<dialog>` and `dialog.showModal()`

- The repo has zero existing modal precedent. The tooltip float is the closest analog and is a plain `<div>`. Matching the precedent keeps the CSS cohesive.
- `<dialog>` requires browser support testing in JSDOM (it's supported in jsdom ≥ 16 but with `requestClose` quirks). Plain `<div hidden>` + `aria-modal="true"` + `role="dialog"` works identically in jsdom and in browsers.
- The repo's design language uses `--panel` / `--border` / `--accent` (`styles.css:1-16`); styling a native `<dialog>` to match would mean either overriding browser defaults or accepting a different look. A plain div inherits the existing CSS variables.

---

## 7. Testing strategy

### Three layers, matching the existing pattern

#### 7a. `tests/sator.test.js` — pure function tests, no JSDOM

```js
import test from "node:test";
import assert from "node:assert/strict";
import { attackerToHit, rangeModifier, sizeModifier, movementModifier } from "../site/js/sator.js";

test("rangeModifier returns documented S/M/L values", () => {
  // assertions driven by the math consult
});
```

Mirrors `tests/state.test.js`. This is the highest-leverage test layer — covers the formula table, the breakdown array shape, edge cases (size 1 attacking size 4, range L, no movement, etc.). Math consult supplies the fixtures.

#### 7b. `tests/dialog.test.js` — JSDOM, tests the dialog DOM and lifecycle

```js
import { JSDOM } from "jsdom";
import { openSatorDialog, closeSatorDialog, ensureSatorDialog } from "../site/js/dialog.js";

const dom = new JSDOM("<!DOCTYPE html><body></body>");
globalThis.document = dom.window.document;

test("ensureSatorDialog is idempotent", () => {
  const a = ensureSatorDialog(document);
  const b = ensureSatorDialog(document);
  assert.equal(a, b);
  assert.equal(document.querySelectorAll(".sator-overlay").length, 1);
});

test("openSatorDialog shows the overlay and pre-fills attacker", () => { /* … */ });
test("closeSatorDialog hides the overlay and returns focus", () => { /* … */ });
test("Escape closes the dialog", () => { /* … */ });
test("backdrop click closes the dialog", () => { /* … */ });
```

Mirrors `tests/cards.test.js` (which also does `new JSDOM()` + `globalThis.document = …` + DOM assertion per test).

#### 7c. `tests/app.test.js` additions — end-to-end via the existing `boot()` harness

The existing `boot()` in `tests/app.test.js:18-39` returns `{ document, saved, app }` and is reused across 16 tests. Add a small number of integration tests:

```js
test("clicking card to-hit button opens the dialog pre-filled with the attacker", async () => {
  const { document } = await boot();
  await showSomeUnits();
  document.querySelector("#picker-list li button").click();
  const tohit = document.querySelector("#roster .card-tohit");
  tohit.click();
  const dialog = document.querySelector(".sator-overlay");
  assert.equal(dialog.hidden, false);
  assert.match(dialog.textContent, /ATLAS/);  // attacker pre-filled
});
```

This is the same `boot()` pattern, the same `dispatchEvent` style, the same `await settle()`. No new harness.

#### 7d. Don't do

- Don't add a test for the auto-boot path of `app.js` (the `if (!window.__AS_MANUAL__)` branch) — out of scope; the `2026-08-13-coverage-audit` consult already flagged that as a separate work item.
- Don't unit-test `addTip` — it's already covered transitively by `tests/cards.test.js` and `tests/app.test.js`.
- Don't add Playwright / browser tests — the repo is jsdom-only. Stay consistent.

### Coverage gate

`package.json:7` already runs `c8` as `test:coverage`. The new modules will be picked up by the existing glob. No `c8` config change needed; if the existing threshold is too low, that's a separate consult.

---

## 8. Summary of files touched

| File | Change | Reason |
|---|---|---|
| `site/js/sator.js` | **new** (~100–150L) | Pure SATOR math + breakdown builder. |
| `site/js/dialog.js` | **new** (~120L) | Overlay render, open/close, focus, keydown, idempotency. |
| `site/js/app.js` | edit (~10L) | Import `initSatorDialog`, call from `init`, add `data-action === "tohit"` branch in `#roster` click delegation. |
| `site/js/cards.js` | edit (~10L) | Add `.card-tohit` button in the card head with `data-action="tohit"` and a tooltip. |
| `site/index.html` | **no change** | Dialog is JS-injected, matching the tooltip precedent. |
| `site/styles.css` | edit (~60L) | `.sator-overlay`, `.sator-dialog`, `.sator-row`, `.sator-close` — see §9. |
| `tests/sator.test.js` | **new** | Pure function tests. |
| `tests/dialog.test.js` | **new** | JSDOM DOM tests. |
| `tests/app.test.js` | edit (+~30L) | 1–3 end-to-end tests via the existing `boot()`. |
| `tests/cards.test.js` | edit (+~5L) | One assertion that the new button exists with the right `data-action`. |

No changes to `state.js`, `storage.js`, `search.js`, or `tooltips.js`. No changes to `package.json`. No new dependencies. No new build step.

---

## 9. CSS sketch (for the implementer — math/UX consult owns the values)

```css
.sator-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.sator-overlay[hidden] { display: none; }
.sator-dialog {
  background: var(--panel);
  border: 1px solid var(--border);
  border-top: 3px solid var(--accent);
  border-radius: 6px;
  padding: 18px;
  min-width: 320px; max-width: 480px;
  color: var(--text);
}
.sator-row { display: flex; justify-content: space-between; padding: 4px 0; }
.sator-row label { color: var(--muted); }
.sator-close { /* matches .btn in styles.css:96-104 */ }
.sator-tn { font-family: var(--font-head); color: var(--accent-strong); font-size: 24px; }
```

Tokens (`--panel`, `--border`, `--accent`, `--accent-strong`, `--muted`, `--text`) already exist at `styles.css:1-16`. The dialog should feel like a panel sliding out of the existing chrome, not a new visual language.

---

## 10. Open questions for the math/UX consult

These are deliberately not answered here — they need someone who knows the Alpha Strike rules:

1. **SATOR formula source of truth.** Is the official table the one from ASCE p. 89 (or whichever page), or a community-maintained table? The exact `sizeModifier(s, t)` lookup is the highest-risk piece — getting it wrong means the calculator lies to users during a real game.
2. **Modifier coverage.** Beyond Skill + Size + Range + Movement + TMM, are Indirect Fire, Heat, ECM, etc. in scope for v1, or is this a "core four" calculator? Defer non-core modifiers behind a "Show advanced" toggle.
3. **Target picker UX.** Roster-only, or also allow custom (un-rostered) targets? Custom target fields need to live somewhere.
4. **Live recompute vs. "Calculate" button.** The architecture supports either — `input` listener recomputes on every change, or `click` on a button recomputes once. UX consult decides.
5. **Unit type / damage-mode interactions.** Aerospace TMM, Infantry platoon sizes, etc. — do they all flow through the same `attackerToHit` function, or do they need separate code paths? The pure-function signature in §2 is one shape; if rules need to branch on `unit.type`, that's a parameter.

Once those five are answered, an implementation plan can be drafted in 15 minutes by lifting the structure from this document and the file-table in §8.

---

## 11. What this report does NOT cover

- Exact SATOR formula values (math consult).
- Damage-value display / color coding / "did I hit?" roll (separate calculator, separate design).
- Mobile / touch interaction specifics beyond what the existing tooltip already does.
- Telemetry / usage stats.
- i18n (the repo is English-only — see `index.html`).

The architectural seam between "rules" and "dialog" is drawn so that a future damage-calculator feature can land in the same `sator.js` or a sibling `damage.js` without re-touching the dialog or the card button.
