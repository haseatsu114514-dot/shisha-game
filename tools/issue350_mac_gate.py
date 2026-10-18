#!/usr/bin/env python3
"""Fail-closed, non-inference preflight and pinned read-only gate verification."""
import argparse
import base64
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import secrets
import shlex
import signal
import subprocess
import sys
import time

REPO = 'haseatsu114514-dot/shisha-game'
BRANCH = 'codex/350-mac-start-gate-20261018'
ISSUE = 665
OWNER = 'codex-350-mac-probe-20261018-e82b7c1f'
REQUEST = '350-mac-case-20261018-e82b7c1f'
PARENT_OWNER = 'codex-577-limited-20261018-3a8c921e'
PARENT_RUN = '39093250740'
ROOT = Path(__file__).resolve().parents[1]
SCRIPT = 'tools/issue350_mac_gate.py'
JS_SHA256 = '06496d91752d3b4aade8a349d36a301172443fd107ae9de7ec82ce669720679c'
BLOCKED_LABELS = frozenset(('blocked', 'status:blocked'))
MARKER = re.compile(r'^<!-- issue-claim:v1 state=(claimed|released) owner=([\w.-]+) -->')
RUN = re.compile(r'^<!-- issue-claim-run:v1 id=(\d+) request=([\w.-]*) -->$', re.M)
COMMAND_SECONDS = 20
TERM_SECONDS = 1
KILL_SECONDS = 1


class UnknownResult(RuntimeError):
    """No automatic retry/dispatch/release is allowed after an unknown result."""


@dataclass(frozen=True)
class OwnedResult:
    argv: tuple
    stdout: str
    stderr: str
    returncode: int


def run_owned(argv, *, timeout=COMMAND_SECONDS, input_text=None, cwd=None,
              term_seconds=TERM_SECONDS, kill_seconds=KILL_SECONDS):
    """Own a fresh process group; bound TERM, KILL, reap and pipe completion.

    Even a TERM handler that exits0 after a timeout is UNKNOWN, never success.
    A timed-out group is not a license to retry the operation.
    """
    argv = tuple(str(a) for a in argv)
    p = subprocess.Popen(argv, stdin=subprocess.PIPE if input_text is not None else subprocess.DEVNULL,
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                         cwd=cwd, start_new_session=True)
    group = p.pid  # Never use a name-based kill or the caller's process group.

    def send(sig):
        try:
            os.killpg(group, sig)
        except ProcessLookupError:
            pass

    expired = False
    try:
        out, err = p.communicate(input_text, timeout=timeout)
    except subprocess.TimeoutExpired:
        expired = True
        send(signal.SIGTERM)
        try:
            out, err = p.communicate(timeout=term_seconds)
        except subprocess.TimeoutExpired:
            send(signal.SIGKILL)
            try:
                out, err = p.communicate(timeout=kill_seconds)
            except subprocess.TimeoutExpired as exc:
                # No unbounded wait, even for an uninterruptible OS process/pipe.
                send(signal.SIGKILL)
                raise UnknownResult(f'UNKNOWN: owned pid/pgid {group} termination unconfirmed; NO RETRY') from exc
    except BaseException as exc:
        send(signal.SIGTERM)
        try:
            p.communicate(timeout=term_seconds)
        except subprocess.TimeoutExpired:
            pass
        # Kill the owned group even if its leader exited during the TERM wait.
        send(signal.SIGKILL)
        try:
            p.communicate(timeout=kill_seconds)
        except subprocess.TimeoutExpired:
            raise UnknownResult(f'UNKNOWN: interrupted owned pid/pgid {group} reap unconfirmed; NO RETRY') from exc
        until = time.monotonic() + kill_seconds
        while time.monotonic() < until:
            try:
                os.killpg(group, 0)
            except ProcessLookupError:
                break
            time.sleep(min(.02, max(0, until - time.monotonic())))
        raise UnknownResult(f'UNKNOWN: interrupted owned pid/pgid {group}; NO RETRY') from exc
    # A descendant can outlive an exited leader. Clean only our fresh group.
    try:
        os.killpg(group, 0)
        remaining = True
    except ProcessLookupError:
        remaining = False
    if remaining:
        send(signal.SIGTERM)
        until = time.monotonic() + term_seconds
        while time.monotonic() < until:
            try:
                os.killpg(group, 0)
            except ProcessLookupError:
                break
            time.sleep(min(.02, max(0, until - time.monotonic())))
        send(signal.SIGKILL)
        until = time.monotonic() + kill_seconds
        while time.monotonic() < until:
            try:
                os.killpg(group, 0)
            except ProcessLookupError:
                break
            time.sleep(min(.02, max(0, until - time.monotonic())))
        else:
            raise UnknownResult(f'UNKNOWN: owned pid/pgid {group} cleanup unconfirmed; NO RETRY')
        expired = True  # Unexpected surviving children invalidate the result.
    if expired:
        raise UnknownResult(f'UNKNOWN: owned pid/pgid {group} timed out/required cleanup; NO RETRY')
    return OwnedResult(argv, out, err, p.returncode)


def command(*argv, timeout=COMMAND_SECONDS):
    result = run_owned(argv, timeout=timeout)
    if result.returncode:
        # Do not echo raw diagnostics that could contain credential/debug material.
        statuses = re.findall(r'HTTP[ /]([1-5][0-9]{2})', result.stderr)
        raise UnknownResult(f'command refused: exit={result.returncode}, HTTP={statuses}; NO RETRY')
    return result.stdout


def api(path):
    return json.loads(command('gh', 'api', path))  # GET only: no dispatch/write.


def ledger(number, read=api):
    entries, page = [], 1
    while True:
        rows = read(f'repos/{REPO}/issues/{number}/comments?per_page=100&page={page}')
        entries.extend(c for c in rows if c['user']['login'] == 'github-actions[bot]'
                       and MARKER.match(c['body']))
        if len(rows) < 100:
            break
        page += 1
        if page > 100:
            raise UnknownResult('ledger pagination bound exceeded; NO RETRY')
    if not entries:
        return {}
    c = entries[-1]
    m, r = MARKER.match(c['body']), RUN.search(c['body'])
    return dict(state=m[1], owner=m[2], run=r[1] if r else None,
                request=r[2] if r else None, comment=c['id'])


def allowed_issue(issue):
    labels = issue.get('labels')
    if not isinstance(labels, list):
        return False
    names = []
    for label in labels:
        name = label if isinstance(label, str) else label.get('name') if isinstance(label, dict) else None
        if not isinstance(name, str):
            return False
        names.append(name)
    return (issue.get('state') == 'open' and not issue.get('pull_request')
            and not BLOCKED_LABELS.intersection(names))


def current_policy(read=api):
    sha = read(f'repos/{REPO}/git/ref/heads/main')['object']['sha']
    info = read(f'repos/{REPO}/contents/.github/workflows/issue-claim.yml?ref={sha}')
    source = base64.b64decode(info['content'], validate=False).decode()
    body = source.split('          script: |\n', 1)[1]
    if hashlib.sha256(body.encode()).hexdigest() != JS_SHA256:
        raise UnknownResult('latest coordinator policy changed; re-review before any edit')
    return sha


def pinned_source(head):
    if not re.fullmatch(r'[0-9a-f]{40}', head):
        raise UnknownResult('full fixed SHA required')
    if command('git', '-C', str(ROOT), 'rev-parse', 'HEAD').strip() != head:
        raise UnknownResult('local HEAD differs from fixed SHA')
    blob = command('git', '-C', str(ROOT), 'show', f'{head}:{SCRIPT}')
    if (ROOT / SCRIPT).read_bytes() != blob.encode():
        raise UnknownResult('working verifier differs from pinned Git blob')
    if command('git', '-C', str(ROOT), 'status', '--porcelain', '--untracked-files=normal').strip():
        raise UnknownResult('clean isolated worktree required')
    return blob, hashlib.sha256(blob.encode()).hexdigest()


def snapshot(run_id, head, nonce, *, read=api, source_hash=None):
    if not re.fullmatch(r'[0-9a-f]{32}', nonce):
        raise UnknownResult('fresh case/verifier nonce required')
    if source_hash is None:
        _, source_hash = pinned_source(head)
    run = read(f'repos/{REPO}/actions/runs/{run_id}')
    first = read(f'repos/{REPO}/issues/{ISSUE}')
    entry = ledger(ISSUE, read)
    source = (run['head_branch'] == BRANCH and run['event'] == 'workflow_dispatch'
              and run['path'] == '.github/workflows/issue-claim.yml'
              and run['run_attempt'] == 1 and REQUEST in run['display_title']
              and run['head_sha'] == head)
    completed = run['status'] == 'completed' and run['conclusion'] == 'success'
    notice = False
    if source and completed and allowed_issue(first):
        jobs = read(f'repos/{REPO}/actions/runs/{run_id}/jobs')['jobs']
        for job in jobs:
            check_id = job['check_run_url'].rsplit('/', 1)[-1]
            if not check_id.isdigit():
                raise UnknownResult('unexpected check run reference')
            rows = read(f'repos/{REPO}/check-runs/{check_id}/annotations?per_page=100')
            notice |= any(f'CLAIMED_ISSUE={ISSUE} OWNER={OWNER}' in a['message'] for a in rows)
    # Re-read the current policy and latest ledger/Issue at the final edit gate.
    policy_sha = current_policy(read)
    final_entry = ledger(ISSUE, read)
    last = read(f'repos/{REPO}/issues/{ISSUE}')
    owner_match = final_entry.get('state') == 'claimed' and final_entry.get('owner') == OWNER
    run_match = final_entry.get('run') == str(run_id) and final_entry.get('request') == REQUEST
    eligible = allowed_issue(first) and allowed_issue(last)
    matched = source and eligible and owner_match and run_match and entry == final_entry
    return dict(kind='issue350-live-gate', issue=ISSUE, owner=OWNER, request=REQUEST,
                run=str(run_id), expected_head=head, source_sha256=source_hash, nonce=nonce,
                status=run['status'], conclusion=run['conclusion'], policy_sha=policy_sha,
                issue_allowed=eligible, ledger=final_entry, source_match=source,
                owner_match=owner_match, run_match=run_match,
                matched_pending=matched and run['status'] != 'completed',
                claim_notice_verified=notice, gate=bool(matched and completed and notice))


def exact_argv(text):
    """Accept an argv, or a single standard shell wrapper; no operators/suffixes."""
    try:
        args = shlex.split(text)
        if len(args) == 3 and args[0] in ('/bin/zsh', '/bin/bash') and args[1] in ('-c', '-lc'):
            args = shlex.split(args[2])
        return tuple(args)
    except (ValueError, TypeError):
        return ()


@dataclass(frozen=True)
class GateReceipt:
    run: str
    head: str
    token: object


class VerifierAuthority:
    """Client stdout is never authoritative. Issue only one-use private receipts.

    No live observer is enabled in this version (runtime safety is unproven).
    This core is regression tested for the future reviewed observer integration.
    """
    def __init__(self, head, run_id, case_nonce, *, runner=run_owned, source=pinned_source):
        self.head, self.run_id, self.case_nonce = head, str(run_id), case_nonce
        self.runner, self.source = runner, source
        self.started, self.finished, self.receipts = {}, set(), {}
        self.expected = (sys.executable, str(ROOT / SCRIPT), 'verify', self.run_id,
                         '--expected-head', head, '--nonce', case_nonce)

    def event(self, event):
        item = event.get('item', {})
        ident = item.get('id')
        if item.get('type') != 'command_execution' or not isinstance(ident, str):
            return None
        args = exact_argv(item.get('command', ''))
        if event.get('type') == 'item.started':
            if ident not in self.started and ident not in self.finished and args == self.expected:
                self.started[ident] = args
            return None
        if (event.get('type') != 'item.completed' or ident not in self.started
                or ident in self.finished):
            return None
        self.finished.add(ident)
        if args != self.started.pop(ident) or args != self.expected or item.get('exit_code') != 0:
            return None
        # Do NOT inspect aggregated_output. Run the pinned Git blob ourselves.
        blob, digest = self.source(self.head)
        challenge = secrets.token_hex(16)
        bootstrap = ("import sys; p=sys.argv.pop(1); s=sys.stdin.read(); "
                     "exec(compile(s,p,'exec'),{'__name__':'__main__','__file__':p})")
        argv = (sys.executable, '-I', '-c', bootstrap, str(ROOT / SCRIPT), 'verify', self.run_id,
                '--expected-head', self.head, '--nonce', challenge)
        result = self.runner(argv, timeout=COMMAND_SECONDS, input_text=blob, cwd=ROOT)
        if result.argv != argv or result.returncode != 0:
            return None
        try:
            value = json.loads(result.stdout)  # Exactly one object from our private pipe.
        except (ValueError, TypeError):
            return None
        expected = dict(kind='issue350-live-gate', issue=ISSUE, owner=OWNER, request=REQUEST,
                        run=self.run_id, expected_head=self.head, source_sha256=digest, nonce=challenge,
                        status='completed', conclusion='success', gate=True, issue_allowed=True,
                        source_match=True, owner_match=True, run_match=True, claim_notice_verified=True)
        if not isinstance(value, dict) or any(type(value.get(k)) is not type(v) or value.get(k) != v
                                             for k, v in expected.items()):
            return None
        # Recheck after the private execution; edited disk files are never executed.
        if self.source(self.head) != (blob, digest):
            raise UnknownResult('pinned verifier source changed')
        receipt = GateReceipt(self.run_id, self.head, object())
        self.receipts[id(receipt)] = receipt
        return receipt

    def consume(self, receipt):
        if not isinstance(receipt, GateReceipt) or self.receipts.get(id(receipt)) is not receipt:
            return False
        del self.receipts[id(receipt)]
        return True


def b_preflight(codex_bin, head, *, runner=run_owned):
    """No shell alias/function, no env assignment, no auth/config file reads."""
    if sys.platform != 'darwin':
        raise UnknownResult('Mac only; cloud CONNECT403 is not rerouted')
    home = Path(pwd.getpwuid(os.getuid()).pw_dir).resolve()
    expected = home / '.codex-plus-b'
    inherited = os.environ.get('CODEX_HOME')
    if (not inherited or expected.is_symlink() or not expected.is_dir()
            or Path(inherited).resolve() != expected):
        raise UnknownResult('existing B environment is not inherited; STOP before any Codex invocation')
    executable = Path(codex_bin)
    if not executable.is_absolute() or not executable.is_file() or not os.access(executable, os.X_OK):
        raise UnknownResult('absolute existing official executable required; aliases/functions are not supported')
    pinned_source(head)

    def metadata(*args):
        r = runner((str(executable), *args), timeout=COMMAND_SECONDS, cwd=ROOT)
        if r.returncode:
            raise UnknownResult('official non-inference metadata unavailable; no exec/fallback')
        return r.stdout + ('\n' + r.stderr if args == ('login', 'status') else '')

    version = metadata('--version').strip()
    if len(version.split()) < 2 or version.split()[1] != '0.162.1':
        raise UnknownResult('existing CLI 0.162.1 required; do not update/change launcher')
    if 'Logged in using ChatGPT' not in metadata('login', 'status'):
        raise UnknownResult('official ChatGPT login status not verified; no login/fallback')
    report = json.loads(metadata('doctor', '--json'))
    checks = report.get('checks', {})
    config = checks.get('config.load', {}).get('details', {})
    auth = checks.get('auth.credentials', {}).get('details', {})
    actual = config.get('CODEX_HOME')
    if not isinstance(actual, str) or Path(actual).resolve() != expected:
        raise UnknownResult('official diagnostic did not identify B; A/default execution forbidden')
    if auth.get('stored auth mode') != 'chatgpt' or auth.get('stored API key') != 'false':
        raise UnknownResult('official auth/billing route not proven; no credential inspection')
    if config.get('model provider') != 'openai' or config.get('mcp servers') != '0':
        raise UnknownResult('provider/MCP safety unknown or nonempty; do not change settings')
    # 0.162.1 has no validated attestation path in this packet for effective hooks,
    # project/global startup integrations, provider side effects and subscription-only
    # billing. Do not invent JSON fields, trust an operator yes/no flag or infer safety
    # from login/zero MCP. No exec code path exists until that contract is reviewed.
    raise UnknownResult('B metadata matched, but effective hooks/MCP/provider side effects and '
                        'no additional billing lack validated official non-secret proof; '
                        'LIVE EXEC DISABLED, NO RETRY/dispatch/config changes')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='op', required=True)
    v = sub.add_parser('verify')
    v.add_argument('run', type=int)
    v.add_argument('--expected-head', required=True)
    v.add_argument('--nonce', required=True)
    for name in ('preflight', 'observe'):
        q = sub.add_parser(name, help='non-inference preflight only; live execution remains disabled')
        q.add_argument('--codex-bin', required=True)
        q.add_argument('--expected-head', required=True)
    a = p.parse_args()
    try:
        if a.op == 'verify':
            value = snapshot(a.run, a.expected_head, a.nonce)
            print(json.dumps(value), flush=True)
            return 0 if value['gate'] else 3
        b_preflight(a.codex_bin, a.expected_head)
        raise UnknownResult('live runtime policy not established')
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError) as e:
        print(json.dumps(dict(result='BLOCKED_UNKNOWN_NO_RETRY', error=str(e))), flush=True)
        return 2


if __name__ == '__main__':
    sys.exit(main())
