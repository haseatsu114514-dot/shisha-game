// Read-only GitHub evidence acquisition. All REST requests are GETs; the sole
// GraphQL operation is a fixed review-thread query. No candidate code is read/run.
const PAGE_SIZE = 100;
export const LIMITS = Object.freeze({pages: 10, requests: 160, bytes: 4 * 1024 * 1024,
  runs: 30, openPulls: 30, workflowBytes: 128 * 1024});

export function githubReader(github) {
  return {
    get: async (route, parameters) => github.request(`GET ${route}`, parameters),
    threads: async variables => github.graphql(`query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          reviewThreads(first: 100, after: $cursor) {
            nodes { id isResolved isOutdated }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }`, variables),
  };
}

export async function collect(reader, {repository, number, policy, policyBase, actorId}, clock = () => new Date().toISOString()) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !Number.isSafeInteger(number) || number <= 0) throw Error('Invalid repository/PR');
  const [owner, repo] = repository.split('/');
  const root = '/repos/{owner}/{repo}';
  const s = {schemaVersion: 1, repository, number, actorId, policyBase,
    startedAt: clock(), errors: [], complete: {}, attestations: {}};
  let requests = 0, bytes = 0;
  const bounded = async operation => {
    if (requests >= LIMITS.requests || bytes >= LIMITS.bytes) throw Error('acquisition budget');
    requests++;
    const response = await operation();
    bytes += Buffer.byteLength(JSON.stringify(response));
    if (bytes > LIMITS.bytes) throw Error('byte budget');
    return response;
  };
  const get = (route, parameters = {}) => bounded(() => reader.get(root + route, {owner, repo, ...parameters}));
  const read = async (key, fn) => {
    try { s[key] = await fn(); s.complete[key] = true; }
    catch (error) { s.complete[key] = false; s.errors.push({resource: key, status: Number(error.status) || null}); }
  };
  const pages = async (route, parameters = {}, field) => {
    const items = [];
    let total;
    for (let page = 1; page <= LIMITS.pages; page++) {
      const response = await get(route, {...parameters, per_page: PAGE_SIZE, page});
      const data = field ? response.data[field] : response.data;
      if (!Array.isArray(data)) throw Error('not a collection');
      if (field) {
        if (!Number.isSafeInteger(response.data.total_count) || response.data.total_count < 0) throw Error('missing total');
        if (total !== undefined && total !== response.data.total_count) throw Error('moving collection');
        total = response.data.total_count;
      }
      items.push(...data);
      const next = /rel="next"/.test(response.headers?.link || '');
      if (!next && data.length < PAGE_SIZE) {
        if (total !== undefined && items.length !== total) throw Error('truncated collection');
        return items;
      }
    }
    throw Error('pagination budget');
  };
  await read('mainBefore', async () => (await get('/branches/main')).data);
  await read('pr', async () => (await get('/pulls/{pull_number}', {pull_number: number})).data);
  const head = s.pr?.head?.sha, base = s.mainBefore?.commit?.sha;
  if (/^[a-f0-9]{40}$/.test(head) && /^[a-f0-9]{40}$/.test(base)) {
    await read('comparison', async () => (await get('/compare/{basehead}', {basehead: `${base}...${head}`})).data);
    await read('files', () => pages('/pulls/{pull_number}/files', {pull_number: number}));
    await read('checks', () => pages('/commits/{ref}/check-runs', {ref: head, filter: 'all'}, 'check_runs'));
    await read('statuses', () => pages('/commits/{ref}/statuses', {ref: head}));
    // REST status objects do not themselves include the queried SHA.
    if (s.complete.statuses) s.statuses = s.statuses.map(status => ({...status, sha: head}));
    await read('reviews', () => pages('/pulls/{pull_number}/reviews', {pull_number: number}));
    await read('comments', () => pages('/issues/{issue_number}/comments', {issue_number: number}));
    await read('threads', async () => {
      const items = [], cursors = new Set();
      let cursor = null;
      for (let page = 1; page <= LIMITS.pages; page++) {
        const response = await bounded(() => reader.threads({owner, repo, number, cursor}));
        if (response.errors?.length) throw Error('partial GraphQL response');
        const connection = response.repository?.pullRequest?.reviewThreads;
        if (!connection || !Array.isArray(connection.nodes) || typeof connection.pageInfo?.hasNextPage !== 'boolean') throw Error('threads incomplete');
        items.push(...connection.nodes);
        if (!connection.pageInfo.hasNextPage) return items;
        cursor = connection.pageInfo.endCursor;
        if (typeof cursor !== 'string' || !cursor || cursors.has(cursor)) throw Error('invalid cursor');
        cursors.add(cursor);
      }
      throw Error('thread pagination budget');
    });
    await read('runs', () => pages('/actions/runs', {head_sha: head}, 'workflow_runs'));
    await read('jobs', async () => {
      if (!s.complete.runs || s.runs.length > LIMITS.runs) throw Error('runs incomplete/over budget');
      const jobs = [];
      for (const run of s.runs) {
        if (!Number.isSafeInteger(run.id) || run.id <= 0 || !Number.isSafeInteger(run.run_attempt) || run.run_attempt <= 0) throw Error('invalid run');
        const data = await pages('/actions/runs/{run_id}/attempts/{attempt_number}/jobs', {run_id: run.id, attempt_number: run.run_attempt}, 'jobs');
        jobs.push(...data.map(job => ({...job, run_id: run.id, run_attempt: run.run_attempt})));
      }
      return jobs;
    });
    await read('workflows', async () => {
      if (!Array.isArray(policy.ciRules)) throw Error('rules unknown');
      const workflows = [];
      for (const rule of policy.ciRules) {
        if (!Number.isSafeInteger(rule.workflowId) || rule.workflowId <= 0 || !/^\.github\/workflows\/[\w.-]+\.ya?ml$/.test(rule.workflowPath)) throw Error('invalid workflow');
        const definition = (await get('/actions/workflows/{workflow_id}', {workflow_id: rule.workflowId})).data;
        const content = async ref => {
          const file = (await get('/contents/{path}', {path: rule.workflowPath, ref})).data;
          if (file.type !== 'file' || file.path !== rule.workflowPath || file.size > LIMITS.workflowBytes || !Number.isSafeInteger(file.size)) throw Error('invalid workflow file');
          return file.sha;
        };
        workflows.push({id: definition.id, path: definition.path, state: definition.state,
          base, head, baseBlob: await content(base), headBlob: await content(head)});
      }
      return workflows;
    });
    await read('openPulls', () => pages('/pulls', {state: 'open'}));
    await read('openFiles', async () => {
      if (!s.complete.openPulls || s.openPulls.length > LIMITS.openPulls) throw Error('open PR budget');
      const files = [];
      for (const pr of s.openPulls) {
        if (pr.number === number) { files.push({number, head, files: s.files || []}); continue; }
        if (!Number.isSafeInteger(pr.number) || pr.number <= 0) throw Error('invalid PR');
        const changed = await pages('/pulls/{pull_number}/files', {pull_number: pr.number});
        const after = (await get('/pulls/{pull_number}', {pull_number: pr.number})).data;
        if (pr.head?.sha !== after.head?.sha || after.state !== 'open' || after.changed_files !== changed.length) throw Error('other PR moved');
        files.push({number: pr.number, head: pr.head.sha, files: changed});
      }
      return files;
    });
  }
  // Preserve raw settings for inspection. No decoder claims they are enforced
  // for an execution identity, and no comment becomes an authoritative attestation.
  await read('protection', async () => (await get('/branches/main/protection')).data);
  await read('rulesets', () => pages('/rulesets', {includes_parents: true}));
  await read('prAfter', async () => (await get('/pulls/{pull_number}', {pull_number: number})).data);
  await read('mainAfter', async () => (await get('/branches/main')).data);
  s.finishedAt = clock();
  s.acquisition = {requests, bytes, limits: LIMITS};
  return s;
}
