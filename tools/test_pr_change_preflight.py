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


def comment(number=1, body=None, kind="User"):
    if body is None:
        body = ('WORKER: fixture-worker\nPLANNED_FILES: ["tools/example.py"]\n'
                'DEPENDS: {"issues": [], "prs": []}')
    return {"id": number, "body": body, "user": {"type": kind, "login": "fixture-author"}}


class IssueFixtures(Fixtures):
    def __init__(self, comments=None, **kwargs):
        super().__init__(**kwargs)
        self.comment_data = comments or []
        self.issues[422] = {"number": 422, "state": "open", "comments": len(self.comment_data)}

    def comments(self, number):
        return copy.deepcopy(self.comment_data)


class IssuePlanTests(unittest.TestCase):
    def test_issue_and_json_plan_reports_match(self):
        client = IssueFixtures([comment()], pulls={7: pull()}, files={7: [{"filename": "tools/example.py"}]})
        from_issue = checker.check_issue(422, client)
        from_json = checker.check(plan(), client)
        from_issue.pop("plan_source")
        from_issue.pop("observed_at")
        from_json.pop("observed_at")
        self.assertEqual(from_issue, from_json)

    def test_plan_uses_existing_overlap_and_dependency_checks(self):
        c = comment()
        c["body"] = c["body"].replace('"prs": []', '"prs": [9]')
        report = checker.check_issue(422, IssueFixtures([c], pulls={7: pull(), 9: pull(9, state="closed")},
                                                     files={7: [{"filename": "tools/example.py"}]}))
        self.assertEqual(report["status"], "requires_review")
        self.assertEqual(report["file_overlaps"][0]["pr"], 7)
        self.assertFalse(report["unmerged_dependencies"][0]["merged"])
        self.assertEqual(report["plan_source"], {"issue": 422, "comment_id": 1, "author": "fixture-author"})
        self.assertIn("PLAN_SOURCE: Issue #422 comment=1", checker.render_text(report))

    def test_no_plan_is_incomplete_including_body_bot_and_examples(self):
        for comments in ([], [comment(body="WORKER: only")], [comment(kind="Bot")],
                         [comment(body="```text\n" + comment()["body"] + "\n```")],
                         [comment(body="~~~text\n" + comment()["body"] + "\n~~~")],
                         [comment(body="\n".join("> " + line for line in comment()["body"].splitlines()))]):
            with self.subTest(comments=comments):
                client = IssueFixtures(comments)
                client.issues[422]["body"] = comment()["body"]
                report = checker.check_issue(422, client)
                self.assertEqual(report["status"], "incomplete")
                self.assertIn("no explicit human comment plan", report["missing_information"][0])
                self.assertEqual(report["fetch_failures"], [])

    def test_explicit_empty_is_valid(self):
        c = comment(body='WORKER: fixture\nPLANNED_FILES: []\nDEPENDS: {"issues": [], "prs": []}')
        report = checker.check_issue(422, IssueFixtures([c]))
        self.assertEqual(report["status"], "no_detected_overlap")
        self.assertEqual(report["plan"]["files"], [])

    def test_latest_creation_wins_unrelated_and_bot_comments_do_not_replace(self):
        latest = comment(20)
        client = IssueFixtures([comment(30, "ordinary progress"), latest,
                                comment(40, kind="Bot"), comment(10, "DEPENDS: invalid")])
        report = checker.check_issue(422, client)
        self.assertEqual(report["status"], "no_detected_overlap")
        self.assertEqual(report["plan_source"]["comment_id"], 20)

    def test_latest_partial_or_invalid_plan_never_falls_back(self):
        original = comment()["body"]
        bodies = ["PLANNED_FILES: []", "DEPENDS: {}", original.replace("WORKER: fixture-worker", "WORKER:"),
                  original.replace('PLANNED_FILES: ["tools/example.py"]', "PLANNED_FILES: none"),
                  original.replace('"prs": []', '"prs": [], "prs": [9]'),
                  original + "\nWORKER: duplicate", original + "\nPLANNED_FILES: []",
                  original + '\nDEPENDS: {"issues": [], "prs": []}',
                  original.replace('["tools/example.py"]', '["tools/example.py", "tools/example.py"]'),
                  original.replace('"prs": []', '"prs": [9, 9]'),
                  original.replace('"issues": []', '"issues": [422]'),
                  original.replace('"tools/example.py"', '"../escape"'),
                  original.replace('"prs": []', '"prs": [true]')]
        for body in bodies:
            with self.subTest(body=body):
                report = checker.check_issue(422, IssueFixtures([comment(), comment(2, body)]))
                self.assertEqual(report["status"], "incomplete")
                self.assertTrue(report["missing_information"])
                self.assertEqual(report["plan_source"]["comment_id"], 2)

    def test_issue_and_comment_fetch_failures_are_separate(self):
        for method in ("issue", "comments"):
            client = IssueFixtures([comment()])
            setattr(client, method, lambda n: (_ for _ in ()).throw(checker.FetchError("fixture unavailable")))
            report = checker.check_issue(422, client)
            self.assertEqual(report["status"], "incomplete")
            self.assertEqual(report["missing_information"], [])
            self.assertEqual(report["fetch_failures"], ["fixture unavailable"])

    def test_incomplete_malformed_or_duplicate_comments_fail_closed(self):
        for values in ([comment(), comment()], [{"id": 1}], [comment(kind="Unknown")], []):
            client = IssueFixtures([comment()])
            client.comment_data = values
            report = checker.check_issue(422, client)
            self.assertEqual(report["status"], "incomplete")
            self.assertTrue(report["fetch_failures"])
        client = IssueFixtures([comment()])
        client.issues[422]["pull_request"] = {}
        self.assertTrue(checker.check_issue(422, client)["fetch_failures"])

    def test_issue_cli_codes_and_argument_exclusion(self):
        for comments, code in (([comment()], 0), ([], 2)):
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                actual = checker.main(["--issue", "422", "--format", "json"], IssueFixtures(comments))
            self.assertEqual(actual, code)
            self.assertEqual(json.loads(output.getvalue())["status"],
                             "no_detected_overlap" if code == 0 else "incomplete")
        client = IssueFixtures([comment()], pulls={7: pull()}, files={7: [{"filename": "tools/example.py"}]})
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(checker.main(["--issue", "422"], client), 1)
        for args in (["--issue", "0"], ["--issue", "-1"], ["--issue", "422", "--plan", "p.json"]):
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
                checker.main(args, IssueFixtures())
            self.assertEqual(error.exception.code, 2)

    def test_comment_endpoint_is_get_only_and_all_pages_are_read(self):
        with patch.object(checker.subprocess, "run") as run:
            run.side_effect = [subprocess.CompletedProcess([], 0, '{"number":422}', ""),
                               subprocess.CompletedProcess([], 0, '[{"id":1}]\n[{"id":2}]', "")]
            client = checker.GitHub("owner/repo")
            self.assertEqual(client.issue(422), {"number": 422})
            self.assertEqual(client.comments(422), [{"id": 1}, {"id": 2}])
            for call in run.call_args_list:
                self.assertEqual(call.args[0][:4], ["gh", "api", "--method", "GET"])
            self.assertEqual(run.call_args_list[1].args[0][-2:],
                             ["repos/owner/repo/issues/422/comments?per_page=100", "--paginate"])


if __name__ == "__main__":
    unittest.main()
