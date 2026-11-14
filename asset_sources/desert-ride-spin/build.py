#!/usr/bin/env python3
"""DESERT RIDE 回転姿（Issue #3563）のゲーム用画像を作る。

原画（このフォルダの <who>/spin_<who>_<角度>.png）は生成のたびに大きさが
ばらつくので、人物の実寸（アルファ外接矩形の高さ）を rider_jump と同じ
668px にそろえて拡大縮小し、板の重心（橙色の重心）を anchor として
adoption.json に記録する。描画側（desert-ride-art.js）は anchor を
板の基準点に合わせて立てるので、回転中に人物が伸び縮み・横ずれしない。

使い方:
  python3 asset_sources/desert-ride-spin/build.py            # WebP と adoption.json を再生成
  python3 asset_sources/desert-ride-spin/build.py --check    # 記録と実寸の照合だけ
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
GAME_DIR = REPO / "remake" / "img" / "ui" / "desert_ride"
RECORD = HERE / "adoption.json"

# rider_jump.webp（537x670）の人物の実寸。すべての回転姿をこの高さにそろえる。
TARGET_FIGURE_H = 668

FRAMES = [
    ("hajime", "045"),
    ("hajime", "090"),
    ("hajime", "135"),
    ("hajime", "180"),
]


def measure(im: Image.Image):
    a = np.array(im.convert("RGBA"))
    al = a[..., 3]
    ys, xs = np.where(al > 8)
    bbox_h = int(ys.max() - ys.min() + 1)
    r, g, b = (a[..., i].astype(int) for i in range(3))
    board = (al > 200) & (r > 200) & (g > 60) & (g < 170) & (b < 80)
    by, bx = np.where(board)
    if len(bx) < 500:
        raise SystemExit("board (orange) pixels too few to locate the anchor")
    anchor = {"x": round(float(bx.mean() / im.width), 4), "y": round(float(by.mean() / im.height), 4)}
    return bbox_h, anchor


def build() -> dict:
    record = {}
    for who, angle in FRAMES:
        src = HERE / who / f"spin_{who}_{angle}.png"
        im = Image.open(src).convert("RGBA")
        bbox_h, anchor = measure(im)
        scale = TARGET_FIGURE_H / bbox_h
        size = (round(im.width * scale), round(im.height * scale))
        out = im.resize(size, Image.LANCZOS)
        webp = GAME_DIR / f"spin_{who}_{angle}.webp"
        out.save(webp, "WEBP", quality=92, method=6)
        record[f"spin_{who}_{angle}"] = {
            "source": f"asset_sources/desert-ride-spin/{who}/spin_{who}_{angle}.png",
            "webp": f"remake/img/ui/desert_ride/spin_{who}_{angle}.webp",
            "size": list(size),
            "anchor": anchor,
            "scale": round(scale, 4),
        }
        print(f"{who} {angle}: {im.width}x{im.height} -> {size[0]}x{size[1]} anchor=({anchor['x']}, {anchor['y']})")
    return record


def main() -> int:
    if "--check" in sys.argv:
        record = json.loads(RECORD.read_text(encoding="utf-8"))
        for key, entry in record.items():
            webp = REPO / entry["webp"]
            im = Image.open(webp)
            if list(im.size) != entry["size"]:
                print(f"MISMATCH {key}: size {im.size} != {entry['size']}")
                return 1
            _, anchor = measure(Image.open(REPO / entry["source"]))
            if anchor != entry["anchor"]:
                print(f"MISMATCH {key}: anchor {anchor} != {entry['anchor']}")
                return 1
        print("desert-ride-spin: record matches")
        return 0
    record = build()
    RECORD.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {RECORD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
