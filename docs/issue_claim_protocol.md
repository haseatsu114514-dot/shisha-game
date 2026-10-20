# Shared issue queue: Codex / Claude Code / multiple chats

All Codex and Claude Code sessions are independent workers. GitHub Actions `.github/workflows/issue-claim.yml` is the central, serialized reservation coordinator.

## CLI and GitHub integration: the same authority

Use either an already-authorized CLI or a supported GitHub integration/API.
Installing `gh`, opening a shell, or creating a local checkout is not required
when the integration can perform the operation and verify its result.
Both routes use the **game repository's** coordinator, current bot ledger,
owner/run validation and `issue-claim-coordinator` concurrency group with
`cancel-in-progress: false`. Do not run a second writer in the bridge repository.

| Step | CLI with a checkout | GitHub integration without a checkout |
| --- | --- | --- |
| Inspect | Read current main, Issue, all comment pages, open PRs and changed paths | Fetch the same repository/ref, Issue/comments and PR files through the integration |
| Request | `gh workflow run` with explicit repo/default branch and unique request ID, or a comment | Dispatch if supported; otherwise create one Issue/PR Conversation comment |
| Identify result | Match the whole dispatch request ID, or the comment ID and its result/run URL | Read the result for that exact comment ID or dispatch request; never guess from the newest run |
| Authorize editing | Read the successful run and latest bot owner/run | Read the same run/summary or job logs and all current ledger pages; no second status run is required |
| Save | Git Safety, commit, push and confirm remote head | Verify base/blob/tree, create commits on a separate branch, update its ref and confirm remote head |
| Validate | Run relevant local checks and inspect CI on the submitted head | Mark local checks unrun; use relevant CI on that exact head and record actual results |

Local root/hooks/script checks apply when a checkout is used. An API-only worker
records those local checks as not applicable and follows the API checks in
`AGENTS.md`; it must not claim to have run a shell script. In either route,
preserve other workers' uncommitted work, branches, PRs, owner/run and history.
If a ref unexpectedly changes while saving, reread and compare it instead of
forcing an update. A saved PR resumes on its existing branch after ownership
verification or formal transfer, not by copying another worker's branch.

If dispatch/`next` is unavailable, read eligible Issues and their dependencies,
choose an unclaimed candidate within the authorized scope, and post `claim`.
Comment `next` is not supported. A CLI can also use the same comment route:

```sh
gh issue comment 325 --repo haseatsu114514-dot/shisha-game --body '/issue-claim {"operation":"claim","issue":325,"owner":"codex-example-unique","agent":"codex"}'
```

An integration sends that exact one-line body using its existing Issue-comment
tool. These are examples, not instructions to reserve Issue 325. On a PR
Conversation, provide the target Issue number explicitly. Do not use a review
comment or manually create bot ledger markers. Keep the returned comment ID;
the bot's `issue-claim-request:v1 comment=<id>` acknowledgment/result identifies
its run URL. This request acknowledgment is not itself the reservation ledger.

Useful read-only API resources (use the same resources via a connector):

```text
GET /repos/haseatsu114514-dot/shisha-game/issues/<issue>
GET /repos/haseatsu114514-dot/shisha-game/issues/<issue>/comments?per_page=100&page=<page>
GET /repos/haseatsu114514-dot/shisha-game/actions/runs/<run-id>
GET /repos/haseatsu114514-dot/shisha-game/actions/runs/<run-id>/jobs
```

Follow every comment page. Match the current latest bot ledger to the successful
run's repository, `.github/workflows/issue-claim.yml`, operation, Issue and worker
using its title/summary/logs. Do not substitute a run from the bridge repository
or a different workflow. A `park`/`resume`/`transfer`/`handoff`/`pickup` success writes a new current
run: validate that new ID, not the original claim. If required result data cannot
be read, do not edit based on a dispatch response or assumed success.

A missing CLI capability is different from an authorization denial. Use an
already-authorized alternative when available; do not install/login merely to
reproduce a CLI example. Ask before creating credentials, expanding permissions
or changing repository visibility. Do not bypass a denial with another identity.
If neither route can submit or verify a request, preserve the claim/work and
report the missing capability; read-only investigation can continue.

## Bridge separation

The shared code is being preserved in private `haseatsu114514-dot/dot-ai-bridge-test`.
Open PRs there, including #13, are not proof of an external-code deployment.
Until a separately reviewed game-side switch is actually deployed, continue to
use this repository's current main workflow and ledger. Do not copy reservations,
release/reclaim existing work, change the concurrency group, or execute production
coordinator code directly as part of separation.

`handoff` and `pickup` use the game-side coordinator described below. Their
workflow and coordinator must be deployed together on main before use; they
do not import private bridge code or alter existing reservations.

The public game cannot use private-repository Action sharing as a direct
connection to the bridge; its default `GITHUB_TOKEN` is repository-scoped.
An authenticated code-fetch design needs separate review of access and public
job logs/artifacts. No new credential, private sharing setting, visibility change
or production switch is authorized merely by these instructions. Keep this
game-side procedure self-contained so private bridge access is not required for
ordinary game work. See GitHub's [private sharing](https://docs.github.com/en/actions/how-tos/reuse-automations/share-across-private-repositories)
and [token scope](https://docs.github.com/en/actions/concepts/security/github_token).

## Frequent AI changes: handoff, then pickup

Keep switching between Codex and Claude when usage limits require it. Use this
path for a planned change of AI; no successor ID or user-operated release/claim
sequence is needed. The task stays on the same Issue and saved branch/PR.

Before reaching a limit, the current AI must save all relevant work through
commit/push or confirmed API branch updates, create a Draft PR if unfinished,
and verify the matching remote head with no pending unsaved changes. Then post
on the Issue (replace the worker and **current successful** run):

```text
/issue-claim {"operation":"handoff","owner":"codex-old-session","agent":"codex","claim_run":"123456","summary":"DONE: saved changes in the Draft PR\nTODO: finish the remaining scene\nTEST: focused checks passed; Safari not tested\nNEXT: continue on the saved branch"}
```

The command is the original requester's explicit declaration that work is pushed
and editing on this Issue has stopped. The coordinator verifies that requester,
the successful claim run and every referencing same-repository Open PR head,
then records the exact heads and summary in a bot checkpoint. Summary text is
required (1–1200 characters, without bot ledger markers). It should include
DONE / TODO / TEST / NEXT. The workflow cannot inspect unpushed local files or
prove that another process stopped; the issuing AI must establish that before
posting. This operation records saved work; it does not commit or push for you.

Wait for that exact handoff run to succeed and match the current bot owner/run.
The Issue remains reserved; ordinary `claim` and queue `next` cannot take it.
The old worker may work on an independent Issue while this checkpoint is valid.
Stop editing the handed-off work, including after a quota reset.

The next AI uses its **own new worker ID** and posts on the same Issue:

```text
/issue-claim {"operation":"pickup","owner":"claude-new-session","agent":"claude"}
```

The coordinator reads the current offer itself; copying PR SHAs or writing a
separate named handoff approval is unnecessary. A `claim_run` may optionally pin
the expected handoff run. It verifies the successful handoff run, original and
new requesters' write permissions, unchanged saved heads, current Issue and
checkpoint, and that the new worker has no other active task. One bot write
replaces ownership without an unreserved gap. After pickup success, match the
new owner/run and resume the **existing saved branch**, not a duplicate branch.
The prior summary is retained in the pickup record.

The original worker can cancel an unconsumed offer with `resume` and the handoff
run as `claim_run`; successful resume removes the offer. This cancellation also
accepts unchanged merged checkpoint heads while the Issue remains open, using
the same saved-PR validation as pickup. Ordinary review-wait `resume` still
requires saved Open PRs. Once pickup succeeds,
the old worker cannot resume or release it. Changed/missing PRs, closed-unmerged
heads, blocked/closed Issues, edited requests and failed/canceled runs do not
authorize pickup. A saved PR merged at its exact head may still be used if the
Issue remains open for more work. A plain `park` is review wait, **not** permission
for another AI to pick up the task.

Both operations also work through `workflow_dispatch` (`summary` only for
`handoff`). They use the existing shared lock, permissions and rerun refusal.
Do not rerun a reservation-changing job: inspect the ledger and send a fresh
request. If a pickup wrote a reservation but its run failed, preserve that new
owner record and use the existing release/recovery procedure; do not retry the
old offer. Existing `transfer`, legacy recovery and `park`/`resume` remain valid.

If a limit arrives before a valid handoff was saved, preserve the last pushed
checkpoint and use the existing stopped-session recovery procedure below.
Inactivity alone is never permission to take another worker's task. Neither
automatic quota detection nor launching another AI is provided by this workflow.

Before every reservation write, comment requests are reread unchanged (including
the edit timestamp) and their writer permission is checked again. Handoff,
pickup and transfer finish PR enumeration before final target ledger, Issue,
source-run and permission checks. Pickup also rechecks the original source run
and the offer body/edit timestamp. These are serialized safety snapshots, not
an atomic lock against external Issue/PR writers; recheck live state before
editing and keep the existing CI, review and merge gates.

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

Supported comment operations: `claim`, `park`, `resume`, `handoff`, `pickup`,
`release`, `status`, `transfer`, and single-Issue `maintain`. Use the existing transfer record and
`claim_run`/`handoff_comment` fields for transfer. The exact comment ID identifies
its response; a duplicate event delivery does not reserve twice.
Do not use GitHub's rerun button for reservation-changing comment jobs: inspect
the ledger and submit a fresh comment. Such reruns are refused so a failed or
canceled run that already wrote a reservation cannot later authorize it merely
by skipping an acknowledged request.

Comment `park`/`resume`/`handoff`/`release` also bind the caller to the reservation's
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
3. Dispatch **Issue claim coordinator** on the default branch: operation `next`, owner `<worker ID>`, agent `codex` or `claude`. Leave issue blank. If dispatch is unavailable, use the integration's read/select/`claim` comment route above.
   `gh workflow run issue-claim.yml --repo haseatsu114514-dot/shisha-game --ref main -f operation=next -f owner=codex-a-20261011-01 -f agent=codex`
4. Wait for the **specific** workflow run to complete successfully, read its job summary / `CLAIMED_ISSUE` log, and match the current bot ledger's owner/run to it. A successful dispatch alone does NOT grant a reservation. Read-only API verification is sufficient; a second `status` dispatch is optional (see below).
5. For new work, create a branch from latest `origin/main`, implement, test, push, and create a PR referencing the claimed issue. Resume saved work on its existing branch after verifying ownership and any required transfer. Document owner, branch, PR and remaining work on the issue.

Read-only discussion, investigation and review do not require a claim. Implementation,
including a user-selected task, still requires one. Use the Issue/PR as the stable
work identifier; a worker ID identifies one session and must not be shared.
Current ownership and adoption/hold decisions belong on the Issue/PR, not in
permanent skills or old handoff notes.

To claim a specific issue: `gh workflow run issue-claim.yml --repo haseatsu114514-dot/shisha-game --ref main -f operation=claim -f issue=325 -f owner=codex-a-20261011-01 -f agent=codex`, or the same `claim` comment through CLI/integration.

## Selection

- Priority is by existing `difficulty:S` through `difficulty:D`, then P0/P1/P2 and issue number. Note: current code sorts by difficulty first; any priority override needs a separately reviewed change. Unclassified issues are excluded; parent/management issues are not recognized automatically and must be checked manually.
- `agent` records the client type only. Codex and Claude use the same selection order; there is no character/dialogue keyword routing in the coordinator.
- The coordinator skips issues with existing claim records, blocked labels, or open PRs that reference `#number`, `owner/repo#number`, or the repository's full Issue URL (including Draft PRs). Manual claims also reject blocked labels. It cannot guarantee detection of dependencies, loosely referenced PRs, or file-level conflicts. Manually check existing PRs before implementing.
- Each worker has **one actively edited Issue at a time**, plus any number of explicitly parked saved PRs. Waiting Issues remain exclusively reserved. Existing records without a waiting checkpoint remain active; the workflow does not infer review wait from inactivity or Draft status.
- Reservations prevent double booking only when every worker follows this protocol. A user manually assigning the same task outside the coordinator can still cause duplication.

## Pause, resume, merge

- If work pauses, push the branch and create a draft PR / issue handoff. **Keep the claim**.
- For review wait, use `park` below to keep the claim without blocking independent work. Do not edit parked work until `resume` succeeds.
- The same worker can resume after verifying its current claim. A different worker uses `pickup` for an explicit handoff-ready checkpoint, or the existing recorded `transfer` after the original worker stops and pushes its work. Never silently steal an existing claim.
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

Issue and same-repository PR-merge events handle completion and common-procedure updates. A push changing
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

**Pausing:** Commit and push all recoverable changes; create/update a Draft PR if unfinished. For a planned AI change use `handoff` above; use `park` for review wait. Record these fields on the Issue (without secrets):

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

**Resuming:** The same worker may continue its active reserved branch after verifying the current bot owner/run, successful source run and latest Issue/PR heads; `resume` is required for waiting work. A different worker first uses `pickup` when a valid handoff offer exists. Otherwise, with no referencing Open PR, stop the original session and push its work, then release by the original owner and claim by the new worker. For saved Open PRs without an offer, use the recorded transfer below; ordinary claim still rejects Open PRs. Never reuse another session's ID or manually write claim markers.

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

#### #745: narrowly pinned owner-approved recovery (unknown unsaved work)

The existing admin-reviewed `issue-handoff:v1` path above still requires verified
`stopped:true` and `pushed:true`. It cannot be used when those facts are unknown.
The independent `issue-owner-recovery:v1` path uses **only `operation=transfer`
and `handoff_comment`**, after the reviewed #745 implementation is deployed on
main. It remains independent of ordinary `handoff`/`pickup`: #745 authorizes
only this narrowly pinned recovery exception. It never converts historical
unknown stopped/pushed work into a verified declaration. #614 preservation
adapter/fencing is unrelated and unchanged.

This exception is pinned in code to `haseatsu114514-dot/shisha-game` and these
exact current old reservation and saved Open PR tuples:

| Issue | Old worker (`from`) | Old `claim_run` | Saved PR | Exact head |
| --- | --- | --- | --- | --- |
| 709 | `codex-709-20261019-peppermint-0015` | `39272409432` | 740 | `a30de7f8d9900f8a1ca5a866181b4a0a7d444d03` |
| 717 | `codex-text-717-20261019-f31a` | `39385075235` | 739 | `7ae8077d0cc0d2f233fd2d139d18bd0b3ebda91e` |
| 726 | `codex-701-holes-20261019-01` | `39236047840` | 731 | `14713be78dac4356cd4c31219d612b173014b465` |

The owner initially accepted unknown/unrecoverable unsaved-work loss for **709
and 717**; **726 was a distinct, later additional approval**. Do not describe
726 as covered by the earlier approval. These instructions are context, not a
live approval comment or permission to perform a transfer. #709 is currently
closed and the unchanged open/unblocked check refuses it. Do not reopen it or
release its reservation to use this exception. Changed owner/run, changed PR
heads, another target or another repository require separate review, not
updating this record to arbitrary values.

For each eligible target separately, repository owner `haseatsu114514-dot` must
post a live approval comment **on that target Issue**. Both that author and the
request actor must currently have repository **admin** permission. A nonowner
admin cannot author the approval. Verify the existing owner/run and successful
source run, all referencing Open PRs (including Drafts), exact same-repo saved
head, and the actual concrete owner consent before posting. The new session's
unique worker ID must differ from the old one and own no other active Issue;
any parked reservation must have a valid saved checkpoint. Unknown permissions
refuse. No automatic cleanup/release occurs in this path.

Exact input schema (single-line JSON marker; all fields required, no extra keys):

```text
<!-- issue-owner-recovery:v1 {"repo":"haseatsu114514-dot/shisha-game","issue":717,"from":"codex-text-717-20261019-f31a","to":"<NEW_OWNER>","claim_run":"39385075235","prs":[{"number":739,"head":"7ae8077d0cc0d2f233fd2d139d18bd0b3ebda91e"}],"approval_issue":745,"consent":"resume-saved-pr","accept_loss":true,"stopped":"unknown","pushed":"unknown","unsaved_work":"unknown","scope":"<CONCRETE_UNKNOWN_UNRECOVERABLE_SCOPE>","consent_evidence":"<CONCRETE_OWNER_CONSENT_EVIDENCE>"} -->
```

`issue`, `approval_issue` and PR `number` are integers; `claim_run` is a string;
`prs` contains exactly the pinned `{number,head}` object. `accept_loss` is the
boolean `true`; `consent` is exactly `resume-saved-pr`. `stopped`, `pushed` and
`unsaved_work` must each be the string `unknown`, never invented true flags.
`to` is operator input, not an old worker ID or a generic shared identity.
`scope` and `consent_evidence` must each contain at least 20 non-padding
characters and must each also appear verbatim in the surrounding prose.
`scope` must explicitly contain `unknown/unrecoverable`, `uncommitted`, and
`unpushed`, explaining what cannot be recovered and that only the saved PR is
being resumed. `consent_evidence` must describe the actual owner instruction and
its target-specific consent (initial 709/717 versus later additional 726); quote
or precisely identify that evidence. Merely repeating a generic approval or
asserting that an admin approved is insufficient for operator review. The code
checks the structured declaration and its presence in prose, not the truth of
human consent evidence.

The surrounding prose must include this exact explicit consent sentence,
substituting the new owner and pinned PR/Issue numbers:

```text
I authorize <NEW_OWNER> to resume saved PR #739 for Issue #717 under #745 and accept loss of unknown/unrecoverable uncommitted and unpushed work; stopped and pushed remain unknown.
```

Then include the concrete scope and evidence text verbatim. For 709 use PR740 /
Issue709 and its exact table tuple; for 726 use PR731 / Issue726 and its exact
table tuple, recording the distinct later approval. There is no generic fallback,
legacy `recovery` field, or mixed `issue-handoff:v1` record. One approval comment
must contain exactly one independent owner recovery marker.

After reviewed deployment and live checks, substitute the per-target approval
comment ID and a different new owner chosen by the operator. These commands are
examples only; they are not run by tests or by this implementation task:

```sh
gh workflow run issue-claim.yml --repo haseatsu114514-dot/shisha-game --ref main -f operation=transfer -f issue=709 -f owner='<NEW_OWNER>' -f agent=codex -f claim_run=39272409432 -f handoff_comment='<709_APPROVAL_COMMENT_ID>' -f request_id='<FRESH_UNIQUE_REQUEST_ID>'
gh workflow run issue-claim.yml --repo haseatsu114514-dot/shisha-game --ref main -f operation=transfer -f issue=717 -f owner='<NEW_OWNER>' -f agent=codex -f claim_run=39385075235 -f handoff_comment='<717_APPROVAL_COMMENT_ID>' -f request_id='<FRESH_UNIQUE_REQUEST_ID>'
gh workflow run issue-claim.yml --repo haseatsu114514-dot/shisha-game --ref main -f operation=transfer -f issue=726 -f owner='<NEW_OWNER>' -f agent=codex -f claim_run=39236047840 -f handoff_comment='<726_APPROVAL_COMMENT_ID>' -f request_id='<FRESH_UNIQUE_REQUEST_ID>'
```

The 709 example must currently refuse because it is closed. The comment route
uses the same per-target approval and validation; post on the target Issue or
provide its explicit number from a PR Conversation:

```text
/issue-claim {"operation":"transfer","issue":709,"owner":"<NEW_OWNER>","agent":"codex","claim_run":"39272409432","handoff_comment":<709_APPROVAL_COMMENT_ID>}
/issue-claim {"operation":"transfer","issue":717,"owner":"<NEW_OWNER>","agent":"codex","claim_run":"39385075235","handoff_comment":<717_APPROVAL_COMMENT_ID>}
/issue-claim {"operation":"transfer","issue":726,"owner":"<NEW_OWNER>","agent":"codex","claim_run":"39236047840","handoff_comment":<726_APPROVAL_COMMENT_ID>}
```

Replace placeholders before sending valid JSON. Submit only one request for the
chosen target; claiming another active Issue requires finishing or parking the
first. Never rerun a mutating comment job: inspect its result and submit a fresh
comment as the existing rerun rules require.

Both initial and immediately-before-write validation check live Issue state,
admin permissions, unchanged approval body/author/thread/edit timestamp/link,
exact current reservation (including original ledger comment), successful source
run, exact same-repository Open PR set/head and new-worker availability. One
new bot claim write replaces the old reservation without a release/claim gap.
Its `issue-owner-recovery-audit:v1` record copies the exact approval fields and
`approval_comment` ID, explicitly retaining all three unknown values and accepted
loss risk. Original comments, PRs, branches and history remain intact. Refusal
or a failed write leaves the old reservation in place; replay or a stale approval
cannot create an additional claim. The comment entrypoint may write its ordinary
request-result receipt on refusal; that is not a reservation write.

A failed/canceled run after the claim write leaves the new reservation protected
and does **not** authorize editing. Wait for the exact successful transfer run,
`CLAIMED_ISSUE`, and current bot owner/new run match before resuming the saved
branch; preserve the existing failure recovery rules above. These snapshot
checks do not lock external PR writers. Recheck live heads before editing and
keep all Git Safety, CI, review and merge gates. No test performs a live transfer.

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
gh workflow run issue-claim.yml --repo haseatsu114514-dot/shisha-game --ref main -f operation=claim -f issue=325 \
  -f owner=codex-a-20261011-01 -f agent=codex -f request_id="$request_id"
gh run list --repo haseatsu114514-dot/shisha-game --workflow issue-claim.yml --json databaseId,displayTitle,status,conclusion
```

Match the **entire request ID** in `displayTitle`; never select the newest run
without checking it. Use `gh run view <run-id> --repo haseatsu114514-dot/shisha-game --log` (or the integration's run/job-summary/log reader) to confirm its owner, Issue
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
