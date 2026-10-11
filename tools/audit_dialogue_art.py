#!/usr/bin/env python3
"""Report potentially broken dialogue art references without changing story data.

Unknown references are warnings: a few scenes intentionally use runtime aliases
or art that is resolved outside the static manifest.
"""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "remake/data/manifest.json").read_text(encoding="utf-8"))
portraits = manifest.get("portraits", {})
backgrounds = set(manifest.get("backgrounds", []))
warnings = Counter()
samples = {}
checked = 0

def warn(kind, file, detail):
    warnings[kind] += 1
    samples.setdefault(kind, [])
    if len(samples[kind]) < 8:
        samples[kind].append(f"{file}: {detail}")

def scan(node, file):
    global checked
    if isinstance(node, list):
        for value in node:
            scan(value, file)
    elif isinstance(node, dict):
        speaker, face = node.get("speaker"), node.get("face")
        if isinstance(speaker, str) and speaker in portraits and isinstance(face, str):
            checked += 1
            if face not in portraits[speaker].get("faces", []):
                warn("portrait-face", file, f"{speaker}.{face}")
        metadata = node.get("metadata")
        if isinstance(metadata, dict):
            bg = metadata.get("bg")
            if isinstance(bg, str) and bg.startswith("res://assets/backgrounds/"):
                filename = bg.rsplit("/", 1)[-1]
                if filename not in backgrounds:
                    warn("background", file, filename)
        for value in node.values():
            if isinstance(value, (list, dict)):
                scan(value, file)

for path in sorted((ROOT / "data/dialogue").glob("*.json")):
    try:
        scan(json.loads(path.read_text(encoding="utf-8")), str(path.relative_to(ROOT)))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        print(f"ERROR {path.relative_to(ROOT)}: {exc}", file=sys.stderr)
        sys.exit(1)

print(f"Checked {checked} portrait face references")
for kind, count in sorted(warnings.items()):
    print(f"WARN {kind}: {count} potential unresolved references")
    for example in samples[kind]:
        print(f"  {example}")
print("Reference audit complete (warnings are advisory, not failures)")
