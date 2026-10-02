#!/usr/bin/env python3
"""作りパートの実行用PNGを表示上限へ縮小・最適化する。

元画像は主に1254〜2560pxだが、ゲーム内表示は最大でも約640 CSS px。
DPR 2で必要な解像度を残しつつ、初回通信量とデコードメモリを抑える。
透明余白の比率は維持するため、build_data.py のbbox正規化と両立する。
"""

from __future__ import annotations

import argparse
import os
import tempfile
from pathlib import Path

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parent.parent
MAKING_DIR = REPO_ROOT / "assets" / "ui" / "making"

MAX_WIDTHS = {
    "bench_base.png": 1280,
    "vignette_focus.png": 1280,
    "smoke_thick.png": 1024,
    "hose_line.png": 1024,
    "mix_scale.png": 960,
    "stove_coil.png": 960,
    "bench_note.png": 640,
}
DEFAULT_MAX_WIDTH = 768
SILICONE_BOWLS = {
    "bowl_empty_silicone.png",
    "bowl_packed_airy.png",
    "bowl_packed_normal.png",
    "bowl_packed_firm.png",
}


def normalize_silicone_bowl(im: Image.Image) -> Image.Image:
    """誤って一体化した長い脚を消し、他ボウルと同じ器だけの比率へ揃える。"""
    out = im.copy()
    cutoff = round(out.height * 0.48)
    clear = Image.new("RGBA", (out.width, out.height - cutoff), (0, 0, 0, 0))
    out.paste(clear, (0, cutoff))
    return out


def single_leaf_grain(im: Image.Image) -> Image.Image:
    """縦7粒のシートから一粒を切り出し、64pxの単粒スプライトにする。"""
    alpha = im.getchannel("A")
    bounds = alpha.point(lambda value: 255 if value >= 24 else 0).getbbox()
    if not bounds:
        return im
    px = alpha.load()
    seen: set[tuple[int, int]] = set()
    components: list[tuple[int, tuple[int, int, int, int]]] = []
    for y in range(bounds[1], bounds[3]):
        for x in range(bounds[0], bounds[2]):
            if px[x, y] < 24 or (x, y) in seen:
                continue
            stack = [(x, y)]
            seen.add((x, y))
            count = 0
            x0 = x1 = x
            y0 = y1 = y
            while stack:
                cx, cy = stack.pop()
                count += 1
                x0, x1 = min(x0, cx), max(x1, cx)
                y0, y1 = min(y0, cy), max(y1, cy)
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if (nx, ny) in seen or nx < bounds[0] or nx >= bounds[2] or ny < bounds[1] or ny >= bounds[3]:
                        continue
                    if px[nx, ny] >= 24:
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            components.append((count, (x0, y0, x1 + 1, y1 + 1)))
    if not components:
        return im
    _, bbox = max(components, key=lambda item: item[0])
    piece = im.crop(bbox)
    scale = min(52 / piece.width, 52 / piece.height)
    size = (max(1, round(piece.width * scale)), max(1, round(piece.height * scale)))
    piece = piece.resize(size, Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    out.alpha_composite(piece, ((64 - size[0]) // 2, (64 - size[1]) // 2))
    return out


def optimized_image(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    if path.name in SILICONE_BOWLS:
        im = normalize_silicone_bowl(im)
    if path.name == "leaf_grain.png":
        return single_leaf_grain(im)
    max_width = MAX_WIDTHS.get(path.name, DEFAULT_MAX_WIDTH)
    if im.width > max_width:
        height = max(1, round(im.height * max_width / im.width))
        im = im.resize((max_width, height), Image.Resampling.LANCZOS)
    return im


def optimize(path: Path, write: bool) -> tuple[int, int, tuple[int, int], tuple[int, int]]:
    before_size = path.stat().st_size
    with Image.open(path) as original:
        before_dims = original.size
    im = optimized_image(path)
    after_dims = im.size
    with tempfile.NamedTemporaryFile(suffix=".png", dir=path.parent, delete=False) as tmp:
        temp_path = Path(tmp.name)
    try:
        im.save(temp_path, "PNG", optimize=True, compress_level=9)
        after_size = temp_path.stat().st_size
        if write and (after_size < before_size or after_dims != before_dims or path.name in SILICONE_BOWLS | {"leaf_grain.png"}):
            os.replace(temp_path, path)
        else:
            temp_path.unlink(missing_ok=True)
    finally:
        temp_path.unlink(missing_ok=True)
    return before_size, after_size, before_dims, after_dims


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="最適化結果を実ファイルへ反映する")
    args = parser.parse_args()
    total_before = 0
    total_after = 0
    for path in sorted(MAKING_DIR.glob("*.png")):
        before, after, before_dims, after_dims = optimize(path, args.write)
        total_before += before
        total_after += after
        if before != after or before_dims != after_dims:
            print(f"{path.name}: {before_dims} {before:,} -> {after_dims} {after:,}")
    mode = "wrote" if args.write else "dry-run"
    saved = total_before - total_after
    print(f"{mode}: {total_before / 1048576:.2f} MiB -> {total_after / 1048576:.2f} MiB ({saved / 1048576:.2f} MiB saved)")


if __name__ == "__main__":
    main()
