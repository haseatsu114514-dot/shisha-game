#!/usr/bin/env python3
"""Offline, read-only PNG gate for #586's six numbered proposals.

Success means technical checks passed, never adoption or physical correctness.
"""
import argparse
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import warnings

from PIL import Image, UnidentifiedImageError

SLOTS = tuple(f"{kind}-{n}" for kind in ("flat", "cube") for n in (1, 2, 3))
NAME = re.compile(r"^(flat|cube)[_-]?([123①②③])$", re.IGNORECASE)
NUMBER = dict(zip("123①②③", "123123"))
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MAX_BYTES = 32 * 1024 * 1024
MAX_PIXELS = 16_777_216


def digest(data):
    return hashlib.sha256(data).hexdigest()


def inspect_image(path):
    """Measure decoded bytes, without modifying the source or inventing dimensions."""
    path = Path(path)
    if path.stat().st_size > MAX_BYTES:
        raise ValueError("file exceeds 32 MiB inspection limit")
    data = path.read_bytes()
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(data)) as check:
            if check.width * check.height > MAX_PIXELS:
                raise ValueError("image exceeds inspection pixel limit")
            check.verify()
        with Image.open(io.BytesIO(data)) as im:
            im.load()  # Full decode, separate from verify().
            rgba = im.convert("RGBA")
            alpha = rgba.getchannel("A")
            hist = alpha.histogram()
            bbox = alpha.getbbox()  # Any alpha > 0, including fringe noise.
            width, height = im.size
            # Ignore hidden RGB under zero alpha when detecting reused pixels.
            mask = alpha.point(lambda value: 255 if value else 0)
            canonical = Image.composite(rgba, Image.new("RGBA", im.size), mask)
            return {
                "sha256": digest(data), "bytes": len(data),
                "signature_png": data.startswith(PNG_SIGNATURE),
                "format": im.format, "mode": im.mode,
                "width": width, "height": height,
                "frames": getattr(im, "n_frames", 1),
                "has_alpha": "A" in im.getbands() or "transparency" in im.info,
                "alpha_extrema": list(alpha.getextrema()),
                "transparent_pixels": hist[0],
                "visible_pixels": width * height - hist[0],
                "visible_fraction": (width * height - hist[0]) / (width * height),
                "alpha_bbox": list(bbox) if bbox else None,
                "margins_px": [bbox[0], bbox[1], width-bbox[2], height-bbox[3]] if bbox else None,
                "pixel_sha256": digest(f"{width}x{height}:RGBA:".encode() + canonical.tobytes()),
            }


def validate(root, size=1024, margin=0.10, synthetic=False):
    root = Path(root)
    result = {
        "schema": "charcoal-candidate-qa/v1",
        "input_kind": "SYNTHETIC_TEST_FIXTURES" if synthetic else "unadopted_candidates",
        "adoption": "not_evaluated", "physical_dimensions": "not_inferred",
        "expected_slots": list(SLOTS),
        "policy": {"size_px": [size, size], "min_margin_fraction": margin,
                   "min_visible_fraction": 0.01, "min_peak_alpha": 128},
        "files": [], "errors": [],
    }
    def error(code, **fields):
        result["errors"].append({"code": code, **fields})
    def scan_error(exc):
        relative = None
        if exc.filename is not None:
            try:
                relative = Path(os.path.abspath(exc.filename)).relative_to(os.path.abspath(root)).as_posix()
            except (TypeError, ValueError):
                pass
        error("directory_scan_failed", path=relative, exception=type(exc).__name__)
    found = {slot: [] for slot in SLOTS}
    hashes = {}
    pixels = {}
    if not root.is_dir() or root.is_symlink():
        error("input_directory_missing_or_symlink")
    else:
        # Never follow links into other caches or traverse a symlink directory.
        for parent, dirs, files in os.walk(root, followlinks=False, onerror=scan_error):
            for name in sorted(dirs):
                if (Path(parent)/name).is_symlink():
                    error("symlink", path=(Path(parent)/name).relative_to(root).as_posix())
            dirs[:] = sorted(d for d in dirs if not (Path(parent)/d).is_symlink())
            for name in sorted(files):
                path = Path(parent)/name
                rel = path.relative_to(root).as_posix()
                if path.is_symlink():
                    error("symlink", path=rel)
                    continue
                if not path.is_file():
                    error("non_regular_file", path=rel)
                    continue
                match = NAME.fullmatch(path.stem)
                slot = f"{match[1].lower()}-{NUMBER[match[2]]}" if match else None
                if slot:
                    found[slot].append(rel)
                else:
                    error("unexpected_name", path=rel)
                record = {"path": rel, "slot": slot}
                result["files"].append(record)
                if path.suffix.lower() != ".png":
                    error("non_png_extension", path=rel)
                try:
                    m = inspect_image(path)
                    record["measurements"] = m
                except (OSError, ValueError, SyntaxError, UnidentifiedImageError,
                        Image.DecompressionBombWarning, Image.DecompressionBombError) as exc:
                    error("decode_failed", path=rel, detail=str(exc))
                    continue
                if m["format"] != "PNG" or not m["signature_png"]:
                    error("non_png_content", path=rel)
                if m["frames"] != 1:
                    error("animated_image", path=rel)
                if [m["width"], m["height"]] != [size, size]:
                    error("wrong_size", path=rel)
                if not m["has_alpha"]:
                    error("missing_alpha", path=rel)
                if not m["transparent_pixels"]:
                    error("no_transparent_background", path=rel)
                if not m["visible_pixels"]:
                    error("empty_alpha", path=rel)
                elif m["visible_fraction"] < 0.01:
                    error("nearly_empty", path=rel)
                if m["alpha_extrema"][1] < 128:
                    error("nearly_invisible", path=rel)
                if m["margins_px"]:
                    if min(m["margins_px"]) == 0:
                        error("edge_contact_possible_clip", path=rel)
                    required = [math.ceil(m["width"] * margin), math.ceil(m["height"] * margin)] * 2
                    if any(actual < need for actual, need in zip(m["margins_px"], required)):
                        error("insufficient_margin", path=rel)
                for field, seen, code in (("sha256", hashes, "duplicate_bytes"),
                                           ("pixel_sha256", pixels, "duplicate_pixels")):
                    key = m[field]
                    if key in seen:
                        error(code, path=rel, other_path=seen[key])
                    else:
                        seen[key] = rel
    for slot, paths in found.items():
        if not paths:
            error("missing_slot", slot=slot)
        elif len(paths) > 1:
            error("duplicate_slot", slot=slot, paths=paths)
    result["present_slots"] = [slot for slot in SLOTS if found[slot]]
    result["missing_slots"] = [slot for slot in SLOTS if not found[slot]]
    result["ok"] = not result["errors"]
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--size", type=int, default=1024, help="pixel size; default brief: 1024")
    parser.add_argument("--margin", type=float, default=0.10)
    parser.add_argument("--synthetic-fixtures", action="store_true", help="label test inputs explicitly")
    parser.add_argument("--output", type=Path, help="new JSON report outside input directory; never overwrites")
    args = parser.parse_args(argv)
    if args.size <= 0 or args.size * args.size > MAX_PIXELS:
        parser.error("size must be positive and within inspection pixel limit")
    if not 0 <= args.margin < 0.5:
        parser.error("margin must be in [0, 0.5)")
    if args.output and args.output.resolve().is_relative_to(args.directory.resolve()):
        parser.error("report must be outside the input directory")
    report = validate(args.directory, args.size, args.margin, args.synthetic_fixtures)
    encoded = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        try:
            with args.output.open("x", encoding="utf-8") as stream:
                stream.write(encoded)
        except OSError as exc:
            parser.error(str(exc))
    print(encoded, end="")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
