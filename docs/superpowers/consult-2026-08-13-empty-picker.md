# Consult Report — Empty-State Unit Picker (2026-08-13)

**Grid:** pi (kimi-k2.6:cloud) · codex (glm-5.2:cloud) · claude (minimax-m3:cloud)
**Task:** Cross-check `docs/superpowers/specs/2026-08-13-empty-picker-design.md` + `docs/superpowers/plans/2026-08-13-empty-picker.md` before implementation.
**Rounds:** 2 (independent review → combined-findings critique). All findings verified against the actual repo by the orchestrator.

## Verdict

Design is sound and well-scoped. **Two must-fix defects** in the plan would break the build if followed verbatim; several doc claims are false; a handful of cheap test gaps should be closed. None block the feature.

---

## Must-fix before implementation

### M1. Plan Task 2 snippet re-declares `const list` → SyntaxError (pi, unanimous)
Plan says: replace `list.innerHTML = "";` … `const matches = ...` with a block that starts `const list = el("picker-list");`. But `renderPicker()` (app.js:102) already declares `const list` at line 109. Verbatim application → `SyntaxError: Identifier 'list' has already been declared`.
**Fix:** replace from `const list = el("picker-list");` (3 lines) keeping `const list` inside the block — or keep the snippet but start the edit at `list.innerHTML = "";` and drop `const list` from the snippet.

### M2. Spec/plan claim a 120ms debounce that does not exist (pi, codex, claude — unanimous)
Spec "Current Behavior" and plan "Global Constraints" reference `searchTimer`, `clearTimeout`, and a 120ms debounce window. Reality: `app.js:220` binds `el("search").addEventListener("input", renderPicker)` directly — synchronous, no timer anywhere in the file.
**Fix:** delete all `searchTimer`/debounce references from spec + plan (including the "do not move searchTimer" constraint and the edge-case table's debounce row). The `await settle()` waits in the new tests are dead time, not debounce waits.

---

## Doc corrections (non-blocking)

### D1. "Search 'a' matches all three UNITS" is wrong (pi, codex, claude)
`filterUnits` matches `${class} ${variant}` lowercased; "trooper tp-1r" has no `a`. "a" matches ATLAS AS7-D + AS7-K only (2 of 3). Harmless today (tests click the first button = AS7-D) but the plan's claim is false and would mislead a future author.
**Fix:** correct the claim; optionally search "ATLAS" in `showSomeUnits()` to decouple from fixture sort order (claude V5/V6).

### D2. Spec CSS ≠ plan CSS (claude V2, pi round-2)
Spec §4: bare `.picker-hint { … padding: 8px; }`. Plan Task 3: `.picker-list li.picker-hint, .picker-list li.picker-empty { … flex-basis: 100%; … }`. The plan's is correct — `.picker-list` is `display: flex; flex-wrap: wrap` (styles.css:140), so without `flex-basis: 100%` the hint renders inline with buttons. The spec's bare rule is broken as written.
**Fix:** update the spec to match the plan (or delete the spec's CSS block; plan owns it).

### D3. Line numbers stale (pi, claude V4)
Spec says `renderPicker` ~line 246, `init` end ~383. Reality: 102 / 364. Harmless if the implementer searches, not goes-to-line.

### D4. `tests/site-structure.test.js` not yet updated (pi #5, codex round-2 #3)
Plan Task 3 claims a `.picker-hint` CSS assertion is added there; it is not (verified: no `picker-hint`/`picker-empty` in the file). Sequencing risk: if Task 2 ships without Task 3, the hint renders with a default disc bullet and all tests stay green.
**Fix:** land Task 2 + Task 3 in one commit, or add the site-structure assertion in Task 1 so missing CSS is red from the start.

---

## Test gaps — add (codex GAPs, refined by round-2)

| Gap | Test | Round-2 verdict |
|---|---|---|
| GAP-A | no-match via **filters only** (side=Clan + era=Age of War) → `picker-empty` | **Add** — flagship rationale for generic wording (pi, codex, claude agree) |
| GAP-B | filter revert to All → hint | **Skip** — same guard branch as clear-search; covered (pi, claude) |
| GAP-C | collapse + clear + expand → hint | **Skip** — pure CSS toggle, no logic (pi, claude) |
| GAP-D | hint non-interactive (no `button`/`tabindex`) | **Add** — one-line assertion in existing hint tests (all three) |
| GAP-E | `.picker-empty` CSS rule present | **Skip** — regex `/\.picker-hint\s*\{/` matches both rule starts (claude) |
| GAP-F | whitespace query + active filter | **Skip** — same code path as normal filter (pi, claude) |

**Plus (codex round-2):** symmetric no-button assertion in the no-match test; exact-string assertions (`assert.equal(textContent, "No units found.")` and full hint copy) instead of partial regexes — the plan pins exact copy but the tests don't enforce it.

## `showSomeUnits()` — drop `await settle()` (claude V3, pi, codex)
Render is synchronous; the 200ms wait × 7 callsites ≈ 1.4s dead time. Journey tests already dispatch-then-assert without settling, so the suite is committed to synchronous render. Drop it (optionally with a comment: "if a debounce is added, restore settle()"). Keep the wait in the new no-match/whitespace tests only if a debounce is ever introduced — better: fix the spec (M2) so nobody adds one.

## Accessibility — one real gap (claude round-2, missed by pi and codex)
`<ul id="picker-list">` (index.html:56) has no accessible name; the section has `aria-label="Unit picker"` but the list itself is announced as "list, 1 item" with no context. **Fix:** `aria-label="Available units"` on the `<ul>` — one static HTML attribute, zero JS. (Note: the spec's "no HTML changes" constraint would need this one-line exception.)

## Agreed scope calls (no action)
- No "clear filters" button on no-match — acceptable (claude 2.1, all agree).
- No `aria-live`/`role="status"` — correct (claude 1.2).
- No localStorage preference — correct (claude 3.1).
- Search placeholder redundancy with hint — cosmetic, no action (claude 2.3).

---

## Implementer checklist (merged, priority order)

1. Fix M1 (const list) and M2 (debounce claims) in the plan/spec.
2. Apply D1–D4 doc corrections.
3. Add GAP-A, GAP-D (+ no-match symmetric), exact-copy assertions.
4. Drop `await settle()` from `showSomeUnits()`.
5. Add `aria-label="Available units"` to `<ul id="picker-list">`.
6. Land Task 2 (guard) + Task 3 (CSS) in one commit; add site-structure assertion.
7. `npm test` — expect 4 red → all green.
