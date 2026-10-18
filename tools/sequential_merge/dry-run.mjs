import {readFile} from 'node:fs/promises';
import {collect, githubReader} from './collect.mjs';
import {evaluate} from './evaluate.mjs';

// This entry point has no execution option. Its policy comes from the trusted
// checkout, never a PR body, workflow input, comment or candidate branch.
export async function dryRun({github, context, core}) {
  const policy = JSON.parse(await readFile(new URL('./policy.json', import.meta.url), 'utf8'));
  const input = context.payload.inputs?.pull_request;
  if (context.eventName !== 'workflow_dispatch' || context.ref !== 'refs/heads/main' ||
      `${context.repo.owner}/${context.repo.repo}` !== policy.repository ||
      typeof input !== 'string' || !/^[1-9]\d*$/.test(input) || !Number.isSafeInteger(Number(input))) {
    throw Error('Read-only preflight requires main dispatch and a positive PR number');
  }
  const snapshot = await collect(githubReader(github), {repository: policy.repository,
    number: Number(input), policy, policyBase: context.sha, actorId: context.payload.sender?.id});
  const decision = evaluate(snapshot, policy);
  await core.summary.addHeading('Read-only sequential merge preflight')
    .addRaw('Execution is disabled. READY_FOR_RECHECK is not merge authorization.\n')
    .addCodeBlock(JSON.stringify(decision, null, 2), 'json').write();
  core.setOutput('decision', decision.status);
  if (decision.status === 'BLOCKED') core.setFailed(`BLOCKED: ${decision.reasons.join(', ')}`);
  return {snapshot, decision};
}
