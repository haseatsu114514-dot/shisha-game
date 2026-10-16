"""Regression cases for real speaker boundaries and non-pronoun words."""
import unittest
from pathlib import Path
import check_mashiro_address as voice
import check_legacy_terms as legacy


class MashiroVoiceTests(unittest.TestCase):
    def setUp(self):
        voice.bad.clear()

    def test_canonical_and_elongated_address(self):
        voice.check_text("はじめくん、僕も嬉しい。はじめく〜ん！", "sample")
        self.assertEqual(voice.bad, [])

    def test_wrong_addresses_and_pronouns(self):
        for text in ["はじめさん", "蒸野くん", "始君", "ハジメくん", "はじめ！", "わたしの", "私の", "うちのこと"]:
            with self.subTest(text=text):
                voice.bad.clear()
                voice.check_text(text, "sample")
                self.assertTrue(voice.bad)

    def test_greetings_and_ordinary_words(self):
        voice.check_text("はじめまして。そのうち、おうちで私服の話も。うちの店にも来てね", "sample")
        self.assertEqual(voice.bad, [])

    def test_dialogue_speaker_and_player_choices(self):
        voice.scan({"speaker": "mashiro", "text": "僕ははじめくんと", "choices": [{"text": "私も"}],
                    "branches": {"other": [{"speaker": "rin", "text": "私と蒸野くん"}]}}, "sample")
        self.assertEqual(voice.bad, [])
        voice.scan({"dialogues": [{"lines": [{"speaker": "mashiro", "text": "はじめさん"}]}]}, "sample")
        self.assertEqual(len(voice.bad), 1)

    def test_lime_all_speech_fields_and_sender_override(self):
        voice.scan_lime({"sender": "mashiro", "text": "僕だよ", "response": "はじめさん", "reminder_text": "私も",
                         "messages": [{"sender": "hajime", "text": "私服だよ"}],
                         "decline_response": {"text": "うちのこと"}, "accept_text": "私も行きます"}, "sample")
        self.assertEqual(len(voice.bad), 3)

    def test_lover_character_keys_and_player_options(self):
        voice.scan_lover({"mashiro": {"text": "僕とはじめくん", "optA": "私も", "optB": "蒸野くん",
                                     "replyA": "はじめさん"}, "rin": {"text": "私"}}, "sample")
        self.assertEqual(len(voice.bad), 1)

    def test_relocated_legacy_warning_is_contextual(self):
        path = Path("docs/gameplay_agent_reference.md")
        term = next(iter(legacy.LEGACY_ERROR))
        self.assertTrue(legacy.is_doc_context(path, f"旧名『{term}』は使わない"))
        self.assertFalse(legacy.is_doc_context(path, f"{term}が登場する"))


if __name__ == "__main__":
    unittest.main()
