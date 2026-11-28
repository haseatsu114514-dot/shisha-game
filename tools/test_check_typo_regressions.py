"""Exercise registered cases through the dialogue and JavaScript regression check."""

from contextlib import redirect_stdout
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from check_typo_regressions import ROOT, load_cases, main, visible_texts


class TypoRegressionsTest(unittest.TestCase):
    def test_each_case_reports_vn_and_trpg_matches_and_accepts_the_fix(self):
        cases_file = ROOT / "tools/typo_cases.json"
        cases = load_cases(cases_file)
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "tools").mkdir()
            (root / "tools/typo_cases.json").write_bytes(cases_file.read_bytes())
            (root / "data/dialogue").mkdir(parents=True)
            file = root / "data/dialogue/chapter_poems.json"
            trpg = root / "data/dialogue/trpg_sample.json"

            for case in cases:
                for field, result in (("detect", 1), ("after", 0)):
                    with self.subTest(detect=case["detect"], field=field):
                        text = f"『{case[field]}』"
                        vn = {"dialogues": [{"branches": {"a": [
                            {"choices": [{"text": text, "next": case["detect"]}]},
                            {"inner": text},
                        ]}, "comment": case["detect"]}]}
                        file.write_text(json.dumps(vn, ensure_ascii=False), encoding="utf-8")
                        scenario = {"options": {"listen": [{"label": text}]},
                                    "ending": case["detect"]}
                        trpg.write_text(json.dumps(scenario, ensure_ascii=False), encoding="utf-8")
                        stdout = io.StringIO()
                        with redirect_stdout(stdout):
                            self.assertEqual(main(root), result)
                        if result:
                            output = stdout.getvalue()
                            self.assertIn("chapter_poems.json#/dialogues/0/branches/a/0/choices/0/text", output)
                            self.assertIn("chapter_poems.json#/dialogues/0/branches/a/1/inner", output)
                            self.assertIn("trpg_sample.json#/options/listen/0/label", output)
                            self.assertIn(case["detect"], output)

    def test_javascript_literals_are_checked_and_comments_are_ignored(self):
        cases_file = ROOT / "tools/typo_cases.json"
        cases = [case for case in load_cases(cases_file) if case["file"].endswith(".js")]
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "tools").mkdir()
            (root / "tools/typo_cases.json").write_bytes(cases_file.read_bytes())
            (root / "data/dialogue").mkdir(parents=True)
            (root / "data/dialogue/empty.json").write_text("{}", encoding="utf-8")
            for case in cases:
                file = root / case["file"]
                file.parent.mkdir(parents=True, exist_ok=True)
                for field, result in (("detect", 1), ("after", 0)):
                    with self.subTest(file=case["file"], field=field):
                        text = json.dumps(case[field], ensure_ascii=False)
                        file.write_text(f'// "{case["detect"]}"\nconst text = {text};\n', encoding="utf-8")
                        stdout = io.StringIO()
                        with redirect_stdout(stdout):
                            self.assertEqual(main(root), result)
                        if result:
                            self.assertIn(case["file"], stdout.getvalue())

    def test_visible_fields_and_author_metadata(self):
        document = {
            "lines": [{"text": "地の文。", "speaker": "hajime", "label": "メモ"}],
            "metadata": {"panel_alt": "パネルの説明", "description": "作者向けの説明",
                         "lime_history": {"call": "通話の内容", "sender": "hajime"}},
            "implementation_notes": {"text": "作者向けメモ"},
            "cast": [{"role": "船員", "costumeSpeaker": "内部照合名"}],
        }
        self.assertEqual(
            [text for _, text in visible_texts(document)],
            ["地の文。", "メモ", "パネルの説明", "通話の内容", "船員"],
        )


if __name__ == "__main__":
    unittest.main()
