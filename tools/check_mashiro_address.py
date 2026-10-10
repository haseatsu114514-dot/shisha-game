#!/usr/bin/env python3
"""Check Mashiro's canonical address for the protagonist in dialogue JSON."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
bad = []
pattern = re.compile(r"(?:はじめ|始|蒸野)(?:さん|ちゃん|君|くん|様|さま)|はじめ(?!くん)")
FIRST_PERSON = re.compile(r"うち|わたし|私")
def scan(value, path, active=False):
    if isinstance(value, dict):
        active = active or value.get("speaker") == "mashiro"
        for k, v in value.items():
            if k == "text" and isinstance(v, str) and active:
                for m in pattern.finditer(v):
                    if m.group(0) != "はじめくん":
                        bad.append((path, m.group(0), v[:75]))
                for m in FIRST_PERSON.finditer(v):
                    bad.append((path, "一人称 " + m.group(0), v[:75]))
            elif isinstance(v, (dict, list)):
                scan(v, path, active if k not in ("events", "steps", "dialogues") else False)
    elif isinstance(value, list):
        for x in value:
            scan(x, path, active)

for file in sorted((ROOT / "data/dialogue").glob("*.json")):
    try:
        scan(json.loads(file.read_text(encoding="utf-8")), str(file.relative_to(ROOT)))
    except json.JSONDecodeError as e:
        bad.append((str(file), "invalid JSON", str(e)))
for p, word, line in bad:
    print(f"ERROR {p}: Mashiro says {word!r}: {line}", file=sys.stderr)
if bad:
    sys.exit(1)
print("OK: Mashiro's protagonist address in dialogue JSON")
