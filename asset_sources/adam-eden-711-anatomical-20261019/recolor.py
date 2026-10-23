#!/usr/bin/env python3
"""Reproduce Issue #711's explicitly authorized local color-only edit.

Only polygon + hue gated pixels change. No image reflection, resize, redraw,
alpha operation, or global palette operation is used. Inputs are immutable
adopted originals; outputs and binary masks go to separate paths.
"""
from __future__ import annotations

import argparse
import colorsys
import hashlib
import io
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def digest(path):
    b = path.read_bytes()
    return {"bytes": len(b), "sha256": hashlib.sha256(b).hexdigest(),
            "git_blob_sha": hashlib.sha1(b"blob " + str(len(b)).encode() + b"\0" + b).hexdigest()}


def polygon_mask(size, polygon):
    mask = Image.new("L", size)
    ImageDraw.Draw(mask).polygon([tuple(p) for p in polygon], fill=255)
    return np.asarray(mask) != 0


def save_png_atomic(image, path):
    """Encode fully before replacing a candidate file, then verify on disk."""
    b = io.BytesIO()
    image.save(b, format="PNG", optimize=True)
    data = b.getvalue()
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    temporary.replace(path)
    assert path.read_bytes() == data, "PNG write incomplete"


def recolor(source, output, operations, mask_path):
    im = Image.open(source)
    original = np.array(im.convert("RGBA"))
    result = original.copy()
    union = np.zeros(original.shape[:2], dtype=bool)
    details = []
    for op in operations:
        envelope = polygon_mask(im.size, op["polygon"])
        for exclusion in op.get("exclude", []):
            envelope &= ~polygon_mask(im.size, exclusion)
        # Operations are ordered deliberately: the green front section owns
        # any shared center-part highlight before the right-side red section.
        ys, xs = np.where(envelope & (original[..., 3] > 0) & ~union)
        rgb = original[ys, xs, :3].astype(float) / 255
        hls = np.asarray([colorsys.rgb_to_hls(*p) for p in rgb])
        hsv = np.asarray([colorsys.rgb_to_hsv(*p) for p in rgb])
        h = hls[:, 0] * 360
        gate = np.zeros(len(h), dtype=bool)
        for lo, hi in op["hue_ranges"]:
            gate |= (h >= lo) & (h <= hi)
        gate &= (hsv[:, 1] >= op.get("min_saturation", 0.12))
        gate &= (hsv[:, 2] >= op.get("min_value", 0.06))
        ys, xs, hls, h = ys[gate], xs[gate], hls[gate], h[gate]
        direction = op["direction"]
        if direction == "green_to_red":
            hue = (op.get("output_hue", 12) + (h - op.get("input_hue", 80)) * op.get("hue_scale", -0.4)) % 360
            saturation = np.minimum(1, hls[:, 2] * op.get("saturation_factor", 2.0))
        elif direction == "red_to_green":
            signed_h = (h + 180) % 360 - 180
            hue = (op.get("output_hue", 92) + (signed_h - op.get("input_hue", 5)) * op.get("hue_scale", -0.9)) % 360
            saturation = np.minimum(1, hls[:, 2] * op.get("saturation_factor", 0.5))
        else:
            raise ValueError(direction)
        new = np.asarray([colorsys.hls_to_rgb(hh / 360, ll, ss)
                          for hh, ll, ss in zip(hue, hls[:, 1], saturation)])
        result[ys, xs, :3] = np.clip(np.rint(new * 255), 0, 255).astype(np.uint8)
        union[ys, xs] = True
        details.append({"name": op["name"], "selected_pixels": len(ys)})
    changed = np.any(result != original, axis=2)
    assert np.array_equal(result[~union], original[~union]), "Outside-mask edit"
    assert np.array_equal(result[..., 3], original[..., 3]), "Alpha changed"
    output.parent.mkdir(parents=True, exist_ok=True)
    save_png_atomic(Image.fromarray(result).convert(im.mode), output)
    mask_path.parent.mkdir(parents=True, exist_ok=True)
    save_png_atomic(Image.fromarray(union.astype(np.uint8) * 255), mask_path)
    decoded = np.array(Image.open(output).convert("RGBA"))
    assert np.array_equal(decoded, result), "Output encoding changed pixels"
    return {"source": str(source), "output": str(output), "size": list(im.size),
            "mode": im.mode, "before": digest(source), "after": digest(output),
            "mask": digest(mask_path), "operations": details,
            "changed_pixels": int(changed.sum()), "outside_mask_changed_pixels": 0,
            "alpha_changed_pixels": 0}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--recipe", type=Path, required=True)
    p.add_argument("--source-root", type=Path, required=True)
    p.add_argument("--output-root", type=Path, required=True)
    p.add_argument("--records", type=Path, required=True)
    p.add_argument("--snapshot-inputs", action="store_true", help="Read committed immutable before/ snapshots from source-root")
    args = p.parse_args()
    recipe = json.loads(args.recipe.read_text())
    records = []
    for entry in recipe["assets"]:
        source = args.source_root / entry["snapshot" if args.snapshot_inputs else "source"]
        if entry.get("source_git_blob_sha"):
            assert digest(source)["git_blob_sha"] == entry["source_git_blob_sha"], "Original source hash mismatch"
        records.append(recolor(source,
                               args.output_root / entry["output"], entry["operations"],
                               args.output_root / entry["mask"]))
    args.records.parent.mkdir(parents=True, exist_ok=True)
    args.records.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps([{k: r[k] for k in ["output", "changed_pixels", "outside_mask_changed_pixels", "alpha_changed_pixels"]} for r in records], ensure_ascii=False))


if __name__ == "__main__":
    main()
