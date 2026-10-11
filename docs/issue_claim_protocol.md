# Issue claim protocol (Codex / Claude Code / cloud sessions)

This repository uses a GitHub Actions coordinator: `.github/workflows/issue-claim.yml`.
A separate Codex chat is a separate worker, even on the same account.

## Before working on an issue

1. Inspect the issue, open PRs, and active branches for existing work. Do not take over an issue with an existing in-progress PR or conflicting implementation.
2. Generate a unique session owner ID (e.g. `codex-20261011-chat-a`). Never reuse another chat's owner ID.
3. On GitHub Actions, run **Issue claim coordinator** with operation `claim`, issue number, and owner ID. Or use `gh workflow run issue-claim.yml -f issue=325 -f operation=claim -f owner=codex-20261011-chat-a`.
4. **Wait for that exact workflow run to finish successfully.** Dispatch acceptance is NOT a reservation. If the run fails, do not edit that issue; choose another.
5. Once claimed, create a dedicated branch from current `origin/main`; record branch/PR and handoff details on the issue. Use one PR per issue.

## Completion / interruptions

- After merging, release the claim with the **same** owner ID and operation `release`.
- If paused or out of quota, commit and push work, leave a draft PR and issue handoff comment, and **keep the claim** so another chat does not duplicate work.
- To resume in a new chat, explicitly hand off the original owner ID and branch, and ensure the old chat has stopped. Do not independently claim it under a different ID.
- Never auto-expire or steal a claim. A human can inspect stale claims and explicitly coordinate release/reassignment.
- Claims prevent duplicate issue selection **only for agents following this protocol**. They do not prevent simultaneous edits to overlapping files in different issues, nor guarantee safe merges. Always rebase/check latest main, run tests and required CI before merging.
- If the workflow is not present on the default branch yet, it cannot be dispatched. Do not assume reservation is active until it is merged and verified.
