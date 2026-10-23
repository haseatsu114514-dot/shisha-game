'use strict';

// Read-only inventory. This module does not decide whether a new claim is safe.
const CLAIM = /^<!-- issue-claim:v1 state=(claimed|released) owner=([a-zA-Z0-9._-]+) -->/;
const RUN = /^<!-- issue-claim-run:v1 id=([1-9][0-9]*) request=([a-zA-Z0-9._-]*) -->$/m;
const WAIT = /^<!-- issue-claim-wait:v1 (.+) -->$/m;
const BOT = 'github-actions[bot]';

function parsePaths(input = '') {
  if (typeof input !== 'string') throw Error('Candidate paths must be text');
  const paths = input.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  if (paths.length > 50) throw Error('At most 50 candidate paths may be diagnosed');
  for (const path of paths) {
    const parts = (path.endsWith('/') ? path.slice(0, -1) : path).split('/');
    if (path.startsWith('/') || path.includes('\\') || /[\x00-\x1f\x7f*?[\]]/.test(path) ||
        parts.some(part => !part || part === '.' || part === '..')) {
      throw Error('Invalid repository-relative path: ' + path);
    }
  }
  return [...new Set(paths)];
}

function overlap(a, b) {
  const dirA = a.endsWith('/'), dirB = b.endsWith('/');
  const pathA = (dirA ? a.slice(0, -1) : a).normalize('NFC').toLowerCase();
  const pathB = (dirB ? b.slice(0, -1) : b).normalize('NFC').toLowerCase();
  // A file at a parent path and a nested path cannot coexist in one Git tree.
  return pathA === pathB || pathB.startsWith(pathA + '/') || pathA.startsWith(pathB + '/');
}

function referencesIssue(pr, number, context) {
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fullName = context.repo.owner + '/' + context.repo.repo;
  const short = new RegExp('(?:^|[^a-zA-Z0-9_./-])#' + number + '(?![0-9])');
  const qualified = new RegExp('(?:^|[^a-zA-Z0-9_.-])' + escape(fullName) + '#' + number + '(?![0-9])');
  const url = new RegExp(escape(context.serverUrl || 'https://github.com') + '/' +
    escape(fullName) + '/issues/' + number + '(?![0-9])');
  return [pr.title || '', pr.body || ''].some(value => short.test(value) || qualified.test(value) || url.test(value));
}

function claimFromComment(comment) {
  const match = (comment.body || '').match(CLAIM);
  if (!match) return {state:'invalid', phase:'unknown', owner:null, run_id:null, checkpoint:null};
  const run = comment.body.match(RUN);
  const wait = comment.body.match(WAIT);
  let checkpoint = null, phase = 'active';
  if (comment.body.includes('<!-- issue-claim-wait:')) {
    try {
      if (!wait || (comment.body.match(/<!-- issue-claim-wait:/g) || []).length !== 1) throw Error('bad marker');
      checkpoint = JSON.parse(wait[1]);
      if (!checkpoint || !Array.isArray(checkpoint.prs) || !checkpoint.prs.length ||
          new Set(checkpoint.prs.map(pr => pr.number)).size !== checkpoint.prs.length ||
          checkpoint.prs.some(pr => !Number.isSafeInteger(pr.number) || pr.number < 1 ||
            !/^[a-f0-9]{40}$/.test(pr.head))) throw Error('bad checkpoint');
      if (match[1] !== 'claimed') throw Error('released record has waiting checkpoint');
      if ('handoff' in checkpoint) {
        const offer = checkpoint.handoff;
        if (!offer || Array.isArray(offer) || offer.version !== 1 || offer.from !== match[2] ||
            typeof offer.actor !== 'string' || !/^[a-zA-Z0-9-]+$/.test(offer.actor) ||
            typeof offer.source_run !== 'string' || !/^[1-9][0-9]*$/.test(offer.source_run) ||
            offer.stopped !== true || offer.pushed !== true || typeof offer.summary !== 'string' ||
            !offer.summary.trim() || offer.summary.length > 1200 || offer.summary.includes('<!-- issue-')) {
          throw Error('bad handoff checkpoint');
        }
      }
      phase = checkpoint.handoff ? 'handoff' : 'waiting';
    } catch (_) { phase = 'unknown'; checkpoint = null; }
  }
  return {state:match[1], owner:match[2], run_id:run?.[1] || null, phase, checkpoint};
}

function changedPaths(files) {
  return [...new Set(files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean)))].sort();
}

async function diagnose(github, context, candidatePaths = []) {
  const repo = context.repo, fullName = repo.owner + '/' + repo.repo;
  const comments = await github.paginate(github.rest.issues.listCommentsForRepo,
    {...repo, sort:'created', direction:'asc', per_page:100});
  const latest = new Map();
  for (const comment of comments) {
    if (comment.user?.login !== BOT || !comment.body?.startsWith('<!-- issue-claim:')) continue;
    const number = Number(comment.issue_url?.match(/\/issues\/([1-9][0-9]*)$/)?.[1]);
    if (!Number.isSafeInteger(number)) throw Error('Reservation marker has no valid Issue URL');
    if (!latest.has(number) || Number(comment.id) > Number(latest.get(number).id)) latest.set(number, comment);
  }
  const openPRs = await github.paginate(github.rest.pulls.list, {...repo, state:'open', per_page:100});
  const fileCache = new Map();
  async function filesFor(number) {
    if (!fileCache.has(number)) {
      const {data:pr} = await github.rest.pulls.get({...repo, pull_number:number});
      const files = await github.paginate(github.rest.pulls.listFiles,
        {...repo, pull_number:number, per_page:100});
      // GitHub caps this endpoint at 3,000 files. An incomplete list must not
      // appear to prove that a candidate path is disjoint from a saved PR.
      if (!Number.isSafeInteger(pr.changed_files) || pr.changed_files !== files.length) {
        throw Error('Incomplete changed-file list for PR #' + number);
      }
      fileCache.set(number, changedPaths(files));
    }
    return fileCache.get(number);
  }
  const rows = [];
  for (const [number, comment] of [...latest].sort((a,b) => a[0]-b[0])) {
    const claim = claimFromComment(comment);
    if (claim.state === 'released') continue;
    const {data:issue} = await github.rest.issues.get({...repo, issue_number:number});
    if (issue.pull_request) throw Error('Reservation marker is on a PR #' + number);
    let runVerified = false;
    if (claim.run_id) {
      const {data:run} = await github.rest.actions.getWorkflowRun({...repo, run_id:Number(claim.run_id)});
      runVerified = run.status === 'completed' && run.conclusion === 'success' &&
        run.path === '.github/workflows/issue-claim.yml' && run.repository?.full_name === fullName;
    }
    const prs = openPRs.filter(pr => referencesIssue(pr, number, context));
    const observed = [];
    for (const pr of prs) observed.push({number:pr.number, head:pr.head?.sha || null,
      paths:await filesFor(pr.number), source:'open-reference'});
    let checkpointVerified = null;
    if (claim.phase === 'waiting' || claim.phase === 'handoff') {
      checkpointVerified = true;
      for (const saved of claim.checkpoint.prs) {
        const {data:pr} = await github.rest.pulls.get({...repo, pull_number:saved.number});
        if (pr.head?.sha !== saved.head || pr.head?.repo?.full_name !== fullName ||
            !(pr.state === 'open' || pr.merged_at)) checkpointVerified = false;
        if (!observed.some(entry => entry.number === saved.number)) observed.push({number:saved.number,
          head:pr.head?.sha || null, paths:await filesFor(saved.number), source:'saved-checkpoint'});
      }
      if (prs.some(pr => !claim.checkpoint.prs.some(saved => saved.number === pr.number))) checkpointVerified = false;
    }
    const observedPaths = [...new Set(observed.flatMap(pr => pr.paths))].sort();
    const observedOverlap = candidatePaths.some(path => observedPaths.some(other => overlap(path, other)));
    let relation = 'inventory_only';
    if (candidatePaths.length) {
      if (!runVerified || claim.phase === 'unknown' || checkpointVerified === false || claim.state === 'invalid') relation = 'unverified';
      else if (observedOverlap) relation = 'observed_overlap';
      else if (checkpointVerified === true) relation = 'stopped_saved_diff_disjoint_resume_requires_review';
      else relation = 'active_future_scope_unknown';
    }
    const reviewRequired = !runVerified || claim.state === 'invalid' || claim.phase === 'unknown' ||
      checkpointVerified === false || claim.phase === 'active';
    rows.push({issue:number, issue_url:issue.html_url || `https://github.com/${fullName}/issues/${number}`,
      title:issue.title, state:claim.state, phase:claim.phase,
      owner:claim.owner, run_id:claim.run_id, ledger_comment_id:comment.id,
      run_verified:runVerified, checkpoint_verified:checkpointVerified,
      issue_state:issue.state, test_only:/\bTEST ONLY\b/i.test(issue.title || ''),
      prs:observed, observed_overlap:observedOverlap, relation, review_required:reviewRequired});
  }
  return {kind:'read_only_diagnostic', approval:false, generated_at:new Date().toISOString(),
    candidate_paths:candidatePaths, comments_scanned:comments.length, rows};
}

module.exports = {diagnose, parsePaths, overlap, referencesIssue};
