# SATOR Calculator — UX & Dialog Design (codex / glm-5.2:cloud)

*Captured from agent pane output (file-write was blocked by lean-ctx). Full source
content preserved below for the spec record.*

## Key UX decisions

| Decision | Choice | Rationale |
|---|---|---|
| Dialog mechanism | Plain div overlay (not native `<dialog>`) | JSDOM 24.1.0 lacks `showModal()` (spike-verified); CSS variable cohesion |
| Calculation mode | **Live** (no Calculate button) | Instant feedback, matches app's live-update philosophy |
| Target selection | Manual TMM override + optional roster dropdown | User fights off-roster targets too |
| TMM field | Auto-filled but always editable | User may need situational overrides |
| Terrain | Single `<select>` | Standard AS takes highest terrain mod, not sum |
| Movement mode | Radio groups (not state-tracked) | Per-attack input, no persistence |
| Crits display | Read-only badges from entry state | Prevents double-entry; user already marked on card |
| Result display | Large TN + probability + breakdown + notes | Full transparency of the calculation |
| Mobile | Full-screen dialog + sticky result | Standard mobile modal pattern |
| Persistence | None (dialog is ephemeral) | It's a calculator, not game state |
| Trigger placement | Card head, right cluster | Visible without scrolling, co-located with identity |
| Trigger label | "To-Hit" (not "SATOR") | User-facing clarity; SATOR is internal codename |

## Formula & modifiers (from rules research)

- TN = Skill + AttackerMove(0/0/+1/+1) + TargetTMM + Terrain + Range(0/+2/+4) + Other
- Natural 12 auto-hit; natural 2 auto-miss; min TN 2
- Probability: TN 2 → 97.2% … TN 12 → 2.8%; TN 13+ → 2.8% (nat 12 only)
- Attacker crits: Fire Control +2 each, Crew +2 each (aerospace)
- Target crits: MP/Engine halve TMM (round down); shutdown TMM −4
- Abilities: STL +1 S/M / +2 L; LMAS +2 / MAS +3 (stationary only); JMPS/JMPW on jump

## Prepopulation map

**From card (attacker, read-only):** unit name, skill (entry.skill), unit type, type
modifier (derived), Fire Control crits, Crew crits, heat, abilities (parsed for
AFC/BFC/REAR/SRCH).

**User must enter:** attacker movement mode (default Walk), target TMM (default 0),
target movement mode (default Walk), terrain (None), range (Short), IF (off), REAR
(off), darkness (None), other mods (0).

**When target selected from roster:** auto-fill TMM, type, abilities; apply STL/LMAS/
MAS/JMPS/JMPW; heat S → TMM 0; MP/Engine crits → halve TMM; destroyed → excluded.

## Dialog anatomy

- `<fieldset>` sections: ATTACKER / TARGET / ATTACK with legends
- Attacker: movement radio, skill/type/crits read-only
- Target: TMM number input, movement radio, terrain select
- Attack: range radio, IF/REAR/darkness checkboxes, other mods number
- Result footer: large TN (36px+, --tan), probability line, breakdown, nat12/nat2
  notes; impossible-TN (13+) red warning styling
- Optional collapsible "Roll" sub-panel (dice roll → HIT/MISS/CRIT) — deferred

## Dismissal & a11y

- ✕ close button (aria-label), Esc key, backdrop click (e.target === overlay)
- Focus: first control on open; return to trigger on close
- role="dialog", aria-modal="true", aria-labelledby, aria-describedby
- Radio labels wrap full text for touch targets (44px min)

## Edge cases

- Destroyed units excluded from target dropdown; destroyed attacker → button
  disabled (aria-disabled + tooltip)
- STL re-evaluates on range change; LMAS/MAS only when target stationary
- JMPS2/JMPW1 parse trailing number, apply on jump only
- Aerospace attacker note: "results are approximate"
- Other mods input: integer, clamp −10..+10, parseInt default 0 on NaN

## Testing

- sator.test.js: computeTN combos, min-2 clamp, hitProbability table, typeModifier
- dialog.test.js: open/close, prefill, Esc, backdrop, focus return, live recompute
- app.test.js: deploy → click To-Hit → dialog opens with attacker skill; range change
  updates TN; Esc closes; destroyed button disabled
