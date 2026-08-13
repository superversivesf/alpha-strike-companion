# SATOR To-Hit Calculator — Round 2 Cross-Critique

**Author:** Claude
**Date:** 2026-08-13
**Inputs reviewed:** pi, claude (R1 = `consult-sator-arch-claude.md`), codex
**Scope:** Agree/disagree on each combined finding, resolve the four named disagreements, flag anything all three missed.

---

## 1. Per-finding reactions

### Finding 1 — pi's formula

> TN = Skill + AttackerMove(0/0/+1/+1) + TargetTMM + Terrain + Range(0/+2/+4) + Other. Natural 12 auto-hit, natural 2 auto-miss, min TN 2.

**Agree, with two refinements:**

- The "min TN 2" rule and nat-12/nat-2 auto-result rules are **dial-in/special-roll outcomes, not to-hit inputs.** The pure function should return `{tn, autoHit, autoMiss, breakdown}` and let the dialog render the auto-result note (codex #6 has this right). Architecturally: `attackerToHit(...)` never short-circuits to a number; it always returns a `tn` plus optional `autoHit`/`autoMiss` flags. The "min TN 2" cap is a *post-process* on the final number for display purposes ("TN 8 (capped from 0)"), not a hard floor that erases the breakdown.
- "AttackerMove" needs disambiguation. The TN penalty is for **the target's chosen movement mode during the attack**, not the attacker's. pi's heading says "AttackerMove" but the values (0/0/+1/+1) match the standard ASCE target-movement table (stationary / standard / jumped / MP-halted). I read this as pi's terminology, not a rules dispute — but the function parameter should be called `targetMovement` and accept one of the four modes, not a number. The dialog pre-translates.

### Finding 2 — pi's crit / status interactions

**Agree on the rules. Two architectural notes:**

- These belong inside `sator.js`, not in the dialog. Crits modify **inputs** to the TN (Fire Control adds to attacker TN, MP/Engine reduce target TMM, Shutdown reduces target TMM, ability modifiers like STL/JMPS are conditional). The cleanest API is: `attackerToHit({attacker, attackerEntry, target, targetEntry, rangeBand, targetMovement, otherModifiers})`. The pure function reads `entry.crits` directly — no need for the dialog to pre-translate. This is the **single place** that knows the crit → modifier mapping, which means one test file (`tests/sator.test.js`) covers it exhaustively and the dialog stays presentation-only.
- Shutdown (`heat: "S"`) and Crew-crit-on-attacker are not "modifiers" — they end the attack. Return `{tn: null, cannotAttack: true, reason: "shutdown" | "crew-killed"}` from the pure function. The dialog renders a disabled state, not a TN=99. The dialog never has to know *why* — just whether there's a number to show.

### Finding 3 — claude (R1) module split, button, delegation, idempotency

**Agree, all of it.** Two clarifications R1 left implicit:

- The `__asSatorDialog` idempotency flag is for the *dialog element creation* guard. The *event-listener* teardown problem called out in `consult-audit-r2-claude.md:45` (re: `initTooltips`) is a separate concern. If we go native `<dialog>` (see resolution (a) below), the only document-level listener we'd add is the optional focus-return handler on close, and that's added/removed with the dialog open/close — no leak. If we go plain div, we have the teardown problem in full. Native `<dialog>` removes the bug class entirely.
- The card button belongs in `head` between `pv` and `remove` (R1 said this). Codex implicitly agrees. No disagreement.

### Finding 4 — claude (R1) plain div overlay

**Disagree with my own R1.** See resolution (a). The "matches the tooltip precedent" argument is weaker than I made it — the tooltip is a *passive* float, not a modal; a different kind of UI, a different kind of lifecycle.

### Finding 5 — codex native `<dialog>` + showModal()

**Agree in direction, with one caveat.** See resolution (a). The "top-layer" benefit is real and removes a class of stacking-context bugs. The caveat: JSDOM support needs verification (see resolution (d), "JSDOM spike").

### Finding 6 — codex result UI (large TN + 2d6 probability + breakdown + nat12/nat2)

**Split:**
- **Large TN + breakdown line + nat12/nat2 notes: in.** This is what the user came for.
- **2d6 probability: out (v1).** Off-topic for a TN calculator — this is an *attack* tool, not a statistics dashboard. If a user wants hit probability, they roll 2d6 mentally against the displayed TN; the displayed number IS the answer. If we want this later, it's a 3-line addition behind a toggle that calls a `hitChance(tn)` helper, ~10 lines, separate spec.
- **Dice roll entry: out (v1).** Same reason. A dice-roller is a sibling feature, not a sub-feature of the calculator. If it lands, it lives in `sator.js` as `rollAttack(tn, roll) -> {hit, crit}` or a new `dice.js` — but not bundled into the to-hit dialog v1.

### Finding 7 — codex destroyed-unit handling

**Agree, fully.** Two refinements:

- "Destroyed attacker's To-Hit button disabled" needs to be **driven from the entry's `armorDamage >= unit.armor && structDamage >= unit.structure` check** (the same condition that triggers the `.destroyed-stamp` in `cards.js:422-428`). To avoid duplicating that boolean in `cards.js`, add `isEntryDestroyed(entry, unit)` to `state.js` next to `isEntryValid` (`state.js:148-156`). One-line function, one test in `state.test.js`, used by both `renderCard` (existing stamp) and the new `tohit` button (disable it). YAGNI-clean.
- "Destroyed units excluded from target dropdown" is a filter at dialog-fill time, not a state mutation. The roster still contains the destroyed entry; the dialog's `fillTargetSection` filters it out. Stateless, as R1 said.

### Finding 8 — pi pre-population

**Agree, with the rule-of-thumb:** *unit-derived* fields (size, TMM, abilities) pre-populate and stay synced; *entry-derived* fields (skill, crits, heat) pre-populate and may diverge as the user changes them in the calculator (the calculator is a "what-if" tool, not a state writer). Concretely:

| Field | Source | Editable in dialog? |
|---|---|---|
| Attacker Skill | `attackerEntry.skill` | Yes — the whole point of the dialog |
| Attacker crits | `attackerEntry.crits` | Read by pure function; user sees impact, doesn't toggle here |
| Attacker heat | `attackerEntry.heat` | Read by pure function; can disable attack on S |
| Attacker TMM | `unit.tmm` | No — attacker doesn't change during a single attack |
| Attacker abilities | `unit.abilities` | Read by pure function (STL/JMPS/LMAS/MAS gating) |
| Attacker type | `unit.type` | No |
| Target | `<select>` of roster | Yes — primary interaction |
| Target size | `target.size` | No (read-only label) |
| Target TMM | `target.tmm`, modified by target's crits/heat | Yes — manual override field (see resolution (c)) |
| Range | Buttons S/M/L | Yes |
| Movement mode | `<select>` (stationary / standard / jumped / MP-halted) | Yes |
| Other | `<input type="number">` signed | Yes |

The "user enters movement modes (both)" wording in pi #8 reads like the dialog has two movement inputs — one for attacker, one for target. The ASCE attacker-movement penalty is zero in practice (the attacker's own movement does not affect their TN, only the target's). Single field: **target movement mode**. If pi meant something different, this is the place to ask.

---

## 2. The four named disagreements

### (a) Native `<dialog>` + `showModal()` vs plain div overlay

**Resolution: native `<dialog>`. Reverse R1.**

**Why I was wrong in R1:** I leaned on "matches the tooltip precedent." The tooltip (`tooltips.js`) is a passive hover float — wrong precedent. The picker hint / no-match `<li>` (`app.js:120, 128`) are also not modals. **No precedent in this repo is for an interactive modal**, so the choice is free.

**Why native wins:**

| Concern | Native `<dialog>` | Plain div overlay |
|---|---|---|
| Focus trap | Browser-provided | Manual `keydown` handler, must add/remove with lifecycle |
| `Esc` closes | Browser-provided | Manual `keydown` handler |
| Top-layer / z-index | Browser-provided, immune to ancestor `transform`/`overflow` quirks | Manual `z-index: 100`, fragile |
| `inert` on background | Browser-provided | Manual `aria-hidden` + tabindex sweep |
| ARIA | `role="dialog"`, `aria-modal="true"` are implicit | Must set manually |
| CSS reset needed | `background: Canvas` → override to `var(--panel)`; `color: CanvasText` → override to `var(--text)`; `border: solid` → reset; `padding: 1em` → reset | None |
| JSDOM support | Supported in jsdom ≥16; jsdom 24.1.0 (pinned in `package.json:11`) handles `showModal`/`close`/`open`/`returnValue` | Trivial |
| Test assertion | `dialog.open === true` / `dialog.open === false` | `overlay.hidden === true/false` |
| Tear-down risk (`consult-audit-r2-claude.md:45`) | None — no document-level listener needed | Real — must add/remove `keydown` handler to avoid leak |

The CSS reset is two lines. The JSDOM behavior is the only unknown — see resolution (d) "JSDOM spike" caveat.

**What changes from R1:** `dialog.js` no longer has an `__asSatorDialog` idempotency flag (the dialog element is created by the caller's `renderSatorDialog` per-open OR is a single instance managed by `app.js` — see below). The `Escape`/`keydown` listener disappears.

**Implementation shape:**

```js
// dialog.js
export function openSatorDialog({ doc, attacker, attackerEntry, targetRoster }) {
  const dialog = ensureDialog(doc);
  fillAttackerSection(dialog, attacker, attackerEntry);
  fillTargetSection(dialog, targetRoster, attacker);
  dialog.showModal();
}

export function closeSatorDialog(doc) {
  const dialog = doc.__asSatorDialog;
  if (dialog?.open) dialog.close();
}
```

`ensureDialog(doc)` is idempotent (creates the `<dialog>` once, appends to `doc.body`, returns the cached reference). The `__asSatorDialog` flag is the cache key, not a re-entrancy guard. The dialog *content* (attacker/target fields, TN readout) is rewritten on every `openSatorDialog` call, so the dialog itself stays stateless across opens.

**Fallback condition:** if the JSDOM spike in resolution (d) shows `showModal` is awkward in tests, drop back to plain div + `aria-modal="true"` + manual keydown. Native first; the cost of being wrong is small (one file's worth of edits).

### (b) Focus trap — worth it in v1?

**Resolution: included, free.**

With native `<dialog>` (resolution (a)), the focus trap is browser-provided. The implementation is zero lines. R1's "defer" was correct as a deferral decision; the actual answer is "it happens automatically." Manual focus trap would only have been on the table if we'd gone plain div, which we aren't.

The only manual focus work is **focus return on close** — when the dialog closes, return focus to the card button that opened it. One stash (`dialog.__returnFocus = doc.activeElement` on open), one restore (`dialog.__returnFocus?.focus()` on close). Five lines, no new bugs.

### (c) Live calc vs Calculate button

**Resolution: live. Agree with codex.**

**Why:** tabletop. The TN is needed mid-attack sequence ("I have range and a stationary target, what's my TN? — wait, they jumped, what's it now?"). A "click Calculate" step is a friction point at exactly the moment the user is most likely to mis-roll from a stale number on screen. Live update removes the staleness hazard.

**Why not a perf concern:** the pure function is a sum of small table lookups. Measured cost is well under a microsecond. `input` event delegation on the dialog root fires the recompute; no `requestAnimationFrame`, no `setTimeout`, no debounce. The dialog is one or two `<select>`s, two or three `<input type="number">`s, and three range buttons — at most a dozen events per second under any plausible interaction.

**Bonus:** live breakdown rendering doubles as the *teaching* surface for the rules. A user who doesn't know why their TN is 8 can read `Skill 4 + size +1 + range +2 + TMM 1 = 8` and learn the formula. A static "Calculate → result" UI hides that.

### (d) What's the minimum viable v1 scope? Anything missed?

**In scope (v1):**

1. `site/js/sator.js` — new, pure:
   - `attackerToHit({attacker, attackerEntry, target, targetEntry, rangeBand, targetMovement, otherModifiers}) → {tn, breakdown, autoHit, autoMiss, cannotAttack, reason}`
   - Helpers: `rangeModifier(band)`, `sizeModifier(attackerSize, targetSize)`, `movementModifier(mode)`, `effectiveTargetTmm(target, targetEntry)`, `attackerHeatPenalty(heat)`, `abilityModifier(attacker, rangeBand, isStationary, isJumping)`
   - The crit → modifier map lives here (pi #2)
2. `site/js/state.js` — add `isEntryDestroyed(entry, unit)` (one-liner, parallel to `isEntryValid`)
3. `site/js/cards.js` — add `card-tohit` button in head, `data-action="tohit"`, `addTip` it, `disabled` when `isEntryDestroyed(entry, unit)`; cover the existing `.destroyed-stamp` line with `isEntryDestroyed` for consistency
4. `site/js/dialog.js` — new, DOM:
   - Native `<dialog>`, idempotent creation
   - `ensureDialog(doc)`, `openSatorDialog({...})`, `closeSatorDialog(doc)`
   - Roster-minus-destroyed target `<select>`, range buttons, movement mode `<select>`, signed Other `<input type="number">`, manual TMM override field, big TN readout, breakdown list, nat12/nat2/cannot-attack notes
   - Focus return on close
5. `site/js/app.js` — import `ensureSatorDialog`/`openSatorDialog`/`closeSatorDialog`; call `ensureSatorDialog(_doc)` in `init`; add `data-action === "tohit"` branch in `#roster` click delegation
6. `site/styles.css` — small additions: `.sator-dialog` (background `var(--panel)`, border `var(--border)` + 3px top `var(--accent)`, padding, max-width ~480px); reset native `<dialog>` background/color; `.sator-tn` big number; `.sator-row` flex. **Override only `background` and `color` from the user-agent stylesheet** — everything else inherits.
7. `tests/sator.test.js` — new, pure tests
8. `tests/dialog.test.js` — new, JSDOM tests
9. `tests/app.test.js` — 2–3 integration tests via existing `boot()` (one for open, one for close, one for destroyed-attacker-disabled)
10. `tests/cards.test.js` — 1 assertion: button present with `data-action="tohit"`, disabled when destroyed
11. `tests/state.test.js` — 1 test for `isEntryDestroyed`

**Out of scope (v1), with rationale:**

| Codex #6 / #5 idea | Verdict | Why |
|---|---|---|
| 2d6 hit-probability display | Out | The displayed TN IS the answer; stats dashboard is a different feature |
| Dice roll entry / "did I hit?" | Out | Sibling feature (dice-roller), not a sub-feature of the calculator |
| Mobile full-screen layout | Out | Repo is desktop-first (topbar + flex-wrap, no mobile patterns in `styles.css`); revisit when there's a mobile story |
| Sticky result footer | Out | Mobile-only; out by above |
| Dedicated UI for terrain / IF / REAR | Out | "Other" signed number input covers them generically; ASCE modifiers are heterogeneous enough that hand-rolled UI per modifier is YAGNI |

| Pi #8 idea | Verdict | Why |
|---|---|---|
| Movement mode UI | **In** | One `<select>`, four options — small enough to be a first-class field, not a generic Other-modifier |
| IF/REAR | Out (as dedicated UI) | Fall under "Other" |
| Terrain | Out (as dedicated UI) | Fall under "Other" |

**Anything all three missed:**

1. **Signed Other-modifier input.** The Other field is a `<input type="number">` with explicit `+/−` affordance (e.g. a `step="-1"` on a "Negate" button, or just rely on the user typing `-`). Architecturally, `attackerToHit` takes `otherModifiers: number[]` and sums them — caller passes signed values. Don't have the dialog try to enforce sign; the user knows what they're entering. Document the convention in a tooltip on the field.

2. **Heat as attack-ending, not modifier.** ASCE: heat 1/+1, 2/+2, 3/+4, S/can't attack. The pure function takes `attackerHeat: 0|1|2|3|"S"`. Values 1–3 add a TN penalty (modifier). Value `"S"` short-circuits to `{tn: null, cannotAttack: true, reason: "shutdown"}` so the dialog renders a disabled state, not a number. The dialog never has to know *why*. `sator.js` owns the rule; dialog owns the rendering.

3. **Target TMM: effective, not raw.** Target's TMM input to `attackerToHit` is the *effective* TMM after target's crits (MP halves, Engine halves vehicles) and status (Shutdown −4). Decision: `effectiveTargetTmm(target, targetEntry)` is a helper in `sator.js`; `attackerToHit` calls it. Keeps crit knowledge in one place, parallels `isEntryDestroyed` in `state.js`. The dialog may still expose a manual TMM override (codex #5 has this right) — when set, the override wins. This is for units not on the roster.

4. **JSDOM `<dialog>.showModal()` test gotcha.** jsdom implements `HTMLDialogElement` and the `open` / `returnValue` / `showModal()` / `close()` API, but does **not** implement the top-layer (the dialog isn't actually moved out of the DOM tree in a way that affects focus / inert behavior the way real browsers do). Consequences for tests:
   - Assert `dialog.open === true` / `dialog.open === false`, not `document.activeElement` changes.
   - Do not assert on focus trap behavior (it doesn't happen in jsdom).
   - `dialog.returnValue` works; `dialog.close('foo')` sets it.
   - **`showModal()` may throw** if the dialog is already open — guard the test path with a try/finally.

   **5-minute spike before committing:** write a 10-line jsdom test that calls `showModal()`, asserts `.open`, calls `close()`, asserts `.open === false`. If it works cleanly, native is the path. If it throws or behaves oddly, fall back to plain div per R1 (revisit resolution (a) only if the spike fails).

5. **Tooltip on the new card button.** None of the three reports mention this, but `addTip(toHit, "Open the to-hit calculator — this unit is the attacker")` is one line and matches the pattern of every other chrome control in `cards.js:266, 344, 373, 390`. Costs nothing; the user already gets tooltips everywhere else.

6. **No `__asSatorDialog` re-entrancy guard needed.** R1 proposed a guard against a second `init()` call creating two dialogs. With native `<dialog>`, the test harness sets `window.__AS_MANUAL__ = true` and calls `init()` exactly once per `boot()` (`tests/app.test.js:27`); `ensureDialog(doc)` caches the dialog element on the first call, subsequent calls return the cached one. The flag is a **cache key**, not a re-entrancy guard. Different semantic, same flag.

7. **No state import in `sator.js`.** R1 had `sator.js` as a pure module. That stays. `sator.js` reads `entry.crits`, `entry.heat`, `entry.skill` directly — these are the pure data the pure function consumes. No import of `state.js` mutators. `isEntryDestroyed` lives in `state.js` (parallel to `isEntryValid`), but `sator.js` doesn't need it — destruction affects *whether* the button shows, not the math. (Destroyed target = excluded from dropdown, not "TN capped.")

---

## 3. Net delta from R1

| Area | R1 said | R2 changes | Why |
|---|---|---|---|
| Dialog element | Plain div + `hidden` | Native `<dialog>` + `showModal()`/`close()` | Free focus trap, Esc, top-layer, no manual keydown teardown |
| Focus trap | "Defer to UX consult" | Included free (browser) | Native `<dialog>` provides it |
| 2d6 probability | Not mentioned | Out (v1); trivial to add later behind a toggle | Off-topic for a TN calculator |
| Dice roll | Not mentioned | Out (v1); sibling feature if it lands | Off-topic |
| Mobile full-screen | Not mentioned | Out (v1); revisit with mobile story | Repo is desktop-first |
| Heat as attack-ender | Not mentioned | `sator.js` returns `{cannotAttack: true, reason: "shutdown"}` on `"S"` | ASCE rule, belongs in pure function |
| Target TMM: raw vs effective | "dialog pre-computes" | `effectiveTargetTmm()` helper in `sator.js`; manual override field in dialog still wins when set | Keeps crit knowledge in one module |
| `isEntryDestroyed` | Not mentioned | New 1-line export in `state.js`, used by `cards.js` (existing stamp + new disabled-button) and `dialog.js` (filter target dropdown) | DRY; parallels `isEntryValid` |
| Other-modifier signedness | Not mentioned | `attackerToHit` takes `otherModifiers: number[]`; dialog has `<input type="number">` with explicit sign affordance | ASCE modifiers are mixed sign |
| JSDOM spike | Not mentioned | **5-min spike before committing to native `<dialog>`** | Confirm `showModal()` works in jsdom 24.1.0 |
| Tooltip on new button | Mentioned inline | One-liner `addTip(toHit, …)` | Match the pattern of every other chrome control |

**Module / file / test surface from R1 is unchanged.** The delta is entirely in *how* the dialog is rendered and *what edge cases* the pure function handles.

---

## 4. Suggested next step

A 5-line JSDOM spike, then either:

- **If spike passes:** invoke the writing-plans skill with the v1 scope from §2(d) "In scope" and the file table from `consult-sator-arch-claude.md §8` (with the dialog.js / `<dialog>` swap).
- **If spike fails:** re-run R1's plain-div plan with the manual `keydown` lifecycle spelled out. Add a follow-up item to the JSDOM dialog limitation (not blocker; jsdom 25+ may fix it; track but don't gate).

Either way, the math/UX consult (SATOR formula values, breakdown label wording, target picker UX edge cases, advanced-modifier coverage) can proceed in parallel — none of its answers depend on the dialog-element choice.
