import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

import sys
sys.path.insert(0, os.path.dirname(__file__))
import build_data as bd

from PIL import Image

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

FIXTURE_TRES_LAM = """[ext_resource type="Texture2D" path="res://Sprites/Units/pwwka-jfr.png" id="2_ynkeb"]

[resource]
unitIMG = ExtResource("2_ynkeb")
variant = "S-PW-1LAM"
title = "PWWKA"
pv = 31
type = "AF"
sz = 2
tmm = 3
move = "36\"g/6a"
role = "Strike"
skill = 4
damageS = 2
damageM = 2
damageL = 1
ov = 0
armor = 2
struct = 1
special = Array[String](["BOMB1", "FUEL4", "LAM(36\"g/6a)", ])
"""

FIXTURE_TRES_EMPTY = """[resource]
unitIMG = ExtResource("2_ynkeb")
variant = "TP-1R"
title = "TROOPER"
pv = 14
type = "None"
sz = 1
tmm = 0
move = "12\""
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
FIXTURE_TRES_JPG = """[ext_resource type="Texture2D" path="res://Sprites/Units/aesir-3145.jpg" id="3_abcde"]

[resource]
unitIMG = ExtResource("3_abcde")
variant = "AES-1"
title = "AESIR"
pv = 30
type = "BM"
sz = 3
tmm = 2
move = "8"
role = "Brawler"
skill = 4
damageS = 3
damageM = 3
damageL = 1
ov = 0
armor = 5
struct = 4
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
            bd.parse_abilities('Array[String](["BOMB1", "FUEL4", "LAM(36\"g/6a)", ])'),
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


    def test_latin1_encoding(self):
        import tempfile, shutil
        tmpdir = tempfile.mkdtemp()
        tres_path = os.path.join(tmpdir, 'test.tres')
        raw = b'[resource]\n'
        raw += b'title = "ARA' + bytes([0xd1]) + b'A"\n'
        raw += b'variant = "MILITIAMECH"\n'
        raw += b'pv = 10\n'
        raw += b'type = "BM"\n'
        raw += b'armor = 2\n'
        raw += b'struct = 1\n'
        with open(tres_path, 'wb') as f:
            f.write(raw)
        with open(tres_path, 'r', encoding='latin-1') as f:
            lines = f.read().splitlines()
        rec = bd.build_record(tres_path, lines, set())
        self.assertEqual(rec['class'], 'ARA' + chr(0xd1) + 'A')
        self.assertEqual(rec['id'], 'arana-militiamech')
        shutil.rmtree(tmpdir)
    def test_missing_optional_numerics_default_to_zero(self):
        lines = FIXTURE_TRES.splitlines()
        lines = [ln for ln in lines if not ln.startswith("damageS") and not ln.startswith("sz")]
        rec = bd.build_record("t.tres", lines, set())
        self.assertEqual(rec["damage"]["s"], 0)
        self.assertEqual(rec["size"], 0)

    def test_build_record_jpg_image(self):
        rec = bd.build_record("t.tres", FIXTURE_TRES_JPG.splitlines(), set())
        self.assertEqual(rec["image"], "aesir-3145.jpg")


class TestBuildEndToEnd(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.units_dir = os.path.join(self.tmp, "Units")
        self.sprites_dir = os.path.join(self.tmp, "Sprites", "Units")
        self.site_dir = os.path.join(self.tmp, "site")
        os.makedirs(os.path.join(self.units_dir, "ATLAS"), exist_ok=True)
        os.makedirs(os.path.join(self.units_dir, "Pwwka"), exist_ok=True)
        os.makedirs(os.path.join(self.units_dir, "Aesir"), exist_ok=True)
        os.makedirs(self.sprites_dir, exist_ok=True)
        with open(os.path.join(self.units_dir, "ATLAS", "ATLAS AS7-D.tres"), "w", encoding="utf-8") as f:
            f.write(FIXTURE_TRES)
        with open(os.path.join(self.units_dir, "Pwwka", "Pwwka S-PW-1LAM.tres"), "w", encoding="utf-8") as f:
            f.write(FIXTURE_TRES_LAM)
        with open(os.path.join(self.units_dir, "Aesir", "Aesir AES-1.tres"), "w", encoding="utf-8") as f:
            f.write(FIXTURE_TRES_JPG)
        with open(os.path.join(self.sprites_dir, "atlas-rg.png"), "wb") as f:
            Image.new("RGB", (64, 64), (120, 40, 20)).save(f, "PNG")
        with open(os.path.join(self.sprites_dir, "pwwka-jfr.png"), "wb") as f:
            Image.new("RGB", (64, 64), (20, 40, 120)).save(f, "PNG")
        with open(os.path.join(self.sprites_dir, "aesir-3145.jpg"), "wb") as f:
            Image.new("RGB", (64, 64), (40, 120, 40)).save(f, "JPEG")
        with open(os.path.join(self.sprites_dir, "atlas-rg.png.import"), "w", encoding="utf-8") as f:
            f.write("ignored import metadata")

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_build_writes_units_json_and_images(self):
        bd.build(self.units_dir, self.sprites_dir, os.path.join(self.site_dir, "data"))
        with open(os.path.join(self.site_dir, "data", "units.json"), encoding="utf-8") as f:
            payload = json.load(f)
        units = payload["units"]
        self.assertEqual(len(units), 3)
        ids = [u["id"] for u in units]
        self.assertEqual(len(ids), len(set(ids)))
        by_id = {u["id"]: u for u in units}
        self.assertIn("atlas-as7-d", by_id)
        self.assertEqual(by_id["atlas-as7-d"]["pv"], 52)
        img_dir = os.path.join(self.site_dir, "data", "img")
        self.assertTrue(os.path.exists(os.path.join(img_dir, "atlas-rg.webp")))
        self.assertTrue(os.path.exists(os.path.join(img_dir, "pwwka-jfr.webp")))
        self.assertTrue(os.path.exists(os.path.join(img_dir, "aesir-3145.webp")))
        self.assertFalse(os.path.exists(os.path.join(img_dir, "atlas-rg.png.import")))
        self.assertEqual(by_id["atlas-as7-d"]["image"], "atlas-rg.webp")
        self.assertEqual(by_id["aesir-aes-1"]["image"], "aesir-3145.webp")

    def test_sanity_check_fails_on_bad_units(self):
        bad = [{"id": "x", "armor": -1}]
        with self.assertRaises(AssertionError):
            bd.sanity_check(bad, self.sprites_dir)

    def test_build_record_drops_traversal_image(self):
        evil = FIXTURE_TRES.replace('atlas-rg.png', '../../etc/passwd.png')
        rec = bd.build_record("t.tres", evil.splitlines(), set())
        self.assertEqual(rec["image"], "")

    def test_safe_image_name_rejects_traversal_and_urls(self):
        self.assertEqual(bd.safe_image_name("atlas-rg.png"), "atlas-rg.png")
        self.assertIsNone(bd.safe_image_name("../../etc/passwd.png"))
        self.assertIsNone(bd.safe_image_name("a/b.png"))
        self.assertIsNone(bd.safe_image_name("https://evil.example/track.png"))
        self.assertIsNone(bd.safe_image_name(""))

    def test_build_rejects_symlinked_tres_outside_archive(self):
        outside = os.path.join(self.tmp, "rogue.tres")
        with open(outside, "w", encoding="utf-8") as f:
            f.write(FIXTURE_TRES)
        os.symlink(outside, os.path.join(self.units_dir, "ATLAS", "rogue.tres"))
        with self.assertRaises(AssertionError):
            bd.build(self.units_dir, self.sprites_dir, os.path.join(self.site_dir, "data"))

    def test_path_within(self):
        base = os.path.join(self.tmp, "sprites")
        self.assertTrue(bd.path_within(base, os.path.join(base, "a.png")))
        self.assertTrue(bd.path_within(base, base))
        self.assertFalse(bd.path_within(base, os.path.join(base, "..", "secret.png")))


if __name__ == "__main__":
    unittest.main()
