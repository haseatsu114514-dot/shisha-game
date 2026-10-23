#!/usr/bin/env python3
"""Fit the two owner-adopted #710 portraits; keep their generated originals intact.

Only faint-alpha cleanup, uniform downscaling and canvas placement are performed.
Both expressions share one crop, scale and placement. No drawing or regeneration.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "asset_sources/issue710-image-candidates-20261021"
SOURCES = {
    "normal": "efa68511b363679676ae36d95755e2f69b0b94780a690a7812ead6a49f88e29c",
    "smile": "4a497003ba2f5d6523274ca2bd227a42ca3c0da49a74079adae06ef05e203c40",
}
# Union of the adopted source alpha>=16 bounds. Target matches the old pair's
# 1098px union height, 1175px sole baseline and approximately 457px alpha centroid.
CROP = (335, 33, 783, 1425)
SIZE = (353, 1098)
POSITION = (279, 77)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    records = []
    for face, expected in SOURCES.items():
        path = SOURCE / f"salaryman-{face}-v1.png"
        original = path.read_bytes()
        if digest(original) != expected:
            raise ValueError(f"Adopted original changed: {path}")
        with Image.open(path) as native:
            image = native.convert("RGBA")
        alpha = image.getchannel("A")
        faint = sum(alpha.histogram()[1:16])
        image.putalpha(alpha.point(lambda value: 0 if value < 16 else value))
        fitted = image.crop(CROP).resize(SIZE, Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (896, 1200))
        canvas.paste(fitted, POSITION)  # No mask: preserve the alpha exactly once.
        bounds = canvas.getchannel("A").getbbox()
        if not bounds or bounds[0] <= 0 or bounds[1] <= 0 or bounds[2] >= 896 or bounds[3] >= 1200:
            raise ValueError("Portrait touches a canvas edge")
        outputs = {}
        for suffix, folder, options in [
            ("png", "assets", {"optimize": True}),
            ("webp", "remake/img", {"lossless": True, "exact": True, "method": 6}),
        ]:
            dest = ROOT / folder / "sprites/characters/salaryman" / f"chr_salaryman_{face}.{suffix}"
            buffer = io.BytesIO()
            canvas.save(buffer, format=suffix.upper(), **options)
            data = buffer.getvalue()
            if args.check:
                if dest.read_bytes() != data:
                    raise ValueError(f"Delivery is not reproducible: {dest}")
            else:
                dest.write_bytes(data)
            with Image.open(dest) as decoded:
                if decoded.convert("RGBA").tobytes() != canvas.tobytes():
                    raise ValueError(f"Decoded RGBA differs: {dest}")
            outputs[str(dest.relative_to(ROOT))] = {"sha256": digest(data), "bytes": len(data)}
        if path.read_bytes() != original:
            raise ValueError("Source was modified")
        records.append({"face": face, "source_sha256": expected, "removed_faint_pixels": faint,
                        "alpha_bounds": bounds, "outputs": outputs})
    report = {"issue": 710, "owner_decision": "会社員2枚を採用して進める",
              "originals": "unchanged", "coal": "on hold; not connected",
              "canvas": [896, 1200], "shared_crop": CROP, "shared_size": SIZE,
              "shared_position": POSITION, "records": records}
    validation = SOURCE / "salaryman-adoption.json"
    text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if validation.read_text() != text:
            raise ValueError("Adoption report differs")
    else:
        validation.write_text(text)
    print("PASS: two immutable originals; shared fit; four reproducible, exact-RGBA deliveries")


if __name__ == "__main__":
    main()
