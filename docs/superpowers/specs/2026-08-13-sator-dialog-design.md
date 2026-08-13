# SATOR To-Hit Calculator Dialog — Design Spec

Date: 2026-08-13
Status: Draft (awaiting user review)
Sources: `docs/superpowers/consult-2026-08-13-sator-dialog.md` + agent reports (`consult-sator-rules-pi.md`, `consult-sator-ux-codex.md`, `consult-sator-arch-claude.md`)

## Purpose

Add a SATOR to-hit calculator as a dismissable dialog overlay. Each unit card gets a
"To-Hit" button that opens the dialog pre-populated with the attacker's skill, crits,
and modifiers from card state. The user enters the target's TMM, movement modes,
terrain, range, and other modifiers; the dialog live-computes the target number (TN)
with a step-by-step breakdown and the 2d6 hit probability.

SATOR = **S**kill + **A**ttacker modifiers + **T**arget modifiers + **O**ther modifiers + **R**oll.

## Current Behavior

- Cards render via `renderCard()` (site/js/cards.js:249) with chrome controls in the
  header (title, variant, PV badge, ✕ remove button, `data-action="remove"`).
- `app.js` roster click delegation (app.js:~230) branches on `e.target.dataset.action`
  ("remove", "armor", "struct", "heat", "set-skill", "crit", "delete-group").
- Entry state tracks skill, heat (0/1/2/3/"S"), crits (fireControl, crew, mp, engine,
  weapons, …), armor/structure damage.
- `state.js` has `isAerospaceUnit`, `isEntryValid` helpers. `tooltips.js` injects a
  plain div float — the only overlay precedent.
- Unit data (`unit.*`): type, tmm, size, move, abilities (STL, LMAS, MAS, JMPS, JMPW,
  AFC, BFC, SRCH, REAR, …), skill default, damage.

## Desired Behavior

- **Trigger:** "To-Hit" button in the card header, left of the remove button,
  `data-action="tohit"`, with a tooltip. Disabled (with `aria-disabled` + tooltip)
  when the unit is destroyed or shutdown (heat "S").
- **Remove confirm:** clicking ✕ arms a two-step confirm — the button morphs to
  "Sure?" (2.5s timeout, then reverts). A second click within the window removes the
  unit. A click anywhere else cancels the armed state.
- **Dialog:** plain div overlay centered over the screen (`role="dialog"`,
  `aria-modal="true"`, `aria-labelledby`), hidden by default, injected once by JS.
  Dismissal: ✕ button, Esc key, backdrop click. Focus moves to the first control on
  open and returns to the To-Hit button on close.
- **Live calculation** — no Calculate button; TN, breakdown, and probability update on
  every input/change.
- **Stateless** — nothing persisted; every open re-prepopulates from current entry
  state.
- **Target selection:** manual TMM number input only (no roster dropdown; user types
  the target's TMM). Target movement mode radio determines whether TMM applies
  (Stationary → TMM 0). Note: in v1 the target is the attacker's own unit data
  (`target` = `attacker`), so target abilities (STL/LMAS/MAS) resolve against the
  attacker's abilities — i.e. those ability modifiers are effectively inert in the v1
  UI. Documented as future work when a roster target picker lands.
- **Result:** large TN (min 2; red when >12 with "only a natural 12 can hit"),
  breakdown line, 2d6 hit probability, natural-12/natural-2 notes.

## SATOR Formula (v1)

```
TN = Skill
   + AttackerMovement (Stationary 0, Walk 0, Run +1, Jump +1)
   + EffectiveTargetTMM (see below)
   + Terrain (None 0, Light Woods +1, Heavy Woods +2, Partial Cover +1, Water +1, Light Smoke +1, Heavy Smoke +2)
   + Range (Short 0, Medium +2, Long +4)
   + Other (IF +1, REAR +1, Darkness +1 unless attacker has SRCH, free signed Other field)
   + AttackerCrits (FireControl +2 each, Crew +2 each)
   + AttackerType (IndustrialMech +1 unless AFC, Support Vehicle with BFC +1)
   + TargetAbilities (STL +1 S/M / +2 L, LMAS +2 / MAS +3 only when target stationary)
```

Clamps and rules:
- **Minimum TN = 2.**
- **Natural 12 always hits** (even TN 13+); **natural 2 always misses** (even TN 2).
- Effective TMM: card `unit.tmm`, halved (round down) per MP crit and per Engine crit
  (vehicle), TMM −4 when shutdown ("S"), and **0 when target stationary** or
  immobilized. Floor at 0.
- Heat does **not** modify the attacker's TN (AS:CE).
- **cannotAttack** guard: attacker destroyed or shutdown → button disabled; if the
  pure function receives such an attacker it returns `{ cannotAttack: true, reason }`.

### Probability table (2d6)

| TN | P(hit) | | TN | P(hit) |
|---|---|---|---|---|
| 2 | 97.2% (nat 2 misses) | | 8 | 41.7% |
| 3 | 97.2% | | 9 | 27.8% |
| 4 | 91.7% | | 10 | 16.7% |
| 5 | 83.3% | | 11 | 8.3% |
| 6 | 72.2% | | 12 | 2.8% |
| 7 | 58.3% | | 13+ | 2.8% (nat 12 only) |

## Implementation

### 1. `site/js/sator.js` — pure logic, no DOM

```js
export const RANGE_BANDS = ["S", "M", "L"];
export function rangeModifier(band)          // S=0, M=2, L=4
export function movementModifier(mode)       // stationary/walk=0, run=1, jump=1
export function terrainModifier(terrain)     // table above
export function effectiveTargetTmm(target, targetEntry, targetMovement, overrides)
export function attackerTypeModifier(unit)   // IM +1 unless AFC; SV+BFC +1
export function abilityModifier(unit, { rangeBand, targetMovement, isAerospace })
export function hitProbability(tn)           // table lookup, clamped
export function attackerToHit({ attacker, attackerEntry, target, targetEntry,
                                 targetMovement, rangeBand, terrain, otherModifiers })
  -> { tn, breakdown: [{label, value}], probability, cannotAttack, reason }
```

- `otherModifiers` is a list of signed numbers (named toggles + free field flattened).
- Breakdown entries drive the dialog's `4 + 1 + 2 + 2 + 1 = 10` line.
- `hitProbability` caps at 97.2% (TN ≤ 2) and floors at 2.8% (TN ≥ 13).

### 2. `site/js/state.js` — one new helper

```js
export function isEntryDestroyed(entry, unit) {
  return entry.armorDamage >= unit.armor && entry.structDamage >= unit.structure;
}
```

Reused by `cards.js` (existing DESTROYED stamp + new disabled button), `dialog.js`.

### 3. `site/js/cards.js` — button + two-step remove

- In `renderCard` header: add `button.card-tohit` (`data-action="tohit"`,
  `aria-label="Open to-hit calculator"`, text "To-Hit", `addTip`). Append before the
  remove button.
- `disabled = true` + `aria-disabled` + tip "Unit destroyed — cannot attack" when
  `isEntryDestroyed` or `entry.heat === "S"`.
- Remove button two-step: add `data-armed` class on first click (text → "Sure?"),
  clear after 2.5s (`setTimeout` per card, cleared on re-render) or on outside click;
  second click within the window proceeds with removal. The existing `data-action`
  delegation stays the single removal path — the arming state is a class checked in
  the `remove` branch. "Outside click" = one `click` listener on `document` (bound
  when arming, removed when disarmed) that clears the armed state unless the click
  target is the armed button itself.

### 4. `site/js/dialog.js` — DOM dialog

- `ensureSatorDialog(doc)` — creates the overlay once, appends to `doc.body`, caches
  on `doc.__asSatorDialog` (idempotent, mirrors `__asTooltips`).
- `openSatorDialog({ doc, attacker, attackerEntry })` — fills attacker section from
  entry/unit, resets target/other fields to defaults, unhides, focuses first control,
  stashes `overlay.__returnFocus = doc.activeElement`, binds the Esc `keydown`
  handler.
- `closeSatorDialog(doc)` — hides, removes the Esc handler, restores focus.
- Backdrop click (target === overlay) closes; ✕ button closes.
- Live recompute: one delegated `input`/`change` listener on the dialog root calls
  `attackerToHit` and updates `.sator-result` (TN, breakdown, probability, notes).
- Structure: `fieldset` sections (Attacker / Target / Range / Other), result footer.
  Sticky result on mobile via CSS.

### 5. `site/js/app.js` — wiring

- In `init`: call `ensureSatorDialog(_doc)` once (next to `initTooltips`).
- Roster delegation: new branch `data-action === "tohit"` — resolve `entry`/`unit`
  from `card.dataset.entryId`, call `openSatorDialog`.
- Remove branch: honor the armed state (ignore first click unless `data-armed`).

### 6. `site/styles.css`

- `.sator-overlay` — `position: fixed; inset: 0; z-index: 100;` flex-centered,
  `background: rgba(0,0,0,0.6)`; `[hidden] { display: none; }`.
- `.sator-dialog` — `--panel` bg, `--border`, accent top border, radius, max-width
  ~480px, max-height with internal scroll.
- `.sator-result` — sticky bottom, big TN (`--font-head`, `--tan`; `--damaged` when
  >12), breakdown (`--muted`), probability line, notes.
- `.sator-armed` state for the remove button ("Sure?" styling).
- Mobile `@media (max-width: 700px)`: overlay full-screen, dialog full-viewport,
  result sticky footer.

## Edge Cases

| Scenario | Behavior |
|---|---|
| Attacker destroyed/shutdown | To-Hit disabled; pure fn returns `cannotAttack` |
| Target stationary | TMM forced to 0 (effective TMM override) |
| Target MP/Engine crit | TMM halved (round down), floor 0 |
| Target shutdown | TMM −4, floor 0 |
| STL + range change | Modifier re-evaluates live (+1 S/M, +2 L) |
| LMAS/MAS + target moved | Modifier contributes 0 |
| Attacker SRCH + darkness | Darkness toggle auto-negated (checkbox disabled + annotated) — implemented in v1 (`dialog.js` disables and zeroes the toggle when the attacker has SRCH) |
| TN > 12 | Red TN, "only a natural 12 can hit" note, probability 2.8% |
| TN ≤ 2 | Clamped to 2, probability capped 97.2%, "natural 2 always misses" |
| Remove arming timeout | 2.5s; click elsewhere or re-render cancels |
| Double init (tests) | `__asSatorDialog` idempotency guard |
| Esc/backdrop/✕ | All close; focus returns to To-Hit button |

## Testing

**tests/sator.test.js** — pure, no JSDOM:
- Formula sum with mixed modifiers; min-TN clamp at 2.
- `movementModifier` table; `rangeModifier` table; `terrainModifier` table.
- `effectiveTargetTmm`: stationary → 0; MP crit halving round-down; shutdown −4;
  engine crit (vehicle); floor at 0.
- `attackerTypeModifier`: BM 0, IM +1, IM+AFC 0, SV+BFC +1.
- `abilityModifier`: STL at S/M vs L; LMAS/MAS stationary-only; none when moved.
- `hitProbability`: TN 2→97.2%, TN 7→58.3%, TN 12→2.8%, TN 13→2.8%.
- `attackerToHit`: breakdown shape; `cannotAttack` for destroyed/shutdown attacker;
  natural-12/natural-2 flags.

**tests/dialog.test.js** — JSDOM:
- `ensureSatorDialog` idempotent (one overlay, cached).
- `openSatorDialog` unhides, prefills attacker skill/crit badges, focuses first
  control, stashes return-focus.
- `closeSatorDialog` hides, restores focus, removes Esc handler.
- Esc keydown closes; backdrop click closes; ✕ closes.
- Changing range/terrain/other updates the result TN live.

**tests/app.test.js** — integration via `boot()`:
- Click To-Hit opens dialog prefilled with attacker.
- Destroyed unit's To-Hit button disabled; shutdown unit's disabled.
- Remove two-step: first click arms ("Sure?"), second click removes; click elsewhere
  cancels; timeout reverts.
- Esc closes and returns focus to the button.

**tests/cards.test.js** — `isEntryDestroyed` used by stamp/disabled button; To-Hit
button present with tooltip.

## Out of Scope (deferred)

- Dice-roll adjudicator (roll → HIT/MISS/CRIT input).
- 2d6 probability display is IN v1 per user decision; dice-roll entry is not.
- OV toggle / damage context.
- Size-modifier table (values unverified across AS:CE editions).
- Aerospace and physical-combat modifier systems (note "approximate" if an aerospace
  unit is the attacker).
- Roster target dropdown / custom-target form (user chose manual TMM only).
- Persisting last-used values; focus trap (manual v1.1 if needed).
- C3/TAG/Narc/spotting modifiers (no direct TN effect in AS:CE).
