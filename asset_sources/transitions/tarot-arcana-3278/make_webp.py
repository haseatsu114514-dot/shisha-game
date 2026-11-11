#!/usr/bin/env python3
"""Issue #3278 の札の絵（raw/ の PNG・無加工）を、表の枠（#3254）の窓に入れて、ゲームが読む札の表の WebP を作る。

- 枠: asset_sources/transitions/motion-props-3254/raw/card-front-frame.png（ゲームの card-front-frame.webp の原画）
- 窓: 枠の真ん中の生成りの面（金の細線の内側）。中心から塗りつぶしで求め、窓の中の小さな濃淡の穴も埋める
- 絵: 窓の高さに合わせて縮め、左右を同じだけ切る（1024x1536 なら左右約7%ずつ。依頼文の「横の中央80%」に主役がある）
- 出力: 札の外形（CARD_BOX。motion-direction の見本・裏の札と同じ）で切り、540x888（表示の約2倍）の WebP。
  角の外は透過。ファイル名は raw と同じ（remake/img/ui/transitions/tarot/arcana/<名前>.webp を上書き）
使い方: python3 asset_sources/transitions/tarot-arcana-3278/make_webp.py   （Pillow・numpy が必要）
  原画は Git LFS。先にこの2か所だけ取る:
  git lfs pull --include="asset_sources/transitions/tarot-arcana-3278/raw/*.png,asset_sources/transitions/motion-props-3254/raw/card-front-frame.png"
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RAW = HERE / "raw"
FRAME = ROOT / "asset_sources/transitions/motion-props-3254/raw/card-front-frame.png"
OUT = ROOT / "remake/img/ui/transitions/tarot/arcana"
CARD_BOX = (87, 60, 937, 1457)  # 札の外形（1024x1536 の中。裏 card-back と表の枠で共通・見本の make_assets.py と同じ）
SIZE = (540, 888)  # ゲームの札は 232x381（めくった後 1.16倍）で、高精細の画面でもにじまない約2倍
QUALITY = 80
NAMES = [
    "00-fool", "01-magician", "02-high-priestess", "03-empress", "04-emperor", "05-hierophant", "06-lovers",
    "07-chariot", "08-strength", "09-hermit", "10-wheel", "11-justice", "12-hanged", "14-temperance",
    "17-star", "18-moon", "19-sun", "20-judgement", "21-world",
]


def window_mask(frame):
    """枠の窓（生成りの面）の真偽の配列。金の細線の内側の縁は、線の暗い縁で区切られている"""
    a = np.asarray(frame).astype(np.int16)
    light = (a[..., 0] > 200) & (a[..., 1] > 185) & (a[..., 2] > 150) & (a[..., 3] > 200)
    fill = Image.fromarray(np.where(light, 255, 0).astype(np.uint8), "L").copy()  # fromarray の絵は書き換えられないので複製
    ImageDraw.floodfill(fill, (frame.width // 2, frame.height // 2), 128)
    region = np.asarray(fill) == 128
    # 窓の中の濃い粒（生成の濃淡）を穴として埋める: 窓の外から届かない所はすべて窓
    rest = Image.fromarray(np.where(region, 0, 255).astype(np.uint8), "L").copy()
    ImageDraw.floodfill(rest, (0, 0), 128)
    return np.asarray(rest) != 128


def build(name, frame, mask, box):
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    art = Image.open(RAW / f"{name}.png").convert("RGB")
    scale = max(bw / art.width, bh / art.height)
    w, h = round(art.width * scale), round(art.height * scale)
    art = art.resize((w, h), Image.Resampling.LANCZOS)
    left, top = (w - bw) // 2, (h - bh) // 2
    art = art.crop((left, top, left + bw, top + bh)).convert("RGBA")
    card = frame.copy()
    canvas = Image.new("RGBA", frame.size)
    canvas.paste(art, (x0, y0))
    m = Image.fromarray(np.where(mask, 255, 0).astype(np.uint8), "L")
    card.paste(canvas, (0, 0), m)
    return card.crop(CARD_BOX).resize(SIZE, Image.Resampling.LANCZOS), left / scale


def main():
    pointers = [p for p in [FRAME, *(RAW / f"{n}.png" for n in NAMES)] if p.stat().st_size < 2048]
    if pointers:
        sys.exit(f"原画が Git LFS のポインタのまま（{len(pointers)} 個）。使い方の git lfs pull を先に実行する")
    frame = Image.open(FRAME).convert("RGBA")
    mask = window_mask(frame)
    ys, xs = np.where(mask)
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    print(f"窓 {box}（{box[2] - box[0]}x{box[3] - box[1]}・縦横比 {(box[2] - box[0]) / (box[3] - box[1]):.3f}）")
    total = 0
    OUT.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        card, cut = build(name, frame, mask, box)
        path = OUT / f"{name}.webp"
        card.save(path, "WEBP", quality=QUALITY, alpha_quality=100, method=6)
        size = path.stat().st_size
        total += size
        print(f"{name}.webp {card.size[0]}x{card.size[1]} {size // 1024} KB（原画の左右を {cut:.0f}px ずつ切った）")
    print(f"計 {len(NAMES)} 枚 {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
