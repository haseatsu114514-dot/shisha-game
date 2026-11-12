"""#3423 / AXQ03: Codex の斧投げ画面の部品7枚（PR #3448）を、採用版PNGと表示用WebPに書き出し、CSS に要る寸法を測る。

使い方（リポジトリの直下で）: python3 -I asset_sources/ui/axe-quality-ui-20261111/tools/make_axe_quality_ui.py
- 入力: asset_sources/ui/axe-quality-ui-20261111/raw/*.png（Codex の原画。無加工のまま残す）
- 出力: assets/ui/axe_throw/<名前>.png（採用版。原画と同じ画素）
        remake/img/ui/axe_throw/<名前>.webp（表示用。下の倍率で縮める。透明の所の色も保つ）
        asset_sources/ui/axe-quality-ui-20261111/tools/geometry.json（表示用の画像寸法・絵の外接範囲・縁の太さ・帯の切れ込み）
切れ跡（cut-mark）は生成できなかったので無い。刺さった跡は今のコードの描画のまま。
"""
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
RAW = HERE.parent / "raw"
ADOPT = ROOT / "assets/ui/axe_throw"
DISP = ROOT / "remake/img/ui/axe_throw"

# 表示用の倍率。表示の大きさ（ステージ 1280×720 上）の2倍以上の画素を残す。
SCALE = {
    "hud-plate": 1.0,        # 1252×88 に伸ばす（横に長いので原寸）
    "score-slot": 1.0,       # 44〜215 幅
    "chalk-window": 0.75,    # 278×164〜600×330
    "rank-medallion": 0.5,   # 約84×84
    "banner-orange": 2 / 3,  # 約366×100
    "banner-green": 2 / 3,
    "wood-chips": 0.5,       # 1片 約12〜32
}


def bbox(alpha, level=128):
    ys, xs = np.where(alpha > level)
    return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]


def luminance(arr):
    return arr[:, :, 0] * .3 + arr[:, :, 1] * .59 + arr[:, :, 2] * .11


def main():
    ADOPT.mkdir(parents=True, exist_ok=True)
    DISP.mkdir(parents=True, exist_ok=True)
    geometry = {}
    for name, scale in SCALE.items():
        src = RAW / f"{name}.png"
        shutil.copyfile(src, ADOPT / f"{name}.png")
        im = Image.open(src).convert("RGBA")
        size = (round(im.width * scale), round(im.height * scale))
        disp = im if scale == 1 else im.resize(size, Image.LANCZOS)
        disp.save(DISP / f"{name}.webp", "WEBP", quality=90, method=6, exact=True)
        arr = np.array(disp)
        entry = {"image": [disp.width, disp.height], "object": bbox(arr[:, :, 3])}
        if name.startswith("banner-"):
            # 左右の燕尾の切れ込み: 縦の真ん中の行で、絵が始まる位置と外接範囲の左端の差
            x0, y0, x1, y1 = entry["object"]
            row = np.where(arr[(y0 + y1) // 2, :, 3] > 128)[0]
            entry["notch"] = int(row.min() - x0)
        geometry[name] = entry
    # 木片: 4×2 のマスごとの外接範囲（表示用の画素）
    chips = np.array(Image.open(DISP / "wood-chips.webp").convert("RGBA"))
    cell = chips.shape[1] // 4
    geometry["wood-chips"]["cells"] = [bbox(chips[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell, 3], 16)
                                       for r in range(2) for c in range(4)]
    (HERE / "geometry.json").write_text(json.dumps(geometry, indent=1) + "\n", encoding="utf-8")
    for name, entry in geometry.items():
        print(name, entry["image"], entry["object"], entry.get("notch", ""), (DISP / f"{name}.webp").stat().st_size // 1024, "KiB")


if __name__ == "__main__":
    main()
