# Consult Report — SATOR To-Hit Calculator Dialog (2026-08-13)

**Grid:** pi (kimi-k2.6:cloud, rules) · codex (glm-5.2:cloud, UX) · claude (minimax-m3:cloud, architecture)
**Task:** Design a SATOR to-hit calculator as a dismissable dialog, opened from a button on each unit card, prepopulated from the unit's data.
**Rounds:** 2 (independent design → combined-findings critique) + a JSDOM spike that resolved the key disagreement.

## Resolved design decisions

| Question | Verdict | Rationale |
|---|---|---|
| Dialog element | **Plain div overlay** (`role="dialog"`, `aria-modal="true"`, `hidden` toggle) | JSDOM 24.1.0 has **no `showModal()`** (spike-verified). Native `<dialog>` ruled out. Tooltip precedent + CSS variables match. |
| Focus | Manual: stash return-focus on open, restore on close; Esc keydown added on open, removed on close | Native trap unavailable; manual keydown must be lifecycle-managed (per audit R2 finding) |
| Calculation | **Live** (no Calculate button) | Tabletop UX — user toggles fields mid-attack; formula is a trivial sum |
| Scope | v1 = TN + breakdown; probability + dice roll deferred | TN + breakdown is the core deliverable |
| Persistence | None — ephemeral, stateless | It's a calculator, not game state |
| Module split | `sator.js` (pure logic) + `dialog.js` (DOM); `app.js` wires delegation | Mirrors `state.js` + `cards.js` pattern |
| Card button | `data-action="tohit"` in card head, left of remove; disabled when destroyed OR shutdown | Additive to existing delegation pattern |

## SATOR formula (pi, verified)

```
TN = Skill + AttackerMove(0/0/+1/+1) + TargetTMM(effective) + Terrain + Range(0/+2/+4)
     + OtherMods (incl. crits)
Natural 12 auto-hit · Natural 2 auto-miss · Min TN 2
```

**Auto-applied from state:**
- Attacker: Fire Control crit +2 each, Crew crit +2 each (aerospace); type mod (IM +1 unless AFC; SV+BFC +1)
- Target: TMM from unit card; MP/Engine crits halve TMM (round down); shutdown (heat S) TMM −4; **TMM 0 if target stationary**
- Abilities: STL +1 S/M / +2 L (range-dependent); LMAS +2 / MAS +3 only when target stationary; JMPS/JMPW on jump

**User enters:** attacker movement mode, target selection (roster dropdown, excluding destroyed + attacker itself), target movement mode, terrain (single select), range band, IF/REAR toggles, other mods (signed number input), manual TMM override (custom target).

**Guards:** destroyed/shutdown attacker → button disabled; destroyed units excluded from target dropdown; attacker heat "S" → `{cannotAttack: true}` from the pure function.

**Deferred:** 2d6 probability, dice-roll adjudicator, OV toggle, aerospace/physical combat modes, size-modifier table (values unverified across editions — pi flagged; exclude from v1), focus trap (manual, v1.1).

## Architecture (claude, agreed)

```
site/js/sator.js   — pure: attackerToHit({...}) → {tn, breakdown, cannotAttack, reason}
                      + helpers (rangeModifier, movementModifier, effectiveTargetTmm, ...)
site/js/dialog.js  — DOM: ensureSatorDialog(doc) [__asSatorDialog idempotent],
                      openSatorDialog({attacker, attackerEntry, targetRoster}),
                      closeSatorDialog(doc); Esc keydown add/remove on open/close;
                      backdrop click closes; focus return on close
site/js/cards.js   — add "To-Hit" button (data-action="tohit", addTip), disabled if destroyed/shutdown
site/js/state.js   — add isEntryDestroyed(entry, unit) helper
site/js/app.js     — roster delegation branch for "tohit"; wire ensureSatorDialog at init
site/styles.css    — .sator-overlay (fixed, z-index, backdrop), .sator-dialog (--panel tokens),
                     .sator-result, mobile full-screen + sticky result
```

## Testing (3 layers)

1. `tests/sator.test.js` — pure: formula sum, min-TN clamp, nat-12/nat-2 flags, TMM halving, stationary override, shutdown guard, crit modifiers
2. `tests/dialog.test.js` — JSDOM: idempotent ensure, open/close toggles `hidden`, prefill from attacker, Esc close, backdrop close, focus return
3. `tests/app.test.js` — integration: click card button opens dialog with attacker prefilled; destroyed unit's button disabled; target dropdown excludes destroyed

## JSDOM spike result (decided the dialog-element debate)

`dialog.showModal` is **undefined** in jsdom 24.1.0 (pinned). Native `<dialog>` is untestable without a polyfill → plain div overlay confirmed. This overrides claude's R2 reversal to native.

## Open questions for the user (brainstorming gate)

1. Target selection: roster dropdown only, or also "custom target" (manual TMM/size)?
2. Include 2d6 hit-probability in v1, or defer?
3. "Other mods" as a single signed number field, or split into named checkboxes (IF +1, REAR +1, darkness +1)?
4. Where should the button go — card head (with PV/remove) or body?
