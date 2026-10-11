# Shared issue queue: Codex / Claude Code / multiple chats

All Codex and Claude Code sessions are independent workers. GitHub Actions `.github/workflows/issue-claim.yml` is the central, serialized reservation coordinator.

## Claim the next task

1. Inspect current open PRs, branches, and any handoffs. Do not duplicate existing work.
2. Generate a unique worker ID, e.g. `codex-a-20261011-01` or `claude-b-20261011-01`. Different chats MUST use different IDs, even under the same account.
3. Dispatch **Issue claim coordinator** on the default branch: operation `next`, owner `<worker ID>`, agent `codex` or `claude`. Leave issue blank.
   `gh workflow run issue-claim.yml -f operation=next -f owner=codex-a-20261011-01 -f agent=codex`
4. Wait for the **specific** workflow run to complete successfully, and read its job summary / `CLAIMED_ISSUE` log. A successful dispatch alone does NOT grant a reservation.
5. Only then create a branch from latest `origin/main`, implement, test, push, and create a PR referencing the claimed issue. Document owner, branch, PR and remaining work on the issue.

To claim a specific issue: `gh workflow run issue-claim.yml -f operation=claim -f issue=325 -f owner=codex-a-20261011-01 -f agent=codex`.

## Selection

- Priority is by existing `difficulty:S` through `difficulty:D`, then P0/P1/P2 and issue number. Note: current code sorts by difficulty first; any priority override needs a separately reviewed change. Parent/management issues and unclassified issues are excluded.
- Claude prioritizes issues with character, dialogue, relationship or event keywords. Codex can select any issue; it is sensible to reserve Codex for systems/UI and Claude for story, but keyword selection is only a heuristic.
- The coordinator skips issues with existing claim records, blocked labels, or open PRs that mention the issue number. It cannot guarantee detection of all loosely referenced PRs or file-level conflicts. Manually check existing PRs before implementing.
- Each worker should claim **one issue at a time**. The workflow checks existing claims across open and closed issues to enforce one active claim per worker ID; this depends on all agents using unique IDs.
- Reservations prevent double booking only when every worker follows this protocol. A user manually assigning the same task outside the coordinator can still cause duplication.

## Pause, resume, merge

- If work pauses, push the branch and create a draft PR / issue handoff. **Keep the claim**.
- To resume, transfer the owner ID and branch explicitly after stopping the original worker. Never silently steal an existing claim.
- After the PR is safely merged or work is explicitly abandoned, dispatch operation `release` with the same owner ID and issue number. If the issue has already been closed, the workflow must allow releasing it; verify run status.
- A claim does not authorize unsafe merges. Recheck latest main, CI, tests, protection rules and conflicting file edits. Do not force-push or bypass required checks.
- Stale claims require manual review; never auto-expire without inspecting branch/PR status.
- GitHub Actions `concurrency` serializes coordinator runs, but queued runs are subject to GitHub's pending-run replacement semantics. A dispatched run can be canceled before execution; only a successful run confirms a claim.

## Limits

- This coordinates **issue assignment**, not automatic cloud-session spawning or continuous autonomous work.
- Agents must explicitly dispatch the workflow and wait for its success before coding.
- GitHub Actions needs to be enabled and workflow permissions must allow issue comments. The workflow must first be merged to the default branch.

## Dispatch failure and queue contention

A successful API request to dispatch a workflow is not a reservation. Check the *specific run ID* and its job summary for `Claim confirmed` / `CLAIMED_ISSUE`. If the run was canceled while pending (GitHub concurrency can replace pending runs), retry the dispatch with the **same** worker ID. Never begin coding after a canceled, timed-out, or failed run. Do not run multiple dispatches for the same worker simultaneously. If a run's outcome is unknown, inspect issue claim comments before retrying.

The current comment-based claim ledger depends on the workflow's shared concurrency group. It is not an atomic lock against external scripts that bypass the workflow. Do not directly post claim markers. For strict cross-workflow atomicity, use a dedicated lock service or Git ref compare-and-create in a separately reviewed implementation.

## Cloud / multi-chat handoff checklist

Each Codex chat and Claude Code session must use a **different** worker ID, including separate cloud sessions from the same account. The coordinator is a reservation mechanism, not an agent launcher. A worker cannot infer the result of a `gh workflow run` dispatch from its exit code: it must identify the corresponding run and confirm **successful completion** plus the `CLAIMED_ISSUE` log or job summary before editing code.

**Starting:** Check open PRs and any prior handoff first; create a unique worker ID; reserve an eligible Issue; record the confirmed Issue and run ID; then branch from current main. If GitHub Actions cannot be dispatched from the current environment, do not assume the Issue is reserved. Ask for an authorized dispatch or use an explicitly supported integration, and do other non-conflicting work meanwhile.

**Pausing:** Commit and push all recoverable changes; create/update a Draft PR if unfinished; post the following fields to the Issue (without secrets):

```text
WORKER: <unique worker ID>
ISSUE: #<number>
BRANCH: <branch>
PR: #<number or none>
DONE: <what is implemented>
TODO: <remaining work>
TEST: <commands and results, including not run>
BLOCKERS: <specific constraints>
NEXT: <first safe action for the next session>
```

**Resuming:** The same worker may continue its reserved branch after verifying the latest Issue/PR status. A different worker must wait for the original session to stop and push its work; then the original owner releases the reservation and the new worker claims the same Issue successfully. Do not transfer ownership by posting a forged claim marker or by reusing another worker's ID.

**Finishing:** Only merge a complete PR after required checks/reviews and conflict checks pass; never use a claim as merge permission. After merge, release with the original worker ID (release supports closed Issues). If a claim is stale and the owner cannot run release, flag it for manual review rather than taking it over silently.

**Manual smoke tests:** Use a dedicated disposable Issue with no referencing open PR, not a tracking Issue. Test claim → duplicate claim rejection with a *different* owner → release by the original owner → claim by the second owner → release. Confirm each workflow's run outcome and the bot ledger on the Issue. A failed duplicate attempt is expected, not a broken workflow. GitHub concurrency permits one running and one pending run; a third pending dispatch may replace the previous pending run. A canceled run does not confer a claim and must be retried.

**Known limitation:** There is no automatic quota detection across all cloud clients, no automatic worker spawn, and no unconditional auto-merge. Human or supported integration must start sessions and verify quota signals when available.
