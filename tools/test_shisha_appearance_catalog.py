"""Small, synthetic fixtures; approved image bytes are never edited."""
import copy
import hashlib
import io
import json
from pathlib import Path
import struct
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import patch
import zlib

import shisha_appearance_catalog as catalog


def png(width=2, height=1):
    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress((b"\0" + b"\0\0\0\0" * width) * height))
            + chunk(b"IEND", b""))


class AppearanceCatalogTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        image = png()
        (self.root / "original.png").write_bytes(image)
        self.item = {
            "id": "handle-test", "name": "試験", "category": "handle",
            "original_path": "original.png", "sha256": hashlib.sha256(image).hexdigest(),
            "size": [2, 1], "mode": "RGBA", "alpha_extrema": [0, 0],
            "approved": True, "approval_scope": "design_only", "runtime_integrated": False,
            "runtime_paths": [], "status": "approved_design_runtime_integration_pending",
            "integration_issue": 437, "concept_length_cm": 30,
            "dimensional_status": "concept only, not measured",
            "generated_original": "/old/nonexistent/generator.png",
        }
        self.document = {"items": [self.item], "adoption": {
            "scope": "design only; runtime pending", "runtime_integrated": False,
            "distribution_assets_ready": False,
        }}

    def write(self):
        (self.root / "source.json").write_text(json.dumps(self.document), encoding="utf-8")

    def load(self):
        self.write()
        return catalog.load_catalog(self.root, "source.json")

    def test_normal_catalog_inherits_source_without_runtime_claim(self):
        result = self.load()
        self.assertEqual(result["adoption"], self.document["adoption"])
        self.assertEqual(result["items"][0], {
            **{key: self.item[key] for key in catalog.CATALOG_FIELDS},
            "render_contract": dict.fromkeys(catalog.UNVERIFIED_RENDER_FIELDS),
        })
        self.assertFalse(result["items"][0]["runtime_integrated"])
        self.assertNotIn("generated_original", result["items"][0])
        self.assertEqual((self.root / "original.png").read_bytes(), png())

    def test_derived_catalog_tracks_source_changes(self):
        first = self.load()
        self.item["name"] = "新しい正本名"
        second = self.load()
        self.assertEqual(second["items"][0]["name"], "新しい正本名")
        self.assertNotEqual(first["source_sha256"], second["source_sha256"])
        self.assertEqual(sorted(p.name for p in self.root.iterdir()), ["original.png", "source.json"])

    def test_both_categories(self):
        second = copy.deepcopy(self.item)
        second.update(id="mouthpiece-test", category="mouthpiece", concept_length_cm=4)
        self.document["items"].append(second)
        self.assertEqual([i["category"] for i in self.load()["items"]], ["handle", "mouthpiece"])

    def test_duplicate_id(self):
        self.document["items"].append(copy.deepcopy(self.item))
        with self.assertRaisesRegex(catalog.CatalogError, "duplicate id"):
            self.load()

    def test_missing_original(self):
        (self.root / "original.png").unlink()
        with self.assertRaisesRegex(catalog.CatalogError, "original.*No such file"):
            self.load()

    def test_hash_mismatch(self):
        self.item["sha256"] = "0" * 64
        with self.assertRaisesRegex(catalog.CatalogError, "SHA256 mismatch"):
            self.load()

    def test_invalid_categories_are_errors_including_bad_types(self):
        for value in ["bowl", "HANDLE", "", None, [], {}]:
            with self.subTest(category=value):
                self.item["category"] = value
                with self.assertRaisesRegex(catalog.CatalogError, "invalid category"):
                    self.load()

    def test_dimensions_and_mode_match_png(self):
        self.item["size"] = [20, 1]
        with self.assertRaisesRegex(catalog.CatalogError, "dimensions mismatch"):
            self.load()
        self.item["size"] = [2, 1]
        self.item["mode"] = "RGB"
        with self.assertRaisesRegex(catalog.CatalogError, "mode mismatch"):
            self.load()

    def test_invalid_dimensions_do_not_accept_booleans(self):
        for value in [[True, 1], [0, 1], [2, -1], [2], "2x1", None]:
            with self.subTest(size=value):
                self.item["size"] = value
                with self.assertRaisesRegex(catalog.CatalogError, "size must contain"):
                    self.load()

    def test_duplicate_json_keys_not_overwritten(self):
        for raw in ['{"items": [], "items": []}',
                    '{"items":[{"id":"first","id":"second"}]}']:
            with self.subTest(raw=raw):
                (self.root / "source.json").write_text(raw)
                with self.assertRaisesRegex(catalog.CatalogError, "duplicate JSON key"):
                    catalog.load_catalog(self.root, "source.json")

    def test_outside_paths_and_symlinks_are_not_read(self):
        with tempfile.TemporaryDirectory() as outside:
            secret = Path(outside) / "private.png"
            secret.write_bytes(png())
            (self.root / "link.png").symlink_to(secret)
            for value in [str(secret), "../private.png", "link.png"]:
                with self.subTest(path=value):
                    self.item["original_path"] = value
                    self.write()
                    actual_read, opened = Path.read_bytes, []

                    def tracked_read(path):
                        opened.append(path)
                        return actual_read(path)

                    with patch.object(Path, "read_bytes", tracked_read):
                        with self.assertRaisesRegex(catalog.CatalogError, "outside repository"):
                            catalog.load_catalog(self.root, "source.json")
                    self.assertEqual(opened, [self.root / "source.json"])
            with patch.object(Path, "read_bytes") as read:
                with self.assertRaisesRegex(catalog.CatalogError, "outside repository"):
                    catalog.load_catalog(self.root, str(secret))
                read.assert_not_called()

    def test_source_unavailable_or_malformed_is_failure(self):
        with self.assertRaisesRegex(catalog.CatalogError, "source"):
            catalog.load_catalog(self.root, "missing.json")
        for raw in ["{", "null", '{"items": []}', '{"items": [null], "adoption": {}}']:
            with self.subTest(raw=raw):
                (self.root / "source.json").write_text(raw)
                with self.assertRaises(catalog.CatalogError):
                    catalog.load_catalog(self.root, "source.json")

    def test_missing_approval_is_not_inferred(self):
        del self.item["approval_scope"]
        with self.assertRaisesRegex(catalog.CatalogError, "approval_scope"):
            self.load()
        self.item["approval_scope"] = "design_only"
        self.item["approved"] = "true"
        with self.assertRaisesRegex(catalog.CatalogError, "approved must be boolean"):
            self.load()

    def test_runtime_paths_cannot_claim_pending_integration(self):
        self.item["runtime_paths"] = ["remake/unregistered.png"]
        with self.assertRaisesRegex(catalog.CatalogError, "contradict"):
            self.load()

    def test_invalid_png_even_with_matching_hash(self):
        for data in [b"not a png", png()[:24], png()[:29] + b"\0\0\0\0" + png()[33:]]:
            with self.subTest(data=data[:24]):
                (self.root / "original.png").write_bytes(data)
                self.item["sha256"] = hashlib.sha256(data).hexdigest()
                with self.assertRaisesRegex(catalog.CatalogError, "PNG"):
                    self.load()

    def test_cli_success_and_error_exit_codes(self):
        result = self.load()
        output, error = io.StringIO(), io.StringIO()
        with patch.object(catalog, "load_catalog", return_value=result), redirect_stdout(output):
            self.assertEqual(catalog.main(["--json"]), 0)
        self.assertEqual(json.loads(output.getvalue()), result)
        with redirect_stderr(error):
            self.assertEqual(catalog.main(["--source", "../../outside.json"]), 1)
        self.assertIn("ERROR:", error.getvalue())
        self.assertIn("outside repository", error.getvalue())


if __name__ == "__main__":
    unittest.main()
