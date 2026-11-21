"""JSON escapes must not hide renamed display names or turn IDs into names."""
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from check_legacy_terms import has_renamed_romaji, scan_file


class LegacyRomajiTests(unittest.TestCase):
    def test_display_name_boundaries(self):
        for name in ("R" + "in", "R" + "IN", "N" + "agumo", "M" + "aezono", "H" + "atano", "Dr." + "Kemuri"):
            with self.subTest(name=name):
                self.assertTrue(has_renamed_romaji(name + "の"))

    def test_json_escaped_boundaries(self):
        for prefix in ("\n", "\t", "\r", '"', "前文\n"):
            raw = json.dumps({"prompt": prefix + "R" + "IN: adult 27"}, ensure_ascii=False)
            with self.subTest(prefix=prefix):
                self.assertTrue(has_renamed_romaji(raw, json_strings=True))
        escaped = '{"prompt": "\\u0052IN: adult 27"}'
        self.assertTrue(has_renamed_romaji(escaped, json_strings=True))

    def test_internal_ids_stay_allowed(self):
        for value in ("chr_rio_normal.webp", "rio", "sui", "maezono", "RIN_LATE", "xRIN", "RIN2"):
            with self.subTest(value=value):
                self.assertFalse(has_renamed_romaji(value))
                self.assertFalse(has_renamed_romaji(json.dumps({"prompt": "\n" + value}), json_strings=True))

    def test_backslash_n_is_not_a_json_newline(self):
        raw = json.dumps({"prompt": "\\n" + "R" + "IN: adult 27"})
        self.assertFalse(has_renamed_romaji(raw, json_strings=True))


class CurrentLegacyNameTests(unittest.TestCase):
    def test_current_game_and_promo_catch_draft_spellings(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            for rel in ("remake/data/friends.json", "promo/index.html", ".claude/skills/example/SKILL.md"):
                path = root / rel
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("玖" + "羅雨℃\n†紅" + "羅雨℃†\n†黒羅雨℃†", encoding="utf-8")
                errors = []
                with patch("check_legacy_terms.REPO", root):
                    scan_file(path, errors, [], current_names_only=True)
                self.assertEqual([error.split(":", 2)[1] for error in errors], ["1", "2"])


    def test_active_romaji_checks_keep_ids_and_archive_references(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = {"id": "rei", "names": ["R" + "ei", "U" + "suba", "Shi" + "omi"]}
            files = [root / "data/prompt.json", root / "docs/archive/prompt.json"]
            for path in files:
                path.parent.mkdir(parents=True)
                path.write_text(json.dumps(source, indent=2), encoding="utf-8")

            errors = []
            with patch("check_legacy_terms.REPO", root):
                for path in files:
                    scan_file(path, errors, [])
            self.assertEqual([error.split(":", 2)[:2] for error in errors],
                             [["data/prompt.json", line] for line in ("4", "5", "6")])


if __name__ == "__main__":
    unittest.main()
