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
at https://github.com/treverhw/Alpha-Strike-Tool — the official MUL website is
offline, and that repo contains its scraped data (per-unit `.tres` stat files,
raw JSON dumps, and unit artwork).

### Getting the data

The archive is large (~490 MB), so it is not bundled in this repository. Clone
it into the project root **before** running the build:

```
git clone --depth 1 https://github.com/treverhw/Alpha-Strike-Tool.git
```

The build script expects this clone at `Alpha-Strike-Tool/` in the project
root (it is gitignored, so it will not be committed).

## Build (one time)

```
npm install        # dev deps only (jsdom)
pip install pillow # image conversion to WebP (required)
npm run build:data # python3 tools/build_data.py → site/data/
```

If `pip install pillow` is blocked by your system (PEP 668 "externally
managed environment" — common on Debian/Ubuntu), install it via:

```
apt install python3-pil   # Debian/Ubuntu
sudo pacman -S python-pillow   # Arch
brew install pillow           # macOS
```

The build reads `Alpha-Strike-Tool/` (the archive above), parses the `.tres`
stat files, joins faction/era info from the JSON dumps, and converts all
artwork to WebP (quality 82) — ~32 MB total for the full 1568-image set.
`site/data/` and `Alpha-Strike-Tool/` are gitignored; nothing is committed.

## Run

```
npm run serve      # http://localhost:8000
```

Or serve site/ from any static host (GitHub Pages, Netlify, S3, …).

## Docker

The `Dockerfile` builds the full app in one go — it clones the data archive
(see [Data](#data)) inside the image, runs the data pipeline, and serves the
result with nginx. No local data or Python setup needed:

```
docker compose up -d        # build + serve on http://localhost:7332
```

The image is multi-stage: the data archive and Pillow live only in the build
stage; the final image is a plain nginx serving the static site.

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
