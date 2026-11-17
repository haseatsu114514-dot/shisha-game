"""章ボリュームの物差し（tools/chapter_volume.py）が #3097 の数え方どおりに数える。"""
from pathlib import Path
import importlib.util
import unittest

SPEC = importlib.util.spec_from_file_location("chapter_volume", Path(__file__).resolve().parent / "chapter_volume.py")
cv = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(cv)


class ChapterVolumeTest(unittest.TestCase):
    def test_chapter_prefix(self):
        self.assertEqual(cv.chapter_of("ch2_home"), 2)
        self.assertEqual(cv.chapter_of("remake_ch1"), 1)
        self.assertEqual(cv.chapter_of("ch5_main"), 5)
        # LIME や接頭辞の無いファイルは数えない
        self.assertIsNone(cv.chapter_of("lime_ch2"))
        self.assertIsNone(cv.chapter_of("common_rest"))

    def test_counts_only_text_without_spaces(self):
        data = {"dialogues": [{"dialogue_id": "x_ch3_y", "lines": [
            {"speaker": "はじめ", "text": "あ い\nう　え"},
            {"speaker": "スミ", "text": "おか", "choices": [{"label": "数えない", "text": "き"}]},
        ]}], "note": "数えない"}
        self.assertEqual(cv.count_text(data), 4 + 2 + 1)

    def test_measure_targets(self):
        files = {
            "ch1_a": {"text": "あ" * 100},
            "remake_ch1": {"text": "い" * 20},
            "ch2_b": {"text": "う" * 30},
            "ch5_c": {"text": "え" * 10},
            "lime_x": {"text": "お" * 999},
        }
        result = cv.measure(files)
        rows = {r["chapter"]: r for r in result["chapters"]}
        self.assertEqual(rows[1]["chars"], 120)
        self.assertEqual(rows[2]["to_target"], 90)
        self.assertIsNone(rows[5]["to_target"])  # 第5章は増やさない
        self.assertNotIn("lime_x", result["files"])

    def test_real_data_loads(self):
        result = cv.measure(cv.load_files(None))
        chapters = [r["chapter"] for r in result["chapters"]]
        self.assertEqual(chapters, [1, 2, 3, 4, 5])
        self.assertTrue(all(r["chars"] > 0 for r in result["chapters"]))


if __name__ == "__main__":
    unittest.main()
