#!/usr/bin/env python3
"""Fast, read-only JSON syntax validation for active game data."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = sorted((ROOT / "data").rglob("*.json")) + sorted((ROOT / "remake/data").rglob("*.json"))
errors = []
for path in FILES:
    try:
        with path.open(encoding="utf-8") as stream:
            json.load(stream)
    except (UnicodeError, json.JSONDecodeError, OSError) as exc:
        errors.append(f"{path.relative_to(ROOT)}: {exc}")
for error in errors:
    print(f"ERROR {error}", file=sys.stderr)
if errors:
    sys.exit(1)
print(f"OK: parsed {len(FILES)} active game JSON files")
