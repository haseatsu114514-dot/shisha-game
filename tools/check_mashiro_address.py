#!/usr/bin/env python3
"""Check Mashiro's canonical address for the protagonist in dialogue JSON."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
bad = []
pattern = re.compile(r"(?:はじめ|始|蒸野)(?:さん|ちゃん|君|くん|様|さま)")
FIRST_PERSON = re.compile(r"うち|わたし|私")
def scan(value, path, active=False):
    if isinstance(value, dict):
        active = value.get("speaker") == "mashiro" if "speaker" in value else active
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

# LIME stores the speaker in sender fields.
lime_path = ROOT / "data/lime_messages.json"
if lime_path.exists():
    def scan_lime(node):
        if isinstance(node, list):
            for child in node:
                scan_lime(child)
        elif isinstance(node, dict):
            if node.get("sender") == "mashiro":
                value = node.get("text", node.get("response", ""))
                if isinstance(value, str):
                    for m in pattern.finditer(value):
                        if m.group() != "はじめくん":
                            bad.append((str(lime_path), m.group(), value[:75]))
                    for m in FIRST_PERSON.finditer(value):
                        bad.append((str(lime_path), m.group(), value[:75]))
            for child in node.values():
                if isinstance(child, (dict, list)):
                    scan_lime(child)
    scan_lime(json.loads(lime_path.read_text(encoding="utf-8")))

# Lover messages are keyed by character ID rather than speaker.
lover_path = ROOT / "remake/data/lover.json"
if lover_path.exists():
    def scan_lover(node, selected=False):
        if isinstance(node, dict):
            for key, child in node.items():
                scan_lover(child, selected or key == "mashiro")
        elif isinstance(node, list):
            for child in node:
                scan_lover(child, selected)
        elif selected and isinstance(node, str):
            for m in pattern.finditer(node):
                if m.group() != "はじめくん":
                    bad.append((str(lover_path), m.group(), node[:75]))
            for m in FIRST_PERSON.finditer(node):
                bad.append((str(lover_path), m.group(), node[:75]))
    scan_lover(json.loads(lover_path.read_text(encoding="utf-8")))

for p, word, line in bad:
    print(f"ERROR {p}: Mashiro says {word!r}: {line}", file=sys.stderr)
if bad:
    sys.exit(1)
print("OK: Mashiro's protagonist address in dialogue JSON")
