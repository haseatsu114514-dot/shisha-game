#!/usr/bin/env python3
"""Unit and CLI integration tests for tools/check_dialogue_text_only.py."""

from __future__ import annotations

import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT_PATH = Path(__file__).resolve().parent / "check_dialogue_text_only.py"


def _sample_dialogue_doc() -> dict:
    return {
        "character_id": "ch_example",
        "meta": {
            "version": 1,
            "active": True,
            "null_field": None,
        },
        "scenes": [
            {
                "id": "scene_01",
                "speaker": "npc",
                "text": "Hello_BEFORE_SECRET_VALUE",
                "next": "scene_02",
                "condition": "flag_met == 1",
                "reward": {
                    "type": "money",
                    "amount": 500,
                    "label": "REWARD_LABEL_BEFORE_SECRET",
                },
                "choices": [
                    {
                        "id": "c1",
                        "label": "Option_1_BEFORE_SECRET",
                        "next": "scene_02a",
                        "subchoices": [
                            {
                                "id": "sc1",
                                "text": "Nested_Choice_BEFORE_SECRET",
                            }
                        ],
                    },
                    {
                        "id": "c2",
                        "label": "Option_2_BEFORE_SECRET",
                        "next": "scene_02b",
                        "subchoices": [],
                    },
                ],
            }
        ],
        "special": {
            "a/b": "Slash_BEFORE_SECRET",
            "c~d": "Tilde_BEFORE_SECRET",
            "": "EmptyKey_BEFORE_SECRET",
            "日本語キー": "Unicode_BEFORE_SECRET_値",
            "*": "LiteralStar_BEFORE_SECRET",
            "01": "NumericLookingObjectKey_BEFORE_SECRET",
        },
    }


class TestCheckDialogueTextOnlyCLI(unittest.TestCase):
    """End-to-end tests spawning the CLI and checking exit codes, diagnostics, and read-only guarantees."""

    def _run_cli_with_bytes(
        self,
        before_bytes: bytes,
        after_bytes: bytes,
        allowlist_bytes: bytes,
        extra_args: list[str] | None = None,
    ) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            before_file = tmp_path / "before.json"
            after_file = tmp_path / "after.json"
            allowlist_file = tmp_path / "allowlist.json"

            before_file.write_bytes(before_bytes)
            after_file.write_bytes(after_bytes)
            allowlist_file.write_bytes(allowlist_bytes)

            files = (before_file, after_file, allowlist_file)
            snapshots = {
                f: (f.read_bytes(), f.stat().st_mtime_ns) for f in files
            }

            cmd = [
                sys.executable,
                str(SCRIPT_PATH),
                str(before_file),
                str(after_file),
                str(allowlist_file),
            ]
            if extra_args:
                cmd.extend(extra_args)

            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False,
            )

            for f in files:
                after_raw, old_mtime_ns = snapshots[f]
                self.assertEqual(
                    f.read_bytes(),
                    after_raw,
                    f"Input file {f.name} bytes were modified by CLI",
                )
                self.assertEqual(
                    f.stat().st_mtime_ns,
                    old_mtime_ns,
                    f"Input file {f.name} mtime_ns was modified by CLI",
                )

            self.assertEqual(proc.stdout, "", "STDOUT must remain empty")
            self.assertNotIn("Traceback", proc.stderr)
            return proc

    def _run_cli_with_json(
        self,
        before_obj: object,
        after_obj: object,
        allowlist_obj: object,
    ) -> subprocess.CompletedProcess[str]:
        return self._run_cli_with_bytes(
            json.dumps(before_obj, ensure_ascii=False).encode("utf-8"),
            json.dumps(after_obj, ensure_ascii=False).encode("utf-8"),
            json.dumps(allowlist_obj, ensure_ascii=False).encode("utf-8"),
        )

    def test_unchanged_empty_allowlist_and_extra_unchanged_allowed_paths(self) -> None:
        doc = _sample_dialogue_doc()
        proc_empty = self._run_cli_with_json(doc, copy.deepcopy(doc), [])
        self.assertEqual(proc_empty.returncode, 0, proc_empty.stderr)
        self.assertEqual(proc_empty.stderr, "")

        # Extra allowlisted string paths that happen not to change are valid.
        proc_unchanged_allow = self._run_cli_with_json(
            doc,
            copy.deepcopy(doc),
            ["/scenes/0/text", "/scenes/0/choices/0/label"],
        )
        self.assertEqual(proc_unchanged_allow.returncode, 0, proc_unchanged_allow.stderr)
        self.assertEqual(proc_unchanged_allow.stderr, "")

    def test_allowed_single_and_multiple_and_nested_choices(self) -> None:
        before = _sample_dialogue_doc()
        after = copy.deepcopy(before)
        after["scenes"][0]["text"] = "Hello_AFTER_SECRET_VALUE"

        proc_single = self._run_cli_with_json(before, after, ["/scenes/0/text"])
        self.assertEqual(proc_single.returncode, 0, proc_single.stderr)

        after["scenes"][0]["choices"][0]["label"] = "Option_1_AFTER_SECRET"
        after["scenes"][0]["choices"][0]["subchoices"][0]["text"] = "Nested_AFTER_SECRET"
        proc_multi = self._run_cli_with_json(
            before,
            after,
            [
                "/scenes/0/text",
                "/scenes/0/choices/0/label",
                "/scenes/0/choices/0/subchoices/0/text",
            ],
        )
        self.assertEqual(proc_multi.returncode, 0, proc_multi.stderr)

    def test_escaped_keys_empty_key_unicode_and_literal_star(self) -> None:
        before = _sample_dialogue_doc()
        after = copy.deepcopy(before)
        after["special"]["a/b"] = "Slash_AFTER"
        after["special"]["c~d"] = "Tilde_AFTER"
        after["special"][""] = "Empty_AFTER"
        after["special"]["日本語キー"] = "Unicode_AFTER"
        after["special"]["*"] = "Star_AFTER"
        after["special"]["01"] = "NumericKey_AFTER"

        allowlist = [
            "/special/a~1b",
            "/special/c~0d",
            "/special/",
            "/special/日本語キー",
            "/special/*",
            "/special/01",
        ]
        proc = self._run_cli_with_json(before, after, allowlist)
        self.assertEqual(proc.returncode, 0, proc.stderr)

    def test_root_string_pointer_supported(self) -> None:
        proc_pass = self._run_cli_with_json("root_before_secret", "root_after_secret", [""])
        self.assertEqual(proc_pass.returncode, 0, proc_pass.stderr)

        proc_fail = self._run_cli_with_json("root_before_secret", "root_after_secret", [])
        self.assertEqual(proc_fail.returncode, 1)
        self.assertIn('path=""', proc_fail.stderr)
        self.assertIn("category=unallowed_string_change", proc_fail.stderr)
        self.assertNotIn("root_before_secret", proc_fail.stderr)
        self.assertNotIn("root_after_secret", proc_fail.stderr)

    def test_unallowed_text_and_metadata_changes_rejected_without_leaking_values(self) -> None:
        cases = [
            (["scenes", 0, "text"], "UNALLOWED_TEXT_SECRET", "/scenes/0/text", "unallowed_string_change"),
            (["scenes", 0, "id"], "SCENE_ID_SECRET", "/scenes/0/id", "unallowed_string_change"),
            (["scenes", 0, "speaker"], "SPEAKER_SECRET", "/scenes/0/speaker", "unallowed_string_change"),
            (["scenes", 0, "next"], "NEXT_SECRET", "/scenes/0/next", "unallowed_string_change"),
            (["scenes", 0, "condition"], "COND_SECRET", "/scenes/0/condition", "unallowed_string_change"),
            (
                ["scenes", 0, "reward", "label"],
                "REWARD_SECRET",
                "/scenes/0/reward/label",
                "unallowed_string_change",
            ),
            (["scenes", 0, "reward", "amount"], 999999, "/scenes/0/reward/amount", "scalar_value_change"),
        ]
        for path_steps, new_val, expected_ptr, expected_cat in cases:
            with self.subTest(expected_ptr=expected_ptr):
                before = _sample_dialogue_doc()
                after = copy.deepcopy(before)
                target = after
                for step in path_steps[:-1]:
                    target = target[step]
                old_val = target[path_steps[-1]]
                target[path_steps[-1]] = new_val

                proc = self._run_cli_with_json(before, after, [])
                self.assertEqual(proc.returncode, 1)
                self.assertIn(f'path="{expected_ptr}"', proc.stderr)
                self.assertIn(f"category={expected_cat}", proc.stderr)
                self.assertNotIn(str(old_val), proc.stderr)
                self.assertNotIn(str(new_val), proc.stderr)

    def test_key_addition_and_deletion_rejected(self) -> None:
        before = _sample_dialogue_doc()
        after_added = copy.deepcopy(before)
        after_added["scenes"][0]["extra_field"] = "SECRET_ADDED_VALUE"

        proc_add = self._run_cli_with_json(before, after_added, ["/scenes/0/text"])
        self.assertEqual(proc_add.returncode, 1)
        self.assertIn("category=extra_key", proc_add.stderr)
        self.assertIn('path="/scenes/0/extra_field"', proc_add.stderr)
        self.assertNotIn("SECRET_ADDED_VALUE", proc_add.stderr)

        after_removed = copy.deepcopy(before)
        del after_removed["scenes"][0]["condition"]
        proc_rem = self._run_cli_with_json(before, after_removed, ["/scenes/0/text"])
        self.assertEqual(proc_rem.returncode, 1)
        self.assertIn("category=missing_key", proc_rem.stderr)
        self.assertIn('path="/scenes/0/condition"', proc_rem.stderr)
        self.assertNotIn("flag_met == 1", proc_rem.stderr)

    def test_array_insertion_deletion_and_reordering_rejected(self) -> None:
        before = _sample_dialogue_doc()
        after_insert = copy.deepcopy(before)
        after_insert["scenes"][0]["choices"].append(
            {"id": "c3", "label": "SECRET_C3", "next": "s3", "subchoices": []}
        )

        proc_ins = self._run_cli_with_json(before, after_insert, [])
        self.assertEqual(proc_ins.returncode, 1)
        self.assertIn("category=array_length_mismatch", proc_ins.stderr)
        self.assertIn('path="/scenes/0/choices"', proc_ins.stderr)
        self.assertNotIn("SECRET_C3", proc_ins.stderr)

        after_delete = copy.deepcopy(before)
        after_delete["scenes"][0]["choices"].pop()
        proc_del = self._run_cli_with_json(before, after_delete, [])
        self.assertEqual(proc_del.returncode, 1)
        self.assertIn("category=array_length_mismatch", proc_del.stderr)
        self.assertIn('path="/scenes/0/choices"', proc_del.stderr)

        after_reorder = copy.deepcopy(before)
        after_reorder["scenes"][0]["choices"].reverse()
        # Even if choice labels are allowlisted, reordering changes choice IDs/next/subchoices.
        proc_reorder = self._run_cli_with_json(
            before,
            after_reorder,
            ["/scenes/0/choices/0/label", "/scenes/0/choices/1/label"],
        )
        self.assertEqual(proc_reorder.returncode, 1)
        self.assertIn('path="/scenes/0/choices/0/id"', proc_reorder.stderr)
        self.assertIn("category=unallowed_string_change", proc_reorder.stderr)

    def test_type_changes_and_boolean_vs_number_distinction(self) -> None:
        before = {"flag_true": True, "flag_false": False, "num_one": 1, "num_zero": 0, "text": "s"}
        after_bool_to_int = {"flag_true": 1, "flag_false": 0, "num_one": 1, "num_zero": 0, "text": "s"}
        proc = self._run_cli_with_json(before, after_bool_to_int, [])
        self.assertEqual(proc.returncode, 1)
        self.assertIn('category=type_mismatch path="/flag_false"', proc.stderr)
        self.assertIn('category=type_mismatch path="/flag_true"', proc.stderr)

        after_int_to_bool = {"flag_true": True, "flag_false": False, "num_one": True, "num_zero": False, "text": "s"}
        proc2 = self._run_cli_with_json(before, after_int_to_bool, [])
        self.assertEqual(proc2.returncode, 1)
        self.assertIn('category=type_mismatch path="/num_one"', proc2.stderr)
        self.assertIn('category=type_mismatch path="/num_zero"', proc2.stderr)

    def test_large_integers_and_high_precision_decimals(self) -> None:
        # 2**60 + 1 vs 2**60 + 2 collide in IEEE 754 float64
        before_int = b'{"big": 1152921504606846977}\n'
        after_int = b'{"big": 1152921504606846978}\n'
        proc_int = self._run_cli_with_bytes(before_int, after_int, b"[]")
        self.assertEqual(proc_int.returncode, 1)
        self.assertIn('category=scalar_value_change path="/big"', proc_int.stderr)
        self.assertNotIn("1152921504606846977", proc_int.stderr)
        self.assertNotIn("1152921504606846978", proc_int.stderr)

        before_dec = b'{"dec": 0.100000000000000000000000001}\n'
        after_dec = b'{"dec": 0.100000000000000000000000002}\n'
        proc_dec = self._run_cli_with_bytes(before_dec, after_dec, b"[]")
        self.assertEqual(proc_dec.returncode, 1)
        self.assertIn('category=scalar_value_change path="/dec"', proc_dec.stderr)

        # Semantically equal JSON numbers (1 vs 1.0) pass
        proc_num_eq = self._run_cli_with_bytes(b'{"n": 1}', b'{"n": 1.0}', b"[]")
        self.assertEqual(proc_num_eq.returncode, 0, proc_num_eq.stderr)

    def test_invalid_json_duplicate_keys_and_non_finite_numbers(self) -> None:
        valid = b'{"a": "ok"}'
        allow = b"[]"

        # Malformed JSON in each of the 3 files without leaking file snippet
        for idx, (b_raw, a_raw, al_raw) in enumerate(
            [
                (b'{"a": "LEAK_SECRET_TOKEN"', valid, allow),
                (valid, b'{"a": "LEAK_SECRET_TOKEN"', allow),
                (valid, valid, b'["/a", LEAK_SECRET_TOKEN]'),
            ]
        ):
            with self.subTest(case=f"malformed_{idx}"):
                proc = self._run_cli_with_bytes(b_raw, a_raw, al_raw)
                self.assertEqual(proc.returncode, 2)
                self.assertIn("INVALID_INPUT:", proc.stderr)
                self.assertNotIn("LEAK_SECRET_TOKEN", proc.stderr)

        # Duplicate keys at root or nested in before, after, or allowlist objects
        dup_cases = [
            (b'{"a": "1", "a": "2"}', valid, allow),
            (valid, b'{"nested": {"k": "1", "k": "2"}, "a": "ok"}', allow),
            # Duplicate keys inside an invalid object element of allowlist
            (valid, valid, b'[{"dup": 1, "dup": 2}]'),
        ]
        for idx, (b_raw, a_raw, al_raw) in enumerate(dup_cases):
            with self.subTest(case=f"duplicate_key_{idx}"):
                proc = self._run_cli_with_bytes(b_raw, a_raw, al_raw)
                self.assertEqual(proc.returncode, 2)
                self.assertIn("duplicate JSON object key", proc.stderr)

        # Non-finite numbers (NaN, Infinity, -Infinity) in any input
        for bad_const in (b"NaN", b"Infinity", b"-Infinity"):
            with self.subTest(const=bad_const.decode("ascii")):
                proc = self._run_cli_with_bytes(
                    b'{"a": "ok", "n": ' + bad_const + b"}",
                    valid,
                    allow,
                )
                self.assertEqual(proc.returncode, 2)
                self.assertIn("non-finite JSON constant", proc.stderr)

    def test_invalid_pointers_and_allowlist_violations(self) -> None:
        doc = _sample_dialogue_doc()
        invalid_allowlists: list[object] = [
            {"not": "an_array"},
            [123],
            ["scenes/0/text"],  # missing leading slash
            ["#/scenes/0/text"],  # URI fragment not allowed
            ["/special/c~2d"],  # invalid ~ escape
            ["/special/trailing~"],  # incomplete ~ escape
            ["/scenes/0/text", "/scenes/0/text"],  # duplicate pointer
            ["/scenes/0/nonexistent"],  # nonexistent key
            ["/scenes/*"],  # wildcard on array / nonexistent
            ["/scenes/0/*"],  # wildcard on object where '*' key does not exist
            ["/scenes/0"],  # container object allowlisted
            ["/scenes/0/choices"],  # container array allowlisted
            ["/scenes/0/reward/amount"],  # number leaf allowlisted
            ["/meta/active"],  # boolean leaf allowlisted
            ["/meta/null_field"],  # null leaf allowlisted
            ["/scenes/0/text/deeper"],  # traversing through string scalar
            ["/scenes/01/text"],  # leading zero in array index
            ["/scenes/-1/text"],  # negative array index
            ["/scenes/+0/text"],  # plus sign in array index
            ["/scenes/-/text"],  # '-' array append token
            ["/scenes/１/text"],  # full-width unicode digit in array index
            ["/scenes/999999999999999999999999999999/text"],  # giant out-of-bounds array index
        ]
        for bad_allow in invalid_allowlists:
            with self.subTest(allowlist=bad_allow):
                proc = self._run_cli_with_json(doc, copy.deepcopy(doc), bad_allow)
                self.assertEqual(proc.returncode, 2, f"Expected exit 2 for {bad_allow}")
                self.assertIn("INVALID_INPUT:", proc.stderr)

    def test_allowlist_path_missing_or_non_string_in_only_one_document(self) -> None:
        before = {"a": "hello", "b": "world"}
        after_missing = {"a": "hello"}
        proc_missing = self._run_cli_with_json(before, after_missing, ["/b"])
        self.assertEqual(proc_missing.returncode, 2)
        self.assertIn("does not exist in after", proc_missing.stderr)

        after_non_string = {"a": "hello", "b": 42}
        proc_type = self._run_cli_with_json(before, after_non_string, ["/b"])
        self.assertEqual(proc_type.returncode, 2)
        self.assertIn("must resolve to a string leaf in both documents", proc_type.stderr)

    def test_extreme_array_index_is_rejected_without_traceback(self) -> None:
        proc = self._run_cli_with_json(
            {"lines": [{"text": "old"}]},
            {"lines": [{"text": "new"}]},
            ["/lines/" + "9" * 4500 + "/text"],
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("out-of-bounds array index", proc.stderr)
        self.assertNotIn("Traceback", proc.stderr)

    def test_huge_integer_and_unsupported_exponent(self) -> None:
        huge_before = b'{"n":' + b"9" * 4500 + b"}"
        huge_after = b'{"n":' + b"8" + b"9" * 4499 + b"}"
        same = self._run_cli_with_bytes(huge_before, huge_before, b"[]")
        self.assertEqual(same.returncode, 0)
        changed = self._run_cli_with_bytes(huge_before, huge_after, b"[]")
        self.assertEqual(changed.returncode, 1)
        self.assertIn('path="/n"', changed.stderr)
        extreme = b'{"n":1e999999999999999999999999999999999999}'
        for before, after, allow in (
            (extreme, b"{}", b"[]"),
            (b"{}", extreme, b"[]"),
            (b"{}", b"{}", b"[1e999999999999999999999999999999999999]"),
        ):
            proc = self._run_cli_with_bytes(before, after, allow)
            self.assertEqual(proc.returncode, 2)
            self.assertIn("supported numeric range", proc.stderr)
            self.assertNotIn("Traceback", proc.stderr)

    def test_unicode_line_separator_in_pointer_is_escaped(self) -> None:
        for separator in ("\u0085", "\u2028", "\u2029"):
            proc = self._run_cli_with_json(
                {"a" + separator + "b": "old"},
                {"a" + separator + "b": "new"},
                [],
            )
            self.assertEqual(proc.returncode, 1)
            self.assertEqual(len(proc.stderr.splitlines()), 1)
            self.assertNotIn(separator, proc.stderr)

    def test_deep_documents_fail_closed_without_traceback(self) -> None:
        limit = sys.getrecursionlimit()
        for opening, closing in (("[", "]"), ('{"a":', "}")):
            for depth in (max(1, limit - 4), limit, limit + 5):
                before = (opening * depth + '"DEEP_BEFORE_SECRET"' + closing * depth).encode()
                changed = (opening * depth + '"DEEP_AFTER_SECRET"' + closing * depth).encode()
                for after, accepted_codes in ((before, (0, 2)), (changed, (1, 2))):
                    with self.subTest(shape=opening, depth=depth, changed=after != before):
                        proc = self._run_cli_with_bytes(before, after, b"[]")
                        self.assertIn(proc.returncode, accepted_codes)
                        self.assertNotIn("Traceback", proc.stderr)
                        self.assertNotIn("DEEP_BEFORE_SECRET", proc.stderr + proc.stdout)
                        self.assertNotIn("DEEP_AFTER_SECRET", proc.stderr + proc.stdout)
                        if proc.returncode == 2:
                            self.assertIn("INVALID_INPUT:", proc.stderr)

    def test_cli_argument_count_and_missing_file_errors(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            missing = Path(tmp_dir) / "does_not_exist.json"
            proc_missing = subprocess.run(
                [sys.executable, str(SCRIPT_PATH), str(missing), str(missing), str(missing)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(proc_missing.returncode, 2)
            self.assertIn("INVALID_INPUT:", proc_missing.stderr)

            proc_bad_args = subprocess.run(
                [sys.executable, str(SCRIPT_PATH), str(missing)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(proc_bad_args.returncode, 2)
            self.assertIn("INVALID_INPUT:", proc_bad_args.stderr)


if __name__ == "__main__":
    unittest.main()
