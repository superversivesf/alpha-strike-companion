# E2E / Journey Coverage Audit — Alpha Strike Companion

Scope: the 4 `journey.test.js` tests + `app.test.js` integration tests, audited against real user flows in `app.js`/`cards.js`/`storage.js`/`state.js`. Unit-level coverage noted from `cards.test.js`, `state.test.js`, `storage.test.js`.

Priority key: **P1** = real user flow, zero E2E coverage, data-loss or silent-failure risk. **P2** = real flow, unit-covered but never wired through init→render→persist. **P3** = nice-to-have, marginal delta over existing tests.

---

## P1 — Export download button (UI flow never exercised)

- **Flow:** user clicks `#btn-export` → `app.js` builds a `Blob`, creates an `<a download>`, calls `a.click()`, revokes URL.
- **(a) Unit coverage?** `storage.test.js:103` checks `exportBlob` shape only. The `app.js` click handler (blob creation, anchor `click()`, `URL.revokeObjectURL` timeout) is **not tested anywhere**. Journey test 1 calls `storage.exportBlob()` directly, bypassing the button.
- **(b) Journey test:** "Export downloads a JSON file" — populate roster, click `#btn-export`, assert a download anchor was created/clicked (stub `URL.createObjectURL` + capture `_doc.createElement(a)` clicks), assert filename = `as-companion-state.json` and text round-trips through `importState`.
- **(c) Priority: P1.** This is the primary share-out mechanism; a regression in the handler (e.g. `exportBlob` guard returning early, broken Blob in JSDOM) would be invisible to the suite.

---

## P1 — Delete-group button (orphaning / ungrouped render)

- **Flow:** user clicks `.group-delete` → `app.js` removes the group from `_state.groups` but **keeps the roster entries**, which then render under the `ungrouped` section (`renderGroupSection(null, …)`).
- **(a) Unit coverage?** No. `app.test.js` only tests *indirect* group deletion (removing the last unit empties a group). The `.group-delete` click handler and the ungrouped render path are **untested entirely**.
- **(b) Journey test:** "Delete group keeps its units as ungrouped" — deploy 3 IS mechs (one Lance), click the Lance's `.group-delete`, assert: groups count = 0, `#roster .group[data-group-id=ungrouped]` exists with 3 cards, force-pv unchanged, persisted `groups` = `[]` but `roster.length` = 3.
- **(c) Priority: P1.** This is the only path that produces the `ungrouped` section in normal use; if it breaks, units silently vanish from the roster view (data still in state, UI wrong).

---

## P1 — Import failure paths through the file input (bad JSON, missing roster)

- **Flow:** user picks a bad file → `importState` throws → `app.js` catches and `window.alert("Import failed: …")`; oversized file → early alert + no parse.
- **(a) Unit coverage?** Partial. `storage.test.js:111-112` asserts `importState` throws `/parse/i` and `/roster/`. `app.test.js` covers the **oversized** path end-to-end. But the **bad-JSON** and **missing-roster** paths through the `#import-file` change handler (alert text, state unchanged, `e.target.value` reset) are **not** tested E2E.
- **(b) Journey test:** "Import rejects malformed files without clobbering state" — deploy 1 unit, then feed: (1) `"not json"`, (2) `"null"`, (3) `{"roster":"nope"}`. After each: assert alert was called, roster card count unchanged (still 1), `import-file.value === ""`. One combined test, three sub-asserts.
- **(c) Priority: P1.** Users *will* hand-edit exports; silent acceptance of a half-parsed state (the `if (!Array.isArray(_state.groups))` guard masks roster corruption only partially) is the highest data-integrity risk in the import path.


---

## P2 — localStorage corruption recovery on boot

- **Flow:** stored `as-companion-state-v1` is malformed or references deleted units → `loadStateSafe`/`sanitizeState` must return a usable state, not throw.
- **(a) Unit coverage?** `storage.test.js:30` covers `loadState` on `"{not json"`. `sanitizeState` orphan-dropping is covered (`storage.test.js`). But the **full boot path** (`init` → `_storage.loadState()` → `renderRoster`) with a poisoned `localStorage` is **not** tested; `boot()` in journey.test injects a clean `ls`.
- **(b) Journey test:** "App boots gracefully from corrupted localStorage" — seed `ls` with `{not json` and with a roster entry whose `unitId` is unknown, call `boot(ls)`, assert no throw, `#roster .card` count = 0, `force-pv` = "Force PV: 0", picker still populated (filters non-empty).
- **(c) Priority: P2.** Unit coverage is strong; the E2E delta is small but verifies the `makeStorage` wiring in `init` actually uses the safe loader.

---

## P2 — Aerospace unit crits through the roster delegation

- **Flow:** deploy an AF/CF/DS, click `thruster`/`fuel`/`crew` crit slots → `toggleCrit` respects `AEROSPACE_CRIT_CAPS` (thruster 1, fuel 1, crew 2).
- **(a) Unit coverage?** `cards.test.js:142-144` asserts the crit-slot counts render; `state.test.js:105-112` asserts `critCap`/`critTypesForUnit` for AF. But **no test** routes a click on an aerospace crit slot through `app.js`'s roster click delegation → `toggleCrit` → persist.
- **(b) Journey test:** "Aerospace crits mark and persist distinctly from ground" — add an AF unit to `UNITS`, deploy, click `thruster[0]` (cap 1 — second click should *unmark*, not advance), click `crew[0]` then `crew[1]` (cap 2), assert filled counts, assert ground unit in same roster still shows only `engine/fireControl/mp/weapons` rows. Refresh via `boot(ls)` and assert aerospace crits survived.
- **(c) Priority: P2.** Logic is unit-covered; the gap is the delegation wiring for crit types that only aerospace units expose.

---

## P2 — DESTROYED stamp appears in a journey

- **Flow:** damage all armor + all structure → `renderCard` appends `.destroyed-stamp`.
- **(a) Unit coverage?** `cards.test.js:163-166` covers the stamp directly. Journey test 1 damages Atlas 6/10 armor, 2/8 struct — **not** destroyed, so no journey ever crosses the threshold.
- **(b) Journey test:** extend "full game night" — after the existing damage steps, finish off the Atlas (click remaining armor pips + structure pips), assert `.destroyed-stamp` text = "DESTROYED", assert force-pv drops to 44 (only Awesome remains), assert refresh preserves the stamp.
- **(c) Priority: P2.** Pure render assertion, but it's the natural climax of the existing journey and currently stops one step short.

---

## P2 — Group persistence across refresh

- **Flow:** create groups → refresh → groups re-render with names/sizes/counts.
- **(a) Unit coverage?** Journey test 2 asserts `saved.groups` via raw `localStorage` parse, but never re-boots to confirm `renderRoster` rebuilds group sections from persisted state. Journey test 1's refresh asserts cards/crits but **not** `#roster .group` count or `.group-tab` labels.
- **(b) Journey test:** append to test 2 — after renaming the Star, `boot(ls)` again, assert 2 `#roster .group` sections, tabs "Wolf Alpha" (or "Star 1") and "Lance 1", counts `2/5` and `1/4`.
- **(c) Priority: P2.** The render path for persisted groups is the untested seam; `loadStateSafe` keeping groups is unit-covered.

---

## P2 — Import preserves groups

- **Flow:** export a roster with groups → import → groups reappear.
- **(a) Unit coverage?** `sanitizeState` keeps valid groups (`storage.test.js`). `app.test.js` import test uses a roster **without** groups. No E2E test imports a state containing groups.
- **(b) Journey test:** "Export-with-groups round-trips through import" — build a Star + Lance (reuse test 2 setup), export via `storage.exportBlob`, `boot` fresh profile, feed JSON through `#import-file`, assert both group sections render with correct tabs/counts. (Combines naturally with the P1 export-button test.)
- **(c) Priority: P2.** The import handler's `_state = _storage.importState(text)` followed by `renderRoster` is the untested wiring for the grouped case.


## P3 — Skill setting inside a damage journey

- **(a) Unit coverage?** `app.test.js` "set-skill fixes the skill and persists" fully covers the handler. Journey test 1 never sets skill.
- **(b) Journey test:** in "full game night", set the Atlas to skill 3 before damaging it, assert `.skill-value` shows 3 and persists across refresh.
- **(c) Priority: P3.** No new code path; only verifies ordering (skill-set removes the select).

## P3 — Heat on non-tracking units (UI absence)

- **(a) Unit coverage?** `cards.test.js:130-133` asserts a `CV` unit renders 0 `.heat-btn`. Journey `UNITS` includes the Demolisher (CV) but never deploys it.
- **(b) Journey test:** deploy the Demolisher alongside the Atlas, assert its card has no `.heat-btn` while the Atlas does.
- **(c) Priority: P3.** Already pinned at unit level.

## P3 — Picker collapse + deploy ordering

- **(a) Unit coverage?** `app.test.js` "picker toggle collapses the list" covers the toggle. No journey collapses the picker *then* deploys (verifying collapse doesn't break the roster click delegation, which is on `#roster` anyway).
- **(b) Journey test:** collapse picker, deploy via search, assert card renders.
- **(c) Priority: P3.** Delegation target is `#roster`, so collapse is orthogonal; low delta.

## P3 — Filter-only browsing (no search term) then deploy

- **(a) Unit coverage?** `app.test.js` covers filter-only listing and no-match. Journey test 4 always pairs search with filter.
- **(b) Journey test:** set `#type-filter=CV` with empty search, deploy the Demolisher.
- **(c) Priority: P3.** `renderPicker` path is identical with/without a query once `isDefault` is false.

## P3 — No-match → recover

- **(a) Unit coverage?** `app.test.js` covers no-match via search and via filters. No journey asserts the picker recovers to a populated list after a no-match.
- **(b) Journey test:** search "zzz" → empty hint → clear search → type "a" → 3 items.
- **(c) Priority: P3.** Stateless render; covered by composition of existing tests.

## P3 — Group rename via the roster *click* delegation branch

- **(a) Unit coverage?** Journey test 2 exercises rename via `input`+`change` on `.group-name`. `app.js` *also* has a `.group-name` handler in the roster **click** delegation (L246) — a dead/overlapping branch not exercised.
- **(b) Journey test:** click the `.group-name` input (focus click), assert name still persists.
- **(c) Priority: P3.** The click branch is effectively a no-op duplicate of the input handler; testing it mainly documents the redundancy (candidate for removal).

---

## Summary table

| Gap | Unit-covered? | Journey exists? | Priority |
|---|---|---|---|
| Export download button | shape only | no (calls fn directly) | **P1** |
| Delete-group → ungrouped render | no | no | **P1** |
| Import: bad JSON / missing roster via file input | throws unit-tested | only oversized E2E | **P1** |
| localStorage corruption on boot | loadState unit-tested | no | P2 |
| Aerospace crits via delegation | render+cap unit-tested | no | P2 |
| DESTROYED stamp in journey | cards unit-tested | no (stops short) | P2 |
| Group persistence across refresh | sanitize unit-tested | no (only raw parse) | P2 |
| Import preserves groups | sanitize unit-tested | no (roster-only import) | P2 |
| Skill set in damage journey | yes | no | P3 |
| Heat absence on CV | yes | no | P3 |
| Picker collapse + deploy | toggle yes | no | P3 |
| Filter-only deploy | listing yes | no | P3 |
| No-match → recover | no-match yes | no | P3 |
| Group-name click delegation branch | partial | no | P3 |

**Recommended new journey tests (5):** export-download, delete-group-keeps-ungrouped, import-malformed-no-clobber, aerospace-crits-through-delegation, export+import-with-groups-roundtrip. The P2 refresh/group-persistence assertions are best added as extensions to existing tests 1 and 2 rather than new files.

