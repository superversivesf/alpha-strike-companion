# Alpha Strike — Tabletop Companion

A zero-build static website for BattleTech: Alpha Strike. Pick units from the
Master Unit List archive, deploy them as scrollable cards, and track
armor/structure damage, heat, and crits during a game. State auto-saves to
localStorage; export/import JSON transfers a force between devices.

> **Copyright disclaimer**
> This project is an unofficial fan tool for personal use. BattleTech, Alpha
> Strike, and all related unit names, stats, and artwork are the property of
> their respective owners (The Topps Company / Catalyst Game Labs).
> The unit data and artwork are **not** included in this repository — they are
> generated locally by the data pipeline from the Master Unit List archive
> (see [Data](#data)). This project may **not** be sold, monetized, or used
> commercially in any form, and redistributing the artwork or game data is
> not permitted without permission from the rights holders.

## Data

Unit data (6888 variants) and artwork come from the Master Unit List archive
cloned at Alpha-Strike-Tool/ (https://github.com/treverhw/Alpha-Strike-Tool).
The official MUL website is offline; its data was scraped into that repo.

## Build (one time)

```
npm install        # dev deps only (jsdom)
npm run build:data # python3 tools/build_data.py → site/data/
```

The build converts all artwork to WebP (quality 82) — ~32 MB total for the
full 1568-image set, down from ~88 MB as PNG. Requires Pillow
(`pip install pillow`).

## Run

```
npm run serve      # http://localhost:8000
```

Or serve site/ from any static host (GitHub Pages, Netlify, S3, …).

## Test

```
npm test           # node:test + jsdom: unit, integration, journey
python3 -m unittest tools.test_build_data -v
```

## Usage

1. Search/filter in the unit picker; click a unit to deploy it.
2. Click armor/structure pips to mark damage; use HEAT 1/2/3/S; click crit
   slots to mark critical hits.
3. State persists automatically. Export saves a JSON file; Import restores it
   on any device.
