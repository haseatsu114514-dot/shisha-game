import unittest
from check_story_canon import text_errors


class CanonRegressionTests(unittest.TestCase):
    def test_old_script_style_and_split_inner_voice_are_rejected(self):
        for text in ('「前の台本」', '（まだ閉じていない', '閉じるだけ）', '♡'):
            self.assertTrue(text_errors({'speaker': 'hajime', 'text': text}), text)

    def test_voice_rules_are_speaker_specific(self):
        for who, text in [('hajime', '僕の煙だ'), ('dr_kemuri', '僕が作った'), ('tsumugi', 'はじめくん')]:
            self.assertTrue(text_errors({'speaker': who, 'text': text}))
        for who, text in [('mashiro', '僕、お茶にする'), ('samechan', 'わしも行くのじゃ'),
                          ('hajime', '（今日は休もう）'), ('hajime', '「いつもの」ですね')]:
            self.assertFalse(text_errors({'speaker': who, 'text': text}))

    def test_inner_voice_does_not_split_into_second_page(self):
        self.assertTrue(text_errors({'speaker': 'hajime', 'text': '（' + 'あ' * 47 + '）'}))
        self.assertFalse(text_errors({'speaker': 'hajime', 'text': '（' + 'あ' * 46 + '）'}))


if __name__ == '__main__':
    unittest.main()
