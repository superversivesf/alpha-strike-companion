#!/usr/bin/env python3
"""Build site/data/units.json + site/data/img from the Alpha-Strike-Tool archive."""
import json
import os
import re
import shutil
import sys
import unicodedata

try:
    from PIL import Image
    HAVE_PIL = True
except ImportError:
    HAVE_PIL = False

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCHIVE_UNITS = os.path.join(ROOT, "Alpha-Strike-Tool", "Units")
ARCHIVE_SPRITES = os.path.join(ROOT, "Alpha-Strike-Tool", "Sprites", "Units")
SITE_DATA = os.path.join(ROOT, "site", "data")
SITE_IMG = os.path.join(SITE_DATA, "img")

WEBP_QUALITY = 82

KEY_RE = re.compile(r"^([A-Za-z_]+) = (.*)$")
EXT_RES_RE = re.compile(r'\[ext_resource\s+type="Texture2D"\s+path="res://Sprites/Units/([^"]+)"\s+id="([^"]+)"\]')
IMG_REF_RE = re.compile(r'ExtResource\("([^"]+)"\)')
ABILITY_RE = re.compile(r"^Array\[String\]\(\[(.*)\]\)$", re.DOTALL)

# Filenames only — rejects path separators, .. traversal, and URL schemes.
SAFE_IMG_RE = re.compile(r"^[A-Za-z0-9._-]+$")


def safe_image_name(name):
    """Return the name only if it is a plain filename; otherwise None."""
    if not name or not SAFE_IMG_RE.match(name):
        return None
    return name


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
            image = safe_image_name(ext_images[ref_id]) or ""
            if image:
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


def to_webp(src, dst):
    if not HAVE_PIL:
        raise RuntimeError(
            "Pillow is required to convert artwork to WebP. "
            "Install it with: pip install pillow  (or: pipx install pillow / apt install python3-pil)"
        )
    with Image.open(src) as im:
        im = im.convert("RGB")
        im.save(dst, "WEBP", quality=WEBP_QUALITY, method=6)


def path_within(base, target):
    """True if the resolved target path stays inside the resolved base directory."""
    base_real = os.path.realpath(base)
    target_real = os.path.realpath(target)
    return target_real == base_real or target_real.startswith(base_real + os.sep)


MUL_ERA_INFO = [
    (9, "Age of War", 2439, 2571),
    (10, "Star League", 2571, 2781),
    (11, "Early Succession Wars", 2781, 2864),
    (13, "Late Succession Wars", 2864, 3049),
    (14, "Clan Invasion", 3049, 3067),
    (15, "Civil War", 3067, 3075),
    (16, "Jihad", 3075, 3081),
    (247, "Early Republic", 3081, 3101),
    (254, "Late Republic", 3101, 3130),
    (255, "Dark Age", 3130, 3151),
    (256, "ilClan", 3151, 3152),
    (257, "Emergence", 3152, None),
]
MUL_ERA_NAMES = {i: n for i, n, _, _ in MUL_ERA_INFO}


def load_tech_lookup(json_data_dir):
    """Map (Class, Variant) -> {tech, era} from the MUL JSON dumps."""
    lookup = {}
    if not os.path.isdir(json_data_dir):
        return lookup
    for fn in os.listdir(json_data_dir):
        if not fn.endswith(".json"):
            continue
        with open(os.path.join(json_data_dir, fn), encoding="utf-8") as f:
            d = json.load(f)
        for u in d.get("Units", []):
            cls = (u.get("Class") or "").strip().upper()
            var = (u.get("Variant") or "").strip()
            lookup[(cls, var)] = {
                "tech": (u.get("Technology") or {}).get("Name", ""),
                "era": MUL_ERA_NAMES.get(u.get("EraId"), ""),
            }
    return lookup


def build(units_dir, sprites_dir, site_data_dir, json_data_dir=None):
    units_root = os.path.realpath(units_dir)
    sprites_root = os.path.realpath(sprites_dir)
    img_out_dir = os.path.join(site_data_dir, "img")

    image_set = set()
    units = []
    for dirpath, dirnames, filenames in os.walk(units_dir, followlinks=False):
        for fn in filenames:
            if not fn.endswith(".tres"):
                continue
            path = os.path.join(dirpath, fn)
            if not path_within(units_root, path):
                raise AssertionError(f".tres outside archive: {path}")
            with open(path, encoding="latin-1") as f:
                lines = f.read().splitlines()
            units.append(build_record(path, lines, image_set))

    tech = load_tech_lookup(json_data_dir) if json_data_dir else {}
    for u in units:
        key = (u["class"].strip().upper(), u["variant"].strip())
        info = tech.get(key, {})
        u["tech"] = info.get("tech", "")
        u["era"] = info.get("era", "")

    units.sort(key=lambda u: (u["class"].lower(), u["variant"].lower()))
    sanity_check(units, sprites_dir)

    os.makedirs(img_out_dir, exist_ok=True)
    for img in sorted(image_set):
        if not (img.endswith(".png") or img.endswith(".jpg")):
            continue
        src = os.path.join(sprites_dir, img)
        if not path_within(sprites_root, src):
            raise AssertionError(f"image path escapes sprites dir: {img}")
        if os.path.exists(src):
            webp_name = safe_image_name(os.path.splitext(img)[0] + ".webp")
            if not webp_name:
                raise AssertionError(f"unsafe image name: {img}")
            dst = os.path.join(img_out_dir, webp_name)
            if not path_within(os.path.realpath(img_out_dir), dst):
                raise AssertionError(f"image output escapes data dir: {img}")
            to_webp(src, dst)
            for u in units:
                if u["image"] == img:
                    u["image"] = webp_name

    with open(os.path.join(site_data_dir, "units.json"), "w", encoding="utf-8") as f:
        json.dump({
            "units": units,
            "eras": [
                {"id": i, "name": n, "start": s, "end": e}
                for i, n, s, e in MUL_ERA_INFO
            ],
        }, f, ensure_ascii=False)

    print(f"Wrote {len(units)} units, {len(image_set)} images, {len(MUL_ERA_INFO)} eras")
    return units


if __name__ == "__main__":
    units = build(ARCHIVE_UNITS, ARCHIVE_SPRITES, SITE_DATA, os.path.join(ROOT, "Alpha-Strike-Tool", "JSON_Data"))
    print(f"Total: {len(units)} units")
