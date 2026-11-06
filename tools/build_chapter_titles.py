#!/usr/bin/env python3
"""採用済み1〜5章を無劣化WebPへ変換。"""
import hashlib
import json
import argparse
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ADOPTION = ROOT / "asset_sources/chapter-title/ch2-5-style-studies-385-20261013/type-polish/adoption.json"
OUT = ROOT / "remake/img/ui/chapters"

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chapter", type=int, choices=(1, 2, 3, 4, 5),
                        help="指定した章だけを再生成する")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    entries = json.loads(ADOPTION.read_text())["selected_images"]
    for entry in entries:
        if entry["chapter"] not in (1, 2, 3, 4, 5):
            continue
        if args.chapter is not None and entry["chapter"] != args.chapter:
            continue
        source = ROOT / entry["path"]
        if hashlib.sha256(source.read_bytes()).hexdigest() != entry["sha256"]:
            raise ValueError(f"Approval hash mismatch: {source}")
        with Image.open(source) as image:
            image = image.convert("RGBA")
            if image.size != (1280, 720):
                raise ValueError(f"Unexpected dimensions: {source}")
            output = OUT / f'ch{entry["chapter"]}-title.webp'
            image.save(output, format="WEBP", lossless=True, method=6)
            with Image.open(output) as delivered:
                if delivered.convert("RGBA").tobytes() != image.tobytes():
                    raise ValueError(f"Lossless pixel check failed: {output}")
        print(f'PASS chapter {entry["chapter"]}: approval SHA256 + lossless pixels ({output.stat().st_size} bytes)')

if __name__ == "__main__":
    main()
