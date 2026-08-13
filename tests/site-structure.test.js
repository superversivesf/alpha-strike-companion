import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("index.html contains required UI structure", () => {
  const html = readFileSync("site/index.html", "utf8");
  for (const id of [
    "search", "type-filter", "force-pv", "btn-clear", "btn-export",
    "btn-import", "import-file", "picker", "picker-toggle",
    "picker-list", "roster", "roster-empty",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
  assert.match(html, /<script type="module" src="js\/app\.js">/);
  assert.match(html, /stylesheet/i);
  assert.match(html, /styles\.css/);
  assert.match(html, /<ul id="picker-list"[^>]*aria-label="Available units"/);
});

test("styles.css defines the BattleTech palette", () => {
  const css = readFileSync("site/styles.css", "utf8");
  for (const token of ["--bg", "--panel", "--accent", "--damaged", "--olive", "--tan"]) {
    assert.match(css, new RegExp(token), `missing CSS variable ${token}`);
  }
  assert.match(css, /\.card\s*\{/);
  assert.match(css, /\.roster\s*\{/);
  assert.match(css, /\.pip\s*\{/);
  assert.match(css, /overflow-x\s*:\s*auto/);
  assert.match(css, /\.picker-hint\s*\{/);
  assert.match(css, /\.picker-empty\s*\{/);
  assert.match(css, /\.sator-overlay\s*\{/);
  assert.match(css, /\.sator-dialog\s*\{/);
  assert.match(css, /\.card-tohit\s*\{/);
});

test("styles.css is responsive for small screens", () => {
  const css = readFileSync("site/styles.css", "utf8");
  assert.match(css, /@media\s*\(max-width:\s*700px\)/, "missing mobile media query");
  assert.match(css, /width:\s*min\(600px,\s*100%\)/, "card width must be fluid");
  assert.match(css, /\.card-body\s*\{\s*flex-direction:\s*column/, "card body must stack on mobile");
});
