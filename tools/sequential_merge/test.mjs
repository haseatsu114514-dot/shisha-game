import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {evaluate, matches} from './evaluate.mjs';
import {collect, githubReader, LIMITS} from './collect.mjs';
import {simulateSequence} from './simulate.mjs';
import {dryRun} from './dry-run.mjs';
import {fixture, readerFixture, NOW, BASE, HEAD, NEXT} from './fixtures.mjs';

test('synthetic complete evidence only qualifies for recheck, never execution', () => {
  const {snapshot, policy} = fixture();
  const before = JSON.stringify({snapshot, policy});
  assert.deepEqual(evaluate(snapshot, policy, NOW), {status: 'READY_FOR_RECHECK',
    executionEnabled: false, expectedHead: HEAD, validatedBase: BASE,
    applicableJobs: ['.github/workflows/test.yml:unit'], reasons: []});
  assert.equal(JSON.stringify({snapshot, policy}), before, 'pure function must not mutate evidence');
});

const counterexamples = [
  ['empty CI', s => s.checks = [], 'CHECKS_EMPTY'],
  ['missing job', s => s.jobs = [], 'JOB_MISSING_OR_AMBIGUOUS'],
  ['missing run', s => s.runs = [], 'RUN_MISSING'],
  ['stale check', s => s.checks[0].head_sha = BASE, 'CHECK_NOT_SUCCESS'],
  ['forged check app', s => s.checks[0].app.id = 999, 'CHECK_UNTRUSTED_APP'],
  ['forged matching check name', s => s.checks[0].id = 999, 'JOB_CHECK_PROVENANCE'],
  ['foreign check URL', s => s.jobs[0].check_run_url = 'https://api.github.com/repos/attacker/game/check-runs/60', 'JOB_CHECK_PROVENANCE'],
  ['job at wrong head', s => s.jobs[0].head_sha = BASE, 'JOB_CHECK_PROVENANCE'],
  ['old run base', s => s.runs[0].pull_requests[0].base.sha = NEXT, 'RUN_STALE_OR_UNTRUSTED'],
  ['wrong workflow path', s => s.runs[0].path = '.github/workflows/forged.yml', 'RUN_STALE_OR_UNTRUSTED'],
  ['foreign run repo', s => s.runs[0].repository.full_name = 'attacker/game', 'RUN_STALE_OR_UNTRUSTED'],
  ['untrusted event', s => s.runs[0].event = 'pull_request_target', 'RUN_STALE_OR_UNTRUSTED'],
  ['candidate altered workflow', s => s.workflows[0].headBlob = NEXT, 'WORKFLOW_NOT_TRUSTED_MAIN'],
  ['base workflow unknown', s => s.workflows = [], 'WORKFLOW_MISSING_OR_AMBIGUOUS'],
  ['file list empty', s => s.files = [], 'FILES_EMPTY_OR_TRUNCATED'],
  ['file list truncated', s => s.pr.changed_files = 2, 'FILES_EMPTY_OR_TRUNCATED'],
  ['uncovered changed path', s => s.files[0].filename = 'unknown/code.mjs', 'CI_PATH_UNCOVERED'],
  ['stale classifier', s => s.policyBase = NEXT, 'POLICY_NOT_FROM_CURRENT_MAIN'],
  ['head race', s => s.prAfter.head.sha = NEXT, 'HEAD_BASE_CHANGED'],
  ['base race', s => s.mainAfter.commit.sha = NEXT, 'HEAD_BASE_CHANGED'],
  ['head missing latest main', s => s.comparison.merge_base_commit.sha = NEXT, 'HEAD_MISSING_LATEST_MAIN'],
  ['merge conflict', s => s.pr.mergeable = false, 'MERGE_CONFLICT_OR_UNKNOWN'],
  ['unknown merge state', s => s.prAfter.mergeable = null, 'MERGE_CONFLICT_OR_UNKNOWN'],
  ['draft', s => s.pr.draft = true, 'PR_NOT_READY'],
  ['fork', s => s.pr.head.repo.full_name = 'attacker/game', 'PR_SCOPE'],
  ['fetch failed', s => s.errors.push({resource: 'reviews', status: 403}), 'FETCH_FAILED'],
  ['missing page', s => s.complete.reviews = false, 'INCOMPLETE_REVIEWS'],
  ['unresolved thread', s => s.threads.push({isResolved: false}), 'UNRESOLVED_THREAD'],
  ['thread state unknown', s => s.threads.push({}), 'UNRESOLVED_THREAD'],
  ['stale review', s => s.reviews[0].commit_id = BASE, 'REVIEW_STALE'],
  ['no review', s => s.reviews = [], 'INDEPENDENT_REVIEW_MISSING'],
  ['same author account', s => s.pr.user.id = 200, 'INDEPENDENT_REVIEW_MISSING'],
  ['same execution account', s => s.actorId = 200, 'INDEPENDENT_REVIEW_MISSING'],
  ['same worker account', s => s.attestations.ownership.participantIds.push(200), 'INDEPENDENT_REVIEW_MISSING'],
  ['bot review', s => s.reviews[0].user.type = 'Bot', 'INDEPENDENT_REVIEW_MISSING'],
  ['change request', s => s.reviews.push({id: 2, user: {id: 500}, state: 'CHANGES_REQUESTED', commit_id: BASE}), 'CHANGES_REQUESTED'],
  ['explicit hold', s => s.attestations.blockers.hold = true, 'BLOCKERS_PRESENT'],
  ['open dependency', s => s.attestations.blockers.dependenciesComplete = false, 'BLOCKERS_PRESENT'],
  ['unresolved finding', s => s.attestations.blockers.unresolvedFindings = 1, 'BLOCKERS_PRESENT'],
  ['no hold record', s => delete s.attestations.blockers, 'MISSING_OR_STALE_BLOCKERS'],
  ['forged authority', s => s.attestations.blockers.authorId = 123, 'MISSING_OR_STALE_BLOCKERS'],
  ['stale owner', s => s.attestations.ownership.head = BASE, 'MISSING_OR_STALE_OWNERSHIP'],
  ['worker conflict', s => s.attestations.ownership.conflicts.push('other-worker'), 'OWNER_CONFLICT_OR_UNKNOWN'],
  ['owner unknown', s => s.attestations.ownership.owner = '', 'OWNER_CONFLICT_OR_UNKNOWN'],
  ['participants unknown', s => s.attestations.ownership.participantIds = [], 'OWNER_CONFLICT_OR_UNKNOWN'],
  ['no enforced strict base', s => s.attestations.enforcement.strictBase = false, 'SERVER_ENFORCEMENT_MISSING'],
  ['protection bypass unknown', s => delete s.attestations.enforcement.bypassPossible, 'SERVER_ENFORCEMENT_MISSING'],
  ['unprotected main', s => s.mainBefore.protected = false, 'MAIN_UNPROTECTED'],
  ['permissions unknown', s => delete s.attestations.permission, 'MISSING_OR_STALE_PERMISSION'],
  ['permission bypass', s => s.attestations.permission.bypass = true, 'PERMISSION_UNKNOWN'],
  ['old evidence', s => s.startedAt = '2026-10-18T00:00:00Z', 'EVIDENCE_STALE'],
  ['future evidence', s => s.finishedAt = '2027-01-01T00:00:00Z', 'EVIDENCE_STALE'],
  ['other PR rename overlap', s => s.openFiles.push({number: 13, files: [{filename: 'elsewhere', previous_filename: 'src/code.mjs'}]}), 'OTHER_PR_PATH_CONFLICT'],
  ['other PR missing files', s => s.openPulls.push({...s.pr, number: 13}), 'OTHER_PR_FILES_INCOMPLETE'],
  ['unknown other PR HEAD', s => s.openFiles[0].head = null, 'OTHER_PR_FILES_INCOMPLETE'],
  ['empty open PR inventory', s => s.openPulls = [], 'OPEN_PR_INVENTORY_INVALID'],
  ['missing protection fetch', s => s.complete.protection = false, 'INCOMPLETE_PROTECTION'],
];
for (const [name, mutate, code] of counterexamples) test(`deny: ${name}`, () => {
  const {snapshot, policy} = fixture(); mutate(snapshot);
  const result = evaluate(snapshot, policy, NOW);
  assert.equal(result.status, 'BLOCKED'); assert.ok(result.reasons.includes(code), JSON.stringify(result));
});
for (const conclusion of [null, 'cancelled', 'neutral', 'skipped', 'failure', 'timed_out', 'action_required', 'unknown']) {
  test(`deny check conclusion ${conclusion}`, () => {
    const {snapshot, policy} = fixture(); snapshot.checks[0].conclusion = conclusion;
    assert.ok(evaluate(snapshot, policy, NOW).reasons.includes('CHECK_NOT_SUCCESS'));
  });
}
test('pending checks, runs and statuses cannot masquerade as success', () => {
  const {snapshot, policy} = fixture();
  snapshot.checks[0].status = 'in_progress'; snapshot.runs[0].status = 'queued';
  snapshot.statuses = [{sha: HEAD, state: 'pending'}];
  const {reasons} = evaluate(snapshot, policy, NOW);
  for (const r of ['CHECK_NOT_SUCCESS', 'RUN_STALE_OR_UNTRUSTED', 'STATUS_NOT_SUCCESS']) assert.ok(reasons.includes(r));
});
test('actual default policy and malformed/empty inputs always deny', () => {
  const defaults = JSON.parse(readFileSync(new URL('./policy.json', import.meta.url)));
  assert.deepEqual(defaults.reviewerAllowlist, []); assert.equal(defaults.approved, false);
  for (const input of [null, {}, [], fixture().snapshot]) assert.equal(evaluate(input, defaults, NOW).status, 'BLOCKED');
  for (const policy of [null, {}, {...fixture().policy, ciRules: []}, {...fixture().policy, reviewerAllowlist: []}]) {
    assert.equal(evaluate(fixture().snapshot, policy, NOW).status, 'BLOCKED');
  }
});
test('path matcher supports a bounded explicit manifest, including rename source', () => {
  assert.ok(matches('src/a/code.mjs', 'src/**')); assert.ok(matches('code.mjs', '**/*.mjs'));
  assert.equal(matches('src/a/code.mjs', 'src/*.mjs'), false);
  assert.throws(() => matches('src/a', '!src/**'));
  const {snapshot, policy} = fixture(); snapshot.files[0].previous_filename = 'docs/old.md';
  assert.ok(evaluate(snapshot, policy, NOW).reasons.includes('CI_PATH_UNCOVERED'));
  policy.ciRules[0].include = ['**']; policy.ciRules[0].exclude = ['src/**'];
  assert.ok(evaluate(snapshot, policy, NOW).reasons.includes('CI_PATH_UNCOVERED'));
});
test('commented review does not erase change request; dismissed does', () => {
  const {snapshot, policy} = fixture();
  snapshot.reviews.push({id: 2, user: {id: 500}, state: 'CHANGES_REQUESTED', commit_id: HEAD},
    {id: 3, user: {id: 500}, state: 'COMMENTED', commit_id: HEAD});
  assert.ok(evaluate(snapshot, policy, NOW).reasons.includes('CHANGES_REQUESTED'));
  snapshot.reviews.push({id: 4, user: {id: 500}, state: 'DISMISSED', commit_id: HEAD});
  assert.equal(evaluate(snapshot, policy, NOW).status, 'READY_FOR_RECHECK');
});

const options = policy => ({repository: policy.repository, number: 12, policy, policyBase: BASE, actorId: 300});
const clock = () => new Date(NOW).toISOString();
test('actual collector feeds actual evaluator; raw settings/comments do not approve blockers', async () => {
  const {snapshot, policy} = fixture(); const {reader, calls} = readerFixture(snapshot);
  const gathered = await collect(reader, options(policy), clock);
  assert.deepEqual(gathered.errors, []);
  assert.ok(evaluate(gathered, policy, NOW).reasons.includes('MISSING_OR_STALE_BLOCKERS'));
  gathered.attestations = snapshot.attestations; // synthetic evidence only
  assert.equal(evaluate(gathered, policy, NOW).status, 'READY_FOR_RECHECK');
  assert.ok(calls.some(c => c.p.filter === 'all'));
});
test('all REST pages and all thread cursors consumed, including blocker on page 2', async () => {
  const {snapshot, policy} = fixture();
  const {reader, calls} = readerFixture(snapshot, (route, p) => {
    if (route.endsWith('/comments')) return {data: p.page === 1 ? Array.from({length: 100}, (_, id) => ({id})) : [{id: 101}], headers: {}};
    if (route === 'threads') return {repository: {pullRequest: {reviewThreads: {nodes: p.cursor ? [{id: 'b', isResolved: false}] : [{id: 'a', isResolved: true}],
      pageInfo: {hasNextPage: !p.cursor, endCursor: p.cursor ? null : 'next'}}}}};
  });
  const s = await collect(reader, options(policy), clock);
  assert.equal(s.comments.length, 101); assert.equal(s.threads.length, 2);
  assert.ok(calls.some(c => c.p.page === 2));
  assert.ok(evaluate(s, policy, NOW).reasons.includes('UNRESOLVED_THREAD'));
});
test('page 2 failure, totals mismatch, cursor loops, partial GraphQL and acquisition caps fail closed', async () => {
  for (const mode of ['pageFailure', 'totalMismatch', 'cursorLoop', 'partialGraphQL', 'pageLimit', 'bytes']) {
    const {snapshot, policy} = fixture();
    const {reader} = readerFixture(snapshot, (route, p) => {
      if (mode === 'pageFailure' && route.endsWith('/comments')) {
        if (p.page === 2) throw Object.assign(Error('unavailable'), {status: 403});
        return {data: Array(100).fill({id: 1}), headers: {}};
      }
      if (mode === 'totalMismatch' && route.endsWith('/check-runs')) return {data: {total_count: 2, check_runs: snapshot.checks}, headers: {}};
      if (mode === 'cursorLoop' && route === 'threads') return {repository: {pullRequest: {reviewThreads: {nodes: [], pageInfo: {hasNextPage: true, endCursor: 'same'}}}}};
      if (mode === 'partialGraphQL' && route === 'threads') return {errors: [{message: 'denied'}], repository: {pullRequest: {reviewThreads: {nodes: [], pageInfo: {hasNextPage: false}}}}};
      if (mode === 'pageLimit' && route.endsWith('/comments')) return {data: Array(100).fill({id: 1}), headers: {}};
      if (mode === 'bytes' && route.endsWith('/comments')) return {data: [{body: 'x'.repeat(LIMITS.bytes)}], headers: {}};
    });
    const s = await collect(reader, options(policy), clock);
    assert.ok(s.errors.length, mode); assert.equal(evaluate(s, policy, NOW).status, 'BLOCKED', mode);
  }
});
test('collector catches actual head/base race and a protection 403', async () => {
  const {snapshot, policy} = fixture(); let mainCalls = 0, prCalls = 0;
  const {reader} = readerFixture(snapshot, (route) => {
    if (route.endsWith('/branches/main') && ++mainCalls === 2) return {data: {commit: {sha: NEXT}, protected: true}};
    if (route.endsWith('/pulls/{pull_number}') && ++prCalls === 2) return {data: {...snapshot.pr, head: {...snapshot.pr.head, sha: NEXT}}};
    if (route.endsWith('/protection')) throw Object.assign(Error('no permission'), {status: 403});
  });
  const s = await collect(reader, options(policy), clock);
  const result = evaluate(s, policy, NOW);
  assert.ok(result.reasons.includes('HEAD_BASE_CHANGED')); assert.ok(result.reasons.includes('FETCH_FAILED'));
});
test('production API adapter has only GET and a fixed read-only GraphQL query', async () => {
  const calls = [];
  const reader = githubReader({request: async (...args) => calls.push(args), graphql: async (...args) => calls.push(args)});
  await reader.get('/repos/{owner}/{repo}/pulls', {owner: 'example', repo: 'game'});
  await reader.threads({owner: 'example', repo: 'game', number: 12, cursor: null});
  assert.ok(calls[0][0].startsWith('GET ')); assert.ok(calls[1][0].startsWith('query('));
  assert.doesNotMatch(calls[1][0], /mutation/);
  assert.deepEqual(Object.keys(reader).sort(), ['get', 'threads']);
});

test('offline sequence refreshes every PR after main advances and records expectedHead', () => {
  const first = fixture(), second = fixture({base: NEXT, head: 'e'.repeat(40), number: 13});
  const result = simulateSequence([
    {before: first.snapshot, recheck: structuredClone(first.snapshot), mockResult: {merged: true, main: NEXT}},
    {before: second.snapshot, recheck: structuredClone(second.snapshot), mockResult: {merged: true, main: 'f'.repeat(40)}},
  ], first.policy, NOW);
  assert.equal(result.status, 'SIMULATED_ONLY');
  const requests = result.events.filter(e => e.type === 'mockMergeRequest');
  assert.equal(requests.length, 2); assert.equal(requests[0].expectedHead, HEAD); assert.equal(requests[1].validatedBase, NEXT);
});
test('offline sequence stops on stale next base, ref race, failed mock or empty queue', () => {
  const {snapshot, policy} = fixture();
  const step = {before: snapshot, recheck: structuredClone(snapshot), mockResult: {merged: true, main: NEXT}};
  assert.equal(simulateSequence([step, step], policy, NOW).reason, 'MAIN_NOT_REFRESHED');
  const moved = fixture({head: NEXT});
  assert.equal(simulateSequence([{...step, recheck: moved.snapshot}], policy, NOW).reason, 'RACE_OR_RECHECK');
  assert.equal(simulateSequence([{...step, mockResult: {merged: false}}], policy, NOW).reason, 'MOCK_MERGE_FAILED');
  assert.equal(simulateSequence([], policy, NOW).reason, 'EMPTY_SEQUENCE');
  assert.equal(simulateSequence([null], policy, NOW).reason, 'INVALID_STEP');
});

test('actual dry-run entry point uses disabled checked-in policy and reports BLOCKED', async () => {
  const {snapshot} = fixture(); const {reader, calls} = readerFixture(snapshot);
  const github = {request: (route, p) => reader.get(route.slice(4), p), graphql: (_query, p) => reader.threads(p)};
  const failures = [], summary = [], outputs = [];
  const core = {setFailed: value => failures.push(value), setOutput: (...args) => outputs.push(args)};
  core.summary = {addHeading(v) { summary.push(v); return this; }, addRaw(v) { summary.push(v); return this; },
    addCodeBlock(v) { summary.push(v); return this; }, async write() {}};
  const context = {eventName: 'workflow_dispatch', ref: 'refs/heads/main', sha: BASE,
    repo: {owner: 'haseatsu114514-dot', repo: 'shisha-game'},
    payload: {inputs: {pull_request: '12', execute: 'true', policy: 'untrusted override'}, sender: {id: 300}}};
  const {decision} = await dryRun({github, context, core});
  assert.equal(decision.status, 'BLOCKED'); assert.equal(decision.executionEnabled, false);
  for (const reason of ['POLICY_UNAPPROVED', 'CI_RULES_EMPTY', 'REVIEWERS_UNCONFIGURED']) assert.ok(decision.reasons.includes(reason));
  assert.equal(failures.length, 1); assert.deepEqual(outputs, [['decision', 'BLOCKED']]);
  assert.match(summary.join(''), /Execution is disabled/); assert.ok(calls.length);
  const reads = calls.length;
  await assert.rejects(dryRun({github, context: {...context, ref: 'refs/heads/candidate'}, core}));
  context.payload.inputs.pull_request = '1; echo unsafe';
  await assert.rejects(dryRun({github, context, core}));
  assert.equal(calls.length, reads, 'invalid context/input performs no API reads');
});
test('workflow preserves read-only authority and trusted main checkout boundary', () => {
  const yaml = readFileSync(new URL('../../.github/workflows/sequential-merge.yml', import.meta.url), 'utf8');
  assert.match(yaml, /permissions:\n  contents: read\n/);
  assert.doesNotMatch(yaml, /:\s*write\b|pull_request_target|secrets\.|enable_auto_merge|\.merge\(/);
  assert.match(yaml, /if: github.event_name == 'workflow_dispatch' && github.ref == 'refs\/heads\/main'/);
  assert.match(yaml, /ref: \$\{\{ github.sha \}\}/);
  assert.doesNotMatch(yaml, /github\.event\.pull_request\.head/);
  assert.match(yaml, /await dryRun\(\{github, context, core\}\)/);
});
