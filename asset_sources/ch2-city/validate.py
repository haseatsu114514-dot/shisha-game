#!/usr/bin/env python3
"""Verify map files and day/night alignment without modifying image pixels."""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

FOLDER = Path(__file__).resolve().parent
ROOT = FOLDER.parents[1]
FILES = {
    "day_source": FOLDER / "day/source.png",
    "night_source": FOLDER / "night/source.png",
    "day_runtime": ROOT / "assets/backgrounds/bg_widehanga_map_day.webp",
    "night_runtime": ROOT / "assets/backgrounds/bg_widehanga_map_night.webp",
    "station_source": FOLDER / "station/source.png",
    "station_runtime": ROOT / "assets/backgrounds/bg_widehanga_station_day.webp",
}
BOXES = {
    "station": [150, 240, 570, 470],
    "glass_towers": [350, 20, 780, 250],
    "scramble": [720, 360, 985, 555],
    "venue": [1280, 90, 1660, 310],
    "fashion_street": [1260, 305, 1440, 470],
    "tobacco_shop": [940, 490, 1180, 660],
    "music_street": [620, 575, 765, 770],
    "industrial_shop": [140, 560, 380, 765],
}


def edges(path):
    with Image.open(path) as image:
        array = np.asarray(image.convert("L"), dtype=np.float64)
    horizontal = gaussian_filter(array, sigma=0.7, order=(0, 1))
    vertical = gaussian_filter(array, sigma=0.7, order=(1, 0))
    return np.hypot(horizontal, vertical)


def main():
    result = {"files": {}, "alignment": {}, "method": "edge-magnitude correlation at 8 source-image landmarks; search ±8 px"}
    for name, path in FILES.items():
        with Image.open(path) as image:
            expected = (1672, 941) if name.endswith("source") else (1280, 720)
            assert image.size == expected, (name, image.size)
            assert image.mode == "RGB", (name, image.mode)
            assert image.format == ("PNG" if name.endswith("source") else "WEBP")
            result["files"][name] = {"path": str(path.relative_to(ROOT)), "dimensions": list(image.size), "format": image.format, "mode": image.mode, "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    day, night = edges(FILES["day_source"]), edges(FILES["night_source"])
    for name, (left, top, right, bottom) in BOXES.items():
        patch = day[top:bottom, left:right]
        patch = patch - patch.mean()
        energy = np.sum(patch * patch)
        best = (-1, 0, 0)
        for dy in range(-8, 9):
            for dx in range(-8, 9):
                candidate = night[top + dy:bottom + dy, left + dx:right + dx]
                candidate = candidate - candidate.mean()
                score = float(np.sum(patch * candidate) / np.sqrt(energy * np.sum(candidate * candidate)))
                if score > best[0]:
                    best = (score, dx, dy)
        score, dx, dy = best
        assert (dx, dy) == (0, 0), (name, best)
        result["alignment"][name] = {"source_box": [left, top, right, bottom], "best_offset": [dx, dy], "edge_correlation": round(score, 6)}
    result["status"] = "passed"
    result["limits"] = "Local edge alignment supplements visual checks and does not prove identical geometry at every pixel or verify UI overlays."
    (FOLDER / "validation.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print("PASS: 6 image formats/sizes and 8 day/night landmarks; all offsets 0,0")


if __name__ == "__main__":
    main()
