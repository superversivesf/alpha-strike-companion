# SATOR To-Hit Calculator — Touch/Tabletop Visual Design

**Author:** codex (visual-design focus angle)
**Date:** 2026-08-13
**Scope:** Visual language, control styling, touch ergonomics, conditional-reveal
pattern for JMPS/JMPW/SUBS/SUBW. Not a rewrite of the logic or formula — those are
settled in `consult-2026-08-13-sator-dialog.md` and `sator.js`.

---

## 1. Problem diagnosis — what is ugly today

The current dialog (in `dialog.js` + `styles.css` `.sator-*` rules) is functional but
visually cramped and inconsistent. Specific issues:

| Issue | Current state | Why it is bad on touch |
|---|---|---|
| **Letter rail** | 44px square boxes in a flex row, 30px font | Visually dominant but non-interactive — occupies space without function; no step affordance |
| **Radio pills** | `.sator-radio-group label` — 44px min, 14px font, 4px radius | Readable but flat; selected state is just a border tint; no visual weight difference between selected and unselected |
| **Native select** | `#sator-target-mode` — browser-rendered `<select>` | Jarring style break on every platform; tap target varies; options list is small system font; no icon support |
| **Stepper** | minus / number / plus in a flex row, 44px buttons | Functional but visually orphaned — floats below the select with a tiny 13px label; does not read as part of a step |
| **JMPS/JMPW row** | Always present in the T section, just hidden via `.hidden` | Hidden elements leave no trace — user does not know a field appeared/changed; no animation; label JMPS/JMPW/SUBS/SUBW hash is a confusing compound |
| **Result panel** | Sticky bottom box, 40px TN, 12px breakdown | Good instinct (sticky) but breakdown is too small at arm length; probability line is 14px — readable but visually disconnected from TN |
| **Spacing** | 10px row padding, 4px content gap, 6px sub-group margins | No rhythm — every gap is a different number; no vertical breathing room between conceptual steps |
| **Section dividers** | 1px border-bottom on each `.sator-section-row` | Thin lines, low contrast (--border = #4a5560 on --panel = #1c2128); do not read as card boundaries |

**Root cause:** The SATOR letter rail was designed as a *labeling* device ("this row is
S, this row is A...") but visually it reads as a vertical tab bar that does nothing.
The controls inside each row are a grab-bag of different widget types (radios, select,
stepper, read-only text) with no shared visual grammar.

---

## 2. Design principles

1. **Steps are cards, not rows.** Each SATOR letter becomes a full-width card with a
   header strip, a body, and consistent internal padding. The letter becomes the
   card step number / badge, not a separate column.

2. **One control vocabulary.** Every interactive input is a **tap-tile** — a
   bordered, centered, tappable rectangle with a label and optional value. Radios,
   target-mode selector, and stepper all use the same `.sator-tile` base class. No
   native `<select>` anywhere.

3. **44-64px hit targets, no exceptions.** Every tappable surface is at least 44px in its
   smallest dimension. Primary controls (mode tiles, TMM tiles) are 56-64px. The
   close button is 44px. The stepper buttons are 56px squares.

4. **Selected state has visual weight.** Selected tiles get a filled background
   (--accent at 20% opacity), a 2px solid --accent border, **and** a bold label
   weight. Unselected tiles are outlined only. There is no ambiguity at a glance.

5. **Typography scale is stepped and large.**
   - Step header label: 11px uppercase tracked (secondary)
   - Step title: 15px bold (primary)
   - Tile label: 14px medium
   - Tile value (when showing a number): 18px bold
   - Result TN: 48px --font-head
   - Breakdown: 14px (not 12px)
   - Probability: 14px
   - Notes: 12px

6. **Spacing rhythm is 8px-based.** All gaps are multiples of 8 (8, 16, 24). No 4px,
   6px, or 10px outliers. Card padding is 16px. Inter-card gap is 12px (a deliberate
   4px half-step for visual grouping — the only exception, used consistently).

7. **Conditional reveal animates.** When JMPS/JMPW/SUBS/SUBW appears, it slides in
   (max-height + opacity transition, 200ms). When it disappears, it collapses. The
   user sees the field arrive.

---

## 3. Control vocabulary — the tap-tile

Every interactive control is a variant of this base:

```
+------------------+
|   LABEL           |  <- 14px medium, centered
|   42              |  <- 18px bold (optional value line)
+------------------+
  border: 1px solid --border
  border-radius: 8px
  min-height: 56px
  padding: 8px 16px
  background: transparent (unselected)
  background: rgba(240,124,31,0.15) (selected)
  border: 2px solid --accent (selected)
  font-weight: 700 (selected)
```

**Variants:**
- **Mode tile** — label only (e.g., "Ground", "Jump"). Used for attacker movement,
  target mode. Full-width or half-width depending on count.
- **Number tile** — label + big number (e.g., TMM "0" through "5"). Square, 56x56px.
- **Stepper tile** — integrated minus/value/plus in a single 3-zone tile (see section 6).
- **Read-only tile** — label + value, no tap (e.g., Skill = 4). Uses --panel-2
  background, no border color change.

---

## 4. Step-by-step ASCII mockups

### Step S — Skill (read-only)

```
+====================================================+
|  [S]  S -- SKILL                          auto    |
|        +--------------------------------------+   |
|        |                              4       |   |
|        |  Pilot skill rating                 |   |
|        +--------------------------------------+   |
+====================================================+
```

- Badge: 36x36px square, --panel-2 bg, --tan letter, 20px --font-head.
- "auto" tag: 10px uppercase, --muted, right-aligned in header.
- Read-only tile: full-width, --panel-2 background, no border accent.
- The big "4" is 32px --font-head, --tan.
- Sub-label "Pilot skill rating" is 12px --muted.

### Step A — Attacker Movement (3 mode tiles)

```
+====================================================+
|  [A]  A -- ATTACKER MOVEMENT                      |
|        +------------+ +------------+ +------------+
|        |  Standstill | |   Ground   | |    Jump    |
|        |            | |  * SELECTED| |            |
|        +------------+ +------------+ +------------+
|        +------------------------------------------+
|        |  Modifier: +0                           |
|        +------------------------------------------+
+====================================================+
```

- 3 tiles in a row, each ~33% width, min-height 56px.
- Selected tile: filled --accent bg at 15%, 2px --accent border, bold label.
- A small "* SELECTED" indicator dot or filled corner triangle can replace the
  background fill for an even cleaner look (see section 7 on selected states).
- Modifier readout line below: 13px --muted, updates live.

### Step T — Target (mode grid + TMM tiles + conditional reveal)

**Default (Ground mode selected):**

```
+====================================================+
|  [T]  T -- TARGET MOVEMENT                         |
|        +----------+ +----------+ +----------+     |
|        |  Ground  | | Immobile | |  Dropped |     |
|        | *  sel   | |          | |          |     |
|        +----------+ +----------+ +----------+     |
|        +----------+ +----------+ +----------+     |
|        |Standstill| |  Jumping | |Submersibl|     |
|        |          | |          | |   e      |     |
|        +----------+ +----------+ +----------+     |
|                                                    |
|        TMM                                         |
|        +----+ +----+ +----+ +----+ +----+ +----+  |
|        | 0  | | 1  | | 2  | | 3  | | 4  | | 5  |  |
|        |*sel| |    | |    | |    | |    | |    |  |
|        +----+ +----+ +----+ +----+ +----+ +----+  |
+====================================================+
```

- Target mode: 6 tiles in a 3x2 grid (or 2x3 on narrow screens). No native select.
  Each tile: min-height 52px, label centered, 13px font (slightly smaller to fit
  longer labels like "Submersible" and "Standstill").
- TMM: 6 square tiles, 52x52px, big number centered (20px bold).
- The "TMM" sub-label is 11px uppercase tracked, --muted, 8px gap above tiles.

**Jumping mode selected — JMPS/JMPW reveals:**

```
+====================================================+
|  [T]  T -- TARGET MOVEMENT                         |
|        +----------+ +----------+ +----------+     |
|        |  Ground  | | Immobile | |  Dropped |     |
|        +----------+ +----------+ +----------+     |
|        +----------+ +----------+ +----------+     |
|        |Standstill| | * Jumping| |Submersibl|     |
|        +----------+ +----------+ +----------+     |
|                                                    |
|        TMM                                         |
|        +----+ +----+ +----+ +----+ +----+ +----+  |
|        | 0  | | 1  | | 2  | | 3  | | 4  | | 5  |  |
|        +----+ +----+ +----+ +----+ +----+ +----+  |
|                                                    |
|        v Jump modifier (JMPS/JMPW)                |
|        +------------------------------------------+
|        |  +----+   +----------+   +----+         |
|        |  | -  |   |    +1    |   |  +  |         |
|        |  +----+   +----------+   +----+         |
|        +------------------------------------------+
+====================================================+
```

- The jump-modifier row slides in below TMM with a 200ms transition.
- Sub-label "Jump modifier (JMPS/JMPW)" replaces the confusing "JMPS/JMPW hash" —
  it now names *why* the field exists, not the cryptic ability codes.
- The stepper is an **integrated 3-zone tile** (see section 6), not a loose row.

**Submersible mode selected — SUBS/SUBW reveals:**

Same layout, but sub-label reads "Depth modifier (SUBS/SUBW)" and the stepper
range is different (-3 to +2 per current `sator.js` constraints).

**Immobile / Dropped / Standstill modes:**
- TMM tiles **hide** (no TMM applicable).
- No modifier stepper.
- A one-line explanation appears: "Immobile: target modifier -4" or
  "Dropped: target modifier +3" — read-only info tile, same visual style as
  the Skill read-only tile.

### Step O — Other (info-only in current implementation)

The current dialog has no "O" controls — it is a placeholder. In the visual
system, it should still render as a card (for SATOR completeness) but show
a read-only info tile:

```
+====================================================+
|  [O]  O -- OTHER                                  |
|        +--------------------------------------+   |
|        |  No additional modifiers in v1.       |   |
|        |  Indirect fire, darkness, and special  |   |
|        |  abilities will appear here in a future|   |
|        |  release.                              |   |
|        +--------------------------------------+   |
+====================================================+
```

- Muted text, --panel-2 background, no border accent.
- Keeps the SATOR acronym visible without implying functionality.

### Step R — Roll (result)

```
+====================================================+
|  [R]  R -- ROLL                          result   |
|        +--------------------------------------+  |
|        |                                      |  |
|        |               8                      |  |
|        |          TARGET NUMBER               |  |
|        |                                      |  |
|        |   4 (Skill) + 0 (Move) + 4 (Target)   |  |
|        |                                      |  |
|        |     2d6 >= 8 -> 41.7% chance to hit   |  |
|        |                                      |  |
|        |  Nat 12 = auto-hit | Nat 2 = auto-miss|  |
|        +--------------------------------------+  |
+====================================================+
```

- This card is **always visible** and **sticky to the bottom** on mobile (current
  behavior preserved).
- TN: 48px --font-head, --tan. Centered. If impossible (TN > 12): --damaged.
- "TARGET NUMBER" label: 10px uppercase tracked, --muted, 4px below TN.
- Breakdown: 14px --text, centered, 8px below label.
- Probability: 14px --muted, 8px below breakdown.
- Notes: 12px --muted, 8px below probability.
- Card has --panel-2 background + 2px top border --accent (current styling
  preserved, just larger text).

**Cannot-attack state:**

```
|        |                                      |  |
|        |            -- CANNOT --              |  |
|        |       Unit is shut down              |  |
|        |                                      |  |
```

- "-- CANNOT --" in 24px --damaged, --font-head.
- Reason in 14px --muted.
- No breakdown/probability/notes lines.

---

## 5. Full dialog layout (stacked cards)

```
+-----------------------------------------------------+
|  TO-HIT CALCULATOR                            [X]   |  <- header, 48px tall
+-----------------------------------------------------+
|                                                      |
|  +- S - Step card ------------------------------+   |
|  |  [badge S]  S -- SKILL              auto    |   |
|  |  +----------------------------------------+  |   |
|  |  |                                  4      |  |   |
|  |  +----------------------------------------+  |   |
|  +----------------------------------------------+   |
|                                                      |  <- 12px gap
|  +- A - Step card ------------------------------+   |
|  |  [badge A]  A -- ATTACKER MOVEMENT          |   |
|  |  +--------+ +--------+ +--------+           |   |
|  |  |Standst.| |Ground *| | Jump   |           |   |
|  |  +--------+ +--------+ +--------+           |   |
|  |  Modifier: +0                               |   |
|  +----------------------------------------------+   |
|                                                      |  <- 12px gap
|  +- T - Step card ------------------------------+   |
|  |  [badge T]  T -- TARGET MOVEMENT            |   |
|  |  +--------++--------++--------+              |   |
|  |  |Ground *||Immobile||Dropped |              |   |
|  |  +--------++--------++--------+              |   |
|  |  +--------++--------++--------+              |   |
|  |  |Standst.||Jumping ||Subm.   |              |   |
|  |  +--------++--------++--------+              |   |
|  |  TMM                                        |   |
|  |  +--+--+--+--+--+--+                       |   |
|  |  |0*|| 1|| 2|| 3|| 4|| 5|                  |   |
|  |  +--+--+--+--+--+--+                       |   |
|  |  +- conditional reveal (slide-in) -------+  |   |
|  |  | Jump modifier (JMPS/JMPW)             |  |   |
|  |  | +--+ +------+ +--+                    |  |   |
|  |  | |- | |  +1  | | +|                    |  |   |
|  |  | +--+ +------+ +--+                    |  |   |
|  |  +--------------------------------------+  |   |
|  +----------------------------------------------+   |
|                                                      |  <- 12px gap
|  +- O - Step card ------------------------------+   |
|  |  [badge O]  O -- OTHER                      |   |
|  |  +----------------------------------------+  |   |
|  |  | No additional modifiers in v1.         |  |   |
|  |  +----------------------------------------+  |   |
|  +----------------------------------------------+   |
|                                                      |  <- 12px gap
|  +- R - Step card (sticky bottom on mobile) ---+   |
|  |  [badge R]  R -- ROLL                  result|   |
|  |  +----------------------------------------+  |   |
|  |  |                 8                      |  |   |
|  |  |            TARGET NUMBER               |  |   |
|  |  |  4 (Skill) + 0 (Move) + 4 (Target)     |  |   |
|  |  |  2d6 >= 8 -> 41.7% chance to hit       |  |   |
|  |  |  Nat 12=auto-hit | Nat 2=auto-miss     |  |   |
|  |  +----------------------------------------+  |   |
|  +----------------------------------------------+   |
|                                                      |
+-----------------------------------------------------+
```

---

## 6. Integrated stepper tile (replaces loose stepper + number input)

The current stepper is three loose elements (minus, input, plus) in a flex row. On touch
this is error-prone — the input field invites keyboard pop-up, and the three elements
do not read as a single control.

**Redesign: single integrated tile.**

```
+--------------------------------------------------+
|  Jump modifier (JMPS/JMPW)                       |  <- 12px label, --muted
|  +------+  +--------------+  +------+            |
|  |  -   |  |     +1       |  |  +   |            |
|  |      |  |              |  |      |            |
|  +------+  +--------------+  +------+            |
|   56x56      80x56            56x56              |
+--------------------------------------------------+
```

- The minus and plus buttons are 56x56px tap-tiles (same `.sator-tile` base).
- The center value display is **not an `<input>`** — it is a read-only `<div>` showing
  the current value in 24px bold --font-head. The actual state lives in JS (a
  hidden `<input type="number">` for a11y/form-submission compatibility if ever needed,
  but visually it is just text). This **prevents the mobile keyboard from popping up**
  when the user taps the value — a major touch annoyance.
- The value updates on minus/plus tap. Long-press could accelerate (-5/+5) — deferred.
- Clamping: -3 to +2 (per current `sator.js` logic for jump/submersible).
- The entire tile group sits inside a container with --panel-2 background and
  8px border-radius, visually grouping the three elements as one control.

---

## 7. Selected-state visual language

Current: border-color change + 15% accent background. This works but is subtle at
arm length. Proposed enhancement:

| State | Border | Background | Label | Indicator |
|---|---|---|---|---|
| Default | 1px --border | transparent | 14px medium --text | none |
| Selected | 2px --accent | --accent @ 18% opacity | 14px **bold** --text | filled corner dot (8px) in --accent |
| Pressed | 2px --accent-strong | --accent @ 30% | 14px bold | dot + scale(0.97) |
| Disabled | 1px --border @ 50% | transparent | 14px --muted | none |

The **corner dot** is the key addition — a small filled circle in the top-right
corner of the tile. It reads instantly even when the user is scanning quickly.
The background tint + border + bold + dot together create a 4-channel selected signal
that is unmissable.

```css
.sator-tile[aria-pressed="true"]::after {
  content: "";
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}
```

Using `aria-pressed` instead of `:has(input:checked)` is more semantic and works
for button-based tiles (not just radio-wrapping labels).

---

## 8. Conditional reveal: JMPS / JMPW / SUBS / SUBW

### Current behavior

```js
// dialog.js recompute():
if (jetsRow) jetsRow.hidden = !(tgtMode === "jump" || tgtMode === "submersible");
```

`.hidden` is a hard display:none toggle — no animation, no visual transition. The
row just blinks in/out. The label is always "JMPS/JMPW/SUBS/SUBW hash" regardless of
mode, which is confusing (a user in Jump mode sees "SUBS/SUBW" in the label even
though it does not apply).

### Proposed behavior

**Conditional reveal with mode-aware label and slide animation.**

| Target mode | Stepper visible? | Label text | Range | Auto-fill source |
|---|---|---|---|---|
| Ground | No | — | — | — |
| Standstill | No | — | — | — |
| Jumping | **Yes** | "Jump modifier (JMPS/JMPW)" | -3 to +2 | 0 (manual) |
| Submersible | **Yes** | "Depth modifier (SUBS/SUBW)" | -3 to +2 | 0 (manual) |
| Immobile | No | — | — | — |
| Dropped | No | — | — | — |

**Animation:**

```css
.sator-conditional {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 200ms ease, opacity 200ms ease;
}
.sator-conditional.revealed {
  max-height: 120px; /* enough for label + stepper */
  opacity: 1;
}
```

Toggling a class (not `hidden`) drives the animation. The max-height technique is
GPU-friendly and does not require knowing exact content height.

**Label switching:** The label text updates based on mode, not a compound label.
In Jump mode -> "Jump modifier (JMPS/JMPW)". In Submersible -> "Depth modifier
(SUBS/SUBW)". This tells the user *what* they are modifying and *which ability codes*
it maps to, without showing irrelevant codes.

**Auto-fill from unit data:** The current implementation always starts at 0. If a
target picker exists in a future iteration (selecting a target unit from the roster),
the stepper could auto-fill from the target unit parsed abilities:

- `JMPS2` -> jump modifier +2
- `JMPW1` -> jump modifier +1
- `SUBS1` -> depth modifier +1
- `SUBW-1` -> depth modifier -1

The ability string is parsed for the trailing number. **But only when a target is
selected from the roster.** For manual/off-roster targets, the stepper stays at 0
and the user enters it manually. This auto-fill is a **v2 feature** — for v1, the
stepper is manual-only at 0, matching current behavior. The visual design (label +
integrated tile) is built to accommodate this future auto-fill without redesign.

### Why not chips for JMPS/JMPW?

Chips (toggle buttons for "JMPS +1", "JMPW +2", etc.) were considered. Rejected
because:

1. The modifier is a **signed integer in a range**, not a categorical choice.
   A stepper is the correct control type for bounded numeric input.
2. Chips would require pre-enumerating all possible values (-3 to +2 = 6 chips),
   which is the same as the TMM tile row — but TMM is always visible and always
   relevant, while jump/depth modifier is conditional. Repeating the tile pattern
   for a conditional field adds visual noise.
3. The integrated stepper tile (section 6) is more compact and communicates "adjustable
   number" more clearly than a row of identical-looking tiles.

### Why not auto-derive from unit data always (no stepper)?

If a target picker exists and the unit has `JMPS2`, we *could* auto-apply +2 and
hide the stepper entirely. Rejected because:

1. The user may want to override (the unit might have taken MP crits that reduce
   jump capability — a situational state the card does not track).
2. The stepper provides a visible audit trail — the user sees *why* the modifier
   is what it is.
3. Off-roster targets (the common case in v1) have no unit data to derive from.

**Compromise:** Auto-fill on target selection (v2), manual stepper always visible
when the mode warrants it (v1). The stepper is never hidden when its mode is active,
even if auto-filled — it just starts at the auto-filled value instead of 0.

---

## 9. Mobile (full-screen) adaptations

The current `@media (max-width: 700px)` block goes full-screen and makes the result
sticky. That is correct. Specific visual changes for mobile:

| Element | Desktop | Mobile (<700px) |
|---|---|---|
| Dialog | max-width 480px, centered, rounded corners | full-screen, no radius, no border |
| Header | 48px, --accent top border | 56px, --accent top border (taller for thumb reach) |
| Close button | 44px, right-aligned | 48px, right-aligned |
| Step cards | 16px padding, 8px radius | 16px padding, 0 radius (full-width) |
| Target mode grid | 3x2 | 2x3 (narrower tiles, taller) |
| TMM tiles | 52x52px | 48x48px (6 across still fits at 360px: 6x48 + 5x8 gap = 328px) |
| Stepper buttons | 56x56px | 56x56px (unchanged — these are primary controls) |
| Result card | inline, normal flow | sticky bottom, --panel background, top border --accent |
| Body scroll | dialog scrolls | dialog scrolls, result stays pinned |

The sticky result on mobile uses a `position: sticky; bottom: 0` on the R card
(current behavior, preserved). On desktop, the result card is in normal flow.

---

## 10. CSS token additions

No new color tokens needed — the existing palette is sufficient. Proposed new
spacing/size tokens for consistency:

```css
:root {
  /* existing tokens unchanged */

  /* SATOR spacing rhythm (8px base) */
  --sator-gap: 12px;        /* between step cards */
  --sator-pad: 16px;        /* card internal padding */
  --sator-radius: 8px;     /* card + tile border-radius */

  /* SATOR tap-target sizes */
  --sator-tile-h: 56px;     /* standard tile min-height */
  --sator-tile-num: 52px;   /* number tile (TMM) size */
  --sator-step-h: 56px;     /* stepper button size */
}
```

Using tokens means the entire spacing system can be tuned in one place and stays
consistent across all five step cards.

---

## 11. Implementation impact summary

| File | Change |
|---|---|
| `site/js/dialog.js` | Replace `<select>` with button-grid for target mode; replace stepper `<input>` with read-only `<div>` + hidden input; add `aria-pressed` toggling on all tiles; add conditional-reveal class toggle (not `hidden`); add mode-aware label text for jump/submersible stepper |
| `site/styles.css` | Rewrite `.sator-section-row` to `.sator-step-card` (card styling, badge, header); add `.sator-tile` base + variants; add `.sator-tile[aria-pressed]` selected state with corner dot; add `.sator-conditional` slide animation; enlarge result typography (48px TN, 14px breakdown); add spacing tokens; update `@media` block for mobile grid changes |
| `site/js/sator.js` | No logic changes needed — the visual redesign is presentation-only. `targetMoveMod()`, `attackerMoveMod()`, `targetUsesTmm()` all work as-is. |
| `site/index.html` | No changes (dialog is JS-generated) |

---

## 12. What this does NOT change

- The formula and all modifier logic (`sator.js`).
- The dialog mechanism (plain div overlay, not native `<dialog>` — JSDOM constraint
  stands).
- The live-recompute behavior (no Calculate button).
- The ephemeral/no-persistence model.
- The `ensureSatorDialog` idempotency pattern.
- The close/dismissal behavior (Esc, backdrop, focus return).
- The "To-Hit" button on the card (placement and disabled-state logic).

This is a **visual layer redesign** only. The JS restructure is mechanical: swap
widget types, add classes, wire `aria-pressed`. No architectural decisions change.
