#!/usr/bin/env python3
"""Remove source PNGs from a Pages artifact when the game serves their WebP copies.

Only files listed in remake/data/manifest.json:webp are eligible.  The game uses
that exact list in remake/js/core/data.js and portrait-resolver.js to resolve
the runtime URL.  Source files in the repository are left untouched.
"""

import json
import sys
from pathlib import Path


# camel-race.js uses this source PNG through a direct URL, outside the manifest
# based image resolver. Keep it until that consumer changes separately.
DIRECT_SOURCE_URLS = {"ui/face_icons/face_faris.png"}


def prune(site: Path) -> tuple[int, int]:
    manifest = json.loads((site / "remake/data/manifest.json").read_text(encoding="utf-8"))
    count = size = 0
    for rel in manifest["webp"]:
        if rel in DIRECT_SOURCE_URLS:
            continue
        path = Path(rel)
        if path.is_absolute() or ".." in path.parts or path.suffix != ".png":
            raise ValueError(f"unsafe manifest image path: {rel}")
        source = site / "assets" / path
        served = site / "remake/img" / path.with_suffix(".webp")
        if not source.is_file():
            continue
        if not served.is_file():
            raise FileNotFoundError(f"WebP copy missing for {source}: {served}")
        size += source.stat().st_size
        source.unlink()
        count += 1
    return count, size


if __name__ == "__main__":
    removed, bytes_removed = prune(Path(sys.argv[1]))
    print(f"Removed {removed} source PNGs ({bytes_removed} bytes); runtime WebP copies remain")
