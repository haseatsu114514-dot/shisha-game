#!/usr/bin/env python3
"""立ち絵から顔ドット絵アイコンを生成する。

assets/sprites/characters/{id}/chr_{id}_normal.png の頭部を切り出し、
32x32 に縮小 → 減色してドット絵風の顔アイコンにする。
出力: assets/ui/face_icons/face_{id}.png
（UIの好感度バナー・マップピン・LIME画面のアバターに使う）

使い方:
    python3 tools/make_face_icons.py            # 全キャラ生成
    python3 tools/make_face_icons.py --sheet    # 確認用シートも出力
"""

import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
CHARS_DIR = REPO_ROOT / "assets" / "sprites" / "characters"
OUT_DIR = REPO_ROOT / "assets" / "ui" / "face_icons"

SIZE = 48          # ドット絵の解像度
COLORS = 32        # パレット色数

# 頭部クロップの調整値（コンテンツbbox基準）。
#   w: bbox幅に対する正方形の辺の比 / dy: bbox上端からの下方オフセット比(高さ基準)
#   dx: 横ズレ比(幅基準、+で右)
# 立ち絵の頭はbbox上端・中央にあるので、基本値でほぼ合う。
# 背景込み一枚絵のキャラは abs 指定（画像全体に対する顔中心 cx/cy と辺 side の比）。
DEFAULT = {"w": 0.62, "dy": 0.0, "dx": 0.0}
TUNE = {
    "sumi":    {"w": 0.55, "dy": 0.0},
    "packii":  {"w": 0.95, "dy": 0.0},   # マスコットは頭身が低い
    "minto":   {"w": 0.72},
    "tsumugi": {"w": 0.78},
    "mashiro": {"w": 0.78},
    "ageha":   {"w": 0.74},
    "hajime":  {"w": 0.74},
    "naru":    {"w": 0.66},
    "adam":    {"w": 0.66},
    "rin":     {"w": 0.70},
    # ryuji は現状 placeholder 一枚絵（背景込み）
    "ryuji":   {"abs": True, "cx": 0.60, "cy": 0.535, "side": 0.26},
}


def make_icon(char_id: str, src: Path) -> Image.Image | None:
    im = Image.open(src).convert("RGBA")
    bbox = im.getbbox()
    if not bbox:
        return None
    left, top, right, bottom = bbox
    cw, ch = right - left, bottom - top
    p = {**DEFAULT, **TUNE.get(char_id, {})}
    if p.get("abs"):
        side = int(im.height * p["side"])
        x0 = int(im.width * p["cx"] - side / 2)
        y0 = int(im.height * p["cy"] - side / 2)
    else:
        side = int(cw * p["w"])
        cx = left + cw / 2 + cw * p["dx"]
        x0 = int(cx - side / 2)
        y0 = int(top + ch * p["dy"])
    crop = im.crop((x0, y0, x0 + side, y0 + side))
    # 縮小 → 減色（αは別管理: quantizeで半透明が荒れるのを防ぐ）
    small = crop.resize((SIZE, SIZE), Image.LANCZOS)
    alpha = small.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
    rgb = small.convert("RGB").quantize(colors=COLORS, method=Image.MEDIANCUT)
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    icons = {}
    for char_dir in sorted(CHARS_DIR.iterdir()):
        if not char_dir.is_dir():
            continue
        cid = char_dir.name
        src = char_dir / f"chr_{cid}_normal.png"
        if not src.exists():
            cands = sorted(char_dir.glob("chr_*.png"))
            if not cands:
                continue
            src = cands[0]
        icon = make_icon(cid, src)
        if icon is None:
            print(f"skip {cid} (empty bbox)")
            continue
        dest = OUT_DIR / f"face_{cid}.png"
        icon.save(dest, optimize=True)
        icons[cid] = icon
        print(f"wrote {dest} ({dest.stat().st_size:,} bytes)")

    if "--sheet" in sys.argv[1:]:
        scale = 4
        pad = 8
        cell = SIZE * scale + pad
        sheet = Image.new("RGBA", (cell * len(icons), cell), (40, 30, 50, 255))
        for i, (cid, icon) in enumerate(icons.items()):
            big = icon.resize((SIZE * scale, SIZE * scale), Image.NEAREST)
            sheet.paste(big, (i * cell + pad // 2, pad // 2), big)
        sheet_path = OUT_DIR / "_sheet_preview.png"
        sheet.save(sheet_path)
        print(f"wrote {sheet_path} (order: {', '.join(icons)})")


if __name__ == "__main__":
    main()
