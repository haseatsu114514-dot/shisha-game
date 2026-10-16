#!/usr/bin/env node
'use strict';

// The CLI is read-only. A production runtime verifier/publisher is deliberately
// not installed. Injected adapters below are trusted host code, never request data.
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {TextDecoder} = require('node:util');
const REPO = 'haseatsu114514-dot/shisha-game';
const ROOT = '/repos/' + REPO;
const MAX_BYTES = 1024 * 1024;
const HEX40 = /^[a-f0-9]{40}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const OWNER = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const writers = new Set(['write', 'maintain', 'admin']);

class PreservationError extends Error {
  constructor(code, phase = 'validation') { super(code); this.code = code; this.phase = phase; }
}
function fail(code, phase) { throw new PreservationError(code, phase); }
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function keys(value, names) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== names.length ||
      Object.keys(value).some(key => !names.includes(key))) fail('INVALID_INPUT');
}
const integer = value => Number.isSafeInteger(value) && value > 0;

// Reject duplicate keys, excessive nesting, nonfinite numbers and trailing data.
function parseJson(source) {
  if (typeof source !== 'string' || Buffer.byteLength(source) > 2 * MAX_BYTES) fail('INVALID_JSON');
  let at = 0, count = 0;
  const space = () => { while (at < source.length && /[ \t\r\n]/.test(source[at])) at++; };
  function token(depth = 0) {
    if (++count > 20000 || depth > 32) fail('INVALID_JSON');
    space();
    const start = at, ch = source[at++];
    if (ch === '"') {
      let escaped = false;
      while (at < source.length) {
        const c = source[at++];
        if (c === '"' && !escaped) {
          try { return JSON.parse(source.slice(start, at)); } catch { fail('INVALID_JSON'); }
        }
        if (c === '\\' && !escaped) escaped = true; else escaped = false;
      }
      fail('INVALID_JSON');
    }
    if (ch === '{' || ch === '[') {
      const object = ch === '{', result = object ? Object.create(null) : [], seen = new Set();
      space();
      if (source[at] === (object ? '}' : ']')) { at++; return result; }
      for (;;) {
        let key;
        if (object) {
          space(); if (source[at] !== '"') fail('INVALID_JSON');
          key = token(depth + 1);
          if (seen.has(key)) fail('INVALID_JSON');
          seen.add(key); space(); if (source[at++] !== ':') fail('INVALID_JSON');
        }
        const value = token(depth + 1);
        if (object) result[key] = value; else result.push(value);
        space(); const separator = source[at++];
        if (separator === (object ? '}' : ']')) return result;
        if (separator !== ',') fail('INVALID_JSON');
      }
    }
    at = start;
    const match = source.slice(at).match(/^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/);
    if (!match) fail('INVALID_JSON');
    at += match[0].length;
    const value = JSON.parse(match[0]);
    if (typeof value === 'number' && !Number.isFinite(value)) fail('INVALID_JSON');
    return value;
  }
  const result = token(); space(); if (at !== source.length) fail('INVALID_JSON');
  return result;
}

function validateManifest(input) {
  const m = parseJson(canonical(input));
  keys(m, ['schema','request_id','issue','from','to','claim_run','claim_comment','base','files','evidence']);
  if (m.schema !== 'issue-preservation/v1' || !UUID.test(m.request_id) ||
      !integer(m.issue) || !OWNER.test(m.from) || !OWNER.test(m.to) || m.from === m.to ||
      typeof m.claim_run !== 'string' || !/^[1-9][0-9]*$/.test(m.claim_run) ||
      !integer(m.claim_comment) || !HEX40.test(m.base)) fail('INVALID_INPUT');
  keys(m.evidence, ['stopped','inventory','fenced']);
  for (const ref of Object.values(m.evidence)) {
    if (typeof ref !== 'string') fail('INVALID_EVIDENCE_REFERENCE');
    let url; try { url = new URL(ref); } catch { fail('INVALID_EVIDENCE_REFERENCE'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
        ref.length > 512 || /(?:localhost|127\.0\.0\.1)/i.test(url.hostname)) fail('INVALID_EVIDENCE_REFERENCE');
  }
  if (!Array.isArray(m.files) || !m.files.length || m.files.length > 10) fail('INVALID_FILES');
  const paths = new Set(); let total = 0;
  for (const file of m.files) {
    keys(file, ['path','bytes','sha256']);
    const p = file.path;
    if (typeof p !== 'string' || p.length > 240 || !/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(p) ||
        p.split('/').some(s => !s || s === '.' || s === '..' || s.toLowerCase() === '.git') ||
        /^(?:\.github|users|home|private|tmp|var)(?:\/|$)/i.test(p) ||
        !/^(?:tools|docs|data|assets|asset_sources|remake)\//.test(p) ||
        paths.has(p) || !integer(file.bytes) || !HEX64.test(file.sha256)) fail('INVALID_FILES');
    paths.add(p); total += file.bytes;
  }
  if (total > MAX_BYTES) fail('PAYLOAD_TOO_LARGE');
  return freeze(m);
}

function makePlan(envelope, payload) {
  keys(envelope, ['approval_comment','approval_sha256','manifest']);
  if (!integer(envelope.approval_comment) || !HEX64.test(envelope.approval_sha256)) fail('INVALID_INPUT');
  const manifest = validateManifest(envelope.manifest);
  if (!Array.isArray(payload) || payload.length !== manifest.files.length) fail('PAYLOAD_MISMATCH');
  const files = [], seen = new Set();
  for (const value of payload) {
    keys(value, ['path','content']);
    if (typeof value.content !== 'string' || value.content.length > Math.ceil(MAX_BYTES / 3) * 4 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.content)) fail('PAYLOAD_MISMATCH');
    const bytes = Buffer.from(value.content, 'base64'), file = manifest.files.find(f => f.path === value.path);
    if (!file || seen.has(value.path) || bytes.toString('base64') !== value.content ||
        file.bytes !== bytes.length || file.sha256 !== sha256(bytes)) fail('PAYLOAD_MISMATCH');
    try { new TextDecoder('utf-8', {fatal:true}).decode(bytes); } catch { fail('UNSUPPORTED_FILE'); }
    if (bytes.includes(0)) fail('UNSUPPORTED_FILE');
    seen.add(value.path); files.push({...file, content:bytes.toString('base64')});
  }
  const detached = {approval_comment:envelope.approval_comment, approval_sha256:envelope.approval_sha256, manifest};
  return freeze({envelope:detached, manifest, manifestDigest:sha256(canonical(manifest)),
    branch:'codex/recovery/issue-' + manifest.issue + '/' + manifest.request_id, files});
}

async function call(context, method, path, body, phase = 'preflight') {
  try { return await context.api(method, path, body); }
  catch (error) {
    if (error instanceof PreservationError) throw error;
    if (error.status === 403 || error.status === 401) fail('GITHUB_FORBIDDEN', phase);
    if (error.status === 404 && method === 'GET') return null;
    fail(method === 'GET' ? 'GITHUB_READ_FAILED' : 'WRITE_OUTCOME_UNKNOWN', phase);
  }
}
async function pages(context, path) {
  const all = [];
  for (let page = 1; page <= 100; page++) {
    const data = await call(context, 'GET', path + (path.includes('?') ? '&' : '?') + 'per_page=100&page=' + page);
    if (!Array.isArray(data) || data.length > 100) fail('INCOMPLETE_READ');
    all.push(...data); if (data.length < 100) return all;
  }
  fail('INCOMPLETE_READ');
}
function manifestFromComment(body) {
  if (typeof body !== 'string' || Buffer.byteLength(body) > 100000) fail('INVALID_APPROVAL');
  const matches = [...body.matchAll(/^<!-- issue-preservation:v1 (.+) -->$/gm)];
  if (matches.length !== 1) fail('INVALID_APPROVAL');
  return validateManifest(parseJson(matches[0][1]));
}
function referencesIssue(pr, issue) {
  const text = (pr.title || '') + '\n' + (pr.body || '');
  return new RegExp('(?:^|[^0-9])#' + issue + '(?![0-9])').test(text) ||
    text.includes('https://github.com/' + REPO + '/issues/' + issue) ||
    text.includes(REPO + '#' + issue);
}
async function permission(context, login) {
  if (typeof login !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(login)) fail('PERMISSION_UNVERIFIED');
  const data = await call(context, 'GET', ROOT + '/collaborators/' + login + '/permission');
  if (!writers.has(data?.permission)) fail('PERMISSION_UNVERIFIED');
  return data.permission;
}

async function verifyState(plan, context) {
  const m = plan.manifest;
  const repo = await call(context, 'GET', ROOT);
  if (repo?.full_name !== REPO || repo.default_branch !== 'main' || repo.archived || repo.disabled) fail('REPOSITORY_CHANGED');
  const actorPermission = await permission(context, context.actor);
  const issue = await call(context, 'GET', ROOT + '/issues/' + m.issue);
  if (!issue || issue.number !== m.issue || issue.pull_request || issue.state !== 'open' ||
      !Array.isArray(issue.labels) || issue.labels.some(l => ['blocked','status:blocked'].includes(typeof l === 'string' ? l : l.name))) fail('ISSUE_UNAVAILABLE');
  const comments = await pages(context, ROOT + '/issues/' + m.issue + '/comments');
  const marker = /^<!-- issue-claim:v1 state=(claimed|released) owner=([a-zA-Z0-9._-]+) -->/;
  const ledger = comments.filter(c => c.user?.login === 'github-actions[bot]' && marker.test(c.body || '')).at(-1);
  const state = ledger?.body.match(marker);
  const run = ledger?.body.match(/^<!-- issue-claim-run:v1 id=([1-9][0-9]*) request=([a-zA-Z0-9._-]*) -->$/m);
  if (ledger?.id !== m.claim_comment || state?.[1] !== 'claimed' || state?.[2] !== m.from || run?.[1] !== m.claim_run) fail('CLAIM_CHANGED');
  const approval = await call(context, 'GET', ROOT + '/issues/comments/' + plan.envelope.approval_comment);
  if (approval?.id !== plan.envelope.approval_comment || approval.issue_url !== 'https://api.github.com' + ROOT + '/issues/' + m.issue ||
      sha256(approval.body || '') !== plan.envelope.approval_sha256 ||
      canonical(manifestFromComment(approval.body)) !== canonical(m)) fail('APPROVAL_CHANGED');
  if (context.actor !== approval.user?.login) fail('APPROVAL_ACTOR_MISMATCH');
  const authorPermission = await permission(context, approval.user?.login);
  const revoked = '<!-- issue-preservation-revoked:v1 request=' + m.request_id + ' -->';
  for (const comment of comments) {
    if (comment.body?.split('\n').includes(revoked)) {
      const p = await call(context, 'GET', ROOT + '/collaborators/' + encodeURIComponent(comment.user?.login || '') + '/permission');
      if (writers.has(p?.permission)) fail('APPROVAL_REVOKED');
    }
  }
  const source = await call(context, 'GET', ROOT + '/actions/runs/' + m.claim_run);
  if (String(source?.id) !== m.claim_run || source.status !== 'completed' || source.conclusion !== 'success' ||
      source.path !== '.github/workflows/issue-claim.yml' || source.event !== 'workflow_dispatch' || source.head_branch !== 'main') fail('SOURCE_RUN_INVALID');
  if (source.actor?.login !== approval.user?.login && !(actorPermission === 'admin' && authorPermission === 'admin')) fail('APPROVAL_ACTOR_MISMATCH');
  const main = await call(context, 'GET', ROOT + '/git/ref/heads/main');
  if (main?.object?.sha !== m.base) fail('MAIN_CHANGED');
  for (const f of m.files) {
    const exists = await call(context, 'GET', ROOT + '/contents/' + f.path + '?ref=' + m.base);
    if (exists !== null) fail('EXISTING_PATH_UNSUPPORTED');
  }
  const prs = (await pages(context, ROOT + '/pulls?state=open')).filter(p => referencesIssue(p, m.issue));
  if (prs.some(p => p.head?.ref !== plan.branch || p.head?.repo?.full_name !== REPO ||
      p.base?.ref !== 'main' || p.draft !== true) || prs.length > 1) fail('OPEN_PR_CONFLICT');
  if (!context.runtime || typeof context.runtime.verify !== 'function') fail('UNSUPPORTED_FENCING');
  let proof; try { proof = await context.runtime.verify(m, plan.manifestDigest); } catch { fail('EVIDENCE_UNVERIFIED'); }
  if (proof?.stopped !== true || proof.inventoryComplete !== true || proof.fenced !== true ||
      proof.manifest_sha256 !== plan.manifestDigest || !Number.isSafeInteger(proof.expires_at) ||
      proof.expires_at <= Date.now()) fail('EVIDENCE_UNVERIFIED');
  return {prs};
}

async function verifySaved(plan, context, sha) {
  if (!HEX40.test(sha || '')) fail('SAVED_CONTENT_MISMATCH');
  const commit = await call(context, 'GET', ROOT + '/git/commits/' + sha);
  if (commit?.sha !== sha || commit.parents?.length !== 1 || commit.parents[0].sha !== plan.manifest.base ||
      !HEX40.test(commit.tree?.sha || '')) fail('SAVED_CONTENT_MISMATCH');
  const diff = await call(context, 'GET', ROOT + '/compare/' + plan.manifest.base + '...' + sha);
  if (!diff || diff.status !== 'ahead' || diff.ahead_by !== 1 || diff.behind_by !== 0 ||
      !Array.isArray(diff.files) || diff.files.length !== plan.files.length) fail('SAVED_CONTENT_MISMATCH');
  const trees = new Map();
  async function treeEntry(path, expectedBlob) {
    let treeSha = commit.tree.sha;
    const segments = path.split('/');
    for (let at = 0; at < segments.length; at++) {
      if (!trees.has(treeSha)) {
        const tree = await call(context, 'GET', ROOT + '/git/trees/' + treeSha);
        if (tree?.sha !== treeSha || tree.truncated !== false || !Array.isArray(tree.tree)) fail('SAVED_CONTENT_MISMATCH');
        trees.set(treeSha, tree.tree);
      }
      const matches = trees.get(treeSha).filter(entry => entry.path === segments[at]);
      if (matches.length !== 1) fail('SAVED_CONTENT_MISMATCH');
      const entry = matches[0];
      if (at === segments.length - 1) {
        if (entry.type !== 'blob' || entry.mode !== '100644' || entry.sha !== expectedBlob) fail('SAVED_CONTENT_MISMATCH');
      } else {
        if (entry.type !== 'tree' || entry.mode !== '040000' || !HEX40.test(entry.sha || '')) fail('SAVED_CONTENT_MISMATCH');
        treeSha = entry.sha;
      }
    }
  }
  for (const file of plan.files) {
    const saved = diff.files.filter(f => f.filename === file.path);
    if (saved.length !== 1 || saved[0].status !== 'added' || !HEX40.test(saved[0].sha || '')) fail('SAVED_CONTENT_MISMATCH');
    await treeEntry(file.path, saved[0].sha);
    const blob = await call(context, 'GET', ROOT + '/git/blobs/' + saved[0].sha);
    if (blob?.sha !== saved[0].sha || blob.encoding !== 'base64' || blob.size !== file.bytes ||
        typeof blob.content !== 'string' || blob.content.length > Math.ceil(MAX_BYTES / 3) * 4 + 20000) fail('SAVED_CONTENT_MISMATCH');
    const encoded = blob.content.replace(/\n/g, '');
    const bytes = Buffer.from(encoded, 'base64');
    const gitBlob = crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    if (encoded !== file.content || sha256(bytes) !== file.sha256 || gitBlob !== saved[0].sha) fail('SAVED_CONTENT_MISMATCH');
  }
}

async function assertHead(plan, context, expected) {
  const ref = await call(context, 'GET', ROOT + '/git/ref/heads/' + plan.branch);
  if (ref?.object?.sha !== expected) fail('RECOVERY_HEAD_CHANGED');
}

async function preserve(envelope, payload, context) {
  const plan = makePlan(envelope, payload); // Detached bytes before the first await.
  let state = await verifyState(plan, context);
  const existing = await call(context, 'GET', ROOT + '/git/ref/heads/' + plan.branch);
  if (existing) {
    if (state.prs.length !== 1 || existing.object?.sha === plan.manifest.base) fail('PARTIAL_PRESERVATION');
    const sha = existing.object?.sha;
    await verifySaved(plan, context, sha);
    state = await verifyState(plan, context);
    await assertHead(plan, context, sha);
    if (state.prs.length !== 1 || state.prs[0].head.sha !== sha) fail('SAVED_CONTENT_MISMATCH');
    return {state:'preserved', issue:plan.manifest.issue, branch:plan.branch, head:sha, pr:state.prs[0].number, reused:true};
  }
  if (state.prs.length) fail('RECOVERY_HEAD_CHANGED');
  await verifyState(plan, context);
  await call(context, 'POST', ROOT + '/git/refs', {ref:'refs/heads/' + plan.branch, sha:plan.manifest.base}, 'create-ref');
  await verifyState(plan, context);
  await assertHead(plan, context, plan.manifest.base);
  const result = await call(context, 'POST', '/graphql', {
    query:'mutation($input:CreateCommitOnBranchInput!){createCommitOnBranch(input:$input){commit{oid}}}',
    variables:{input:{branch:{repositoryNameWithOwner:REPO, branchName:plan.branch}, expectedHeadOid:plan.manifest.base,
      message:{headline:'Preserve issue ' + plan.manifest.issue + ' request ' + plan.manifest.request_id},
      fileChanges:{additions:plan.files.map(f => ({path:f.path, contents:f.content}))}}}
  }, 'create-commit');
  if (result?.errors) fail('WRITE_OUTCOME_UNKNOWN', 'create-commit');
  const head = result?.data?.createCommitOnBranch?.commit?.oid;
  await verifySaved(plan, context, head);
  state = await verifyState(plan, context);
  if (state.prs.length) fail('OPEN_PR_CONFLICT');
  await assertHead(plan, context, head);
  const pr = await call(context, 'POST', ROOT + '/pulls', {
    title:'Preserve #' + plan.manifest.issue + ' (' + plan.manifest.request_id + ')',
    head:plan.branch, base:'main', draft:true,
    body:'Preservation only. Reservation and implementation authority remain unchanged.\n\nRefs #' + plan.manifest.issue +
      '\n\nRequest: ' + plan.manifest.request_id + '\nManifest SHA-256: ' + plan.manifestDigest +
      '\nSource claim run: ' + plan.manifest.claim_run +
      '\nApproval: https://github.com/' + REPO + '/issues/' + plan.manifest.issue + '#issuecomment-' + plan.envelope.approval_comment +
      '\nTests and integration must be verified after formal transfer.'
  }, 'create-pr');
  if (!integer(pr?.number)) fail('WRITE_OUTCOME_UNKNOWN', 'create-pr');
  state = await verifyState(plan, context);
  await assertHead(plan, context, head);
  await verifySaved(plan, context, head);
  if (state.prs.length !== 1 || state.prs[0].number !== pr.number || state.prs[0].head.sha !== head) fail('SAVED_CONTENT_MISMATCH');
  return {state:'preserved', issue:plan.manifest.issue, branch:plan.branch, head, pr:pr.number, reused:false};
}

function ghApi(method, path, body) {
  // No shell, token extraction, alternate credential, install or permission changes.
  if (method !== 'GET') fail('PRODUCTION_PUBLISH_DISABLED');
  try {
    const output = execFileSync('gh', ['api','--method','GET',path], {encoding:'utf8',timeout:30000,maxBuffer:4*MAX_BYTES,stdio:['ignore','pipe','pipe']});
    return parseJson(output);
  } catch (error) {
    if (error instanceof PreservationError) throw error;
    const detail = String(error.stderr || '');
    if (/\b(?:401|403)\b/.test(detail)) throw Object.assign(new Error(), {status:403});
    if (/\b404\b/.test(detail)) throw Object.assign(new Error(), {status:404});
    throw Object.assign(new Error(), {status:0});
  }
}
async function runCli(argv, context = {}) {
  if (argv[0] !== 'check' || argv.length !== 7) fail('USAGE');
  const args = {};
  for (let at = 1; at < argv.length; at += 2) {
    if (!['--issue','--approval-comment','--approval-sha256'].includes(argv[at]) || args[argv[at]] !== undefined) fail('USAGE');
    args[argv[at]] = argv[at + 1];
  }
  if (!/^[1-9][0-9]*$/.test(args['--issue']) || !/^[1-9][0-9]*$/.test(args['--approval-comment']) ||
      !HEX64.test(args['--approval-sha256'])) fail('USAGE');
  const ctx = {api:ghApi, actor:process.env.PRESERVATION_ACTOR, ...context};
  const approvalId = Number(args['--approval-comment']);
  const approval = await call(ctx, 'GET', ROOT + '/issues/comments/' + approvalId);
  const manifest = manifestFromComment(approval?.body);
  if (manifest.issue !== Number(args['--issue'])) fail('APPROVAL_CHANGED');
  const envelope = {approval_comment:approvalId, approval_sha256:args['--approval-sha256'], manifest};
  // A preflight has no source bytes and never calls preserve.
  const plan = freeze({envelope,manifest,manifestDigest:sha256(canonical(manifest)),
    branch:'codex/recovery/issue-' + manifest.issue + '/' + manifest.request_id});
  await verifyState(plan, ctx);
  return {state:'preflight-only', issue:manifest.issue, request_id:manifest.request_id, writable:false};
}
module.exports = {REPO, PreservationError, canonical, sha256, parseJson, makePlan, verifyState, preserve, runCli};
if (require.main === module) {
  runCli(process.argv.slice(2)).then(result => process.stdout.write(JSON.stringify(result) + '\n')).catch(error => {
    process.stderr.write(JSON.stringify({state:'blocked',code:error instanceof PreservationError ? error.code : 'INTERNAL_ERROR',
      phase:error instanceof PreservationError ? error.phase : 'preflight',writes_enabled:false}) + '\n');
    process.exitCode = 1;
  });
}
