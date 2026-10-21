import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import test from 'node:test';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {REPO, makePlan, parseJson, preserve, runCli, verifyState, prepareTransfer, createRuntimeAdapter} = require('./issue_preservation.cjs');
const digest = value => createHash('sha256').update(value).digest('hex');
const copy = value => structuredClone(value);
const base = 'a'.repeat(40), head = 'b'.repeat(40);
const treeRoot = 'd'.repeat(40), treeTools = 'e'.repeat(40);
const request = '219fd05e-39e1-48fc-85ea-eaf20d9223f5';
const prefix = `/repos/${REPO}`;
const source = 'print("saved fixture")\n';
const blob = createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0`).update(source).digest('hex');

function inputs() {
  const manifest = {
    schema: 'issue-preservation/v1', request_id: request, issue: 42,
    from: 'old-worker', to: 'new-worker', claim_run: '800', claim_comment: 7,
    base, files: [{path: 'tools/saved_fixture.py', bytes: Buffer.byteLength(source), sha256: digest(source)}],
    evidence: {
      stopped: 'https://runtime.example/stop/one',
      inventory: 'https://runtime.example/inventory/one',
      fenced: 'https://runtime.example/fence/one',
    },
  };
  const body = `<!-- issue-preservation:v1 ${JSON.stringify(manifest)} -->`;
  return {envelope: {approval_comment: 123, approval_sha256: digest(body), manifest},
    payload: [{path: manifest.files[0].path, content: Buffer.from(source).toString('base64')}], body};
}

function httpError(status, message = `HTTP ${status}`) {
  return Object.assign(new Error(message), {status});
}

// This fixture models remote state. Every response is copied, so changing a
// returned object cannot accidentally conceal a missing fresh API read.
function setup(options = {}) {
  const input = inputs();
  const branch = `codex/recovery/issue-42/${request}`;
  const state = {
    meta: {full_name: REPO, default_branch: 'main'},
    issue: {number: 42, state: 'open', labels: [], url: `${prefix}/issues/42`},
    approval: {id: 123, user: {login: 'oldUser'}, body: input.body,
      issue_url: `https://api.github.com${prefix}/issues/42`,
      html_url: `https://github.com/${REPO}/issues/42#issuecomment-123`,
      created_at: '2026-10-17T00:00:00Z', updated_at: '2026-10-17T00:00:00Z'},
    comments: [{id: 7, user: {login: 'github-actions[bot]'},
      body: '<!-- issue-claim:v1 state=claimed owner=old-worker -->\n<!-- issue-claim-run:v1 id=800 request=original -->'}],
    permissions: {oldUser: 'write', newUser: 'write'},
    run: {id: 800, path: '.github/workflows/issue-claim.yml', event: 'workflow_dispatch',
      head_branch: 'main', status: 'completed', conclusion: 'success', actor: {login: 'oldUser'}},
    main: base, ref: null, prs: [],
    commit: {sha: head, parents: [{sha: base}], tree: {sha: treeRoot}},
    trees: {
      [treeRoot]: {sha: treeRoot, truncated: false,
        tree: [{path: 'tools', mode: '040000', type: 'tree', sha: treeTools}]},
      [treeTools]: {sha: treeTools, truncated: false,
        tree: [{path: 'saved_fixture.py', mode: '100644', type: 'blob', sha: blob}]},
    },
    compare: {status: 'ahead', ahead_by: 1, behind_by: 0, total_commits: 1,
      base_commit: {sha: base}, merge_base_commit: {sha: base}, commits: [{sha: head}],
      files: [{filename: 'tools/saved_fixture.py', status: 'added', sha: blob}]},
    savedBlob: {sha: blob, encoding: 'base64', size: Buffer.byteLength(source), content: Buffer.from(source).toString('base64')},
    existingPaths: new Set(), runtimeCalls: [],
  };
  const calls = [], writes = [];
  const runtime = {async verify(manifest, manifestDigest) {
    state.runtimeCalls.push({manifest: copy(manifest), manifestDigest});
    await options.runtimeHook?.(state, manifest, manifestDigest);
    return options.runtimeResult ?? {stopped: true, inventoryComplete: true, fenced: true,
      manifest_sha256: manifestDigest, expires_at: Date.now() + 60_000};
  }};
  const api = async (method, path, body) => {
    const call = {method, path, body: body === undefined ? undefined : copy(body)};
    calls.push(call);
    await options.hook?.(call, state, input, calls);
    if (method !== 'GET') writes.push(call);
    if (method === 'GET' && path === prefix) return copy(state.meta);
    if (method === 'GET' && path === `${prefix}/issues/42`) return copy(state.issue);
    if (method === 'GET' && path === `${prefix}/issues/comments/123`) return copy(state.approval);
    if (method === 'GET' && path.startsWith(`${prefix}/issues/42/comments?`)) {
      const page = Number(new URL(`https://api.github.com${path}`).searchParams.get('page') || 1);
      return copy(state.comments.slice((page - 1) * 100, page * 100));
    }
    if (method === 'GET' && path.startsWith(`${prefix}/collaborators/`)) {
      const login = path.slice(`${prefix}/collaborators/`.length).split('/')[0];
      return {permission: state.permissions[login] || 'read'};
    }
    if (method === 'GET' && path === `${prefix}/actions/runs/800`) return copy(state.run);
    if (method === 'GET' && path === `${prefix}/git/ref/heads/main`) return {ref: 'refs/heads/main', object: {sha: state.main}};
    if (method === 'GET' && path === `${prefix}/git/ref/heads/${branch}`) {
      if (!state.ref) throw httpError(404);
      return {ref: `refs/heads/${branch}`, object: {sha: state.ref}};
    }
    if (method === 'GET' && path.startsWith(`${prefix}/contents/`)) {
      const file = path.slice(`${prefix}/contents/`.length).split('?')[0];
      if (state.existingPaths.has(file)) return {type: 'file', sha: blob};
      throw httpError(404);
    }
    if (method === 'GET' && path.startsWith(`${prefix}/pulls?`)) {
      const page = Number(new URL(`https://api.github.com${path}`).searchParams.get('page') || 1);
      return copy(state.prs.slice((page - 1) * 100, page * 100));
    }
    if (method === 'GET' && path === `${prefix}/git/commits/${head}`) return copy(state.commit);
    if (method === 'GET' && path === `${prefix}/compare/${base}...${head}`) return copy(state.compare);
    if (method === 'GET' && path.startsWith(`${prefix}/git/trees/`)) {
      const id = path.slice(`${prefix}/git/trees/`.length);
      if (!state.trees[id]) throw httpError(404);
      return copy(state.trees[id]);
    }
    if (method === 'GET' && path.startsWith(`${prefix}/git/blobs/`)) return copy(state.savedBlob);
    if (method === 'POST' && path === `${prefix}/git/refs`) {
      assert.equal(state.ref, null, 'must never overwrite an existing reference');
      state.ref = body.sha;
      return {ref: body.ref, object: {sha: state.ref}};
    }
    if (method === 'POST' && path === '/graphql') {
      state.ref = head;
      return {data: {createCommitOnBranch: {commit: {oid: head, url: `https://github.com/${REPO}/commit/${head}`}}}};
    }
    if (method === 'POST' && path === `${prefix}/pulls`) {
      const pr = {number: 43, state: 'open', draft: body.draft, title: body.title, body: body.body,
        html_url: `https://github.com/${REPO}/pull/43`,
        head: {ref: body.head, sha: state.ref, repo: {full_name: REPO}},
        base: {ref: body.base, repo: {full_name: REPO}}};
      state.prs.push(pr);
      return copy(pr);
    }
    throw Error(`Unexpected API call ${method} ${path}`);
  };
  const execute = (extra = {}) => preserve(input.envelope, input.payload, {api, actor: 'oldUser', runtime, ...extra});
  const plan = () => makePlan(input.envelope, input.payload);
  return {input, state, calls, writes, api, runtime, execute, plan, branch};
}

async function refusesWithoutWrite(s, pattern) {
  await assert.rejects(s.execute(), pattern);
  assert.deepEqual(s.writes, [], 'a refusal must perform no remote mutations');
}

test('valid preservation only creates its dedicated reference, one commit and a Draft PR', async () => {
  const s = setup();
  await s.execute();
  assert.deepEqual(s.writes.map(({method, path}) => [method, path]), [
    ['POST', `${prefix}/git/refs`], ['POST', '/graphql'], ['POST', `${prefix}/pulls`],
  ]);
  assert.deepEqual(s.writes[0].body, {ref: `refs/heads/${s.branch}`, sha: base});
  const mutation = JSON.stringify(s.writes[1].body);
  assert.match(mutation, /createCommitOnBranch/);
  assert.ok(mutation.includes(base), 'commit mutation is bound to the expected parent');
  assert.ok(mutation.includes(s.input.payload[0].content), 'approved bytes reach the commit API');
  assert.equal(s.writes[2].body.head, s.branch);
  assert.equal(s.writes[2].body.base, 'main');
  assert.equal(s.writes[2].body.draft, true);
  for (const field of ['Request:', 'From:', 'To:', 'Claim owner:', 'Claim comment:',
    'Claim run:', 'Manifest SHA-256:', 'Approval:', 'Files:', 'tools/saved_fixture.py',
    digest(source)]) assert.ok(s.writes[2].body.body.includes(field), 'Draft audit body includes ' + field);
  assert.ok(s.state.runtimeCalls.length >= 3, 'runtime evidence is rechecked at write boundaries');
  assert.equal(s.state.comments.length, 1, 'preservation must retain the old ledger');
  assert.match(s.state.comments[0].body, /owner=old-worker/);
});

for (const field of ['From:', 'To:', 'Claim owner:', 'Claim comment:', 'Claim run:',
  'Manifest SHA-256:', 'Approval:', 'tools/saved_fixture.py', digest(source)]) {
  test('reused Draft must retain required audit field ' + field, async () => {
    const s = setup();
    await s.execute();
    s.writes.length = 0;
    s.state.prs[0].body = s.state.prs[0].body.replace(field, 'tampered:');
    await assert.rejects(s.execute(), {code: 'SAVED_CONTENT_MISMATCH'});
    assert.deepEqual(s.writes, []);
  });
}

test('PR created with a changed audit body is rejected by the post-create readback', async () => {
  let created = false;
  const s = setup({hook(call, state) {
    if (call.method === 'POST' && call.path === prefix + '/pulls') created = true;
    if (created && call.method === 'GET' && call.path.startsWith(prefix + '/pulls?')) {
      state.prs[0].body = state.prs[0].body.replace('Claim run:', 'tampered:');
    }
  }});
  await assert.rejects(s.execute(), {code: 'SAVED_CONTENT_MISMATCH'});
  assert.equal(s.writes.filter(c => c.path === prefix + '/pulls').length, 1);
  assert.equal(s.state.prs.length, 1);
});

test('plan copies and freezes the approved manifest and payload', () => {
  const s = setup(), plan = s.plan();
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.manifest));
  assert.ok(Object.isFrozen(plan.files));
  const before = JSON.stringify(plan);
  s.input.envelope.manifest.files[0].path = 'tools/changed.py';
  s.input.payload[0].content = Buffer.from('changed\n').toString('base64');
  assert.equal(JSON.stringify(plan), before);
});

for (const change of ['missing', 'extra', 'duplicate', 'path', 'bytes', 'sha256', 'noncanonical-base64', 'binary']) {
  test(`manifest and payload must match exactly: ${change}`, async () => {
    const s = setup(), f = s.input.envelope.manifest.files[0];
    if (change === 'missing') s.input.payload.length = 0;
    if (change === 'extra') s.input.payload.push({path: 'tools/unapproved.py', content: 'eA=='});
    if (change === 'duplicate') s.input.payload.push({...s.input.payload[0]});
    if (change === 'path') s.input.payload[0].path = 'tools/other.py';
    if (change === 'bytes') f.bytes++;
    if (change === 'sha256') f.sha256 = '0'.repeat(64);
    if (change === 'noncanonical-base64') s.input.payload[0].content += '\n';
    if (change === 'binary') {
      const bytes = Buffer.from([0xff, 0xfe]);
      f.bytes = bytes.length; f.sha256 = digest(bytes); s.input.payload[0].content = bytes.toString('base64');
    }
    await refusesWithoutWrite(s);
    assert.equal(s.calls.length, 0, 'invalid source bytes are rejected before API access');
  });
}

test('read actor cannot borrow the approval author write permission', async () => {
  const s = setup();
  s.state.permissions.newUser = 'read';
  await assert.rejects(s.execute({actor: 'newUser'}), {code: 'PERMISSION_UNVERIFIED'});
  assert.deepEqual(s.writes, []);
});

test('admin actor cannot borrow a different approval author even when the author has no write permission', async () => {
  const s = setup();
  s.state.permissions.newUser = 'admin';
  s.state.permissions.oldUser = 'read';
  await assert.rejects(s.execute({actor: 'newUser'}), {code: 'APPROVAL_ACTOR_MISMATCH'});
  assert.deepEqual(s.writes, []);
});

for (const path of ['/Users/private/secret.py', '../outside.py', '.git/config', '.github/workflows/unsafe.yml']) {
  test(`rejects forbidden publication path: ${path}`, async () => {
    const s = setup();
    s.input.envelope.manifest.files[0].path = path;
    s.input.payload[0].path = path;
    await refusesWithoutWrite(s);
    assert.equal(s.calls.length, 0);
  });
}

test('private local evidence locations cannot enter a public manifest', async () => {
  const s = setup();
  s.input.envelope.manifest.evidence.stopped = '/Users/private/session-state.json';
  await refusesWithoutWrite(s);
  assert.equal(s.calls.length, 0);
});

test('source mutation during API awaits cannot replace the approved bytes', async () => {
  const s = setup({hook(call, state, input) {
    if (call.method === 'GET') input.payload[0].content = Buffer.from('tampered while awaiting\n').toString('base64');
  }});
  await s.execute();
  assert.ok(JSON.stringify(s.writes[1].body).includes(Buffer.from(source).toString('base64')));
  assert.ok(!JSON.stringify(s.writes[1].body).includes(Buffer.from('tampered while awaiting\n').toString('base64')));
});

test('unavailable runtime fencing fails closed before remote mutations', async () => {
  const s = setup();
  await assert.rejects(s.execute({runtime: undefined}), {code: 'UNSUPPORTED_FENCING'});
  assert.deepEqual(s.writes, []);
});

for (const missing of ['stopped', 'inventoryComplete', 'fenced', 'manifest_sha256', 'expires_at']) {
  test(`runtime evidence must prove every condition: ${missing}`, async () => {
    const s = setup({runtimeHook(state, manifest, manifestDigest) {
      state.runtimeResult = {stopped: true, inventoryComplete: true, fenced: true,
        manifest_sha256: manifestDigest, expires_at: Date.now() + 60_000};
    }});
    const runtime = {async verify(manifest, manifestDigest) {
      const result = {stopped: true, inventoryComplete: true, fenced: true,
        manifest_sha256: manifestDigest, expires_at: Date.now() + 60_000};
      delete result[missing];
      return result;
    }};
    await assert.rejects(s.execute({runtime}));
    assert.deepEqual(s.writes, []);
  });
}

test('expired evidence and evidence for different bytes are not accepted', async () => {
  for (const extra of [{expires_at: Date.now() - 1}, {manifest_sha256: '0'.repeat(64)}]) {
    const s = setup();
    const runtime = {async verify(manifest, manifestDigest) {
      return {stopped: true, inventoryComplete: true, fenced: true,
        manifest_sha256: manifestDigest, expires_at: Date.now() + 60_000, ...extra};
    }};
    await assert.rejects(s.execute({runtime}));
    assert.deepEqual(s.writes, []);
  }
});

for (const change of ['approval', 'author', 'issue', 'ledger-owner', 'ledger-run', 'ledger-id', 'run-failed', 'run-id', 'run-workflow', 'run-actor', 'main-head', 'open-pr', 'actor-permission', 'author-permission']) {
  test(`refuses stale or unauthorized preconditions without any write: ${change}`, async () => {
    const s = setup(), state = s.state;
    if (change === 'approval') state.approval.body += '\nrevoked';
    if (change === 'author') state.approval.user.login = 'unrelated';
    if (change === 'issue') state.issue.state = 'closed';
    if (change === 'ledger-owner') state.comments[0].body = state.comments[0].body.replace('old-worker', 'different-worker');
    if (change === 'ledger-run') state.comments[0].body = state.comments[0].body.replace('id=800', 'id=801');
    if (change === 'ledger-id') state.comments[0].id = 8;
    if (change === 'run-failed') state.run.conclusion = 'failure';
    if (change === 'run-id') state.run.id = 801;
    if (change === 'run-workflow') state.run.path = '.github/workflows/unrelated.yml';
    if (change === 'run-actor') state.run.actor.login = 'unrelated';
    if (change === 'main-head') state.main = 'e'.repeat(40);
    if (change === 'open-pr') state.prs.push({number: 44, title: 'Other work', body: 'Refs #42', head: {sha: head, repo: {full_name: REPO}}});
    if (change === 'actor-permission') state.permissions.oldUser = 'read';
    if (change === 'author-permission') state.permissions.oldUser = 'read';
    await refusesWithoutWrite(s);
  });
}

test('existing source path cannot be overwritten as a recovery addition', async () => {
  const s = setup();
  s.state.existingPaths.add('tools/saved_fixture.py');
  await refusesWithoutWrite(s);
});

test('a late ledger record beyond the first page supersedes the old claim', async () => {
  const s = setup();
  s.state.comments.push(...Array.from({length: 100}, (_, index) => ({id: 1000 + index, user: {login: 'human'}, body: 'discussion'})));
  s.state.comments.push({id: 5000, user: {login: 'github-actions[bot]'}, body: '<!-- issue-claim:v1 state=released owner=old-worker -->'});
  await refusesWithoutWrite(s);
  assert.ok(s.calls.some(c => c.path.includes('page=2')));
});

test('forged human ledger markers cannot supersede the real reservation', async () => {
  const s = setup();
  s.state.comments.push({id: 8, user: {login: 'human'}, body: '<!-- issue-claim:v1 state=claimed owner=imposter -->'});
  await s.execute();
  assert.equal(s.writes.length, 3);
});

for (const target of ['approval', 'ledger', 'issue', 'run', 'permission']) {
  test(`rechecks ${target} before the first mutation`, async () => {
    let changed = false;
    const s = setup({hook(call, state) {
      // The first read of the dedicated ref is after the initial snapshot.
      if (!changed && call.method === 'GET' && call.path.includes('/git/ref/heads/codex/recovery/')) {
        changed = true;
        if (target === 'approval') state.approval.body += '\nrevoked';
        if (target === 'ledger') state.comments[0].body = state.comments[0].body.replace('old-worker', 'new-owner');
        if (target === 'issue') state.issue.state = 'closed';
        if (target === 'run') state.run.conclusion = 'cancelled';
        if (target === 'permission') state.permissions.oldUser = 'read';
      }
    }});
    await refusesWithoutWrite(s);
    assert.ok(changed, 'fixture reached the initial snapshot boundary');
  });
}

test('403 from permission inspection stops without credential or API fallback', async () => {
  const s = setup({hook(call) {
    if (call.path.includes('/collaborators/')) throw httpError(403, 'Forbidden');
  }});
  await refusesWithoutWrite(s, /Forbidden|FORBIDDEN/);
  assert.equal(s.calls.filter(c => c.path.includes('/collaborators/')).length, 1);
});

test('successful read-only verification performs no mutation', async () => {
  const s = setup();
  await verifyState(s.plan(), {api: s.api, actor: 'oldUser', runtime: s.runtime});
  assert.deepEqual(s.writes, []);
});

test('an interrupted reference at its base is held for review without extra creation', async () => {
  const s = setup();
  s.state.ref = base;
  await assert.rejects(s.execute(), {code: 'PARTIAL_PRESERVATION'});
  assert.deepEqual(s.writes, []);
});

test('a complete matching saved Draft is read back and returned idempotently', async () => {
  const s = setup();
  await s.execute();
  s.writes.length = 0;
  await s.execute();
  assert.deepEqual(s.writes, []);
  assert.equal(s.state.prs.length, 1);
});

test('an ambiguous reference-creation result is inspected without duplicate retry', async () => {
  const s = setup({hook(call, state) {
    if (call.method === 'POST' && call.path === `${prefix}/git/refs`) {
      state.ref = base;
      throw httpError(502, 'response lost after creation');
    }
  }});
  await assert.rejects(s.execute());
  assert.equal(s.calls.filter(c => c.method === 'POST' && c.path === `${prefix}/git/refs`).length, 1);
  s.writes.length = 0;
  await assert.rejects(s.execute(), {code: 'PARTIAL_PRESERVATION'});
  assert.deepEqual(s.writes, []);
});

for (const changed of ['parent', 'extra-file', 'blob-bytes', 'reference-head', 'not-draft']) {
  test(`a saved result with different ${changed} cannot be accepted or rewritten`, async () => {
    const s = setup();
    await s.execute();
    s.writes.length = 0;
    if (changed === 'parent') s.state.commit.parents[0].sha = 'e'.repeat(40);
    if (changed === 'extra-file') s.state.compare.files.push({filename: 'tools/unapproved.py', status: 'added', sha: blob});
    if (changed === 'blob-bytes') s.state.savedBlob.content = Buffer.from('different\n').toString('base64');
    if (changed === 'reference-head') s.state.ref = 'e'.repeat(40);
    if (changed === 'not-draft') s.state.prs[0].draft = false;
    await assert.rejects(s.execute());
    assert.deepEqual(s.writes, []);
  });
}

test('JSON input cannot hide duplicate approved fields or trailing data', () => {
  for (const value of ['{"issue":42,"issue":43}', '{"files":[{"path":"a","path":"b"}]}',
    '{"__proto__":1,"__proto__":2}', '{"issue":42} false', '{"issue":1e999}']) {
    assert.throws(() => parseJson(value), {code: 'INVALID_JSON'});
  }
});

for (const value of ['\u00a0{"issue":42}', '\ufeff{"issue":42}', '{"issue":42}\u00a0', '{\u00a0"issue":42}']) {
  test(`JSON rejects non-JSON whitespace ${JSON.stringify(value)}`, () => {
    assert.throws(() => parseJson(value), {code: 'INVALID_JSON'});
  });
}

test('evidence field names cannot combine required keys using a comma', async () => {
  const s = setup();
  s.input.envelope.manifest.evidence = {
    stopped: 'https://runtime.example/stop/one',
    'fenced,inventory': 'https://runtime.example/combined/one',
  };
  await refusesWithoutWrite(s);
  assert.equal(s.calls.length, 0);
});

test('evidence references must be strings rather than coercible arrays', async () => {
  const s = setup();
  s.input.envelope.manifest.evidence.stopped = ['https://runtime.example/stop/one'];
  await refusesWithoutWrite(s);
  assert.equal(s.calls.length, 0);
});

for (const changed of ['symlink-mode', 'gitlink-mode', 'leaf-type', 'directory-mode', 'directory-type',
  'truncated-root', 'truncated-child', 'blob-sha', 'forged-blob-sha']) {
  test(`saved Draft readback rejects ${changed} without rewriting it`, async () => {
    const s = setup();
    await s.execute();
    s.writes.length = 0;
    const directory = s.state.trees[treeRoot].tree[0], leaf = s.state.trees[treeTools].tree[0];
    if (changed === 'symlink-mode') leaf.mode = '120000';
    if (changed === 'gitlink-mode') leaf.mode = '160000';
    if (changed === 'leaf-type') leaf.type = 'tree';
    if (changed === 'directory-mode') directory.mode = '120000';
    if (changed === 'directory-type') directory.type = 'blob';
    if (changed === 'truncated-root') s.state.trees[treeRoot].truncated = true;
    if (changed === 'truncated-child') s.state.trees[treeTools].truncated = true;
    if (changed === 'blob-sha') s.state.savedBlob.sha = 'f'.repeat(40);
    if (changed === 'forged-blob-sha') {
      leaf.sha = 'f'.repeat(40);
      s.state.savedBlob.sha = leaf.sha;
      s.state.compare.files[0].sha = leaf.sha;
    }
    await assert.rejects(s.execute(), {code: 'SAVED_CONTENT_MISMATCH'});
    assert.deepEqual(s.writes, []);
  });
}

test('only the recorded approval author may execute preservation', async () => {
  const s = setup();
  await assert.rejects(s.execute({actor: 'newUser'}), {code: 'APPROVAL_ACTOR_MISMATCH'});
  assert.deepEqual(s.writes, []);
});

test('a revoked request cannot publish even when its original approval is unchanged', async () => {
  const s = setup();
  s.state.comments.push({id: 124, user: {login: 'oldUser'},
    body: `<!-- issue-preservation-revoked:v1 request=${request} -->`});
  await refusesWithoutWrite(s, {code: 'APPROVAL_REVOKED'});
});

test('permission loss after creating the ref stops before commit creation', async () => {
  const s = setup({hook(call, state) {
    if (call.method === 'POST' && call.path === `${prefix}/git/refs`) state.permissions.oldUser = 'read';
  }});
  await assert.rejects(s.execute());
  assert.equal(s.writes.length, 1);
  assert.equal(s.writes[0].path, `${prefix}/git/refs`);
  assert.equal(s.state.ref, base);
  assert.equal(s.state.prs.length, 0);
  assert.match(s.state.comments[0].body, /owner=old-worker/);
});

test('a moved recovery head stops before commit creation', async () => {
  let afterCreate = false;
  const s = setup({hook(call, state) {
    if (call.method === 'POST' && call.path === `${prefix}/git/refs`) afterCreate = true;
    if (afterCreate && call.method === 'GET' && call.path.endsWith(`/git/ref/heads/codex/recovery/issue-42/${request}`)) state.ref = 'e'.repeat(40);
  }});
  await assert.rejects(s.execute(), {code: 'RECOVERY_HEAD_CHANGED'});
  assert.equal(s.writes.length, 1);
});

test('readback mismatch after commit creation stops before Draft creation', async () => {
  const s = setup({hook(call, state) {
    if (call.method === 'POST' && call.path === '/graphql') state.savedBlob.content = Buffer.from('corrupted\n').toString('base64');
  }});
  await assert.rejects(s.execute(), {code: 'SAVED_CONTENT_MISMATCH'});
  assert.deepEqual(s.writes.map(c => c.path), [`${prefix}/git/refs`, '/graphql']);
  assert.equal(s.state.prs.length, 0);
});

test('write permission denial stops at the denied operation with no alternative request', async () => {
  const s = setup({hook(call) {
    if (call.method === 'POST') throw httpError(403);
  }});
  await assert.rejects(s.execute(), {code: 'GITHUB_FORBIDDEN'});
  assert.equal(s.calls.filter(c => c.method !== 'GET').length, 1);
  assert.equal(s.state.ref, null);
  assert.equal(s.state.prs.length, 0);
});

test('an unknown commit result resumes from verified remote bytes without a second commit', async () => {
  const s = setup({hook(call, state) {
    if (call.method === 'POST' && call.path === '/graphql') {
      state.ref = head;
      throw httpError(502, 'commit response lost');
    }
  }});
  await assert.rejects(s.execute(), {code: 'WRITE_OUTCOME_UNKNOWN'});
  assert.equal(s.calls.filter(c => c.path === '/graphql').length, 1);
  s.writes.length = 0;
  const result = await s.execute();
  assert.equal(result.reused, true);
  assert.deepEqual(s.writes.map(c => c.path), [`${prefix}/pulls`]);
  assert.equal(s.calls.filter(c => c.path === '/graphql').length, 1);
  assert.equal(s.state.prs.length, 1);
});

test('an unknown Draft creation result is reconciled without creating another Draft', async () => {
  const s = setup({hook(call, state) {
    if (call.method === 'POST' && call.path === `${prefix}/pulls`) {
      state.prs.push({number: 43, state: 'open', draft: true, body: call.body.body,
        title: call.body.title, head: {ref: call.body.head, sha: head, repo: {full_name: REPO}},
        base: {ref: 'main', repo: {full_name: REPO}}});
      throw httpError(502, 'Draft response lost');
    }
  }});
  await assert.rejects(s.execute(), {code: 'WRITE_OUTCOME_UNKNOWN'});
  assert.equal(s.calls.filter(c => c.method === 'POST' && c.path === `${prefix}/pulls`).length, 1);
  s.writes.length = 0;
  const result = await s.execute();
  assert.equal(result.reused, true);
  assert.equal(result.pr, 43);
  assert.deepEqual(s.writes, []);
  assert.equal(s.state.prs.length, 1);
});

const cliArgs = s => ['check', '--issue', '42', '--approval-comment', '123', '--approval-sha256', s.input.envelope.approval_sha256];

test('CLI check is read-only with a trusted runtime adapter', async () => {
  const s = setup();
  const result = await runCli(cliArgs(s), {api: s.api, actor: 'oldUser', runtime: s.runtime});
  assert.equal(result.writable, false);
  assert.equal(result.state, 'preflight-only');
  assert.deepEqual(s.writes, []);
});

test('production CLI without a runtime adapter refuses instead of publishing', async () => {
  const s = setup();
  await assert.rejects(runCli(cliArgs(s), {api: s.api, actor: 'oldUser'}), {code: 'UNSUPPORTED_FENCING'});
  assert.deepEqual(s.writes, []);
});

test('CLI cannot accept a publish verb or override its repository', async () => {
  for (const args of [['publish'], ['check', '--repo', 'other/game', '--issue', '42', '--approval-comment', '123']]) {
    const s = setup();
    await assert.rejects(runCli(args, {api: s.api, actor: 'oldUser', runtime: s.runtime}), {code: 'USAGE'});
    assert.deepEqual(s.calls, []);
  }
});

function signedRuntime(s, mutate = () => {}) {
  const {publicKey, privateKey} = generateKeyPairSync('ed25519');
  const exportedKey = publicKey.export({type:'spki', format:'pem'});
  return createRuntimeAdapter({publicKey:exportedKey, async readEvidence(challenge) {
    const statement = {schema:'issue-preservation-runtime/v1', repository:REPO,
      nonce:challenge.nonce, manifest_sha256:challenge.manifestDigest,
      issued_at:Date.now() - 1000, expires_at:Date.now() + 30000,
      stopped:true, inventoryComplete:true, fenced:true,
      scope:'source-descendants-all-writers', restart_denied:true, direct_writes_denied:true};
    mutate(statement, challenge);
    const text = JSON.stringify(statement);
    return {statement:text, signature:sign(null, Buffer.from(text), privateKey).toString('base64')};
  }});
}

test('signed runtime verifies a fresh host challenge at every boundary', async () => {
  const s = setup(), nonces = [];
  await s.execute({runtime:signedRuntime(s, (statement, challenge) => {
    nonces.push(challenge.nonce);
    assert.equal(challenge.manifestDigest, s.plan().manifestDigest);
    assert.deepEqual(challenge.manifest.files, s.plan().manifest.files);
  })});
  assert.ok(nonces.length >= 4);
  assert.equal(new Set(nonces).size, nonces.length);
});

for (const change of ['nonce','repository','manifest_sha256','stopped','inventoryComplete','fenced',
  'scope','restart_denied','direct_writes_denied','issued_at','expires_at','lifetime','extra']) {
  test('signed but insufficient runtime evidence refuses: ' + change, async () => {
    const s = setup();
    const runtime = signedRuntime(s, statement => {
      if (change === 'nonce' || change === 'manifest_sha256') statement[change] = '0'.repeat(64);
      else if (change === 'repository' || change === 'scope') statement[change] = 'other';
      else if (change === 'issued_at') statement.issued_at = Date.now() + 60000;
      else if (change === 'expires_at') statement.expires_at = Date.now() - 1;
      else if (change === 'lifetime') statement.expires_at = Date.now() + 120000;
      else if (change === 'extra') statement.extra = true;
      else statement[change] = false;
    });
    await assert.rejects(s.execute({runtime}), {code:'EVIDENCE_UNVERIFIED'});
    assert.deepEqual(s.writes, []);
  });
}

test('a correctly shaped response signed by an untrusted key is rejected', async () => {
  const {publicKey} = generateKeyPairSync('ed25519');
  const s = setup();
  const {privateKey} = generateKeyPairSync('ed25519');
  const runtime = createRuntimeAdapter({publicKey:publicKey.export({type:'spki',format:'pem'}),
    async readEvidence(challenge) {
      const statement = JSON.stringify({schema:'issue-preservation-runtime/v1', repository:REPO,
        nonce:challenge.nonce, manifest_sha256:challenge.manifestDigest,
        issued_at:Date.now() - 1000, expires_at:Date.now() + 30000,
        stopped:true, inventoryComplete:true, fenced:true, scope:'source-descendants-all-writers',
        restart_denied:true, direct_writes_denied:true});
      return {statement, signature:sign(null, Buffer.from(statement), privateKey).toString('base64')};
    }});
  await assert.rejects(s.execute({runtime}), {code:'EVIDENCE_UNVERIFIED'});
  assert.deepEqual(s.writes, []);
});

test('a previously signed challenge response cannot be replayed', async () => {
  const s = setup();
  let previousNonce;
  const runtime = signedRuntime(s, (statement, challenge) => {
    if (previousNonce) statement.nonce = previousNonce;
    previousNonce = challenge.nonce;
  });
  await assert.rejects(s.execute({runtime}), {code:'EVIDENCE_UNVERIFIED'});
  assert.deepEqual(s.writes, []);
});

test('runtime losing its fence after ref creation prevents commit and transfer', async () => {
  const s = setup();
  const runtime = signedRuntime(s, statement => { if (s.state.ref) statement.fenced = false; });
  await assert.rejects(s.execute({runtime}), {code:'EVIDENCE_UNVERIFIED'});
  assert.equal(s.state.ref, base);
  assert.equal(s.writes.length, 1);
  await assert.rejects(prepareTransfer(s.input.envelope, s.input.payload,
    {api:s.api, actor:'oldUser', runtime}), {code:'EVIDENCE_UNVERIFIED'});
});

test('transfer record is prepared only from freshly verified remote preservation', async () => {
  const s = setup();
  await s.execute();
  s.writes.length = 0;
  const result = await prepareTransfer(s.input.envelope, s.input.payload,
    {api:s.api, actor:'oldUser', runtime:s.runtime});
  assert.deepEqual(result.record, {issue:42, from:'old-worker', to:'new-worker', claim_run:'800',
    stopped:true, pushed:true, prs:[{number:43, head}]});
  assert.equal(result.marker, '<!-- issue-handoff:v1 ' + JSON.stringify(result.record) + ' -->');
  assert.equal(result.state, 'transfer-review-required');
  assert.ok(Object.isFrozen(result.record.prs));
  assert.deepEqual(s.writes, []);
  assert.match(s.state.comments[0].body, /owner=old-worker/);
});

for (const changed of ['missing-pr','head','approval','bytes','runtime']) {
  test('transfer preparation refuses stale or missing ' + changed, async () => {
    const s = setup();
    await s.execute();
    s.writes.length = 0;
    if (changed === 'missing-pr') s.state.prs.length = 0;
    if (changed === 'head') s.state.ref = base;
    if (changed === 'approval') s.state.approval.body += 'changed';
    if (changed === 'bytes') s.state.savedBlob.content = 'eA==';
    await assert.rejects(prepareTransfer(s.input.envelope, s.input.payload,
      {api:s.api, actor:'oldUser', runtime:changed === 'runtime' ? undefined : s.runtime}));
    assert.deepEqual(s.writes, []);
  });
}

test('comment-origin claim uses the verified requester recorded by the coordinator', async () => {
  const s = setup();
  s.state.run.event = 'issue_comment';
  s.state.run.actor.login = 'anotherAdmin';
  s.state.comments[0].body += '\n<!-- issue-claim-actor:v1 login=oldUser -->';
  await s.execute();
});

for (const changed of ['head','pr','approval','main','fence']) {
  test('verified commit without a PR cannot resume after changed ' + changed, async () => {
    const s = setup();
    await s.execute();
    s.state.prs.length = 0;
    s.writes.length = 0;
    if (changed === 'head') s.state.ref = 'f'.repeat(40);
    if (changed === 'pr') s.state.prs.push({number:99, title:'Refs #42', draft:false});
    if (changed === 'approval') s.state.approval.body += 'changed';
    if (changed === 'main') s.state.main = 'f'.repeat(40);
    await assert.rejects(s.execute(changed === 'fence' ? {runtime:undefined} : {}));
    assert.deepEqual(s.writes, []);
  });
}

test('transfer preparation rechecks PR identity after the blob read', async () => {
  let transfer = false;
  const s = setup({hook(call, state) {
    if (transfer && call.path.startsWith(prefix + '/git/blobs/')) state.prs[0].number = 99;
  }});
  await s.execute();
  s.writes.length = 0;
  transfer = true;
  await assert.rejects(prepareTransfer(s.input.envelope, s.input.payload,
    {api:s.api, actor:'oldUser', runtime:s.runtime}), {code:'SAVED_CONTENT_MISMATCH'});
  assert.deepEqual(s.writes, []);
});
