# Codex / Claude Code quota handoff (macOS)

The repository uses `AGENTS.md` for both agents; `CLAUDE.md` imports it. This is a **best-effort local helper**, not a quota API or a background monitor.

## Check usage

- In Codex CLI, use `/status` if supported by your installed version; for other Codex clients use their displayed usage information.
- In Claude Code, use `/usage` if supported.
- Do not use private endpoints, copy session credentials, or assume a ChatGPT subscription exposes a machine-readable quota API.
- Convert the official **used** percentage to **remaining** by subtracting it from 100.

On the Mac, from the repository root:

```bash
python3 tools/agent_quota_guard.py set codex --five-hour 18 --weekly 70
python3 tools/agent_quota_guard.py set claude --five-hour 9 --weekly 60
python3 tools/agent_quota_guard.py check all
```

These numbers are examples, not live readings. Optionally supply `--resets-at "2026-10-12 02:00 JST"`. Values are stored only on your Mac at `~/.config/shisha-agent-quota/usage.json` (permission 600), not in Git.

Alternatively, a trusted local process can provide a JSON file using `SHISHA_CODEX_USAGE_JSON` or `SHISHA_CLAUDE_USAGE_JSON`. Format:

```json
{"five_hour_remaining":18,"weekly_remaining":70,"updated_at":"2026-10-11T13:00:00+00:00","resets_at":"2026-10-12 02:00 JST"}
```

Only observations newer than 15 minutes are actionable; stale/missing readings are **unknown**. Lowest known remaining percentage determines the action:

- Above 20%: normal work.
- 11–20%: finish current work; avoid starting large tasks.
- 10% or less: handoff immediately. Test completed work, safely merge only eligible PRs, and file/update Issues for incomplete work.
- Unknown: checkpoint at task boundaries.

**Important:** This script only reports an action. It cannot directly instruct an already-running Codex/Claude session, create Issues, merge PRs, or access actual quotas automatically. The agent must run `python3 tools/agent_quota_guard.py check <provider>` at startup, between tasks, and before ending, and then follow `AGENTS.md`. Quota exhaustion can happen before cleanup; frequent commits and pushes remain essential.

## Switching to another AI

At a task boundary, commit/push the work and create a Draft PR for unfinished
changes. Write the saved PR/branch and DONE / TODO / TEST / NEXT in the PR or
Issue, then stop editing. The next AI continues the saved branch. Issue
reservations (claim / release / handoff) were removed on 2026-10-23, so no
reservation transfer is needed. This does not launch the next AI or detect
quotas automatically.

For automatic live quota collection or event-triggered stopping, an official supported machine-readable usage source and an agent runtime integration must first be verified on the actual Mac. Do not present this helper as fully automatic monitoring.
