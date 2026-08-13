# SATOR To-Hit Calculator — Wizard UX Design Report

**Date:** 2025-06-26  
**Context:** Alpha Strike companion app, `/home/jason/Repos/mul`  
**Scope:** Redesign the existing modal dialog (`site/js/dialog.js`) as a step-by-step wizard optimized for touch-driven tabletop play.

---

## 1. Executive Summary

The current SATOR dialog crams all five letters into a vertically-scrolled modal. On a phone this is cramped, the native `<select>` for target mode is awkward, and the **O** step is literally empty while **R** competes for space with inputs above it. The user suggested a multi-step page or wizard.

**Recommendation:** Keep the modal container (preserving existing `openSatorDialog` API and full-screen mobile behaviour) but replace the internal stacked-row layout with a **5-step wizard** (S → A → T → O → R). Each step becomes a focused "page" inside the modal. On mobile the modal already fills the viewport, so the effect is indistinguishable from a native app screen.

---

## 2. Modal vs. Page: Keep the Modal, Transform the Inside

| Approach | Pros | Cons |
|----------|------|------|
| **Replace modal with a real page route** | Back button works; more layout room; feels like an app | Requires routing, state persistence across navigation, breaks existing `openSatorDialog()` calls, harder to dismiss mid-flow |
| **Keep modal, add wizard inside** | Zero API changes; mobile already full-screen; Escape/overlay-tap still close; state is local; easiest incremental refactor | On desktop it is still a modal (but that's appropriate for a calculator tool) |

**Verdict:** The wizard lives **inside the existing modal**. On mobile the user will not perceive it as a modal — it will feel like a page. On desktop it remains a centred task-focused dialog.

---

## 3. The Five Steps

The mnemonic **S-A-T-O-R** becomes the navigation spine. Each step is a single screen with one primary decision.

| Step | Name | What the user decides | Typical taps |
|------|------|----------------------|--------------|
| **S** | Skill | Confirm (read-only; shown for mnemonic completeness) | 1 (Next) |
| **A** | Attacker | Attacker's movement mode | 1 + Next |
| **T** | Target | Target mode, TMM, and jet/sub modifier | 1–3 + Next |
| **O** | Other | Range band, terrain, and situational mods | 0–2 + Next |
| **R** | Roll | Review final TN, breakdown, and probability | 1 (Done) |

> **Note on Step O:** The current dialog omits range, terrain, fire-control/crew crits, and abilities. Step O is the natural home for these. The wizard should add **Range Band** and **Terrain** here so the calculator matches the full `attackerToHit()` logic in `site/js/sator.js`. If scope must stay minimal, Step O collapses to a single "Other modifier" stepper and a prominent Skip button.

---

## 4. Navigation & Progress Display

### Progress Indicator (always visible below header)

```
  S — A — T — O — R
  ✓   ✓   ●   ○   ○
```

- **Letters** inside circular pills (44 px touch target).
- **Completed** steps: filled accent colour with checkmark.
- **Current** step: filled accent with bold letter.
- **Future** steps: muted outline.
- **Tappable:** Any completed step can be tapped to jump directly back to it. This is the fastest backtrack mechanism.

### Header Bar

```
┌─────────────────────────────────────┐
│  ←   To-Hit Calculator        [×] │
├─────────────────────────────────────┤
│    S — A — T — O — R                │
│    ✓   ✓   ●   ○   ○                │
└─────────────────────────────────────┘
```

- **← Back arrow:** always visible except on Step S. Goes to previous step.
- **[×] Close:** always visible. Dismisses the modal instantly (no "are you sure?").

### Footer Bar (sticky)

```
├─────────────────────────────────────┤
│  [ Back ]         [ Next  → ]       │
│           TN 7  •  58.3%            │
└─────────────────────────────────────┘
```

- **Primary action** is right-aligned and thumb-reachable.
- On Step R the primary button reads **"Done"** or **"Roll!"** and is full-width.
- **Running TN** lives in the sticky footer so it is always visible. Tapping the TN expands a mini-breakdown inline.

### Swipe Gestures (optional enhancement)

- Horizontal swipe can change steps, but **buttons are the primary navigation**. Swipe is a convenience; do not rely on it.
- Vertical scroll within a step must remain free for content.

---

## 5. Screen-by-Screen ASCII Sketches

All sketches assume a 375 × 812 pt mobile viewport (the modal is already full-screen via `@media` query).

### Step S — Skill

```
┌─────────────────────────────────────┐
│  ←   To-Hit Calculator        [×] │
├─────────────────────────────────────┤
│    S — A — T — O — R                │
│    ●   ○   ○   ○   ○                │
├─────────────────────────────────────┤
│                                     │
│         ┌───────────┐               │
│         │           │               │
│         │    4      │   ← Skill     │
│         │           │               │
│         └───────────┘               │
│                                     │
│    From unit card. Lower is better. │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│              [  Next  →  ]          │
│        Running TN: 4  •  91.7%      │
└─────────────────────────────────────┘
```

- Skill is **read-only** (pulled from `attackerEntry.skill`).
- Large tan numerals for quick confirmation.
- One tap to advance.

---

### Step A — Attacker

```
┌─────────────────────────────────────┐
│  ←   To-Hit Calculator        [×] │
├─────────────────────────────────────┤
│    S — A — T — O — R                │
│    ✓   ●   ○   ○   ○                │
├─────────────────────────────────────┤
│  Attacker Movement                  │
│                                     │
│  ┌─────────────────┐               │
│  │  Standstill     │               │
│  │      -1         │               │
│  └─────────────────┘               │
│                                     │
│  ┌─────────────────┐               │
│  │  Ground      ✓  │  ← default   │
│  │       0          │               │
│  └─────────────────┘               │
│                                     │
│  ┌─────────────────┐               │
│  │  Jump           │               │
│  │      +2         │               │
│  └─────────────────┘               │
│                                     │
├─────────────────────────────────────┤
│  [ ← Back ]        [  Next  →  ]  │
│        Running TN: 4  •  91.7%      │
└─────────────────────────────────────┘
```

- Three large cards (min 72 px tall). Each shows label and modifier.
- **Ground** pre-selected as default.
- Tap a card to select; visual feedback is immediate.

---

### Step T — Target

```
┌─────────────────────────────────────┐
│  ←   To-Hit Calculator        [×] │
├─────────────────────────────────────┤
│    S — A — T — O — R                │
│    ✓   ✓   ●   ○   ○                │
├─────────────────────────────────────┤
│  Target Mode                        │
│                                     │
│  [Ground ✓]  [Standstill]           │
│  [Jumping]   [Submersible]          │
│  [Immobile]  [Dropped]              │
│                                     │
│  ── Target Movement (TMM) ──        │
│  [0 ✓] [1] [2] [3] [4] [5]         │
│                                     │
│  ── Jump / Sub Modifier ──          │
│  [ − ]    [  0  ]    [ + ]         │
│                                     │
├─────────────────────────────────────┤
│  [ ← Back ]        [  Next  →  ]  │
│        Running TN: 5  •  83.3%      │
└─────────────────────────────────────┘
```

**Conditional behaviour:**

| Target Mode | TMM Pills | Jet/Sub Stepper |
|-------------|-----------|-----------------|
| Ground | Shown (0–5) | Hidden |
| Standstill | Hidden (fixed 0) | Hidden |
| Jumping | Shown (0–5) | **Shown** (JMPS/JMPW) |
| Submersible | Shown (0–5) | **Shown** (SUBS/SUBW) |
| Immobile | Hidden (fixed -4) | Hidden |
| Dropped | Hidden (fixed +3) | Hidden |

- The native `<select>` is replaced by **big radio cards** (2×3 grid).
- TMM defaults to **0**.
- When a mode hides TMM, show a muted line: *"TMM = 0 (standstill)"* so the user understands why it is skipped.

---

### Step O — Other

```
┌─────────────────────────────────────┐
│  ←   To-Hit Calculator        [×] │
├─────────────────────────────────────┤
│    S — A — T — O — R                │
│    ✓   ✓   ✓   ●   ○                │
├─────────────────────────────────────┤
│  Range Band                         │
│  [Short ✓]  [Medium]  [Long]       │
│                                     │
│  ── Terrain ──                      │
│  [None ✓]   [Lt Woods]              │
│  [Hv Woods] [Partial Cover]        │
│  [Water]    [Smoke]                │
│                                     │
│  ── Other Modifiers ──              │
│  [ − ]    [  0  ]    [ + ]         │
│  (indirect, darkness, etc.)        │
│                                     │
│         [ Skip / None ]            │
│                                     │
├─────────────────────────────────────┤
│  [ ← Back ]        [  Next  →  ]  │
│        Running TN: 7  •  58.3%      │
└─────────────────────────────────────┘
```

- **Range Band** is added here (currently missing from dialog). Every attack has a range; it is the most important "other" modifier.
- **Terrain** uses the existing `TERRAIN_MODS` from `sator.js`.
- **Other modifier stepper** catches anything else (indirect fire, darkness, special abilities not auto-calculated).
- **"Skip / None"** button lets the user blast through with all defaults in a single tap.

---

### Step R — Roll

```
┌─────────────────────────────────────┐
│  ←   To-Hit Calculator        [×] │
├─────────────────────────────────────┤
│    S — A — T — O — R                │
│    ✓   ✓   ✓   ✓   ●                │
├─────────────────────────────────────┤
│                                     │
│            ┌─────┐                  │
│            │  7  │   ← Target No.  │
│            └─────┘                  │
│                                     │
│    4   Skill                        │
│  + 0   Move (Ground)                │
│  + 2   Target (Ground TMM 2)        │
│  + 1   Range (Medium)               │
│  ─────────────                      │
│  = 7                                │
│                                     │
│  2d6 ≥ 7 → 58.3% chance to hit     │
│                                     │
│  Natural 12 = auto-hit               │
│  Natural 2  = auto-miss            │
│  Minimum TN = 2                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│        [     Roll / Done     ]      │
│                                     │
└─────────────────────────────────────┘
```

- The TN is **huge** (48–56 px) for quick reading during the opponent's turn.
- Breakdown is itemised and editable-looking (tapping a line could jump back to that step).
- Probability gives the player a gut-feel before committing dice.
- "Roll / Done" is full-width and primary coloured.

---

## 6. Per-Step Control Reference

### Step S — Skill
| Control | Type | Default | Interaction |
|---------|------|---------|-------------|
| Skill value | Read-only display | `attackerEntry.skill` | None; tap Next to proceed |
| Next | Primary button | — | Advances to A |

### Step A — Attacker
| Control | Type | Default | Interaction |
|---------|------|---------|-------------|
| Standstill | Radio card | Off | Tap to select; modifier `-1` shown |
| Ground | Radio card | **On** | Tap to select; modifier `0` shown |
| Jump | Radio card | Off | Tap to select; modifier `+2` shown |
| Back | Secondary button | — | Returns to S |
| Next | Primary button | — | Advances to T |

### Step T — Target
| Control | Type | Default | Interaction |
|---------|------|---------|-------------|
| Ground | Radio card | **On** | Tap to select |
| Standstill | Radio card | Off | Tap to select |
| Jumping | Radio card | Off | Tap to select |
| Submersible | Radio card | Off | Tap to select |
| Immobile | Radio card | Off | Tap to select |
| Dropped | Radio card | Off | Tap to select |
| TMM 0–5 | Radio pills | **0** | Shown when `targetUsesTmm(mode)` |
| Jet/Sub stepper | +/- buttons + number | **0** | Shown when mode is Jump or Submersible |
| Back | Secondary button | — | Returns to A |
| Next | Primary button | — | Advances to O |

### Step O — Other
| Control | Type | Default | Interaction |
|---------|------|---------|-------------|
| Short | Radio pill | **On** | +0 modifier |
| Medium | Radio pill | Off | +2 modifier |
| Long | Radio pill | Off | +4 modifier |
| Terrain cards | Radio cards | **None** | 7 terrain options from `TERRAIN_MODS` |
| Other stepper | +/- buttons + number | **0** | Catches miscellaneous mods |
| Skip / None | Tertiary text button | — | Zeroes everything and advances |
| Back | Secondary button | — | Returns to T |
| Next | Primary button | — | Advances to R |

### Step R — Roll
| Control | Type | Default | Interaction |
|---------|------|---------|-------------|
| TN display | Large read-only | Computed | None |
| Breakdown lines | Tappable list | Computed | Tap any line to jump to that step |
| Probability | Read-only text | Computed | None |
| Notes | Read-only text | Static | None |
| Done | Primary button (full-width) | — | Closes modal |

---

## 7. Speed & Touch Optimizations

### Minimal Taps Per Attack (Happy Path)
The most common Alpha Strike attack is **Ground attacker → Ground target → Short range → No terrain**.

```
Step S: Next                    (1 tap)
Step A: Next  (Ground default)  (1 tap)
Step T: Next  (TMM 0 default)   (1 tap)
Step O: Next  (Short default)   (1 tap)
Step R: Done                    (1 tap)
Total: 5 taps
```

With auto-advance on Step S (or by collapsing S into the header), the happy path is **4 taps**.

### Anti-Dead-End Rules
1. **Every step has a default pre-selected.** The user can hammer "Next" through the whole flow.
2. **No required inputs.** Nothing blocks progression.
3. **Conditional fields hide, not disable.** Hidden fields do not demand attention; disabled fields feel like a puzzle.
4. **Skip button on Step O.** If the user never touches modifiers, one tap bypasses the entire step.
5. **Instant close.** The [×] and Escape key always work; no "unsaved changes" trap.

### Easy Backtrack
| Method | How it works |
|--------|--------------|
| **Progress pills** | Tap any completed S/A/T/O pill to jump directly there |
| **Header Back arrow** | Goes one step back |
| **Breakdown lines on Step R** | Tap any modifier row to jump to its source step |
| **Modal overlay tap** | Closes entirely (current behaviour) |

### Touch Targets
- All tappable elements: **minimum 44 × 44 px** (ideally 48 × 48 px for cards).
- Cards have **generous vertical padding** (≥ 16 px) to prevent mis-taps.
- Radio pills: **min-width 48 px**, separated by 8 px gaps.
- Stepper buttons: **48 × 48 px** minimum.

### Visual Feedback
- Selected cards get **accent border + tinted background** (reuse existing `:has(input:checked)` rule).
- Active state darkens/tints further (reuse existing `:active`).
- Transition between steps: **slide + fade** (120 ms ease-out) to reinforce directionality without feeling sluggish.

---

## 8. Sticky Footer & Running TN

The running TN must be visible at all times so the player sees the consequence of every choice.

```css
/* Conceptual CSS */
.sator-footer {
  position: sticky;
  bottom: 0;
  background: var(--panel);
  border-top: 1px solid var(--border);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

**Content:**
- **Left:** Back button (except Step S).
- **Right:** Next / Done button.
- **Centre (full width above buttons):** `TN 7 • 58.3%` in large tan numerals.

**Expand-on-tap:** Tapping the TN bar reveals a 2-line mini-breakdown:
```
  Skill 4 + Move 0 + Target 2 + Range 1 = 7
```
Tapping again collapses it.

On **Step R**, the sticky footer collapses to just the full-width "Done" button because the full breakdown is already on screen.

---

## 9. Accessibility Notes

- Maintain `role="dialog"` and `aria-modal="true"` on the overlay.
- Trap focus inside the modal while open.
- Return focus to the triggering element on close (existing behaviour).
- Each step panel has an `aria-live="polite"` region for the running TN so screen-reader users hear updates.
- Radio cards use hidden native `<input type="radio">` with `<label>` (existing pattern) — screen readers get proper semantics.
- Stepper inputs keep `type="number"` with `min/max/step` for accessible increment/decrement.

---

## 10. Implementation Sketch (Non-Normative)

To turn `dialog.js` into a wizard:

1. **Replace `SATOR_SECTIONS` array** with a step index (`currentStep = 0..4`).
2. **Build each step as a separate panel** (`<div class="sator-step" data-step="0">` … `</div>`), all siblings inside `sator-body`. Only the active panel is visible.
3. **Move the progress indicator** and sticky footer into the dialog template.
4. **Keep `recompute()`** but trigger it on every `input`/`change` inside the active panel. Update the sticky footer TN.
5. **Add `goToStep(n)`** helper that:
   - Hides all panels
   - Shows panel `n`
   - Updates progress pills
   - Moves focus to the first focusable element in the new panel
   - Updates header/footer button states
6. **Hook Back arrow** to `goToStep(currentStep - 1)`.
7. **Hook Next button** to `goToStep(currentStep + 1)` or close on Step R.
8. **Hook progress pills** so completed steps are clickable.
9. **Retain existing close logic** (× button, overlay click, Escape key).

CSS additions are modest:
- `.sator-step { display: none; }`
- `.sator-step.active { display: flex; flex-direction: column; }`
- `.sator-progress { display: flex; justify-content: center; gap: 8px; }`
- `.sator-footer { position: sticky; bottom: 0; }`

---

## 11. Open Questions / Decisions for Stakeholder

1. **Should Step S be skippable?** Skill is read-only for most units. We could open the wizard directly on Step A and show Skill as a read-only chip in the header. This saves one tap per attack.
2. **Should Step O include Range?** The current dialog omits range entirely. Adding it to Step O makes the calculator more accurate but slightly increases complexity. Alternative: keep Step O as a single "Other modifier" stepper and leave range out.
3. **Auto-advance?** When the user taps a choice on Step A or T, should we immediately advance to the next step (with a 300 ms visual confirmation), or require an explicit Next tap? Auto-advance is faster but riskier on small screens.
4. **Animations:** Is a 120 ms slide acceptable on low-end tablets, or should we stick to instant fade?
5. **Presets / memory:** Should the wizard remember the last-used attacker movement and target mode per unit, or reset to defaults every time?

---

*End of report.*
