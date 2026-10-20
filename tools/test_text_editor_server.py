#!/usr/bin/env python3
"""プレビュー配信と、textだけの保存が本心・演出を保持することを検査。"""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import text_editor_server as server


class TextEditorServerTests(unittest.TestCase):
    def test_text_save_keeps_inner_and_direction(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "fixture.json"
            source = {"dialogues": [{"dialogue_id": "sample", "lines": [
                {"speaker": "hiyori", "text": "発言", "inner": "本心", "fx": "shake"},
            ], "branches": {"a": [{"speaker": "hajime", "text": "分岐", "type": "note"}]}}]}
            path.write_text(json.dumps(source, ensure_ascii=False))
            with patch.object(server, "DIALOGUE_DIR", Path(tmp)):
                lines = server.load_lines(path.name)
                self.assertEqual(lines[0]["inner"], "本心")
                self.assertEqual(lines[1]["type"], "note")
                server.save_line(path.name, lines[0]["path"], "演出\n[imp]発言[/imp]")
            expected = source
            expected["dialogues"][0]["lines"][0]["text"] = "演出\n[imp]発言[/imp]"
            self.assertEqual(json.loads(path.read_text()), expected)

    def test_preview_allowlist_is_present_and_confined(self):
        self.assertNotIn("/AGENTS.md", server.PREVIEW_FILES)
        self.assertNotIn("/remake/../AGENTS.md", server.PREVIEW_FILES)
        for route, relative in server.PREVIEW_FILES.items():
            with self.subTest(route=route):
                self.assertTrue((server.ROOT / relative).is_file())
                self.assertTrue((server.ROOT / relative).resolve().is_relative_to(server.ROOT))
        for kind in ("text", "inner", "layout"):
            self.assertIn(f"/remake/js/vn/{kind}.js", server.PREVIEW_FILES)


if __name__ == "__main__":
    unittest.main()
