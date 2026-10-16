'use strict';

const marker = /^<!-- issue-claim:v1 state=(claimed|released) owner=([a-zA-Z0-9._-]+) -->/;
const runMarker = /^<!-- issue-claim-run:v1 id=([1-9][0-9]*) request=([a-zA-Z0-9._-]*) -->$/m;

async function readClaim(github, context, number) {
  const comments = await github.paginate(github.rest.issues.listComments,
    {...context.repo, issue_number:number, per_page:100});
  const entry = comments.filter(c => c.user?.login === 'github-actions[bot]' && marker.test(c.body || '')).at(-1);
  if (!entry) return {state:'released', owner:null, run_id:null, comment_id:null, phase:'active', waiting:null};
  const match = entry.body.match(marker), source = entry.body.match(runMarker);
  const waitingLine = entry.body.match(/^<!-- issue-claim-wait:v1 (.+) -->$/m);
  let waiting = null;
  if (entry.body.includes('<!-- issue-claim-wait:')) {
    if (!waitingLine) throw Error('Invalid waiting checkpoint');
    waiting = JSON.parse(waitingLine[1]);
    if (!waiting || !Array.isArray(waiting.prs) || !waiting.prs.length ||
        new Set(waiting.prs.map(p => p.number)).size !== waiting.prs.length ||
        waiting.prs.some(p => !Number.isSafeInteger(p.number) || p.number < 1 || !/^[a-f0-9]{40}$/.test(p.head))) {
      throw Error('Invalid waiting checkpoint');
    }
  }
  return {state:match[1], owner:match[2], run_id:source?.[1] || null, comment_id:entry.id,
    phase:waiting ? 'waiting' : 'active', waiting,
    request_actor:entry.body.match(/^<!-- issue-claim-actor:v1 login=([a-zA-Z0-9-]+) -->$/m)?.[1] || null};
}

function referencesIssue(pr, number, context) {
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const short = new RegExp('(?:^|[^a-zA-Z0-9_./-])#' + number + '(?![0-9])');
  const fullName = context.repo.owner + '/' + context.repo.repo;
  const qualified = new RegExp('(?:^|[^a-zA-Z0-9_.-])' + escape(fullName) + '#' + number + '(?![0-9])');
  const url = new RegExp(escape(context.serverUrl || 'https://github.com') + '/' + escape(fullName) + '/issues/' + number + '(?![0-9])');
  return [pr.body || '', pr.title || ''].some(text => short.test(text) || qualified.test(text) || url.test(text));
}

async function referencingPRs(github, context, number, state = 'open') {
  const prs = await github.paginate(github.rest.pulls.list, {...context.repo, state, per_page:100});
  return prs.filter(pr => referencesIssue(pr, number, context));
}

async function successfulRun(github, context, id) {
  if (!id) throw Error('Reservation has no verifiable run');
  const {data} = await github.rest.actions.getWorkflowRun({...context.repo, run_id:Number(id)});
  if (data.status !== 'completed' || data.conclusion !== 'success') throw Error('Reservation run did not succeed');
  return data;
}

function snapshots(prs) {
  return prs.map(pr => ({number:pr.number, head:pr.head?.sha})).sort((a,b) => a.number - b.number);
}

async function validateWaiting(github, context, number, claim) {
  await successfulRun(github, context, claim.run_id);
  if (!claim.waiting) throw Error('Missing waiting checkpoint');
  const prs = await referencingPRs(github, context, number, 'all');
  const fullName = context.repo.owner + '/' + context.repo.repo;
  if (claim.waiting.prs.some(saved => !prs.some(pr => pr.number === saved.number && pr.head?.sha === saved.head &&
      pr.head.repo?.full_name === fullName && (pr.state === 'open' || pr.merged_at))) ||
      prs.some(pr => pr.state === 'open' && !claim.waiting.prs.some(saved => saved.number === pr.number))) {
    throw Error('Waiting PR checkpoint changed; refresh it before switching work');
  }
}

async function coordinate(github, context, core, inputs = process.env) {
  const {owner: repoOwner, repo} = context.repo;
  const op = inputs.OPERATION;
  const worker = inputs.OWNER;
  const agent = inputs.AGENT;
  const request = inputs.REQUEST_ID || '';
  const expectedRun = inputs.CLAIM_RUN || '';
  const handoffComment = inputs.HANDOFF_COMMENT || '';
  if (!['next', 'claim', 'release', 'status', 'transfer', 'park', 'resume'].includes(op)) throw Error('Invalid operation');
  if (!['codex', 'claude', 'any'].includes(agent)) throw Error('Invalid agent');
  if (request && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$/.test(request)) throw Error('Invalid request ID');
  if (expectedRun && (!['status', 'transfer', 'park', 'resume'].includes(op) || !/^[1-9][0-9]*$/.test(expectedRun))) throw Error('Invalid claim run');
  if (['park', 'resume'].includes(op) && !expectedRun) throw Error('Park/resume requires current claim run');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$/.test(worker)) throw Error('Invalid owner ID');
  if (op === 'transfer' && (!expectedRun || !/^[1-9][0-9]*$/.test(handoffComment))) throw Error('Transfer requires claim run and approval comment');
  if (op !== 'transfer' && handoffComment) throw Error('Approval comment is only for transfer');
  const rawIssue = (inputs.ISSUE || '').trim();
  if (op !== 'next' && !/^[1-9][0-9]*$/.test(rawIssue)) throw Error('Specify a valid issue number');
  async function status(number) {
    return readClaim(github, context, number);
  }
  async function comment(number,state,detail = '', waiting = null) {
    const body = '<!-- issue-claim:v1 state=' + state + ' owner=' + worker + ' -->\n' +
      '<!-- issue-claim-run:v1 id=' + context.runId + ' request=' + request + ' -->\n' +
      (context.verifiedRequester ? '<!-- issue-claim-actor:v1 login=' + context.verifiedRequester + ' -->\n' : '') +
      (waiting ? '<!-- issue-claim-wait:v1 ' + JSON.stringify(waiting) + ' -->\n' : '') +
      (state === 'claimed' ? 'Reserved by ' + worker + ' (' + agent + '). Start only after this workflow run succeeds.' : 'Released by ' + worker + '.') + detail;
    await github.rest.issues.createComment({owner:repoOwner,repo,issue_number:number,body});
  }
  async function issue(number) {
    const {data} = await github.rest.issues.get({owner:repoOwner,repo,issue_number:number});
    if (data.labels.some(l => ['blocked','status:blocked'].includes(typeof l === 'string' ? l : l.name))) throw Error('Blocked issue: #' + number);
    if (data.pull_request || data.state !== 'open') throw Error('Not an open issue: #' + number);
    return data;
  }
  async function openPRs(number) {
    return referencingPRs(github, context, number);
  }
  async function ensureNoOpenPR(number) {
    if ((await openPRs(number)).length) {
      throw Error('Open PR already references issue #' + number);
    }
  }
  async function ensureCommentOwner(claim) {
    if (!context.verifiedRequester) return;
    let actor = claim.request_actor;
    if (!actor && claim.run_id) {
      const {data: run} = await github.rest.actions.getWorkflowRun({...context.repo,run_id:Number(claim.run_id)});
      actor = run.actor?.login;
    }
    if (!actor || actor !== context.verifiedRequester) throw Error('Owner operation requires the original reservation requester; use reviewed transfer/recovery otherwise');
  }
  async function ensureWorkerAvailable(number) {
    const all = await github.paginate(github.rest.issues.listForRepo, {owner:repoOwner,repo,state:'all',per_page:100});
    for (const item of all) {
      if (item.pull_request || item.number === number) continue;
      const active = await status(item.number);
      if (active.state !== 'claimed' || active.owner !== worker) continue;
      if (item.state === 'closed' && await cleanupCompleted(github, context, core, item.number)) continue;
      if (active.phase !== 'waiting') throw Error('Worker already owns #' + item.number + '; park saved work or release it before switching.');
      await validateWaiting(github, context, item.number, active);
    }
  }
  if (op === 'park' || op === 'resume') {
    const number = Number(rawIssue);
    await issue(number);
    const claim = await status(number);
    if (claim.state !== 'claimed' || claim.owner !== worker || claim.run_id !== expectedRun) throw Error('Claim no longer matches owner/run');
    await ensureCommentOwner(claim);
    await successfulRun(github, context, expectedRun);
    if (op === 'resume') {
      if (claim.phase !== 'waiting') throw Error('Only waiting work needs resume');
      await validateWaiting(github, context, number, claim);
      await ensureWorkerAvailable(number);
    }
    const prs = await openPRs(number);
    if (!prs.length || prs.some(pr => pr.head?.repo?.full_name !== repoOwner + '/' + repo || !/^[a-f0-9]{40}$/.test(pr.head?.sha))) {
      throw Error('Park/resume requires saved same-repository Open PR heads');
    }
    const saved = snapshots(prs);
    await issue(number);
    const latest = await status(number);
    if (latest.comment_id !== claim.comment_id || latest.owner !== worker || latest.run_id !== expectedRun ||
        JSON.stringify(snapshots(await openPRs(number))) !== JSON.stringify(saved)) throw Error('Reservation or saved PR heads changed');
    await comment(number,'claimed', op === 'park' ? '\nSaved review wait; do not edit until resume succeeds.' : '\nResumed saved work.',
      op === 'park' ? {prs:saved} : null);
    core.notice('CLAIMED_ISSUE=' + number + ' OWNER=' + worker);
    core.notice((op === 'park' ? 'PARKED_ISSUE=' : 'RESUMED_ISSUE=') + number + ' RUN=' + context.runId);
    await core.summary.addRaw(op + ' #' + number + '; use this successful run as the current reservation run.').write();
  } else if (op === 'transfer') {
    const number = Number(rawIssue);
    const existing = await issue(number);
    async function requireWriter(username) {
      const {data} = await github.rest.repos.getCollaboratorPermissionLevel({owner:repoOwner,repo,username});
      if (!['write', 'maintain', 'admin'].includes(data.permission)) throw Error('Transfer requires repository write permission');
      return data.permission;
    }
    const actorPermission = await requireWriter(context.actor);
    const {data: approval} = await github.rest.issues.getComment({owner:repoOwner,repo,comment_id:Number(handoffComment)});
    if (approval.issue_url !== existing.url) throw Error('Approval must belong to the target Issue');
    const authorPermission = await requireWriter(approval.user?.login);
    const adminRecovery = actorPermission === 'admin' && authorPermission === 'admin';
    const record = approval.body?.match(/^<!-- issue-handoff:v1 (.+) -->$/m);
    if (!record) throw Error('Missing structured stopped/pushed handoff record');
    const handoff = JSON.parse(record[1]);
    if (handoff.issue !== number || handoff.to !== worker || handoff.claim_run !== expectedRun ||
        typeof handoff.from !== 'string' || handoff.from === worker ||
        handoff.stopped !== true || handoff.pushed !== true || !Array.isArray(handoff.prs) || !handoff.prs.length) {
      throw Error('Approval does not match stopped/pushed owner, Issue, worker and claim run');
    }
    const recovery = handoff.recovery;
    if ('recovery' in handoff && !adminRecovery) throw Error('Legacy recovery requires repository admin approval and dispatch');
    if ('recovery' in handoff && (!recovery || !Number.isSafeInteger(recovery.claim_comment) ||
        !Number.isSafeInteger(recovery.released_comment) || recovery.claim_comment < 1 ||
        recovery.released_comment < 1 || recovery.claim_comment === recovery.released_comment)) {
      throw Error('Legacy recovery requires exact original claim and released comment IDs');
    }
    async function validateTransfer() {
      await issue(number);
      const claim = await status(number);
      let originalLegacyClaim;
      if (recovery) {
        const comments = await github.paginate(github.rest.issues.listComments, {owner:repoOwner,repo,issue_number:number,per_page:100});
        const ledger = comments.filter(c => c.user?.login === 'github-actions[bot]' && marker.test(c.body || ''));
        originalLegacyClaim = ledger.at(-2);
        const original = originalLegacyClaim?.body.match(marker);
        if (claim.state !== 'released' || claim.owner !== handoff.from || claim.run_id !== null ||
            claim.comment_id !== recovery.released_comment || ledger.at(-1)?.id !== recovery.released_comment ||
            ledger.at(-1)?.body.includes('<!-- issue-claim-run:') ||
            originalLegacyClaim?.id !== recovery.claim_comment || original?.[1] !== 'claimed' ||
            original?.[2] !== handoff.from || originalLegacyClaim.body.includes('<!-- issue-claim-run:')) {
          throw Error('Legacy recovery does not match the last bot claim/release pair');
        }
      } else if (claim.state !== 'claimed' || claim.owner !== handoff.from || claim.run_id !== expectedRun) {
        throw Error('Current reservation does not match approved original owner/run');
      }
      const {data: sourceRun} = await github.rest.actions.getWorkflowRun({owner:repoOwner,repo,run_id:Number(expectedRun)});
      if (sourceRun.status !== 'completed' || sourceRun.conclusion !== 'success') throw Error('Original claim run did not succeed');
      const originalActor = claim.request_actor || sourceRun.actor?.login;
      if (!adminRecovery && (!originalActor || originalActor !== approval.user?.login)) {
        throw Error('Handoff record must be written by the original claim actor; otherwise use admin recovery');
      }
      if (recovery) {
        // Legacy comments have no run ID: bind the exact bot claim to a first-attempt
        // coordinator run on the default branch by its creation time. Admin review is
        // still required; a timestamp does not establish stopped session status.
        const created = Date.parse(originalLegacyClaim.created_at);
        const started = Date.parse(sourceRun.run_started_at);
        const finished = Date.parse(sourceRun.updated_at);
        if (sourceRun.id !== Number(expectedRun) || sourceRun.path !== '.github/workflows/issue-claim.yml' ||
            sourceRun.event !== 'workflow_dispatch' || sourceRun.run_attempt !== 1 ||
            !context.payload?.repository?.default_branch || sourceRun.head_branch !== context.payload.repository.default_branch ||
            ![created, started, finished].every(Number.isFinite) || created < started || created > finished) {
          throw Error('Original legacy claim is not bound to the approved coordinator run');
        }
      }
      const prs = await openPRs(number);
      if (prs.length !== handoff.prs.length || new Set(handoff.prs.map(p => p.number)).size !== handoff.prs.length ||
          handoff.prs.some(saved => !Number.isSafeInteger(saved.number) || !/^[a-f0-9]{40}$/.test(saved.head) ||
            !prs.some(pr => pr.number === saved.number && pr.head.sha === saved.head &&
              pr.head.repo?.full_name === repoOwner + '/' + repo))) {
        throw Error('Referencing Open PR set/head changed or approval is incomplete');
      }
      const {data: currentApproval} = await github.rest.issues.getComment({owner:repoOwner,repo,comment_id:Number(handoffComment)});
      if (currentApproval.body !== approval.body || currentApproval.user?.login !== approval.user?.login ||
          currentApproval.issue_url !== existing.url) throw Error('Handoff record changed during transfer');
    }
    await validateTransfer();
    await ensureWorkerAvailable(number);
    await validateTransfer();
    // One bot ledger write replaces ownership without an unreserved release/claim gap.
    await comment(number,'claimed','\nTransferred from ' + handoff.from + ' using verified handoff: ' + approval.html_url +
      (recovery ? '\nRecovered legacy claim/release comments ' + recovery.claim_comment + '/' + recovery.released_comment + '.' : ''));
    core.notice('CLAIMED_ISSUE=' + number + ' OWNER=' + worker);
    core.notice('TRANSFERRED_ISSUE=' + number + ' FROM=' + handoff.from + ' APPROVAL=' + handoffComment);
    await core.summary.addRaw('Transferred #' + number + ' to ' + worker + '; after this run succeeds, verify the current bot ledger owner/run before editing. A separate status dispatch is optional.').write();
  } else if (op === 'status') {
    const number = Number(rawIssue);
    const {data: existing} = await github.rest.issues.get({owner:repoOwner,repo,issue_number:number});
    if (existing.pull_request) throw Error('Not an issue');
    const claim = await status(number);
    core.notice('CLAIM_STATUS=' + JSON.stringify({number,...claim}));
    if (expectedRun) {
      await issue(number);
      if (claim.state !== 'claimed' || claim.owner !== worker || claim.run_id !== expectedRun) throw Error('Claim no longer matches owner/run; do not start work');
      if (claim.phase === 'waiting') throw Error('Work is parked for review; resume before editing');
      const {data: sourceRun} = await github.rest.actions.getWorkflowRun({owner:repoOwner,repo,run_id:Number(expectedRun)});
      if (sourceRun.status !== 'completed' || sourceRun.conclusion !== 'success') throw Error('Claim run did not succeed; release or inspect before retrying');
      core.notice('CLAIM_VALIDATED_ISSUE=' + number + ' OWNER=' + worker + ' RUN=' + expectedRun);
    }
    await core.summary.addRaw('Current claim: ' + JSON.stringify({number,...claim})).write();
  } else if (op === 'release') {
    const number = Number(rawIssue);
    const {data: existing} = await github.rest.issues.get({owner:repoOwner,repo,issue_number:number});
    if (existing.pull_request) throw Error('Not an issue');
    const claim = await status(number);
    if (claim.state !== 'claimed' || claim.owner !== worker) throw Error('Only the current owner can release #' + number);
    await ensureCommentOwner(claim);
    await comment(number,'released');
    await core.summary.addRaw('Released #' + number).write();
  } else {
    let candidates = [];
    if (op === 'claim') candidates = [Number(rawIssue)];
    else {
      const all = await github.paginate(github.rest.issues.listForRepo,{owner:repoOwner,repo,state:'open',per_page:100});
      const ranks = {S:0,A:1,B:2,C:3,D:4};
      candidates = all.filter(i => !i.pull_request).map(i => {
        const labels = i.labels.map(l => typeof l === 'string' ? l : l.name);
        const d = labels.find(l => /^difficulty:[SABCD]$/.test(l));
        const priority = /^\[P([0-2])\]/.exec(i.title)?.[1];
        return {number:i.number, difficulty:d ? ranks[d.split(':')[1]] : 99, priority:priority===undefined?3:Number(priority), title:i.title, labels};
      }).filter(i => i.difficulty !== 99)
        .filter(i => !i.labels.some(l => l === 'blocked' || l === 'status:blocked'))
        .sort((a,b) => a.difficulty-b.difficulty || a.priority-b.priority || a.number-b.number)
        .map(i => i.number);
    }
    let selected = null;
    for (const number of candidates) {
      try {
        await issue(number);
        const claim = await status(number);
        if (claim.state === 'claimed') {
          throw Error('Already claimed by ' + claim.owner);
        }
        await ensureNoOpenPR(number);
        selected = number;
        break;
      } catch(e) { if(op === 'claim') throw e; core.info('Skip #' + number + ': ' + e.message); }
    }
    if (!selected) throw Error('No available issue; inspect reservations or add eligible work.');
    // Waiting PRs keep their exclusive Issue reservation without occupying active work.
    await ensureWorkerAvailable(selected);
    // Recheck immediately before writing the reservation. All successful workflow runs
    // share a concurrency group; a canceled pending run must be retried by its caller.
    await issue(selected);
    await ensureNoOpenPR(selected);
    const latest = await status(selected);
    if (latest.state === 'claimed') throw Error('Issue claimed during selection; retry with a new run.');
    await comment(selected,'claimed');
    core.notice('CLAIMED_ISSUE=' + selected + ' OWNER=' + worker);
    await core.summary.addRaw('Claim confirmed: #' + selected + ' by ' + worker).write();
  }
}

async function cleanupCompleted(github, context, core, number) {
  async function evidence() {
    const {data: issue} = await github.rest.issues.get({...context.repo, issue_number:number});
    if (issue.pull_request || issue.state !== 'closed' || issue.state_reason !== 'completed' ||
        issue.labels.some(l => ['blocked','status:blocked'].includes(typeof l === 'string' ? l : l.name))) return null;
    const claim = await readClaim(github, context, number);
    if (claim.state !== 'claimed' || !claim.run_id) return null;
    await successfulRun(github, context, claim.run_id);
    const prs = await referencingPRs(github, context, number, 'all');
    if (prs.some(pr => pr.state === 'open')) return null;
    const fullName = context.repo.owner + '/' + context.repo.repo;
    const defaultBranch = context.payload.repository?.default_branch ||
      (await github.rest.repos.get(context.repo)).data.default_branch;
    if (!defaultBranch) throw Error('Default branch is unknown; preserve completed claim');
    const merged = prs.filter(pr => pr.merged_at && pr.base?.ref === defaultBranch &&
      pr.head?.repo?.full_name === fullName);
    return merged.length ? {claim, saved:snapshots(merged)} : null;
  }
  const initial = await evidence();
  if (!initial) return false;
  const latest = await evidence();
  if (!latest || latest.claim.comment_id !== initial.claim.comment_id || latest.claim.owner !== initial.claim.owner ||
      latest.claim.run_id !== initial.claim.run_id || JSON.stringify(latest.saved) !== JSON.stringify(initial.saved)) return false;
  await github.rest.issues.createComment({...context.repo, issue_number:number,
    body:'<!-- issue-claim:v1 state=released owner=' + latest.claim.owner + ' -->\n' +
      '<!-- issue-claim-run:v1 id=' + context.runId + ' request=completion-cleanup -->\n' +
      'Automatically released the recorded owner after Issue completion and merged PR verification.\n' +
      'Merged PRs: ' + latest.saved.map(pr => '#' + pr.number + ' @ ' + pr.head).join(', ')});
  core.notice('AUTO_RELEASED_ISSUE=' + number + ' OWNER=' + latest.claim.owner);
  return true;
}

const policyStart = '<!-- issue-claim-policy:v2:start -->';
const policyEnd = '<!-- issue-claim-policy:v2:end -->';
const staleProcedure = /claim\s*[\/→]\s*status|status(?:検証)?成功|1\s*worker\s*1|一度に1件|管理者[^\n]*(?:transfer|移管)/i;
function policyBody(body, context, historicalProcedure = false) {
  body = body || '';
  const prior = new RegExp(policyStart + '[\\s\\S]*?' + policyEnd + '\\n*');
  if ((body.includes(policyStart) || body.includes(policyEnd)) && !prior.test(body)) throw Error('Incomplete policy block; preserve Issue body for manual review');
  if (!prior.test(body) && !staleProcedure.test(body) && !historicalProcedure) return body;
  const rest = body.replace(prior,'');
  const guide = (context.serverUrl || 'https://github.com') + '/' + context.repo.owner + '/' + context.repo.repo + '/blob/main/docs/issue_claim_protocol.md';
  return policyStart + '\n### 現行の共通作業手順（自動同期）\n' +
    '- [予約手順](' + guide + ')を優先。本文・過去コメントの旧共通手順にある追加status起動は任意で、成功runと現在のbot台帳のowner/runを読み取り照合してよい。\n' +
    '- 実装中はworkerごとに1件。全変更をpushして保存PRをparkしたレビュー待ちは別枠で保持し、独立した別Issueをclaimできる。待ち中の編集はresume成功後に再開する。\n' +
    '- IssueまたはPRのConversationから `/issue-claim` JSONコマンドで予約できる（形式は上の予約手順）。writer権限と同じ排他処理を検証し、結果とrun成功を確認する。\n' +
    '- 個別の採用保留・検証条件・範囲指定・停止指示は維持。この欄は元担当の停止確認や未承認素材の採用を代行しない。\n' +
    policyEnd + '\n\n' + rest;
}

async function syncIssuePolicy(github, context, number) {
  const initial = await github.rest.issues.get({...context.repo, issue_number:number});
  const issue = initial.data;
  if (issue.pull_request || issue.state !== 'open') return false;
  const history = await github.paginate(github.rest.issues.listComments, {...context.repo, issue_number:number, per_page:100});
  const body = policyBody(issue.body, context, history.some(c => staleProcedure.test(c.body || '')));
  if (body === (issue.body || '')) return false;
  const fresh = await github.rest.issues.get({...context.repo, issue_number:number});
  if (fresh.data.body !== issue.body || fresh.data.state !== 'open') return false;
  await github.rest.issues.update({...context.repo, issue_number:number, body,
    ...(fresh.headers?.etag ? {headers:{'if-match':fresh.headers.etag}} : {})});
  return true;
}

async function maintain(github, context, core, number = null) {
  const targets = number ? [{number}] : await github.paginate(github.rest.issues.listForRepo,
    {...context.repo, state:'all', per_page:100});
  const result = {released:0, updated:0, errors:0};
  for (const target of targets) {
    if (target.pull_request) continue;
    try {
      if (await cleanupCompleted(github, context, core, target.number)) result.released++;
      if (await syncIssuePolicy(github, context, target.number)) result.updated++;
    } catch (error) {
      result.errors++;
      core.warning?.('Maintenance deferred for #' + target.number + ': ' + error.message);
    }
  }
  await core.summary.addRaw('Reservation maintenance: ' + JSON.stringify(result)).write();
  return result;
}

async function requireWriter(github, context, username) {
  const {data} = await github.rest.repos.getCollaboratorPermissionLevel({...context.repo, username});
  if (!['write','maintain','admin'].includes(data.permission)) throw Error('Comment requests require repository write permission');
}

async function runEvent(github, context, core, inputs = process.env) {
  const event = context.eventName || 'workflow_dispatch';
  if (event === 'issue_comment') {
    const eventComment = context.payload.comment;
    if (context.payload.action !== 'created' || eventComment?.user?.type === 'Bot' ||
        !eventComment?.body?.startsWith('/issue-claim ')) return;
    await requireWriter(github, context, eventComment.user.login);
    const {data: current} = await github.rest.issues.getComment({...context.repo, comment_id:eventComment.id});
    if (current.body !== eventComment.body || current.user?.login !== eventComment.user.login ||
        current.issue_url !== context.payload.issue.url) throw Error('Request comment changed or belongs to a different thread');
    if (current.body.length > 2000) throw Error('Request comment is too long');
    const raw = current.body.slice('/issue-claim '.length);
    const request = JSON.parse(raw);
    const allowed = ['operation','issue','owner','agent','request_id','claim_run','handoff_comment'];
    if (!request || Array.isArray(request) || typeof request !== 'object' || Object.keys(request).some(k => !allowed.includes(k)) ||
        Object.values(request).some(v => !['string','number'].includes(typeof v)) ||
        !['claim','release','status','transfer','park','resume','maintain'].includes(request.operation)) throw Error('Invalid comment request');
    const number = request.issue === undefined ? context.payload.issue.number : Number(request.issue);
    if (!Number.isSafeInteger(number) || number < 1) throw Error('Invalid target Issue');
    const comments = await github.paginate(github.rest.issues.listComments,
      {...context.repo, issue_number:context.payload.issue.number, per_page:100});
    const resultMarker = '<!-- issue-claim-request:v1 comment=' + current.id + ' -->';
    if (comments.some(c => c.user?.login === 'github-actions[bot]' && c.body?.startsWith(resultMarker))) return;
    let failure;
    try {
      if (request.operation === 'maintain') {
        const result = await maintain(github, context, core, number);
        if (result.errors) throw Error('Maintenance has deferred items');
      } else {
        // The caller identity is taken from the verified event, never from JSON input.
        await coordinate(github, {...context, actor:current.user.login, verifiedRequester:current.user.login}, core, {
          OPERATION:request.operation, ISSUE:String(number), OWNER:String(request.owner || ''),
          AGENT:String(request.agent || 'any'), REQUEST_ID:String(request.request_id || 'comment-' + current.id),
          CLAIM_RUN:String(request.claim_run || ''), HANDOFF_COMMENT:String(request.handoff_comment || '')});
      }
    } catch (error) { failure = error; }
    await github.rest.issues.createComment({...context.repo, issue_number:context.payload.issue.number,
      body:resultMarker + '\n' + (failure ? 'Request refused: ' + failure.message : 'Request recorded; wait for this workflow run to complete successfully.') +
        '\nRun: ' + (context.serverUrl || 'https://github.com') + '/' + context.repo.owner + '/' + context.repo.repo + '/actions/runs/' + context.runId});
    if (failure) throw failure;
    return;
  }
  if (event === 'workflow_dispatch' && inputs.OPERATION !== 'maintain') return coordinate(github, context, core, inputs);
  if (!['workflow_dispatch','issues','push','schedule'].includes(event)) throw Error('Unsupported event');
  if (event === 'workflow_dispatch') await requireWriter(github, context, context.actor);
  const number = event === 'issues' ? context.payload.issue?.number : (inputs.ISSUE ? Number(inputs.ISSUE) : null);
  if (number !== null && (!Number.isSafeInteger(number) || number < 1)) throw Error('Invalid maintenance Issue');
  const result = await maintain(github, context, core, number);
  if (result.errors) throw Error('Maintenance has deferred items; inspect the run summary');
}

async function drainRequests(github, context, core) {
  // Comments survive GitHub's replacement of pending concurrency runs. A later
  // successful run drains unacknowledged requests rather than losing them.
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const comments = await github.paginate(github.rest.issues.listCommentsForRepo,
    {...context.repo, since, sort:'created', direction:'asc', per_page:100});
  const prefix = (context.apiUrl || 'https://api.github.com') + '/repos/' + context.repo.owner + '/' + context.repo.repo + '/issues/';
  for (const comment of comments) {
    const created = Date.parse(comment.created_at);
    if (comment.user?.type === 'Bot' || !comment.body?.startsWith('/issue-claim ') ||
        !comment.issue_url?.startsWith(prefix) || !Number.isFinite(created) || created < Date.parse(since)) continue;
    const number = Number(comment.issue_url.slice(prefix.length));
    if (!Number.isSafeInteger(number) || number < 1) continue;
    try {
      const {data: issue} = await github.rest.issues.get({...context.repo, issue_number:number});
      await runEvent(github, {...context, eventName:'issue_comment',
        payload:{...context.payload, action:'created', issue, comment}}, core, {});
    } catch (error) {
      // A rejected queued request has its own result. It must not invalidate a
      // successful reservation recorded by another request in this same run.
      core.warning?.('Queued comment ' + comment.id + ' deferred/refused: ' + error.message);
    }
  }
}

async function runWorkflow(github, context, core, inputs = process.env) {
  await runEvent(github, context, core, inputs);
  try { await drainRequests(github, context, core); }
  catch (error) { core.warning?.('Pending comment recovery deferred: ' + error.message); }
}

module.exports = {coordinate, runEvent, runWorkflow, maintain, policyBody};
