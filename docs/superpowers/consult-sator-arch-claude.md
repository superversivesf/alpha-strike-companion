# SATOR To-Hit — Step-Based Flow: Architecture & Feasibility

**Author:** Claude (consult, 2026-08-13)
**Focus:** Architecture, code structure, state model, a11y, test strategy. UX copy/math are out of scope.
**Audience:** Implementer about to rewrite the SATOR dialog from a single-page modal into a wizard.

---

## 0. TL;DR

- **Rewrite `dialog.js`. Do not bolt steps onto it.** A wizard wants a different lifecycle (step index, conditional reveals, single visible step), and the current 480-line `buildDialog` mixes construction, state, recompute, focus, and a11y in one closure.
- **Add a new module `site/js/sator-wizard.js`** that owns the wizard API (`ensure`, `open`, `close`, plus `next`/`back`/`goto` for tests). Keep `dialog.js` as a thin compatibility shim that re-exports those functions, so `app.js` doesn't change and the existing test surface keeps its imports.
- **Keep `site/js/sator.js` untouched.** Every pure function it exports (`hitProbability`, `attackerMoveMod`, `targetMoveMod`, `targetUsesTmm`, `effectiveTargetTmm`, etc.) is reused as-is. The wizard's recompute calls them through a single thin aggregator.
- **Add `tests/sator-wizard.test.js`.** Keep the existing `tests/dialog.test.js` passing by having it test through the shim, but plan to migrate its assertions to the new module so the old test can shrink to a small smoke test.
- **One-page summary of the current code's worst smells** that the rewrite should fix: (1) recompute is a closure that queries the DOM by `name=`; (2) `__open`, `__escHandler`, `__returnFocus` are stashed on the overlay as ad-hoc instance state; (3) Esc handler is added on `open` but only removed on `close` — if `open` is called twice without close, you stack handlers; (4) `closeNow` is unreachable from the exported `closeSatorDialog`, which has its own duplicate close body; (5) the `O` ("Other") section in the spec doesn't exist in code yet; (6) focus on open targets the first focusable in the dialog, not the first field relevant to user input.

---

## 1. Current state — what we're replacing

### 1.1 Surface area

- **DOM module:** `site/js/dialog.js` (single `buildDialog(doc)` closure, ~200 lines). Exports: `ensureSatorDialog`, `openSatorDialog`, `closeSatorDialog`.
- **Styles:** `site/styles.css:661-820` — `.sator-overlay`, `.sator-dialog`, `.sator-head`, `.sator-body`, `.sator-section-row`, `.sator-letter`, `.sator-content`, `.sator-radio-group`, `.sator-tmm-group`, `.sator-select`, `.sator-number`, `.sator-jets`, `.sator-stepper`, `.sator-stepper-btn`, `.sator-skill-value`.
- **Pure math:** `site/js/sator.js` (untouched by this rewrite).
- **Tests:** `tests/dialog.test.js` (16 tests, 200 lines), `tests/sator.test.js` (untouched).
- **Caller:** `site/js/app.js:10` imports `ensureSatorDialog, openSatorDialog`. `app.js:343` calls `openSatorDialog({ doc, attacker, attackerEntry })`. `site/js/cards.js:274-285` builds the trigger button with `data-action="tohit"`.
- **Tooltip system:** `site/js/tooltips.js` (`initTooltips(doc)` scans `[data-tip]` and attaches hover/touch listeners). `addTip(el, text)` is the writer from `cards.js:136`. The wizard must keep using `data-tip` on letter boxes (and any new step indicators) so the existing scanner picks them up.

### 1.2 What the current dialog actually does (verified by reading)

- Five letter rows (S/A/T/O/R) stacked in a single scrollable panel (`dialog.js:51-122`).
- **S:** static `sator-skill-value` text (read-only).
- **A:** radio pills for `standstill | ground | jump` (`dialog.js:65-78`).
- **T:** native `<select id="sator-target-mode">` for movement mode, radio pills for TMM 0–5, and a jets stepper (−3..+2) shown only when mode is `jump` or `submersible` (`dialog.js:79-117`).
- **O:** no controls yet (spec-only).
- **R:** TN, breakdown string, probability, note.
- Recompute (`dialog.js:140-167`) is a single closure that reads from the DOM, calls `attackerMoveMod` / `targetMoveMod` / `hitProbability`, and writes back to the TN/breakdown/prob nodes.
- Close paths: `Escape` (added on `doc` in `open`, removed in `closeNow` only — see smell #3 below), backdrop click, `✕` button. All three funnel into `closeNow` which sets `hidden = true`, removes the Esc listener, and restores `__returnFocus`.

### 1.3 Smells the rewrite should fix

| # | Smell | Where | Risk | Fix in new module |
|---|-------|-------|------|-------------------|
| 1 | Recompute queries the DOM by `name=`/`id=` and re-parses every change | `dialog.js:140-167` | Brittle to renames; not testable without a DOM | Hold state in a plain object; recompute reads the state object only |
| 2 | `__open`, `__escHandler`, `__returnFocus`, `__asSatorDialog` stashed on DOM nodes | `dialog.js:174, 196, 199, 221` | Invisible to tests, garbage-collected with the node, easy to leak | Module-private closure state per `ensure(doc)` |
| 3 | `escHandler` is added on `open` but only removed in `closeNow`; the exported `closeSatorDialog` has a parallel body that does not call `closeNow` | `dialog.js:181-186, 197-201, 223-228` | Double open → two Esc listeners; closing via the exported function skips focus restore in one path | Single `close()` internal function; both public `closeSatorDialog` and `Esc` handler call it |
| 4 | O ("Other") is spec'd but unimplemented | tests reference it not at all, current code skips the section | Spec drift | Build the wizard with O as a real step (even if v1 leaves it as an empty "future" step) |
| 5 | Focus on open picks the first focusable in DOM order, which on first paint is a TMM radio if user scrolled or a stepper button — not a predictable field | `dialog.js:189-191` | Screen-reader users land unpredictably | Per-step focus target: first input in the active step |
| 6 | Initial focus query uses `querySelector("input, select, button:not(.sator-close)")` and silently no-ops if no match | `dialog.js:189-191` | If the visible step has no inputs, focus stays on body | Wizard has a designated `focusable` per step |
| 7 | The jets `min`/`max` attributes are declared but not enforced — clamping lives in the stepper `step()` only, so a user who edits the number directly can write `5` and the recompute still runs | `dialog.js:95-101, 199-208` | Out-of-range inputs silently used in math | Either enforce `change`/`blur` clamp, or document that the value is clamped only via stepper |
| 8 | `__returnFocus?.focus?.()` — fine, but the only thing that sets it is `openSatorDialog`, and `closeSatorDialog` (the exported one) restores it; the *internal* `closeNow` also restores it. Two paths, one truth, easy to break. | `dialog.js:184, 199, 226` | See #3 | One `close()` function |
| 9 | `aria-modal="true"` is set on the overlay but focus is not trapped; Tab can walk into the page behind the dialog | `dialog.js:26` | Keyboard a11y | Wizard traps focus within active step + Back/Next |
| 10 | `aria-labelledby="sator-title"` is correct, but the S/A/T/O/R letter boxes have no `aria-label` and rely entirely on `data-tip` for explanation | `dialog.js:56-60` | Tooltips are not exposed to screen readers unless the tooltip system re-surfaces them | Add `aria-label` to each letter box, redundant with `data-tip` |

---

## 2. Module layout

```
site/js/
  sator.js               (untouched — pure math)
  sator-wizard.js        (NEW — wizard module, default export object {ensure, open, close, next, back, goto, getState, recompute})
  dialog.js              (REWRITTEN — re-exports from sator-wizard for back-compat; keeps ensureSatorDialog, openSatorDialog, closeSatorDialog names)

tests/
  sator.test.js          (untouched)
  dialog.test.js         (kept for one release; tests the shim; many assertions migrate to sator-wizard.test.js)
  sator-wizard.test.js   (NEW — wizard behavior)
```

### 2.1 `sator-wizard.js` shape

```js
// sator-wizard.js — pure JS, no globals; doc passed in for every call
import { hitProbability, attackerMoveMod, targetMoveMod, targetUsesTmm } from "./sator.js";

const STEPS = ["skill", "attacker", "target", "other", "roll"];  // S/A/T/O/R

export function ensureSatorWizard(doc) { /* idempotent, returns root element */ }
export function openSatorWizard({ doc, attacker, attackerEntry }) { /* focus, return-target */ }
export function closeSatorWizard(doc) { /* hide, restore focus, remove Esc */ }
export function nextSatorStep(doc) { /* advance */ }
export function backSatorStep(doc) { /* retreat */ }
export function gotoSatorStep(doc, step) { /* jump, used by tests + breadcrumb */ }
export function getSatorState(doc) { /* { step, attacker, entry, values, tn, breakdown, prob, cannotAttack, reason } */ }
```

`dialog.js` becomes a 6-line shim:

```js
export { ensureSatorWizard as ensureSatorDialog } from "./sator-wizard.js";
export const openSatorDialog = (args) => openSatorWizard(args);
export const closeSatorDialog = (doc) => closeSatorWizard(doc);
```

`app.js` does not need to change.

### 2.2 Why a new module instead of rewriting `dialog.js`

- The wizard's API is fundamentally different: `next`/`back`/`goto` make no sense for a single-page modal. Adding them to `dialog.js` is feature creep; rewriting it under the same name forces a synchronized edit across 16 tests that use the old `data-tip` strings, the old `aria-modal`, the old `hidden` toggle.
- A new module is a clean cut. `dialog.js` becomes a one-line shim and can be deleted in a later PR after the migration of `dialog.test.js` is complete.
- The shim approach lets us keep `tests/dialog.test.js` running unmodified for the *public* surface tests (idempotent, hidden, 5 letters, tooltips, open prefills, focus restore, Esc closes, backdrop closes, close button). The internal behavior tests (recompute, conditional reveals, stepper math) move to `sator-wizard.test.js`.

---

## 3. State model

### 3.1 Single state object, owned per overlay

```js
// private to the ensure() closure
const state = {
  step: 0,                            // 0..4; 0 = S, 4 = R
  stepCount: STEPS.length,            // 5
  attacker: null,                     // unit record
  attackerEntry: null,                // entry record
  values: {
    atkMove: "ground",                // standstill | ground | jump
    tgtMode: "ground",                // one of TARGET_MODES
    tmm: 0,                           // 0..5
    jets: 0,                          // -3..2
    // future O step: array of named modifiers
  },
  tn: null,                           // number | null when cannotAttack
  breakdown: [],                      // [{label, value}]
  prob: 0,                            // 0..1
  cannotAttack: false,
  reason: "",
  returnFocus: null,                  // Element to restore on close
};
```

### 3.2 Recompute (single function, no DOM reads)

```js
function recompute(state) {
  if (isDestroyed(state.attackerEntry, state.attacker)) {
    state.cannotAttack = true; state.reason = "Unit destroyed"; state.tn = null; return;
  }
  if (state.attackerEntry.heat === "S") {
    state.cannotAttack = true; state.reason = "Unit is shut down"; state.tn = null; return;
  }
  state.cannotAttack = false;
  const skill = state.attackerEntry.skill;
  const move = attackerMoveMod(state.values.atkMove);
  const tgtMode = state.values.tgtMode;
  const jets = state.values.jets;
  const tmm = targetUsesTmm(tgtMode) ? state.values.tmm : 0;
  const tgt = targetMoveMod(tgtMode, tmm, jets);
  const tn = Math.max(2, skill + move + tgt);
  state.tn = tn;
  state.breakdown = [];
  state.breakdown.push({ label: "Skill", value: skill });
  if (move !== 0) state.breakdown.push({ label: "Move", value: move });
  if (tgt !== 0) state.breakdown.push({ label: "Target", value: tgt });
  state.prob = tn > 12 ? 0.028 : hitProbability(tn);
}
```

### 3.3 Why no `getElementById` inside recompute

- Recompute becomes a pure function over `state`. It can be unit-tested in isolation by passing a fabricated `state`.
- The DOM only receives the *result* via a single `render(state)` step that writes to text nodes and toggles `hidden`. This collapses the current 8 `dialog.querySelector(...)` calls into one render call.
- The wizard's `O` step (future) only has to add fields to `state.values`; the recompute ignores anything outside its known fields, so the O step's UI can be a placeholder without breaking math.

### 3.4 Per-step value validation

Each step has a `validate(state) → string | null` returning an error message or `null` if the step can advance. For v1 only the `R` step needs it (the breakdown must be present, but it's always computed, so it always validates). Future `O` step with required picks would use this.

---

## 4. Event flow

### 4.1 Lifecycle

```
ensure(doc)        →  construct overlay + 5 steps (only one visible), wire listeners, return overlay
open({...})        →  capture returnFocus, reset state, set attacker/entry, recompute, render, show overlay, focus first input of step 0, add Esc + focus-trap listeners
user input on step →  update state.values, recompute, render, re-announce TN
next()             →  if step < last: step++, render(step), focus first input of new step
back()             →  if step > 0: step--, render(step), focus first input of new step
goto(step)         →  if 0 ≤ step < stepCount: step = step, render(step)
close()            →  if hidden already: return; hide overlay, remove Esc + focus-trap, restore returnFocus.focus()
```

### 4.2 Wiring (event delegation on dialog)

```js
dialog.addEventListener("change", e => onFieldChange(e));
dialog.addEventListener("input",  e => onFieldChange(e));
dialog.addEventListener("click",  e => onClick(e));
```

`onFieldChange` dispatches by `e.target.dataset.field`:

- `data-field="atkMove"` → `state.values.atkMove = e.target.value`
- `data-field="tgtMode"` → `state.values.tgtMode = e.target.value`
- `data-field="tmm"` → `state.values.tmm = Number(e.target.value)`
- `data-field="jets"` → clamp to [-3, 2] on blur; on `input` accept raw, on `change` (Enter/blur) clamp
- `data-field="jets-delta"` → add ±1, clamp, write back

`onClick` dispatches by `e.target.dataset.action`:

- `data-action="next"` → `nextSatorStep(doc)`
- `data-action="back"` → `backSatorStep(doc)`
- `data-action="close"` → `closeSatorWizard(doc)`
- `data-action="step-jump"` (used by progress bar) → `gotoSatorStep(doc, Number(e.target.dataset.step))`

### 4.3 Conditional reveals (T-step sub-UI)

- `state.values.tgtMode ∈ {jump, submersible}` → show jets row.
- `targetUsesTmm(tgtMode)` → show TMM group.
- Otherwise → hide both.

These are pure functions of `state.values`, computed in `render(state)`. Same pattern as the current code but driven by state, not by querying for the select and the radio group.

### 4.4 The jets stepper (no new state)

The stepper stays exactly as it is. `data-field="jets-delta" data-delta="1"` on `+`, `data-delta="-1"` on `−`. The current `dec`/`inc` button wiring at `dialog.js:204-215` becomes a `data-action` delegation.

---

## 5. Accessibility

### 5.1 Step progress

- `<div class="sator-progress" role="navigation" aria-label="SATOR steps">` containing 5 buttons, one per step.
- Each button: `aria-current="step"` when active, `aria-label="Step {n}: {name}"` always, `data-step` for the click handler.
- Live region: `<div class="sator-live" aria-live="polite" aria-atomic="true">` placed near the TN. Updated on every `render` with "Step 3 of 5: Target. Target number 6." Screen readers announce on each step change but not on every keystroke inside a step (the live region's `aria-live="polite"` + the fact that we update it only on `render` after a meaningful change — recompute happens on every `input` but the live region only updates on `step` transitions or on commit (`change` for `tgtMode`/`tmm`/`atkMove`, `blur` for `jets`).

### 5.2 Focus management

- **On open:** focus the first focusable element of the active step (step 0 = skill read-only; skip to step 1's first radio, or to a "Begin" button if we want to gate).
- **On `next`/`back`/`goto`:** focus the first focusable of the new active step.
- **Focus trap:** on Tab/Shift+Tab at the boundaries of the dialog, cycle within the dialog. Implemented as a `keydown` handler on `doc` while the overlay is open. The current dialog does *not* trap (smell #9); this is a real bug fix.
- **Restore on close:** `returnFocus.focus()` (preserved from current).

### 5.3 Esc and backdrop

- Single `doc.addEventListener("keydown", onKey)` added on `open`, removed on `close`. Inside `onKey`:
  - `e.key === "Escape"` → call `close()`.
  - `e.key === "Tab"` → trap if focus would leave the overlay.
- Backdrop click: `overlay.addEventListener("click", e => { if (e.target === overlay) close(); })`. Same as current.

### 5.4 Letter boxes

- Keep `class="sator-letter tip"` + `data-tip="…"` so the existing tooltip system continues to work.
- Add `aria-label="Skill"` etc., redundant with `data-tip` so screen readers that don't run the tooltip JS still get the meaning. (The current implementation only has `data-tip` — smell #10.)

---

## 6. Test strategy

### 6.1 Keep `tests/sator.test.js` untouched

It tests the pure functions in `sator.js`. The wizard delegates to them. No change needed.

### 6.2 `tests/dialog.test.js` — keep, but expect a small subset to move

Tests in this file fall into three groups:

| Group | Tests | Keep here? |
|-------|-------|------------|
| Public surface (idempotent, hidden, 5 letters, tooltips) | "ensureSatorDialog is idempotent and hidden", "dialog shows five SATOR letter boxes in order", "letter boxes carry descriptive tooltips" | Yes — these are still the dialog's contract |
| Open/close lifecycle | "openSatorDialog unhides and prefills attacker skill", "openSatorDialog stores return focus", "closeSatorDialog hides and returns focus", "Escape key closes the dialog", "close button closes the dialog", "backdrop click closes the dialog" | Yes |
| Internal recompute (TN, breakdown, prob, TMM reveal, jets, jets clamp) | "TN equals skill and probability shows", "attacker movement changes TN live", "min TN clamps at 2 for skill 0", "destroyed attacker shows cannot-attack", "jet stepper buttons adjust the jets value", "jet stepper clamps to data range -3..2" | Migrate to `sator-wizard.test.js` |

After migration, `tests/dialog.test.js` shrinks to the public-surface + open/close tests (~9 tests) and serves as a smoke test that the shim works. `tests/sator-wizard.test.js` becomes the place for behavior tests.

### 6.3 `tests/sator-wizard.test.js` (new) — what's in it

- **Step transitions:** open at step 0, click Next, verify step 1 visible and step 0 hidden; back to 0; click progress button to jump.
- **Per-step value updates:** type into a field, verify `getSatorState(doc).values` reflects the change.
- **Recompute on input:** change a value, verify `getSatorState(doc).tn` updates.
- **Focus management:** after open, `document.activeElement` is the expected first input of step 0; after Next, it's the first input of step 1.
- **Focus trap:** Tab from the last focusable of step 4 wraps to the first focusable of step 0; Shift+Tab wraps backward.
- **Esc closes:** `Escape` keypress → `hidden === true`, `returnFocus` restored.
- **Backdrop closes:** click on overlay (not on dialog) → `hidden === true`.
- **Idempotent ensure:** `ensureSatorWizard(doc) === ensureSatorWizard(doc)`.
- **Conditional reveals:** set `tgtMode = "jump"` → jets visible, TMM visible; set `tgtMode = "immobile"` → both hidden.
- **Live region:** after Next from step 0 to step 1, the live region text contains "Step 2 of 5".
- **Jets stepper:** click `+` increments; click `−` decrements; clamp at +2 and −3.

### 6.4 JSDOM gotchas to plan for

- JSDOM does not run CSS, so `:has(input:checked)` is not visible. Tests should read `aria-current` / class names, not computed styles.
- `pretendToBeVisual: true` is already in the test setup (`dialog.test.js:18`) — keep it.
- `dispatchEvent(new KeyboardEvent(...))` on `document` works for Esc, but Tab events with `key === "Tab"` need `bubbles: true, cancelable: true` for the trap handler to see them.
- For focus tests, JSDOM follows the same focus rules as real browsers *most* of the time. `el.focus()` on a radio/button works; check `document.activeElement === el`.

### 6.5 Coverage targets for the rewrite

- All currently-tested public behaviors must continue to pass.
- New wizard behaviors (next/back/jump, focus trap, live region) get their own tests.
- Recompute is now a pure function over `state`; the existing recompute tests can be rewritten to call `recompute(state)` directly without a DOM, but since `recompute` will be a private function (not exported), the wizard test asserts via `getSatorState(doc).tn` instead.

---

## 7. Risks and dead-ends in the current implementation

1. **Esc handler stacking** (`dialog.js:181-186`). Two `open()` calls in a row add two listeners. The rewrite's `open()` must call `close()` first if the overlay is already open, or guard the `addEventListener` with an "isOpen" flag.
2. **Duplicate close paths** (`dialog.js:197-201` vs `223-228`). One internal `closeNow`, one exported `closeSatorDialog`, both restoring focus. If the export's body ever drifts, one path will leak a listener. Single `close()` is the fix.
3. **`open()`'s focus picker** (`dialog.js:189-191`) is the wrong target on most steps. The first focusable in the dialog is the first TMM radio (in the T row), not the first field the user can usefully act on in the active step.
4. **No focus trap** (smell #9). Tab out the bottom of the dialog and you land in the page behind. ARIA `dialog` with `aria-modal="true"` implies trap; the current implementation breaks that contract.
5. **O step is spec-only.** The current dialog has 5 letter rows but only 4 are populated (O is empty). A user reading the dialog sees an empty box labeled "O" with a tooltip about "Other — additional situational modifiers". Either implement O or remove the row. The rewrite should ship a placeholder step ("No other modifiers in v1 — coming soon") that matches the wizard's step model.
6. **Number input is unconstrained on direct edit** (smell #7). The `min`/`max` attributes are present but no `change`/`blur` handler enforces them. A user who types `9` and tabs out will get a recompute that uses 9, then a clamp only on the next stepper click. Either enforce on `change` or document the behavior.
7. **Stateless dialog and DOM-cached state** (smells #1, #2). Every recompute re-reads the DOM. Moving to a state object is a prerequisite for the wizard's per-step rendering.
8. **`hitProbability(>12)` is capped at 0.028** (sator.js:71, dialog.js:165 sets `.impossible` class). The wizard's R step should also show "Impossible (TN > 12)" as a note when `tn > 12`, in addition to the `impossible` class. Currently the note is overwritten by the generic "Natural 12 = auto-hit …" line.
9. **No "Back to picker" focus restore on Esc close.** The `__returnFocus` is captured at `open` time, so on a *subsequent* dialog re-open (e.g., user opens SATOR, closes, opens another card's SATOR), the focus restores to the *previous* SATOR trigger button instead of the new one. The new card's trigger needs to be the active element *before* `open` is called. The current code only checks `doc.activeElement` at the moment of open, which works for the first open but breaks the second. Verify: in `app.js:338-344`, `e.target` (the button just clicked) is the active element at the moment of the click, so the *first* open works. For the second, the previous trigger (which had focus) becomes the return target. Real fix: in `open()`, always set `returnFocus = doc.activeElement` *and* accept an explicit `returnFocus` argument so `app.js` can pass the button it just clicked.
10. **No `disabled` propagation.** If the attacker becomes destroyed while the dialog is open (e.g., the user is editing crits on a different card in a future feature), the dialog does not re-evaluate `cannotAttack`. The wizard recompute runs only on user input, not on external state changes. For v1 the dialog is modal so this is moot; flag for future.

---

## 8. Migration order (recommended)

1. **Write `sator-wizard.js`** as a clean rewrite with state-driven recompute, step rendering, focus trap, live region, conditional reveals.
2. **Write `tests/sator-wizard.test.js`** with the new behavior tests. Make it pass against `sator-wizard.js` directly.
3. **Convert `dialog.js` to a shim** that re-exports from `sator-wizard.js`. `app.js` is unchanged.
4. **Run the full test suite** (`npm test`). All `tests/sator.test.js` and `tests/dialog.test.js` tests should pass. The dialog tests now test the shim.
5. **Migrate behavior tests** from `tests/dialog.test.js` to `tests/sator-wizard.test.js` and delete them from the old file. After this, `tests/dialog.test.js` is a small smoke test.
6. **Update `site/styles.css`** with the wizard's new selectors (`.sator-progress`, `.sator-live`, `.sator-step-content` if needed). Keep the existing `.sator-overlay`/`.sator-dialog`/`.sator-section-row` rules; reuse or rename as appropriate. The letter-box styles (`.sator-letter`) carry over directly.
7. **Manual smoke test** on a real device (touch + keyboard) — verify the Next/Back buttons, focus trap, Esc, backdrop, and per-step focus are all correct. JSDOM can't catch focus-rendering bugs.
8. **Delete `dialog.js`** in a follow-up PR after one release cycle of the shim.

---

## 9. Constraints honored

- **Plain `<div>` overlay, no native `<dialog>`.** The wizard continues to use `role="dialog" aria-modal="true"` on a fixed-position div. The focus trap is hand-rolled in JS, not via `<dialog>.showModal()`.
- **JSDOM tests.** The wizard is written so its behavior can be asserted through `getSatorState(doc)` (returns a plain object) plus DOM event dispatch. No `Element.prototype.scrollIntoView`, no `IntersectionObserver`, no CSS `:has()` reliance.
- **Stateless dialog.** The dialog module still caches the overlay on `doc.__asSatorDialog` (or the new `doc.__asSatorWizard`), but no per-attacker state leaks between opens — `open()` resets `state.values` to defaults and re-applies attacker/entry.
- **Existing tooltip system.** All descriptive text (letter boxes, future step indicators) uses `data-tip` so `initTooltips(doc)` picks them up. No second tooltip system.
- **Pure `sator.js` unchanged.** Every recompute goes through `attackerMoveMod`, `targetMoveMod`, `targetUsesTmm`, `hitProbability` (and `effectiveTargetTmm` for the O step when it's implemented). The math tests in `tests/sator.test.js` are the contract.
- **One caller, one open path.** `app.js:343` is the only call site. The new shim is a drop-in.
- **No new build steps.** Plain ES modules like the rest of the codebase; no transpilation, no bundler.

---

## 10. Open questions for the implementation consult

(These are *not* code-shape questions — they belong to UX/math consults. Listed here only so the implementer doesn't stall on them.)

- **O step: implement now or stub?** The spec defines it; the current code doesn't. The wizard can ship with an empty step and a "coming soon" note, or with a small set of situational modifier checkboxes (indirect fire, darkness, etc.) — that's a UX call.
- **Jets direct-edit clamp behavior.** Should the number field clamp on `change` (blur/Enter) or `input` (every keystroke)? `input` makes the stepper buttons feel less responsive; `change` lets the user type "12" briefly. Current code does neither — flag.
- **R step layout.** Show the full breakdown, the probability, and a "Roll 2d6" button (purely cosmetic, no state change), or keep it read-only as today?
- **Step indicator on the side vs. top.** Letter rail on the left is a strong SATOR mnemonic. The wizard can keep a vertical letter rail (S/A/T/O/R stacked) with the active letter highlighted, *and* a horizontal progress bar at the top. Both or one?
- **Persist last-used attacker settings?** Each `open()` resets to defaults; an alternative is to persist `state.values` to localStorage. Out of scope for v1; flag.
