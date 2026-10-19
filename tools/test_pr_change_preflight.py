"""Small in-memory API fixtures; never dispatch workflows or mutate GitHub."""

import contextlib
import copy
import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pr_change_preflight as checker


def plan():
    return {"version": 1, "issue": 422, "worker": "fixture-worker",
            "files": ["tools/example.py"], "dependencies": {"issues": [], "prs": []}}


def pull(number=7, files=1, **values):
    return {"number": number, "state": "open", "draft": True, "merged": False,
            "changed_files": files, "head": {"sha": "a" * 40}, **values}


class Fixtures:
    def __init__(self, pulls=None, files=None, issues=None):
        self.pulls = pulls or {}
        self.file_data = files or {}
        self.issues = issues or {}

    def open_pulls(self):
        return [copy.deepcopy(value) for value in self.pulls.values() if value["state"] == "open"]

    def pull(self, number):
        if number not in self.pulls:
            raise checker.FetchError(f"PR #{number}: unavailable")
        return copy.deepcopy(self.pulls[number])

    def files(self, number):
        value = self.file_data[number]
        if isinstance(value, Exception):
            raise value
        return copy.deepcopy(value)

    def issue(self, number):
        if number not in self.issues:
            raise checker.FetchError(f"Issue #{number}: unavailable")
        return copy.deepcopy(self.issues[number])


class PreflightTests(unittest.TestCase):
    def test_nonoverlap_includes_draft(self):
        report = checker.check(plan(), Fixtures({7: pull()}, {7: [{"filename": "other.py"}]}))
        self.assertEqual(report["status"], "no_detected_overlap")
        self.assertEqual(report["checked_prs"][0]["draft"], True)
        self.assertIn("not proof of a defect", " ".join(report["limitations"]))
        self.assertIn("Unpushed", " ".join(report["limitations"]))

    def test_overlap_open_and_draft(self):
        for draft in (False, True):
            with self.subTest(draft=draft):
                report = checker.check(plan(), Fixtures({7: pull(draft=draft)},
                                                        {7: [{"filename": "tools/example.py"}]}))
                self.assertEqual(report["status"], "requires_review")
                self.assertEqual(report["file_overlaps"][0]["files"], ["tools/example.py"])
                self.assertEqual(report["fetch_failures"], [])

    def test_rename_checks_both_paths(self):
        report = checker.check(plan(), Fixtures({7: pull()}, {7: [{"filename": "new.py",
                                                  "previous_filename": "tools/example.py"}]}))
        self.assertEqual(report["status"], "requires_review")

    def test_open_dependency_issue_and_closed_unmerged_pr(self):
        p = plan()
        p["dependencies"] = {"issues": [8], "prs": [9]}
        report = checker.check(p, Fixtures({9: pull(9, state="closed")},
                                          issues={8: {"number": 8, "state": "open"}}))
        self.assertEqual(report["status"], "requires_review")
        self.assertEqual(len(report["unmerged_dependencies"]), 2)
        self.assertIs(report["unmerged_dependencies"][1]["merged"], False)

    def test_merged_dependency_and_closed_issue(self):
        p = plan()
        p["dependencies"] = {"issues": [8], "prs": [9]}
        report = checker.check(p, Fixtures({9: pull(9, state="closed", merged=True)},
                                          issues={8: {"number": 8, "state": "closed", "state_reason": "completed"}}))
        self.assertEqual(report["status"], "no_detected_overlap")

    def test_closed_not_planned_or_unknown_issue_reason_stays_pending(self):
        p = plan()
        p["dependencies"]["issues"] = [8]
        for reason in ("not_planned", None):
            with self.subTest(reason=reason):
                report = checker.check(p, Fixtures(issues={8: {"number": 8, "state": "closed", "state_reason": reason}}))
                self.assertEqual(report["status"], "requires_review")
                self.assertEqual(report["unmerged_dependencies"][0]["state_reason"], reason)

    def test_missing_plan_fields_are_incomplete_without_fetch(self):
        for path in ("files", "dependencies", "worker", "issue", "version"):
            p = plan()
            del p[path]
            with self.subTest(path=path):
                report = checker.check(p, None)
                self.assertEqual(report["status"], "incomplete")
                self.assertTrue(report["missing_information"])
        p = plan()
        del p["dependencies"]["prs"]
        self.assertEqual(checker.check(p, None)["status"], "incomplete")

    def test_explicit_empty_plan_is_distinct_from_missing(self):
        p = plan()
        p["files"] = []
        report = checker.check(p, Fixtures())
        self.assertEqual(report["status"], "no_detected_overlap")
        self.assertEqual(report["plan"]["files"], [])

    def test_invalid_paths_dependency_types_and_self_dependency(self):
        for value in ("../escape", "/absolute", "*.py", "a/../b", "./a", "a//b", "a\\b"):
            p = plan()
            p["files"] = [value]
            with self.subTest(value=value):
                self.assertEqual(checker.check(p, None)["status"], "incomplete")
        for deps in ({"issues": [422], "prs": []}, {"issues": [], "prs": [True]},
                     {"issues": [], "prs": [9, 9]}):
            p = plan()
            p["dependencies"] = deps
            self.assertEqual(checker.check(p, None)["status"], "incomplete")

    def test_list_fetch_failure_is_not_no_overlap(self):
        client = Fixtures()
        client.open_pulls = lambda: (_ for _ in ()).throw(checker.FetchError("Open PR list unavailable"))
        report = checker.check(plan(), client)
        self.assertEqual(report["status"], "incomplete")
        self.assertEqual(report["fetch_failures"], ["Open PR list unavailable"])

    def test_file_fetch_failure_preserves_other_known_overlap(self):
        client = Fixtures({7: pull(), 8: pull(8)}, {7: [{"filename": "tools/example.py"}],
                          8: checker.FetchError("files unavailable")})
        report = checker.check(plan(), client)
        self.assertEqual(report["status"], "incomplete")
        self.assertEqual(report["file_overlaps"][0]["pr"], 7)
        self.assertEqual(report["fetch_failures"], ["files unavailable"])

    def test_incomplete_and_api_limit_files(self):
        for count, files in ((2, [{"filename": "other.py"}]), (3001, []),
                             (2, [{"filename": "a.py"}, {"filename": "a.py"}])):
            with self.subTest(count=count):
                report = checker.check(plan(), Fixtures({7: pull(files=count)}, {7: files}))
                self.assertEqual(report["status"], "incomplete")
                self.assertTrue(report["fetch_failures"])

    def test_head_changes_are_incomplete(self):
        client = Fixtures({7: pull()}, {7: [{"filename": "other.py"}]})
        calls = []

        def changing_pull(number):
            calls.append(number)
            return pull(head={"sha": "a" * 40 if len(calls) == 1 else "b" * 40})

        client.pull = changing_pull
        report = checker.check(plan(), client)
        self.assertEqual(report["status"], "incomplete")
        self.assertIn("changed while reading", report["fetch_failures"][0])

    def test_dependency_fetch_failure_and_pr_in_issue_array(self):
        p = plan()
        p["dependencies"]["prs"] = [99]
        self.assertEqual(checker.check(p, Fixtures())["status"], "incomplete")
        p["dependencies"] = {"issues": [8], "prs": []}
        report = checker.check(p, Fixtures(issues={8: {"number": 8, "state": "closed", "pull_request": {}}}))
        self.assertEqual(report["status"], "incomplete")

    def test_malformed_remote_metadata_is_not_safe(self):
        for field in ("draft", "merged", "changed_files", "head"):
            data = pull()
            del data[field]
            with self.subTest(field=field):
                report = checker.check(plan(), Fixtures({7: data}, {7: []}))
                self.assertEqual(report["status"], "incomplete")
        client = Fixtures()
        client.open_pulls = lambda: [{"number": 7}, {"number": 7}]
        self.assertEqual(checker.check(plan(), client)["status"], "incomplete")

    def test_cli_exit_codes_and_json_report(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "plan.json"
            for p, client, expected in ((plan(), Fixtures(), 0),
                                       (plan(), Fixtures({7: pull()}, {7: [{"filename": "tools/example.py"}]}), 1),
                                       ({}, Fixtures(), 2)):
                path.write_text(json.dumps(p))
                output = io.StringIO()
                with contextlib.redirect_stdout(output):
                    code = checker.main(["--plan", str(path), "--format", "json"], client=client)
                self.assertEqual(code, expected)
                report = json.loads(output.getvalue())
                self.assertIn("fetch_failures", report)
                self.assertIn("missing_information", report)

    def test_missing_file_and_invalid_json_exit_two(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.json"
            for contents in (None, "not-json", '{"files": [], "files": ["hidden"]}'):
                if contents is not None:
                    path.write_text(contents)
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(checker.main(["--plan", str(path)], client=Fixtures()), 2)

    def test_actual_gh_requests_are_get_only_and_paginated(self):
        values = ["[{\"number\":7}]\n[{\"number\":8}]", "{\"number\":7}"]
        with patch.object(checker.subprocess, "run") as run:
            run.side_effect = [subprocess.CompletedProcess([], 0, value, "") for value in values]
            client = checker.GitHub("owner/repo")
            self.assertEqual(client.open_pulls(), [{"number": 7}, {"number": 8}])
            self.assertEqual(client.pull(7), {"number": 7})
            for call in run.call_args_list:
                args = call.args[0]
                self.assertEqual(args[:4], ["gh", "api", "--method", "GET"])
                self.assertNotIn("--input", args)
            self.assertIn("--paginate", run.call_args_list[0].args[0])
            self.assertEqual(run.call_args_list[0].kwargs["timeout"], 90)
            self.assertIs(run.call_args_list[0].kwargs["shell"], False)

    def test_failed_partial_gh_result_and_invalid_pages(self):
        for value in (subprocess.CompletedProcess([], 1, "[]", "secret-proxy-detail"),
                      subprocess.CompletedProcess([], 0, "[]\nnot-json", ""),
                      subprocess.CompletedProcess([], 0, "{}", "")):
            with self.subTest(value=value.returncode), patch.object(checker.subprocess, "run", return_value=value):
                with self.assertRaises(checker.FetchError) as caught:
                    checker.GitHub("owner/repo").open_pulls()
                self.assertNotIn("secret-proxy-detail", str(caught.exception))

    def test_timeout_and_missing_gh_are_fetch_failures(self):
        for failure in (subprocess.TimeoutExpired("gh", 90), FileNotFoundError("gh")):
            with self.subTest(failure=type(failure).__name__), patch.object(checker.subprocess, "run", side_effect=failure):
                with self.assertRaises(checker.FetchError):
                    checker.GitHub("owner/repo").open_pulls()


if __name__ == "__main__":
    unittest.main()
