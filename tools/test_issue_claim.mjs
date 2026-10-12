import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Execute the actual github-script block, not a second coordinator implementation.
const yaml = readFileSync(new URL('../.github/workflows/issue-claim.yml', import.meta.url), 'utf8');
const lines = yaml.split('\n');
const start = lines.findIndex(line => line.trim() === 'script: |') + 1;
assert.ok(start > 0, 'workflow must contain its inline coordinator');
const scriptLines = [];
for (const line of lines.slice(start)) {
  if (line.trim() && !line.startsWith('            ')) break;
  scriptLines.push(line.slice(12));
}
const execute = new (Object.getPrototypeOf(async function () {}).constructor)(
  'github', 'context', 'core', scriptLines.join('\n'));
const bot = 'github-actions[bot]';
const fixture = (number, extra = {}) => ({number, state: 'open', title: `[P1] Task ${number}`, labels: [], ...extra});
const entry = (state, owner, extra = {}) => ({id: 1, user: {login: bot},
  body: `<!-- issue-claim:v1 state=${state} owner=${owner} -->`, ...extra});

function setup({issues = [fixture(1), fixture(2)], prs = [], comments = {}, runs = {}, hook} = {}) {
  let id = 100;
  const notices = [], writes = [], calls = [];
  const method = (name, fn) => async args => {
    calls.push({name, args});
    await hook?.(name, args, {issues, prs, comments});
    return {data: await fn(args)};
  };
  const github = {rest: {
    issues: {
      get: method('get', a => {
        const issue = issues.find(i => i.number === a.issue_number);
        if (!issue) throw Error('Not found');
        return issue;
      }),
      listForRepo: method('listForRepo', a => issues.filter(i => a.state === 'all' || i.state === a.state)),
      listComments: method('listComments', a => comments[a.issue_number] || []),
      createComment: method('createComment', a => {
        const c = {id: ++id, user: {login: bot}, body: a.body};
        (comments[a.issue_number] ||= []).push(c);
        writes.push(a); return c;
      }),
    },
    pulls: {list: method('pulls', () => prs)},
    actions: {getWorkflowRun: method('run', a => runs[a.run_id] || {status: 'completed', conclusion: 'success'})},
  }, paginate: async (fn, args) => (await fn(args)).data};
  const context = {repo: {owner: 'example.dot', repo: 'game'}, runId: 901, serverUrl: 'https://github.com'};
  const core = {info() {}, notice: text => notices.push(text),
    summary: {addRaw() { return this; }, async write() {}}};
  async function run(op, number = 1, owner = 'worker-A', input = {}) {
    const values = {OPERATION: op, ISSUE: String(number), OWNER: owner, AGENT: 'codex', REQUEST_ID: '', CLAIM_RUN: '', ...input};
    const original = Object.fromEntries(Object.keys(values).map(k => [k, process.env[k]]));
    Object.assign(process.env, values);
    try { return await execute(github, context, core); }
    finally { for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    } }
  }
  return {run, writes, notices, calls, issues, comments, context};
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
