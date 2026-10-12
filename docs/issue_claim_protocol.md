# Shared issue queue: Codex / Claude Code / multiple chats

All Codex and Claude Code sessions are independent workers. GitHub Actions `.github/workflows/issue-claim.yml` is the central, serialized reservation coordinator.

## Claim the next task

1. Inspect current open PRs, branches, and any handoffs. Do not duplicate existing work.
2. Generate a unique worker ID, e.g. `codex-a-20261011-01` or `claude-b-20261011-01`. Different chats MUST use different IDs, even under the same account.
3. Dispatch **Issue claim coordinator** on the default branch: operation `next`, owner `<worker ID>`, agent `codex` or `claude`. Leave issue blank.
   `gh workflow run issue-claim.yml -f operation=next -f owner=codex-a-20261011-01 -f agent=codex`
4. Wait for the **specific** workflow run to complete successfully, and read its job summary / `CLAIMED_ISSUE` log. A successful dispatch alone does NOT grant a reservation. Before starting/resuming, also validate the current ledger using `status` with the claim run ID (see below).
5. Only then create a branch from latest `origin/main`, implement, test, push, and create a PR referencing the claimed issue. Document owner, branch, PR and remaining work on the issue.

To claim a specific issue: `gh workflow run issue-claim.yml -f operation=claim -f issue=325 -f owner=codex-a-20261011-01 -f agent=codex`.

## Selection

- Priority is by existing `difficulty:S` through `difficulty:D`, then P0/P1/P2 and issue number. Note: current code sorts by difficulty first; any priority override needs a separately reviewed change. Unclassified issues are excluded; parent/management issues are not recognized automatically and must be checked manually.
- `agent` records the client type only. Codex and Claude use the same selection order; there is no character/dialogue keyword routing in the coordinator.
- The coordinator skips issues with existing claim records, blocked labels, or open PRs that reference `#number`, `owner/repo#number`, or the repository's full Issue URL (including Draft PRs). Manual claims also reject blocked labels. It cannot guarantee detection of dependencies, loosely referenced PRs, or file-level conflicts. Manually check existing PRs before implementing.
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

**Resuming:** The same worker may continue its reserved branch after verifying the latest Issue/PR status. For a different worker with no referencing Open PR, stop the original session and push its work, then release by the original owner and claim by the new worker. For saved Open PRs, use the explicit admin transfer below; ordinary claim still rejects Open PRs. Never reuse another session's ID or manually write claim markers.

### Admin handoff of saved Open PRs

A repository administrator may use `operation=transfer` after independently
confirming the original session stopped, the saved work to be handed off was pushed, and
the handoff scope and unfinished work were recorded on the Issue. A failed chat
message alone is not proof of a stopped worker. Inspect the session's live status
and the current GitHub branches/PR heads. Preserve unrelated pending PRs.

The admin posts a human approval comment on that same Issue containing this
single-line record (replace every value with verified evidence):

```text
<!-- issue-handoff:v1 {"issue":325,"from":"old-worker","to":"new-worker","claim_run":"123456","stopped":true,"pushed":true,"prs":[{"number":326,"head":"0123456789012345678901234567890123456789"}]} -->
```

List **all** referencing Open PR numbers and their current full head SHAs,
including Drafts; describe which PR may be edited and which must be preserved
in the prose of the comment. Both the approval author and dispatch actor must
have repository admin permission. The coordinator verifies the active old
owner/claim run, the source run's success, the Issue's open/unblocked state,
the exact Open PR set and same-repository heads, and that the new worker owns
no other Issue, including closed Issues. It rechecks the record and mutable
state before writing. Unknown permissions, changed PR heads, an edited approval,
missing PRs or stale/failed reservations cause refusal without a ledger write.

```sh
gh workflow run issue-claim.yml --ref main -f operation=transfer -f issue=325 \
  -f owner=new-worker -f agent=codex -f claim_run=123456 \
  -f handoff_comment=987654 -f request_id=<fresh-unique-request-id>
```

The serialized coordinator writes one new bot claim record for the new worker,
with the original owner and approval URL in its audit text. This explicitly
relinquishes the old ownership and avoids an unreserved release/claim gap;
do **not** run release first for this path. Wait for that exact transfer run to
succeed and confirm `CLAIMED_ISSUE`, then run `status` with the **transfer run ID**
as `claim_run` and confirm `CLAIM_VALIDATED_ISSUE` before editing. Cancellation
or failure after the write retains the reservation and cannot authorize work;
inspect it and obtain a fresh admin handoff or formal release by the new owner.
This validates snapshots, not an atomic lock on PR branches: recheck live heads
before editing and retain all existing Git Safety, test, CI and merge gates.

**Finishing:** Only merge a complete PR after required checks/reviews and conflict checks pass; never use a claim as merge permission. After merge, release with the original worker ID (release supports closed Issues). If a claim is stale and the owner cannot run release, flag it for manual review rather than taking it over silently.

**Manual smoke tests:** Use a dedicated disposable Issue with no referencing open PR, not a tracking Issue. Test claim → duplicate claim rejection with a *different* owner → release by the original owner → claim by the second owner → release. Confirm each workflow's run outcome and the bot ledger on the Issue. A failed duplicate attempt is expected, not a broken workflow. GitHub concurrency permits one running and one pending run; a third pending dispatch may replace the previous pending run. A canceled run does not confer a claim and must be retried.

**Known limitation:** There is no automatic quota detection across all cloud clients, no automatic worker spawn, and no unconditional auto-merge. Human or supported integration must start sessions and verify quota signals when available.

## Identify and validate the exact run

For new dispatches, set `request_id` to a fresh unique ID (for example, a UUID).
The run title includes operation, Issue, worker and request ID. This works with
`gh` in Codex and Claude Code cloud sessions if the session has repository and
Actions authorization; installing the CLI alone does not establish access.

```sh
request_id=$(python3 -c 'import uuid; print(uuid.uuid4())')
gh workflow run issue-claim.yml --ref main -f operation=claim -f issue=325 \
  -f owner=codex-a-20261011-01 -f agent=codex -f request_id="$request_id"
gh run list --workflow issue-claim.yml --json databaseId,displayTitle,status,conclusion
```

Match the **entire request ID** in `displayTitle`; never select the newest run
without checking it. Use `gh run view <run-id> --log` to confirm its owner, Issue
and `CLAIMED_ISSUE`. Record the actual run ID and wait for completed/success.
Each new bot ledger entry also records the run and request ID, while preserving
the original v1 state/owner marker for existing reservations and readers.

A historical successful run does not prove that a reservation is still active:
release or a new owner may have changed it. Immediately before starting or
resuming, dispatch a new request with `operation=status`, the same `issue` and
`owner`, and `claim_run=<successful-claim-run-id>`. Wait for **that specific status
run** to succeed and verify `CLAIM_VALIDATED_ISSUE` / owner / run in its log.
The coordinator rejects released reservations, other owners, different runs,
closed/blocked Issues, and claims whose source run failed or was canceled.
`status` without `claim_run` is read-only inspection and does **not** authorize work.
Legacy reservations without run metadata remain readable and releasable; their
source run must be checked manually, not inferred or silently replaced.

If cancellation happens **after** the bot comment was written, the reservation
intentionally remains to prevent another worker from starting. Inspect it and
formally abandon/release with the original owner before retrying. Do not delete
ledger comments, auto-expire claims, or begin work from a failed/canceled run.
A canceled pending run writes no reservation. Status is a snapshot: use unique
worker IDs and never dispatch simultaneous release/start operations under the
same ID. A pause retains the reservation and requires a pushed handoff.

## Collision and merge boundaries

Before implementation, compare planned paths against open PR files and other
workers' handoffs, and check blocking Issues/dependent PRs manually. The present
coordinator does **not** compute file overlap or parse dependency graphs.
Unpushed work is invisible. If resuming an existing Draft PR, stop and arrange
an explicit owner handoff; do not change `#number` to a URL to bypass its guard.
There is no automatic takeover exemption; saved Open PRs require the explicit admin transfer above.

This workflow does not merge PRs. For each merge, fetch latest main; compare
base/head and changed files; check mergeability, required CI and tests on the
actual head; inspect review requests/reviews and unresolved threads; verify
dependent PRs have merged and related workers are not modifying the same files.
Merge one PR at a time using its expected head SHA. After each merge, refresh
main and revalidate the next PR. Unknown protections, failed/pending CI,
conflicts, unfinished work or review/dependency blockers prohibit automatic merge.
A server merge API checks the head SHA, but cannot atomically validate a moving
base; use enforced branch protection/merge queue for an automatic integration.
A manual check checklist is not an implemented merge queue.

## Regression tests

Run `node --test tools/test_issue_claim.mjs`. It executes the actual inline
JavaScript with mock APIs and checks refusal/recovery paths. It does not simulate
GitHub Actions scheduling or establish that a real Claude Code session works.
Use `actionlint .github/workflows/issue-claim.yml .github/workflows/issue-claim-checks.yml`
for workflow syntax. Live concurrency/cancellation probes must use disposable
Issues and an isolated branch concurrency group so production pending workers
are not replaced by the test. Remove branch-only waits/fixture restrictions and
restore the production group before merging. Release every test reservation and
close disposable Issues; retain run/comment links as evidence on Issue #350.
