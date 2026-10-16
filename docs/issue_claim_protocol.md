# Shared issue queue: Codex / Claude Code / multiple chats

All Codex and Claude Code sessions are independent workers. GitHub Actions `.github/workflows/issue-claim.yml` is the central, serialized reservation coordinator.

## Comments are a supported entrypoint

Post one JSON command on an Issue or a PR Conversation. The same coordinator
and concurrency group handle it; a comment alone is not a reservation.

```text
/issue-claim {"operation":"claim","issue":556,"owner":"codex-example-unique","agent":"codex"}
```

The author needs repository write/maintain/admin permission. The workflow checks
the live comment and author, rejects unknown fields and changed requests, and
posts a result with the run URL. Wait for that exact run's success and verify
the current bot owner/run. Never write bot ledger markers yourself. On an Issue,
`issue` may be omitted; on a PR, specify the target Issue explicitly. This also
works with integrations that can post PR Conversation comments but cannot
dispatch Actions. No PR-head code or comment text is executed as code.

Supported comment operations: `claim`, `park`, `resume`, `release`, `status`,
`transfer`, and single-Issue `maintain`. Use the existing transfer record and
`claim_run`/`handoff_comment` fields for transfer. The exact comment ID identifies
its response; a duplicate event delivery does not reserve twice.

Comment `park`/`resume`/`release` also bind the caller to the reservation's
verified request account (or original run actor). Knowing another worker's ID
does not grant those operations. Unknown legacy identity uses the existing
reviewed transfer/recovery route. Two chats under one account still need unique
worker IDs and explicit handoff; account matching does not prove a stopped chat.

GitHub may replace pending concurrency runs. If a request has no result,
inspect its ledger/run and retry with a fresh comment while the task is still
authorized. A failed or canceled run never authorizes work. Maintenance does
not replay old requests or undo an explicit cancellation or stop instruction.

## Claim the next task

1. Inspect current open PRs, branches, and any handoffs. Do not duplicate existing work.
2. Generate a unique worker ID, e.g. `codex-a-20261011-01` or `claude-b-20261011-01`. Different chats MUST use different IDs, even under the same account.
3. Dispatch **Issue claim coordinator** on the default branch: operation `next`, owner `<worker ID>`, agent `codex` or `claude`. Leave issue blank.
   `gh workflow run issue-claim.yml -f operation=next -f owner=codex-a-20261011-01 -f agent=codex`
4. Wait for the **specific** workflow run to complete successfully, read its job summary / `CLAIMED_ISSUE` log, and match the current bot ledger's owner/run to it. A successful dispatch alone does NOT grant a reservation. Read-only API verification is sufficient; a second `status` dispatch is optional (see below).
5. For new work, create a branch from latest `origin/main`, implement, test, push, and create a PR referencing the claimed issue. Resume saved work on its existing branch after verifying ownership and any required transfer. Document owner, branch, PR and remaining work on the issue.

Read-only discussion, investigation and review do not require a claim. Implementation,
including a user-selected task, still requires one. Use the Issue/PR as the stable
work identifier; a worker ID identifies one session and must not be shared.
Current ownership and adoption/hold decisions belong on the Issue/PR, not in
permanent skills or old handoff notes.

To claim a specific issue: `gh workflow run issue-claim.yml -f operation=claim -f issue=325 -f owner=codex-a-20261011-01 -f agent=codex`.

## Selection

- Priority is by existing `difficulty:S` through `difficulty:D`, then P0/P1/P2 and issue number. Note: current code sorts by difficulty first; any priority override needs a separately reviewed change. Unclassified issues are excluded; parent/management issues are not recognized automatically and must be checked manually.
- `agent` records the client type only. Codex and Claude use the same selection order; there is no character/dialogue keyword routing in the coordinator.
- The coordinator skips issues with existing claim records, blocked labels, or open PRs that reference `#number`, `owner/repo#number`, or the repository's full Issue URL (including Draft PRs). Manual claims also reject blocked labels. It cannot guarantee detection of dependencies, loosely referenced PRs, or file-level conflicts. Manually check existing PRs before implementing.
- Each worker has **one actively edited Issue at a time**, plus any number of explicitly parked saved PRs. Waiting Issues remain exclusively reserved. Existing records without a waiting checkpoint remain active; the workflow does not infer review wait from inactivity or Draft status.
- Reservations prevent double booking only when every worker follows this protocol. A user manually assigning the same task outside the coordinator can still cause duplication.

## Pause, resume, merge

- If work pauses, push the branch and create a draft PR / issue handoff. **Keep the claim**.
- For review wait, use `park` below to keep the claim without blocking independent work. Do not edit parked work until `resume` succeeds.
- The same worker can resume after verifying its current claim. A different worker must transfer ownership after the original worker stops and pushes its work. Never silently steal an existing claim.
- After the PR is safely merged or work is explicitly abandoned, dispatch operation `release` with the same owner ID and issue number. If the issue has already been closed, the workflow must allow releasing it; verify run status.
- Completed, merged reservations are also cleaned up automatically under the completion rules below. A pause or owner hold does not meet those rules.
- A claim does not authorize unsafe merges. Recheck latest main, CI, tests, protection rules and conflicting file edits. Do not force-push or bypass required checks.
- Stale claims require manual review; never auto-expire without inspecting branch/PR status.
- GitHub Actions `concurrency` serializes coordinator runs, but queued runs are subject to GitHub's pending-run replacement semantics. A dispatched run can be canceled before execution; only a successful run confirms a claim.

### Park review wait and resume

After pushing **all** work and recording the remaining review/hold on the Issue,
stop editing that work and post:

```text
/issue-claim {"operation":"park","issue":556,"owner":"codex-example-unique","agent":"codex","claim_run":"123456"}
```

The coordinator checks the current owner/run, source-run success and all
referencing same-repository Open PR heads, rechecks before writing, then records
their exact heads in a waiting checkpoint. This is still a v1 `claimed` marker,
so old readers cannot mistake it for a free Issue. Use the successful park run
as the new current reservation run. You may now claim a separate independent
Issue with the same worker; file/dependency checks still apply.

To edit the parked work again, finish/release or park the currently active
Issue, then request `resume` with the waiting run as `claim_run`. It verifies the
saved heads and other active work before writing a new active reservation.
Wait for resume success and use its new run ID. A changed or missing saved PR,
closed-unmerged PR, failed park run or unknown checkpoint prevents switching.
If a saved head changed legitimately, inspect it and explicitly refresh `park`
before switching. A still-open Issue with a merged saved PR may remain waiting
for further scope decisions. No adoption or merge permission follows from park.

Both operations are also available through `workflow_dispatch`; they do not
launch agents or detect unpushed files. Issuing `park` is the worker's explicit
statement that all work is pushed and editing has stopped.

## Automatic completion and procedure upkeep

Issue events handle completion and common-procedure updates. A push changing
the coordinator/protocol and a daily 03:23 UTC run reconcile existing Issues;
`operation=maintain` can target one Issue or sweep the repository.

Automatic release requires **all** of: a closed Issue with reason `completed`,
no blocked label, a verifiable successful current claim run, no referencing Open
PR, and at least one referencing PR merged from this repository into the default
branch. Issue state, ledger and merged heads are rechecked before the bot writes
the release for the recorded owner. Open/unfinished/held Issues, closed-unmerged
work, unknown legacy records and failed runs are preserved. The automation does
not close Issues, merge PRs, remove branches or take another worker's task.

When an open Issue's body/history contains an outdated common procedure, a
managed `issue-claim-policy:v2` block at the top points to the current rules.
The original body/comments and individual adoption holds, verification criteria,
scope and stop instructions are preserved. Repeated upkeep does not duplicate
the block; a changed body is deferred instead of overwriting a concurrent edit.
Failed verification prevents the affected write and is reported as deferred;
previously completed operations are not rolled back. A malformed managed block
is kept for manual inspection.

## Limits

- This coordinates **issue assignment**, not automatic cloud-session spawning or continuous autonomous work.
- Agents must request the coordinator through a comment or dispatch and wait for its success before coding; read-only work may proceed while waiting.
- GitHub Actions needs to be enabled and workflow permissions must allow issue comments. The workflow must first be merged to the default branch.

## Dispatch failure and queue contention

A successful API request to dispatch a workflow is not a reservation. Check the *specific run ID* and its job summary for `Claim confirmed` / `CLAIMED_ISSUE`. If the run was canceled while pending (GitHub concurrency can replace pending runs), retry the dispatch with the **same** worker ID. Never begin coding after a canceled, timed-out, or failed run. Do not run multiple dispatches for the same worker simultaneously. If a run's outcome is unknown, inspect issue claim comments before retrying.

The current comment-based claim ledger depends on the workflow's shared concurrency group. It is not an atomic lock against external scripts that bypass the workflow. Do not directly post claim markers. For strict cross-workflow atomicity, use a dedicated lock service or Git ref compare-and-create in a separately reviewed implementation.

## Cloud / multi-chat handoff checklist

Each Codex chat and Claude Code session must use a **different** worker ID, including separate cloud sessions from the same account. The coordinator is a reservation mechanism, not an agent launcher. A worker cannot infer the result of a `gh workflow run` dispatch from its exit code: it must identify the corresponding run and confirm **successful completion** plus the `CLAIMED_ISSUE` log or job summary before editing code.

**Starting:** Check open PRs and any prior handoff first; create a unique worker ID; reserve an eligible Issue; record the confirmed Issue and run ID; then branch from current main. If CLI dispatch is unavailable, use the supported comment entrypoint and verify its result. Do not assume a reservation from an unconfirmed request; continue non-conflicting read-only work while waiting.

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

**Resuming:** The same worker may continue its reserved branch after verifying the current bot owner/run, successful source run and latest Issue/PR heads. For a different worker with no referencing Open PR, stop the original session and push its work, then release by the original owner and claim by the new worker. For saved Open PRs, use the recorded transfer below; ordinary claim still rejects Open PRs. Never reuse another session's ID or manually write claim markers.

### Recorded handoff of saved Open PRs

A repository writer (`write`, `maintain` or `admin`) may use `operation=transfer`
after confirming the original session stopped, all work to be handed off was
pushed, and the scope and unfinished work were recorded on the Issue. The account
that dispatched the original claim writes the handoff record. This is an agent
handoff record, not a request for the user to approve the task again. A failed
chat message or inactivity alone is not proof of a stopped worker. Check the
session's live status and saved branches/PR heads; do not infer `stopped` or
`pushed` from silence. Preserve unrelated pending PRs.

The original claim actor posts a comment on that same Issue containing this
single-line record (replace every value with verified evidence):

```text
<!-- issue-handoff:v1 {"issue":325,"from":"old-worker","to":"new-worker","claim_run":"123456","stopped":true,"pushed":true,"prs":[{"number":326,"head":"0123456789012345678901234567890123456789"}]} -->
```

List **all** referencing Open PR numbers and their current full head SHAs,
including Drafts; describe which PR may be edited, which must be preserved and
the evidence for stopping/pushing in the prose. Both the record author and
dispatch actor need repository write permission. For an ordinary transfer, the
record author must match the validated request account in the bot's
`issue-claim-actor:v1` metadata, or the claim run's `actor.login` for older/dispatch
records. This preserves the original requester when a scheduled run recovers
a queued comment. If the original
actor cannot provide a record, retain the existing admin-reviewed recovery path:
both author and dispatcher must be admins and independently verify the evidence.
The coordinator verifies the active old owner/claim run, the source run's success, the Issue's open/unblocked state,
the exact Open PR set and same-repository heads, and that the new worker owns
no other active Issue, including unfinished closed Issues; parked saved heads
are verified separately. It rechecks the record and mutable
state before writing. Unknown permissions, changed PR heads, an edited approval,
missing PRs or stale/failed reservations cause refusal without a ledger write.
Accounts do not identify individual chats: two sessions under one account have
the same `actor.login`. The workflow cannot prove a session stopped or find
unpushed work; the explicit record must be based on actual session evidence.

```sh
gh workflow run issue-claim.yml --ref main -f operation=transfer -f issue=325 \
  -f owner=new-worker -f agent=codex -f claim_run=123456 \
  -f handoff_comment=987654 -f request_id=<fresh-unique-request-id>
```

The serialized coordinator writes one new bot claim record for the new worker,
with the original owner and handoff URL in its audit text. This explicitly
relinquishes the old ownership and avoids an unreserved release/claim gap;
do **not** run release first for this path. Wait for that exact transfer run to
succeed and confirm `CLAIMED_ISSUE`, then match the current bot ledger to the new
owner and **transfer run ID** before editing. Read-only verification is enough;
`status` with that ID as `claim_run` is optional. Cancellation
or failure after the write retains the reservation and cannot authorize work;
inspect it and obtain a fresh recorded handoff or formal release by the new owner.
This validates snapshots, not an atomic lock on PR branches: recheck live heads
before editing and retain all existing Git Safety, test, CI and merge gates.

#### Released legacy reservation with a saved Draft

For a reservation released **before run metadata was introduced**, an admin may
use the same transfer operation with an explicit `recovery` field in the approval:

```text
<!-- issue-handoff:v1 {"issue":325,"from":"old-worker","to":"new-worker","claim_run":"123456","stopped":true,"pushed":true,"recovery":{"claim_comment":111,"released_comment":222},"prs":[{"number":326,"head":"0123456789012345678901234567890123456789"}]} -->
```

Independently review the original stopped-session handoff, pushed PRs and source
claim run first. List the exact last two **bot** ledger entries: the original
claim and its release by the same owner. Both must lack run metadata. The latest
entry must still be that released comment; an active, replaced or modern claim
is not eligible for this recovery path. Ordinary claim and ordinary transfer
continue to reject it without this explicit admin approval.

The source run must have succeeded on its first attempt, be a `workflow_dispatch`
of `issue-claim.yml` on the default branch, and contain the original bot claim's
creation time within its recorded start/end times. This rejects unrelated runs
and ambiguous reruns; it does **not** prove a stopped session. The admin must
verify that separately from the recorded handoff and current saved work. All
other transfer guards (admin actor/author, exact Open PR heads, open/unblocked
Issue, one active Issue per new worker, and rechecks before writing) still apply.

Dispatch with the original successful `claim_run` and that approval comment ID.
After success, verify the current bot owner and **new transfer run ID** before editing;
a separate `status` dispatch is optional.
Do not close/reopen the Draft, reuse the old worker ID, edit/delete bot history,
or infer permission merely because a claim was released long ago.

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
resuming, verify all of the following using read-only GitHub API calls or a
supported integration:

- The Issue is open, is not a PR and has no blocked label. It is active, not
  parked: an `issue-claim-wait:v1` record requires a successful `resume` before editing.
- Read **all pages** of comments. Among `github-actions[bot]` comments matching
  `issue-claim:v1`, the latest record is `claimed` for this worker, and its
  `issue-claim-run:v1` ID equals the confirmed claim/transfer run.
- That exact run completed with `conclusion=success`; confirm its Issue, worker
  and `CLAIMED_ISSUE` log/summary, not just its dispatch response.

Do not write claim markers or dispatch an extra workflow just to repeat these
reads. If convenient, `operation=status` with the same Issue/owner and
`claim_run=<successful-claim-run-id>` performs the ledger checks instead. Wait
for that specific status run and verify `CLAIM_VALIDATED_ISSUE` / owner / run.
The coordinator rejects released reservations, other owners, different runs,
closed/blocked Issues, and claims whose source run failed or was canceled.
`status` without `claim_run` alone does **not** authorize work. If current state
cannot be verified, hold only that implementation and continue independent
read-only work; do not infer that a claim is free.
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
Unpushed work is invisible. A different worker resuming an existing Draft PR must
use the recorded transfer above; do not change `#number` to a URL to bypass its
guard. A same-worker resume needs current owner/run and PR-head verification,
not a new claim. Hold conflicting paths while continuing independent work
within the reserved Issue. Taking a different Issue still requires a claim.

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

Run `node --test tools/test_issue_claim.mjs`. It executes the same
`tools/issue_claim_coordinator.cjs` module as all event entrypoints with mock APIs,
including waiting checkpoints, comment permissions/idempotence, completion and
procedure synchronization. It does not simulate
GitHub Actions scheduling or establish that a real Claude Code session works.
Use `actionlint .github/workflows/issue-claim.yml .github/workflows/issue-claim-checks.yml`
for workflow syntax. Live concurrency/cancellation probes must use disposable
Issues and an isolated branch concurrency group so production pending workers
are not replaced by the test. Remove branch-only waits/fixture restrictions and
restore the production group before merging. Release every test reservation and
close disposable Issues; retain run/comment links as evidence on Issue #350.
