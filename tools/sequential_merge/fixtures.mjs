// SYNTHETIC TEST EVIDENCE ONLY. No identities or approvals describe this repo.
export const NOW = Date.parse('2026-10-19T00:00:00Z');
export const BASE = 'a'.repeat(40), HEAD = 'b'.repeat(40), NEXT = 'c'.repeat(40);
export function fixture({base = BASE, head = HEAD, number = 12} = {}) {
  const repository = 'example/game';
  const workflowPath = '.github/workflows/test.yml';
  const policy = {schemaVersion: 1, repository, base: 'main', approved: true,
    ciCoverageApproved: true, serverPolicyApproved: true, maxAgeSeconds: 300,
    actionsAppId: 42, reviewerAllowlist: [{id: 200, type: 'User'}],
    recordAuthorities: [900], ciRules: [{workflowId: 50, workflowPath,
      jobs: ['unit'], include: ['src/**'], exclude: []}]};
  const pr = {number, state: 'open', draft: false, merged: false, changed_files: 1,
    user: {id: 100, type: 'User'}, mergeable: true, mergeable_state: 'clean',
    head: {sha: head, repo: {full_name: repository}},
    base: {sha: base, ref: 'main', repo: {full_name: repository}}};
  const binding = {head, base, observedAt: new Date(NOW).toISOString(), recordId: 800, authorId: 900};
  const snapshot = {schemaVersion: 1, repository, actorId: 300, policyBase: base,
    startedAt: binding.observedAt, finishedAt: binding.observedAt, errors: [],
    pr, prAfter: structuredClone(pr), mainBefore: {commit: {sha: base}, protected: true},
    mainAfter: {commit: {sha: base}, protected: true},
    comparison: {merge_base_commit: {sha: base}, status: 'ahead'},
    files: [{filename: 'src/code.mjs'}], statuses: [], comments: [], threads: [],
    reviews: [{id: 1, user: {id: 200, type: 'User'}, state: 'APPROVED', commit_id: head}],
    checks: [{id: 60, name: 'unit', head_sha: head, app: {id: 42}, status: 'completed', conclusion: 'success'}],
    runs: [{id: 70, run_attempt: 1, workflow_id: 50, head_sha: head, path: workflowPath,
      repository: {full_name: repository}, event: 'pull_request',
      pull_requests: [{number, head: {sha: head}, base: {sha: base}}], status: 'completed', conclusion: 'success'}],
    jobs: [{id: 80, run_id: 70, run_attempt: 1, name: 'unit', head_sha: head,
      check_run_url: `https://api.github.com/repos/${repository}/check-runs/60`, status: 'completed', conclusion: 'success'}],
    workflows: [{id: 50, path: workflowPath, state: 'active', base, head, baseBlob: 'd'.repeat(40), headBlob: 'd'.repeat(40)}],
    openPulls: [structuredClone(pr)], openFiles: [{number, head, files: [{filename: 'src/code.mjs'}]}], rulesets: [], protection: {enabled: true},
    attestations: {
      blockers: {...binding, hold: false, unresolvedFindings: 0, dependenciesComplete: true},
      ownership: {...binding, owner: 'synthetic-worker', conflicts: [], participantIds: [100]},
      enforcement: {...binding, enforced: true, strictBase: true, bypassPossible: false, scopeComplete: true},
      permission: {...binding, actorId: 300, mergeAllowed: true, bypass: false},
    }};
  snapshot.complete = Object.fromEntries(['files', 'checks', 'statuses', 'reviews', 'threads',
    'comments', 'runs', 'jobs', 'workflows', 'openPulls', 'openFiles', 'rulesets',
    'mainBefore', 'pr', 'comparison', 'protection', 'prAfter', 'mainAfter'].map(k => [k, true]));
  return {policy, snapshot};
}

export function readerFixture(snapshot, hook) {
  const calls = [];
  const reader = {
    async get(route, p) {
      calls.push({route, p});
      const override = await hook?.(route, p, calls);
      if (override !== undefined) return override;
      const data = (() => {
        if (route.endsWith('/branches/main')) return snapshot.mainBefore;
        if (route.endsWith('/branches/main/protection')) return {enabled: true};
        if (route.endsWith('/pulls/{pull_number}')) return snapshot.pr;
        if (route.endsWith('/compare/{basehead}')) return snapshot.comparison;
        if (route.endsWith('/pulls/{pull_number}/files')) return snapshot.files;
        if (route.endsWith('/commits/{ref}/check-runs')) return {total_count: snapshot.checks.length, check_runs: snapshot.checks};
        if (route.endsWith('/commits/{ref}/statuses')) return snapshot.statuses;
        if (route.endsWith('/pulls/{pull_number}/reviews')) return snapshot.reviews;
        if (route.endsWith('/issues/{issue_number}/comments')) return snapshot.comments;
        if (route.endsWith('/actions/runs')) return {total_count: snapshot.runs.length, workflow_runs: snapshot.runs};
        if (route.endsWith('/actions/runs/{run_id}/attempts/{attempt_number}/jobs')) return {total_count: snapshot.jobs.length, jobs: snapshot.jobs};
        if (route.endsWith('/actions/workflows/{workflow_id}')) return snapshot.workflows[0];
        if (route.endsWith('/contents/{path}')) return {type: 'file', path: p.path, size: 40, sha: snapshot.workflows[0].baseBlob};
        if (route.endsWith('/pulls')) return snapshot.openPulls;
        if (route.endsWith('/rulesets')) return [];
        throw Error('Unexpected read route: ' + route);
      })();
      return {data: structuredClone(data), headers: {}};
    },
    async threads(p) {
      calls.push({route: 'threads', p});
      const override = await hook?.('threads', p, calls);
      return override ?? {repository: {pullRequest: {reviewThreads: {
        nodes: snapshot.threads, pageInfo: {hasNextPage: false, endCursor: null}}}}};
    },
  };
  return {reader, calls};
}
