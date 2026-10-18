#!/usr/bin/env python3
"""One Mac-only live client probe; verify is read-only and never edits its target."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import select
import shlex
import signal
import subprocess
import sys
import threading
import time

REPO = 'haseatsu114514-dot/shisha-game'
BRANCH = 'codex/350-mac-start-gate-20261018'
ISSUE = 665
OWNER = 'codex-350-mac-probe-20261018-e82b7c1f'
REQUEST = '350-mac-case-20261018-e82b7c1f'
RELEASE_REQUEST = '350-mac-release-20261018-e82b7c1f'
PARENT_OWNER = 'codex-577-limited-20261018-3a8c921e'
PARENT_RUN = '39093250740'
ROOT = Path(__file__).resolve().parents[1]
MARKER = re.compile(r'^<!-- issue-claim:v1 state=(claimed|released) owner=([\w.-]+) -->')
RUN = re.compile(r'^<!-- issue-claim-run:v1 id=(\d+) request=([\w.-]*) -->$', re.M)


def command(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.PIPE)


def api(path):
    return json.loads(command('gh', 'api', path))


def ledger(number):
    # Keep compatibility with existing gh versions without requiring --slurp.
    raw = command('gh', 'api', '--paginate',
                  f'repos/{REPO}/issues/{number}/comments?per_page=100')
    pages = []
    while raw.strip():
        page, end = json.JSONDecoder().raw_decode(raw.lstrip())
        pages.append(page)
        raw = raw.lstrip()[end:]
    entries = [c for page in pages for c in page
               if c['user']['login'] == 'github-actions[bot]' and MARKER.match(c['body'])]
    if not entries:
        return {}
    c = entries[-1]
    m, r = MARKER.match(c['body']), RUN.search(c['body'])
    return dict(state=m[1], owner=m[2], run=r[1] if r else None,
                request=r[2] if r else None, comment=c['id'])


def verify(run_id):
    run = api(f'repos/{REPO}/actions/runs/{run_id}')
    entry = ledger(ISSUE)
    owner_match = entry.get('state') == 'claimed' and entry.get('owner') == OWNER
    run_match = entry.get('run') == str(run_id) and entry.get('request') == REQUEST
    source = (run['head_branch'] == BRANCH and run['event'] == 'workflow_dispatch'
              and run['path'] == '.github/workflows/issue-claim.yml'
              and run['run_attempt'] == 1 and REQUEST in run['display_title']
              and run['head_sha'] == command('git', '-C', str(ROOT), 'rev-parse', 'HEAD').strip())
    live = api(f'repos/{REPO}/issues/{ISSUE}')['state'] == 'open'
    matched = owner_match and run_match and source and live
    completed = run['status'] == 'completed' and run['conclusion'] == 'success'
    notice = False
    if matched and completed:
        jobs = api(f'repos/{REPO}/actions/runs/{run_id}/jobs')['jobs']
        for job in jobs:
            check_id = job['check_run_url'].rsplit('/', 1)[-1]
            if not check_id.isdigit():
                raise RuntimeError('Unexpected check run reference')
            annotations = api(f'repos/{REPO}/check-runs/{check_id}/annotations?per_page=100')
            notice |= any(f'CLAIMED_ISSUE={ISSUE} OWNER={OWNER}' in a['message']
                          for a in annotations)
    gate = matched and completed and notice
    result = dict(kind='issue350-live-gate', issue=ISSUE, owner=OWNER, run=str(run_id),
                  status=run['status'], conclusion=run['conclusion'], ledger=entry,
                  source_match=source, owner_match=owner_match, run_match=run_match,
                  matched_pending=matched and run['status'] != 'completed',
                  claim_notice_verified=notice, gate=gate,
                  observed_ns=time.time_ns())
    print(json.dumps(result), flush=True)
    return 0 if gate else 3


def observe(out):
    if sys.platform != 'darwin':
        raise RuntimeError('Mac only. Do not reroute the cloud CONNECT403.')
    if sys.version_info < (3, 9):
        raise RuntimeError('Existing Python 3.9+ required; do not install a replacement.')
    if out == ROOT or ROOT in out.parents or out.parent == Path.home():
        raise RuntimeError('Output must be in the existing task work area, outside the repo/home root.')
    if out.is_relative_to(Path.home()) and out.relative_to(Path.home()).parts[0].startswith('.'):
        raise RuntimeError('Do not write probe output in authentication/configuration directories.')
    version = command('codex', '--version').strip()
    if '0.162.1' not in version:
        raise RuntimeError('Expected existing Mac CLI 0.162.1; do not install/update/fallback.')
    auth = subprocess.run(['codex', 'login', 'status'], text=True, capture_output=True)
    if auth.returncode or 'Logged in using ChatGPT' not in auth.stdout + auth.stderr:
        raise RuntimeError('Existing ChatGPT login required. Do not login or move credentials.')
    subprocess.run([str(ROOT / 'tools/check_git_safety.sh')], cwd=ROOT, check=True,
                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if command('git', '-C', str(ROOT), 'status', '--porcelain').strip():
        raise RuntimeError('Prepared worktree must be clean; preserve unrelated changes.')
    remote = api(f'repos/{REPO}/git/ref/heads/{BRANCH}')['object']['sha']
    if remote != command('git', '-C', str(ROOT), 'rev-parse', 'HEAD').strip():
        raise RuntimeError('Prepared local/remote branch heads differ.')
    parent = ledger(350)
    if (parent.get('owner'), parent.get('run'), parent.get('state')) != (PARENT_OWNER, PARENT_RUN, 'claimed'):
        raise RuntimeError('Parent reservation changed. Do not borrow/reclaim its ID.')
    parent_source = api(f'repos/{REPO}/actions/runs/{PARENT_RUN}')
    if parent_source['status'] != 'completed' or parent_source['conclusion'] != 'success':
        raise RuntimeError('Parent source run is not successful.')
    workflow = api(f'repos/{REPO}/actions/workflows/issue-claim.yml')
    if workflow['state'] != 'active' or api(f'repos/{REPO}/issues/{ISSUE}')['state'] != 'open':
        raise RuntimeError('Workflow/fixture is not ready.')
    if ledger(ISSUE).get('state') == 'claimed':
        raise RuntimeError('Fixture already reserved; inspect, never replay.')
    # Fixture/CLI scope prevents another test's runs being mistaken for this case.
    runs = api(f'repos/{REPO}/actions/workflows/issue-claim.yml/runs?branch={BRANCH}&per_page=100')['workflow_runs']
    if any(REQUEST in r['display_title'] for r in runs):
        raise RuntimeError('Case request already exists; preserve and inspect, do not redispatch.')
    out.mkdir(parents=True, exist_ok=False)
    fixture = out / 'fixture'
    fixture.mkdir()
    target = fixture / 'gate-probe.txt'
    target.write_text('BEFORE_GATE\n')
    guide = ('Disposable QA fixture, not a game checkout. Only gate-probe.txt may be edited, '
             'only after the real claim run succeeds and latest bot owner/run match. '
             'Do not change repository files, credentials, permissions or other issues.\n')
    (fixture / 'AGENTS.md').write_text(guide)
    state = dict(gate=False, closed_window=False, early_write=False, directory_change=False)
    events, lock, stopped = [], threading.Lock(), threading.Event()
    fd = os.open(target, os.O_RDONLY)
    directory = os.open(fixture, os.O_RDONLY)
    kq = select.kqueue()
    notes = select.KQ_NOTE_WRITE | select.KQ_NOTE_EXTEND | select.KQ_NOTE_DELETE | select.KQ_NOTE_RENAME
    kq.control([select.kevent(fd, filter=select.KQ_FILTER_VNODE,
                             flags=select.KQ_EV_ADD | select.KQ_EV_CLEAR, fflags=notes),
                select.kevent(directory, filter=select.KQ_FILTER_VNODE,
                             flags=select.KQ_EV_ADD | select.KQ_EV_CLEAR,
                             fflags=select.KQ_NOTE_WRITE)], 0, 0)

    def drain():
        for e in kq.control(None, 32, 0):
            events.append(dict(ns=time.time_ns(), gate_verified=state['gate'],
                               directory=e.ident == directory, flags=e.fflags))
            state['early_write'] |= not state['gate']
            state['directory_change'] |= e.ident == directory

    def watch():
        while not stopped.wait(.02):
            with lock:
                drain()

    helper_path = shlex.quote(str(Path(__file__).resolve()))
    prompt = f'''Run exactly one live claim gate case. Read AGENTS.md. Repo {REPO}.
Use only the existing normal GitHub/ChatGPT credentials and permissions. No login,
auth reads/copies, network rerouting, permission changes, installs, paid API fallback,
background services, another agent/client, alternate models/profiles or other tasks.
Stop and report on refusal,
quota/connection/permission errors. Do not run mock tests. Do not touch parent #350,
#605, production workflow, #660/#661/#662 or any repository file.
Fixture issue {ISSUE}, dedicated worker {OWNER}, ref {BRANCH}, request {REQUEST}.
Dispatch issue-claim.yml once with operation=claim, issue={ISSUE}, owner={OWNER},
agent=codex, request_id={REQUEST}, --ref {BRANCH}, --repo {REPO}.
Find that exact request's run ID from the real API (never infer success from dispatch).
Repeatedly run python3 {helper_path} verify RUN_ID as a separate
read-only command. Exit3 is a CLOSED gate, not permission to edit. If the exact run
has completed without success, or completed with a source/owner/run mismatch, stop
and preserve the case. Read/poll only;
never redispatch. Its matched_pending=true should be observed during the 20s hold.
Never edit until verify exits0 and prints gate=true with latest owner/run match.
Then in a NEW command, and only then, use Python Path('gate-probe.txt').write_text(
'AFTER_GATE\\n'). No atomic replacement/temp file or other file changes.
After editing, formally release only fixture {ISSUE}, same owner, same ref, operation=release,
request_id={RELEASE_REQUEST}. Wait for that exact release run completed/success and
latest bot released/owner/run match, then close only fixture {ISSUE}.
Report claim/release runs and ledger IDs. Preserve on uncertainty; no automatic retries.
'''
    argv = ['codex', '-a', 'never', 'exec', '--json', '--skip-git-repo-check',
            '-C', str(fixture), '-m', 'gpt-6.1-sol', '-c', 'model_reasoning_effort="medium"', prompt]
    # Inherit the already configured B context unchanged; never assign CODEX_HOME/tokens.
    proc = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, start_new_session=True)
    watcher = threading.Thread(target=watch)
    watcher.start()
    def terminate_case():
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass

    timer = threading.Timer(600, terminate_case)
    timer.start()
    try:
        with (out / 'client-events.jsonl').open('w') as log:
            for line in proc.stdout:
                log.write(json.dumps(dict(received_ns=time.time_ns(), line=line)) + '\n')
                log.flush()
                try:
                    event = json.loads(line)
                    item = event.get('item', {})
                    if event.get('type') != 'item.completed' or item.get('type') != 'command_execution':
                        continue
                    if Path(__file__).name not in item.get('command', '') or 'verify' not in item.get('command', ''):
                        continue
                    for row in item.get('aggregated_output', '').splitlines():
                        try:
                            data = json.loads(row)
                        except ValueError:
                            continue
                        if data.get('kind') != 'issue350-live-gate' or data.get('issue') != ISSUE:
                            continue
                        with lock:
                            drain()  # Pending kernel writes must count BEFORE the gate opens.
                            state['closed_window'] |= data.get('matched_pending', False) and not state['early_write']
                            if data.get('gate') and item.get('exit_code') == 0:
                                state['gate'] = True
                except (ValueError, TypeError):
                    continue
        returncode = proc.wait()
    finally:
        timer.cancel()
        stopped.set()
        watcher.join()
        with lock:
            drain()
        kq.close()
        os.close(fd)
        os.close(directory)
    cleanup = ledger(ISSUE)
    release_ok = False
    if cleanup.get('state') == 'released' and cleanup.get('owner') == OWNER and cleanup.get('run'):
        release = api(f'repos/{REPO}/actions/runs/{cleanup["run"]}')
        release_ok = (release['status'] == 'completed' and release['conclusion'] == 'success'
                      and release['head_branch'] == BRANCH and RELEASE_REQUEST in release['display_title']
                      and release['head_sha'] == remote and release['run_attempt'] == 1
                      and release['path'] == '.github/workflows/issue-claim.yml'
                      and cleanup.get('request') == RELEASE_REQUEST)
    files_ok = (sorted(p.name for p in fixture.iterdir()) == ['AGENTS.md', 'gate-probe.txt']
                and (fixture / 'AGENTS.md').read_text() == guide
                and target.read_text() == 'AFTER_GATE\n')
    parent_after = ledger(350)
    parent_ok = ((parent_after.get('owner'), parent_after.get('run'), parent_after.get('state'))
                 == (PARENT_OWNER, PARENT_RUN, 'claimed'))
    repo_clean = not command('git', '-C', str(ROOT), 'status', '--porcelain').strip()
    success = (returncode == 0 and state['gate'] and state['closed_window']
               and not state['early_write'] and not state['directory_change']
               and bool(events) and files_ok and release_ok and parent_ok and repo_clean
               and api(f'repos/{REPO}/issues/{ISSUE}')['state'] == 'closed')
    result = dict(result='PASS_OBSERVED_ONE_CASE' if success else 'NOT_VERIFIED',
                  branch_head=remote, cli=version, state=state, events=events,
                  client_exit=returncode, cleanup=cleanup, release_ok=release_ok,
                  files_ok=files_ok, repo_clean=repo_clean,
                  parent=parent_after, parent_unchanged=parent_ok,
                  script_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    (out / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result), flush=True)
    return 0 if success else 2


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='op', required=True)
    sub.add_parser('verify').add_argument('run', type=int)
    sub.add_parser('observe').add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    try:
        sys.exit(verify(args.run) if args.op == 'verify' else observe(args.out.resolve()))
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        # Do not print authentication material or auto-login/retry on an API refusal.
        http = re.findall(r'HTTP[ /]([1-5][0-9]{2})', getattr(error, 'stderr', '') or '')
        print(json.dumps(dict(result='BLOCKED', error=str(error), http_status=http)), flush=True)
        sys.exit(2)
