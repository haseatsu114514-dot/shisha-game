import unittest
from check_story_canon import lime_first_person_errors, text_errors


class CanonRegressionTests(unittest.TestCase):
    def test_tsumugi_unquoted_first_person_drift(self):
        for text in ('わたし、煙に色が見えるんです。', '……わたしも……ずっと。',
                     '今日は、わたしから', '煙の色を、わたしに見せてください。',
                     '今、わたしが落ち着いている色です。', 'わたしは描きます。',
                     '……わたしと、はじめさんの色。'):
            with self.subTest(text=text):
                self.assertIn('つむぎの一人称は私（#2015）',
                              text_errors({'speaker': 'tsumugi', 'text': text}))

    def test_tsumugi_drift_excludes_other_voices_quotes_and_ambiguous_uses(self):
        for speaker in ('', None, 'hajime', 'mashiro', 'minto', 'hiyori'):
            self.assertFalse(text_errors({'speaker': speaker, 'text': 'わたしは描きます。'}))
        for text in ('私、描きます。', '「わたしは行く」と聞きました。',
                     '『わたしは行く』と書いてあります。',
                     '「彼女は『わたしは行く』と言った」そうです。',
                     '“わたしは行く”と書いてあります。',
                     '‘わたしは行く’と書いてあります。',
                     '"わたしは行く"と書いてあります。',
                     "'わたしは行く'と書いてあります。",
                     '「私」と書いて、わたしは読みます。',
                     'あなたのわたしは、どんな色ですか。', 'わたしの資料です。',
                     'わたしたちは待っています。', 'わたし'):
            with self.subTest(text=text):
                self.assertFalse(text_errors({'speaker': 'tsumugi', 'text': text}))
        self.assertFalse(text_errors({'speaker': 'tsumugi', 'text': None}))

    def test_lime_checks_explicit_sender_and_reply_response_only(self):
        data = {'messages': [{
            'id': 'test_tsumugi', 'sender': 'tsumugi',
            'messages': [{'sender': 'tsumugi', 'text': '……わたしには橙色です。'},
                         {'sender': 'hajime', 'text': 'わたしは行く。'},
                         {'text': 'わたしは誰の発言か不明です。'}],
            'replies': [{'text': 'わたしは行く。', 'response': 'わたしも待ちます。'}],
        }]}
        errors = lime_first_person_errors(data)
        self.assertEqual(len(errors), 2)
        self.assertTrue(all('lime_messages.json:test_tsumugi:' in e for e in errors))
        self.assertEqual(sum('replies.response:' in e for e in errors), 1)
        data['messages'][0]['messages'][0]['text'] = '私には橙色です。'
        data['messages'][0]['replies'][0]['response'] = '『わたしも待つ』と聞きました。'
        self.assertEqual(lime_first_person_errors(data), [])
        data['messages'][0]['sender'] = 'minto'
        data['messages'][0]['replies'][0]['response'] = 'わたしも待ちます。'
        self.assertEqual(lime_first_person_errors(data), [])

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
