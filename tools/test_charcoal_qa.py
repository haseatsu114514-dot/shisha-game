"""Tiny synthetic fixtures only. No generated artwork or adoption candidates."""
import contextlib
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image, ImageDraw, PngImagePlugin

import charcoal_qa as qa


class CandidateQA(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="synthetic-test-", dir=Path(__file__).parent)
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / "SYNTHETIC_FIXTURES_NOT_CANDIDATES"
        self.root.mkdir()
        for i, slot in enumerate(qa.SLOTS):
            im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
            ImageDraw.Draw(im).rectangle((8, 8, 23, 23), fill=(30+i*12, 40, 50, 255))
            im.save(self.root / f"{slot}.png")

    def report(self):
        return qa.validate(self.root, size=32, synthetic=True)

    def codes(self):
        return {error["code"] for error in self.report()["errors"]}

    def replace(self, image, name="flat-1.png", **kwargs):
        image.save(self.root/name, **kwargs)

    def cli(self, *extra):
        with contextlib.redirect_stdout(io.StringIO()) as out, contextlib.redirect_stderr(io.StringIO()):
            status = qa.main([str(self.root), "--size", "32", "--synthetic-fixtures", *extra])
        return status, json.loads(out.getvalue())

    def test_six_valid_synthetic_pngs(self):
        result = self.report()
        self.assertTrue(result["ok"], result["errors"])
        self.assertEqual(result["input_kind"], "SYNTHETIC_TEST_FIXTURES")
        self.assertEqual(len(result["files"]), 6)
        self.assertEqual(result["files"][0]["measurements"]["alpha_bbox"], [8, 8, 24, 24])

    def test_missing_slot(self):
        (self.root/"cube-3.png").unlink()
        self.assertEqual(self.report()["missing_slots"], ["cube-3"])
        self.assertIn("missing_slot", self.codes())

    def test_duplicate_slot_in_subdirectory(self):
        (self.root/"extra").mkdir()
        shutil.copyfile(self.root/"flat-1.png", self.root/"extra"/"flat①.png")
        self.assertIn("duplicate_slot", self.codes())

    def test_circled_and_underscore_fixed_numbers(self):
        for slot, new in (("flat-1", "flat①"), ("cube-3", "cube_3")):
            (self.root/f"{slot}.png").rename(self.root/f"{new}.png")
        self.assertTrue(self.report()["ok"])

    def test_duplicate_identical_file(self):
        shutil.copyfile(self.root/"flat-1.png", self.root/"cube-1.png")
        self.assertIn("duplicate_bytes", self.codes())
        self.assertIn("duplicate_pixels", self.codes())

    def test_duplicate_pixels_despite_different_metadata(self):
        with Image.open(self.root/"flat-1.png") as im:
            meta = PngImagePlugin.PngInfo()
            meta.add_text("synthetic", "same pixels, different encoding")
            im.save(self.root/"cube-1.png", pnginfo=meta, compress_level=0)
        self.assertIn("duplicate_pixels", self.codes())
        self.assertNotIn("duplicate_bytes", self.codes())

    def test_duplicate_ignores_hidden_rgb(self):
        with Image.open(self.root/"flat-1.png") as source:
            im = source.copy()
        im.putpixel((0, 0), (80, 100, 120, 0))
        self.replace(im, "cube-1.png")
        self.assertIn("duplicate_pixels", self.codes())

    def test_non_png_content_disguised_as_png(self):
        self.replace(Image.new("RGB", (32, 32)), format="JPEG")
        self.assertIn("non_png_content", self.codes())

    def test_png_wrong_extension(self):
        (self.root/"flat-1.png").rename(self.root/"flat-1.jpg")
        self.assertIn("non_png_extension", self.codes())

    def test_corrupt_file(self):
        (self.root/"flat-1.png").write_bytes(qa.PNG_SIGNATURE + b"broken")
        self.assertIn("decode_failed", self.codes())

    def test_truncated_png(self):
        path = self.root/"flat-1.png"
        path.write_bytes(path.read_bytes()[:45])
        self.assertIn("decode_failed", self.codes())

    def test_missing_alpha_channel(self):
        self.replace(Image.new("RGB", (32, 32), "black"))
        self.assertIn("missing_alpha", self.codes())

    def test_opaque_alpha_is_not_transparent_background(self):
        self.replace(Image.new("RGBA", (32, 32), (0, 0, 0, 255)))
        self.assertIn("no_transparent_background", self.codes())

    def test_empty_alpha(self):
        self.replace(Image.new("RGBA", (32, 32), (30, 40, 50, 0)))
        self.assertIn("empty_alpha", self.codes())

    def test_single_pixel_nearly_empty(self):
        im = Image.new("RGBA", (32, 32))
        im.putpixel((16, 16), (20, 20, 20, 255))
        self.replace(im)
        self.assertIn("nearly_empty", self.codes())

    def test_nearly_invisible_subject(self):
        im = Image.new("RGBA", (32, 32))
        ImageDraw.Draw(im).rectangle((8, 8, 23, 23), fill=(20, 20, 20, 1))
        self.replace(im)
        self.assertIn("nearly_invisible", self.codes())

    def test_wrong_dimensions(self):
        self.replace(Image.new("RGBA", (31, 32)))
        self.assertIn("wrong_size", self.codes())

    def test_edge_contact(self):
        im = Image.new("RGBA", (32, 32))
        ImageDraw.Draw(im).rectangle((0, 8, 23, 23), fill=(20, 20, 20, 255))
        self.replace(im)
        self.assertIn("edge_contact_possible_clip", self.codes())

    def test_ten_percent_margin_is_rounded_up(self):
        im = Image.new("RGBA", (32, 32))
        ImageDraw.Draw(im).rectangle((3, 8, 23, 23), fill=(20, 20, 20, 255))
        self.replace(im)
        self.assertIn("insufficient_margin", self.codes())
        self.assertNotIn("edge_contact_possible_clip", self.codes())

    def test_paletted_png_with_transparency(self):
        im = Image.new("P", (32, 32), 0)
        im.putpalette([0, 0, 0, 160, 170, 180] + [0]*762)
        ImageDraw.Draw(im).rectangle((8, 8, 23, 23), fill=1)
        self.replace(im, transparency=0)
        self.assertTrue(self.report()["ok"], self.report()["errors"])

    def test_unexpected_fourth_slot(self):
        shutil.copyfile(self.root/"flat-1.png", self.root/"flat-4.png")
        self.assertIn("unexpected_name", self.codes())

    def test_symlinks_are_rejected(self):
        (self.root/"link").symlink_to(self.base, target_is_directory=True)
        self.assertIn("symlink", self.codes())

    def assert_scan_failure(self, target, expected_path):
        before = {p.relative_to(self.root).as_posix(): p.read_bytes()
                  for p in self.root.rglob("*") if p.is_file()}
        scandir = qa.os.scandir
        def deny_scandir(path):
            if Path(path) == target:
                raise PermissionError(13, "SYNTHETIC_PRIVATE_MESSAGE", str(target))
            return scandir(path)
        with patch.object(qa.os, "scandir", side_effect=deny_scandir):
            status, report = self.cli()
        self.assertEqual(status, 1)
        self.assertFalse(report["ok"])
        self.assertEqual(report["adoption"], "not_evaluated")
        self.assertEqual([e for e in report["errors"] if e["code"] == "directory_scan_failed"],
                         [{"code": "directory_scan_failed", "path": expected_path,
                           "exception": "PermissionError"}])
        self.assertNotIn(str(self.root), json.dumps(report))
        self.assertNotIn("SYNTHETIC_PRIVATE_MESSAGE", json.dumps(report))
        self.assertEqual(before, {p.relative_to(self.root).as_posix(): p.read_bytes()
                                  for p in self.root.rglob("*") if p.is_file()})
        return report

    def test_root_scan_failure_cli_is_fail_closed(self):
        report = self.assert_scan_failure(self.root, ".")
        self.assertEqual(report["missing_slots"], list(qa.SLOTS))

    def test_child_scan_failure_preserves_evidence_and_fails(self):
        child = self.root/"unreadable-subtree"
        child.mkdir()
        shutil.copyfile(self.root/"flat-1.png", child/"flat-1.png")
        self.assertIn("duplicate_slot", self.codes())
        report = self.assert_scan_failure(child, "unreadable-subtree")
        self.assertEqual(len(report["files"]), 6)
        self.assertEqual(report["missing_slots"], [])

    def test_scan_error_does_not_disclose_outside_filename(self):
        scandir = qa.os.scandir
        def deny_scandir(path):
            if Path(path) == self.root:
                raise PermissionError(13, "SYNTHETIC_PRIVATE_MESSAGE", str(self.base/"outside-private"))
            return scandir(path)
        with patch.object(qa.os, "scandir", side_effect=deny_scandir):
            status, report = self.cli()
        self.assertEqual(status, 1)
        self.assertFalse(report["ok"])
        self.assertIn({"code": "directory_scan_failed", "path": None,
                       "exception": "PermissionError"}, report["errors"])
        self.assertNotIn(str(self.base), json.dumps(report))
        self.assertNotIn("outside-private", json.dumps(report))
        self.assertNotIn("SYNTHETIC_PRIVATE_MESSAGE", json.dumps(report))

    def test_cli_success_and_input_unchanged(self):
        before = {p.name: p.read_bytes() for p in self.root.iterdir()}
        status, report = self.cli()
        self.assertEqual(status, 0)
        self.assertTrue(report["ok"])
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.root.iterdir()})

    def test_cli_empty_directory_fails_with_six_missing(self):
        for path in self.root.iterdir():
            path.unlink()
        status, report = self.cli()
        self.assertEqual(status, 1)
        self.assertEqual(report["missing_slots"], list(qa.SLOTS))

    def test_cli_default_requires_1024_pixels(self):
        with contextlib.redirect_stdout(io.StringIO()):
            status = qa.main([str(self.root), "--synthetic-fixtures"])
        self.assertEqual(status, 1)

    def test_cli_report_and_no_overwrite(self):
        path = self.base/"report.json"
        status, report = self.cli("--output", str(path))
        self.assertEqual(status, 0)
        self.assertEqual(json.loads(path.read_text()), report)
        with self.assertRaises(SystemExit) as caught:
            self.cli("--output", str(path))
        self.assertEqual(caught.exception.code, 2)
        self.assertEqual(json.loads(path.read_text()), report)

    def test_cli_report_cannot_pollute_inputs(self):
        with self.assertRaises(SystemExit) as caught:
            self.cli("--output", str(self.root/"report.json"))
        self.assertEqual(caught.exception.code, 2)
        self.assertFalse((self.root/"report.json").exists())

    def test_missing_input_directory(self):
        report = qa.validate(self.base/"absent")
        self.assertFalse(report["ok"])
        self.assertEqual(report["missing_slots"], list(qa.SLOTS))


if __name__ == "__main__":
    unittest.main(verbosity=2)
