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
