#!/usr/bin/env python3
"""Synthetic fixtures only: python3 -B -m unittest discover -s tools -p test_agent_quota_guard.py -v"""
import ast
import contextlib
import datetime as dt
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("agent_quota_guard.py")
NOW = dt.datetime(2030, 1, 1, tzinfo=dt.timezone.utc)
USAGE_VARS = ("SHISHA_CODEX_USAGE_JSON", "SHISHA_CLAUDE_USAGE_JSON")
MISSING = object()


class FrozenDateTime(dt.datetime):
    @classmethod
    def now(cls, tz=None):
        return NOW.astimezone(tz)


class QuotaGuardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        spec = importlib.util.spec_from_file_location("quota_guard_fixture", SCRIPT)
        self.guard = importlib.util.module_from_spec(spec)
        # Override only Path.home(), never the real HOME or account files.
        with patch.object(Path, "home", return_value=self.home):
            spec.loader.exec_module(self.guard)
        self.state = self.guard.STATE
        clean_env = {k: v for k, v in os.environ.items() if k not in USAGE_VARS}
        self.env_patch = patch.dict(os.environ, clean_env, clear=True)
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)

    def write(self, path, data):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data), encoding="utf-8")

    def describe(self, fixture, provider="codex"):
        self.write(self.state, {provider: fixture})
        output = io.StringIO()
        with patch.object(self.guard.dt, "datetime", FrozenDateTime), contextlib.redirect_stdout(output):
            status = self.guard.describe(provider)
        return status, output.getvalue()

    def assert_status(self, fixture, expected, provider="codex", stale=False):
        status, output = self.describe(fixture, provider)
        self.assertEqual(status, expected)
        self.assertIn(f"{provider}: {expected};", output)
        self.assertEqual("observation missing or older" in output, stale)
        actions = {
            "normal": None,
            "wrap_up": "ACTION: Avoid large new tasks.",
            "handoff": "ACTION: Stop new work.",
            "unknown": "ACTION: Quota unknown; checkpoint after each task.",
        }
        if actions[expected]:
            self.assertIn(actions[expected], output)
        else:
            self.assertNotIn("ACTION:", output)

    def cli(self, *args):
        # Execute the actual __main__ entry point in a fresh process with a
        # temporary Path.home() and cleared quota export variables.
        bootstrap = """
import pathlib, runpy, sys
from unittest.mock import patch
fixture_home = pathlib.Path(sys.argv[1])
sys.argv = sys.argv[2:]
with patch.object(pathlib.Path, 'home', return_value=fixture_home):
    runpy.run_path(sys.argv[0], run_name='__main__')
"""
        return subprocess.run(
            [sys.executable, "-B", "-c", bootstrap, str(self.home), str(SCRIPT), *args],
            capture_output=True, text=True, timeout=10,
        )

    def test_source_parses(self):
        ast.parse(SCRIPT.read_text(encoding="utf-8"), filename=str(SCRIPT))

    def test_remaining_thresholds_and_lowest_known_value(self):
        for provider in self.guard.PROVIDERS:
            for five, weekly, expected in (
                (100, 100, "normal"), (20.01, 90, "normal"),
                (20, 90, "wrap_up"), (10.01, 90, "wrap_up"),
                (10, 90, "handoff"), (0, 100, "handoff"),
                (90, 10, "handoff"), (90, 20, "wrap_up"),
                (MISSING, 30, "normal"), (15, MISSING, "wrap_up"),
                (MISSING, MISSING, "unknown"),
            ):
                with self.subTest(provider=provider, five=five, weekly=weekly):
                    fixture = {"updated_at": NOW.isoformat()}
                    if five is not MISSING:
                        fixture["five_hour_remaining"] = five
                    if weekly is not MISSING:
                        fixture["weekly_remaining"] = weekly
                    self.assert_status(fixture, expected, provider)

    def test_freshness_boundaries(self):
        for age, expected in (
            (0, "handoff"), (899.999, "handoff"), (900, "unknown"),
            (901, "unknown"), (-60, "handoff"), (-60.001, "unknown"),
        ):
            with self.subTest(age=age):
                stamp = (NOW - dt.timedelta(seconds=age)).isoformat()
                self.assert_status({"updated_at": stamp, "five_hour_remaining": 5},
                                   expected, stale=expected == "unknown")
        for stamp in ("2030-01-01T00:00:00Z", "2030-01-01T09:00:00+09:00"):
            with self.subTest(stamp=stamp):
                self.assert_status({"updated_at": stamp, "weekly_remaining": 30}, "normal")

    def test_missing_and_invalid_timestamps(self):
        for stamp in (MISSING, None, "", "not-a-date", "2030-02-30T00:00:00Z",
                      "2030-01-01T00:00:00", 123, 1.5, True, [], {}):
            with self.subTest(stamp=stamp):
                fixture = {"five_hour_remaining": 5}
                if stamp is not MISSING:
                    fixture["updated_at"] = stamp
                self.assert_status(fixture, "unknown", stale=True)

    def test_invalid_percentages_are_ignored(self):
        for value in (None, True, False, "5", "", [], {}, -1, 101,
                      float("nan"), float("inf"), -float("inf")):
            for key, other in (("five_hour_remaining", "weekly_remaining"),
                               ("weekly_remaining", "five_hour_remaining")):
                with self.subTest(value=value, key=key):
                    fixture = {"updated_at": NOW.isoformat(), key: value}
                    self.assert_status(fixture, "unknown")
                    fixture[other] = 30
                    self.assert_status(fixture, "normal")

    def test_missing_and_malformed_state(self):
        self.assertEqual(self.guard.load(), {})
        for raw in ("{", "null", "[]", '"text"'):
            with self.subTest(raw=raw):
                self.state.parent.mkdir(parents=True, exist_ok=True)
                self.state.write_text(raw, encoding="utf-8")
                self.assertEqual(self.guard.load(), {})
        for fixture in ({}, None, [], "text", 1):
            with self.subTest(fixture=fixture):
                self.assert_status(fixture, "unknown", stale=True)

    def test_export_precedence_and_fallback(self):
        local = {"updated_at": NOW.isoformat(), "weekly_remaining": 30}
        export = {"updated_at": NOW.isoformat(), "five_hour_remaining": 10}
        for provider, variable in zip(self.guard.PROVIDERS, USAGE_VARS):
            with self.subTest(provider=provider):
                self.write(self.state, {provider: local})
                path = self.home / "export.json"
                with patch.dict(os.environ, {variable: str(path)}):
                    self.write(path, export)
                    self.assertEqual(self.guard.snapshot(provider), export)
                    # An object is authoritative even if stale or incomplete.
                    self.write(path, {})
                    self.assertEqual(self.guard.snapshot(provider), {})
                    for raw in ("{", "null", "[]", '"text"'):
                        path.write_text(raw, encoding="utf-8")
                        self.assertEqual(self.guard.snapshot(provider), local)
                    path.unlink()
                    self.assertEqual(self.guard.snapshot(provider), local)

    def test_cli_help_and_missing_check(self):
        result = self.cli("--help")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("{check,set}", result.stdout)
        for args in (("check",), ("check", "all"), ("check", "codex"), ("check", "claude")):
            with self.subTest(args=args):
                result = self.cli(*args)
                self.assertEqual(result.returncode, 0, result.stderr)
                providers = self.guard.PROVIDERS if len(args) == 1 or args[1] == "all" else args[1:]
                for provider in self.guard.PROVIDERS:
                    self.assertEqual(f"{provider}: unknown;" in result.stdout, provider in providers)
        self.assertFalse(self.state.exists())

    def test_cli_set_roundtrip_and_permissions(self):
        for provider in self.guard.PROVIDERS:
            with self.subTest(provider=provider):
                result = self.cli("set", provider, "--five-hour", "18", "--weekly", "70",
                                  "--resets-at", "2030-01-02 02:00 JST")
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(f"{provider}: wrap_up;", result.stdout)
                data = json.loads(self.state.read_text(encoding="utf-8"))
                self.assertEqual(data[provider]["five_hour_remaining"], 18)
                self.assertEqual(data[provider]["weekly_remaining"], 70)
                self.assertEqual(data[provider]["resets_at"], "2030-01-02 02:00 JST")
                self.assertIsNotNone(dt.datetime.fromisoformat(data[provider]["updated_at"]).tzinfo)
                self.assertEqual(self.state.stat().st_mode & 0o777, 0o600)
                result = self.cli("check", provider)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(f"{provider}: wrap_up;", result.stdout)
                result = self.cli("set", provider, "--five-hour", "5")
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(f"{provider}: handoff;", result.stdout)
                self.assertEqual(json.loads(self.state.read_text())[provider]["weekly_remaining"], 70)
        self.assertEqual(set(json.loads(self.state.read_text())), set(self.guard.PROVIDERS))

    def test_cli_rejects_bad_numbers_without_writes(self):
        for option in ("--five-hour", "--weekly"):
            for value in ("-1", "101", "nan", "inf", "-inf", "not-a-number"):
                with self.subTest(option=option, value=value):
                    result = self.cli("set", "codex", f"{option}={value}")
                    self.assertEqual(result.returncode, 2, result.stderr)
                    self.assertFalse(self.state.exists())
        result = self.cli("set", "codex")
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn("Supply --five-hour or --weekly", result.stderr)
        self.assertFalse(self.state.exists())


if __name__ == "__main__":
    unittest.main()
