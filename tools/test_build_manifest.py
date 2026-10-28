"""人物定義の解決を検証する。素材の計測・画像生成・目録更新は行わない。"""
import importlib.util
import io
import json
from contextlib import redirect_stderr
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch


SCRIPT = Path(__file__).resolve().parents[1] / "remake/tools/build_manifest.py"
spec = importlib.util.spec_from_file_location("build_manifest", SCRIPT)
manifest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manifest)


class CharacterResolutionTests(unittest.TestCase):
    def test_repository_characters_include_samechan_profile(self):
        base = json.loads((manifest.ROOT / "data/characters.json").read_text(encoding="utf-8"))
        profile = json.loads((manifest.ROOT / "data/dialogue/samechan.json").read_text(
            encoding="utf-8"))["profile"]
        characters = manifest.load_characters()
        self.assertEqual(profile["id"], "samechan")
        self.assertEqual(characters["samechan"], profile)
        for character in base:
            if character["id"] != profile["id"]:
                self.assertEqual(characters[character["id"]], character)

    def test_profile_uses_its_id_and_replaces_existing_definition(self):
        base = [{"id": "other", "name": "base", "spriteScale": 1}]
        profile = {"id": "other", "spriteAnchor": "head"}
        with patch.object(Path, "read_text", side_effect=[
            json.dumps(base), json.dumps({"profile": profile})
        ]):
            self.assertEqual(manifest.load_characters(), {"other": profile})

    def test_profile_without_id_is_not_registered(self):
        base = [{"id": "existing"}]
        for overlay in ({}, {"profile": None}, {"profile": {}}, {"profile": {"id": ""}}):
            with self.subTest(overlay=overlay), patch.object(Path, "read_text", side_effect=[
                json.dumps(base), json.dumps(overlay)
            ]):
                self.assertEqual(manifest.load_characters(), {"existing": base[0]})

    def test_portraits_only_registration_before_any_generation(self):
        for cid, expected, accepted in (
            ("samechan", "通常立ち絵のPNGがありません: samechan", True),
            ("unknown_character", "人物設定がありません: unknown_character", False),
        ):
            stderr = io.StringIO()
            with self.subTest(cid=cid), patch.object(sys, "argv", [
                str(SCRIPT), "--portraits-only", cid
            ]), patch.dict(sys.modules, {"build_images": Mock()}), patch.object(
                manifest, "portraits", return_value={}
            ) as portraits, redirect_stderr(stderr), self.assertRaises(SystemExit) as raised:
                manifest.main()
            self.assertEqual(raised.exception.code, 2)
            self.assertIn(expected, stderr.getvalue())
            if accepted:
                portraits.assert_called_once_with([cid])
            else:
                portraits.assert_not_called()


if __name__ == "__main__":
    unittest.main()
