> **注意（2026-10-30）**: 本ツールは任意の試作で、必須手順ではない（`AGENTS.md`）。本文の claim／worker／予約・引き継ぎに関する記述は、2026-10-23に撤廃したIssue予約の時代の設計で、現在の運用には使わない。

# Opt-in local checkpoint file CAS (#594)

`tools/local_job_checkpoint_store.py` is a standalone POSIX library using the
existing checkpoint schema and `validate_job_checkpoint.validate`. It has no CLI,
network, default save location, automatic activation, coordinator import or
transfer operation. Importing it creates no files. Production remains unchanged.
It does not replace the offline contract or establish trusted observations.

## Explicit API

Use an existing, trusted local directory and one explicit file path:

```python
import datetime as dt
from local_job_checkpoint_store import compare_and_swap, current_token, read_current

path = '/explicit/local/directory/checkpoint.json'
current = read_current(path)
expected = None if current is None else current_token(current['checkpoint'])
# envelope is independently collected input in the existing schema.
# For an update its complete previous checkpoint must equal current['checkpoint'].
result = compare_and_swap(path, envelope, expected=expected,
                          now=dt.datetime.now(dt.timezone.utc))
```

`expected=None` accepts only revision 1 into an absent file. Absence is **not**
proof of never-started work and gives no execution/ownership permission. An
existing checkpoint requires an exact token containing job, full binding
(attempt, public worker, claim_run, generation), revision, predecessor and the
existing canonical checkpoint SHA-256 digest. Omitted/extra/changed token fields
refuse. Obtain the expected token from the actual current file; do not substitute
an old proposal merely because the offline validator accepts it.

Only `same_attempt` is accepted. Updates must contain the exact stored previous
checkpoint, same job and binding, revision + 1 and matching predecessor digest.
The existing validator still checks schema, scope, holds, saved state, test SHAs,
freshness and allowed state transitions. No schema or generation meaning changes.
Neither this API nor its expected token authenticates an owner or a collector.
Caller-provided `now` has the same testing/clock contract as the existing validator.

`read_current` uses the same lock and checks stored shape/checkpoint rules. It
returns the envelope or None, without claiming freshness or authority. Corrupt,
unsupported, oversized or unsafe files raise; they are never treated as absent.
The serialized envelope is limited to 1 MiB. Files created by this library use
mode 0600, including the persistent lock; existing file permissions are not a
policy/authentication mechanism.

## Actual exclusion and publication boundary

Every cooperating reader/writer locks `<path>.lock` using `fcntl.flock(LOCK_EX)`.
The parent is resolved so relative paths and parent-directory symlink aliases
converge. Final target/lock symlinks and multiply linked files are refused;
`.lock` destinations are reserved. The lock is a regular persistent file and
**must never be unlinked or replaced**, including during cleanup or while waiting.

Inside that single exclusion boundary the library validates the candidate,
reads the actual current file, compares the complete token and successor, writes
a same-directory temporary file, flushes/fsyncs it, replaces the target and fsyncs
the parent directory. The lock is released only afterwards. `os.replace` supplies
atomic file publication; the lock plus the comparisons supply CAS. Two processes
with the same expected current token cannot both publish successfully. A rejected
stale update does not change the checkpoint. The lock sidecar may be created even
when a read finds no checkpoint or a write is rejected.

This is advisory exclusion for cooperating processes on a local POSIX filesystem
with working flock, atomic rename and fsync semantics. Use the same canonical
path and do not fork while a library call holds its descriptor. Network/distributed
filesystems and hostile directory manipulation are outside this contract. A
process with direct directory/file access can bypass locks, replace/delete the
checkpoint or lock, or recreate a first revision after deleting storage. Keep the
directory trusted and persistent. No credential revocation, direct-write fencing,
anti-tampering, durable authority service or multi-host CAS is implemented.

## Failure and reconciliation

- `Conflict` rejects an expected-current/successor mismatch. Validator failures
  retain the existing validator exception. Both happen before publication.
- File write/flush/fsync errors before replacement leave the current file intact.
- `PublicationUncertain` means replacement was attempted but its outcome was not
  confirmed. Do not assume either the old or new file is current.
- `PublishedDurabilityUncertain` means replacement returned successfully, but
  parent-directory fsync/durability was not confirmed. The new file was visible
  at replacement; survival across a crash is unknown.

For either uncertain outcome, do **not** blindly retry. Read with `read_current`
and compare the checkpoint's complete token against the proposed result and
original expected token. If the proposal is visible, report visible publication
with unconfirmed durability; do not claim durable success. If the old value or a
third value is visible, preserve that result and reacquire current evidence before
any separately authorized next write. Read failure remains unknown. This library
performs no automatic reconciliation, rollback or retry. Exception details can
contain local paths: keep them private rather than publishing raw tracebacks.

## Tests and limits

```sh
python3 -B -m unittest discover -s tools -p 'test*job_checkpoint*.py' -v
```

The existing fixture/schema/validator suite is reused unchanged. New tests use
actual temporary local files and two spawned OS processes contending on one
expected token. They also cover valid old-snapshot rollback rejection, every token
field, each binding field, missing/corrupt files, symlinks, prepublication failure,
replace outcome loss, and post-replace directory-fsync uncertainty with readback.
Fault injection covers error classification, not physical power-loss durability.
Synthetic proofs and fixture PASS do not establish live preservation or stopping.

This unit does not connect #614's runtime proof adapter or a production controller;
it does not resolve public aliases to claims, adopt another generation, transfer
ownership, stop old writers, activate a production store or finish #594. Existing
formal claim, independent review and merge gates remain mandatory.
