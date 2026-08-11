#!/usr/bin/env python3
"""Build site/data/units.json + site/data/img from the Alpha-Strike-Tool archive."""
import json
import os
import re
import shutil
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCHIVE_UNITS = os.path.join(ROOT, "Alpha-Strike-Tool", "Units")
ARCHIVE_SPRITES = os.path.join(ROOT, "Alpha-Strike-Tool", "Sprites", "Units")
SITE_DATA = os.path.join(ROOT, "site", "data")
SITE_IMG = os.path.join(SITE_DATA, "img")

KEY_RE = re.compile(r"^([A-Za-z_]+) = (.*)$")
EXT_RES_RE = re.compile(r'\[ext_resource\s+type="Texture2D"\s+path="res://Sprites/Units/([^"]+)"\s+id="([^"]+)"\]')
IMG_REF_RE = re.compile(r'ExtResource\("([^"]+)"\)')
ABILITY_RE = re.compile(r"^Array\[String\]\(\[(.*)\]\)$", re.DOTALL)


def parse_tres_lines(lines):
    d = {}
    ext_images = {}
    in_resource = False
    for line in lines:
        line = line.strip()
        if line.startswith("[ext_resource") and "Texture2D" in line:
            m = EXT_RES_RE.match(line)
            if m:
                ext_images[m.group(2)] = m.group(1)
            continue
        if line == "[resource]":
            in_resource = True
            continue
        if not in_resource:
            continue
        m = KEY_RE.match(line)
        if m:
            d[m.group(1)] = m.group(2)
    d["_ext_images"] = ext_images
    return d


def parse_str(v):
    if v is None:
        return ""
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
    parts = re.split(r'"\s*,\s*"', inner)
    out = []
    for p in parts:
        p = p.strip()
        if p.startswith('"'):
            p = p[1:]
        if p.endswith('"'):
            p = p[:-1]
        p = p.rstrip(",").strip()
        p = p.rstrip("]").strip()
        if p.endswith('"'):
            p = p[:-1]
        if p:
            out.append(p.replace('\\"', '"'))
    return out


def slugify(class_name, variant):
    s = (class_name + " " + variant).lower()
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def to_int(v, default=0):
    try:
        return int(parse_str(v))
    except (TypeError, ValueError):
        return default


def build_record(path, lines, image_set):
    d = parse_tres_lines(lines)
    ext_images = d.pop("_ext_images", {})
    class_name = parse_str(d.get("title")) or "UNKNOWN"
    variant = parse_str(d.get("variant")) or "UNKNOWN"
    image = ""
    unit_img = d.get("unitIMG", "")
    ref_m = IMG_REF_RE.search(unit_img)
    if ref_m:
        ref_id = ref_m.group(1)
        if ref_id in ext_images:
            image = ext_images[ref_id]
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
        if not (img.endswith(".png") or img.endswith(".jpg")):
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
