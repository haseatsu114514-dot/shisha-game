#!/usr/bin/env python3
"""Issue #3254 の原画（raw/ の PNG・無加工）から、ゲームが読む WebP を作る。
原寸のまま。透過の絵は、生成のふちに残る alpha 1〜7 のごく薄いノイズだけを 0 にする（見た目は変わらない）。
使い方: python3 asset_sources/transitions/motion-props-3254/make_webp.py"""
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).parent
ROOT = HERE.parents[2]
OUT = ROOT / "remake/img/ui/transitions"
# 原画 → ゲーム用（remake/img/ui/transitions/ の下）
PLAN = {
    "card-back": "tarot/card-back", "card-front-frame": "tarot/card-front-frame",
    "sign-open": "shift/sign-open", "sign-closed": "shift/sign-closed",
    "tablet": "sketch/tablet", "stylus": "sketch/stylus",
    "marker-pink": "cheki/marker-pink", "marker-green": "cheki/marker-green",
    "cabin": "plane/cabin", "cloudsea-night": "plane/cloudsea-night", "cloudsea-dawn": "plane/cloudsea-dawn",
}

for src, dst in PLAN.items():
    im = Image.open(HERE / "raw" / f"{src}.png")
    path = OUT / f"{dst}.webp"
    path.parent.mkdir(parents=True, exist_ok=True)
    if im.mode == "RGBA":
        a = np.asarray(im).copy()
        a[a[..., 3] < 8] = 0
        Image.fromarray(a, "RGBA").save(path, "WEBP", quality=90, alpha_quality=100, method=6)
    else:
        im.convert("RGB").save(path, "WEBP", quality=86, method=6)
    print(f"{dst}.webp", im.size, path.stat().st_size // 1024, "KB")
