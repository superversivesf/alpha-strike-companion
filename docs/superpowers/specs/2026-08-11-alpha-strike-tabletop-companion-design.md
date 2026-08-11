# Alpha Strike Tabletop Companion — Design Spec

Date: 2026-08-11
Status: Approved by user (2026-08-11)

## Purpose

A static website that lets BattleTech: Alpha Strike players pick units from the
Master Unit List archive and play a game using on-screen, horizontally
scrollable unit cards. Players track damage, structure, heat, and crits
directly on the cards. Per-player state only — no multi-user sync.

## Data Source

`/home/jason/Repos/mul/Alpha-Strike-Tool/` (cloned GitHub archive, 489MB):

- `Units/<ClassName>/<Class Variant>.tres` — 1653 per-variant records containing
  every Alpha Strike card stat (PV, size, TMM, move, role, S/M/L damage, OV,
  armor, structure, abilities) plus image path.
- `Sprites/Units/*.png` — 3250 unit artwork images (104MB).

The official MUL site is gone, but its API
(`http://masterunitlist.info/Unit/QuickList`) is still live and was the source
for this archive. We build from the archived data, not the live API.

## Architecture

Pure static site. No build step, no frameworks, no backend.

```
site/
├── index.html
├── styles.css
├── app.js
├── data/
│   └── units.json          # built by pipeline script
└── data/img/
    └── <image-file>.png    # copied by pipeline script
```

Serving: any static host (GitHub Pages, Netlify, S3, or `python3 -m http.server`
locally). Works offline once loaded.

### Data pipeline (one-time build script)

`tools/build_data.py` (runs on repo root, not needed to serve):

1. Walk `Alpha-Strike-Tool/Units/**/*.tres`, parse `[resource]` key/value block.
2. Extract: variant, title, pv, type, sz, tmm, move, role, skill, damageS/M/L,
   ov, armor, struct, special abilities array, and the image filename.
3. Emit `site/data/units.json`:
   ```json
   {
     "units": [
       {
         "id": "atlas-as7-d",            // slug: class-variant, lowercased
         "class": "Atlas",
         "variant": "AS7-D",
         "type": "BM",
         "size": 4,
         "tmm": 0,
         "move": "8\"",
         "role": "Sniper",
         "damage": {"s": 5, "m": 5, "l": 4},
         "overheat": 0,
         "armor": 11,
         "structure": 9,
         "pv": 50,
         "abilities": ["HT1", "SRC"],
         "image": "atlas-as7-d.png"
       }
     ]
   }
   ```
4. Copy referenced artwork from `Sprites/Units/` into `site/data/img/` (only
   images actually referenced, deduped).
5. Sanity check: every unit renders (all required keys present, armor ≥ 1).

`.tres` format note (verified): fields are `key = value` lines; strings are
quoted; abilities are `Array[String]([...])`.

## UI Layout

### Header
- Title, force total PV (sum of roster PVs, updates live)
- Search box (name/variant/class substring, case-insensitive)
- Filter: unit type (BM, CV, AS, etc.) only. (Era is not stored per-unit in
  the `.tres` data, so no era filter.)
- Buttons: Clear force, Export, Import

### Unit picker
- Scrollable panel (left side or dropdown drawer) listing matches from
  `units.json`, each row shows class, variant, type, tonnage/PV
- Clicking a row adds it to the roster (duplicates allowed, e.g. two of the
  same mech)
- Picker hides/slides away once roster has units? No — keep persistent, collapsible.

### Roster strip
- Horizontal scroll row of cards under the header. One card per roster entry.
- Card remove button (✕) per card.

### Card layout (per unit)
```
┌────────────────────────────────┐
│  Atlas AS7-D          PV 50 ✕  │
│  [artwork 120px]  SZ 4 TMM 0   │
│  MV 8"  Role Sniper            │
│  S 5  M 5  L 4  OV 0           │
│  ARMOR ▮▮▮▮▮▮▮▮▮▮▮ (11 pips)   │
│  STRUCT ▮▮▮▮▮▮▮▮▮ (9 pips)     │
│  HEAT  1 2 3 S                  │
│  CRITS [grid of slots]          │
│  HT1 SRC                        │
└────────────────────────────────┘
```
- Armor pips: click toggles damaged (grey → red). Same for structure.
- Crit slots: fixed grid of 12 per card (Alpha Strike mech cards show crits);
  click toggles filled. Count not derived from stats — purely manual markup.
- Heat: buttons 1, 2, 3, S toggle heat level; mutually exclusive; S = shutdown.
  S is "armed" once any heat selected.
- Artwork top-right of card; if image file missing, show initials placeholder.

## State & Persistence

- All state in `localStorage` under key `as-companion-state-v1`:
  ```json
  {
    "roster": [
      {
        "unitId": "atlas-as7-d",
        "armorDamage": 3,
        "structDamage": 1,
        "heat": 2,
        "crits": [true, false, ...]  // 12 slots
      }
    ]
  }
  ```
- Auto-save on every click (debounced ~200ms).
- Damage validation: armorDamage ∈ [0, armor]; structDamage ∈ [0, structure];
  heat ∈ {0,1,2,3,S}; crits length fixed 12.
- Reset/clear force button wipes roster.
- Export: download JSON file of state. Import: file picker, validate shape,
  merge/replace roster. (Provides cross-device transfer without backend.)

## Error handling

- If `units.json` fails to load: show message, no UI.
- Missing artwork: initials placeholder, no crash.
- Malformed import file: alert, ignore.

## Testing

No automated test framework (no build step). Verification:

1. `tools/build_data.py` runs clean; sanity check passes (every unit has all
   keys; image files exist for ≥ 95% of units).
2. Manual smoke test with `python3 -m http.server`:
   - search finds units; add several; duplicate add works
   - pips toggle; heat cycles 0→1→2→3→S→0; crits toggle
   - refresh page → state restored
   - export → import into a fresh browser profile → state restored
   - clear force works
3. Cross-browser check: Chrome + Firefox basics (no exotic APIs used).

## Out of scope

- Multi-user live sync (deliberate; per-player choice)
- Force point budgeting/validation
- Pixel-faithful official card art
- Era filtering (era not in `.tres` data)
- PWA/offline caching beyond browser cache
