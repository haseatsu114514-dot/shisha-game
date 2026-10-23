import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require = createRequire(import.meta.url);
const {coordinate, runEvent, parseCommentRequest, OPERATIONS, KNOWN_SIGNATURES} = require('./issue_claim_coordinator.cjs');

const bot = {login:'github-actions[bot]', type:'Bot'};
const repo = {owner:'example', repo:'game'};
const url = 'https://api.github.com/repos/example/game/issues/42';
const entry = (state, owner = 'worker-one', extra = {}) => ({id:1, user:bot,
  body:'<!-- issue-claim:v2 ' + JSON.stringify({state, owner, actor:'writer', run:'100', request:'request-one', ...extra}) + ' -->\nrecord'});
function fixture() {
  const state = {issues:new Map([42, 43].map(number => [number, {number, state:'open', labels:[], url:url.replace('42', String(number))}])),
    comments:new Map([[42, []], [43, []]]), writes:[], permissions:new Map(), notices:[], calls:[]};
  const context = {repo, actor:'writer', runId:200, runAttempt:1, eventName:'workflow_dispatch', ref:'refs/heads/main',
    payload:{repository:{default_branch:'main'}}};
  const listComments = Symbol('listComments');
  const github = {
    paginate:async (endpoint, args) => {
      assert.equal(endpoint, listComments, 'only target-Issue comments may be enumerated');
      assert.equal(args.per_page, 100);
      state.calls.push(['comments', args.issue_number]);
      // Returning the entire collection represents Octokit's all-page pagination.
      return structuredClone(state.comments.get(args.issue_number) || []);
    },
    rest:{issues:{listComments,
      get:async args => ({data:structuredClone(state.issues.get(args.issue_number))}),
      getComment:async args => ({data:structuredClone([...state.comments.values()].flat().find(c => c.id === args.comment_id))}),
      createComment:async args => {
        const comment = {id:1000 + state.writes.length, user:bot, body:args.body};
        state.comments.get(args.issue_number).push(comment); state.writes.push({...args});
        return {data:comment};
      }}, repos:{getCollaboratorPermissionLevel:async args => ({data:{permission:state.permissions.get(args.username) || 'write'}})}}
  };
  const core = {notice:value => state.notices.push(value), summary:{addRaw() {return this;}, async write() {}}};
  const inputs = {OPERATION:'claim', ISSUE:'42', OWNER:'worker-one', REQUEST_ID:'request-new'};
  const execute = (overrides = {}) => coordinate(github, context, core, {...inputs, ...overrides});
  const comment = (request, overrides = {}) => {
    const comment = {id:50, user:{login:'writer', type:'User'}, body:'/issue-claim ' + JSON.stringify(request), issue_url:url, updated_at:'now', ...overrides};
    state.comments.get(42).push(comment);
    context.eventName = 'issue_comment'; context.payload.action = 'created';
    context.payload.issue = state.issues.get(42); context.payload.comment = structuredClone(comment);
    return comment;
  };
  return {state, context, github, core, inputs, execute, comment};
}

test('claim → handoff → new claim → release; handoff preserves the saved-work summary', async () => {
  const f = fixture(); await f.execute();
  assert.match(f.state.notices[0], /^CLAIMED_ISSUE=42 OWNER=worker-one$/);
  f.context.runId++; await f.execute({OPERATION:'handoff', REQUEST_ID:'request-handoff', SUMMARY:'PR #99 branch saved\nDONE / TODO / TEST / NEXT'});
  assert.match(f.state.writes[1].body, /"state":"handoff"/);
  assert.match(f.state.writes[1].body, /> PR #99 branch saved\n> DONE \/ TODO \/ TEST \/ NEXT/);
  f.context.runId++; f.context.actor = 'successor';
  await f.execute({OWNER:'worker-two', REQUEST_ID:'request-successor'});
  f.context.runId++; await f.execute({OPERATION:'release', OWNER:'worker-two', REQUEST_ID:'request-release'});
  assert.match(f.state.writes[3].body, /"state":"released"/);
});

test('all old v1 claims, waiting checkpoints and recovery records are ignored without deletion', async () => {
  const f = fixture();
  const old = {id:8, user:bot, body:'<!-- issue-claim:v1 state=claimed owner=old-worker -->\n<!-- issue-claim-wait:v1 broken-old-checkpoint -->\n<!-- issue-673-owner-recovery:v1 {} -->'};
  f.state.comments.get(42).push(old);
  await f.execute();
  assert.deepEqual(f.state.comments.get(42)[0], old);
  assert.equal(f.state.writes.length, 1);
});

test('v2 claims stay exclusive for both a different worker and the same worker', async () => {
  for (const owner of ['worker-one', 'worker-other']) {
    const f = fixture(); f.state.comments.get(42).push(entry('claimed'));
    await assert.rejects(f.execute({OWNER:owner}), /Already claimed/);
    assert.equal(f.state.writes.length, 0);
  }
});

test('release and handoff require the current worker and original requesting account', async () => {
  for (const op of ['release', 'handoff']) {
    for (const changed of ['owner', 'actor', 'released', 'missing']) {
      const f = fixture();
      if (changed !== 'missing') f.state.comments.get(42).push(entry(changed === 'released' ? 'released' : 'claimed'));
      if (changed === 'actor') f.context.actor = 'another-writer';
      await assert.rejects(f.execute({OPERATION:op, OWNER:changed === 'owner' ? 'worker-other' : 'worker-one',
        SUMMARY:op === 'handoff' ? 'saved PR #99; next: tests' : ''}), /Only the current owner/);
      assert.equal(f.state.writes.length, 0);
    }
  }
});

test('same owner can claim separate Issues independently; no all-Issue or PR APIs are called', async () => {
  const f = fixture(); await f.execute(); f.context.runId++;
  await f.execute({ISSUE:'43'});
  assert.deepEqual(f.state.calls, [['comments',42], ['comments',43]]);
  assert.deepEqual(f.state.writes.map(write => write.issue_number), [42,43]);
});

test('latest bot v2 record wins across all pages; forged human records cannot release a claim', async () => {
  const f = fixture();
  f.state.comments.get(42).push(entry('released'));
  for (let id = 2; id <= 105; id++) f.state.comments.get(42).push({id, user:{login:'writer'}, body:'ordinary comment'});
  f.state.comments.get(42).push({...entry('claimed'), id:106}, {...entry('released'), id:107, user:{login:'writer'}});
  await assert.rejects(f.execute(), /Already claimed/);
});

test('claims reject closed/blocked Issues and PRs, while closed-Issue release and handoff work', async () => {
  for (const change of [{state:'closed'}, {labels:['blocked']}, {labels:[{name:'status:blocked'}]}, {pull_request:{}}]) {
    const f = fixture(); Object.assign(f.state.issues.get(42), change);
    await assert.rejects(f.execute(), /open, unblocked|not a PR/);
  }
  for (const op of ['release', 'handoff']) {
    const f = fixture(); f.state.issues.get(42).state = 'closed'; f.state.comments.get(42).push(entry('claimed'));
    await f.execute({OPERATION:op, SUMMARY:op === 'handoff' ? 'saved PR #99' : ''});
  }
});

test('only the three operations remain and invalid identifiers cannot create alternate queues', async () => {
  assert.deepEqual(OPERATIONS, ['claim', 'release', 'handoff']);
  for (const op of ['next', 'park', 'resume', 'transfer', 'pickup', 'maintain', 'status', 'recovery']) {
    const f = fixture(); await assert.rejects(f.execute({OPERATION:op}), /Use claim, release or handoff/);
    assert.equal(f.state.writes.length, 0);
  }
  for (const issue of ['0', '01', ' 42', '+42', '4.2', '9007199254740992']) {
    await assert.rejects(fixture().execute({ISSUE:issue}), /Invalid Issue/);
  }
  await assert.rejects(fixture().execute({OWNER:'x'}), /Invalid owner/);
  await assert.rejects(fixture().execute({REQUEST_ID:'bad request'}), /Invalid request/);
});

test('handoff summary is mandatory, bounded, and cannot inject ledger markers', async () => {
  for (const summary of ['', ' ', 'x'.repeat(1201), '<!-- issue-claim:v2 {} -->']) {
    await assert.rejects(fixture().execute({OPERATION:'handoff', SUMMARY:summary}), /summary/);
  }
  await assert.rejects(fixture().execute({SUMMARY:'extra'}), /summary/);
  const f = fixture(); f.state.comments.get(42).push(entry('claimed'));
  await f.execute({OPERATION:'handoff', SUMMARY:'x'.repeat(1200)});
});

test('recorded request IDs, same run and reruns never append a second ledger write', async () => {
  for (const kind of ['request', 'run', 'attempt']) {
    const f = fixture();
    if (kind === 'attempt') f.context.runAttempt = 2;
    else f.state.comments.get(42).push(entry('released', 'worker-one', kind === 'request' ? {request:'request-new'} : {run:'200'}));
    await assert.rejects(f.execute(), /already recorded|rerunning/);
    assert.equal(f.state.writes.length, 0);
  }
});

test('permission denial and non-default-branch dispatch never write', async () => {
  const f = fixture(); f.state.permissions.set('writer', 'read');
  await assert.rejects(runEvent(f.github, f.context, f.core, f.inputs), /write permission/);
  f.state.permissions.set('writer', 'write'); f.context.ref = 'refs/heads/feature';
  await assert.rejects(runEvent(f.github, f.context, f.core, f.inputs), /default branch/);
  assert.equal(f.state.writes.length, 0);
});

test('comment commands accept one known integration signature and reject extra JSON/fields', () => {
  const body = '/issue-claim {"operation":"claim","owner":"worker-one"}';
  assert.equal(parseCommentRequest(body + KNOWN_SIGNATURES[0]).operation, 'claim');
  for (const value of [body + '\n{}', body + KNOWN_SIGNATURES[0] + KNOWN_SIGNATURES[0],
      '/issue-claim {"operation":"claim","owner":"worker-one","claim_run":"1"}',
      '/issue-claim []', '/issue-claim {"summary":{}}', '/issue-claim {"operation":"claim","owner":123}', body + 'x'.repeat(2001)]) {
    assert.throws(() => parseCommentRequest(value));
  }
});

test('Issue comment request writes a claim and receipt once; duplicate delivery is a no-op', async () => {
  const f = fixture(); f.comment({operation:'claim', owner:'worker-one'});
  await runEvent(f.github, f.context, f.core, {});
  assert.equal(f.state.writes.length, 2);
  assert.match(f.state.writes[1].body, /issue-claim-request:v2 comment=50/);
  await runEvent(f.github, f.context, f.core, {});
  assert.equal(f.state.writes.length, 2);
});

test('cross-Issue requests and PR-thread requests are refused before a ledger write', async () => {
  for (const kind of ['cross', 'pr', 'invalid-operation', 'invalid-json']) {
    const f = fixture(); const request = {operation:kind === 'invalid-operation' ? 'status' : 'claim', owner:'worker-one'};
    if (kind === 'cross') request.issue = 43;
    const posted = f.comment(request);
    if (kind === 'pr') f.state.issues.get(42).pull_request = {};
    if (kind === 'invalid-json') {posted.body = '/issue-claim broken'; f.context.payload.comment.body = posted.body;}
    await assert.rejects(runEvent(f.github, f.context, f.core, {}));
    assert.equal(f.state.writes.length, 1);
    assert.match(f.state.writes[0].body, /Request refused:/);
    assert.deepEqual(f.state.calls.every(call => call[1] === 42), true);
  }
});

test('changed request at entry or immediately before write is rejected', async () => {
  for (const late of [false, true]) {
    const f = fixture(); const posted = f.comment({operation:'claim', owner:'worker-one'});
    if (!late) posted.body += ' changed';
    else {
      const get = f.github.rest.issues.get;
      f.github.rest.issues.get = async args => {posted.updated_at = 'edited'; return get(args);};
    }
    await assert.rejects(runEvent(f.github, f.context, f.core, {}), /Request comment changed/);
    assert.equal(f.state.writes.filter(write => write.body.startsWith('<!-- issue-claim:v2 ')).length, 0);
  }
});

test('failure after ledger write preserves claim and cannot be replayed to append another', async () => {
  const f = fixture(); f.core.summary.write = async () => {throw Error('summary failed');};
  await assert.rejects(f.execute(), /summary failed/);
  assert.equal(f.state.writes.length, 1);
  assert.match(f.state.writes[0].body, /"state":"claimed"/);
  await assert.rejects(f.execute(), /already recorded/);
  f.context.runId++; f.core.summary.write = async () => {};
  await f.execute({OPERATION:'release', REQUEST_ID:'request-release'});
  assert.equal(f.state.writes.length, 2);
});

test('workflow queues both entrypoints by target Issue and has no maintenance triggers', () => {
  const workflow = readFileSync(new URL('../.github/workflows/issue-claim.yml', import.meta.url), 'utf8');
  assert.match(workflow, /group: issue-claim-\$\{\{ inputs.issue \|\| github.event.issue.number \}\}/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /options: \[claim, release, handoff\]/);
  assert.doesNotMatch(workflow.split('permissions:')[0], /^  (schedule|push|issues|pull_request):/m);
});

test('comment handoff and successor claim use the same lifecycle as dispatch', async () => {
  const f = fixture(); f.comment({operation:'claim', owner:'worker-one'});
  await runEvent(f.github, f.context, f.core, {});
  f.context.runId++;
  f.comment({operation:'handoff', owner:'worker-one', summary:'PR #99; DONE/TODO/TEST/NEXT'}, {id:51});
  await runEvent(f.github, f.context, f.core, {});
  f.context.runId++;
  f.comment({operation:'claim', owner:'worker-two'}, {id:52, user:{login:'successor', type:'User'}});
  await runEvent(f.github, f.context, f.core, {});
  assert.equal(f.state.writes.length, 6);
  assert.match(f.state.writes[4].body, /"owner":"worker-two","actor":"successor"/);
});

test('read-only users cannot request reservations through comments', async () => {
  const f = fixture(); f.comment({operation:'claim', owner:'worker-one'}); f.state.permissions.set('writer', 'read');
  await assert.rejects(runEvent(f.github, f.context, f.core, {}), /write permission/);
  assert.equal(f.state.writes.length, 0);
});
