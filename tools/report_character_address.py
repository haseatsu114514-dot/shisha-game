#!/usr/bin/env python3
"""Produce a review-only report of protagonist address terms by speaker."""
import collections
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
terms = re.compile(r"(?:はじめ|ハジメ|蒸野|始)(?:くん|君|さん|ちゃん|様|さま|っち)?")
found = collections.defaultdict(lambda: collections.Counter())

def walk(node, origin):
    if isinstance(node, list):
        for item in node:
            walk(item, origin)
    elif isinstance(node, dict):
        who = node.get("speaker")
        if who is None:
            who = node.get("sender")
        text = node.get("text")
        if isinstance(who, str) and who and isinstance(text, str):
            found[who].update(terms.findall(text))
        for value in node.values():
            if isinstance(value, (dict, list)):
                walk(value, origin)

for path in sorted((root / "data/dialogue").glob("*.json")):
    walk(json.loads(path.read_text(encoding="utf-8")), str(path))
path = root / "data/lime_messages.json"
walk(json.loads(path.read_text(encoding="utf-8")), str(path))
for who, counter in sorted(found.items()):
    print(f"{who}: " + ", ".join(f"{term}={count}" for term, count in counter.most_common()))
print("NOTE: candidate report only; do not auto-replace intentional character nicknames.")
