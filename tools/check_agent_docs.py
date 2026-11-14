#!/usr/bin/env python3
"""Validate the AI instruction entrypoints and their local Markdown links."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "AGENTS.md",
    "CLAUDE.md",
    "docs/current_documentation_guide.md",
    "docs/gameplay_agent_reference.md",
    "docs/asset_ai_guidance.md",
    "docs/tools/agent_rules_reference.md",
    "docs/tools/checks_index.md",
]
LINK = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
FENCE = re.compile(r"^\s*(?:```|~~~)")
errors: list[str] = []

def check_file(name: str) -> None:
    path = ROOT / name
    if not path.is_file():
        errors.append(f"{name}: missing file")
        return
    fenced = False
    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if FENCE.match(line):
            fenced = not fenced
            continue
        if fenced:
            continue
        for match in LINK.finditer(line):
            link = match.group(1).strip().split("#", 1)[0]
            if not link or re.match(r"^[a-z][a-z0-9+.-]*:", link, re.I):
                continue
            if link.startswith("/"):
                errors.append(f"{name}:{lineno}: absolute link {link}")
                continue
            target = path.parent / link
            if not target.exists():
                errors.append(f"{name}:{lineno}: broken link {link}")

for name in FILES:
    check_file(name)

agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
claude = (ROOT / "CLAUDE.md").read_text(encoding="utf-8")
if "@AGENTS.md" not in claude:
    errors.append("CLAUDE.md: missing @AGENTS.md import")
if "## Git Safety" not in agents or "check_git_safety.sh" not in agents:
    errors.append("AGENTS.md: missing Git safety instructions")
if "## Git Safety" in claude:
    errors.append("CLAUDE.md: duplicated Git Safety section")
if "project.godot" not in agents or "remake/" not in agents:
    errors.append("AGENTS.md: missing current/legacy distinction")
if len(claude.splitlines()) > 80:
    errors.append("CLAUDE.md: entrypoint is too large (>80 lines)")

# Issue reservation was abolished on 2026-10-23: its procedure must not
# survive in skill instructions or guidance docs (the abolition notices in
# AGENTS.md / CLAUDE.md and the owner-request ledger are history, not
# procedure, and are not scanned here).
RESERVATION_TOKEN = "/issue-claim"
skills_dir = ROOT / ".claude" / "skills"
if skills_dir.is_dir():
    for skill_file in sorted(skills_dir.rglob("*.md")):
        if RESERVATION_TOKEN in skill_file.read_text(encoding="utf-8"):
            errors.append(
                f"{skill_file.relative_to(ROOT)}: abolished reservation procedure remains"
            )
for name in FILES:
    if name in ("AGENTS.md", "CLAUDE.md"):
        continue
    path = ROOT / name
    if path.is_file() and RESERVATION_TOKEN in path.read_text(encoding="utf-8"):
        errors.append(f"{name}: abolished reservation procedure remains")

# Workflows are fixed to the three files named in AGENTS.md; adding one is
# an owner-requested change, not an implementation detail.
workflows_dir = ROOT / ".github" / "workflows"
if workflows_dir.is_dir():
    actual = sorted(p.name for p in workflows_dir.glob("*.yml"))
    expected = ["ci.yml", "deploy-pages.yml", "sequential-merge.yml"]
    if actual != expected:
        errors.append(
            f".github/workflows: expected {expected}, found {actual}"
        )

if errors:
    print("\n".join("ERROR " + e for e in errors), file=sys.stderr)
    sys.exit(1)
print(f"OK: {len(FILES)} instruction files, local links, shared rules and safety checks")
