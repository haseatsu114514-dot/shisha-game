#!/usr/bin/env python3
"""地図のモード切り替えボタンの配置モック（AA26: 押すたびに入れ替わる1つのボタン）。

今のマップ画面のスクリーンショットに、既存のパネル素材で仮のボタンを重ねる。
右上のHUD（体力の札）の左に、ほかのHUDボタンと同じ大きさの正方形ボタンを1つ置く。
ボタンには今のモードのアイコンを出し、右下に「押すと入れ替わる」印を付ける。
見るのは置き場所と大きさだけ。本番の絵は Codex に発注する（docs/codex_handoff_city_images.md の発注E）。

使い方: python3 asset_sources/ui/map-mode-toggle-20261009/build_mock.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
SHOT = ROOT / "asset_sources/ui/compact-gains-map-20261008/map-1331.png"
PANEL = ROOT / "assets/ui/lounge/panel.png"
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
GOLD = (244, 210, 122)

# 1331x760 のスクリーンショット上の位置。右上の体力の札（x≈936〜）の左、HUDの正方形ボタンと同じ大きさ
BOX = (874, 22, 926, 70)


def plate(w, h, bright=1.0):
    im = Image.open(PANEL).convert("RGBA")
    im = im.crop(im.getbbox()).resize((w, h), Image.LANCZOS)
    if bright != 1.0:
        im = ImageEnhance.Brightness(im).enhance(bright)
    return im


def icon_fast(d, cx, cy, col):
    # 速さの線を引いたマップピン
    for i, dy in enumerate((-5, 0, 5)):
        d.line([cx - 15 + i * 2, cy + dy, cx - 6, cy + dy], fill=col, width=2)
    d.ellipse([cx - 4, cy - 12, cx + 12, cy + 4], fill=col)
    d.polygon([(cx - 3, cy - 1), (cx + 11, cy - 1), (cx + 4, cy + 12)], fill=col)
    d.ellipse([cx + 1, cy - 7, cx + 7, cy - 1], fill=(30, 20, 34))


def icon_explore(d, cx, cy, col):
    # 足あと2つ
    for ox, oy in ((-6, 5), (6, -5)):
        d.ellipse([cx + ox - 5, cy + oy - 9, cx + ox + 5, cy + oy + 4], fill=col)
        d.ellipse([cx + ox - 4, cy + oy + 5, cx + ox + 4, cy + oy + 11], fill=col)


def swap_badge(d, cx, cy):
    # 右下の「押すと入れ替わる」印（丸の中に回る2本の矢印）
    r = 8
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(20, 14, 26), outline=GOLD, width=1)
    d.arc([cx - 5, cy - 5, cx + 5, cy + 5], 200, 340, fill=GOLD, width=2)
    d.arc([cx - 5, cy - 5, cx + 5, cy + 5], 20, 160, fill=GOLD, width=2)
    d.polygon([(cx + 5, cy - 4), (cx + 7, cy + 1), (cx + 2, cy)], fill=GOLD)
    d.polygon([(cx - 5, cy + 4), (cx - 7, cy - 1), (cx - 2, cy)], fill=GOLD)


def mock(mode):
    base = Image.open(SHOT).convert("RGBA")
    x0, y0, x1, y1 = BOX
    base.alpha_composite(plate(x1 - x0, y1 - y0, 1.15), (x0, y0))
    d = ImageDraw.Draw(base)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    (icon_fast if mode == "fast" else icon_explore)(d, cx - 1, cy - 1, GOLD)
    swap_badge(d, x1 - 4, y1 - 4)
    # 押した直後と、指やマウスを乗せたときだけ出す名前
    f = ImageFont.truetype(FONT, 13)
    label = "ファストトラベル" if mode == "fast" else "探索"
    tw = d.textlength(label, font=f)
    d.rectangle([cx - tw / 2 - 7, y1 + 7, cx + tw / 2 + 7, y1 + 27], fill=(14, 9, 19), outline=(150, 120, 70))
    d.text((cx, y1 + 17), label, fill=GOLD, font=f, anchor="mm")
    note = "押すたびに入れ替わる1つのボタン（仮の見た目）"
    nf = ImageFont.truetype(FONT, 15)
    nw = d.textlength(note, font=nf)
    nx, ny = x1 - nw, y1 + 36
    d.rectangle([nx - 8, ny - 4, nx + nw + 8, ny + 22], fill=(255, 64, 160))
    d.text((nx, ny), note, fill=(255, 255, 255), font=nf)
    return base.convert("RGB")


if __name__ == "__main__":
    mock("fast").save(HERE / "placement_fast.png", optimize=True)
    mock("explore").save(HERE / "placement_explore.png", optimize=True)
    print("wrote", HERE.relative_to(ROOT))
