#!/usr/bin/env python3
"""Check that all confession accept branches set their romance character."""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / "data/dialogue/confession.json"
data = json.loads(path.read_text(encoding="utf-8"))
events = {item["dialogue_id"]: item for item in data["dialogues"]}
errors = []
for event_id, event in events.items():
    if not event_id.startswith("confession_") or not event_id.endswith("_accept"):
        continue
    character = event_id[len("confession_"):-len("_accept")]
    actual = event.get("metadata", {}).get("set_romance")
    if actual != character:
        errors.append(f"{event_id}: expected set_romance={character}, got {actual!r}")
    intro_id = f"confession_{character}"
    intro = events.get(intro_id)
    if intro is None:
        errors.append(f"{event_id}: missing {intro_id}")
        continue
    choices = [
        choice
        for line in intro.get("lines", [])
        for choice in line.get("choices", [])
        if isinstance(choice, dict)
    ]
    if not any(choice.get("next_id") == event_id for choice in choices):
        errors.append(f"{intro_id}: no choice leads to {event_id}")
    reject_id = f"confession_{character}_reject"
    if reject_id not in events:
        errors.append(f"{intro_id}: missing {reject_id}")
    elif not any(choice.get("next_id") == reject_id for choice in choices):
        errors.append(f"{intro_id}: no choice leads to {reject_id}")
for error in errors:
    print("ERROR:", error, file=sys.stderr)
if errors:
    sys.exit(1)
print("OK: confession branches and romance flags")
