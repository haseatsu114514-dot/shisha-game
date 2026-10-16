#!/usr/bin/env python3
"""Validate selected generator PNGs, encode WebP, derive shop display windows.

Requires Pillow for full PNG/WebP decoding and cwebp for delivery encoding.
Does not draw, retouch, remove backgrounds, or modify source PNGs.
"""
import argparse
import tempfile
import hashlib
import json
import pathlib
import subprocess

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "asset_sources/shop-art-issue586"
ACTIVE = SOURCE / "runtime-heaven10-adoption"
# Explicit user-adopted ID/source/SHA/delivery whitelist. Never scan candidate folders.
APPROVED = [
    {
        "id": "mint",
        "source": "wing-only-heaven10-v6/outputs/mint-wings-composite.png",
        "sha256": "d65bf690203e60c140cc85b9b9789e5573938b7b672e90502574c28e76b79d71",
        "delivery": "remake/img/shop/heaven10/mint.webp"
    },
    {
        "id": "double_apple",
        "source": "wing-only-heaven10-v6/outputs/double_apple-wings-composite.png",
        "sha256": "5f663c8d24ffdf00d462aa710270564e1c9afb5f7730f22e528ce9d9eae9e674",
        "delivery": "remake/img/shop/heaven10/double_apple.webp"
    },
    {
        "id": "blueberry",
        "source": "wing-only-heaven10-v6/outputs/blueberry-wings-composite.png",
        "sha256": "c8547279c95bae2732a1e235a409d815c975dda3b98d584d3633e97a13cd8ec8",
        "delivery": "remake/img/shop/heaven10/blueberry.webp"
    },
    {
        "id": "strawberry",
        "source": "wing-only-heaven10-v6/outputs/strawberry-wings-composite.png",
        "sha256": "bcf290ed6e47530d21b4db66011bcaeafe4b529a0f15a3a7381358368f230a6b",
        "delivery": "remake/img/shop/heaven10/strawberry.webp"
    },
    {
        "id": "pineapple",
        "source": "wing-only-heaven10-v6/outputs/pineapple-wings-composite.png",
        "sha256": "042f052fc7cf848165232b73948ea994bfad21b0839a25c81599e4274bf5ee24",
        "delivery": "remake/img/shop/heaven10/pineapple.webp"
    },
    {
        "id": "lemon",
        "source": "wing-only-heaven10-v6/outputs/lemon-wings-composite.png",
        "sha256": "eecaa5f0397cf57225e41aee9b2bb68f318fb7371cc6034d0e49d13590662695",
        "delivery": "remake/img/shop/heaven10/lemon.webp"
    },
    {
        "id": "orange",
        "source": "wing-only-heaven10-v6/outputs/orange-wings-composite.png",
        "sha256": "5124270384576d5051f5ef255011b8a796585b80afca408f332d5500b6ed3d00",
        "delivery": "remake/img/shop/heaven10/orange.webp"
    },
    {
        "id": "grape",
        "source": "wing-only-heaven10-v6/outputs/grape-wings-composite.png",
        "sha256": "33a1e94de92a0ba4070865bab1f296aa484706c8b532d63eae78dcc8b998e4e8",
        "delivery": "remake/img/shop/heaven10/grape.webp"
    },
    {
        "id": "watermelon",
        "source": "wing-only-heaven10-v6/outputs/watermelon-wings-composite.png",
        "sha256": "92cd6aec45700cf542ea634b5dfcad6b1f0d82abeb8aade06ed1e3abb3b0584c",
        "delivery": "remake/img/shop/heaven10/watermelon.webp"
    },
    {
        "id": "cinnamon",
        "source": "wing-only-heaven10-v6/outputs/cinnamon-wings-composite.png",
        "sha256": "d29390a0f759234ba4de2d542a12e81203f9abdac2366faa9229de5fc382f66b",
        "delivery": "remake/img/shop/heaven10/cinnamon.webp"
    }
]

def validate_selection(items):
    if len(items) != len(APPROVED) or {i["id"] for i in items} != {i["id"] for i in APPROVED}:
        raise ValueError("Only the ten adopted Heaven sources are permitted; pending8/HMD are held")
    for item, approved in zip(items, APPROVED):
        if item != approved:
            raise ValueError(f"Unapproved source, hash, delivery or order: {item.get('id')}")



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
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Re-encode to temporary files and compare all delivery bytes/mapping/report")
    args = parser.parse_args()
    items = json.loads((ACTIVE / "adoption.json").read_text())["items"]
    validate_selection(items)
    report, mappings = [], []
    temporary = tempfile.TemporaryDirectory()
    for item in items:
        original = SOURCE / item["source"]
        if sha(original) != item["sha256"]:
            raise ValueError(f"Selected source hash changed: {original}")
        before = inspect(original)
        destination = ROOT / item["delivery"]
        target = pathlib.Path(temporary.name) / (item["id"] + ".webp")
        subprocess.run(["cwebp", "-quiet", "-q", "88", "-alpha_q", "100", "-m", "6",
                        "-resize", "512", "512", str(original), "-o", str(target)], check=True)
        after = inspect(target)
        if args.check:
            if not destination.exists() or target.read_bytes() != destination.read_bytes():
                raise ValueError(f"Delivery is not reproducible: {destination}")
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(target.read_bytes())
        if after["size"] != [512, 512]:
            raise ValueError(f"Unexpected delivery dimensions: {target}")
        report.append(dict(id=item["id"], source=before, delivery=after,
                           path=item["delivery"], bytes=target.stat().st_size))
        relative = "../../img/shop/" + destination.relative_to(ROOT / "remake/img/shop").as_posix()
        mappings.append(f'  {json.dumps(item["id"])}: {{ url: new URL({json.dumps(relative)}, import.meta.url).href, '
                        f'size: [512, 512], box: {json.dumps(after["box"])} }},')
    module = "// Derived by tools/build_shop_art.py from selected generated originals.\n"
    module += "// Each measured window retains alpha; productArt adds the same display margin.\n"
    module += "export const SHOP_ART = {\n" + "\n".join(mappings) + "\n};\n"
    files = {ROOT / "remake/js/daily/shop-art.js": module,
             ACTIVE / "validation.json": json.dumps(dict(items=report), indent=2) + "\n"}
    for path, content in files.items():
        if args.check:
            if path.read_text() != content:
                raise ValueError(f"Derived mapping/report is not reproducible: {path}")
        else:
            path.write_text(content)
    temporary.cleanup()
    print(f"PASS: {len(items)} PNGs fully decoded; 512x512 RGBA WebP and shop windows generated")
    print(f"Delivery bytes: {sum(item['bytes'] for item in report):,}")


if __name__ == "__main__":
    main()
