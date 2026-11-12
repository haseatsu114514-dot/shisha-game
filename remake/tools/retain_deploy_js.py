#!/usr/bin/env python3
"""Keep bounded previous JS builds for tabs opened before a Pages deployment (#3463).

Only versioned JS trees are cached, not HTML, game data, art or saves. Cache loss
is safe: the current site still publishes normally. Retention is best effort,
24 hours / 20 builds / 128 MiB (whichever limit is reached first), not a promise
of indefinite compatibility with changing unversioned game data and assets.
"""
import argparse
import json
import re
import shutil
import time
from pathlib import Path

MAX_AGE = 24 * 60 * 60
MAX_BUILDS = 20
MAX_BYTES = 128 * 1024 * 1024
BUILD = re.compile(r"js-[0-9A-Za-z_-]+\Z")


def tree_bytes(folder):
    """Do not publish symlinks restored from a cache."""
    if folder.is_symlink() or not folder.is_dir():
        return None
    files = list(folder.rglob("*"))
    if any(p.is_symlink() for p in files):
        return None
    return sum(p.stat().st_size for p in files if p.is_file())


def retain(site, history, build, now=None):
    now = time.time() if now is None else now
    name = f"js-{build}"
    if not BUILD.fullmatch(name):
        raise ValueError("invalid build name")
    remake = site / "remake"
    current = remake / name
    size = tree_bytes(current)
    if size is None:
        raise ValueError("current stamped JS tree is missing or contains symlinks")
    history.mkdir(parents=True, exist_ok=True)
    index = history / "index.json"
    try:
        previous = json.loads(index.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        previous = {}
    if not isinstance(previous, dict):
        previous = {}

    # The current build always stays in the site, even if too big to cache.
    # Clear stale cache contents first; a missing/invalid index never revives them.
    candidates = []
    for old, stamp in previous.items():
        if old == name or not BUILD.fullmatch(old):
            continue
        if type(stamp) not in (int, float) or not now - MAX_AGE <= stamp <= now:
            continue
        old_size = tree_bytes(history / old)
        if old_size is not None:
            candidates.append((stamp, old, old_size))
    kept = {name: now} if size <= MAX_BYTES else {}
    used = size if kept else 0
    for stamp, old, old_size in sorted(candidates, reverse=True):
        if len(kept) < MAX_BUILDS and used + old_size <= MAX_BYTES:
            kept[old] = stamp
            used += old_size

    for child in history.iterdir():
        if child.name in kept and child.name != name:
            continue
        if child.is_dir() and not child.is_symlink():
            shutil.rmtree(child)
        else:
            child.unlink()
    if name in kept:
        shutil.copytree(current, history / name)
    for old in kept:
        if old != name:
            shutil.copytree(history / old, remake / old)
    index.write_text(json.dumps(kept, sort_keys=True) + "\n", encoding="utf-8")
    return {"builds": len(kept), "bytes": used, "currentCached": name in kept}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("site", type=Path)
    ap.add_argument("history", type=Path)
    ap.add_argument("--build", required=True)
    args = ap.parse_args()
    print("retain_deploy_js:", retain(args.site, args.history, args.build))


if __name__ == "__main__":
    main()
