import {evaluate} from './evaluate.mjs';

// Offline fixture state machine only: consumes supplied evidence, never calls
// GitHub, never accepts an API adapter or a callback, and cannot perform a merge.
export function simulateSequence(steps, policy, now) {
  const events = [];
  let main = null;
  if (!Array.isArray(steps) || !steps.length) return {status: 'BLOCKED', events, reason: 'EMPTY_SEQUENCE'};
  for (const step of steps) {
    if (!step || typeof step !== 'object') return {status: 'BLOCKED', events, reason: 'INVALID_STEP'};
    const first = evaluate(step.before, policy, now);
    events.push({type: 'evaluate', decision: first});
    if (first.status !== 'READY_FOR_RECHECK') return {status: 'BLOCKED', events, reason: 'PRECHECK'};
    if (main !== null && first.validatedBase !== main) return {status: 'BLOCKED', events, reason: 'MAIN_NOT_REFRESHED'};
    const second = evaluate(step.recheck, policy, now);
    events.push({type: 'recheck', decision: second});
    if (second.status !== 'READY_FOR_RECHECK' || first.expectedHead !== second.expectedHead ||
        first.validatedBase !== second.validatedBase || step.before.pr.number !== step.recheck.pr.number) {
      return {status: 'BLOCKED', events, reason: 'RACE_OR_RECHECK'};
    }
    events.push({type: 'mockMergeRequest', number: step.before.pr.number,
      expectedHead: second.expectedHead, validatedBase: second.validatedBase});
    if (step.mockResult?.merged !== true || !/^[a-f0-9]{40}$/.test(step.mockResult.main) ||
        step.mockResult.main === second.validatedBase) return {status: 'BLOCKED', events, reason: 'MOCK_MERGE_FAILED'};
    main = step.mockResult.main;
    events.push({type: 'mockMainAdvanced', main});
  }
  return {status: 'SIMULATED_ONLY', events, main};
}
