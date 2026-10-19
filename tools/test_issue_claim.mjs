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
    const values = {OPERATION: op, ISSUE: String(number), OWNER: owner, AGENT: 'codex', REQUEST_ID: '', CLAIM_RUN: '', HANDOFF_COMMENT: '', ...input};
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
