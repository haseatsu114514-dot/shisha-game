#!/usr/bin/env python3
"""Local simulations only: no Codex, gh, dispatch or authentication calls."""
import base64
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shlex
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('gate', Path(__file__).with_name('issue350_mac_gate.py'))
g = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = g
spec.loader.exec_module(g)
HEAD = 'a' * 40
NONCE = 'b' * 32
BLOB = '# pinned test source\n'
DIGEST = hashlib.sha256(BLOB.encode()).hexdigest()
POLICY = 'local policy fixture\n'
POLICY_HASH = hashlib.sha256(POLICY.encode()).hexdigest()


class FakeAPI:
    def __init__(self, final=None):
        self.calls = []
        self.issues = 0
        self.final = final
        self.entry = dict(user=dict(login='github-actions[bot]'), id=42,
                          body=f'<!-- issue-claim:v1 state=claimed owner={g.OWNER} -->\n'
                          f'<!-- issue-claim-run:v1 id=123 request={g.REQUEST} -->')
        self.run = dict(head_branch=g.BRANCH, event='workflow_dispatch',
                        path='.github/workflows/issue-claim.yml', run_attempt=1,
                        display_title=g.REQUEST, head_sha=HEAD, status='completed', conclusion='success')

    def __call__(self, path):
        self.calls.append(path)
        if '/comments?' in path:
            return [copy.deepcopy(self.entry)]
        if path.endswith('/issues/665'):
            self.issues += 1
            return copy.deepcopy(self.final if self.issues > 1 and self.final is not None
                                 else dict(state='open', labels=[]))
        if path.endswith('/actions/runs/123'):
            return copy.deepcopy(self.run)
        if path.endswith('/jobs'):
            return dict(jobs=[dict(check_run_url='https://api.github.com/repos/x/check-runs/44')])
        if '/annotations?' in path:
            return [dict(message=f'CLAIMED_ISSUE=665 OWNER={g.OWNER}')]
        if path.endswith('/git/ref/heads/main'):
            return dict(object=dict(sha='c' * 40))
        if '/contents/.github/workflows/issue-claim.yml?' in path:
            return dict(content=base64.b64encode(('          script: |\n' + POLICY).encode()).decode())
        raise AssertionError(path)


class GateTests(unittest.TestCase):
    def snapshot(self, api):
        with patch.object(g, 'JS_SHA256', POLICY_HASH):
            return g.snapshot(123, HEAD, NONCE, read=api, source_hash=DIGEST)

    def test_valid_gate_final_read_is_issue(self):
        api = FakeAPI()
        self.assertTrue(self.snapshot(api)['gate'])
        self.assertTrue(api.calls[-1].endswith('/issues/665'))
        self.assertEqual(api.issues, 2)

    def test_blocked_during_wait_refuses_with_zero_edits(self):
        for labels in (['blocked'], ['status:blocked'], [dict(name='blocked')],
                       [dict(name='status:blocked')], [None]):
            with self.subTest(labels=labels), tempfile.TemporaryDirectory() as tmp:
                target = Path(tmp) / 'gate-probe.txt'
                target.write_text('BEFORE_GATE\n')
                result = self.snapshot(FakeAPI(dict(state='open', labels=labels)))
                if result['gate']:
                    target.write_text('AFTER_GATE\n')
                self.assertFalse(result['gate'])
                self.assertEqual(target.read_text(), 'BEFORE_GATE\n')

    def test_closed_or_pr_or_bad_labels_rejected(self):
        for issue in (dict(state='closed', labels=[]), dict(state='open', labels=[], pull_request={'url': 'x'}),
                      dict(state='open'), dict(state='open', labels='blocked')):
            with self.subTest(issue=issue):
                self.assertFalse(self.snapshot(FakeAPI(issue))['gate'])

    def test_changed_policy_refuses(self):
        with patch.object(g, 'JS_SHA256', '0' * 64):
            with self.assertRaises(g.UnknownResult):
                g.snapshot(123, HEAD, NONCE, read=FakeAPI(), source_hash=DIGEST)

    def test_pending_failure_wrong_source_refused(self):
        for field, value in (('status', 'in_progress'), ('conclusion', 'failure'),
                             ('head_sha', 'd' * 40), ('run_attempt', 2), ('head_branch', 'main')):
            with self.subTest(field=field):
                api = FakeAPI()
                api.run[field] = value
                self.assertFalse(self.snapshot(api)['gate'])

    def test_wrong_owner_run_request_or_changed_ledger(self):
        for old, new in ((g.OWNER, 'other'), ('id=123', 'id=124'), (g.REQUEST, 'other')):
            api = FakeAPI()
            api.entry['body'] = api.entry['body'].replace(old, new)
            self.assertFalse(self.snapshot(api)['gate'])
        api = FakeAPI()
        def changed(path):
            if '/comments?' in path and any('/contents/' in c for c in api.calls):
                api.entry['id'] = 43
            return api(path)
        self.assertFalse(self.snapshot(changed)['gate'])

    def authority(self, change=None, source=None):
        calls = []
        def runner(argv, **kwargs):
            calls.append((argv, kwargs))
            value = dict(kind='issue350-live-gate', issue=g.ISSUE, owner=g.OWNER, request=g.REQUEST,
                         run='123', expected_head=HEAD, source_sha256=DIGEST, nonce=argv[-1],
                         status='completed', conclusion='success', gate=True, issue_allowed=True,
                         source_match=True, owner_match=True, run_match=True, claim_notice_verified=True)
            if change:
                change(value)
            return g.OwnedResult(argv, json.dumps(value), '', 0)
        a = g.VerifierAuthority(HEAD, 123, NONCE, runner=runner,
                                source=source or (lambda head: (BLOB, DIGEST)))
        return a, calls

    def event(self, a, typ, command=None, ident='cmd1', output='{"gate":true}'):
        return a.event(dict(type=typ, item=dict(id=ident, type='command_execution',
                       command=command or shlex.join(a.expected), exit_code=0, aggregated_output=output)))

    def test_private_pinned_execution_one_use_receipt(self):
        a, calls = self.authority()
        self.event(a, 'item.started')
        receipt = self.event(a, 'item.completed', output='FORGED FAIL/irrelevant')
        self.assertIsInstance(receipt, g.GateReceipt)
        self.assertEqual(calls[0][1]['input_text'], BLOB)
        self.assertEqual(calls[0][0][1:3], ('-I', '-c'))
        self.assertNotEqual(calls[0][0][-1], NONCE)
        self.assertTrue(a.consume(receipt))
        self.assertFalse(a.consume(receipt))
        self.assertFalse(a.consume(g.GateReceipt('123', HEAD, object())))
        self.assertIsNone(self.event(a, 'item.completed'))
        self.assertEqual(len(calls), 1)

    def test_forged_stdout_never_opens_gate(self):
        a, calls = self.authority(lambda v: v.update(gate=False))
        self.event(a, 'item.started')
        self.assertIsNone(self.event(a, 'item.completed'))
        self.assertEqual(len(calls), 1)

    def test_substrings_extra_shell_commands_or_missing_start_rejected(self):
        a, calls = self.authority()
        self.assertIsNone(self.event(a, 'item.completed'))
        for command in ('echo issue350_mac_gate.py verify', shlex.join(a.expected) + '; echo PASS',
                        'echo ' + shlex.quote(shlex.join(a.expected))):
            self.event(a, 'item.started', command)
            self.assertIsNone(self.event(a, 'item.completed', command))
        self.assertEqual(calls, [])

    def test_wrong_fixed_fields_refused(self):
        for key, value in (('expected_head', 'e' * 40), ('owner', 'other'), ('run', '124'),
                           ('nonce', NONCE), ('source_sha256', 'f' * 64), ('gate', 1),
                           ('issue_allowed', False), ('claim_notice_verified', False)):
            with self.subTest(key=key):
                a, _ = self.authority(lambda v: v.update({key: value}))
                self.event(a, 'item.started')
                self.assertIsNone(self.event(a, 'item.completed'))

    def test_source_change_and_private_timeout_refuse(self):
        sources = iter(((BLOB, DIGEST), ('changed', 'x')))
        a, _ = self.authority(source=lambda head: next(sources))
        self.event(a, 'item.started')
        with self.assertRaises(g.UnknownResult):
            self.event(a, 'item.completed')
        a, _ = self.authority()
        def timeout(*args, **kwargs):
            raise g.UnknownResult('UNKNOWN NO RETRY')
        a.runner = timeout
        self.event(a, 'item.started')
        with self.assertRaises(g.UnknownResult):
            self.event(a, 'item.completed')

    def test_b_wrong_environment_stops_before_cli(self):
        for inherited in ('', '/not/b'):
            with patch.object(g.sys, 'platform', 'darwin'), patch.dict(os.environ, CODEX_HOME=inherited):
                with patch.object(g, 'run_owned') as runner:
                    with self.assertRaises(g.UnknownResult):
                        g.b_preflight('/never/codex', HEAD, runner=runner)
                    runner.assert_not_called()

    def test_b_official_metadata_still_cannot_enable_inference(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            (home / '.codex-plus-b').mkdir()
            executable = home / 'codex'
            executable.write_text('not executed')
            executable.chmod(0o700)
            calls = []
            def runner(argv, **kwargs):
                calls.append(argv)
                self.assertEqual(kwargs['timeout'], g.COMMAND_SECONDS)
                if argv[1:] == ('--version',):
                    out = 'codex-cli 0.162.1'
                elif argv[1:] == ('login', 'status'):
                    out = 'Logged in using ChatGPT'
                else:
                    out = json.dumps(dict(checks={'config.load': dict(details={
                        'CODEX_HOME': str(home / '.codex-plus-b'), 'model provider': 'openai', 'mcp servers': '0'}),
                        'auth.credentials': dict(details={'stored auth mode': 'chatgpt', 'stored API key': 'false'})}))
                return g.OwnedResult(argv, out, '', 0)
            with patch.object(g.sys, 'platform', 'darwin'), patch.object(g.pwd, 'getpwuid') as user, \
                    patch.dict(os.environ, CODEX_HOME=str(home / '.codex-plus-b')), \
                    patch.object(g, 'pinned_source', return_value=(BLOB, DIGEST)):
                user.return_value.pw_dir = str(home)
                with self.assertRaisesRegex(g.UnknownResult, 'LIVE EXEC DISABLED'):
                    g.b_preflight(str(executable), HEAD, runner=runner)
            self.assertEqual([c[1:] for c in calls], [('--version',), ('login', 'status'), ('doctor', '--json')])

    def test_pinned_source_rejects_dirty_or_changed_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / g.SCRIPT).parent.mkdir()
            (root / g.SCRIPT).write_text(BLOB)
            with patch.object(g, 'ROOT', root), patch.object(g, 'command', side_effect=[HEAD, BLOB, ' M file']):
                with self.assertRaisesRegex(g.UnknownResult, 'clean'):
                    g.pinned_source(HEAD)
            (root / g.SCRIPT).write_text('changed')
            with patch.object(g, 'ROOT', root), patch.object(g, 'command', side_effect=[HEAD, BLOB]):
                with self.assertRaisesRegex(g.UnknownResult, 'differs'):
                    g.pinned_source(HEAD)

    def test_owned_normal_completion(self):
        r = g.run_owned((sys.executable, '-c', 'print("ok")'), timeout=2)
        self.assertEqual(r.stdout, 'ok\n')
        self.assertEqual(r.returncode, 0)

    def test_owned_timeout_kills_only_own_process(self):
        unrelated = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(10)'])
        try:
            with tempfile.TemporaryDirectory() as tmp:
                pidfile = Path(tmp) / 'pid'
                code = ('import os,signal,time; from pathlib import Path; '
                        'signal.signal(signal.SIGTERM,signal.SIG_IGN); '
                        f'Path({str(pidfile)!r}).write_text(str(os.getpid())); time.sleep(10)')
                start = time.monotonic()
                with self.assertRaisesRegex(g.UnknownResult, 'NO RETRY'):
                    g.run_owned((sys.executable, '-c', code), timeout=.3, term_seconds=.1, kill_seconds=.3)
                self.assertLess(time.monotonic() - start, 2)
                with self.assertRaises(ProcessLookupError):
                    os.kill(int(pidfile.read_text()), 0)
                self.assertIsNone(unrelated.poll())
        finally:
            unrelated.terminate()
            unrelated.wait(timeout=2)

    def test_timeout_term_exit_zero_still_unknown(self):
        code = 'import signal,time,sys; signal.signal(signal.SIGTERM,lambda *a: sys.exit(0)); time.sleep(10)'
        with self.assertRaisesRegex(g.UnknownResult, 'NO RETRY'):
            g.run_owned((sys.executable, '-c', code), timeout=.2, term_seconds=.2, kill_seconds=.2)

    def test_descendant_pipe_holder_is_bounded(self):
        code = ('import subprocess,sys; subprocess.Popen([sys.executable,"-c",'
                '"import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(5)"])')
        start = time.monotonic()
        with self.assertRaisesRegex(g.UnknownResult, 'NO RETRY'):
            g.run_owned((sys.executable, '-c', code), timeout=.2, term_seconds=.1, kill_seconds=.2)
        self.assertLess(time.monotonic() - start, 2)

    def test_gh_is_readonly_and_bounded(self):
        with patch.object(g, 'run_owned', return_value=g.OwnedResult(('gh',), '{}', '', 0)) as runner:
            self.assertEqual(g.api('repos/example/issues/1'), {})
            self.assertEqual(runner.call_args.args[0], ('gh', 'api', 'repos/example/issues/1'))
            self.assertEqual(runner.call_args.kwargs['timeout'], g.COMMAND_SECONDS)


if __name__ == '__main__':
    unittest.main()
