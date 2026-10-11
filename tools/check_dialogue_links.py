#!/usr/bin/env python3
"""Check local dialogue choice destinations and duplicate IDs.

This intentionally does not infer cross-scene script transitions beyond next_id.
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
files = sorted((ROOT / "data/dialogue").glob("*.json"))
scenes = {}
duplicates = []
for path in files:
    data = json.loads(path.read_text(encoding="utf-8"))
    for scene in data.get("dialogues", []):
        sid = scene.get("dialogue_id")
        if not isinstance(sid, str):
            continue
        if sid in scenes:
            duplicates.append(f"{sid} in {path.name} and {scenes[sid]['file']}")
        scenes[sid] = {"scene": scene, "file": path.name}

errors = []
for sid, record in scenes.items():
    scene = record["scene"]
    branches = scene.get("branches") or {}
    def visit(node):
        if isinstance(node, list):
            for item in node:
                visit(item)
        elif isinstance(node, dict):
            if node.get("type") == "choice":
                for choice in node.get("choices", []):
                    if not isinstance(choice, dict):
                        continue
                    target = choice.get("next")
                    if isinstance(target, str) and target not in branches:
                        errors.append(f"{record['file']}:{sid}: missing local branch {target}")
                    target_id = choice.get("next_id")
                    if isinstance(target_id, str) and target_id not in scenes:
                        errors.append(f"{record['file']}:{sid}: missing dialogue {target_id}")
            for value in node.values():
                if isinstance(value, (dict, list)):
                    visit(value)
    visit(scene.get("lines", []))
    for branch in branches.values():
        visit(branch)

for item in duplicates:
    print("WARN duplicate dialogue ID:", item)
for item in errors:
    print("ERROR", item, file=sys.stderr)
if errors:
    sys.exit(1)
print(f"OK: checked choice destinations in {len(scenes)} dialogue scenes; {len(duplicates)} duplicate IDs (warnings)")
