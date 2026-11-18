#!/usr/bin/env python3
"""DESERT RIDE 回転姿（Issue #3563）のゲーム用画像を作る。

原画（このフォルダの <who>/spin_<who>_<角度>.png）は生成のたびに大きさが
ばらつくので、人物の実寸（アルファ外接矩形の高さ）を rider_jump と同じ
668px にそろえて拡大縮小し、板の重心を anchor として adoption.json に
記録する。板の色はキャラごとに違う（はじめ=橙、ヌール=ティール、
なる=クリーム）ので、色マスク＋下半分の最大のかたまりで板だけを拾う
（なるの方法は desert-ride-naru-3222/build.py と同じ）。描画側
（desert-ride-art.js）は anchor を板の基準点に合わせて立てるので、
回転中に人物が伸び縮み・横ずれしない。

使い方:
  python3 asset_sources/desert-ride-spin/build.py            # WebP と adoption.json を再生成
  python3 asset_sources/desert-ride-spin/build.py --check    # 記録と実寸の照合だけ
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

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
    ("noor", "045"),
    ("noor", "090"),
    ("noor", "135"),
    ("noor", "180"),
    ("naru", "045"),
    ("naru", "090"),
    ("naru", "135"),
    ("naru", "180"),
]

MERGE = 9  # 板の破片をつなぐ太らせ幅（1/4 縮小の画素。原画で約36px）


def largest_blob(mask):
    """4近傍でつながった画素のかたまりのうち、いちばん大きいものだけを残す（scipy を使わない）。"""
    small = Image.fromarray((mask * 255).astype(np.uint8)).reduce(4)  # 速さのため 1/4 で数える
    # 板は靴とバインディングで分かれて見えるので、少し太らせて破片をつなげてから数える
    sm = np.asarray(small.filter(ImageFilter.MaxFilter(MERGE))) > 127
    h, w = sm.shape
    label = np.zeros((h, w), np.int32)
    best, best_size, cur = 0, 0, 0
    for y0, x0 in zip(*np.nonzero(sm)):
        if label[y0, x0]:
            continue
        cur += 1
        stack, size = [(y0, x0)], 0
        label[y0, x0] = cur
        while stack:
            y, x = stack.pop()
            size += 1
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and sm[ny, nx] and not label[ny, nx]:
                    label[ny, nx] = cur
                    stack.append((ny, nx))
        if size > best_size:
            best, best_size = cur, size
    keep = np.kron(label == best, np.ones((4, 4), bool))
    out = np.zeros_like(mask)
    out[: keep.shape[0], : keep.shape[1]] = keep[: mask.shape[0], : mask.shape[1]]
    return mask & out


def board_mask(a, who):
    """キャラごとの板の色マスク。なる・ヌールは服や靴にも近い色があるので、
    絵の下側（高さの下45%）にある最大のかたまり（板）だけに絞る。"""
    al = a[..., 3].astype(int)
    r, g, b = (a[..., i].astype(int) for i in range(3))
    if who == "naru":  # クリーム色の板（desert-ride-naru-3222 と同じ条件）
        m = (r > 222) & (g > 188) & (b > 125) & (b < 210) & (r - b > 32) & (g - b > 12)
    elif who == "noor":  # ティール色の板
        m = (g > 110) & (b > 90) & (r < 150) & (g > r + 25) & (b > r + 15)
    else:  # hajime: 橙色の板
        return (al > 200) & (r > 200) & (g > 60) & (g < 170) & (b < 80)
    m &= al > 200
    ys, _ = np.nonzero(al > 128)
    top, bottom = ys.min(), ys.max()
    m[: int(top + (bottom - top) * 0.55)] = False
    return largest_blob(m)


def measure(im: Image.Image, who: str = "hajime"):
    a = np.array(im.convert("RGBA"))
    al = a[..., 3]
    ys, xs = np.where(al > 8)
    bbox_h = int(ys.max() - ys.min() + 1)
    board = board_mask(a, who)
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
        bbox_h, anchor = measure(im, who)
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
            _, anchor = measure(Image.open(REPO / entry["source"]), key.split("_")[1])
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
