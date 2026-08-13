# Empty-State Unit Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The unit picker list starts empty (hint message) and only populates after the user types or selects a filter.

**Architecture:** Add a default-state guard plus a no-match branch at the top of `renderPicker()` in `site/js/app.js`; add two CSS rules in `site/styles.css`; update existing JSDOM tests that assume a pre-populated picker.

**Tech Stack:** Vanilla JS (ES modules), CSS, Node's built-in `node:test` + JSDOM (`npm test`).

## Global Constraints

- No changes to `site/index.html` except one static a11y attribute:
  `aria-label="Available units"` on `<ul id="picker-list">` (index.html:56).
- No changes to `site/js/search.js` / `filterUnits()`.
- No changes to import (`btn-import`) or clear-force (`btn-clear`) handlers.
- Search input renders synchronously — there is **no debounce** in `app.js`
  (`el("search").addEventListener("input", renderPicker)` at app.js:220).
  Do not add one; do not add `await settle()` waits for search renders.
- Hint `<li>` is plain text — no `<button>`, no `<a>`, no `tabindex`; no `role="status"` / `aria-live`; no programmatic focus shifts. The no-match `<li>` is plain text too.
- No "Clear filters" button, no per-user preference flag, no static hint element.
- Exact copy: hint = `Start typing or select a filter to browse units.`; no-match = `No units found.`
- Test command: `npm test` (runs `node --test tests/*.test.js`).

---

### Task 1: Update tests for the empty-state behavior

**Files:**
- Modify: `tests/app.test.js`
- Modify: `tests/journey.test.js`

**Interfaces:**
- Consumes: existing `boot()`, `settle()` helpers; global `window`/`document` (set by `boot()`).
- Produces: new helper `showSomeUnits()` in `tests/app.test.js`; new test expectations asserting `li.picker-hint` and `li.picker-empty` elements — these class names are the contract Task 2 implements.

- [ ] **Step 1: Add helper + update init test in `tests/app.test.js`**

After the existing `settle()` helper (around line 59), add:

```js
function showSomeUnits() {
  const s = document.getElementById("search");
  s.value = "a";
  s.dispatchEvent(new window.Event("input", { bubbles: true }));
}
```

No `await settle()` — render is synchronous (no debounce). If a debounce is
ever added, restore `await settle()` here and at every callsite.

In the test `"init loads units, populates filters and picker"`, replace the final three lines:

```js
  const items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 3);
  assert.match(items[0].textContent, /ATLAS/);
  assert.match(items[0].textContent, /BattleMech/);
```

with:

```js
  const items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].className, /picker-hint/);
  assert.match(items[0].textContent, /Start typing or select a filter/);
```

- [ ] **Step 2: Add no-match and whitespace tests in `tests/app.test.js`**

Append after the `"search narrows picker; type filter excludes UNK"` test:

```js
test("no-match state shows a distinct message", async () => {
  const { document } = await boot();
  const input = document.getElementById("search");
  input.value = "zzz-no-such-unit";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  const items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].className, /picker-empty/);
  assert.equal(items[0].textContent, "No units found.");
  assert.equal(items[0].querySelector("button"), null);
});

test("no-match via filters only shows the distinct message", async () => {
  const { document } = await boot();
  const side = document.getElementById("side-filter");
  side.value = "Clan";
  side.dispatchEvent(new window.Event("change", { bubbles: true }));
  const era = document.getElementById("era-filter");
  era.value = "Age of War";
  era.dispatchEvent(new window.Event("change", { bubbles: true }));
  const items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].className, /picker-empty/);
  assert.equal(items[0].textContent, "No units found.");
});

test("whitespace-only search shows the hint", async () => {
  const { document } = await boot();
  const input = document.getElementById("search");
  input.value = "   ";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  const items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].className, /picker-hint/);
  assert.equal(items[0].textContent, "Start typing or select a filter to browse units.");
  assert.equal(items[0].querySelector("button"), null);
  assert.equal(items[0].getAttribute("tabindex"), null);
});
```

Exact-copy assertions (`assert.equal` on full text) pin the copy the Global
Constraints require; the no-button/tabindex assertions enforce the
non-interactive contract. The filters-only no-match test covers the spec's
flagship rationale for the generic wording. No `await settle()` — renders
are synchronous.

- [ ] **Step 3: Prepend a search step to the 6 click-first tests in `tests/app.test.js`**

These tests click `#picker-list li button` immediately after `boot()`; with the empty state there are no buttons until a query/filter is set. Insert `await showSomeUnits();` as the first statement of the test body (after `const { ... } = await boot();`) in each:

1. `"adding units renders cards and updates force PV"`
2. `"roster click delegation applies armor damage and saves"`
3. `"heat, crit, and remove actions"`
4. `"set-skill fixes the skill and persists"`
5. `"removing one duplicate unit keeps the other"`
6. `"removing the last unit deletes its group"`
7. `"clear force empties roster and saves"`

(That is 7 tests. The search value `"a"` matches ATLAS AS7-D and ATLAS AS7-K
(2 of 3 fixture units — "trooper tp-1r" contains no `a`), so
`#picker-list li button` resolves to ATLAS AS7-D exactly as before. No other
assertions change.)

- [ ] **Step 4: Update `tests/journey.test.js` — two pre-search clicks + final assertion**

In `"JOURNEY: units auto-group into Lances (IS) and Stars (Clan)"`, immediately before the two deploy clicks:

```js
  // Deploy 2 Clan mechs -> one Star (size 5)
  click(document.querySelector("#picker-list li button"), window);
```

insert:

```js
  const search0 = document.getElementById("search");
  search0.value = "a";
  search0.dispatchEvent(new window.Event("input", { bubbles: true }));
```

(no `await settle()` — synchronous render).

In `"JOURNEY: group names are fixed at creation and stable"`, immediately before the fill loop:

```js
  // Fill Star 1 (5 Clan mechs: add 5 clones)
  for (let i = 0; i < 5; i++) {
```

insert the same search block (search `"a"` matches both AS7-A and AS7-B clones).

In `"JOURNEY: search and type-filter interaction"`, replace the final assertion:

```js
  // Reset both — everything back
  search.value = "";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  await settle();
  assert.equal(document.querySelectorAll("#picker-list li").length, 3);
```

with:

```js
  // Reset both — back to the idle hint
  search.value = "";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  const idle = document.querySelectorAll("#picker-list li");
  assert.equal(idle.length, 1);
  assert.match(idle[0].className, /picker-hint/);
```

- [ ] **Step 5: Run the suite and confirm the expected failures**

Run: `npm test`
Expected: FAIL — `"init loads units, populates filters and picker"` (expects `.picker-hint`, gets 3 buttons), the new tests (`no-match`, `no-match via filters only`, `whitespace-only`), and the journey final assertion. All 7 click-first tests and the filter-only tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/app.test.js tests/journey.test.js
git commit -m "test: update picker tests for empty-state behavior"
```

---

### Task 2: Implement the empty-state guard in renderPicker

**Files:**
- Modify: `site/js/app.js` — `renderPicker()` (currently ~line 102)

**Interfaces:**
- Consumes: `_doc.createElement`, `el("picker-list")`, `filterUnits` — all existing.
- Produces: `li.picker-hint` (idle state) and `li.picker-empty` (active, zero matches) inside `#picker-list`, matching Task 1's assertions.

- [ ] **Step 1: Write the failing-test marker (already covered by Task 1)** — Task 1's tests assert the new classes; they currently fail.

- [ ] **Step 2: Implement the guard**

In `site/js/app.js`, locate `renderPicker()`. It currently reads the six inputs, clears the list, filters, and renders buttons:

```js
function renderPicker() {
  const query = el("search").value;
  const type = el("type-filter").value;
  const era = el("era-filter").value;
  const side = el("side-filter").value;
  const role = el("role-filter").value;
  const size = el("size-filter").value;
  const list = el("picker-list");
  list.innerHTML = "";
  const matches = filterUnits(_units, { query, type, era, side, role, size });
  for (const unit of matches) {
```

Replace the three lines `const list = el("picker-list");` through `const matches = ...` with:

```js
  const list = el("picker-list");
  list.innerHTML = "";
  const q = query.trim();
  const isDefault = !q && !type && !era && !side && !role && !size;
  if (isDefault) {
    const hint = _doc.createElement("li");
    hint.className = "picker-hint";
    hint.textContent = "Start typing or select a filter to browse units.";
    list.append(hint);
    return;
  }
  const matches = filterUnits(_units, { query, type, era, side, role, size });
  if (matches.length === 0) {
    const empty = _doc.createElement("li");
    empty.className = "picker-empty";
    empty.textContent = "No units found.";
    list.append(empty);
    return;
  }
  for (const unit of matches) {
```

**The edit range must start at `const list = el("picker-list");`** — the
existing declaration stays inside the replacement block. Starting at
`list.innerHTML = "";` would re-declare `const list` and throw
`SyntaxError: Identifier 'list' has already been declared`.

The `for` loop, `li`/`button` construction, and the closing of the function are unchanged. The `trim()` is required: without it a whitespace-only query would be truthy, bypass the guard, and `filterUnits` (which trims internally) would show the full catalog.

- [ ] **Step 3: Run the suite**

Run: `npm test`
Expected: PASS — all of `tests/app.test.js` and `tests/journey.test.js` green. (`tests/site-structure.test.js` still fails until Task 3 — expected.)

- [ ] **Step 4: Commit**

```bash
git add site/js/app.js
git commit -m "feat: empty-state unit picker — hint and no-match messages"
```

---

### Task 3: Style the hint and no-match messages

**Files:**
- Modify: `site/styles.css` (after line 163, the `.picker-list li .type` rule)
- Modify: `tests/site-structure.test.js`
- Modify: `site/index.html` (one static a11y attribute)

**Interfaces:**
- Consumes: `--muted` CSS variable (defined at styles.css:14).
- Produces: `.picker-list li.picker-hint` and `.picker-list li.picker-empty` selectors that the DOM from Task 2 uses.

- [ ] **Step 1: Add the failing test assertions**

In `tests/site-structure.test.js`, in the test `"styles.css defines the BattleTech palette"`, add after the `.pip` assertion:

```js
  assert.match(css, /\.picker-hint\s*\{/);
  assert.match(css, /\.picker-empty\s*\{/);
```

In the test `"index.html contains required UI structure"`, add after the id loop:

```js
  assert.match(html, /<ul id="picker-list"[^>]*aria-label="Available units"/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/site-structure.test.js`
Expected: FAIL — no `.picker-hint` rule and no `aria-label` on the list yet.

- [ ] **Step 3: Add the CSS rules**

In `site/styles.css`, after line 163 (`.picker-list li .type { ... }`) and before the `.picker.collapsed` rule at line 165, insert:

```css
.picker-list li.picker-hint,
.picker-list li.picker-empty {
  list-style: none;
  flex-basis: 100%;
  padding: 8px 0;
  font-size: 13px;
}
.picker-list li.picker-hint { color: var(--muted); font-style: italic; }
```

The `flex-basis: 100%` makes the message span the full row of the flex-wrapped `.picker-list` (`.picker-list` is `display: flex; flex-wrap: wrap`). The muted italic style keeps the hint visually subordinate; `.picker-empty` stays regular weight so the two states read differently.

- [ ] **Step 4: Add the a11y attribute to `site/index.html`**

On line 56, change:

```html
    <ul id="picker-list" class="picker-list"></ul>
```

to:

```html
    <ul id="picker-list" class="picker-list" aria-label="Available units"></ul>
```

The list currently has no accessible name; a screen reader entering it hears "list, 1 item" with no context. This is the only HTML change in the whole plan.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all four test files green.

- [ ] **Step 6: Commit**

```bash
git add site/styles.css tests/site-structure.test.js site/index.html
git commit -m "style: picker hint and no-match message styling; a11y label for picker list"
```
