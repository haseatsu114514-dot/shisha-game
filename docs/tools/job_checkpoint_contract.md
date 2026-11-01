> **注意（2026-10-30）**: 本ツールは任意の試作で、必須手順ではない（`AGENTS.md`）。本文の claim／worker／予約・引き継ぎに関する記述は、2026-10-23に撤廃したIssue予約の時代の設計で、現在の運用には使わない。

# Job checkpoint contract v1 — offline first stage (#594)

`tools/job_checkpoint_schema.json` defines a closed public data envelope.
`python3 -B tools/validate_job_checkpoint.py INPUT.json` reads one file and the
adjacent schema, and prints a fixed PASS or REJECT message. Exit codes: 0 for
consistent data, 1 for invalid/unverifiable data, 2 for invalid invocation.
There are no network calls, subprocesses, persistence, coordinator imports,
stop commands, reservation writes, transfer, release, or merge operations.
**PASS means data consistency only. It grants no operation permission**, including
execution, editing, pushing, replacement or merging. Holds can coexist with PASS.

## Identity and authority

The durable `job-<issue>` identifies one Issue in this repository. It survives
attempt replacement. `attempt-<number>` identifies an execution; generation is
monotonic. The binding also contains a public `worker-<number>` label and the
existing claim run number. These are public aliases, never private runtime IDs.
Account name and chat deliverability are neither identity nor ownership proof.
This proposal does not change current session-specific worker/claim rules or
migrate existing ledger records. Alias resolution and authenticating the current
ledger remain external trusted work; no account-to-chat mapping belongs here.

The caller must independently obtain the **current authoritative** checkpoint,
claim binding, maximum generation/revision, predecessor, remote branch full SHA,
and complete referencing Open/Draft PR set with full heads and draft flags.
It must compare those observations to the envelope and supply their canonical
checkpoint digest in `observation.checkpoint`. `observation.previous` must name
the actual previous digest; `observation.proposal` binds the exact replacement
proposal, or is null. SHA-256 fingerprints use sorted JSON keys, ASCII escaping,
compact separators and UTF-8 (see `fingerprint`). Array order is significant;
collectors must use stable ordering. All PR heads may differ from the saved
branch; tests target that branch head exactly. The schema requires 40 lowercase
hex characters for every commit SHA, not abbreviated refs.

The offline tool cannot discover live truth, authenticate a collector, detect
omitted PRs, find local/untracked/external-service work, or distinguish fabricated
proof from real proof. Setting `verified`/`independent` in a file establishes
nothing by itself. The caller must keep private evidence outside this public
projection and only attest these fields after independent verification. Untrusted
observation files MUST NOT be used as authority. A forged or replayed whole
envelope cannot be detected without the external current authority; matching
input digests are not a live ledger check or cryptographic signature.

## Contents, preservation and refresh

`scope`, `done` and `remaining` are public numeric work-item references to the
Issue's scope, not prose. Done and remaining partition scope. Holds have a numeric
public reference and one of hold/cancel/approval_pending/denied; raw reasons and
private refusal text are excluded. Tests use public numeric references with
pass/fail/not_run and the exact tested branch SHA. Failed/not-run tests can be
recorded consistently; PASS is not a test or merge gate. No-artifact checkpoints
have no test entries or done work. Each checkpoint, including the previous
checkpoint, permits only one entry per test ID, regardless of result or SHA.
Distinct test IDs may share a SHA. This is a result snapshot, not execution history.

| Route | Required contents |
| --- | --- |
| no_artifact | Independently verified never-started; null branch/head, no PRs, no done work/tests |
| branch_only | Saved clean pushed branch/full SHA, no Open/Draft PRs |
| open_pr | Saved clean pushed branch/full SHA and every Open/Draft PR number/head/draft flag |

No PR does not prove no work. `unknown`, `unpushed`, dirty preservation and
missing proof fail closed. No-artifact requires independent `never_started`
proof; the other routes require independent `saved_clean_pushed` proof covering
all work, including uncommitted, untracked and externally generated artifacts.
Proof is bound to the **whole checkpoint**, including worker/run, generation,
revision, saved heads, holds and tests, not just a branch name.

Create/refresh before execution, after each push and before pause; `boundary`
records which event the snapshot represents. An active entry from ready/paused
or an initial active entry requires before_execution; paused requires
before_pause; after_push requires saved work. created_at is immutable and precedes
updated_at. Checkpoint, authoritative observation and proof timestamps must be
no more than 300 seconds old with no future skew. Proof must be at or after the
checkpoint and at or before observation. The CLI uses UTC wall time; tests inject
a deterministic clock. Collectors must reacquire evidence at every boundary and
immediately before any eventual write. Freshness is not proof of stopping.

## Revision and state transitions

Revision 1 has no predecessor or previous object. Each subsequent revision must
supply the complete previous checkpoint, its exact digest and revision + 1.
Within this stage a revision retains job, issue, binding, creation time and scope;
done work cannot disappear. Once either saved route has been recorded, a later
revision in the same attempt cannot return to no_artifact/never_started_verified,
even with empty done work and rebound observation. No-artifact may progress to
either saved route when work first begins. The observation must match the new revision and its
predecessor, so old revision/generation, head drift, changed PR sets/heads and
concurrent snapshot mismatches fail closed against a current trusted observation.

| Previous state | Allowed next state |
| --- | --- |
| ready | ready, active, held, cancelled |
| active | active, paused, held, cancelled, complete |
| paused | paused, active, held, cancelled |
| held | held, cancelled |
| cancelled | cancelled |
| complete | complete |

Complete requires no remaining work. Every previous hold must survive unchanged;
a required cancel forces cancelled; held/cancelled require hold data. Missing,
dropped or altered holds are rejected even in a replacement proposal. This
stage has no hold-resolution operation: resolving approval/denial/cancellation
requires a separately reviewed authority/event contract, never attempt exchange.

## Same attempt and prospective replacement

`same_attempt` validates the current binding without requiring or claiming that
it stopped. Proposal and stop proof must both be null.

`proposed_replacement` still validates the **old current checkpoint and claim**.
Its proposal must use a new attempt, public worker and claim run, and exactly
old generation + 1. The proposal is data for review, not an existing reservation
or permission to dispatch one. It also requires independently fresh
`all_executions_stopped` proof and independent preservation proof, both bound to
the same old snapshot. This includes all executions associated with that attempt,
not just a last turn or one reachable process. HTTP 404, silence, timeout, age,
historical turn.completed, and unverified assertions cannot establish either
stop or preservation and are rejected.

A recorded generation/ownership change inside the revision chain is rejected by
this first-stage validator. A future adoption contract must match the full old
job/generation/revision/binding/digest and approved proposal as predecessor,
retain all holds, atomically compare current authority and increment generation
before new execution. It must reject old attempts at execution/edit/push boundaries.
That adoption, actual stop verification, fencing and compare-and-swap storage are
**not implemented**. This tool cannot guarantee prevention of concurrent writers
or a change occurring immediately after validation. Existing formal transfer,
legacy recovery, Git Safety, conflict checks (#422), CI/review/merge gates (#423)
and reservation requirements remain mandatory; #605 is not a dependency.

## Public projection and tests

All objects are closed, including nested proofs/tests/PRs. There are no arbitrary
prose or metadata fields. Identifiers are restricted to numeric public aliases,
branch `job/<issue>/<number>`, hashes and fixed enums. This deliberately narrow
first-stage format requires new public aliases when existing worker/branch names
do not fit. A collector must never encode private data into aliases, numeric
references or hashes; syntax cannot prove semantic public safety. Never publish
chat/thread/account mappings, local device/path/process identifiers, credentials,
nonpublic conversation or refusal text. There is no raw-input dump or automatic
Issue publisher. Both successful and failed CLI output are fixed strings and do
not echo values, keys, filenames, parsing errors or tracebacks.

Run `python3 -B -m unittest discover -s tools -p test_job_checkpoint.py -v`.
Synthetic fixtures exercise all three routes and both modes, revision/pause,
holds/cancel/approval/denial, malformed/unknown nested fields/types, SHA lengths,
staleness/future dates, preservation, exact test targets, PR drift, ownership and
revision replay, illegal transitions, proposal mismatch, insufficient stop proof,
and CLI error privacy/read-only behavior. These tests establish local contract
behavior, not live stopping, preservation, reservation or atomic transfer safety.
