"""JSON escapes must not hide renamed display names or turn IDs into names."""
import json
import unittest

from check_legacy_terms import has_renamed_romaji


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


if __name__ == "__main__":
    unittest.main()
