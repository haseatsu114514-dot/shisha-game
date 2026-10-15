#!/usr/bin/env python3
"""Validate selected generator PNGs, encode WebP, derive shop display windows.

Requires Pillow for full PNG/WebP decoding and cwebp for delivery encoding.
Does not draw, retouch, remove backgrounds, or modify source PNGs.
"""
import hashlib
import json
import pathlib
import subprocess

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "asset_sources/shop-art-issue586"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inspect(path):
    with Image.open(path) as im:
        im.load()  # Full decode, not just IHDR/metadata.
        if im.mode != "RGBA" or im.size[0] != im.size[1]:
            raise ValueError(f"Expected square RGBA: {path} / {im.mode} / {im.size}")
        alpha = im.getchannel("A")
        # Resampling can turn a generator's isolated 255 values into 254.
        low, high = alpha.getextrema()
        if low != 0 or high < 250:
            raise ValueError(f"Missing transparent background or near-opaque product: {path}")
        visible = alpha.point(lambda v: 255 if v > 16 else 0).getbbox()
        if not visible or min(visible[:2]) <= 1 or visible[2] >= im.width - 1 or visible[3] >= im.height - 1:
            raise ValueError(f"Product touches canvas edge: {path} / {visible}")
        # Include antialiasing around the visible object; the UI adds uniform margins.
        left, top, right, bottom = visible
        box = [max(0, left - 2), max(0, top - 2), min(im.width, right + 2), min(im.height, bottom + 2)]
        return dict(size=list(im.size), mode=im.mode, visible_bbox=list(visible),
                    box=[box[0], box[1], box[2] - box[0], box[3] - box[1]],
                    alpha_extrema=list(alpha.getextrema()), sha256=sha(path))


def main():
    adoption = json.loads((SOURCE / "adoption.json").read_text())
    inventory = json.loads((SOURCE / "inventory.json").read_text())
    expected = {item["id"] for item in inventory if item["target"]}
    items = adoption["items"]
    if len(items) != len(expected) or {i["id"] for i in items} != expected:
        raise ValueError("Adoption must contain exactly the 18 packages and 3 HMD targets")
    report, mappings = [], []
    for item in items:
        original = SOURCE / item["source"]
        if sha(original) != item["sha256"]:
            raise ValueError(f"Selected source hash changed: {original}")
        before = inspect(original)
        target = ROOT / item["delivery"]
        target.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["cwebp", "-quiet", "-q", "88", "-alpha_q", "100", "-m", "6",
                        "-resize", "512", "512", str(original), "-o", str(target)], check=True)
        after = inspect(target)
        if after["size"] != [512, 512]:
            raise ValueError(f"Unexpected delivery dimensions: {target}")
        report.append(dict(id=item["id"], source=before, delivery=after,
                           path=item["delivery"], bytes=target.stat().st_size))
        relative = "../../img/shop/" + target.relative_to(ROOT / "remake/img/shop").as_posix()
        mappings.append(f'  {json.dumps(item["id"])}: {{ url: new URL({json.dumps(relative)}, import.meta.url).href, '
                        f'size: [512, 512], box: {json.dumps(after["box"])} }},')
    module = "// Derived by tools/build_shop_art.py from selected generated originals.\n"
    module += "// Each measured window retains alpha; productArt adds the same display margin.\n"
    module += "export const SHOP_ART = {\n" + "\n".join(mappings) + "\n};\n"
    (ROOT / "remake/js/daily/shop-art.js").write_text(module)
    (SOURCE / "validation.json").write_text(json.dumps(dict(items=report), indent=2) + "\n")
    print(f"PASS: {len(items)} PNGs fully decoded; 512x512 RGBA WebP and shop windows generated")
    print(f"Delivery bytes: {sum(item['bytes'] for item in report):,}")


if __name__ == "__main__":
    main()
