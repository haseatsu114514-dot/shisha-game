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

if errors:
    print("\n".join("ERROR " + e for e in errors), file=sys.stderr)
    sys.exit(1)
print(f"OK: {len(FILES)} instruction files, local links, shared rules and safety checks")
