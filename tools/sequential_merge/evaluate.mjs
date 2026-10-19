// Pure evidence evaluator. No API calls, credentials, writes or merge adapter.
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const nonempty = value => typeof value === 'string' && value.length > 0;
const list = value => Array.isArray(value) ? value : [];
const requiredCollections = ['files', 'checks', 'statuses', 'reviews', 'threads',
  'comments', 'runs', 'jobs', 'workflows', 'openPulls', 'openFiles', 'rulesets'];
const requiredReads = ['mainBefore', 'pr', 'comparison', 'protection', 'prAfter', 'mainAfter'];

// Deliberately small glob language, not a YAML/GitHub trigger interpreter.
export function matches(path, pattern) {
  if (!nonempty(pattern) || /[!\[\]{}\\]/.test(pattern)) throw Error('unsupported glob');
  let expression = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      i++;
      if (pattern[i + 1] === '/') { i++; expression += '(?:.*/)?'; }
      else expression += '.*';
    } else if (c === '*') expression += '[^/]*';
    else if (c === '?') expression += '[^/]';
    else expression += c.replace(/[.*+?^${}()|\[\]\\]/g, '\\$&');
  }
  return new RegExp(expression + '$').test(path);
}

export function evaluate(snapshot, policy, now = Date.now()) {
  const reasons = new Set();
  const deny = code => reasons.add(code);
  let jobs = [], head = null, base = null;
  const result = () => ({status: reasons.size ? 'BLOCKED' : 'READY_FOR_RECHECK',
    executionEnabled: false, expectedHead: head, validatedBase: base,
    applicableJobs: jobs, reasons: [...reasons].sort()});
  try {
    if (policy?.schemaVersion !== 1 || policy.approved !== true) deny('POLICY_UNAPPROVED');
    if (policy.ciCoverageApproved !== true) deny('CI_SCOPE_UNAPPROVED');
    if (policy.serverPolicyApproved !== true) deny('SERVER_POLICY_UNAPPROVED');
    if (!positive(policy.maxAgeSeconds) || policy.maxAgeSeconds > 300) deny('INVALID_FRESHNESS_POLICY');
    if (!positive(policy.actionsAppId)) deny('CI_APP_UNCONFIGURED');
    const rules = list(policy.ciRules);
    if (!rules.length) deny('CI_RULES_EMPTY');
    const reviewers = list(policy.reviewerAllowlist);
    if (!reviewers.length || reviewers.some(r => !positive(r.id) || r.type !== 'User')) deny('REVIEWERS_UNCONFIGURED');
    if (!list(policy.recordAuthorities).length || policy.recordAuthorities.some(id => !positive(id))) deny('RECORD_AUTHORITIES_UNCONFIGURED');
    if (snapshot?.schemaVersion !== 1 || snapshot.repository !== policy.repository ||
        !/^[\w.-]+\/[\w.-]+$/.test(policy.repository) || policy.base !== 'main') deny('SNAPSHOT_SCOPE');
    const s = snapshot, pr = s.pr;
    head = pr.head.sha; base = s.mainBefore.commit.sha;
    if (!sha(head) || !sha(base)) deny('INVALID_SHA');
    if (s.policyBase !== base) deny('POLICY_NOT_FROM_CURRENT_MAIN');
    if (!positive(pr.number) || pr.state !== 'open' || pr.draft !== false || pr.merged !== false) deny('PR_NOT_READY');
    if (pr.base.ref !== policy.base || pr.base.repo.full_name !== policy.repository ||
        pr.head.repo.full_name !== policy.repository) deny('PR_SCOPE');
    if (pr.base.sha !== base || s.mainAfter.commit.sha !== base ||
        s.prAfter.head.sha !== head || s.prAfter.base.sha !== base ||
        s.prAfter.state !== 'open' || s.prAfter.draft !== false || s.prAfter.merged !== false) deny('HEAD_BASE_CHANGED');
    if (pr.mergeable !== true || pr.mergeable_state !== 'clean' ||
        s.prAfter.mergeable !== true || s.prAfter.mergeable_state !== 'clean') deny('MERGE_CONFLICT_OR_UNKNOWN');
    if (s.comparison.merge_base_commit.sha !== base ||
        !['ahead', 'identical'].includes(s.comparison.status)) deny('HEAD_MISSING_LATEST_MAIN');
    if (!Number.isFinite(now)) deny('INVALID_CLOCK');
    const fresh = timestamp => {
      const time = Date.parse(timestamp);
      return Number.isFinite(time) && time <= now && now - time <= policy.maxAgeSeconds * 1000;
    };
    if (!fresh(s.startedAt) || !fresh(s.finishedAt) || Date.parse(s.startedAt) > Date.parse(s.finishedAt)) deny('EVIDENCE_STALE');
    if (!Array.isArray(s.errors) || s.errors.length) deny('FETCH_FAILED');
    for (const name of requiredCollections) {
      if (s.complete?.[name] !== true || !Array.isArray(s[name])) deny(`INCOMPLETE_${name.toUpperCase()}`);
    }
    for (const name of requiredReads) {
      if (s.complete?.[name] !== true || !s[name] || typeof s[name] !== 'object') deny(`INCOMPLETE_${name.toUpperCase()}`);
    }
    const changed = list(s.files).flatMap(f => [f.filename, ...(f.previous_filename ? [f.previous_filename] : [])]);
    if (!changed.length || changed.some(p => !nonempty(p)) || pr.changed_files !== s.files.length ||
        new Set(s.files.map(f => f.filename)).size !== s.files.length) deny('FILES_EMPTY_OR_TRUNCATED');
    const applicable = [];
    const covered = new Set();
    for (const rule of rules) {
      if (!positive(rule.workflowId) || !/^\.github\/workflows\/[\w.-]+\.ya?ml$/.test(rule.workflowPath) ||
          !list(rule.jobs).length || rule.jobs.some(j => !nonempty(j)) ||
          !list(rule.include).length || !Array.isArray(rule.exclude)) { deny('CI_RULE_INVALID'); continue; }
      const paths = changed.filter(p => rule.include.some(g => matches(p, g)) && !rule.exclude.some(g => matches(p, g)));
      if (!paths.length) continue;
      paths.forEach(p => covered.add(p)); applicable.push(rule);
    }
    jobs = applicable.flatMap(r => r.jobs.map(job => `${r.workflowPath}:${job}`));
    if (!jobs.length) deny('NO_APPLICABLE_CI');
    if (changed.some(p => !covered.has(p))) deny('CI_PATH_UNCOVERED');
    for (const check of list(s.checks)) {
      if (check.head_sha !== head || check.status !== 'completed' || check.conclusion !== 'success') deny('CHECK_NOT_SUCCESS');
      if (check.app?.id !== policy.actionsAppId) deny('CHECK_UNTRUSTED_APP');
    }
    for (const status of list(s.statuses)) {
      if (status.sha !== head || status.state !== 'success') deny('STATUS_NOT_SUCCESS');
    }
    if (!list(s.checks).length) deny('CHECKS_EMPTY');
    for (const rule of applicable) {
      const definitions = list(s.workflows).filter(w => w.id === rule.workflowId && w.path === rule.workflowPath);
      if (definitions.length !== 1) { deny('WORKFLOW_MISSING_OR_AMBIGUOUS'); continue; }
      const w = definitions[0];
      if (w.state !== 'active' || w.base !== base || w.head !== head || !sha(w.baseBlob) || w.baseBlob !== w.headBlob) deny('WORKFLOW_NOT_TRUSTED_MAIN');
      const runs = list(s.runs).filter(r => r.workflow_id === rule.workflowId);
      if (!runs.length) deny('RUN_MISSING');
      // All observed attempts must succeed; no inference from an aggregate green badge.
      for (const run of runs) {
        if (!positive(run.id) || !positive(run.run_attempt) || run.head_sha !== head ||
            run.path !== rule.workflowPath || run.repository?.full_name !== policy.repository ||
            run.event !== 'pull_request' || !list(run.pull_requests).some(p => p.number === pr.number && p.head?.sha === head && p.base?.sha === base) ||
            run.status !== 'completed' || run.conclusion !== 'success') deny('RUN_STALE_OR_UNTRUSTED');
        for (const name of rule.jobs) {
          const found = list(s.jobs).filter(j => j.run_id === run.id && j.run_attempt === run.run_attempt && j.name === name);
          if (found.length !== 1) { deny('JOB_MISSING_OR_AMBIGUOUS'); continue; }
          const job = found[0];
          const expectedURL = `https://api.github.com/repos/${policy.repository}/check-runs/`;
          const id = typeof job.check_run_url === 'string' && job.check_run_url.startsWith(expectedURL)
            ? Number(job.check_run_url.slice(expectedURL.length)) : NaN;
          const checks = list(s.checks).filter(c => c.id === id && c.name === name && c.app?.id === policy.actionsAppId);
          if (job.head_sha !== head || job.status !== 'completed' || job.conclusion !== 'success' ||
              !positive(id) || checks.length !== 1) deny('JOB_CHECK_PROVENANCE');
        }
      }
    }
    if (!positive(pr.user.id)) deny('AUTHOR_UNKNOWN');
    const ownership = s.attestations?.ownership;
    const latest = new Map(), ids = new Set();
    for (const review of list(s.reviews).toSorted((a, b) => a.id - b.id)) {
      if (!positive(review.id) || ids.has(review.id) || !positive(review.user?.id) ||
          !['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED', 'COMMENTED', 'PENDING'].includes(review.state)) deny('REVIEW_RECORD_INVALID');
      ids.add(review.id);
      if (review.state === 'PENDING') deny('REVIEW_PENDING');
      if (review.state !== 'COMMENTED') latest.set(review.user?.id, review);
    }
    let approvals = 0;
    const participants = [pr.user.id, s.actorId, ...list(ownership?.participantIds)];
    for (const [id, review] of latest) {
      if (review.state === 'CHANGES_REQUESTED') deny('CHANGES_REQUESTED');
      if (review.state !== 'APPROVED') continue;
      if (review.commit_id !== head) { deny('REVIEW_STALE'); continue; }
      if (reviewers.some(r => r.id === id && r.type === review.user.type) &&
          review.user.type === 'User' && !participants.includes(id)) approvals++;
    }
    if (approvals < 1) deny('INDEPENDENT_REVIEW_MISSING');
    if (list(s.threads).some(t => t.isResolved !== true)) deny('UNRESOLVED_THREAD');
    // These are normalized authoritative evidence, NOT parsed free-form comments.
    for (const kind of ['blockers', 'ownership', 'enforcement', 'permission']) {
      const a = s.attestations?.[kind];
      if (!a || a.head !== head || a.base !== base || !fresh(a.observedAt) ||
          !positive(a.recordId) || !policy.recordAuthorities.includes(a.authorId)) { deny(`MISSING_OR_STALE_${kind.toUpperCase()}`); continue; }
      if (kind === 'blockers' && (a.hold !== false || a.unresolvedFindings !== 0 || a.dependenciesComplete !== true)) deny('BLOCKERS_PRESENT');
      if (kind === 'ownership' && (!nonempty(a.owner) || !Array.isArray(a.conflicts) || a.conflicts.length ||
          !list(a.participantIds).length || a.participantIds.some(id => !positive(id)))) deny('OWNER_CONFLICT_OR_UNKNOWN');
      if (kind === 'enforcement' && (a.enforced !== true || a.strictBase !== true || a.bypassPossible !== false || a.scopeComplete !== true)) deny('SERVER_ENFORCEMENT_MISSING');
      if (kind === 'permission' && (a.actorId !== s.actorId || !positive(s.actorId) || a.mergeAllowed !== true || a.bypass !== false)) deny('PERMISSION_UNKNOWN');
    }
    if (s.mainBefore.protected !== true || s.mainAfter.protected !== true) deny('MAIN_UNPROTECTED');
    for (const other of list(s.openFiles)) {
      if (!positive(other.number) || !sha(other.head) || !Array.isArray(other.files) || !other.files.length ||
          other.files.some(f => !nonempty(f.filename))) deny('OTHER_PR_FILES_INCOMPLETE');
      if (other.number !== pr.number && list(other.files).some(f => changed.includes(f.filename) || changed.includes(f.previous_filename))) deny('OTHER_PR_PATH_CONFLICT');
    }
    if (new Set(s.openPulls.map(p => p.number)).size !== s.openPulls.length ||
        !s.openPulls.some(p => p.number === pr.number && p.head?.sha === head) ||
        s.openPulls.some(p => !positive(p.number) || !sha(p.head?.sha))) deny('OPEN_PR_INVENTORY_INVALID');
    if (list(s.openPulls).some(p => !list(s.openFiles).some(f => f.number === p.number && f.head === p.head.sha))) deny('OTHER_PR_FILES_INCOMPLETE');
  } catch {
    deny('MALFORMED_OR_UNKNOWN_EVIDENCE');
  }
  return result();
}
