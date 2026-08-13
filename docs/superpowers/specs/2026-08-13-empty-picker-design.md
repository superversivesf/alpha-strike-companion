# Empty-State Unit Picker — Design Spec

Date: 2026-08-13
Status: Draft (awaiting user review)

## Purpose

Change the unit picker so the list of units is **empty on page load** and
whenever the user has no active search or filter. The list populates only
once the user types in the search box or selects a non-default filter.
While empty, the picker shows a hint message explaining how to browse units.

## Current Behavior

`site/js/app.js` `renderPicker()` (line ~246) renders **all** units into
`#picker-list` on page load and after every search/filter change:

1. Reads `#search` value and the 5 filter selects (`type`, `era`, `side`,
   `role`, `size`).
2. Calls `filterUnits()` (site/js/search.js) with those values.
3. Appends one `<li><button>` per match.

`init()` calls `renderPicker()` once at the end of setup (app.js:383), after
`units.json` fetch resolves and filter selects are populated. Search input is
debounced (120ms); filter `change` events render synchronously. The picker
collapse toggle (`#picker-toggle`) hides only `.picker-list` via
`.picker.collapsed .picker-list { display: none; }`.

## Desired Behavior

- **Default state** (query empty/whitespace AND all 5 filters at their
  default `""` value): `#picker-list` contains a single hint `<li>`,
  no unit buttons.
- **Active state** (non-default query or filter): list shows matching units,
  exactly as today.
- **No-match state** (active query/filter but zero results): list shows a
  distinct "no units" message — visually different from the hint.
- Reverting filters to `"All …"` or clearing the search returns the hint.

### Messages

| State | Message |
|---|---|
| Default (no query, no filter) | `Start typing or select a filter to browse units.` |
| Active, zero matches | `No units found.` |

Wording is deliberately generic ("No units found.") rather than
search-specific: the no-match state can be triggered by filters alone
(e.g. side=Clan + era=Age of War with no results), where "your search"
would be misleading.

## Implementation

### 1. Guard at top of `renderPicker()` (app.js)

```js
const q = query.trim();
const isDefault = !q && !type && !era && !side && !role && !size;
if (isDefault) {
  list.innerHTML = "";
  const hint = document.createElement("li");
  hint.className = "picker-hint";
  hint.textContent = "Start typing or select a filter to browse units.";
  list.append(hint);
  return;
}
```

**The trim is load-bearing.** `!" "` is `false`, so without `trim()` a
whitespace-only query would bypass the guard and run `filterUnits()`, which
itself trims and would show the full catalog — a regression from the
intended behavior.

### 2. No-match branch

After filtering, if `matches.length === 0`, render one
`<li class="picker-empty">` with `No units found.` instead of the
existing empty `<ul>`. Visual style must be distinct from the hint
(e.g. non-italic, normal text color).

### 3. Hint semantics

- Hint `<li>` is plain text — **not focusable** (no `<button>`, `<a>`,
  `tabindex`). It is informational, not interactive.
- No `role="status"` / `aria-live` on the hint. A live region on the idle
  hint would announce on every keystroke that crosses a state boundary
  (idle → results → idle → no-match), producing screen-reader chatter.
  Screen readers announce the list normally.
- No programmatic focus shifts when the list appears/disappears; natural
  tab order handles it. Shifting focus while the user is typing would be
  disruptive (WCAG 2.4.3 focus order).
- Hint lives **inside** `#picker-list`, not as a sibling: the existing
  collapse CSS hides it automatically when the picker is toggled, and the
  hint scrolls with the list (`.picker-list` has `max-height: 200px`).

### 4. CSS (site/styles.css)

One new rule. Required because `.picker-list li` has no rule today — the
hint would otherwise show a default disc bullet and default padding:

```css
.picker-hint {
  color: var(--muted);
  font-style: italic;
  list-style: none;
  padding: 8px;
}
```

Optionally also style `.picker-empty` (distinct color, `list-style: none`,
padding) so the no-match message reads differently from the hint.

### 5. No other changes

- **No HTML changes** in `index.html`. A static hint element would be
  visible before JS runs and would not respect the collapse toggle.
- **No changes** to `search.js` (`filterUnits` is untouched; `search.test.js`
  unaffected).
- **No changes** to import (`btn-import`) or clear-force (`btn-clear`)
  handlers — neither calls `renderPicker()`, and the picker state
  (hint vs results) correctly persists across both.
- **No `clearTimeout(searchTimer)` in `renderPicker`** — the timer is scoped
  to `init()`, and the existing per-input `clearTimeout` already prevents
  stale renders.

## Edge Cases (verified by review)

| Scenario | Behavior |
|---|---|
| Debounce window (120ms) | Hint persists until timer fires; results then appear. No empty flash frame. |
| Filter change, filter revert to "All…" | Synchronous render; revert triggers guard → hint. No flash. |
| Whitespace-only query | Treated as default → hint (via `trim()`). |
| Collapse picker, then clear search | `renderPicker` runs on hidden list; expand shows hint, no stale results. |
| Collapse picker with hint | Hint hidden with list; expand restores it. |
| Focus inside list, then clear search | List re-renders; focus drops to `<body>` (browser default). Pre-existing pattern, acceptable — no focus-restore hack. |
| No-match via filters only | "No units found." (generic wording covers this). |
| Small screens | Hint is a single line inside the list; no overflow (`max-height: 240px` mobile). |

## Testing

Current suite: `npm test` (runs `tests/app.test.js`, `journey.test.js`,
`search.test.js`, `site-structure.test.js`). All pass today.

Changes required:

**tests/app.test.js**
- L60 `"init loads units, populates filters and picker"`: assertions expecting
  3 populated `<li>` must be rewritten to expect the hint `<li>` (1 item,
  hint text) and, for the populated-list assertions, a search dispatch first.
- L130, L143, L153, L167, L180, L192: tests that click
  `#picker-list li button` immediately after boot need a search/filter step
  prepended (6 callsites).
- Suggested helper:
  ```js
  function showSomeUnits(doc, win) {
    const s = doc.getElementById("search");
    s.value = "a";
    s.dispatchEvent(new win.Event("input", { bubbles: true }));
  }
  ```
  followed by `await settle()` — one line per callsite.

**tests/journey.test.js**
- L129-130 `"JOURNEY: units auto-group into Lances (IS) and Stars (Clan)"`:
  two pre-search clicks need a search step.
- L179 `"JOURNEY: group names are fixed at creation and stable"`: 5-click
  loop needs a search step.
- L240 `"JOURNEY: search and type-filter interaction"`: final assertion
  `#picker-list li` length === 3 after clearing search must expect the hint
  (length 1).

**tests/search.test.js** — unaffected (`filterUnits` unchanged).
**tests/site-structure.test.js** — unaffected (no HTML changes).

## Out of Scope (explicitly rejected in review)

- "Clear filters" button on the no-match message (feature creep; filters are
  already reset via the selects).
- `aria-live` region or `role="status"` announcements.
- Per-user preference to always show the full list (localStorage flag).
  Ship the change; add a flag only if users complain.
- Moving `searchTimer` to module scope for `clearTimeout` in `renderPicker`.
- Static hint element in `index.html`.
- `renderPicker()` call in the import handler.
