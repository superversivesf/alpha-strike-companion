# Consult Report — Test Coverage Audit (2026-08-13)

**Grid:** pi (kimi-k2.6:cloud) · codex (glm-5.2:cloud) · claude (minimax-m3:cloud)
**Task:** Audit test coverage + E2E tests for completeness.
**Baseline:** 75 tests, 91.14% line / 88.41% branch / 84.75% funcs. app.js 84.73%, cards.js 97.30%, state.js 100%, storage.js 97.32%, search.js 100%, tooltips.js 48.44%.
**Rounds:** 2 (independent audit → combined-findings critique). All findings verified against the repo.

## Verdict

Coverage is strong on pure logic (state/search 100%) but weak on **app.js handlers** (error paths, import/export, delete-group) and **tooltips.js** (48%, zero direct tests). The E2E suite covers the main game-night flow well but misses the I/O pipeline (export download, import failures, delete-group → ungrouped).

## Implement in this order (merged, coverage-per-effort)

| # | Item | Effort | Value |
|---|---|---|---|
| 1 | **tooltips.test.js** — show/hide, position flip, scroll-hide, touch, idempotent init, missing data-tip | Medium | 48% → ~95% on a real UX file |
| 2 | **fetch-rejection boot banner** — init error path, most likely prod failure | ~20 lines | Covers app.js 399-419 |
| 3 | **P1 trio (E2E):** export-click → download; delete-group → ungrouped render; import bad-JSON/missing-roster via file input (no clobber) | ~50 lines | Covers app.js 311-320, 361-370, 389-390 |
| 4 | **app.js unit gaps:** persist catch (saveState throws), groupLabel Group fallback, units.json missing array, storage fallback, import catch | ~6 tests | Covers 30-32, 38, 202-209 |
| 5 | **state.js branch gaps:** toggleCrit OOB, createEntry skill fallback, isGroupValid non-string ids, isEntryValid negative skill, damageArmor re-click clear | 6 lines | 100% line → ~100% branch |
| 6 | **storage.js:** safeGetItem catch, loadState access-throw, sanitizeState group dedupe, importState({}) | 4 tests | Covers 16-17, 25-26 |
| 7 | **c8 + threshold gate** | 5 min | Permanent regression safety net |
| 8 | **settle() → setImmediate** | 20 min | Cuts ~3s flake-risk per run |
| 9 | **auto-boot path test** (`__AS_MANUAL__` unset) | 5 lines | Closes "nothing tests the production entry point" hole |
| 10 | **MAX_IMPORT_BYTES boundary** (exactly 5MB, just-over) | 1 assertion | Off-by-one guard |
| 11 | **btn-import → import-file.click() shim** | 1 test | Trivial |
| 12 | **createEntry id uniqueness under rapid deploy** | 1 assertion | Collision guard |

## Dead code — remove now (pi + codex agree; claude partial)

- **`cards.js` statRow()** — zero call sites, `identityRow` superseded it. **Delete.**
- **`app.js` group-name click delegation branch** — redundant with the input handler that persists on every keystroke. **Delete** (pi + codex agree; claude cautions to check git blame first — the input handler at app.js:341-346 persists on every keystroke, so the click branch is a no-op re-persist).
- **`app.js` `_groupCounter`** — written at init, never read (pi round-2 miss). **Delete.**

## Deferred (agreed by ≥2 agents)

- **globalThis pollution → vm.createContext** — real landmine but 1hr; do after gaps closed.
- **P2/P3 journey extensions** (aerospace crits via delegation, DESTROYED stamp journey, group persistence refresh, import preserves groups, skill-in-journey, heat-absence-on-CV, collapse+deploy, filter-only deploy, no-match recover) — value-additions, not gap-closures.
- **Duplicate test name in cards.test.js** — hygiene, cheap, do with #8.
- **Order-locked deepEqual assertions** — refactor-resilience, defer.
- **Empty-export roundtrip** — low value.
- **Dockerfile SHA verification, a11y focus tests, malformed-unit render, _entrySeq property test** — claude-only, out of scope.

## Disagreements resolved

- **Delete-group E2E** — all three agree it's the strongest P1 (only path producing the ungrouped section; pi adds: ungrouped render branch is currently unhit).
- **Import bad-JSON E2E** — all agree; codex adds: assert alert text, state unchanged, `import-file.value === ""`.
- **Export E2E** — pi cautions "mock-fest" in JSDOM but agrees it's worth it (core share-out mechanism).
- **c8 gate** — claude strong yes; codex "nice, not blocking"; pi silent. Implement (cheap).
- **settle() → setImmediate** — all three agree.

## Implementer checklist

1. Delete dead code: `statRow()`, group-name click branch, `_groupCounter`.
2. Write `tests/tooltips.test.js` (6 tests).
3. Add app.js unit tests: persist catch, groupLabel, missing units array, storage fallback, import catch.
4. Add state.js branch tests (5).
5. Add storage.js tests (4).
6. Add E2E: export download, delete-group → ungrouped, import malformed no-clobber.
7. Add: fetch-rejection banner, auto-boot path, MAX_IMPORT_BYTES boundary, btn-import shim, entry-id uniqueness.
8. settle() → setImmediate; fix duplicate test name.
9. Add c8 + threshold gate to package.json.
10. `npm test` + coverage — expect ≥95% line.
