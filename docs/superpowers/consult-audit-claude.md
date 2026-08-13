# Test Audit — Alpha Strike Companion

Audit of test coverage for the Alpha Strike tabletop companion (repo `/home/jason/Repos/mul`). Vanilla JS ES modules, `node:test` + JSDOM. 75 tests pass, 91.14% line coverage (app.js 84.73%, cards.js 97.30%, state.js 100%, storage.js 97.32%, search.js 100%, tooltips.js 48.44%).

## (a) Coverage measurement

**Adequate for greenfield; not for shipping.** `node --test --experimental-test-coverage` provides line-only coverage with no branch/function granularity and HTML reporters. You have:

- Line coverage only — every `if/||/??/?:` path is opaque. The 91.14% hides e.g. the `nameInput.value` event delegation in `app.js:241-247` (one of the `groups.map` callbacks; not exercised for the click delegation path) and the `|| ""` on `group.name` in `renderGroupSection`.
- No threshold gating in `package.json` — coverage can regress silently.
- No per-file breakdown in CI output.

**Recommendation:** add `c8` (V8-native, no Babel, no transpilation overhead — same engine as your runtime) for branch coverage + a threshold gate:

```json
"test": "c8 --check-coverage --branches --lines --functions --per-file --statements 85 80 80 85 node --test tests/*.test.js"
```

c8 also surfaces uncovered *lines* on diff, which makes future review cheap. istanbul is heavier and adds a source-map round-trip you don't need for ESM.

## (b) Test-quality issues — ranked

### 🔴 High value

1. **`globalThis` pollution from `boot()` is a ticking time bomb.** `tests/app.test.js:21-25` writes `globalThis.window/document/localStorage/fetch`. `tests/journey.test.js:21-25` does the same. Tests share a worker process; the *second* boot sees the *first* test's `globalThis.fetch`. The fact that 75 tests pass is partly because each file's `boot()` reassigns everything before importing `app.js`. If any future test calls `await import("../site/js/app.js")` outside `boot()` (e.g., for a "module side-effect" test), it gets the wrong window. **Fix:** scope per-test via `vm.Context` (Node's `vm.createContext`) or pass a single `setupJSDOM()` that resets, and stop using `globalThis` — `import.meta` resolution binds to the file regardless.

2. **Duplicate test name in `cards.test.js:115-118` vs `cards.test.js:84-88`.** Same string `"renderCard adds tooltips to stats, tracks, heat, crits, abilities"`. node:test silently runs both, but if the suite ever moves to a reporter that dedupes, one vanishes. `journey.test.js` is also missing a teardown for `globalThis`, and the `boot()` helper doesn't restore it.

3. **`cards.test.js:21` `render()` accepts an unused 3rd arg.** Signature is `render(unit, entry, () => {})` but `renderCard` never sees it — dead assertion surface. Either drop or wire it.

### 🟡 Medium

4. **Tests assert implementation, not behavior, in two places:**
   - `app.test.js:43-44` `assert.deepEqual(typeOptions, ["", "BM"])` — depends on the **order** of `uniqueTypes` sort + the All-types `<option>` being pre-rendered. If you change the empty-option to come from JS, this breaks. Better: assert `""` exists and `typeOptions.includes("BM")`.
   - `cards.test.js:38` `assert.deepEqual(row1.map(...), ["TP", "SZ", "TMM", "MV"])` — order-locked. Same fix.

5. **`import "via file input" via `file.text = async () => ...` (`app.test.js:181-182`)** — overrides the method on the File instance after construction. JSDOM's `File` already implements `text()` from the Buffer; this works, but it's also a *test-only* method. Asserts the *imported cards exist* but never asserts `saveState` was called after import — partial coverage of the success path.

6. **`settle()` is a 200 ms `setTimeout` (`app.test.js:43`, `journey.test.js:50`).** Brittle on slow CI. There is no deterministic way to know a fetch/microtask drained; the current code resolves immediately because `fetch` is synchronous-ish in the mock. Replace with `await new Promise(r => setImmediate(r))` and drop the constant.

7. **`boot()` re-imports `app.js` every call** (`app.test.js:34`, `journey.test.js:35`). Node caches ESM, so this is fine — but the `window.__AS_MANUAL__` flag is set *after* the `if (typeof window !== "undefined" && !window.__AS_MANUAL__)` block is read at module-init time? Actually no — `import()` returns a promise and the guard is evaluated inside `init()`, not at import. Verify: `if (typeof window !== "undefined" && !window.__AS_MANUAL__)` runs only inside `init()` per the file — correct. But the **test name** "no-match via filters" still clicks a filter set to a value the demo data doesn't have — works because the `isDefault` check only looks at search + 5 filters. Fragile.

8. **`storage.test.js:147-153` `makeStorage loadState sanitizes hostile persisted data`** — *excellent* hostile-data test. This is the bar; the other files need the same posture (see (d)).

### 🟢 Low

9. **`app.test.js:205-213` "import rejects oversized files"** asserts `cards.length === 0` but the empty-state has `display: ""` (not `"none"`) — works only because of the `style.display = _state.roster.length ? "none" : ""` ternary on the first call when no roster exists. A more meaningful assertion: `window.alert` was called with the size message. Currently the test never stubs `window.alert` so it just no-ops.

10. **No assertions on `localStorage.setItem` calls in app tests** — only on the in-memory `saved` array from the mock storage. Means a regression that *stops* writing to localStorage wouldn't be caught in production.

## (c) Python build pipeline (18 tests)

**Strong for the parser, thin for the orchestrator.** Coverage is good on `parse_tres_lines`, `parse_abilities` (including the gnarly escaped-quote + trailing-comma case), `slugify`, and `build_record`. End-to-end `test_build_writes_units_json_and_images` is solid.

**Gaps:**

- `load_tech_lookup` has **zero tests**. The `(Class, Variant) → {tech, era}` join is the most archive-dependent step in the pipeline; if the MUL JSON shape changes (it has, per the README history), the build silently emits empty `tech`/`era` and the picker's side/era filters degrade to "all".
- `to_webp` is exercised only via end-to-end. No test for: corrupt PNG header, RGBA → RGB conversion, missing file, quality knob.
- `sanity_check` is tested only with one malformed unit. No tests for: duplicate id, missing image, two duplicate image basenames, oversized `roster` (well, that's JS), or non-`.tres` files mixed in.
- `MUL_ERA_INFO` is module-level data; the test only verifies it indirectly via `payload["eras"]` length. Pin it explicitly.
- `path_within` is tested in isolation (good) but the `test_build_rejects_symlinked_tres_outside_archive` only covers *one* path. No test for symlinked image (`Sprites/Units/foo.png` → outside dir).

**Verdict:** 18 is fine for now; the missing piece is `load_tech_lookup` and a "what if the JSON dump is missing" fallback test.

## (d) Untested failure modes — ranked by likelihood

| Rank | Failure mode | Tested? | Risk |
|------|-------------|---------|------|
| 1 | **`fetch` rejection / network down at boot** | ❌ | High — `app.js:121` `await fetch("data/units.json")` will throw to `.catch(err)` which renders a banner, but **no test covers this path**. The user sees a broken page with no diagnosis. |
| 2 | **`units.json` malformed (missing `units` array)** | ❌ | High — `app.js:124` throws to the same banner. The error message is fine but the *rendering* of the error banner is untested. |
| 3 | **`localStorage.setItem` quota exceeded** | ❌ | Medium — `app.js:42` catches and `console.error`s, leaving state in memory. User clicks "Clear force" and it's gone. No UX signal. |
| 4 | **Import of corrupt JSON** | ✅ `storage.test.js:115` | Low — covered. |
| 5 | **Import of valid JSON but missing `roster`** | ✅ covered (parse-fail path) | Low. |
| 6 | **Import of state referencing deleted units** | ✅ `sanitizeState` covered | Low. |
| 7 | **Import of state with >500 entries** | ✅ tested | Low. |
| 8 | **Export of empty roster** | ⚠️ Partial | Medium — `exportBlob` tested with `GOOD`, but not with `{roster:[], groups:[]}`. A roundtrip of empty state through `exportBlob → importState` is not asserted to preserve emptiness. |
| 9 | **Two app instances racing on the same `localStorage` key** | ❌ | Low (not a real scenario) |
| 10 | **`window.URL.createObjectURL` missing in older browsers** | ❌ | Low (covered by `browserslist` if you set one). |
| 11 | **`group-name` input event in `roster` delegation when group is "ungrouped"** | ❌ | Medium — `app.js:241` checks `gid !== "ungrouped"` but no test exercises the ungrouped rename attempt. |
| 12 | **Picker with all 5 filters + search set, then cleared one-by-one** | ❌ | Low — `renderPicker` re-runs the `isDefault` check on each clear; tested implicitly but not the transition through "no-match" → "hint". |
| 13 | **Heat button click when entry.heat is already that level (toggle off)** | ⚠️ | Medium — `state.js` `setHeat` is unit-tested, but the DOM→state roundtrip is only tested for the *set* direction, not toggle-off. The journey test doesn't re-click. |
| 14 | **`init()` called twice** (manual mode + auto mode in same page) | ❌ | Low — `tooltips.js:2` has a `__asTooltips` guard, but `app.js` does not. Two `init()` calls would double-bind listeners. |

## (e) Highest-value next test to write

**Test: `init() handles fetch rejection and renders the error banner`.** Single test, ~30 lines, covers failure mode #1 which is the most likely production failure (offline, bad CDN, file:// protocol, nginx 404). Spec:

```js
test("init shows error banner when units.json fetch fails", async () => {
  globalThis.fetch = async () => { throw new Error("network down"); };
  // ... boot
  await settle();
  const banner = document.querySelector(".load-error");
  assert.ok(banner, "error banner must be present");
  assert.match(banner.textContent, /Could not load unit data/);
});
```

Second pick: **quota-exceeded test for `saveState`**. Stub `localStorage.setItem` to throw, click a unit, assert state still in memory and the console error fires (or, better, that a UX signal exists — currently there isn't one, so the test will reveal a UX gap).

Third pick: **`load_tech_lookup` test** — write a small JSON dump, build, assert `tech`/`era` propagate to the unit record. Catches the MUL JSON shape change that broke a prior tool (per README history).

## TL;DR ranking

1. **Add c8 + threshold gate** — 30 min, prevents silent regression.
2. **Test `init()` fetch-rejection path** — 30 min, covers the most likely prod failure.
3. **Stop `globalThis` pollution; use `vm.createContext`** — 1 hr, removes the landmine under any future test that imports `app.js` outside `boot()`.
4. **Test `load_tech_lookup`** — 20 min, highest-ROI Python test.
5. **Replace order-locked `deepEqual` array assertions with `includes`-based assertions** — 1 hr, makes tests refactor-resilient.
6. **Add `localStorage.setItem` quota + empty-export roundtrip tests** — 1 hr, fills the JS failure-mode gaps.
7. **Drop the 200 ms `settle()` sleeps for `setImmediate`** — 20 min, faster + less flaky.
