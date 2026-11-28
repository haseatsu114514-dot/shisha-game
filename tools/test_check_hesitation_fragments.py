"""Regression cases for hesitation fragments that previously passed lint."""

from pathlib import Path
import unittest

from check_hesitation_fragments import ALLOWLIST, segments_start_fragments


class HesitationFragmentsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.allowed = set(Path(ALLOWLIST).read_text(encoding="utf-8").splitlines())

    def test_missed_fragments_are_rejected(self):
        for text, expected in (
            ("……あ、く、暗いのは苦手だわ", "連続:あ、く、暗いのは苦手だわ"),
            ("……あ、ま、まだ間に合うかしら", "連続:あ、ま、まだ間に合うかしら"),
            ("……あ、こ、怖いわ", "連続:あ、こ、怖いわ"),
            ("『一緒に撮ろう』『い、一緒に……』。何度も練習した跡だ", "い、一"),
            ("え、あ、あつい", "連続:え、あ、あつい"),
        ):
            with self.subTest(text=text):
                self.assertIn(expected, set(segments_start_fragments(text)) - self.allowed)

    def test_interjections_and_corrected_fragments_pass(self):
        for text in (
            "……あ、…暗いのは苦手だわ",
            "……あ、…まだ間に合うかしら",
            "……あ、…怖いわ",
            "『一緒に撮ろう』『…一緒に……』。何度も練習した跡だ",
            "え、あ、つられただけです",
            "はい、さん、に、いち！",
        ):
            with self.subTest(text=text):
                self.assertFalse(set(segments_start_fragments(text)) - self.allowed)


if __name__ == "__main__":
    unittest.main()
