import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createRequire} from 'node:module';

// Execute the same coordinator module as every production event entrypoint.
const require = createRequire(import.meta.url);
const {coordinate: execute, runEvent, maintain, policyBody} = require('./issue_claim_coordinator.cjs');
const bot = 'github-actions[bot]';
const fixture = (number, extra = {}) => ({number, state: 'open', title: `[P1] Task ${number}`, labels: [], url: `https://api.github.com/repos/example.dot/game/issues/${number}`, ...extra});
const entry = (state, owner, extra = {}) => ({id: 1, user: {login: bot},
  body: `<!-- issue-claim:v1 state=${state} owner=${owner} -->`, ...extra});

function setup({issues = [fixture(1), fixture(2)], prs = [], comments = {}, runs = {}, approvals = {}, permissions = {admin: 'admin'}, hook} = {}) {
  let id = 100;
  const notices = [], writes = [], calls = [];
  const method = (name, fn) => async args => {
    calls.push({name, args});
    await hook?.(name, args, {issues, prs, comments});
    return {data: structuredClone(await fn(args))};
  };
  const github = {rest: {
    issues: {
      get: method('get', a => {
        const issue = issues.find(i => i.number === a.issue_number);
        if (!issue) throw Error('Not found');
        return issue;
      }),
      getComment: method('getComment', a => {
        if (!approvals[a.comment_id]) throw Error('Approval not found');
        return approvals[a.comment_id];
      }),
      listForRepo: method('listForRepo', a => issues.filter(i => a.state === 'all' || i.state === a.state)),
      listComments: method('listComments', a => comments[a.issue_number] || []),
      listCommentsForRepo: method('repoComments', () => Object.values(approvals)),
      update: method('update', a => {
        const issue = issues.find(i => i.number === a.issue_number);
        if (!issue) throw Error('Not found');
        issue.body = a.body;
        return issue;
      }),
      createComment: method('createComment', a => {
        const c = {id: ++id, user: {login: bot}, body: a.body};
        (comments[a.issue_number] ||= []).push(c);
        writes.push(a); return c;
      }),
    },
    repos: {getCollaboratorPermissionLevel: method('permission', a => ({permission: permissions[a.username] || 'read'})),
      get: method('repo', () => ({default_branch:'main'}))},
    pulls: {list: method('pulls', a => prs.filter(pr => a.state === 'all' || (pr.state || 'open') === a.state))},
    actions: {getWorkflowRun: method('run', a => runs[a.run_id] || {status: 'completed', conclusion: 'success'})},
  }, paginate: async (fn, args) => (await fn(args)).data};
  const context = {repo: {owner: 'example.dot', repo: 'game'}, runId: 901, actor: 'admin', serverUrl: 'https://github.com', payload: {repository: {default_branch: 'main'}}};
  const core = {info() {}, notice: text => notices.push(text),
    summary: {addRaw() { return this; }, async write() {}}};
  async function run(op, number = 1, owner = 'worker-A', input = {}) {
    const values = {OPERATION: op, ISSUE: String(number), OWNER: owner, AGENT: 'codex', REQUEST_ID: '', CLAIM_RUN: '', HANDOFF_COMMENT: '', SUMMARY: '', ...input};
    const original = Object.fromEntries(Object.keys(values).map(k => [k, process.env[k]]));
    Object.assign(process.env, values);
    try { return await execute(github, context, core); }
    finally { for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    } }
  }
  return {run, writes, notices, calls, issues, comments, context, approvals, prs, runs, github, core};
}

test('claim records its exact run/request and rejects both duplicate owners', async () => {
  const s = setup();
  await s.run('claim', 1, 'worker-A', {REQUEST_ID: 'request-001'});
  assert.match(s.writes[0].body, /id=901 request=request-001/);
  await assert.rejects(s.run('claim', 1, 'worker-B'), /Already claimed/);
  await assert.rejects(s.run('claim', 1, 'worker-A'), /Already claimed/);
  await assert.rejects(s.run('claim', 2, 'worker-A'), /Worker already owns #1/);
  assert.equal(s.writes.length, 1);
});

test('closed issue reservation blocks multiple claims but remains releasable', async () => {
  const s = setup({issues: [fixture(1, {state: 'closed'}), fixture(2)], comments: {1: [entry('claimed', 'worker-A')]}});
  await assert.rejects(s.run('claim', 2), /Worker already owns #1/);
  await assert.rejects(s.run('release', 1, 'worker-B'), /Only the current owner/);
  await s.run('release', 1);
  await s.run('claim', 2);
  assert.equal(s.writes.length, 2);
});

test('release then another worker claim preserves the last bot ledger', async () => {
  const s = setup({comments: {1: [entry('claimed', 'worker-A')]}});
  await s.run('release');
  await s.run('claim', 1, 'worker-B');
  await assert.rejects(s.run('release', 1, 'worker-A'), /Only the current owner/);
  assert.match(s.writes.at(-1).body, /state=claimed owner=worker-B/);
});

test('ignores forged human markers and uses the last bot record across >100 comments', async () => {
  const history = [entry('claimed', 'worker-B'), ...Array.from({length: 105}, (_, id) => ({id: id + 2, user: {login: 'human'}, body: 'discussion'})), entry('released', 'worker-B'), entry('claimed', 'worker-C', {user: {login: 'human'}})];
  const s = setup({comments: {1: history}});
  await s.run('claim');
  assert.equal(s.writes.length, 1);
});

for (const body of ['Refs #1', 'Fixes example.dot/game#1', 'https://github.com/example.dot/game/issues/1', '[task](https://github.com/example.dot/game/issues/1#issuecomment-2)']) {
  test(`rejects referencing open PR: ${body}`, async () => {
    const s = setup({prs: [{body, title: 'Draft work'}]});
    await assert.rejects(s.run('claim'), /Open PR/);
    assert.equal(s.writes.length, 0);
  });
}

test('does not confuse issue 1 with 10 or a URL for a different repository', async () => {
  const s = setup({prs: [{body: '#10 https://github.com/other/game/issues/1 https://github.com/exampleXdot/game/issues/1', title: ''}]});
  await s.run('claim');
  assert.equal(s.writes.length, 1);
});

for (const labels of [['blocked'], [{name: 'status:blocked'}]]) {
  test(`manual claim rejects blocked issue ${JSON.stringify(labels)}`, async () => {
    const s = setup({issues: [fixture(1, {labels})]});
    await assert.rejects(s.run('claim'), /Blocked/);
    assert.equal(s.writes.length, 0);
  });
}

test('claim rejects a PR or a closed issue', async () => {
  for (const extra of [{pull_request: {}}, {state: 'closed'}]) {
    const s = setup({issues: [fixture(1, extra)]});
    await assert.rejects(s.run('claim'), /Not an open issue/);
    assert.equal(s.writes.length, 0);
  }
});

test('rechecks closure and a newly opened PR immediately before writing', async () => {
  for (const mutation of ['close', 'pr']) {
    const s = setup({hook(name, args, data) {
      if (name === 'listForRepo' && args.state === 'all') {
        if (mutation === 'close') data.issues[0].state = 'closed';
        else data.prs.push({body: '#1', title: 'new work'});
      }
    }});
    await assert.rejects(s.run('claim'), /Not an open issue|Open PR/);
    assert.equal(s.writes.length, 0);
  }
});

test('next skips unavailable candidates and keeps difficulty/priority order', async () => {
  const s = setup({issues: [fixture(1, {labels: ['difficulty:S']}), fixture(2, {labels: ['difficulty:A'], title: '[P0] work'}), fixture(3, {labels: ['difficulty:A'], title: '[P2] work'}), fixture(4)], comments: {1: [entry('claimed', 'worker-B')]}});
  await s.run('next', '');
  assert.equal(s.writes[0].issue_number, 2);
});

test('status without an expected run is read-only, including legacy reservations', async () => {
  const s = setup({comments: {1: [entry('claimed', 'worker-A')]}});
  await s.run('status');
  assert.match(s.notices[0], /"run_id":null/);
  assert.equal(s.writes.length, 0);
  await assert.rejects(s.run('status', 1, 'worker-A', {CLAIM_RUN: '901'}), /no longer matches/);
});

test('status validates current owner, source run and open issue before start/resume', async () => {
  const s = setup();
  await s.run('claim');
  await s.run('status', 1, 'worker-A', {CLAIM_RUN: '901'});
  assert.ok(s.notices.some(n => n.startsWith('CLAIM_VALIDATED_ISSUE=1')));
  await assert.rejects(s.run('status', 1, 'worker-B', {CLAIM_RUN: '901'}), /no longer matches/);
  await assert.rejects(s.run('status', 1, 'worker-A', {CLAIM_RUN: '900'}), /no longer matches/);
  await s.run('release');
  await assert.rejects(s.run('status', 1, 'worker-A', {CLAIM_RUN: '901'}), /no longer matches/);
  assert.equal(s.writes.length, 2);
});

for (const conclusion of ['cancelled', 'failure', null]) {
  test(`reservation written by ${conclusion} run cannot authorize work but can be released`, async () => {
    const s = setup({runs: {901: {status: conclusion ? 'completed' : 'in_progress', conclusion}}});
    await s.run('claim');
    await assert.rejects(s.run('status', 1, 'worker-A', {CLAIM_RUN: '901'}), /did not succeed/);
    await s.run('release');
    assert.equal(s.writes.length, 2);
  });
}

test('API errors never authorize work or write a reservation', async () => {
  const s = setup({hook(name) { if (name === 'pulls') throw Error('403 denied'); }});
  await assert.rejects(s.run('claim'), /403 denied/);
  assert.equal(s.writes.length, 0);
});

test('unknown operations and malformed inputs fail before any API call', async () => {
  for (const [op, input] of [['typo', {}], ['claim', {AGENT: 'unknown'}], ['claim', {ISSUE: '1;evil'}], ['claim', {OWNER: 'xx'}], ['claim', {REQUEST_ID: 'bad id'}], ['claim', {CLAIM_RUN: '901'}]]) {
    const s = setup();
    await assert.rejects(s.run(op, 1, 'worker-A', input));
    assert.equal(s.calls.length, 0);
  }
});


const savedHead = 'a'.repeat(40);
const approvedHandoff = () => ({issue: 1, from: 'worker-A', to: 'worker-B', claim_run: '800',
  stopped: true, pushed: true, prs: [{number: 11, head: savedHead}]});
function transferSetup(options = {}) {
  const approval = {id: 50, user: {login: 'admin'}, issue_url: fixture(1).url,
    html_url: 'https://github.com/example.dot/game/issues/1#issuecomment-50',
    body: `<!-- issue-handoff:v1 ${JSON.stringify(approvedHandoff())} -->`};
  return setup({comments: {1: [entry('claimed', 'worker-A', {
    body: '<!-- issue-claim:v1 state=claimed owner=worker-A -->\n<!-- issue-claim-run:v1 id=800 request=original -->'})]},
    prs: [{number: 11, body: 'Refs #1', title: 'Saved work', head: {sha: savedHead, repo: {full_name: 'example.dot/game'}}}],
    approvals: {50: approval}, ...options});
}
const transfer = s => s.run('transfer', 1, 'worker-B', {CLAIM_RUN: '800', HANDOFF_COMMENT: '50'});

test('admin transfer preserves PRs and atomically replaces ownership with a new successful run', async () => {
  const s = transferSetup();
  await assert.rejects(s.run('claim', 1, 'worker-B'), /Already claimed/);
  await transfer(s);
  assert.equal(s.writes.length, 1);
  assert.match(s.writes[0].body, /state=claimed owner=worker-B/);
  assert.match(s.writes[0].body, /id=901/);
  assert.match(s.writes[0].body, /Transferred from worker-A/);
  assert.ok(s.notices.includes('CLAIMED_ISSUE=1 OWNER=worker-B'));
  await s.run('status', 1, 'worker-B', {CLAIM_RUN: '901'});
  await assert.rejects(s.run('status', 1, 'worker-A', {CLAIM_RUN: '800'}), /no longer matches/);
  await assert.rejects(transfer(s), /original owner/);
  assert.equal(s.prs[0].head.sha, savedHead);
  assert.equal(s.writes.length, 1);
});

for (const permission of ['write', 'maintain']) {
  test(`${permission} users can transfer saved work using the original actor's handoff without admin approval`, async () => {
    const s = transferSetup({permissions: {oldUser: permission, newUser: permission},
      runs: {800: {status: 'completed', conclusion: 'success', actor: {login: 'oldUser'}}}});
    s.context.actor = 'newUser';
    s.approvals[50].user.login = 'oldUser';
    await transfer(s);
    assert.equal(s.writes.length, 1);
    assert.match(s.writes[0].body, /state=claimed owner=worker-B/);
    assert.equal(s.prs[0].head.sha, savedHead);
    await assert.rejects(s.run('claim', 1, 'worker-C'), /Already claimed/);
  });
}

for (const change of ['actor-read', 'author-read', 'wrong-original-actor', 'unknown-original-actor', 'permission-error']) {
  test(`ordinary handoff refuses unverifiable ownership or permissions: ${change}`, async () => {
    const permissions = {oldUser: 'write', newUser: 'write'};
    if (change === 'actor-read') permissions.newUser = 'read';
    if (change === 'author-read') permissions.oldUser = 'read';
    const s = transferSetup({permissions,
      runs: {800: {status: 'completed', conclusion: 'success',
        actor: change === 'unknown-original-actor' ? undefined : {login: change === 'wrong-original-actor' ? 'someoneElse' : 'oldUser'}}},
      hook(name) { if (change === 'permission-error' && name === 'permission') throw Error('Permission unavailable'); }});
    s.context.actor = 'newUser';
    s.approvals[50].user.login = 'oldUser';
    await assert.rejects(transfer(s));
    assert.equal(s.writes.length, 0);
  });
}

test('ordinary handoff rechecks the original actor before replacing the ledger', async () => {
  const source = {status: 'completed', conclusion: 'success', actor: {login: 'oldUser'}};
  const s = transferSetup({permissions: {oldUser: 'write', newUser: 'write'}, runs: {800: source},
    hook(name) { if (name === 'listForRepo') source.actor.login = 'someoneElse'; }});
  s.context.actor = 'newUser';
  s.approvals[50].user.login = 'oldUser';
  await assert.rejects(transfer(s), /original claim actor/);
  assert.equal(s.writes.length, 0);
});

for (const change of ['actor', 'author', 'wrong-issue-url', 'missing-record', 'issue', 'from', 'to', 'claim_run', 'stopped', 'pushed', 'empty-prs', 'duplicate-pr', 'wrong-head', 'fork']) {
  test(`transfer rejects invalid approval: ${change}`, async () => {
    const s = transferSetup(), h = approvedHandoff(), a = s.approvals[50];
    if (change === 'actor') s.context.actor = 'non-admin';
    else if (change === 'author') a.user.login = 'non-admin';
    else if (change === 'wrong-issue-url') a.issue_url = fixture(2).url;
    else if (change === 'missing-record') a.body = 'unstructured confirmation';
    else if (change === 'empty-prs') h.prs = [];
    else if (change === 'duplicate-pr') h.prs.push({...h.prs[0]});
    else if (change === 'wrong-head') h.prs[0].head = 'b'.repeat(40);
    else if (change === 'fork') s.prs[0].head.repo.full_name = 'other/game';
    else if (['stopped', 'pushed'].includes(change)) h[change] = false;
    else h[change] = change === 'issue' ? 2 : 'wrong-value';
    if (change !== 'missing-record') a.body = `<!-- issue-handoff:v1 ${JSON.stringify(h)} -->`;
    await assert.rejects(transfer(s));
    assert.equal(s.writes.length, 0);
  });
}

for (const conclusion of ['cancelled', 'failure', null]) {
  test(`transfer refuses original claim from ${conclusion} run`, async () => {
    const s = transferSetup({runs: {800: {status: conclusion ? 'completed' : 'in_progress', conclusion}}});
    await assert.rejects(transfer(s), /Original claim run did not succeed/);
    assert.equal(s.writes.length, 0);
  });
}

test('transfer respects blocked/closed Issue, released ledger and new owner other reservations', async () => {
  for (const type of ['blocked', 'closed', 'released', 'other-claim']) {
    const s = transferSetup();
    if (type === 'blocked') s.issues[0].labels = ['blocked'];
    if (type === 'closed') s.issues[0].state = 'closed';
    if (type === 'released') s.comments[1].push(entry('released', 'worker-A'));
    if (type === 'other-claim') s.comments[2] = [entry('claimed', 'worker-B')];
    await assert.rejects(transfer(s));
    assert.equal(s.writes.length, 0);
  }
});

for (const mutation of ['head', 'pr-added', 'pr-closed', 'claim', 'issue', 'approval']) {
  test(`transfer rechecks changing state before ledger write: ${mutation}`, async () => {
    const s = transferSetup({hook(name, args, data) {
      if (name !== 'listForRepo') return;
      if (mutation === 'head') data.prs[0].head.sha = 'b'.repeat(40);
      if (mutation === 'pr-added') data.prs.push({number: 12, body: '#1', head: {sha: savedHead}});
      if (mutation === 'pr-closed') data.prs.length = 0;
      if (mutation === 'claim') data.comments[1].push(entry('released', 'worker-A'));
      if (mutation === 'issue') data.issues[0].state = 'closed';
      if (mutation === 'approval') s.approvals[50] = {...s.approvals[50], body: 'revoked'};
    }});
    await assert.rejects(transfer(s));
    assert.equal(s.writes.length, 0);
  });
}

test('transfer run cancellation after write retains reservation but cannot authorize editing', async () => {
  const s = transferSetup({runs: {901: {status: 'completed', conclusion: 'cancelled'}}});
  await transfer(s);
  await assert.rejects(s.run('status', 1, 'worker-B', {CLAIM_RUN: '901'}), /did not succeed/);
  await assert.rejects(s.run('claim', 1, 'worker-C'), /Already claimed/);
  assert.equal(s.writes.length, 1);
});

test('transfer rejects malformed or irrelevant handoff inputs before API access', async () => {
  for (const [op, input] of [['transfer', {}], ['transfer', {CLAIM_RUN: '800', HANDOFF_COMMENT: 'bad'}],
    ['claim', {HANDOFF_COMMENT: '50'}]]) {
    const s = transferSetup();
    await assert.rejects(s.run(op, 1, 'worker-B', input));
    assert.equal(s.calls.length, 0);
  }
});

function legacyTransferSetup(options = {}) {
  const sourceRun = {id: 800, path: '.github/workflows/issue-claim.yml', event: 'workflow_dispatch',
    head_branch: 'main', run_attempt: 1, status: 'completed', conclusion: 'success',
    run_started_at: '2026-10-12T03:58:51Z', updated_at: '2026-10-12T03:59:11Z'};
  const s = transferSetup({...options, comments: {1: [
    entry('claimed', 'worker-A', {id: 10, created_at: '2026-10-12T03:59:09Z'}),
    entry('released', 'worker-A', {id: 20, created_at: '2026-10-12T04:30:54Z'}),
  ]}, runs: {800: sourceRun, ...options.runs}});
  const handoff = {...approvedHandoff(), recovery: {claim_comment: 10, released_comment: 20}};
  s.approvals[50].body = `<!-- issue-handoff:v1 ${JSON.stringify(handoff)} -->`;
  return {...s, sourceRun, handoff};
}

test('explicit admin recovery binds a released legacy pair to its successful run and preserves the PR', async () => {
  const s = legacyTransferSetup();
  await assert.rejects(s.run('claim', 1, 'worker-B'), /Open PR/);
  await transfer(s);
  assert.equal(s.writes.length, 1);
  assert.match(s.writes[0].body, /Recovered legacy claim\/release comments 10\/20/);
  assert.match(s.writes[0].body, /state=claimed owner=worker-B/);
  assert.equal(s.prs[0].head.sha, savedHead);
  await s.run('status', 1, 'worker-B', {CLAIM_RUN: '901'});
  await assert.rejects(transfer(s), /last bot claim\/release pair/);
});

test('write permission does not authorize legacy recovery even with an original-actor record', async () => {
  const s = legacyTransferSetup({permissions: {oldUser: 'write', newUser: 'write'}});
  s.context.actor = 'newUser';
  s.approvals[50].user.login = 'oldUser';
  s.sourceRun.actor = {login: 'oldUser'};
  await assert.rejects(transfer(s), /Legacy recovery requires repository admin/);
  assert.equal(s.writes.length, 0);
});

for (const recovery of [null, {}, {claim_comment: '10', released_comment: 20},
  {claim_comment: 10, released_comment: 10}, {claim_comment: 0, released_comment: 20}]) {
  test(`legacy recovery refuses malformed comment IDs: ${JSON.stringify(recovery)}`, async () => {
    const s = legacyTransferSetup();
    s.handoff.recovery = recovery;
    s.approvals[50].body = `<!-- issue-handoff:v1 ${JSON.stringify(s.handoff)} -->`;
    await assert.rejects(transfer(s), /Legacy recovery requires/);
    assert.equal(s.writes.length, 0);
  });
}

for (const change of ['missing-claim', 'claim-id', 'release-id', 'owner', 'human-claim', 'human-release',
  'claim-run-metadata', 'release-run-metadata', 'malformed-release-metadata', 'intervening-bot', 'active-claim']) {
  test(`legacy recovery refuses a different reservation history: ${change}`, async () => {
    const s = legacyTransferSetup(), history = s.comments[1];
    if (change === 'missing-claim') history.shift();
    if (change === 'claim-id') history[0].id = 11;
    if (change === 'release-id') history[1].id = 21;
    if (change === 'owner') history[0].body = entry('claimed', 'worker-C').body;
    if (change === 'human-claim') history[0].user.login = 'admin';
    if (change === 'human-release') history[1].user.login = 'admin';
    if (change === 'claim-run-metadata') history[0].body += '\n<!-- issue-claim-run:v1 id=800 request=old -->';
    if (change === 'release-run-metadata') history[1].body += '\n<!-- issue-claim-run:v1 id=801 request=old -->';
    if (change === 'malformed-release-metadata') history[1].body += '\n<!-- issue-claim-run:v1 id=unknown -->';
    if (change === 'intervening-bot') history.splice(1, 0, entry('claimed', 'worker-C', {id: 12}));
    if (change === 'active-claim') history.push(entry('claimed', 'worker-A', {id: 21}));
    await assert.rejects(transfer(s), /last bot claim\/release pair/);
    assert.equal(s.writes.length, 0);
  });
}

for (const change of ['run-id', 'workflow', 'event', 'attempt', 'branch', 'before-run', 'after-run',
  'missing-time', 'invalid-time', 'unknown-default-branch']) {
  test(`legacy recovery refuses an unbound source run: ${change}`, async () => {
    const s = legacyTransferSetup(), run = s.sourceRun;
    if (change === 'run-id') run.id = 801;
    if (change === 'workflow') run.path = '.github/workflows/other.yml';
    if (change === 'event') run.event = 'pull_request';
    if (change === 'attempt') run.run_attempt = 2;
    if (change === 'branch') run.head_branch = 'feature';
    if (change === 'before-run') s.comments[1][0].created_at = '2026-10-12T03:58:50Z';
    if (change === 'after-run') s.comments[1][0].created_at = '2026-10-12T03:59:12Z';
    if (change === 'missing-time') delete s.comments[1][0].created_at;
    if (change === 'invalid-time') run.updated_at = 'not a timestamp';
    if (change === 'unknown-default-branch') delete s.context.payload.repository.default_branch;
    await assert.rejects(transfer(s), /not bound to the approved coordinator run/);
    assert.equal(s.writes.length, 0);
  });
}

for (const conclusion of ['cancelled', 'failure', null]) {
  test(`legacy recovery refuses a ${conclusion} source run`, async () => {
    const s = legacyTransferSetup();
    Object.assign(s.sourceRun, {status: conclusion ? 'completed' : 'in_progress', conclusion});
    await assert.rejects(transfer(s), /Original claim run did not succeed/);
    assert.equal(s.writes.length, 0);
  });
}

for (const change of ['actor', 'author', 'head', 'other-claim', 'blocked', 'closed']) {
  test(`legacy recovery keeps existing admin, PR and worker guards: ${change}`, async () => {
    const s = legacyTransferSetup();
    if (change === 'actor') s.context.actor = 'non-admin';
    if (change === 'author') s.approvals[50].user.login = 'non-admin';
    if (change === 'head') s.prs[0].head.sha = 'b'.repeat(40);
    if (change === 'other-claim') s.comments[2] = [entry('claimed', 'worker-B')];
    if (change === 'blocked') s.issues[0].labels = ['blocked'];
    if (change === 'closed') s.issues[0].state = 'closed';
    await assert.rejects(transfer(s));
    assert.equal(s.writes.length, 0);
  });
}

test('legacy recovery rechecks the released pair immediately before writing', async () => {
  const s = legacyTransferSetup({hook(name, args, data) {
    if (name === 'listForRepo') data.comments[1].push(entry('claimed', 'worker-C', {id: 21}));
  }});
  await assert.rejects(transfer(s), /last bot claim\/release pair/);
  assert.equal(s.writes.length, 0);
});

test('canceled recovery after a write retains the reservation without authorizing editing', async () => {
  const s = legacyTransferSetup({runs: {901: {status: 'completed', conclusion: 'cancelled'}}});
  await transfer(s);
  await assert.rejects(s.run('status', 1, 'worker-B', {CLAIM_RUN: '901'}), /did not succeed/);
  await assert.rejects(s.run('claim', 1, 'worker-C'), /Already claimed/);
  assert.equal(s.writes.length, 1);
});

const savedPR = (number = 11, issue = 1, extra = {}) => ({number, state:'open', body:`Refs #${issue}`,
  head:{sha:savedHead, repo:{full_name:'example.dot/game'}}, base:{ref:'main'}, ...extra});
const modernEntry = (owner = 'worker-A', run = 800) => entry('claimed', owner,
  {body:`<!-- issue-claim:v1 state=claimed owner=${owner} -->\n<!-- issue-claim-run:v1 id=${run} request=original -->`});
const parkingSetup = options => setup({prs:[savedPR()], comments:{1:[modernEntry()]}, ...options});
const park = s => s.run('park', 1, 'worker-A', {CLAIM_RUN:'800'});

const handoffSummary = 'DONE: pushed the draft\nTODO: finish the remaining scene\nTEST: focused regression passed\nNEXT: continue on the saved branch';
const handoffEntry = () => {
  const c = modernEntry();c.body += '\n<!-- issue-claim-actor:v1 login=admin -->';return c;
};
const handoffSetup = options => setup({prs:[savedPR()], comments:{1:[handoffEntry()]},
  permissions:{admin:'write',successor:'write'},...options});
const handoff = (s, summary=handoffSummary) => s.run('handoff',1,'worker-A',{CLAIM_RUN:'800',SUMMARY:summary});
const pickup = (s,input={}) => {
  s.context.actor='successor';s.context.runId=902;
  return s.run('pickup',1,'worker-B',input);
};

test('handoff saves one exclusive checkpoint and a future unknown worker picks it up without release', async () => {
  const s=handoffSetup();await handoff(s);
  assert.equal(s.writes.length,1);
  assert.match(s.writes[0].body,/state=claimed owner=worker-A/);
  assert.match(s.writes[0].body,/issue-claim-wait:v1/);
  assert.match(s.writes[0].body,/"stopped":true,"pushed":true/);
  assert.match(s.writes[0].body,/> NEXT: continue on the saved branch/);
  await assert.rejects(s.run('claim',1,'worker-B'),/Already claimed/);
  await assert.rejects(s.run('status',1,'worker-A',{CLAIM_RUN:'901'}),/handed off/);
  s.context.runId=903;await s.run('claim',2);
  await pickup(s);
  assert.match(s.writes.at(-1).body,/state=claimed owner=worker-B/);
  assert.match(s.writes.at(-1).body,/login=successor/);
  assert.match(s.writes.at(-1).body,/checkpoint comment 101, run 901/);
  assert.doesNotMatch(s.writes.at(-1).body,/issue-claim-wait/);
  assert(!s.writes.some(w=>w.body.startsWith('<!-- issue-claim:v1 state=released')));
  await s.run('status',1,'worker-B',{CLAIM_RUN:'902'});
  await assert.rejects(s.run('resume',1,'worker-A',{CLAIM_RUN:'901'}),/no longer matches/);
  await assert.rejects(pickup(s),/No handoff-ready/);
});

test('the original worker can cancel its handoff with resume before another worker consumes it', async () => {
  const s=handoffSetup();await handoff(s);
  await assert.rejects(s.run('pickup',1,'worker-A'),/must use resume/);
  s.context.runId=903;await s.run('resume',1,'worker-A',{CLAIM_RUN:'901'});
  assert.doesNotMatch(s.writes.at(-1).body,/issue-claim-wait/);
  await assert.rejects(pickup(s),/No handoff-ready/);
});

for(const change of ['missing-summary','long-summary','ledger-in-summary','no-pr','fork','bad-head','unknown-actor','wrong-actor','read-only','failed-source']) {
  test(`handoff refuses an unverified or incomplete checkpoint: ${change}`,async()=>{
    const s=handoffSetup();let summary=handoffSummary;
    if(change==='missing-summary')summary=' ';
    if(change==='long-summary')summary='x'.repeat(1201);
    if(change==='ledger-in-summary')summary='TODO\n<!-- issue-claim-wait:v1 {} -->';
    if(change==='no-pr')s.prs.length=0;
    if(change==='fork')s.prs[0].head.repo.full_name='other/game';
    if(change==='bad-head')s.prs[0].head.sha='short';
    if(change==='unknown-actor')s.comments[1]=[modernEntry()];
    if(change==='wrong-actor')s.context.actor='successor';
    if(change==='read-only')s.context.actor='reader';
    if(change==='failed-source')s.runs[800]={status:'completed',conclusion:'failure'};
    await assert.rejects(handoff(s,summary));assert.equal(s.writes.length,0);
  });
}

test('handoff validates the original requester permission for both dispatch and comment entrypoints', async()=>{
  const s=handoffSetup({permissions:{admin:'read'}});
  await assert.rejects(handoff(s),/write permission/);assert.equal(s.writes.length,0);
});

test('a parked PR may be explicitly offered for handoff, but a changed parked head must resume first', async()=>{
  const s=handoffSetup();await park(s);s.context.runId=903;
  s.runs[901]={status:'completed',conclusion:'success',actor:{login:'admin'}};
  await s.run('handoff',1,'worker-A',{CLAIM_RUN:'901',SUMMARY:handoffSummary});
  assert.match(s.writes.at(-1).body,/"handoff"/);
  const changed=handoffSetup();await park(changed);changed.prs[0].head.sha='b'.repeat(40);
  changed.runs[901]={status:'completed',conclusion:'success',actor:{login:'admin'}};
  await assert.rejects(changed.run('handoff',1,'worker-A',{CLAIM_RUN:'901',SUMMARY:handoffSummary}),/changed/);
});

for(const change of ['active','review-wait','head','new-pr','missing-pr','closed-unmerged','fork','cancelled-handoff','failed-handoff','wrong-run','old-permission','new-permission','actor','malformed','other-active-issue']) {
  test(`pickup preserves the reservation when unsafe: ${change}`,async()=>{
    const permissions={admin:'write',successor:'write'};
    const s=handoffSetup({permissions});
    if(change==='active'){}else if(change==='review-wait')await park(s);else await handoff(s);
    const before=s.writes.length;
    if(change==='head')s.prs[0].head.sha='b'.repeat(40);
    if(change==='new-pr')s.prs.push(savedPR(12));
    if(change==='missing-pr')s.prs.length=0;
    if(change==='closed-unmerged')s.prs[0].state='closed';
    if(change==='fork')s.prs[0].head.repo.full_name='other/game';
    if(change==='cancelled-handoff')s.runs[901]={status:'completed',conclusion:'cancelled'};
    if(change==='failed-handoff')s.runs[901]={status:'completed',conclusion:'failure'};
    if(change==='old-permission')permissions.admin='read';
    if(change==='new-permission')permissions.successor='read';
    if(change==='actor')s.comments[1].at(-1).body=s.comments[1].at(-1).body.replace('login=admin','login=other');
    if(change==='malformed')s.comments[1].at(-1).body=s.comments[1].at(-1).body.replace('"pushed":true','"pushed":false');
    if(change==='other-active-issue')s.comments[2]=[modernEntry('worker-B',700)];
    await assert.rejects(pickup(s,change==='wrong-run'?{CLAIM_RUN:'700'}:{}));
    assert.equal(s.writes.length,before);
  });
}

for(const change of ['head','cancelled-offer','resumed','new-checkpoint','closed']) {
  test(`pickup rechecks after other worker reservations are inspected: ${change}`,async()=>{
    const s=handoffSetup({hook(name,args,data){
      if(name!=='listForRepo')return;
      if(change==='head')data.prs[0].head.sha='b'.repeat(40);
      if(change==='cancelled-offer')s.runs[901]={status:'completed',conclusion:'cancelled'};
      if(change==='resumed')data.comments[1].push({...modernEntry('worker-A',903),id:500});
      if(change==='new-checkpoint')data.comments[1].push({...data.comments[1].at(-1),id:500});
      if(change==='closed')data.issues[0].state='closed';
    }});
    await handoff(s);await assert.rejects(pickup(s));assert.equal(s.writes.length,1);
  });
}

test('dispatch cannot cancel or release another requester handoff by copying the public worker ID',async()=>{
  for(const op of ['resume','release','park']){
    const s=handoffSetup();await handoff(s);s.context.actor='successor';
    await assert.rejects(s.run(op,1,'worker-A',op==='release'?{}:{CLAIM_RUN:'901'}),/original reservation requester/);
    assert.equal(s.writes.length,1);
  }
});

test('a canceled pickup keeps the new reservation but never authorizes editing or a silent retry',async()=>{
  const s=handoffSetup();await handoff(s);await pickup(s);
  s.runs[902]={status:'completed',conclusion:'cancelled'};
  await assert.rejects(s.run('status',1,'worker-B',{CLAIM_RUN:'902'}),/did not succeed/);
  await assert.rejects(pickup(s),/No handoff-ready/);
  await assert.rejects(s.run('resume',1,'worker-A',{CLAIM_RUN:'901'}),/no longer matches/);
});

for(const change of ['version','actor-type','run-type','empty-prs','summary','stopped']) {
  test(`pickup rejects malformed handoff metadata: ${change}`,async()=>{
    const s=handoffSetup();await handoff(s);
    const c=s.comments[1].at(-1),line=c.body.match(/^<!-- issue-claim-wait:v1 (.+) -->$/m);
    const checkpoint=JSON.parse(line[1]);
    if(change==='version')checkpoint.handoff.version=2;
    if(change==='actor-type')checkpoint.handoff.actor=['admin'];
    if(change==='run-type')checkpoint.handoff.source_run=800;
    if(change==='empty-prs')checkpoint.prs=[];
    if(change==='summary')checkpoint.handoff.summary='';
    if(change==='stopped')checkpoint.handoff.stopped=false;
    c.body=c.body.replace(line[0],'<!-- issue-claim-wait:v1 '+JSON.stringify(checkpoint)+' -->');
    await assert.rejects(pickup(s));assert.equal(s.writes.length,1);
  });
}

test('a human-written ready marker cannot turn an active bot reservation into a handoff',async()=>{
  const s=handoffSetup();await handoff(s);
  const forged={...s.comments[1].pop(),user:{login:'admin'}};
  s.comments[1].push(forged);
  await assert.rejects(pickup(s),/No handoff-ready/);
});

test('a merged saved head is still a valid checkpoint while the Issue has remaining work',async()=>{
  const s=handoffSetup();await handoff(s);
  s.prs[0].state='closed';s.prs[0].merged_at='2026-10-19T07:00:00Z';
  await pickup(s);assert.match(s.writes.at(-1).body,/state=claimed owner=worker-B/);
});

test('park keeps the Issue exclusive and allows a separate active task, then resume after release', async () => {
  const s = parkingSetup();
  await park(s);
  assert.match(s.writes[0].body, /state=claimed owner=worker-A/);
  assert.match(s.writes[0].body, /issue-claim-wait:v1/);
  await assert.rejects(s.run('claim', 1, 'worker-B'), /Already claimed/);
  await assert.rejects(s.run('status', 1, 'worker-A', {CLAIM_RUN:'901'}), /parked/);
  s.context.runId = 902;
  await s.run('claim', 2);
  await assert.rejects(s.run('resume', 1, 'worker-A', {CLAIM_RUN:'901'}), /Worker already owns #2/);
  await s.run('release', 2);
  s.context.runId = 904;
  await s.run('resume', 1, 'worker-A', {CLAIM_RUN:'901'});
  assert.doesNotMatch(s.writes.at(-1).body, /issue-claim-wait/);
  await s.run('status', 1, 'worker-A', {CLAIM_RUN:'904'});
});

for (const change of ['owner','run','no-pr','fork','bad-head','cancelled-source']) {
  test(`park refuses missing ownership or a saved checkpoint: ${change}`, async () => {
    const s = parkingSetup();
    if (change === 'owner') s.comments[1] = [modernEntry('other-worker')];
    if (change === 'run') s.comments[1] = [modernEntry('worker-A', 700)];
    if (change === 'no-pr') s.prs.length = 0;
    if (change === 'fork') s.prs[0].head.repo.full_name = 'other/game';
    if (change === 'bad-head') s.prs[0].head.sha = 'short';
    if (change === 'cancelled-source') s.runs[800] = {status:'completed', conclusion:'cancelled'};
    await assert.rejects(park(s));
    assert.equal(s.writes.length, 0);
  });
}

test('park rechecks the PR head before recording review wait', async () => {
  let reads = 0;
  const s = parkingSetup({hook(name, args, data) {
    if (name === 'pulls' && ++reads === 2) data.prs[0].head.sha = 'b'.repeat(40);
  }});
  await assert.rejects(park(s), /changed/);
  assert.equal(s.writes.length, 0);
});

for (const change of ['head','new-pr','closed-unmerged','missing-pr','cancelled-park','malformed']) {
  test(`waiting reservations do not permit switching with unverified saved work: ${change}`, async () => {
    const s = parkingSetup();
    await park(s);
    if (change === 'head') s.prs[0].head.sha = 'b'.repeat(40);
    if (change === 'new-pr') s.prs.push(savedPR(12));
    if (change === 'closed-unmerged') s.prs[0].state = 'closed';
    if (change === 'missing-pr') s.prs.length = 0;
    if (change === 'cancelled-park') s.runs[901] = {status:'completed', conclusion:'cancelled'};
    if (change === 'malformed') s.comments[1].at(-1).body = s.comments[1].at(-1).body.replace('"prs":', '"invalid":');
    await assert.rejects(s.run('claim', 2));
    assert.equal(s.writes.length, 1);
  });
}

test('a merged saved PR may remain waiting for further review without blocking unrelated work', async () => {
  const s = parkingSetup();
  await park(s);
  s.prs[0].state = 'closed'; s.prs[0].merged_at = '2026-10-16T04:00:00Z';
  await s.run('claim', 2);
  assert.equal(s.writes.length, 2);
});

test('a worker with a valid waiting PR can receive a separate active transfer', async () => {
  const waiting = modernEntry('worker-B',700);
  waiting.body += '\n<!-- issue-claim-wait:v1 ' + JSON.stringify({prs:[{number:22, head:savedHead}]}) + ' -->';
  const s = transferSetup({comments:{1:[modernEntry()],2:[waiting]},
    prs:[savedPR(),savedPR(22,2)]});
  await transfer(s);
  assert.equal(s.writes.length, 1);
});

const completedSetup = options => setup({issues:[fixture(1,{state:'closed',state_reason:'completed',body:''}),fixture(2)],
  comments:{1:[modernEntry()]}, prs:[savedPR(11,1,{state:'closed',merged_at:'2026-10-16T04:00:00Z'})], ...options});

test('completed merged work releases the recorded owner once, including before that worker claims another task', async () => {
  const s = completedSetup();
  await s.run('claim', 2);
  assert.match(s.writes[0].body, /state=released owner=worker-A/);
  assert.match(s.writes[1].body, /state=claimed owner=worker-A/);
  const result = await maintain(s.github,s.context,s.core,1);
  assert.equal(result.released,0);
  assert.equal(s.writes.length,2);
});

for (const change of ['open','not-planned','open-pr','no-merged-pr','fork','wrong-base','blocked','legacy','failed-run']) {
  test(`maintenance preserves unfinished or unverifiable reservations: ${change}`, async () => {
    const s = completedSetup();
    if (change === 'open') s.issues[0].state = 'open';
    if (change === 'not-planned') s.issues[0].state_reason = 'not_planned';
    if (change === 'open-pr') s.prs.push(savedPR(12));
    if (change === 'no-merged-pr') s.prs[0].merged_at = null;
    if (change === 'fork') s.prs[0].head.repo.full_name = 'other/game';
    if (change === 'wrong-base') s.prs[0].base.ref = 'feature';
    if (change === 'blocked') s.issues[0].labels = ['blocked'];
    if (change === 'legacy') s.comments[1] = [entry('claimed','worker-A')];
    if (change === 'failed-run') s.runs[800] = {status:'completed',conclusion:'failure'};
    await maintain(s.github,s.context,s.core,1);
    assert.equal(s.writes.length,0);
  });
}

for (const change of ['reopened','new-owner','new-pr','head']) {
  test(`completion cleanup rechecks mutable state before releasing: ${change}`, async () => {
    let reads = 0;
    const s = completedSetup({hook(name,args,data) {
      if (name !== 'get' || ++reads !== 2) return;
      if (change === 'reopened') data.issues[0].state = 'open';
      if (change === 'new-owner') data.comments[1].push({...modernEntry('worker-B',801),id:55});
      if (change === 'new-pr') data.prs.push(savedPR(12));
      if (change === 'head') data.prs[0].head.sha = 'b'.repeat(40);
    }});
    await maintain(s.github,s.context,s.core,1);
    assert.equal(s.writes.length,0);
  });
}

test('policy sync preserves owner holds and original prose, and is idempotent', async () => {
  const original = '\n\n作業はclaim/status成功後。新デザインの採用はオーナー確認まで保留。';
  const s = setup({issues:[fixture(1,{body:original})]});
  const result = await maintain(s.github,s.context,s.core,1);
  assert.equal(result.updated,1);
  assert.ok(s.issues[0].body.endsWith(original));
  assert.match(s.issues[0].body,/status起動は任意/);
  assert.match(s.issues[0].body,/個別の採用保留/);
  assert.equal((await maintain(s.github,s.context,s.core,1)).updated,0);
  assert.equal((s.issues[0].body.match(/issue-claim-policy:v2:start/g)||[]).length,1);
});

test('policy sync does not overwrite an intervening human edit', async () => {
  let reads = 0;
  const s = setup({issues:[fixture(1,{body:'claim/status成功後'})],hook(name,args,data) {
    if (name === 'get' && ++reads === 3) data.issues[0].body = '新しい個別の停止指示';
  }});
  await maintain(s.github,s.context,s.core,1);
  assert.equal(s.issues[0].body,'新しい個別の停止指示');
  assert.equal(s.calls.filter(c=>c.name==='update').length,0);
});

test('a damaged managed block is preserved, and ordinary prose is not rewritten', () => {
  const s=setup();
  assert.equal(policyBody('通常のゲーム要望',s.context),'通常のゲーム要望');
  assert.throws(()=>policyBody('<!-- issue-claim-policy:v2:start -->\n保留',s.context),/Incomplete/);
  assert.throws(()=>policyBody('説明中の例: <!-- issue-claim-policy:v2:start -->内容<!-- issue-claim-policy:v2:end -->',s.context),/Incomplete/);
});

function commentSetup(request={operation:'claim',owner:'worker-A',agent:'codex'}, options={}) {
  const s=setup({permissions:{writer:'write'},...options});
  const comment={id:50,user:{login:'writer',type:'User'},body:'/issue-claim '+JSON.stringify(request),issue_url:fixture(1).url};
  s.context.eventName='issue_comment';
  s.context.payload.action='created';
  s.context.payload.issue=fixture(1);
  s.context.payload.comment=structuredClone(comment);
  s.approvals[50]=comment;
  return s;
}
const runComment=s=>runEvent(s.github,s.context,s.core,{});

test('comment handoff and pickup work through the real Context getter without a named successor or approval comment',async()=>{
  const claim=modernEntry();claim.body+='\n<!-- issue-claim-actor:v1 login=writer -->';
  const s=commentSetup({operation:'handoff',owner:'worker-A',claim_run:'800',summary:handoffSummary},
    {comments:{1:[claim]},prs:[savedPR()],permissions:{writer:'write',successor:'write'}});
  const repository=s.context.repo;delete s.context.repo;
  Object.setPrototypeOf(s.context,{get repo(){return repository}});
  s.context.actor='eventActor';
  await runComment(s);
  assert.match(s.writes[0].body,/"actor":"writer"/);
  const request={id:51,user:{login:'successor',type:'User'},issue_url:fixture(1).url,
    body:'/issue-claim {"operation":"pickup","owner":"worker-B","agent":"claude"}'};
  s.approvals[51]=request;s.context.payload.comment=structuredClone(request);s.context.runId=902;
  await runComment(s);
  assert.match(s.writes[2].body,/state=claimed owner=worker-B/);
  assert.match(s.writes[2].body,/login=successor/);
  assert.equal(s.context.actor,'eventActor');
});

test('an edited handoff request cannot be saved after the initial comment verification',async()=>{
  let reads=0;
  const claim=modernEntry();claim.body+='\n<!-- issue-claim-actor:v1 login=writer -->';
  const s=commentSetup({operation:'handoff',owner:'worker-A',claim_run:'800',summary:handoffSummary},
    {comments:{1:[claim]},prs:[savedPR()],hook(name){
      if(name==='pulls'&&++reads===2)s.approvals[50].body='canceled by writer';
    }});
  await assert.rejects(runComment(s),/Request comment changed/);
  assert.equal(s.writes.length,1);assert.match(s.writes[0].body,/Request refused/);
});

test('an edited pickup request cannot consume a checkpoint after inspecting other reservations',async()=>{
  const request={id:55,user:{login:'successor'},issue_url:fixture(1).url,body:'/issue-claim pickup'};
  const s=handoffSetup({approvals:{55:structuredClone(request)},hook(name){
    if(name==='listForRepo')s.approvals[55].body='cancel pickup';
  }});
  await handoff(s);s.context.verifiedRequest=request;
  await assert.rejects(pickup(s),/Request comment changed/);assert.equal(s.writes.length,1);
});

for(const operation of ['handoff','pickup']) {
  test(`a rerun cannot replay a reservation-changing ${operation} comment`,async()=>{
    const s=commentSetup({operation,owner:'worker-A',claim_run:'800',...(operation==='handoff'?{summary:handoffSummary}:{})});
    s.context.runAttempt=2;
    await assert.rejects(runComment(s),/Do not rerun/);assert.equal(s.writes.length,0);
  });
}

for(const request of [
  {operation:'handoff',owner:'worker-A',claim_run:'800',summary:42},
  {operation:'pickup',owner:'worker-B',summary:handoffSummary},
  {operation:'maintain',owner:'worker-A',summary:handoffSummary},
]) {
  test(`comment summary is accepted only as handoff text: ${request.operation}/${typeof request.summary}`,async()=>{
    const s=commentSetup(request);
    await assert.rejects(runComment(s),/Summary is text for handoff only/);
    assert.equal(s.writes.length,0);
  });
}

test('comment reservations preserve the GitHub Context prototype and original actor', async () => {
  const s = commentSetup();
  const repository = s.context.repo;
  delete s.context.repo;
  Object.setPrototypeOf(s.context, { get repo() { return repository; } });
  assert.equal(Object.hasOwn(s.context, 'repo'), false);
  assert.equal(({...s.context}).repo, undefined);
  await runComment(s);
  assert.match(s.writes[0].body, /state=claimed owner=worker-A/);
  assert.match(s.writes[0].body, /issue-claim-actor:v1 login=writer/);
  assert.equal(s.context.actor, 'admin', 'request identity must not mutate the event context');
  assert.equal(s.context.verifiedRequester, undefined);
  for (const {args} of s.calls) {
    assert.equal(args.owner, 'example.dot');
    assert.equal(args.repo, 'game');
  }
});

test('a writer comment uses the same reservation logic and duplicate event delivery cannot book twice', async () => {
  const s=commentSetup();
  await runComment(s);
  assert.match(s.writes[0].body,/state=claimed owner=worker-A/);
  assert.match(s.writes[0].body,/request=comment-50/);
  assert.match(s.writes[1].body,/issue-claim-request:v1 comment=50/);
  await runComment(s);
  assert.equal(s.writes.length,2);
});

test('a PR Conversation can request a reservation for an explicit Issue through the connector', async () => {
  const s=commentSetup({operation:'claim',issue:2,owner:'worker-A'});
  s.context.payload.issue.pull_request={};
  await runComment(s);
  assert.equal(s.writes[0].issue_number,2);
  assert.equal(s.writes[1].issue_number,1);
});

for (const change of ['read','unknown-permission','changed-body','wrong-thread','wrong-author','unknown-field','malformed-json']) {
  test(`comment entrypoint refuses unauthorized or changed input: ${change}`, async () => {
    const s=commentSetup({}, {permissions:{writer:change==='read'?'read':'write'},hook(name) {
      if (change==='unknown-permission' && name==='permission') throw Error('Permission unavailable');
    }});
    s.context.payload.comment.body='/issue-claim '+JSON.stringify({operation:'claim',owner:'worker-A'});
    s.approvals[50].body=s.context.payload.comment.body;
    if (change==='changed-body') s.approvals[50].body='edited';
    if (change==='wrong-thread') s.approvals[50].issue_url=fixture(2).url;
    if (change==='wrong-author') s.approvals[50].user.login='someoneElse';
    if (change==='unknown-field') s.approvals[50].body=s.context.payload.comment.body='/issue-claim {"operation":"claim","owner":"worker-A","actor":"admin"}';
    if (change==='malformed-json') s.approvals[50].body=s.context.payload.comment.body='/issue-claim {invalid}';
    await assert.rejects(runComment(s));
    assert.equal(s.writes.length,0);
  });
}

test('ordinary discussion and bot responses do not recursively trigger operations', async () => {
  for (const body of ['discussion','<!-- issue-claim-request:v1 comment=50 -->']) {
    const s=commentSetup();s.context.payload.comment.body=body;
    await runComment(s);assert.equal(s.calls.length,0);
  }
  const s=commentSetup();s.context.payload.comment.user.type='Bot';
  await runComment(s);assert.equal(s.calls.length,0);
});

test('a rejected duplicate comment gets a result without taking over another worker', async () => {
  const s=commentSetup(undefined,{comments:{1:[modernEntry('worker-B')]}});
  await assert.rejects(runComment(s),/Already claimed/);
  assert.equal(s.writes.length,1);
  assert.match(s.writes[0].body,/Request refused/);
  assert.doesNotMatch(s.writes[0].body,/issue-claim:v1 state=claimed/);
});

test('Issue events and scheduled maintenance use the same guarded cleanup', async () => {
  const s=completedSetup();s.context.eventName='issues';s.context.payload.issue=fixture(1);
  await runEvent(s.github,s.context,s.core,{});
  assert.equal(s.writes.length,1);
  s.context.eventName='schedule';
  await runEvent(s.github,s.context,s.core,{});
  assert.equal(s.writes.length,1);
});

test('workflow entrypoints keep the shared lock and never check out comment or PR head code', () => {
  const workflow=readFileSync(new URL('../.github/workflows/issue-claim.yml',import.meta.url),'utf8');
  assert.match(workflow,/group: issue-claim-coordinator/);
  assert.match(workflow,/event_name == 'workflow_dispatch' && github.sha \|\| github.event.repository.default_branch/);
  assert.doesNotMatch(workflow.match(/^\s+ref:.*$/m)[0],/pull_request\.head|comment\.body/);
  assert.match(workflow,/require\('\.\/tools\/issue_claim_coordinator.cjs'\)/);
  assert.match(workflow,/comment.author_association/);
});

test('the verified comment requester is retained for ordinary handoff', async () => {
  const s=commentSetup();
  s.context.actor='admin';
  await runEvent(s.github,s.context,s.core,{});
  assert.match(s.writes[0].body,/issue-claim-actor:v1 login=writer/);
  s.prs.push(savedPR());
  s.approvals[70]={id:70,user:{login:'writer'},issue_url:fixture(1).url,html_url:'https://github.com/example.dot/game/issues/1#issuecomment-70',
    body:'<!-- issue-handoff:v1 '+JSON.stringify({...approvedHandoff(),claim_run:'901'})+' -->'};
  s.context.actor='writer';
  s.runs[901]={status:'completed',conclusion:'success',actor:{login:'admin'}};
  await s.run('transfer',1,'worker-B',{CLAIM_RUN:'901',HANDOFF_COMMENT:'70'});
  assert.match(s.writes.at(-1).body,/state=claimed owner=worker-B/);
});

test('obsolete steps in historical comments receive a current policy block without editing the comment', async () => {
  const old={id:1,user:{login:'writer'},body:'1worker1件。claim/status成功まで編集禁止。'};
  const s=setup({issues:[fixture(1,{body:'元の要望と個別の停止指示'})],comments:{1:[old]}});
  await maintain(s.github,s.context,s.core,1);
  assert.match(s.issues[0].body,/現行の共通作業手順/);
  assert.ok(s.issues[0].body.endsWith('元の要望と個別の停止指示'));
  assert.deepEqual(s.comments[1][0],old);
});

test('scheduled completion can obtain the default branch when event metadata omits it', async () => {
  const s=completedSetup();s.context.payload.repository={};
  const result=await maintain(s.github,s.context,s.core,1);
  assert.equal(result.released,1);
});

test('a failed conditional Issue update is deferred without replacing the original body', async () => {
  const original='claim/status成功後。採用保留。';
  const s=setup({issues:[fixture(1,{body:original})],hook(name) {
    if (name==='update') throw Error('Precondition failed');
  }});
  const result=await maintain(s.github,s.context,s.core,1);
  assert.equal(result.errors,1);
  assert.equal(s.issues[0].body,original);
});

test('a writer cannot release a different requester merely by copying its public worker ID', async () => {
  const s=commentSetup({operation:'release',owner:'worker-A'},
    {comments:{1:[modernEntry()]},runs:{800:{status:'completed',conclusion:'success',actor:{login:'otherWriter'}}}});
  await assert.rejects(runComment(s),/original reservation requester/);
  assert.equal(s.writes.length,1);
  assert.match(s.writes[0].body,/Request refused/);
});

test('the original requester can release its failed reservation and retry safely', async () => {
  const s=commentSetup({operation:'release',owner:'worker-A'},
    {comments:{1:[modernEntry()]},runs:{800:{status:'completed',conclusion:'cancelled',actor:{login:'writer'}}}});
  await runComment(s);
  assert.match(s.writes[0].body,/state=released owner=worker-A/);
});

test('maintenance never replays old request comments or overrides a canceled execution', async () => {
  const s=commentSetup();s.context.eventName='schedule';
  s.comments[1]=[s.approvals[50]];
  await runEvent(s.github,s.context,s.core,{});
  assert.equal(s.writes.length,0);
});

test('a later PR merge cleans up an already-completed Issue without waiting for the daily sweep', async () => {
  const s=completedSetup();s.context.eventName='pull_request';
  s.context.payload.pull_request={...s.prs[0],merged:true};
  await runEvent(s.github,s.context,s.core,{});
  assert.match(s.writes[0].body,/state=released owner=worker-A/);
});

for (const change of ['unmerged','fork','non-default']) {
  test(`PR events cannot release work from an ineligible merge: ${change}`, async () => {
    const s=completedSetup();s.context.eventName='pull_request';
    s.context.payload.pull_request={...structuredClone(s.prs[0]),merged:change!=='unmerged'};
    if (change==='fork') s.context.payload.pull_request.head.repo.full_name='other/game';
    if (change==='non-default') s.context.payload.pull_request.base.ref='feature';
    await runEvent(s.github,s.context,s.core,{});
    assert.equal(s.writes.length,0);
  });
}

test('rerunning an acknowledged failed comment cannot turn its persisted reservation into permission to work', async () => {
  const s=commentSetup();
  await runComment(s);
  s.runs[901]={status:'completed',conclusion:'failure'};
  s.context.runAttempt=2;
  await assert.rejects(runComment(s),/Do not rerun reservation request jobs/);
  assert.equal(s.writes.length,2);
  await assert.rejects(s.run('status',1,'worker-A',{CLAIM_RUN:'901'}),/did not succeed/);
});

// #745 fixtures deliberately keep every pinned target open; production #709 is
// closed and must still fail the ordinary open/unblocked gate.
const recoveryRepo = 'haseatsu114514-dot/shisha-game';
const recoveryTargets = [
  [709,'codex-709-20261019-peppermint-0015','39272409432',740,'a30de7f8d9900f8a1ca5a866181b4a0a7d444d03'],
  [717,'codex-text-717-20261019-f31a','39385075235',739,'7ae8077d0cc0d2f233fd2d139d18bd0b3ebda91e'],
  [726,'codex-701-holes-20261019-01','39236047840',731,'14713be78dac4356cd4c31219d612b173014b465'],
];
function ownerRecoverySetup(target = recoveryTargets[1], options = {}) {
  const [number,from,run,pr,head] = target;
  const h = {repo:recoveryRepo,issue:number,from,to:'new-recovery-worker',claim_run:run,
    prs:[{number:pr,head}],approval_issue:745,consent:'resume-saved-pr',accept_loss:true,
    stopped:'unknown',pushed:'unknown',unsaved_work:'unknown',
    scope:'Only this saved PR is recoverable; any unknown/unrecoverable uncommitted and unpushed work is accepted as lost.',
    consent_evidence: number === 726
      ? 'The owner separately authorized the later additional Issue 726 loss-risk scope in task 745.'
      : 'The owner explicitly authorized Issues 709 and 717 loss-risk scope in the initial task 745 instruction.'};
  const url = `https://api.github.com/repos/${recoveryRepo}/issues/${number}`;
  const permissions = {admin:'admin','haseatsu114514-dot':'admin',otherAdmin:'admin'};
  const s = setup({issues:[fixture(number,{url}),fixture(999)],
    comments:{[number]:[entry('claimed',from,{body:`<!-- issue-claim:v1 state=claimed owner=${from} -->\n<!-- issue-claim-run:v1 id=${run} request=original -->`})]},
    prs:[{number:pr,body:`Refs #${number}`,head:{sha:head,repo:{full_name:recoveryRepo}}}],
    approvals:{50:{id:50,user:{login:'haseatsu114514-dot'},issue_url:url,
      html_url:`https://github.com/${recoveryRepo}/issues/${number}#issuecomment-50`,updated_at:'2026-10-20T01:00:00Z'}},
    permissions,...options});
  s.context.repo={owner:'haseatsu114514-dot',repo:'shisha-game'};
  function approvalBody() {
    s.approvals[50].body=`<!-- issue-owner-recovery:v1 ${JSON.stringify(h)} -->\n`+
      `I authorize ${h.to} to resume saved PR #${pr} for Issue #${number} under #745 and accept loss of unknown/unrecoverable uncommitted and unpushed work; stopped and pushed remain unknown.\n`+
      h.scope+'\n'+h.consent_evidence;
  }
  approvalBody();
  const input={OPERATION:'transfer',ISSUE:String(number),OWNER:h.to,AGENT:'codex',CLAIM_RUN:run,HANDOFF_COMMENT:'50'};
  return Object.assign(s,{h,permissions,approvalBody,input,
    recover:()=>runEvent(s.github,s.context,s.core,input)});
}
function recoveryComment(s) {
  const c={id:60,user:{login:'admin',type:'User'},issue_url:s.issues[0].url,
    body:'/issue-claim '+JSON.stringify({operation:'transfer',issue:s.h.issue,owner:s.h.to,agent:'codex',claim_run:s.h.claim_run,handoff_comment:50})};
  s.approvals[60]=c;s.context.eventName='issue_comment';s.context.payload.action='created';
  s.context.payload.issue=s.issues[0];s.context.payload.comment=structuredClone(c);
}
const ledgerWrites = s => s.writes.filter(w=>w.body.startsWith('<!-- issue-claim:v1'));
for (const target of recoveryTargets) for (const entrypoint of ['dispatch','comment']) {
  test(`owner recovery ${target[0]} succeeds via ${entrypoint} with unknown audit and one atomic claim`, async () => {
    const s=ownerRecoverySetup(target);
    if(entrypoint==='comment') recoveryComment(s);
    const original=structuredClone({comments:s.comments,prs:s.prs,approval:s.approvals[50]});
    await s.recover();
    const writes=ledgerWrites(s);assert.equal(writes.length,1);
    const audit=JSON.parse(writes[0].body.match(/<!-- issue-owner-recovery-audit:v1 (.+) -->/)[1]);
    assert.deepEqual(audit,{...s.h,approval_comment:50});
    for(const key of ['stopped','pushed','unsaved_work']) assert.equal(audit[key],'unknown');
    assert.doesNotMatch(writes[0].body,/"(?:stopped|pushed)":true|state=released/);
    assert.deepEqual(s.prs,original.prs);assert.deepEqual(s.approvals[50],original.approval);
    assert.deepEqual(s.comments[target[0]][0],original.comments[target[0]][0]);
    if(entrypoint==='comment') await s.recover(); // receipt makes event replay a no-op
    else await assert.rejects(s.recover());
    assert.equal(ledgerWrites(s).length,1);
    await s.run('status',target[0],s.h.to,{CLAIM_RUN:'901'});
  });
}

for(const change of ['repo','target','from','run','head','pr','to','same-worker','missing','malformed','false-consent','no-consent','no-prose','no-evidence','no-scope','stopped-true','pushed-true','unsaved-false','extra','legacy','mixed','duplicate','author-admin','author-read','actor-read','actor-write','closed','blocked','failed-source','cancelled-source','other-active','other-closed','ledger-owner','ledger-run','released','fork','extra-pr']) {
  test(`owner recovery refuses ${change} without any ledger write`, async () => {
    const s=ownerRecoverySetup();const h=s.h;
    if(change==='repo') s.context.repo.repo='other';
    if(change==='target') s.input.ISSUE='745';
    if(change==='from') h.from='other-worker';
    if(change==='run') h.claim_run=s.input.CLAIM_RUN='800';
    if(change==='head') h.prs[0].head='f'.repeat(40);
    if(change==='pr') h.prs[0].number=740;
    if(change==='to') h.to='different-worker';
    if(change==='same-worker') h.to=s.input.OWNER=h.from;
    if(change==='false-consent') h.accept_loss=false;
    if(change==='no-consent') delete h.consent;
    if(change==='no-evidence') h.consent_evidence='';
    if(change==='no-scope') h.scope='unknown';
    if(change==='stopped-true') h.stopped=true;
    if(change==='pushed-true') h.pushed=true;
    if(change==='unsaved-false') h.unsaved_work=false;
    if(change==='extra') h.unapproved=true;
    if(change==='legacy') h.recovery={claim_comment:1,released_comment:2};
    s.approvalBody();
    if(change==='missing') s.approvals[50].body='Approved';
    if(change==='malformed') s.approvals[50].body='<!-- issue-owner-recovery:v1 {bad} -->';
    if(change==='no-prose') s.approvals[50].body=s.approvals[50].body.split('\n')[0];
    if(change==='mixed') s.approvals[50].body+='\n<!-- issue-handoff:v1 {} -->';
    if(change==='duplicate') s.approvals[50].body+='\n'+s.approvals[50].body.split('\n')[0];
    if(change==='author-admin') s.approvals[50].user.login='otherAdmin';
    if(change==='author-read') s.permissions['haseatsu114514-dot']='read';
    if(change==='actor-read') s.permissions.admin='read';
    if(change==='actor-write') s.permissions.admin='write';
    if(change==='closed') s.issues[0].state='closed';
    if(change==='blocked') s.issues[0].labels=['status:blocked'];
    if(change==='failed-source'||change==='cancelled-source') s.runs[h.claim_run]={status:'completed',conclusion:change==='failed-source'?'failure':'cancelled'};
    if(change==='other-active'||change==='other-closed') {
      s.comments[999]=[entry('claimed',h.to)];
      if(change==='other-closed') s.issues[1].state='closed';
    }
    if(change==='ledger-owner') s.comments[h.issue][0].body=s.comments[h.issue][0].body.replace(h.from,'other-worker');
    if(change==='ledger-run') s.comments[h.issue][0].body=s.comments[h.issue][0].body.replace(h.claim_run,'800');
    if(change==='released') s.comments[h.issue][0].body=s.comments[h.issue][0].body.replace('state=claimed','state=released');
    if(change==='fork') s.prs[0].head.repo.full_name='other/repo';
    if(change==='extra-pr') s.prs.push({...s.prs[0],number:999});
    await assert.rejects(s.recover());assert.equal(s.writes.length,0);
  });
}

for(const mutation of ['approval','author','approval-time','actor-permission','author-permission','permission-error','head','pr-set','owner','run','same-tuple-new-comment','issue','blocked','source','availability']) {
  test(`owner recovery revalidates mutable ${mutation} before write`, async () => {
    let scans=0;
    const s=ownerRecoverySetup(undefined,{hook(name,args,data) {
      if(name!=='listForRepo'||++scans!==1) return;
      if(mutation==='approval') s.approvals[50].body+='\nEdited';
      if(mutation==='author') s.approvals[50].user.login='otherAdmin';
      if(mutation==='approval-time') s.approvals[50].updated_at='later';
      if(mutation==='actor-permission') s.permissions.admin='write';
      if(mutation==='author-permission') s.permissions['haseatsu114514-dot']='write';
      if(mutation==='permission-error') s.github.rest.repos.getCollaboratorPermissionLevel=async()=>{throw Error('Permission unavailable');};
      if(mutation==='head') data.prs[0].head.sha='b'.repeat(40);
      if(mutation==='pr-set') data.prs.length=0;
      if(mutation==='owner') data.comments[717][0].body=data.comments[717][0].body.replace(s.h.from,'other-worker');
      if(mutation==='run') data.comments[717][0].body=data.comments[717][0].body.replace(s.h.claim_run,'800');
      if(mutation==='same-tuple-new-comment') data.comments[717].push({...data.comments[717][0],id:99});
      if(mutation==='issue') data.issues[0].state='closed';
      if(mutation==='blocked') data.issues[0].labels=['blocked'];
      if(mutation==='source') s.runs[s.h.claim_run]={status:'completed',conclusion:'failure'};
      if(mutation==='availability') data.comments[999]=[entry('claimed',s.h.to)];
    }});
    await assert.rejects(s.recover());assert.equal(s.writes.length,0);
  });
}

test('owner recovery #709 refuses closed live-state fixture without reopen or release', async()=>{
  const s=ownerRecoverySetup(recoveryTargets[0]);s.issues[0].state='closed';
  await assert.rejects(s.recover(),/Not an open issue/);assert.equal(s.writes.length,0);
  assert.equal(s.issues[0].state,'closed');
});

test('owner recovery write failure preserves old reservation', async()=>{
  const s=ownerRecoverySetup(undefined,{hook(name){if(name==='createComment') throw Error('write denied');}});
  await assert.rejects(s.recover(),/write denied/);assert.equal(s.writes.length,0);
  assert.equal(s.comments[717].length,1);assert.match(s.comments[717][0].body,new RegExp(s.h.from));
});
for(const conclusion of ['cancelled','failure']) test(`owner recovery ${conclusion} after write protects reservation without edit authorization`, async()=>{
  const s=ownerRecoverySetup();s.runs[901]={status:'completed',conclusion};
  await s.recover();
  await assert.rejects(s.run('status',717,s.h.to,{CLAIM_RUN:'901'}),/did not succeed/);
  await assert.rejects(s.run('claim',717,'third-worker'),/Already claimed/);
  await assert.rejects(s.recover());assert.equal(s.writes.length,1);
});

test('owner recovery comment rerun refuses before a ledger write',async()=>{
  const s=ownerRecoverySetup();recoveryComment(s);s.context.runAttempt=2;
  await assert.rejects(s.recover(),/Do not rerun/);assert.equal(s.writes.length,0);
});

for(const change of ['unsupported-open-target','record-repo','approval-issue','wrong-thread','missing-field','fake-flag','malformed-second-marker','missing-live-approval']) {
  test(`owner recovery rejects incomplete or unpinned record: ${change}`,async()=>{
    const s=ownerRecoverySetup();
    if(change==='unsupported-open-target') {
      s.issues[0].number=s.h.issue=745;s.input.ISSUE='745';
    }
    if(change==='record-repo') s.h.repo='other/repo';
    if(change==='approval-issue') s.h.approval_issue=731;
    if(change==='missing-field') delete s.h.unsaved_work;
    if(change==='fake-flag') s.h.stopped=true;
    s.approvalBody();
    if(change==='wrong-thread') s.approvals[50].issue_url=fixture(999).url;
    if(change==='malformed-second-marker') s.approvals[50].body+='\n<!-- issue-owner-recovery:v1 broken';
    if(change==='missing-live-approval') delete s.approvals[50];
    await assert.rejects(s.recover());assert.equal(s.writes.length,0);
  });
}

test('owner recovery comment refusal writes only its result receipt and preserves old claim',async()=>{
  const s=ownerRecoverySetup();recoveryComment(s);s.permissions.admin='write';
  await assert.rejects(s.recover(),/admin/);
  assert.equal(ledgerWrites(s).length,0);assert.equal(s.writes.length,1);
  assert.match(s.writes[0].body,/issue-claim-request:v1 comment=60/);
  assert.match(s.writes[0].body,/Request refused/);assert.equal(s.comments[717].length,2);
});

test('owner recovery failure after claim but before completion cannot authorize editing',async()=>{
  const s=ownerRecoverySetup();s.core.summary.write=async()=>{throw Error('summary write failed');};
  await assert.rejects(s.recover(),/summary write failed/);
  s.runs[901]={status:'completed',conclusion:'failure'};
  await assert.rejects(s.run('status',717,s.h.to,{CLAIM_RUN:'901'}),/did not succeed/);
  await assert.rejects(s.recover());assert.equal(ledgerWrites(s).length,1);
});

for (const mutation of ['owner','head','approval','author','permission','run','closed']) {
  test(`owner recovery refuses late ${mutation} during LAST availability scan`, async()=>{
    let scans=0;
    const s=ownerRecoverySetup(undefined,{hook(name,args,data){
      if(name!=='listForRepo'||++scans!==2) return;
      if(mutation==='owner') data.comments[717][0].body=data.comments[717][0].body.replace(s.h.from,'late-worker');
      if(mutation==='head') data.prs[0].head.sha='b'.repeat(40);
      if(mutation==='approval') s.approvals[50].body+='\nLate revocation';
      if(mutation==='author') s.approvals[50].user.login='otherAdmin';
      if(mutation==='permission') s.permissions.admin='write';
      if(mutation==='run') s.runs[s.h.claim_run]={status:'completed',conclusion:'failure'};
      if(mutation==='closed') data.issues[0].state='closed';
    }});
    await assert.rejects(s.recover());
    assert.equal(scans,2);assert.equal(s.writes.length,0);
    assert.equal(s.comments[717].length,1);
  });
}

test('owner recovery final evidence checks follow the last full worker scan',async()=>{
  const s=ownerRecoverySetup();await s.recover();
  const names=s.calls.map(c=>c.name);
  assert.equal(names.filter(n=>n==='listForRepo').length,2);
  const final=names.slice(names.lastIndexOf('listForRepo')+1,names.indexOf('createComment'));
  for(const name of ['get','permission','getComment','listComments','run','pulls']) assert.ok(final.includes(name),name);
  assert.equal(ledgerWrites(s).length,1);
});

for (const mutation of ['approval','approval-author','approval-timestamp','owner','current-run','executor-admin','author-admin','closed','blocked','source-run']) {
  test(`owner recovery refuses ${mutation} changed during FINAL PR enumeration`,async()=>{
    let enumerations=0;
    const s=ownerRecoverySetup(undefined,{hook(name,args,data){
      // The API mock applies this before returning the second full PR listing,
      // matching revocation/state changes while a paginated listing is in flight.
      if(name!=='pulls'||++enumerations!==2) return;
      if(mutation==='approval') s.approvals[50].body+='\nOwner revoked consent while PR enumeration was in flight.';
      if(mutation==='approval-author') s.approvals[50].user.login='otherAdmin';
      if(mutation==='approval-timestamp') s.approvals[50].updated_at='2026-10-20T23:00:00Z';
      if(mutation==='owner') data.comments[717].push({...data.comments[717][0],id:90,
        body:data.comments[717][0].body.replace(s.h.from,'replacement-worker')});
      if(mutation==='current-run') data.comments[717].push({...data.comments[717][0],id:90,
        body:data.comments[717][0].body.replace(s.h.claim_run,'999999')});
      if(mutation==='executor-admin') s.permissions.admin='write';
      if(mutation==='author-admin') s.permissions['haseatsu114514-dot']='write';
      if(mutation==='closed') data.issues[0].state='closed';
      if(mutation==='blocked') data.issues[0].labels=['blocked'];
      if(mutation==='source-run') s.runs[s.h.claim_run]={status:'completed',conclusion:'cancelled'};
    }});
    await assert.rejects(s.recover());
    assert.equal(enumerations,2);assert.equal(ledgerWrites(s).length,0);
    assert.equal(s.writes.length,0);
  });
}

test('owner recovery performs no repository-wide enumeration after final point reads',async()=>{
  const s=ownerRecoverySetup();await s.recover();
  const names=s.calls.map(c=>c.name);
  const lastEnumeration=Math.max(names.lastIndexOf('pulls'),names.lastIndexOf('listForRepo'));
  const write=names.indexOf('createComment');
  const final=names.slice(lastEnumeration+1,write);
  assert.ok(lastEnumeration<write);
  for(const name of ['get','permission','getComment','listComments','run']) assert.ok(final.includes(name),name);
  assert.equal(final.filter(name=>name==='permission').length,2);
  assert.ok(!final.some(name=>['pulls','listForRepo'].includes(name)));
  assert.equal(ledgerWrites(s).length,1);
});

// Integration guards: repository-wide scans must precede final target reads.
for (const mutation of ['owner','run','offer-body','offer-edited-at','source-run','permission','issue','head']) {
  test(`pickup refuses ${mutation} changed during final PR enumeration`, async () => {
    let scans=0, armed=false;
    const permissions={admin:'write',successor:'write'};
    const s=handoffSetup({permissions,hook(name,args,data) {
      if (!armed || name!=='pulls' || ++scans!==2) return;
      const c=data.comments[1].at(-1);
      if(mutation==='owner') c.body=c.body.replace('owner=worker-A','owner=other-worker');
      if(mutation==='run') c.body=c.body.replace('id=901','id=999');
      if(mutation==='offer-body') c.body+='\nOffer withdrawn.';
      if(mutation==='offer-edited-at') c.updated_at='2026-10-20T12:00:00Z';
      if(mutation==='source-run') s.runs[800]={status:'completed',conclusion:'cancelled'};
      if(mutation==='permission') permissions.admin='read';
      if(mutation==='issue') data.issues[0].state='closed';
      if(mutation==='head') data.prs[0].head.sha='b'.repeat(40);
    }});
    await handoff(s);armed=true;
    await assert.rejects(pickup(s));assert.equal(s.writes.length,1);
  });
}

for (const mutation of ['owner','run','actor','source-run','permission','issue','head']) {
  test(`handoff refuses ${mutation} changed during final PR enumeration`, async () => {
    let scans=0;
    const permissions={admin:'write',successor:'write'};
    const s=handoffSetup({permissions,hook(name,args,data) {
      if(name!=='pulls'||++scans!==2)return;
      const c=data.comments[1].at(-1);
      if(mutation==='owner')c.body=c.body.replace('owner=worker-A','owner=other-worker');
      if(mutation==='run')c.body=c.body.replace('id=800','id=999');
      if(mutation==='actor')c.body=c.body.replace('login=admin','login=other');
      if(mutation==='source-run')s.runs[800]={status:'completed',conclusion:'cancelled'};
      if(mutation==='permission')permissions.admin='read';
      if(mutation==='issue')data.issues[0].state='closed';
      if(mutation==='head')data.prs[0].head.sha='b'.repeat(40);
    }});
    await assert.rejects(handoff(s));assert.equal(s.writes.length,0);
  });
}

for (const operation of ['claim','park','resume','release','transfer']) {
  for (const mutation of ['body','edited-at','permission']) {
    test(`${operation} refuses a revoked comment request before ledger write: ${mutation}`,async()=>{
      const request={id:55,user:{login:'admin'},issue_url:fixture(1).url,body:'/issue-claim original',updated_at:'before'};
      const s=operation==='transfer'?transferSetup():parkingSetup();
      s.approvals[55]=structuredClone(request);s.context.verifiedRequest=request;
      // This models an accepted request that is revoked before the mutation.
      if(mutation==='body')s.approvals[55].body='canceled';
      if(mutation==='edited-at')s.approvals[55].updated_at='after';
      if(mutation==='permission') {
        const original=s.github.rest.repos.getCollaboratorPermissionLevel;
        s.github.rest.repos.getCollaboratorPermissionLevel=async a=>a.username==='admin'?{data:{permission:'read'}}:original(a);
      }
      if(operation==='claim')s.comments[1]=[];
      if(operation==='resume') {
        const c=s.comments[1][0];
        c.body+='\n<!-- issue-claim-wait:v1 '+JSON.stringify({prs:[{number:s.prs[0].number,head:s.prs[0].head.sha}]})+' -->';
      }
      const action=operation==='transfer'?()=>transfer(s):()=>s.run(operation,1,'worker-A',
        ['park','resume'].includes(operation)?{CLAIM_RUN:'800'}:{});
      await assert.rejects(action);assert.equal(s.writes.length,0);
    });
  }
}

for (const mutation of ['owner','run','source-run','actor-permission','author-permission']) {
  test(`transfer refuses ${mutation} changed during final PR enumeration`,async()=>{
    let scans=0;
    const permissions={admin:'admin',oldUser:'admin'};
    const s=transferSetup({permissions,hook(name,args,data){
      if(name!=='pulls'||++scans!==2)return;
      if(mutation==='owner')data.comments[1][0].body=data.comments[1][0].body.replace('owner=worker-A','owner=other-worker');
      if(mutation==='run')data.comments[1][0].body=data.comments[1][0].body.replace('id=800','id=999');
      if(mutation==='source-run')s.runs[800]={status:'completed',conclusion:'cancelled'};
      if(mutation==='actor-permission')permissions.admin='read';
      if(mutation==='author-permission')permissions.oldUser='read';
    }});
    s.approvals[50].user.login='oldUser';
    await assert.rejects(transfer(s));assert.equal(s.writes.length,0);
  });
}

for (const operation of ['claim','handoff','pickup']) {
  test(`comment ${operation} canceled during worker enumeration cannot write a claim`,async()=>{
    let armed=false;
    const permissions={writer:'write',admin:'write',successor:'write'};
    const request={operation,owner:operation==='pickup'?'worker-B':'worker-A',
      ...(operation==='handoff'?{claim_run:'800',summary:handoffSummary}:{})};
    const claim=handoffEntry();
    if(operation==='handoff')claim.body=claim.body.replace('login=admin','login=writer');
    const s=commentSetup(request,{permissions,comments:operation==='claim'?{}:{1:[claim]},
      prs:operation==='claim'?[]:[savedPR()],hook(name){
        if(armed&&name==='listForRepo')s.approvals[50].body='Canceled by requester';
      }});
    if(operation==='pickup')await handoff(s);
    const before=s.writes.length;armed=true;
    // Handoff does not enumerate workers; revoke during its final PR scan instead.
    if(operation==='handoff') {
      const original=s.github.rest.pulls.list;
      s.github.rest.pulls.list=async args=>{const result=await original(args);s.approvals[50].body='Canceled by requester';return result;};
    }
    await assert.rejects(runComment(s),/Request comment changed/);
    assert.equal(s.writes.slice(before).filter(w=>w.body.startsWith('<!-- issue-claim:v1')).length,0);
  });
}

test('a revoked claim request cannot auto-release completed work during availability scans',async()=>{
  const s=commentSetup({operation:'claim',issue:1,owner:'worker-A'}, {
    issues:[fixture(1),fixture(2,{state:'closed',state_reason:'completed'})],
    comments:{2:[modernEntry('worker-A','800')]},
    prs:[{...savedPR(),body:'Refs #2',state:'closed',merged_at:'2026-10-20T00:00:00Z',base:{ref:'main'}}],
    hook(name,args){if(name==='pulls'&&args.state==='all')s.approvals[50].body='Canceled during completion scan';}
  });
  await assert.rejects(runComment(s),/Request comment changed/);
  assert.equal(s.writes.filter(w=>w.body.startsWith('<!-- issue-claim:v1')).length,0);
});

test('pickup rejects duplicate checkpoint markers rather than accepting the first offer',async()=>{
  const s=handoffSetup();await handoff(s);
  const c=s.comments[1].at(-1);c.body+='\n'+c.body.match(/^<!-- issue-claim-wait:v1 .+ -->$/m)[0];
  await assert.rejects(pickup(s),/Invalid waiting checkpoint/);assert.equal(s.writes.length,1);
});

test('ordinary transfer rechecks source actor changed during final PR enumeration',async()=>{
  let scans=0;
  const source={status:'completed',conclusion:'success',actor:{login:'oldUser'}};
  const s=transferSetup({permissions:{oldUser:'write',newUser:'write'},runs:{800:source},hook(name){
    if(name==='pulls'&&++scans===2)source.actor.login='otherUser';
  }});
  s.context.actor='newUser';s.approvals[50].user.login='oldUser';
  await assert.rejects(transfer(s),/original claim actor/);assert.equal(s.writes.length,0);
});

test('a deleted offer cannot authorize pickup from an older active reservation',async()=>{
  const s=handoffSetup();await handoff(s);s.comments[1].pop();
  await assert.rejects(pickup(s),/No handoff-ready/);assert.equal(s.writes.length,1);
});

test('a deleted pickup request during the final PR scan leaves the offer intact',async()=>{
  let scans=0,armed=false;
  const request={id:55,user:{login:'successor'},issue_url:fixture(1).url,body:'/issue-claim pickup'};
  const s=handoffSetup({approvals:{55:structuredClone(request)},hook(name){
    if(armed&&name==='pulls'&&++scans===2)delete s.approvals[55];
  }});
  await handoff(s);s.context.verifiedRequest=request;armed=true;
  await assert.rejects(pickup(s),/Approval not found/);assert.equal(s.writes.length,1);
});

const mergeHandoffPRs = s => {
  for (const pr of s.prs) { pr.state='closed';pr.merged_at='2026-10-20T00:00:00Z'; }
};
const cancelHandoff = s => {
  s.context.runId=903;
  return s.run('resume',1,'worker-A',{CLAIM_RUN:'901'});
};

test('the original owner cancels an unconsumed handoff after every saved PR merges unchanged',async()=>{
  const s=handoffSetup({prs:[savedPR(),savedPR(12)]});
  await handoff(s);mergeHandoffPRs(s);await cancelHandoff(s);
  assert.equal(s.writes.length,2);
  assert.match(s.writes.at(-1).body,/state=claimed owner=worker-A/);
  assert.doesNotMatch(s.writes.at(-1).body,/issue-claim-wait/);
  await s.run('status',1,'worker-A',{CLAIM_RUN:'903'});
  await assert.rejects(pickup(s),/No handoff-ready/);
});

test('ordinary review-wait resume still requires an Open PR after its saved PR merges',async()=>{
  const s=parkingSetup();await park(s);mergeHandoffPRs(s);
  await assert.rejects(cancelHandoff(s),/requires saved same-repository Open PR/);
  assert.equal(s.writes.length,1);
});

for (const mutation of ['missing','closed-unmerged','fork','head','new-pr','actor','failed-handoff','cancelled-source','other-active','consumed']) {
  test(`merged handoff cancellation refuses unsafe checkpoint: ${mutation}`,async()=>{
    const s=handoffSetup();await handoff(s);mergeHandoffPRs(s);
    if(mutation==='missing')s.prs.length=0;
    if(mutation==='closed-unmerged')s.prs[0].merged_at=null;
    if(mutation==='fork')s.prs[0].head.repo.full_name='other/game';
    if(mutation==='head')s.prs[0].head.sha='b'.repeat(40);
    if(mutation==='new-pr')s.prs.push(savedPR(12));
    if(mutation==='actor')s.context.actor='successor';
    if(mutation==='failed-handoff')s.runs[901]={status:'completed',conclusion:'failure'};
    if(mutation==='cancelled-source')s.runs[800]={status:'completed',conclusion:'cancelled'};
    if(mutation==='other-active')s.comments[2]=[modernEntry('worker-A','700')];
    if(mutation==='consumed')await pickup(s);
    const before=s.writes.length;
    await assert.rejects(cancelHandoff(s));assert.equal(s.writes.length,before);
  });
}

for (const mutation of ['missing','closed-unmerged','fork','head','new-pr','owner','run','offer','issue','failed-handoff','cancelled-source','permission','request']) {
  test(`merged handoff cancellation rechecks ${mutation} after worker enumeration`,async()=>{
    let armed=false,scans=0;
    const permissions={admin:'write',successor:'write'};
    const request={id:55,user:{login:'admin'},issue_url:fixture(1).url,body:'/issue-claim resume'};
    const s=handoffSetup({permissions,approvals:{55:structuredClone(request)},hook(name,args,data){
      if(!armed||name!=='pulls'||++scans!==2)return;
      const c=data.comments[1].at(-1);
      if(mutation==='missing')data.prs.length=0;
      if(mutation==='closed-unmerged')data.prs[0].merged_at=null;
      if(mutation==='fork')data.prs[0].head.repo.full_name='other/game';
      if(mutation==='head')data.prs[0].head.sha='b'.repeat(40);
      if(mutation==='new-pr')data.prs.push(savedPR(12));
      if(mutation==='owner')c.body=c.body.replace('owner=worker-A','owner=other-worker');
      if(mutation==='run')c.body=c.body.replace('id=901','id=999');
      if(mutation==='offer')c.body+='\nOffer withdrawn.';
      if(mutation==='issue')data.issues[0].state='closed';
      if(mutation==='failed-handoff')s.runs[901]={status:'completed',conclusion:'cancelled'};
      if(mutation==='cancelled-source')s.runs[800]={status:'completed',conclusion:'cancelled'};
      if(mutation==='permission')permissions.admin='read';
      if(mutation==='request')s.approvals[55].body='Resume canceled';
    }});
    await handoff(s);mergeHandoffPRs(s);s.context.verifiedRequest=request;armed=true;
    await assert.rejects(cancelHandoff(s));assert.equal(s.writes.length,1);assert.equal(scans,2);
  });
}

test('a failed cancellation run retains ownership but cannot authorize editing',async()=>{
  const s=handoffSetup();await handoff(s);mergeHandoffPRs(s);await cancelHandoff(s);
  s.runs[903]={status:'completed',conclusion:'cancelled'};
  await assert.rejects(s.run('status',1,'worker-A',{CLAIM_RUN:'903'}),/did not succeed/);
  await assert.rejects(pickup(s),/No handoff-ready/);
  assert.equal(s.writes.length,2);
});

// #769 is an independent implementation task; it does not transfer #711 here.
const issue711Target = [711,'codex-711-20261019-588761470c34','39273098251',742,'2224b428b341ee58680caf46dba550c6cb4794b7'];
function issue711RecoverySetup(options = {}) {
  const s=ownerRecoverySetup(issue711Target,options);
  s.h.approval_issue=769;
  s.h.known_active_observed=false;
  s.h.consent_evidence='Owner question: 保存済みのPRを保全してAが引き継ぎ、取消CIの原因を解消してマージまで進めていい？ 未保存分は回収できる保証がありません。 Answers: 742は再開したい / すすめてよい';
  s.approvalBody=()=>{
    s.approvals[50].body=`<!-- issue-711-owner-recovery:v1 ${JSON.stringify(s.h)} -->\n`+
      `I authorize ${s.h.to} to resume saved PR #742 for Issue #711 under #769 and accept loss of unknown/unrecoverable uncommitted and unpushed work; stopped and pushed remain unknown.\n`+
      s.h.scope+'\n'+s.h.consent_evidence;
  };
  s.approvalBody();return s;
}
for(const route of ['dispatch','comment']) test(`711 independent recovery succeeds via ${route}, preserves unknowns and rejects replay`,async()=>{
  const s=issue711RecoverySetup();if(route==='comment') recoveryComment(s);
  const before=structuredClone({claim:s.comments[711][0],prs:s.prs,approval:s.approvals[50]});
  await s.recover();
  const writes=ledgerWrites(s);assert.equal(writes.length,1);
  const audit=JSON.parse(writes[0].body.match(/<!-- issue-711-owner-recovery-audit:v1 (.+) -->/)[1]);
  assert.deepEqual(audit,{...s.h,approval_comment:50});
  for(const key of ['stopped','pushed','unsaved_work']) assert.equal(audit[key],'unknown');
  assert.equal(audit.known_active_observed,false);
  assert.doesNotMatch(writes[0].body,/issue-owner-recovery-audit:|"(?:stopped|pushed)":true|state=released/);
  assert.deepEqual(s.comments[711][0],before.claim);assert.deepEqual(s.prs,before.prs);
  assert.deepEqual(s.approvals[50],before.approval);
  if(route==='comment') await s.recover();else await assert.rejects(s.recover());
  assert.equal(ledgerWrites(s).length,1);
  await s.run('status',711,s.h.to,{CLAIM_RUN:'901'});
});

for(const change of ['673','738','717','769','repo','record-repo','from','run','input-run','head','pr','to','same-worker','approval-issue',
  'loss','consent','evidence','scope','no-prose','extra','legacy','missing','duplicate','malformed','mixed-745','mixed-handoff',
  'author','actor-read','actor-write','author-write','permission-error','closed','blocked','source-failed','source-pending',
  'claim-owner','claim-run','claim-released','fork','extra-pr','no-pr','other-active','other-closed','other-handoff','wrong-thread']) {
  test(`711 independent recovery refuses ${change} and preserves original claim`,async()=>{
    const s=issue711RecoverySetup(),h=s.h;
    const before=structuredClone(s.comments[711][0]);
    if(['673','738','717','769'].includes(change)) {
      s.input.ISSUE=change;s.issues[0].number=Number(change);h.issue=Number(change);
    }
    if(change==='repo') s.context.repo.repo='other';
    if(change==='record-repo') h.repo='other/repo';
    if(change==='from') h.from='other-worker';
    if(change==='run') h.claim_run='800';
    if(change==='input-run') s.input.CLAIM_RUN='800';
    if(change==='head') h.prs[0].head='b'.repeat(40);
    if(change==='pr') h.prs[0].number=743;
    if(change==='to') h.to='other-worker';
    if(change==='same-worker') h.to=s.input.OWNER=h.from;
    if(change==='approval-issue') h.approval_issue=745;
    if(change==='loss') h.accept_loss=false;
    if(change==='consent') h.consent='approved';
    if(change==='evidence') h.consent_evidence='An admin said that recovery was authorized.';
    if(change==='scope') h.scope='Only saved work is in scope, without any loss statement.';
    if(change==='extra') h.extra=true;
    if(change==='legacy') h.recovery={claim_comment:1,released_comment:2};
    s.approvalBody();
    if(change==='no-prose') s.approvals[50].body=s.approvals[50].body.split('\n')[0];
    if(change==='missing') s.approvals[50].body='Approved';
    if(change==='duplicate') s.approvals[50].body+='\n'+s.approvals[50].body.split('\n')[0];
    if(change==='malformed') s.approvals[50].body+='\n<!-- issue-711-owner-recovery:v1 broken';
    if(change==='mixed-745') s.approvals[50].body+='\n<!-- issue-owner-recovery:v1 {} -->';
    if(change==='mixed-handoff') s.approvals[50].body+='\n<!-- issue-handoff:v1 {} -->';
    if(change==='author') s.approvals[50].user.login='otherAdmin';
    if(change==='actor-read') s.permissions.admin='read';
    if(change==='actor-write') s.permissions.admin='write';
    if(change==='author-write') s.permissions['haseatsu114514-dot']='write';
    if(change==='permission-error') s.github.rest.repos.getCollaboratorPermissionLevel=async()=>{throw Error('permission unknown');};
    if(change==='closed') s.issues[0].state='closed';
    if(change==='blocked') s.issues[0].labels=['blocked'];
    if(change==='source-failed') s.runs[h.claim_run]={status:'completed',conclusion:'failure'};
    if(change==='source-pending') s.runs[h.claim_run]={status:'in_progress',conclusion:null};
    if(change==='claim-owner') s.comments[711][0].body=before.body.replace(h.from,'other-worker');
    if(change==='claim-run') s.comments[711][0].body=before.body.replace(h.claim_run,'800');
    if(change==='claim-released') s.comments[711][0].body=before.body.replace('state=claimed','state=released');
    if(change==='fork') s.prs[0].head.repo.full_name='other/repo';
    if(change==='extra-pr') s.prs.push({...s.prs[0],number:999});
    if(change==='no-pr') s.prs.length=0;
    if(['other-active','other-closed','other-handoff'].includes(change)) {
      s.comments[999]=[entry('claimed',h.to)];
      if(change==='other-closed') s.issues[1].state='closed';
      if(change==='other-handoff') s.comments[999][0].body+='\n<!-- issue-claim-wait:v1 '+JSON.stringify({prs:[{number:999,head:'a'.repeat(40)}],handoff:{version:1,from:h.to,actor:'admin',source_run:'800',stopped:true,pushed:true,summary:'Saved work.'}})+' -->';
    }
    if(change==='wrong-thread') s.approvals[50].issue_url=fixture(999).url;
    const current=structuredClone(s.comments);
    await assert.rejects(s.recover());assert.equal(s.writes.length,0);assert.deepEqual(s.comments,current);
  });
}
for(const key of ['stopped','pushed','unsaved_work','known_active_observed']) {
  const values=key==='known_active_observed'?[true,'false','unknown',null,undefined]:[true,false,null,undefined];
  for(const value of values) test(`711 strictly rejects ${key}=${String(value)}`,async()=>{
    const s=issue711RecoverySetup();s.h[key]=value;s.approvalBody();
    await assert.rejects(s.recover());assert.equal(s.writes.length,0);
    assert.equal(s.comments[711].length,1);
  });
}

for(const stage of ['last-worker-scan','final-pr-scan']) for(const change of ['approval','author','timestamp','permission','owner','run','claim-comment','source','closed','known-active']) {
  test(`711 revalidates ${change} changed during ${stage}`,async()=>{
    let scans=0;
    const s=issue711RecoverySetup({hook(name,args,data){
      if(name!==(stage==='last-worker-scan'?'listForRepo':'pulls')||++scans!==2) return;
      if(change==='approval') s.approvals[50].body+='\nConsent revoked';
      if(change==='author') s.approvals[50].user.login='otherAdmin';
      if(change==='timestamp') s.approvals[50].updated_at='later';
      if(change==='permission') s.permissions.admin='write';
      if(change==='owner') data.comments[711][0].body=data.comments[711][0].body.replace(s.h.from,'other-worker');
      if(change==='run') data.comments[711][0].body=data.comments[711][0].body.replace(s.h.claim_run,'800');
      if(change==='claim-comment') data.comments[711].push({...data.comments[711][0],id:99});
      if(change==='source') s.runs[s.h.claim_run]={status:'completed',conclusion:'cancelled'};
      if(change==='closed') data.issues[0].state='closed';
      if(change==='known-active') {s.h.known_active_observed=true;s.approvalBody();}
    }});
    await assert.rejects(s.recover());assert.equal(scans,2);assert.equal(s.writes.length,0);
  });
}
for(const change of ['head','pr-set','availability']) test(`711 refuses changed ${change} during last worker scan`,async()=>{
  let scans=0;
  const s=issue711RecoverySetup({hook(name,args,data){
    if(name!=='listForRepo'||++scans!==2) return;
    if(change==='head') data.prs[0].head.sha='b'.repeat(40);
    if(change==='pr-set') data.prs.push({...data.prs[0],number:999});
    if(change==='availability') data.comments[999]=[entry('claimed',s.h.to)];
  }});
  await assert.rejects(s.recover());assert.equal(s.writes.length,0);
});
test('711 completes all enumeration before final target evidence reads',async()=>{
  const s=issue711RecoverySetup();await s.recover();
  const names=s.calls.map(c=>c.name),last=Math.max(names.lastIndexOf('pulls'),names.lastIndexOf('listForRepo'));
  const final=names.slice(last+1,names.indexOf('createComment'));
  for(const name of ['get','permission','getComment','listComments','run']) assert.ok(final.includes(name),name);
  assert.equal(final.filter(n=>n==='permission').length,2);
  assert.equal(ledgerWrites(s).length,1);
});
test('711 write failure leaves original reservation intact',async()=>{
  const s=issue711RecoverySetup({hook(name){if(name==='createComment') throw Error('write denied');}});
  const before=structuredClone(s.comments);
  await assert.rejects(s.recover(),/write denied/);assert.equal(s.writes.length,0);assert.deepEqual(s.comments,before);
});
for(const failure of ['cancelled','failure','summary']) test(`711 post-write ${failure} retains protected reservation without authorizing editing`,async()=>{
  const s=issue711RecoverySetup();
  if(failure==='summary') {
    s.core.summary.write=async()=>{throw Error('summary failed');};
    await assert.rejects(s.recover(),/summary failed/);
  } else await s.recover();
  s.runs[901]={status:'completed',conclusion:failure==='summary'?'failure':failure};
  await assert.rejects(s.run('status',711,s.h.to,{CLAIM_RUN:'901'}),/did not succeed/);
  await assert.rejects(s.run('claim',711,'third-worker'),/Already claimed/);
  await assert.rejects(s.recover());assert.equal(ledgerWrites(s).length,1);
});
test('711 mutating comment rerun is refused without ledger write',async()=>{
  const s=issue711RecoverySetup();recoveryComment(s);s.context.runAttempt=2;
  await assert.rejects(s.recover(),/Do not rerun/);assert.equal(s.writes.length,0);
});
test('711 comment permission refusal only adds a request receipt',async()=>{
  const s=issue711RecoverySetup();recoveryComment(s);s.permissions.admin='write';
  await assert.rejects(s.recover(),/admin/);assert.equal(ledgerWrites(s).length,0);
  assert.equal(s.writes.length,1);assert.match(s.writes[0].body,/Request refused/);
  assert.equal(s.comments[711][0].body.includes(issue711Target[1]),true);
});
test('745 marker cannot authorize 711 and mixed 711 marker cannot authorize 745 targets',async()=>{
  const s=ownerRecoverySetup(issue711Target);
  await assert.rejects(s.recover());assert.equal(s.writes.length,0);
  const t=ownerRecoverySetup();t.approvals[50].body+='\n<!-- issue-711-owner-recovery:v1 {} -->';
  await assert.rejects(t.recover());assert.equal(t.writes.length,0);
});
for(const valid of [true,false]) test(`711 ${valid?'accepts valid':'rejects stale'} parked worker checkpoint`,async()=>{
  const s=issue711RecoverySetup();
  const waiting=modernEntry(s.h.to,700);
  waiting.body+='\n<!-- issue-claim-wait:v1 '+JSON.stringify({prs:[{number:998,head:savedHead}]})+' -->';
  s.comments[999]=[waiting];
  s.prs.push(savedPR(998,999,{head:{sha:valid?savedHead:'b'.repeat(40),repo:{full_name:recoveryRepo}}}));
  if(valid) {await s.recover();assert.equal(ledgerWrites(s).length,1);}
  else {await assert.rejects(s.recover(),/Waiting PR checkpoint changed/);assert.equal(s.writes.length,0);}
  assert.deepEqual(s.comments[999],[waiting]);
});
test('711 rechecks comment request immutability immediately before writing',async()=>{
  let scans=0;
  const s=issue711RecoverySetup({hook(name){
    if(name==='pulls'&&++scans===2) s.approvals[60].body+=' ';
  }});
  recoveryComment(s);
  await assert.rejects(s.recover(),/Request comment changed/);
  assert.equal(ledgerWrites(s).length,0);assert.equal(s.comments[711][0].body.includes(s.h.from),true);
});
