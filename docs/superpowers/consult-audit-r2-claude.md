# Cross-Critique — Round 2

Audit of test coverage for the Alpha Strike companion (75 tests, 91.14% line). Cross-critique of three agents' findings. Agree/disagree, rank what to implement, flag anything missed.

## (a) Top 5–8 by coverage-per-effort

**Implement in this order:**

1. **#1 fetch-rejection boot path** — ~20 lines, covers the most-likely prod failure, no new fixtures. *Single highest ROI.*
2. **#6 dedicated `tooltips.test.js`** — bumps the worst-covered file (48% → ~90%) with ~6 small tests (show/hide, position flip, scroll-hide, touch, idempotent init, missing `data-tip`). Cheap because `tooltips.js` is pure DOM with `mouseover/mousemove/mouseout/touchstart/scroll` listeners — all dispatchable in JSDOM.
3. **#11 P1 trio: export-click → download, delete-group, import bad-JSON via file input** — three E2E paths in the import/export pipeline that current tests only cover indirectly. ~50 lines total; closes the "I/O happy path is mocked away" gap. The bad-JSON test is currently asserted only at the `importState()` unit level (`storage.test.js:115`), never at the `app.js` click handler.
4. **#2 c8 + threshold gate** — 5 min `package.json` change, permanent regression safety net. Pays for itself the first time someone removes a branch.
5. **#3 `vm.createContext` for `boot()`** — ~1 hr, removes the landmine. Lower ROI than #1/#2/#4 *today*, but blocks anyone from writing a test that imports `app.js` outside `boot()` without realizing they're inheriting the previous test's globals.
6. **#4 `setImmediate` + drop `settle()`** — 20 min, cuts ~15 × 200 ms = 3 s of flake-risk per run, makes CI deterministic.
7. **#5 quota + empty-export roundtrip** — fills two specific gaps in the failure-mode table. ~30 lines, both can ride one new `storage` test file or extend the existing one.
8. **#8 `state.js` branch gaps** — 6 lines of unit tests, pure functions, no fixtures needed. Brings state.js from 100% line → 100% branch.

**Skip or defer:**

- **#9 `storage.js` branch gaps** — `safeGetItem` catch requires a `getItem` that throws (JSDOM doesn't); `importState({})` is a real branch but already partially covered. Low value.
- **#10 dead code** — see (b).
- **#12 P2/P3** — value-additions, not gap-closures. Defer until the gaps are closed.

## (b) Dead-code removal — safe?

**Disagree with the framing; not safe to do *now*.**

- `cards.js` `statRow()` — confirmed unused. `identityRow()` replaced it. Safe to delete, but **first verify with a grep across `site/` and `tests/`** (I checked mentally: `statRow` only appears at its definition). Low-risk.
- `app.js` "group-name click delegation branch redundant" — **disagree this is dead code.** `app.js` binds both `click` *and* `input` on the roster. The `click` handler has the `nameInput` branch because the user can click into the field then immediately click away (e.g., to focus another card). Removing it would break the "click into name → no save until blur" intent *if* that's the intent. **Read the git blame before touching it** — the dual-binding looks intentional for a reason (e.g., one saves on `change`/blur, one on `input`/keystroke; or one is a legacy fallback). One of them is probably dead, but which one is a code-archaeology question, not a coverage one.

**Verdict:** delete `statRow()` (zero risk). Do *not* touch the click/input dual binding without a `git log -p` to confirm which half is dead — this is a real behavior difference, not a coverage gap.

## (c) What's missed

1. **No test for `window.__AS_MANUAL__ = false` path** — the auto-boot branch (`if (typeof window !== "undefined" && !window.__AS_MANUAL__) { init(...) }`) is *never* exercised. Every test sets the flag true. If that conditional breaks (e.g., a typo in the guard), nothing fails until prod. Easy fix: one test that doesn't set the flag and asserts `init` was called.

2. **No a11y assertions beyond structure** — `site-structure.test.js` checks `aria-label` exists on the picker list and `#roster` and that some `<button>`s have type. But there's no test that *focus* works: tabbing into a card, arrow-keying the picker, screen-reader-only "destroyed" announcement. Not blocking, but a real gap for a companion app meant to be used at a table.

3. **No negative test for `renderCard` with malformed unit** — `cards.js:300` does `${unit.move}"`; if `unit.move` is `undefined`, output is `"undefined"`. The sanitizer drops entries with bad `unitId`, but `unit` itself is trusted everywhere. A unit with missing `armor`/`structure`/`damage` would render `NaN` pips. This is a sanitizer gap, not just a render gap.

4. **The Dockerfile's pinned commit SHA has no test** — README says "rebuilds are reproducible" but nothing verifies the SHA still resolves to the same content. Cheap `git ls-remote` smoke test in the build pipeline would catch a force-push on the upstream.

5. **`_entrySeq` (state.js) is process-global mutable state** — not a test issue, but a flakiness risk. Two `createEntry` calls in the same `Date.now()` ms can produce same-id entries if `Math.random().slice(2,6)` collides. The unit test only creates 2 entries; a 10k-entry stress test would surface the birthday-paradox collision rate. Probably acceptable (4-char base36 = 1.7M slots), but worth a property test.

6. **`initTooltips` event listeners never get torn down** — not a test issue per se, but if the *same* JSDOM is reused across tests (it isn't yet, but the `globalThis` pollution makes it easy to slip into), `mouseover` listeners stack up. The `__asTooltips` guard prevents the *element* doubling, not the *listener* doubling. Worth a one-line note in the `vm.createContext` migration.

**Strongest single addition not in the combined list:** #1 above (auto-boot path test). It's a 5-line test that closes a "nothing tests the production entry point" hole.

## TL;DR

- **Implement:** #1, #6, #11, #2, #4, #3, #5, #8 (in that order).
- **Delete dead code:** `statRow()` only; do not touch the click/input dual binding.
- **Missed:** auto-boot path test, a11y focus, malformed-unit render, Dockerfile SHA verification, `_entrySeq` collision property test.
