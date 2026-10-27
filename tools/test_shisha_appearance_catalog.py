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
        self.root = Path(self.temp.name).resolve()
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
            "connection": {"position_px": None, "diameter_mm": None},
        }
        self.document = {"items": [self.item], "adoption": {
            "scope": "design only; runtime pending", "runtime_integrated": False,
            "distribution_assets_ready": False,
        }, "connection_contract": {"version": 1, "candidate_pairs": []}}

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

    def add_candidate_pair(self):
        mouthpiece = copy.deepcopy(self.item)
        mouthpiece.update(id="mouthpiece-test", category="mouthpiece")
        self.document["items"].append(mouthpiece)
        pair = {"handle_id": self.item["id"], "mouthpiece_id": mouthpiece["id"], "physical_fit": None}
        self.document["connection_contract"]["candidate_pairs"].append(pair)
        return pair

    def test_candidate_pair_is_not_physical_compatibility(self):
        self.add_candidate_pair()
        result = self.load()
        self.assertEqual(result["connection_contract"], self.document["connection_contract"])
        for item in result["items"]:
            for field in ("connection_position", "connection_diameter", "compatible_ids", "bbox", "anchor"):
                self.assertIsNone(item["render_contract"][field])
        self.assertIn("not physical-fit", result["verification"])

    def test_unknown_wrong_category_and_unapproved_pairs(self):
        original = self.add_candidate_pair().copy()
        for pair in [
            {**original, "handle_id": "unknown"},
            {**original, "mouthpiece_id": []},
            {**original, "handle_id": "mouthpiece-test", "mouthpiece_id": "handle-test"},
            {**original, "mouthpiece_id": "handle-test"},
            {**original, "handle_id": "mouthpiece-test"},
        ]:
            with self.subTest(pair=pair):
                self.document["connection_contract"]["candidate_pairs"] = [pair]
                with self.assertRaises(catalog.CatalogError):
                    self.load()
        self.document["connection_contract"]["candidate_pairs"] = [original]
        for item in self.document["items"]:
            item["approved"] = False
            with self.assertRaisesRegex(catalog.CatalogError, "expected approved"):
                self.load()
            item["approved"] = True

    def test_duplicate_candidate_pair(self):
        pair = self.add_candidate_pair()
        self.document["connection_contract"]["candidate_pairs"].append(pair.copy())
        with self.assertRaisesRegex(catalog.CatalogError, "duplicate candidate pair"):
            self.load()

    def test_physical_fit_cannot_be_certified_or_rejected_by_metadata(self):
        pair = self.add_candidate_pair()
        for value in [True, False, "verified", "unverified", 0, {}, []]:
            with self.subTest(physical_fit=value):
                pair["physical_fit"] = value
                with self.assertRaisesRegex(catalog.CatalogError, "physical_fit must remain null"):
                    self.load()

    def test_connection_schema_requires_explicit_unknowns(self):
        for value in [None, [], {}, {"position_px": None},
                      {"position_px": None, "diameter_mm": None, "diameter": 1}]:
            with self.subTest(connection=value):
                self.item["connection"] = value
                with self.assertRaisesRegex(catalog.CatalogError, "connection must contain"):
                    self.load()
        del self.item["connection"]
        with self.assertRaisesRegex(catalog.CatalogError, "connection must contain"):
            self.load()

    def test_contract_schema_and_pair_schema(self):
        for value in [None, [], {}, {"version": 1, "candidate_pairs": None},
                      {"version": True, "candidate_pairs": []},
                      {"version": 2, "candidate_pairs": []},
                      {"version": 1.0, "candidate_pairs": []},
                      {"version": 1, "candidate_pairs": [], "extra": None}]:
            with self.subTest(contract=value):
                self.document["connection_contract"] = value
                with self.assertRaises(catalog.CatalogError):
                    self.load()
        del self.document["connection_contract"]
        with self.assertRaises(catalog.CatalogError):
            self.load()
        for value in [None, [], {}, {"handle_id": "handle-test", "mouthpiece_id": "mouthpiece-test"}]:
            with self.subTest(pair=value):
                self.document["connection_contract"] = {"version": 1, "candidate_pairs": [value]}
                with self.assertRaisesRegex(catalog.CatalogError, "expected handle_id"):
                    self.load()

    def test_coordinate_bounds_and_numeric_values_only(self):
        for value in [[0, 0], [1, 0], [1.999, 0.999]]:
            with self.subTest(position=value):
                self.item["connection"]["position_px"] = value
                result = self.load()
                self.assertEqual(result["items"][0]["render_contract"]["connection_position"], value)
        for value in [[2, 0], [0, 1], [-0.001, 0], [0, -1], [10**400, 0],
                      [True, 0], [0, "0"], [float("nan"), 0], [0, float("inf")],
                      [0, float("-inf")], [0], [0, 0, 0], {}, "0,0", False]:
            with self.subTest(position=value):
                self.item["connection"]["position_px"] = value
                with self.assertRaisesRegex(catalog.CatalogError, "position_px"):
                    self.load()

    def test_diameter_is_positive_finite_or_unknown(self):
        for value in [None, 0.01, 1, 2.5]:
            with self.subTest(diameter=value):
                self.item["connection"]["diameter_mm"] = value
                result = self.load()
                self.assertEqual(result["items"][0]["render_contract"]["connection_diameter"], value)
        for value in [0, -1, True, False, "2.5", [], {}, float("nan"), float("inf"), float("-inf")]:
            with self.subTest(diameter=value):
                self.item["connection"]["diameter_mm"] = value
                with self.assertRaisesRegex(catalog.CatalogError, "diameter_mm"):
                    self.load()

    def test_numeric_geometry_does_not_infer_fit_or_relative_scale(self):
        self.add_candidate_pair()
        for item in self.document["items"]:
            item["connection"] = {"position_px": [0, 0], "diameter_mm": 2.5}
        result = self.load()
        self.assertIsNone(result["connection_contract"]["candidate_pairs"][0]["physical_fit"])
        self.assertIsNone(result["items"][0]["render_contract"]["relative_scale"])
        self.assertFalse(result["adoption"]["distribution_assets_ready"])

    def test_v1_does_not_allow_runtime_or_distribution_readiness(self):
        for field in ("runtime_integrated", "distribution_assets_ready"):
            self.document["adoption"][field] = True
            with self.assertRaisesRegex(catalog.CatalogError, field):
                self.load()
            self.document["adoption"][field] = False
        self.item["runtime_integrated"] = True
        with self.assertRaisesRegex(catalog.CatalogError, "runtime_integrated=false"):
            self.load()

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
