# Alpha Strike Tabletop Companion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A zero-build static website where Alpha Strike players pick units from the Master Unit List archive (6888 variants), see them as horizontally scrollable cards, and track armor/structure/heat/crits with auto-saving state.

**Architecture:** A `tools/build_data.py` pipeline (Python stdlib) converts 6888 `.tres` records + artwork from the cloned archive into `site/data/units.json` + `site/data/img/`. The site is vanilla ES-module JS (no frameworks), split into `state.js` (pure logic), `search.js` (filtering), `cards.js` (DOM rendering), `storage.js` (persistence), `app.js` (wiring). State auto-saves to localStorage; export/import JSON provides cross-device transfer.

**Tech Stack:** Python 3 (build, stdlib only), vanilla JS ES modules, CSS. Tests: Node 24 `node:test` runner + `jsdom` devDependency only. No runtime dependencies, no bundler.

## Global Constraints

- Site must run from any static host or `python3 -m http.server`; no build step for the site itself.
- All JS is ES modules (`type="module"`); no frameworks, no CDN, no external fonts — offline-capable.
- localStorage key: `as-companion-state-v1`.
- Unit id slug: `slugify(class + " " + variant)` — lowercase, non-alphanumerics → `-`, collapse runs, trim `-`.
- Heat model: `heat ∈ {0, 1, 2, 3, "S"}`. Clicking a heat button sets that level; clicking the active level resets to 0.
- Crits: fixed 12 boolean slots per card, index 0–11.
- Damage clamps: `armorDamage ∈ [0, unit.armor]`, `structDamage ∈ [0, unit.structure]`.
- Build-time normalization: unit `type` uppercased; type `None` → `UNK`. Types observed in data: AF, BA, BD, BM, CF, CI, CV, IM, JS, PM, SC, SS, SV, UNK.
- All numeric parse failures in build default to 0 except `pv`, `armor`, `struct` which must be present and ≥ 0 (sanity-check fails otherwise).
- Duplicate roster entries are allowed (two of the same mech).
- State saves synchronously on every change (deviation from spec's "debounced ~200ms": payload is < 100KB and sync avoids loss when the tab closes).
- Tests use only `node:test` + `jsdom`; Python build tests use `unittest` (stdlib).
- BattleTech palette (defined in Task 3): near-black blue-grey background, dark steel panels, hazard-orange accent, olive/tan military tones, red damage pips.
- Repo root: `/home/jason/Repos/mul`. The cloned archive `Alpha-Strike-Tool/` and generated `site/data/` are gitignored.

---

### Task 1: Repo bootstrap

**Files:**
- Create: `.gitignore`
- Create: `package.json`

**Interfaces:**
- Produces: git repo at repo root, npm scripts `test`, `build:data`, `serve`.

- [ ] **Step 1: Initialize git and write `.gitignore`**

```bash
cd /home/jason/Repos/mul
git init
```

Write `.gitignore`:

```gitignore
node_modules/
site/data/
Alpha-Strike-Tool/
__pycache__/
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "as-tabletop-companion",
  "version": "1.0.0",
  "private": true,
  "description": "Alpha Strike tabletop companion: pick units, track damage on scrollable cards.",
  "scripts": {
    "test": "node --test tests/",
    "build:data": "python3 tools/build_data.py",
    "serve": "python3 -m http.server 8000 --directory site"
  },
  "devDependencies": {
    "jsdom": "^24.1.0"
  }
}
```

- [ ] **Step 3: Install dev dependencies**

Run: `npm install`
Expected: `node_modules/` created, jsdom installed.

- [ ] **Step 4: Commit**

```bash
git add .gitignore package.json package-lock.json
git commit -m "chore: bootstrap repo, gitignore, npm scripts"
```

---

### Task 2: Data pipeline (build script + tests)

**Files:**
- Create: `tools/build_data.py`
- Test: `tools/test_build_data.py`

**Interfaces:**
- Consumes: archive at `Alpha-Strike-Tool/Units/**/*.tres`, images at `Alpha-Strike-Tool/Sprites/Units/*.png`.
- Produces: `site/data/units.json` with shape:
  ```json
  {"units": [{"id": "atlas-as7-d", "class": "ATLAS", "variant": "AS7-D", "type": "BM", "size": 4, "tmm": 1, "move": "6", "role": "Juggernaut", "skill": 4, "damage": {"s": 5, "m": 5, "l": 2}, "overheat": 0, "armor": 10, "structure": 8, "pv": 52, "abilities": ["AC2/2/-", "IF1", "LRM1/1/1", "REAR1/1/-"], "image": "atlas-rg.png"}]}
  ```
- Produces: copied artwork under `site/data/img/` (only `.png` files referenced by records; `.import` files never copied).

**Edge cases verified against real data:** ability strings contain escaped quotes (`LAM(36\"g/6a)`) and trailing commas (`"FUEL4", ]`); `Array[String]([])` empty lists; 1 record missing `damageS`/`damageL`; 3 missing `sz`/`ov`/`tmm`; type values `None` and lowercase (`bm`, `af`); filenames with non-ASCII (`Araña`). 6888 records, all unique `(class, variant)`, every record's image exists on disk.

- [ ] **Step 1: Write the failing tests**

`tools/test_build_data.py`:

```python
import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

import sys
sys.path.insert(0, os.path.dirname(__file__))
import build_data as bd

FIXTURE_TRES = """[gd_resource type="Resource" script_class="UnitInfo" format=3]

[ext_resource type="Script" path="res://UnitInfo.gd" id="1_cs3jr"]
[ext_resource type="Texture2D" path="res://Sprites/Units/atlas-rg.png" id="2_ynkeb"]

[resource]
script = ExtResource("1_cs3jr")
unitIMG = ExtResource("2_ynkeb")
variant = "AS7-D"
title = "ATLAS"
pv = 52
type = "BM"
sz = 4
tmm = 1
move = "6"
role = "Juggernaut"
skill = 4
damageS = 5
damageM = 5
damageL = 2
ov = 0
armor = 10
struct = 8
special = Array[String](["AC2/2/-", "IF1", "LRM1/1/1", "REAR1/1/-"])
metadata/_custom_type_script = "uid://dj1da82xsjhtw"
"""

FIXTURE_TRES_LAM = """[resource]
unitIMG = ExtResource("2_ynkeb")
variant = "S-PW-1LAM"
title = "PWWKA"
pv = 31
type = "AF"
sz = 2
tmm = 3
move = "36\\"g/6a"
role = "Strike"
skill = 4
damageS = 2
damageM = 2
damageL = 1
ov = 0
armor = 2
struct = 1
special = Array[String](["BOMB1", "FUEL4", "LAM(36\\"g/6a)", ])
"""

FIXTURE_TRES_EMPTY = """[resource]
unitIMG = ExtResource("2_ynkeb")
variant = "TP-1R"
title = "TROOPER"
pv = 14
type = "None"
sz = 1
tmm = 0
move = "12\\""
role = "Scout"
skill = 4
damageS = 1
damageM = 1
damageL = 0
ov = 0
armor = 2
struct = 1
special = Array[String]([])
"""


class TestParseTres(unittest.TestCase):
    def test_parse_basic_fields(self):
        d = bd.parse_tres_lines(FIXTURE_TRES.splitlines())
        self.assertEqual(d["variant"], '"AS7-D"')
        self.assertEqual(d["pv"], '52')
        self.assertEqual(d["type"], '"BM"')

    def test_parse_str_unquotes(self):
        self.assertEqual(bd.parse_str('"AS7-D"'), "AS7-D")
        self.assertEqual(bd.parse_str('52'), "52")
        self.assertEqual(bd.parse_str('None'), "None")

    def test_parse_abilities_basic(self):
        self.assertEqual(
            bd.parse_abilities('Array[String](["AC2/2/-", "IF1", "LRM1/1/1", "REAR1/1/-"])'),
            ["AC2/2/-", "IF1", "LRM1/1/1", "REAR1/1/-"],
        )

    def test_parse_abilities_escaped_quotes_and_trailing_comma(self):
        self.assertEqual(
            bd.parse_abilities('Array[String](["BOMB1", "FUEL4", "LAM(36\\"g/6a)", ])'),
            ["BOMB1", "FUEL4", 'LAM(36"g/6a)'],
        )

    def test_parse_abilities_empty(self):
        self.assertEqual(bd.parse_abilities('Array[String]([])'), [])
        self.assertEqual(bd.parse_abilities('Array[String]()'), [])

    def test_slugify(self):
        self.assertEqual(bd.slugify("ATLAS", "AS7-D"), "atlas-as7-d")
        self.assertEqual(bd.slugify("Araña", "ARA-S-1 MilitiaMech"), "arana-ara-s-1-militiamech")
        self.assertEqual(bd.slugify("Phoenix Hawk LAM", "PHX-HK2M"), "phoenix-hawk-lam-phx-hk2m")

    def test_build_record_full(self):
        rec = bd.build_record("Units/ATLAS/ATLAS AS7-D.tres", FIXTURE_TRES.splitlines(), {"atlas-rg.png"})
        self.assertEqual(rec["id"], "atlas-as7-d")
        self.assertEqual(rec["class"], "ATLAS")
        self.assertEqual(rec["variant"], "AS7-D")
        self.assertEqual(rec["type"], "BM")
        self.assertEqual(rec["size"], 4)
        self.assertEqual(rec["tmm"], 1)
        self.assertEqual(rec["move"], "6")
        self.assertEqual(rec["role"], "Juggernaut")
        self.assertEqual(rec["skill"], 4)
        self.assertEqual(rec["damage"], {"s": 5, "m": 5, "l": 2})
        self.assertEqual(rec["overheat"], 0)
        self.assertEqual(rec["armor"], 10)
        self.assertEqual(rec["structure"], 8)
        self.assertEqual(rec["pv"], 52)
        self.assertEqual(rec["abilities"], ["AC2/2/-", "IF1", "LRM1/1/1", "REAR1/1/-"])
        self.assertEqual(rec["image"], "atlas-rg.png")

    def test_build_record_type_normalized(self):
        rec = bd.build_record("t.tres", FIXTURE_TRES_EMPTY.splitlines(), set())
        self.assertEqual(rec["type"], "UNK")

    def test_build_record_escaped_move_and_abilities(self):
        rec = bd.build_record("t.tres", FIXTURE_TRES_LAM.splitlines(), set())
        self.assertEqual(rec["move"], '36"g/6a')
        self.assertEqual(rec["abilities"], ["BOMB1", "FUEL4", 'LAM(36"g/6a)'])

    def test_missing_optional_numerics_default_to_zero(self):
        lines = FIXTURE_TRES.splitlines()
        lines = [ln for ln in lines if not ln.startswith("damageS") and not ln.startswith("sz")]
        rec = bd.build_record("t.tres", lines, set())
        self.assertEqual(rec["damage"]["s"], 0)
        self.assertEqual(rec["size"], 0)


class TestBuildEndToEnd(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.units_dir = os.path.join(self.tmp, "Units")
        self.sprites_dir = os.path.join(self.tmp, "Sprites", "Units")
        self.site_dir = os.path.join(self.tmp, "site")
        os.makedirs(os.path.join(self.units_dir, "ATLAS"), exist_ok=True)
        os.makedirs(os.path.join(self.units_dir, "Pwwka"), exist_ok=True)
        os.makedirs(self.sprites_dir, exist_ok=True)
        with open(os.path.join(self.units_dir, "ATLAS", "ATLAS AS7-D.tres"), "w", encoding="utf-8") as f:
            f.write(FIXTURE_TRES)
        with open(os.path.join(self.units_dir, "Pwwka", "Pwwka S-PW-1LAM.tres"), "w", encoding="utf-8") as f:
            f.write(FIXTURE_TRES_LAM)
        with open(os.path.join(self.sprites_dir, "atlas-rg.png"), "wb") as f:
            f.write(b"PNGDATA")
        with open(os.path.join(self.sprites_dir, "pwwka-jfr.png"), "wb") as f:
            f.write(b"PNGDATA")
        with open(os.path.join(self.sprites_dir, "atlas-rg.png.import"), "w", encoding="utf-8") as f:
            f.write("ignored import metadata")

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_build_writes_units_json_and_images(self):
        bd.build(self.units_dir, self.sprites_dir, self.site_dir)
        with open(os.path.join(self.site_dir, "data", "units.json"), encoding="utf-8") as f:
            payload = json.load(f)
        units = payload["units"]
        self.assertEqual(len(units), 2)
        ids = [u["id"] for u in units]
        self.assertEqual(len(ids), len(set(ids)))
        by_id = {u["id"]: u for u in units}
        self.assertIn("atlas-as7-d", by_id)
        self.assertEqual(by_id["atlas-as7-d"]["pv"], 52)
        img_dir = os.path.join(self.site_dir, "data", "img")
        self.assertTrue(os.path.exists(os.path.join(img_dir, "atlas-rg.png")))
        self.assertTrue(os.path.exists(os.path.join(img_dir, "pwwka-jfr.png")))
        self.assertFalse(os.path.exists(os.path.join(img_dir, "atlas-rg.png.import")))

    def test_sanity_check_fails_on_bad_units(self):
        bad = [{"id": "x", "armor": -1}]
        with self.assertRaises(AssertionError):
            bd.sanity_check(bad, self.sprites_dir)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -m unittest tools.test_build_data -v` (from repo root)
Expected: FAIL — `ModuleNotFoundError: build_data`.

- [ ] **Step 3: Write the build script**

`tools/build_data.py`:

```python
#!/usr/bin/env python3
"""Build site/data/units.json + site/data/img from the Alpha-Strike-Tool archive."""
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCHIVE_UNITS = os.path.join(ROOT, "Alpha-Strike-Tool", "Units")
ARCHIVE_SPRITES = os.path.join(ROOT, "Alpha-Strike-Tool", "Sprites", "Units")
SITE_DATA = os.path.join(ROOT, "site", "data")
SITE_IMG = os.path.join(SITE_DATA, "img")

KEY_RE = re.compile(r"^([A-Za-z_]+) = (.*)$")
IMG_RE = re.compile(r"Sprites/Units/([^\"\s]+)")
ABILITY_RE = re.compile(r"^Array\[String\]\(\[(.*)\]\)$", re.DOTALL)


def parse_tres_lines(lines):
    d = {}
    in_resource = False
    for line in lines:
        line = line.strip()
        if line == "[resource]":
            in_resource = True
            continue
        if not in_resource:
            continue
        m = KEY_RE.match(line)
        if m:
            d[m.group(1)] = m.group(2)
    return d


def parse_str(v):
    v = v.strip()
    if len(v) >= 2 and v.startswith('"') and v.endswith('"'):
        return v[1:-1]
    return v


def parse_abilities(raw):
    if not raw:
        return []
    m = ABILITY_RE.match(raw.strip())
    if not m:
        return []
    inner = m.group(1).strip()
    if not inner:
        return []
    parts = re.split(r'",\s*"', inner)
    out = []
    for p in parts:
        p = p.strip()
        if p.startswith('"'):
            p = p[1:]
        if p.endswith('"'):
            p = p[:-1]
        p = p.rstrip(",").strip()
        if p:
            out.append(p.replace('\\"', '"'))
    return out


def slugify(class_name, variant):
    s = (class_name + " " + variant).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def to_int(v, default=0):
    try:
        return int(parse_str(v))
    except (TypeError, ValueError):
        return default


def build_record(path, lines, image_set):
    d = parse_tres_lines(lines)
    class_name = parse_str(d.get("title")) or "UNKNOWN"
    variant = parse_str(d.get("variant")) or "UNKNOWN"
    image = ""
    m = IMG_RE.search(d.get("unitIMG", ""))
    if m:
        image = m.group(1).replace('\\"', '"')
        image_set.add(image)
    pv = to_int(d.get("pv"))
    armor = to_int(d.get("armor"))
    struct = to_int(d.get("struct"))
    type_raw = (parse_str(d.get("type")) or "UNK").upper()
    if type_raw in ("", "NONE"):
        type_raw = "UNK"
    return {
        "id": slugify(class_name, variant),
        "class": class_name,
        "variant": variant,
        "type": type_raw,
        "size": to_int(d.get("sz")),
        "tmm": to_int(d.get("tmm")),
        "move": parse_str(d.get("move")) or "",
        "role": parse_str(d.get("role")) or "",
        "skill": to_int(d.get("skill"), 4),
        "damage": {
            "s": to_int(d.get("damageS")),
            "m": to_int(d.get("damageM")),
            "l": to_int(d.get("damageL")),
        },
        "overheat": to_int(d.get("ov")),
        "armor": armor,
        "structure": struct,
        "pv": pv,
        "abilities": parse_abilities(d.get("special")),
        "image": image,
    }


def sanity_check(units, sprites_dir):
    assert units, "no units parsed"
    ids = [u["id"] for u in units]
    assert len(ids) == len(set(ids)), "duplicate unit ids"
    for u in units:
        assert u["armor"] >= 0 and u["structure"] >= 0 and u["pv"] >= 0, u["id"]
        if u["image"]:
            assert os.path.exists(os.path.join(sprites_dir, u["image"])), (
                f"missing image {u['image']} for {u['id']}"
            )


def build(units_dir, sprites_dir, site_data_dir):
    image_set = set()
    units = []
    for dirpath, dirnames, filenames in os.walk(units_dir):
        for fn in filenames:
            if not fn.endswith(".tres"):
                continue
            path = os.path.join(dirpath, fn)
            with open(path, encoding="utf-8", errors="replace") as f:
                lines = f.read().splitlines()
            units.append(build_record(path, lines, image_set))

    units.sort(key=lambda u: (u["class"].lower(), u["variant"].lower()))
    sanity_check(units, sprites_dir)

    os.makedirs(os.path.join(site_data_dir, "img"), exist_ok=True)
    for img in sorted(image_set):
        if not img.endswith(".png"):
            continue
        src = os.path.join(sprites_dir, img)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(site_data_dir, "img", img))

    with open(os.path.join(site_data_dir, "units.json"), "w", encoding="utf-8") as f:
        json.dump({"units": units}, f, ensure_ascii=False)

    print(f"Wrote {len(units)} units, {len(image_set)} images")
    return units


if __name__ == "__main__":
    units = build(ARCHIVE_UNITS, ARCHIVE_SPRITES, SITE_DATA)
    print(f"Total: {len(units)} units")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m unittest tools.test_build_data -v` (from repo root)
Expected: all PASS.

- [ ] **Step 5: Run the real build and verify against known values**

Run: `npm run build:data`
Expected output similar to: `Wrote 6888 units, 1594 images`.

Verify: `python3 -c "import json; d=json.load(open('site/data/units.json')); u=[x for x in d['units'] if x['id']=='atlas-as7-d'][0]; print(u['pv'], u['armor'], u['structure'], u['damage'], u['abilities'])"`
Expected: `52 10 8 {'s': 5, 'm': 5, 'l': 2} ['AC2/2/-', 'IF1', 'LRM1/1/1', 'REAR1/1/-']`

- [ ] **Step 6: Commit**

```bash
git add tools/ site/data/.gitignore
git commit -m "feat: data pipeline builds units.json + artwork from archive"
```

---

### Task 3: Site shell + BattleTech styling

**Files:**
- Create: `site/index.html`
- Create: `site/styles.css`
- Create: `site/data/.gitkeep` (so the data dir exists in git)
- Test: `tests/site-structure.test.js`

**Interfaces:**
- Produces: HTML element IDs used by later tasks: `#search`, `#type-filter`, `#force-pv`, `#btn-clear`, `#btn-export`, `#btn-import`, `#import-file`, `#picker`, `#picker-toggle`, `#picker-list`, `#roster`, `#roster-empty`.
- Produces: `<script type="module" src="js/app.js">` — app.js will be created in Task 6.

- [ ] **Step 1: Write the failing integration test**

`tests/site-structure.test.js`:

```js
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `ENOENT: no such file or directory site/index.html`.

- [ ] **Step 3: Write `site/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alpha Strike — Tabletop Companion</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <span class="brand-mark">▲</span>
      <div class="brand-text">
        <h1>ALPHA STRIKE</h1>
        <span class="brand-sub">Tabletop Companion</span>
      </div>
    </div>
    <div class="controls">
      <input id="search" type="search" placeholder="Search units…" autocomplete="off">
      <select id="type-filter" aria-label="Filter by type">
        <option value="">All types</option>
      </select>
      <span id="force-pv" class="force-pv">Force PV: 0</span>
      <button id="btn-clear" class="btn btn-danger" type="button">Clear force</button>
      <button id="btn-export" class="btn" type="button">Export</button>
      <button id="btn-import" class="btn" type="button">Import</button>
      <input id="import-file" type="file" accept="application/json,.json" hidden>
    </div>
  </header>

  <section id="picker" class="picker" aria-label="Unit picker">
    <div class="picker-head">
      <h2>UNIT PICKER</h2>
      <button id="picker-toggle" class="btn btn-small" type="button">Hide ▾</button>
    </div>
    <ul id="picker-list" class="picker-list"></ul>
  </section>

  <main id="roster" class="roster" aria-label="Force roster">
    <div id="roster-empty" class="roster-empty">
      <p>No units on the table yet.</p>
      <p>Search the picker above and click a unit to deploy it.</p>
    </div>
  </main>

  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write `site/styles.css`** (BattleTech palette: dark steel, hazard orange, olive drab)

```css
:root {
  --bg: #12151a;
  --panel: #1c2128;
  --panel-2: #242b33;
  --steel: #3a434e;
  --border: #4a5560;
  --accent: #f07c1f;
  --accent-strong: #ff8c00;
  --olive: #4b5320;
  --tan: #c2b280;
  --ok: #7ea04a;
  --damaged: #d0342c;
  --text: #e8e6e1;
  --muted: #9aa4ad;
  --font-head: "Arial Black", Impact, "Franklin Gothic Bold", sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(1200px 500px at 50% -10%, #1f2730 0%, transparent 60%),
    var(--bg);
  color: var(--text);
  font-family: system-ui, "Segoe UI", Roboto, sans-serif;
}

h1, h2, h3 { font-family: var(--font-head); letter-spacing: 0.06em; }

.topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 18px;
  background: linear-gradient(180deg, var(--panel-2), var(--panel));
  border-bottom: 3px solid var(--accent);
}

.brand { display: flex; align-items: center; gap: 12px; }

.brand-mark {
  color: var(--accent-strong);
  font-size: 28px;
  text-shadow: 0 0 12px rgba(255, 140, 0, 0.6);
}

.brand-text h1 { margin: 0; font-size: 20px; color: var(--text); }
.brand-sub { color: var(--muted); font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; }

.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }

#search {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  width: 240px;
}

#type-filter {
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
}

.force-pv {
  font-family: var(--font-head);
  color: var(--tan);
  padding: 6px 12px;
  border: 1px solid var(--olive);
  border-radius: 4px;
  background: rgba(75, 83, 32, 0.25);
}

.btn {
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--panel-2);
  color: var(--text);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
}
.btn:hover { border-color: var(--accent); color: var(--accent-strong); }
.btn-danger:hover { border-color: var(--damaged); color: var(--damaged); }
.btn-small { padding: 4px 10px; font-size: 11px; }

.picker {
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 18px;
  cursor: pointer;
  user-select: none;
}
.picker-head h2 { margin: 0; font-size: 14px; color: var(--muted); }

.picker-list {
  list-style: none;
  margin: 0;
  padding: 0 18px 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.picker-list li button {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--panel-2);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}
.picker-list li button:hover { border-color: var(--accent); }
.picker-list li .pv { color: var(--tan); font-weight: 600; margin-left: 6px; }
.picker-list li .type { color: var(--muted); font-size: 11px; margin-left: 4px; }

.picker.collapsed .picker-list { display: none; }

.roster {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 18px;
  align-items: flex-start;
  min-height: 420px;
}

.roster-empty {
  margin: 40px auto;
  text-align: center;
  color: var(--muted);
}

.card {
  position: relative;
  flex: 0 0 300px;
  width: 300px;
  background: linear-gradient(160deg, var(--panel-2), var(--panel));
  border: 1px solid var(--border);
  border-top: 4px solid var(--accent);
  border-radius: 6px;
  padding: 10px 12px 12px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
}

.card-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.card-title { margin: 0; font-size: 15px; }
.card-variant { color: var(--muted); font-size: 12px; }
.card-pv { margin-left: auto; font-family: var(--font-head); color: var(--tan); }
.card-remove {
  margin-left: 6px;
  border: none;
  background: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 14px;
}
.card-remove:hover { color: var(--damaged); }

.card-art {
  margin: 8px 0;
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}
.card-art img { max-width: 100%; max-height: 100%; object-fit: contain; }
.card-art .placeholder { color: var(--muted); font-size: 26px; font-family: var(--font-head); }

.card-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 14px;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 8px;
}
.card-stats b { color: var(--text); font-weight: 600; }

.track { margin-bottom: 6px; }
.track-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--muted);
  margin-bottom: 3px;
}
.pips { display: flex; flex-wrap: wrap; gap: 3px; }
.pip {
  width: 14px;
  height: 14px;
  border: 1px solid var(--border);
  border-radius: 2px;
  background: var(--ok);
  cursor: pointer;
  padding: 0;
}
.pip.damaged { background: var(--damaged); border-color: #8a1f1a; }
.pip:hover { outline: 1px solid var(--accent-strong); }

.card-heat { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.card-heat .track-label { margin: 0 8px 0 0; }
.heat-btn {
  width: 30px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--panel-2);
  color: var(--text);
  cursor: pointer;
  font-weight: 600;
}
.heat-btn.active { background: var(--accent); border-color: var(--accent-strong); color: #1a1a1a; }
.heat-btn.shutdown.active { background: var(--damaged); border-color: #8a1f1a; }

.card-crits { margin-bottom: 8px; }
.crit-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; }
.crit-slot {
  height: 14px;
  border: 1px solid var(--border);
  border-radius: 2px;
  background: var(--panel-2);
  cursor: pointer;
  padding: 0;
}
.crit-slot.filled { background: var(--olive); border-color: var(--tan); }

.card-abilities { display: flex; flex-wrap: wrap; gap: 4px; }
.ability {
  font-size: 10px;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--tan);
  background: rgba(194, 178, 128, 0.08);
}

.footer-note {
  text-align: center;
  color: var(--muted);
  font-size: 11px;
  padding: 10px;
}
```

- [ ] **Step 5: Create `site/data/.gitkeep`**

```bash
mkdir -p site/data && touch site/data/.gitkeep
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add site/ tests/site-structure.test.js
git commit -m "feat: site shell with BattleTech-themed styling"
```

---

### Task 4: Pure logic — state + search modules

**Files:**
- Create: `site/js/state.js`
- Create: `site/js/search.js`
- Test: `tests/state.test.js`
- Test: `tests/search.test.js`

**Interfaces:**
- Produces (consumed by Tasks 5–7):
  - `slugifyUnit(class, variant) → string`
  - `createEntry(unit) → entry` where `entry = {unitId, armorDamage: 0, structDamage: 0, heat: 0, crits: boolean[12]}`
  - `damageArmor(entry, unit, index) → entry` (new object; click semantics: if `armorDamage === index + 1` → `index`, else `index + 1`; clamped to `[0, unit.armor]`)
  - `damageStruct(entry, unit, index) → entry` (same semantics)
  - `setHeat(entry, level) → entry` (`level ∈ {1, 2, 3, "S"}`; setting current level → 0)
  - `toggleCrit(entry, index) → entry`
  - `isEntryValid(entry, unit) → boolean`
  - `filterUnits(units, {query, type}) → unit[]` (query: case-insensitive substring on `class + " " + variant`; type: exact match on `unit.type`; empty query → all)
  - `uniqueTypes(units) → string[]` sorted, uppercased, excluding `UNK`

- [ ] **Step 1: Write the failing tests**

`tests/state.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  slugifyUnit, createEntry, damageArmor, damageStruct,
  setHeat, toggleCrit, isEntryValid,
} from "../site/js/state.js";

const unit = {
  id: "atlas-as7-d", class: "ATLAS", variant: "AS7-D", type: "BM",
  size: 4, tmm: 1, move: "6", role: "Juggernaut", skill: 4,
  damage: { s: 5, m: 5, l: 2 }, overheat: 0,
  armor: 10, structure: 8, pv: 52,
  abilities: ["AC2/2/-"], image: "atlas-rg.png",
};

test("slugifyUnit produces lowercase dash id", () => {
  assert.equal(slugifyUnit("ATLAS", "AS7-D"), "atlas-as7-d");
  assert.equal(slugifyUnit("Phoenix Hawk LAM", "PHX-HK2M"), "phoenix-hawk-lam-phx-hk2m");
  assert.equal(slugifyUnit("Araña", "ARA-S-1 MilitiaMech"), "arana-ara-s-1-militiamech");
});

test("createEntry starts clean", () => {
  const e = createEntry(unit);
  assert.equal(e.unitId, "atlas-as7-d");
  assert.equal(e.armorDamage, 0);
  assert.equal(e.structDamage, 0);
  assert.equal(e.heat, 0);
  assert.deepEqual(e.crits, Array(12).fill(false));
});

test("damageArmor click semantics and clamping", () => {
  let e = createEntry(unit);
  e = damageArmor(e, unit, 0);        // click pip 1 → 1 damage
  assert.equal(e.armorDamage, 1);
  e = damageArmor(e, unit, 3);        // click pip 4 → 4 damage
  assert.equal(e.armorDamage, 4);
  e = damageArmor(e, unit, 9);        // click pip 10 → 10 damage (max)
  assert.equal(e.armorDamage, 10);
  e = damageArmor(e, unit, 3);        // re-click pip 4 → back to 3
  assert.equal(e.armorDamage, 3);
});

test("damageStruct clamps to structure", () => {
  let e = createEntry(unit);
  e = damageStruct(e, unit, 7);
  assert.equal(e.structDamage, 8);
  e = damageStruct(e, unit, 7);
  assert.equal(e.structDamage, 7);
});

test("setHeat cycles levels and resets on re-click", () => {
  let e = createEntry(unit);
  e = setHeat(e, 1); assert.equal(e.heat, 1);
  e = setHeat(e, 2); assert.equal(e.heat, 2);
  e = setHeat(e, "S"); assert.equal(e.heat, "S");
  e = setHeat(e, "S"); assert.equal(e.heat, 0);
  e = setHeat(e, 3); assert.equal(e.heat, 3);
});

test("toggleCrit flips slot", () => {
  let e = createEntry(unit);
  e = toggleCrit(e, 3);
  assert.equal(e.crits[3], true);
  e = toggleCrit(e, 3);
  assert.equal(e.crits[3], false);
});

test("isEntryValid enforces bounds", () => {
  const e = createEntry(unit);
  assert.equal(isEntryValid(e, unit), true);
  assert.equal(isEntryValid({ ...e, armorDamage: 11 }, unit), false);
  assert.equal(isEntryValid({ ...e, structDamage: 9 }, unit), false);
  assert.equal(isEntryValid({ ...e, heat: "X" }, unit), false);
  assert.equal(isEntryValid({ ...e, crits: [true] }, unit), false);
});
```

`tests/search.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { filterUnits, uniqueTypes } from "../site/js/search.js";

const units = [
  { id: "atlas-as7-d", class: "ATLAS", variant: "AS7-D", type: "BM", pv: 52 },
  { id: "atlas-as7-k", class: "ATLAS", variant: "AS7-K", type: "BM", pv: 49 },
  { id: "awesome-aws-8q", class: "AWESOME", variant: "AWS-8Q", type: "BM", pv: 44 },
  { id: "demolisher-heavy-tank", class: "Demolisher Heavy Tank", variant: "Std", type: "CV", pv: 36 },
  { id: "trooper-tp-1r", class: "Trooper", variant: "TP-1R", type: "UNK", pv: 14 },
];

test("filterUnits matches substring case-insensitive on class+variant", () => {
  assert.deepEqual(filterUnits(units, { query: "atlas" }).map(u => u.id), ["atlas-as7-d", "atlas-as7-k"]);
  assert.deepEqual(filterUnits(units, { query: "AS7" }).map(u => u.id), ["atlas-as7-d", "atlas-as7-k"]);
  assert.deepEqual(filterUnits(units, { query: "heavy tank" }).map(u => u.id), ["demolisher-heavy-tank"]);
});

test("filterUnits empty query returns all", () => {
  assert.equal(filterUnits(units, { query: "", type: "" }).length, units.length);
});

test("filterUnits type filter is exact", () => {
  assert.deepEqual(filterUnits(units, { query: "", type: "BM" }).map(u => u.id), ["atlas-as7-d", "atlas-as7-k", "awesome-aws-8q"]);
});

test("filterUnits combines query and type", () => {
  assert.deepEqual(filterUnits(units, { query: "atlas", type: "CV" }), []);
  assert.deepEqual(filterUnits(units, { query: "a", type: "BM" }).length, 3);
});

test("uniqueTypes returns sorted non-UNK types", () => {
  assert.deepEqual(uniqueTypes(units), ["BM", "CV"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../site/js/state.js`.

- [ ] **Step 3: Write `site/js/state.js`**

```js
export const HEAT_LEVELS = [1, 2, 3, "S"];
export const CRIT_SLOTS = 12;

export function slugifyUnit(className, variant) {
  return `${className} ${variant}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function createEntry(unit) {
  return {
    unitId: unit.id,
    armorDamage: 0,
    structDamage: 0,
    heat: 0,
    crits: Array(CRIT_SLOTS).fill(false),
  };
}

function clickTrack(current, index) {
  const next = index + 1;
  return current === next ? current - 1 : next;
}

export function damageArmor(entry, unit, index) {
  return {
    ...entry,
    armorDamage: Math.max(0, Math.min(unit.armor, clickTrack(entry.armorDamage, index))),
  };
}

export function damageStruct(entry, unit, index) {
  return {
    ...entry,
    structDamage: Math.max(0, Math.min(unit.structure, clickTrack(entry.structDamage, index))),
  };
}

export function setHeat(entry, level) {
  return { ...entry, heat: entry.heat === level ? 0 : level };
}

export function toggleCrit(entry, index) {
  const crits = entry.crits.slice();
  crits[index] = !crits[index];
  return { ...entry, crits };
}

export function isEntryValid(entry, unit) {
  if (typeof entry.armorDamage !== "number" || entry.armorDamage < 0 || entry.armorDamage > unit.armor) return false;
  if (typeof entry.structDamage !== "number" || entry.structDamage < 0 || entry.structDamage > unit.structure) return false;
  if (!(entry.heat === 0 || entry.heat === 1 || entry.heat === 2 || entry.heat === 3 || entry.heat === "S")) return false;
  if (!Array.isArray(entry.crits) || entry.crits.length !== CRIT_SLOTS) return false;
  return entry.crits.every(c => typeof c === "boolean");
}
```

- [ ] **Step 4: Write `site/js/search.js`**

```js
export function filterUnits(units, { query = "", type = "" } = {}) {
  const q = query.trim().toLowerCase();
  return units.filter(u => {
    if (type && u.type !== type) return false;
    if (!q) return true;
    return `${u.class} ${u.variant}`.toLowerCase().includes(q);
  });
}

export function uniqueTypes(units) {
  return [...new Set(units.map(u => u.type).filter(t => t && t !== "UNK"))].sort();
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all state + search tests).

- [ ] **Step 6: Commit**

```bash
git add site/js/state.js site/js/search.js tests/state.test.js tests/search.test.js
git commit -m "feat: state and search pure logic with unit tests"
```

---

### Task 5: Card renderer

**Files:**
- Create: `site/js/cards.js`
- Test: `tests/cards.test.js`

**Interfaces:**
- Consumes: `createEntry`, `damageArmor`, `damageStruct`, `setHeat`, `toggleCrit` (Task 4); unit records (Task 2 shape).
- Produces: `renderCard(unit, entry, {onAction}) → HTMLElement`
  - Card structure and `data-*` attributes used by app.js event delegation (Task 6):
    - `article.card[data-unit-id]`
    - header: `.card-title`, `.card-variant`, `.card-pv`, button `.card-remove` with `data-action="remove"`
    - `.card-art` with `<img src="data/img/<image>">` or `.placeholder` when image missing/empty
    - `.card-stats` showing SZ/TMM/MV/Role and S·M·L·OV
    - `.pips` — one `.pip` button per armor pip with `data-action="armor" data-index="n"`; `.pip.damaged` when `n < armorDamage`; same for structure with `data-action="struct"`
    - `.heat-btn` buttons with `data-heat="1|2|3|S"`, `.active` on current, `.shutdown.active` when heat === "S"
    - `.crit-slot` buttons with `data-crit="n"`, `.filled` when crits[n]
    - `.card-abilities` `.ability` chips
  - `onAction` is called as `onAction(action, indexOrValue)` for every interactive element; renderer attaches no listeners.

- [ ] **Step 1: Write the failing tests**

`tests/cards.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderCard } from "../site/js/cards.js";
import { createEntry } from "../site/js/state.js";

const unit = {
  id: "atlas-as7-d", class: "ATLAS", variant: "AS7-D", type: "BM",
  size: 4, tmm: 1, move: "6", role: "Juggernaut", skill: 4,
  damage: { s: 5, m: 5, l: 2 }, overheat: 0,
  armor: 3, structure: 2, pv: 52,
  abilities: ["AC2/2/-", "IF1"], image: "atlas-rg.png",
};

function render(unit, entry) {
  const dom = new JSDOM("<!DOCTYPE html><body></body>");
  return renderCard(unit, entry, () => {});
}

test("renderCard shows identity, stats, pv", () => {
  const card = render(unit, createEntry(unit));
  assert.equal(card.querySelector(".card-title").textContent, "ATLAS");
  assert.equal(card.querySelector(".card-variant").textContent, "AS7-D");
  assert.equal(card.querySelector(".card-pv").textContent, "PV 52");
  assert.match(card.querySelector(".card-stats").textContent, /SZ\s*4/);
  assert.match(card.querySelector(".card-stats").textContent, /S\s*5\s*M\s*5\s*L\s*2/);
});

test("renderCard shows artwork when image present, placeholder when not", () => {
  const withImg = render(unit, createEntry(unit));
  assert.ok(withImg.querySelector(".card-art img"));
  assert.equal(withImg.querySelector(".card-art img").getAttribute("src"), "data/img/atlas-rg.png");
  const noImg = render({ ...unit, image: "" }, createEntry(unit));
  assert.ok(noImg.querySelector(".card-art .placeholder"));
});

test("renderCard renders armor and structure pips with damage", () => {
  let entry = createEntry(unit);
  entry = { ...entry, armorDamage: 2, structDamage: 1 };
  const card = render(unit, entry);
  const armorPips = card.querySelectorAll('.pip[data-action="armor"]');
  assert.equal(armorPips.length, 3);
  assert.equal(card.querySelectorAll('.pip[data-action="armor"].damaged').length, 2);
  const structPips = card.querySelectorAll('.pip[data-action="struct"]');
  assert.equal(structPips.length, 2);
  assert.equal(card.querySelectorAll('.pip[data-action="struct"].damaged').length, 1);
});

test("renderCard renders heat buttons and crit slots", () => {
  let entry = createEntry(unit);
  entry = { ...entry, heat: "S", crits: Array(12).fill(false).map((_, i) => i === 2) };
  const card = render(unit, entry);
  const heatBtns = card.querySelectorAll(".heat-btn");
  assert.equal(heatBtns.length, 4);
  assert.ok(card.querySelector('.heat-btn[data-heat="S"].active.shutdown'));
  const crits = card.querySelectorAll(".crit-slot");
  assert.equal(crits.length, 12);
  assert.ok(card.querySelector('.crit-slot[data-crit="2"].filled'));
});

test("renderCard renders ability chips", () => {
  const card = render(unit, createEntry(unit));
  const chips = [...card.querySelectorAll(".ability")].map(e => e.textContent);
  assert.deepEqual(chips, ["AC2/2/-", "IF1"]);
});

test("renderCard wires data attributes for delegation", () => {
  const card = render(unit, createEntry(unit));
  assert.equal(card.getAttribute("data-unit-id"), "atlas-as7-d");
  assert.ok(card.querySelector('.card-remove[data-action="remove"]'));
  assert.ok(card.querySelector('.pip[data-action="armor"][data-index="0"]'));
  assert.ok(card.querySelector('.pip[data-action="struct"][data-index="0"]'));
  assert.ok(card.querySelector('.crit-slot[data-crit="11"]'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../site/js/cards.js`.

- [ ] **Step 3: Write `site/js/cards.js`**

```js
import { createEntry, HEAT_LEVELS, CRIT_SLOTS } from "./state.js";

function track(label, action, total, damage) {
  const pips = [];
  for (let i = 0; i < total; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pip";
    btn.dataset.action = action;
    btn.dataset.index = String(i);
    if (i < damage) btn.classList.add("damaged");
    pips.push(btn);
  }
  const wrap = document.createElement("div");
  wrap.className = "track";
  const labelEl = document.createElement("div");
  labelEl.className = "track-label";
  labelEl.textContent = label;
  const pipsEl = document.createElement("div");
  pipsEl.className = "pips";
  pipsEl.append(...pips);
  wrap.append(labelEl, pipsEl);
  return wrap;
}

export function renderCard(unit, entry = createEntry(unit)) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.unitId = unit.id;

  const head = document.createElement("header");
  head.className = "card-head";
  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = unit.class;
  const variant = document.createElement("span");
  variant.className = "card-variant";
  variant.textContent = unit.variant;
  const pv = document.createElement("span");
  pv.className = "card-pv";
  pv.textContent = `PV ${unit.pv}`;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "card-remove";
  remove.dataset.action = "remove";
  remove.setAttribute("aria-label", "Remove unit");
  remove.textContent = "✕";
  head.append(title, variant, pv, remove);

  const art = document.createElement("div");
  art.className = "card-art";
  if (unit.image) {
    const img = document.createElement("img");
    img.src = `data/img/${unit.image}`;
    img.alt = `${unit.class} ${unit.variant}`;
    img.loading = "lazy";
    art.append(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "placeholder";
    ph.textContent = unit.class.slice(0, 2);
    art.append(ph);
  }

  const stats = document.createElement("div");
  stats.className = "card-stats";
  const row1 = document.createElement("div");
  row1.textContent = `SZ ${unit.size}  TMM ${unit.tmm}  MV ${unit.move}`;
  const row2 = document.createElement("div");
  row2.textContent = `Role: ${unit.role}`;
  const row3 = document.createElement("div");
  row3.textContent = `S ${unit.damage.s}  M ${unit.damage.m}  L ${unit.damage.l}`;
  const row4 = document.createElement("div");
  row4.textContent = `OV ${unit.overheat}`;
  stats.append(row1, row2, row3, row4);

  const tracks = document.createElement("div");
  tracks.className = "card-tracks";
  tracks.append(
    track("ARMOR", "armor", unit.armor, entry.armorDamage),
    track("STRUCTURE", "struct", unit.structure, entry.structDamage),
  );

  const heat = document.createElement("div");
  heat.className = "card-heat";
  const heatLabel = document.createElement("div");
  heatLabel.className = "track-label";
  heatLabel.textContent = "HEAT";
  heat.append(heatLabel);
  for (const level of HEAT_LEVELS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "heat-btn";
    btn.dataset.heat = String(level);
    btn.textContent = String(level);
    if (entry.heat === level) {
      btn.classList.add("active");
      if (level === "S") btn.classList.add("shutdown");
    }
    heat.append(btn);
  }

  const crits = document.createElement("div");
  crits.className = "card-crits";
  const critLabel = document.createElement("div");
  critLabel.className = "track-label";
  critLabel.textContent = "CRITS";
  const critGrid = document.createElement("div");
  critGrid.className = "crit-grid";
  for (let i = 0; i < CRIT_SLOTS; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "crit-slot";
    btn.dataset.crit = String(i);
    btn.setAttribute("aria-label", `Crit slot ${i + 1}`);
    if (entry.crits[i]) btn.classList.add("filled");
    critGrid.append(btn);
  }
  crits.append(critLabel, critGrid);

  const abilities = document.createElement("footer");
  abilities.className = "card-abilities";
  for (const ability of unit.abilities || []) {
    const chip = document.createElement("span");
    chip.className = "ability";
    chip.textContent = ability;
    abilities.append(chip);
  }

  card.append(head, art, stats, tracks, heat, crits, abilities);
  return card;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (state + search + cards).

- [ ] **Step 5: Commit**

```bash
git add site/js/cards.js tests/cards.test.js
git commit -m "feat: card renderer with data-attribute delegation surface"
```

---

### Task 6: App wiring — picker, roster, header

**Files:**
- Create: `site/js/app.js`
- Test: `tests/app.test.js`

**Interfaces:**
- Consumes: `filterUnits`, `uniqueTypes` (Task 4); `renderCard` (Task 5); `loadState`, `saveState` (Task 7 — stub first, real next task); `slugifyUnit`.
- Produces: `init({ fetchImpl, doc, storage })` — idempotent app bootstrap. When loaded in a browser, auto-runs `init()`. In tests, set `window.__AS_MANUAL__ = true` before importing, then call `init()` with stubs.
  - DOM wiring: search input → re-render picker list; type filter (options from `uniqueTypes`) → re-render; picker item click → add entry to roster; roster click delegation → `armor`/`struct` (index from `data-index`), `heat` (value from `data-heat`), `crit` (index), `remove` (unit id from closest `.card`); `#btn-clear` → empty roster; `#force-pv` shows sum of roster unit PVs; `#roster-empty` hidden when roster non-empty; `#picker-toggle` collapses/expands `.picker`.
  - Every state mutation → `storage.save(state)` then re-render roster + PV.
  - Roster renders as `renderCard(unit, entry)` appended to `#roster`; `data-unit-id` on each card maps back to the unit record via `unitById` map.

- [ ] **Step 1: Write the failing tests**

`tests/app.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { slugifyUnit } from "../site/js/state.js";

const UNITS = [
  { id: slugifyUnit("ATLAS", "AS7-D"), class: "ATLAS", variant: "AS7-D", type: "BM", size: 4, tmm: 1, move: "6", role: "Juggernaut", skill: 4, damage: { s: 5, m: 5, l: 2 }, overheat: 0, armor: 10, structure: 8, pv: 52, abilities: [], image: "" },
  { id: slugifyUnit("ATLAS", "AS7-K"), class: "ATLAS", variant: "AS7-K", type: "BM", size: 4, tmm: 1, move: "6", role: "Sniper", skill: 4, damage: { s: 4, m: 4, l: 3 }, overheat: 0, armor: 10, structure: 8, pv: 49, abilities: [], image: "" },
  { id: slugifyUnit("Trooper", "TP-1R"), class: "Trooper", variant: "TP-1R", type: "UNK", size: 1, tmm: 0, move: "12\"", role: "Scout", skill: 4, damage: { s: 1, m: 1, l: 0 }, overheat: 0, armor: 2, structure: 1, pv: 14, abilities: [], image: "" },
];

async function boot({ state = { roster: [] } } = {}) {
  const html = readFileSync("site/index.html", "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ units: UNITS }) });
  window.__AS_MANUAL__ = true;
  const app = await import("../site/js/app.js");
  const saved = [];
  const storage = {
    loadState: () => state,
    saveState: s => saved.push(s),
  };
  await app.init({ doc: window.document, storage });
  return { window, document: window.document, saved, app };
}

test("init loads units, populates type filter and picker", async () => {
  const { document } = await boot();
  const options = [...document.querySelectorAll("#type-filter option")].map(o => o.value);
  assert.deepEqual(options, ["", "BM"]);
  const items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 3);
  assert.match(items[0].textContent, /ATLAS/);
});

test("search narrows picker; type filter excludes UNK", async () => {
  const { document } = await boot();
  const input = document.getElementById("search");
  input.value = "as7-k";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  let items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /AS7-K/);
  input.value = "";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  const filter = document.getElementById("type-filter");
  filter.value = "BM";
  filter.dispatchEvent(new window.Event("change", { bubbles: true }));
  items = document.querySelectorAll("#picker-list li");
  assert.equal(items.length, 2);
});

test("adding units renders cards and updates force PV", async () => {
  const { document } = await boot();
  const first = document.querySelector("#picker-list li button");
  first.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  first.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const cards = document.querySelectorAll("#roster .card");
  assert.equal(cards.length, 2);
  assert.equal(document.getElementById("force-pv").textContent, "Force PV: 104");
  assert.equal(document.getElementById("roster-empty").style.display, "none");
});

test("roster click delegation applies armor damage and saves", async () => {
  const { document, saved } = await boot();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const pip = document.querySelector('#roster .card .pip[data-action="armor"][data-index="2"]');
  pip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll('#roster .card .pip[data-action="armor"].damaged').length, 3);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].roster[0].armorDamage, 3);
});

test("heat, crit, and remove actions", async () => {
  const { document } = await boot();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const heatBtn = document.querySelector('#roster .heat-btn[data-heat="2"]');
  heatBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.ok(document.querySelector('#roster .heat-btn[data-heat="2"].active'));
  const crit = document.querySelector('#roster .crit-slot[data-crit="4"]');
  crit.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.ok(document.querySelector('#roster .crit-slot[data-crit="4"].filled'));
  document.querySelector('#roster .card-remove').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 0);
  assert.equal(document.getElementById("roster-empty").style.display, "");
});

test("picker toggle collapses the list", async () => {
  const { document } = await boot();
  const picker = document.getElementById("picker");
  assert.ok(!picker.classList.contains("collapsed"));
  document.getElementById("picker-toggle").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.ok(picker.classList.contains("collapsed"));
});

test("clear force empties roster and saves", async () => {
  const { document, saved } = await boot();
  document.querySelector("#picker-list li button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  document.getElementById("btn-clear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelectorAll("#roster .card").length, 0);
  assert.deepEqual(saved.at(-1).roster, []);
});
```

Note: `boot()` must be called fresh per test; `globalThis` overrides live per call. The heat/crit/remove test references `window` from `boot()`'s return.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../site/js/app.js`.

- [ ] **Step 3: Write `site/js/app.js`**

```js
import { filterUnits, uniqueTypes } from "./search.js";
import { renderCard } from "./cards.js";
import {
  createEntry, damageArmor, damageStruct, setHeat, toggleCrit, slugifyUnit,
} from "./state.js";

const SAVE_DEBOUNCE_MS = 0;

let _doc = null;
let _storage = null;
let _units = [];
let _unitById = new Map();
let _state = { roster: [] };
let _saveTimer = null;

function el(id) {
  return _doc.getElementById(id);
}

function persist() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => _storage.saveState(_state), SAVE_DEBOUNCE_MS);
}

function renderPicker() {
  const query = el("search").value;
  const type = el("type-filter").value;
  const list = el("picker-list");
  list.innerHTML = "";
  const matches = filterUnits(_units, { query, type });
  for (const unit of matches) {
    const li = _doc.createElement("li");
    const btn = _doc.createElement("button");
    btn.type = "button";
    btn.dataset.unitId = unit.id;
    const label = _doc.createElement("span");
    label.textContent = `${unit.class} ${unit.variant}`;
    const typeTag = _doc.createElement("span");
    typeTag.className = "type";
    typeTag.textContent = unit.type;
    const pv = _doc.createElement("span");
    pv.className = "pv";
    pv.textContent = `PV ${unit.pv}`;
    btn.append(label, typeTag, pv);
    li.append(btn);
    list.append(li);
  }
}

function renderRoster() {
  const roster = el("roster");
  roster.querySelectorAll(".card").forEach(c => c.remove());
  const empty = el("roster-empty");
  let totalPv = 0;
  for (const entry of _state.roster) {
    const unit = _unitById.get(entry.unitId);
    if (!unit) continue;
    totalPv += unit.pv;
    roster.append(renderCard(unit, entry));
  }
  el("force-pv").textContent = `Force PV: ${totalPv}`;
  empty.style.display = _state.roster.length ? "none" : "";
}

function updateEntry(unitId, mutate) {
  const idx = _state.roster.findIndex(e => e.unitId === unitId);
  if (idx === -1) return;
  const unit = _unitById.get(unitId);
  const next = mutate(_state.roster[idx], unit);
  _state = { ..._state, roster: _state.roster.map((e, i) => (i === idx ? next : e)) };
  persist();
  renderRoster();
}

export async function init({ doc, storage }) {
  _doc = doc;
  _storage = storage;
  const res = await fetch("data/units.json");
  if (!res.ok) throw new Error(`Failed to load units.json: ${res.status}`);
  const payload = await res.json();
  _units = payload.units;
  _unitById = new Map(_units.map(u => [u.id, u]));
  _state = _storage.loadState() || { roster: [] };

  const typeFilter = el("type-filter");
  for (const type of uniqueTypes(_units)) {
    const opt = _doc.createElement("option");
    opt.value = type;
    opt.textContent = type;
    typeFilter.append(opt);
  }

  el("search").addEventListener("input", renderPicker);
  typeFilter.addEventListener("change", renderPicker);

  el("picker-list").addEventListener("click", e => {
    const btn = e.target.closest("button[data-unit-id]");
    if (!btn) return;
    const unit = _unitById.get(btn.dataset.unitId);
    if (!unit) return;
    _state = { ..._state, roster: [..._state.roster, createEntry(unit)] };
    persist();
    renderRoster();
    renderPicker();
  });

  el("roster").addEventListener("click", e => {
    const card = e.target.closest(".card");
    if (!card) return;
    const unitId = card.dataset.unitId;
    if (e.target.dataset.action === "remove") {
      _state = { ..._state, roster: _state.roster.filter(entry => entry.unitId !== unitId) };
      persist();
      renderRoster();
      return;
    }
    if (e.target.dataset.action === "armor") {
      updateEntry(unitId, (entry, unit) => damageArmor(entry, unit, Number(e.target.dataset.index)));
      return;
    }
    if (e.target.dataset.action === "struct") {
      updateEntry(unitId, (entry, unit) => damageStruct(entry, unit, Number(e.target.dataset.index)));
      return;
    }
    if (e.target.dataset.heat) {
      updateEntry(unitId, entry => setHeat(entry, e.target.dataset.heat === "S" ? "S" : Number(e.target.dataset.heat)));
      return;
    }
    if (e.target.dataset.crit) {
      updateEntry(unitId, entry => toggleCrit(entry, Number(e.target.dataset.crit)));
    }
  });

  el("btn-clear").addEventListener("click", () => {
    _state = { roster: [] };
    persist();
    renderRoster();
  });

  el("picker-toggle").addEventListener("click", () => {
    el("picker").classList.toggle("collapsed");
  });

  el("btn-export").addEventListener("click", () => {
    const { exportBlob } = _storage;
    if (!exportBlob) return;
    const { filename, text } = exportBlob(_state);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = _doc.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  el("btn-import").addEventListener("click", () => el("import-file").click());
  el("import-file").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      _state = _storage.importState(text);
      persist();
      renderRoster();
    } catch (err) {
      window.alert(`Import failed: ${err.message}`);
    }
    e.target.value = "";
  });

  renderPicker();
  renderRoster();
}

if (typeof window !== "undefined" && !window.__AS_MANUAL__) {
  init({
    doc: document,
    storage: {
      loadState: () => JSON.parse(localStorage.getItem("as-companion-state-v1") || "null"),
      saveState: s => localStorage.setItem("as-companion-state-v1", JSON.stringify(s)),
      exportBlob: s => ({ filename: "as-companion-state.json", text: JSON.stringify(s, null, 2) }),
      importState: text => {
        const s = JSON.parse(text);
        if (!s || !Array.isArray(s.roster)) throw new Error("missing roster array");
        return s;
      },
    },
  });
}
```

Note: `window.alert` is called in the import error path only; tests will not trigger it. The `storage` stub passed by tests must implement `loadState`, `saveState`, `exportBlob`, `importState` — Task 7 makes the real `site/js/storage.js` provide them.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS. If a test fails due to `globalThis` leakage between tests, add at the top of `boot()`:

```js
delete globalThis.fetch;
```

(and remove the earlier `globalThis.fetch` assignment ordering issue by assigning after `window.__AS_MANUAL__`).

- [ ] **Step 5: Commit**

```bash
git add site/js/app.js tests/app.test.js
git commit -m "feat: app wiring — picker, roster, header, delegated card actions"
```

---

### Task 7: Persistence — storage module + export/import

**Files:**
- Create: `site/js/storage.js`
- Modify: `site/js/app.js` (browser bootstrap uses `storage.js`)
- Test: `tests/storage.test.js`

**Interfaces:**
- Consumes: `isEntryValid` (Task 4), unit records.
- Produces:
  - `loadState() → {roster: []} | parsed state` (never throws; corrupted JSON → default)
  - `saveState(state)` (JSON.stringify into localStorage under `as-companion-state-v1`)
  - `validateState(obj, unitById) → boolean` — `roster` is array; every entry has `unitId` present in `unitById` and `isEntryValid(entry, unit)`; invalid entries dropped, valid kept; non-array → false
  - `sanitizeState(obj, unitById) → state` — drops invalid entries, clamps damage via re-creation from unit (`{...entry, armorDamage: min(...)}`), pads/truncates crits to 12; returns `{roster}` always
  - `exportBlob(state) → {filename, text}` — `filename = "as-companion-state.json"`, pretty JSON
  - `importState(text, unitById) → state` — throws `Error` on parse failure or non-object; returns `sanitizeState` otherwise
  - `makeStorage(unitById)` → object with all five methods bound (used by app)

- [ ] **Step 1: Write the failing tests**

`tests/storage.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  loadState, saveState, validateState, sanitizeState, exportBlob, importState, makeStorage,
} from "../site/js/storage.js";
import { slugifyUnit } from "../site/js/state.js";

const UNITS = [
  { id: slugifyUnit("ATLAS", "AS7-D"), class: "ATLAS", variant: "AS7-D", type: "BM", size: 4, tmm: 1, move: "6", role: "Juggernaut", skill: 4, damage: { s: 5, m: 5, l: 2 }, overheat: 0, armor: 10, structure: 8, pv: 52, abilities: [], image: "" },
];
const unitById = new Map(UNITS.map(u => [u.id, u]));
const GOOD = { roster: [{ unitId: "atlas-as7-d", armorDamage: 3, structDamage: 1, heat: 2, crits: Array(12).fill(false) }] };

function freshLocalStorage() {
  const dom = new JSDOM("", { url: "http://localhost/" });
  return dom.window.localStorage;
}

test("saveState/loadState roundtrip through localStorage", () => {
  const ls = freshLocalStorage();
  saveState(GOOD, ls);
  assert.deepEqual(loadState(ls), GOOD);
});

test("loadState returns default on missing and corrupt data", () => {
  const ls = freshLocalStorage();
  assert.deepEqual(loadState(ls), { roster: [] });
  ls.setItem("as-companion-state-v1", "{not json");
  assert.deepEqual(loadState(ls), { roster: [] });
});

test("validateState rejects bad entries", () => {
  assert.equal(validateState(GOOD, unitById), true);
  assert.equal(validateState({ roster: [{ unitId: "nope", armorDamage: 0, structDamage: 0, heat: 0, crits: Array(12).fill(false) }] }, unitById), false);
  assert.equal(validateState({ roster: [{ unitId: "atlas-as7-d", armorDamage: 99, structDamage: 0, heat: 0, crits: Array(12).fill(false) }] }, unitById), false);
  assert.equal(validateState({ roster: "nope" }, unitById), false);
  assert.equal(validateState(null, unitById), false);
});

test("sanitizeState clamps and drops invalid", () => {
  const s = sanitizeState({
    roster: [
      { unitId: "atlas-as7-d", armorDamage: 99, structDamage: -2, heat: "X", crits: [true] },
      { unitId: "ghost", armorDamage: 0, structDamage: 0, heat: 0, crits: Array(12).fill(false) },
      { unitId: "atlas-as7-d", armorDamage: 4, structDamage: 2, heat: "S", crits: Array(12).fill(false).map((_, i) => i === 0) },
    ],
  }, unitById);
  assert.equal(s.roster.length, 2);
  assert.equal(s.roster[0].armorDamage, 10);
  assert.equal(s.roster[0].structDamage, 0);
  assert.equal(s.roster[0].heat, 0);
  assert.equal(s.roster[0].crits.length, 12);
  assert.equal(s.roster[1].crits[0], true);
});

test("exportBlob produces filename and JSON text", () => {
  const { filename, text } = exportBlob(GOOD);
  assert.equal(filename, "as-companion-state.json");
  assert.deepEqual(JSON.parse(text), GOOD);
});

test("importState roundtrips and throws on garbage", () => {
  assert.deepEqual(importState(JSON.stringify(GOOD), unitById), GOOD);
  assert.throws(() => importState("not json", unitById), /parse/i);
  assert.throws(() => importState("null", unitById), /roster/);
});

test("makeStorage binds methods to one object", () => {
  const ls = freshLocalStorage();
  const storage = makeStorage(unitById, ls);
  assert.equal(typeof storage.loadState, "function");
  assert.equal(typeof storage.saveState, "function");
  assert.equal(typeof storage.exportBlob, "function");
  assert.equal(typeof storage.importState, "function");
  storage.saveState(GOOD);
  assert.deepEqual(storage.loadState(), GOOD);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../site/js/storage.js`.

- [ ] **Step 3: Write `site/js/storage.js`**

```js
import { CRIT_SLOTS, isEntryValid } from "./state.js";

export const STORAGE_KEY = "as-companion-state-v1";

export const DEFAULT_STATE = { roster: [] };

export function loadState(ls = globalThis.localStorage) {
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.roster) ? parsed : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state, ls = globalThis.localStorage) {
  ls.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function validateState(obj, unitById) {
  if (!obj || !Array.isArray(obj.roster)) return false;
  return obj.roster.every(entry => {
    const unit = unitById.get(entry.unitId);
    return unit && isEntryValid(entry, unit);
  });
}

export function sanitizeState(obj, unitById) {
  if (!obj || !Array.isArray(obj.roster)) return DEFAULT_STATE;
  const roster = obj.roster
    .filter(entry => entry && unitById.has(entry.unitId))
    .map(entry => {
      const unit = unitById.get(entry.unitId);
      const armorDamage = Math.max(0, Math.min(unit.armor, Number(entry.armorDamage) || 0));
      const structDamage = Math.max(0, Math.min(unit.structure, Number(entry.structDamage) || 0));
      const heat = [0, 1, 2, 3, "S"].includes(entry.heat) ? entry.heat : 0;
      const crits = Array.from({ length: CRIT_SLOTS }, (_, i) => Boolean(entry.crits && entry.crits[i]));
      return { unitId: entry.unitId, armorDamage, structDamage, heat, crits };
    });
  return { roster };
}

export function exportBlob(state) {
  return {
    filename: "as-companion-state.json",
    text: JSON.stringify(state, null, 2),
  };
}

export function importState(text, unitById) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("parse failed");
  }
  if (!parsed || !Array.isArray(parsed.roster)) {
    throw new Error("missing roster array");
  }
  return sanitizeState(parsed, unitById);
}

export function makeStorage(unitById, ls = globalThis.localStorage) {
  return {
    loadState: () => loadState(ls),
    saveState: s => saveState(s, ls),
    validateState: obj => validateState(obj, unitById),
    sanitizeState: obj => sanitizeState(obj, unitById),
    exportBlob,
    importState: text => importState(text, unitById),
  };
}
```

- [ ] **Step 4: Update `site/js/app.js` browser bootstrap to use storage.js**

Replace the inline `storage` object in the auto-init block with:

```js
if (typeof window !== "undefined" && !window.__AS_MANUAL__) {
  init({ doc: document, storage: makeStorage(null, window.localStorage) });
}
```

and add to the imports:

```js
import { makeStorage } from "./storage.js";
```

`makeStorage(null, ...)` defers unit lookup: `validateState`/`importState` would crash on `null.get` — so `app.js` must re-bind after units load. Change `init` to accept an optional `buildStorage` callback: in `init`, after `_unitById` is built:

```js
if (!storage.importState) {
  storage = makeStorage(_unitById, _doc.defaultView.localStorage);
}
```

(The test stub storage implements all methods, so it is left untouched.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (storage + all prior suites). Then re-run Task 6 app tests — still PASS.

- [ ] **Step 6: Commit**

```bash
git add site/js/storage.js site/js/app.js tests/storage.test.js
git commit -m "feat: storage module with validation, sanitize, export/import"
```

---

### Task 8: Journey tests — full game-night flows

**Files:**
- Test: `tests/journey.test.js`

**Interfaces:**
- Consumes: everything from Tasks 2–7. Reuses the jsdom boot harness pattern from Task 6, but with a real `makeStorage` bound to jsdom localStorage, real fetch stub, and `window.__AS_MANUAL__ = true`.

- [ ] **Step 1: Write the failing tests**

`tests/journey.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { slugifyUnit } from "../site/js/state.js";
import { makeStorage } from "../site/js/storage.js";

const UNITS = [
  { id: slugifyUnit("ATLAS", "AS7-D"), class: "ATLAS", variant: "AS7-D", type: "BM", size: 4, tmm: 1, move: "6", role: "Juggernaut", skill: 4, damage: { s: 5, m: 5, l: 2 }, overheat: 0, armor: 10, structure: 8, pv: 52, abilities: ["AC2/2/-", "IF1"], image: "" },
  { id: slugifyUnit("AWESOME", "AWS-8Q"), class: "AWESOME", variant: "AWS-8Q", type: "BM", size: 4, tmm: 0, move: "5", role: "Sniper", skill: 4, damage: { s: 5, m: 5, l: 5 }, overheat: 1, armor: 12, structure: 10, pv: 44, abilities: ["ENE"], image: "" },
  { id: slugifyUnit("Demolisher Heavy Tank", "Std"), class: "Demolisher Heavy Tank", variant: "Std", type: "CV", size: 4, tmm: 0, move: "4\"", role: "Juggernaut", skill: 4, damage: { s: 6, m: 4, l: 2 }, overheat: 0, armor: 10, structure: 6, pv: 36, abilities: [], image: "" },
];

async function boot() {
  const html = readFileSync("site/index.html", "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ units: UNITS }) });
  window.__AS_MANUAL__ = true;
  const app = await import("../site/js/app.js");
  const storage = makeStorage(new Map(UNITS.map(u => [u.id, u])), window.localStorage);
  await app.init({ doc: window.document, storage });
  return { window, document: window.document, storage };
}

function click(el, win) {
  el.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
}

test("JOURNEY: full game night — deploy, damage, heat, crits, refresh, export/import", async () => {
  const { window, document, storage } = await boot();

  // Deploy an Atlas and an Awesome via search
  const search = document.getElementById("search");
  search.value = "atlas";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  let items = [...document.querySelectorAll("#picker-list li button")];
  assert.equal(items.length, 1);
  click(items[0], window);

  search.value = "awesome";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  items = [...document.querySelectorAll("#picker-list li button")];
  assert.equal(items.length, 1);
  click(items[0], window);

  assert.equal(document.querySelectorAll("#roster .card").length, 2);
  assert.equal(document.getElementById("force-pv").textContent, "Force PV: 96");

  // Fight: Atlas takes 6 armor, 2 structure, heat 2, 3 crits
  const atlasCard = document.querySelector('#roster .card[data-unit-id="atlas-as7-d"]');
  click(atlasCard.querySelector('.pip[data-action="armor"][data-index="5"]'), window);
  click(atlasCard.querySelector('.pip[data-action="struct"][data-index="1"]'), window);
  click(atlasCard.querySelector('.heat-btn[data-heat="2"]'), window);
  for (const i of [0, 1, 2]) click(atlasCard.querySelector(`.crit-slot[data-crit="${i}"]`), window);

  // Awesome untouched
  const awesomeCard = document.querySelector('#roster .card[data-unit-id="awesome-aws-8q"]');
  assert.equal(awesomeCard.querySelectorAll(".pip.damaged").length, 0);

  // Verify Atlas state
  assert.equal(atlasCard.querySelectorAll('.pip[data-action="armor"].damaged').length, 6);
  assert.equal(atlasCard.querySelectorAll('.pip[data-action="struct"].damaged').length, 2);
  assert.ok(atlasCard.querySelector('.heat-btn[data-heat="2"].active'));
  assert.equal(atlasCard.querySelectorAll(".crit-slot.filled").length, 3);

  // Refresh simulation: fresh app boot reads persisted localStorage
  const { document: doc2 } = await boot();
  assert.equal(doc2.querySelectorAll("#roster .card").length, 2);
  const restored = doc2.querySelector('#roster .card[data-unit-id="atlas-as7-d"]');
  assert.equal(restored.querySelectorAll('.pip[data-action="armor"].damaged').length, 6);
  assert.ok(restored.querySelector('.heat-btn[data-heat="2"].active'));
  assert.equal(restored.querySelectorAll(".crit-slot.filled").length, 3);
  assert.equal(doc2.getElementById("force-pv").textContent, "Force PV: 96");

  // Export from the refreshed app, import into a fresh profile
  const exported = storage.exportBlob(JSON.parse(window.localStorage.getItem("as-companion-state-v1")));
  const { window: w3, document: doc3, storage: s3 } = await boot();
  const imported = s3.importState(exported.text, new Map(UNITS.map(u => [u.id, u])));
  s3.saveState(imported);
  const { document: doc4 } = await boot();
  assert.equal(doc4.querySelectorAll("#roster .card").length, 2);
  const restored2 = doc4.querySelector('#roster .card[data-unit-id="atlas-as7-d"]');
  assert.equal(restored2.querySelectorAll('.pip[data-action="armor"].damaged').length, 6);

  // Clear force
  click(doc4.getElementById("btn-clear"), w3);
  assert.equal(doc4.querySelectorAll("#roster .card").length, 0);
  assert.equal(doc4.getElementById("force-pv").textContent, "Force PV: 0");
});

test("JOURNEY: search and type-filter interaction", async () => {
  const { window, document } = await boot();
  const search = document.getElementById("search");
  const filter = document.getElementById("type-filter");

  search.value = "a";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(document.querySelectorAll("#picker-list li").length, 3);

  filter.value = "CV";
  filter.dispatchEvent(new window.Event("change", { bubbles: true }));
  let items = [...document.querySelectorAll("#picker-list li button")];
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /Demolisher/);

  filter.value = "";
  filter.dispatchEvent(new window.Event("change", { bubbles: true }));
  search.value = "AS7";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  items = [...document.querySelectorAll("#picker-list li button")];
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /AS7-D/);

  // Reset both → everything back
  search.value = "";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(document.querySelectorAll("#picker-list li").length, 3);
});
```

Note: the second journey test re-uses `boot()`, which reads persisted localStorage from the first test — jsdom localStorage is per-`JSDOM` instance, so each `boot()` starts empty. No cross-test leakage.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: journey suite FAIL (app not yet loading units under `init` with the storage module binding) — fix any wiring mismatch surfaced by the failure.

- [ ] **Step 3: Make the journeys pass**

Run: `npm test`
Expected: ALL PASS. If `init` throws because the stub/real storage mixing, confirm `app.js` re-binds via `makeStorage(_unitById, ...)` when `storage.importState` is absent (Task 7 Step 4) and the journey harness passes a full `makeStorage` object.

- [ ] **Step 4: Commit**

```bash
git add tests/journey.test.js
git commit -m "test: journey tests — deploy, damage, heat, crits, persistence, export/import"
```

---

### Task 9: Final verification + README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything.

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: all tests PASS (site structure, state, search, cards, app, storage, journey).

- [ ] **Step 2: Rebuild data and re-verify**

Run: `npm run build:data`
Expected: `Wrote 6888 units, 1594 images` and `Total: 6888 units`.

- [ ] **Step 3: Write `README.md`**

```markdown
# Alpha Strike — Tabletop Companion

A zero-build static website for BattleTech: Alpha Strike. Pick units from the
Master Unit List archive, deploy them as scrollable cards, and track
armor/structure damage, heat, and crits during a game. State auto-saves to
localStorage; export/import JSON transfers a force between devices.

## Data

Unit data (6888 variants) and artwork come from the Master Unit List archive
cloned at `Alpha-Strike-Tool/` (https://github.com/treverhw/Alpha-Strike-Tool).
The official MUL website is offline; its data was scraped into that repo.

## Build (one time)

```bash
npm install        # dev deps only (jsdom)
npm run build:data # python3 tools/build_data.py → site/data/
```

## Run

```bash
npm run serve      # http://localhost:8000
```

Or serve `site/` from any static host (GitHub Pages, Netlify, S3, …).

## Test

```bash
npm test           # node:test + jsdom: unit, integration, journey
python3 -m unittest tools.test_build_data -v
```

## Usage

1. Search/filter in the unit picker; click a unit to deploy it.
2. Click armor/structure pips to mark damage; use HEAT 1/2/3/S; click crit
   slots to mark critical hits.
3. State persists automatically. Export saves a JSON file; Import restores it
   on any device.
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run serve`, open http://localhost:8000, and verify: picker loads
units, adding renders cards, pips/heat/crits respond, refresh restores state,
export/import roundtrips, clear force empties roster.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: README with build, run, and test instructions"
```

---

## Self-Review

**Spec coverage:**
- Data pipeline ✓ (Task 2), units.json schema ✓ (Task 2), artwork copy ✓ (Task 2)
- Static site shell + BattleTech palette ✓ (Task 3)
- Header: PV total ✓ (Task 6), search ✓ (Task 6), type filter ✓ (Task 6), clear ✓ (Task 6), export/import ✓ (Task 7)
- Picker: persistent + collapsible ✓ (Task 6)
- Roster: horizontal scroll ✓ (Task 3 CSS), remove per card ✓ (Task 6)
- Card layout: title/variant/PV ✓ (Task 5), artwork + placeholder ✓ (Task 5), stats row ✓ (Task 5), armor/structure pips ✓ (Task 5), heat 1/2/3/S ✓ (Task 5), crits 12 slots ✓ (Task 5), abilities chips ✓ (Task 5)
- State: auto-save localStorage ✓ (Task 6+7), export/import ✓ (Task 7), validation clamps ✓ (Task 4+7), reset force ✓ (Task 6)
- Error handling: units.json load failure ✓ (Task 6 throws), missing artwork placeholder ✓ (Task 5), malformed import alert ✓ (Task 6+7)
- Tests: unit (Task 4, 7), integration (Task 3, 5, 6), journey (Task 8) ✓ — user requirement
- Out of scope honored: no sync, no PV budgeting, no era filter, no PWA ✓

**Placeholder scan:** All code blocks complete; no TBD/TODO; test code written in full.

**Type consistency:**
- `entry` shape `{unitId, armorDamage, structDamage, heat, crits}` consistent across state.js, storage.js, app.js, tests.
- `unit` shape consistent across build script, cards.js, storage.js, tests.
- `storage` interface `{loadState, saveState, exportBlob, importState}` matches between app.js bootstrap, test stubs, and makeStorage.
- `data-index`/`data-heat`/`data-crit`/`data-action` attributes consistent between cards.js renderer and app.js delegation.
- `slugifyUnit` vs build script `slugify` produce identical ids (both lowercase non-alnum → `-`).
- Task 6 app.js references `window` in the import-error path — journey tests never hit it; browser path fine.
