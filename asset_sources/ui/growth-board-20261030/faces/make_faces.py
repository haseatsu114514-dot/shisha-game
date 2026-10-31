#!/usr/bin/env python3
"""心得の盤の授業の札の顔（SBD81「キャラアイコンの拡大率がバラバラで整えたい」）。

顔アイコン（ui/face_icons）は人ごとに顔の大きさ・高さが違い、札の中で拡大率がそろわなかった。
立ち絵（chr_<人>_normal）から、目の高さと顔の幅をそろえて正方形に切り出す。
EYES は立ち絵（896×1200）の上での [目の真ん中 x, 目の高さ y, 頬から頬の幅]。目で測った値。

  python3 asset_sources/ui/growth-board-20261030/faces/make_faces.py [--sheet]
  → remake/img/ui/growth_board/faces/<人>.webp（160×160）
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SRC = ROOT / "remake" / "img" / "sprites" / "characters"
OUT = ROOT / "remake" / "img" / "ui" / "growth_board" / "faces"
SIZE = 160
SIDE_PER_FACE = 2.6   # 切り出す正方形の一辺 ÷ 顔の幅
EYE_AT = 0.5          # 切り出した正方形の上から目の高さまでの割合（ふつう）
HEAD_ROOM = 0.04      # 頭のてっぺん（髪・角・帽子）の上に残す余白（一辺に対する比）
# 2026-10-31 オーナー「アイコンが上の頭切れてる（みんとの角など）」SBD84: 頭のてっぺんが入らない人だけ、目を下げて頭を入れる

EYES = {
    "sumi": (442, 198, 99), "minto": (492, 375, 99), "adam": (436, 218, 90), "tsumugi": (423, 433, 95),
    "naru": (454, 239, 90), "rei": (440, 97, 99), "ageha": (472, 341, 99), "kumicho": (479, 136, 112),
    "kuze": (409, 145, 95), "steve": (481, 100, 110), "volk": (459, 109, 88), "rin": (397, 290, 99),
    "hiyori": (426, 299, 104), "samechan": (448, 397, 104), "mashiro": (439, 404, 104), "sheikh": (447, 89, 88),
    "da_silva": (453, 80, 99), "hajime": (528, 263, 90),
}


def head_top(im, ex, ey, fw):
    """顔の上（目の横 ±顔の幅）で、いちばん上に絵がある行。髪・角・帽子・フードを含む"""
    a = im.getchannel("A")
    x0, x1 = max(0, int(ex - fw)), min(im.width, int(ex + fw))
    for y in range(0, int(ey)):
        if sum(1 for v in a.crop((x0, y, x1, y + 1)).get_flattened_data() if v > 60) >= 3:
            return y
    return 0


def crop(who):
    ex, ey, fw = EYES[who]
    im = Image.open(SRC / who / f"chr_{who}_normal.webp").convert("RGBA")
    side = round(fw * SIDE_PER_FACE)
    top = head_top(im, ex, ey, fw)
    eye_at = max(EYE_AT, (ey - top) / side + HEAD_ROOM)
    x0, y0 = round(ex - side / 2), round(ey - side * eye_at)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im.crop((max(0, x0), max(0, y0), x0 + side, y0 + side)), (max(0, -x0), max(0, -y0)))
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    done = []
    for who in EYES:
        im = crop(who)
        im.save(OUT / f"{who}.webp", "WEBP", quality=88, method=6)
        done.append((who, im))
    print(f"{len(done)} faces, total {sum((OUT / f'{w}.webp').stat().st_size for w, _ in done) // 1024}KB")
    if "--sheet" in sys.argv:
        cols, cell = 6, SIZE + 10
        sheet = Image.new("RGB", (cols * cell, ((len(done) + cols - 1) // cols) * (cell + 14)), (28, 22, 36))
        d = ImageDraw.Draw(sheet)
        for i, (who, im) in enumerate(done):
            x, y = (i % cols) * cell, (i // cols) * (cell + 14)
            sheet.paste(im, (x, y), im)
            d.text((x + 2, y + SIZE + 1), who, fill=(244, 210, 122))
        sheet.save(HERE / "contact_sheet.png")
        print("contact_sheet.png written")


if __name__ == "__main__":
    sys.exit(main())
