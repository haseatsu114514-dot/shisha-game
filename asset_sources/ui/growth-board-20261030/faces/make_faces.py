#!/usr/bin/env python3
"""心得の盤の授業の札の顔（SBD81「キャラアイコンの拡大率がバラバラで整えたい」）。

顔アイコン（ui/face_icons）は人ごとに顔の大きさ・高さが違い、札の中で拡大率がそろわなかった。
立ち絵（chr_<人>_normal）から、目の高さと顔の大きさをそろえて正方形に切り出す。

2026-11-06（顔アイコンを新バージョンの立ち絵に合わせる）: 目で測った値の表（EYES）をやめ、顔アイコンと同じ
data/portrait_metrics.json の記録（目・あご・頭頂・頬）から切り出す。表の値は描き直し前の立ち絵で測ったままの人
（みんと・レヰ・組長・スティーブ・ヴォルク・ダ・シルヴァ）がいて、旧デザインの顔が残っていた。顔の幅の取り方も
人ごとに頬の幅の0.93〜1.24倍とばらばらだった。顔の大きさは顔アイコンと同じ √(頭の高さ×頬の幅) で決め、
FACE_PER_UNIT は以前の表の平均（オーナー確認済みの寄り具合 SBD87・SBD88 を保つ）。
新バージョンの立ち絵を測った人は、その絵からも作る（faces/new/<人>.webp。盤は設定の画風に合わせて出す）。

  python3 asset_sources/ui/growth-board-20261030/faces/make_faces.py [--sheet]
  → remake/img/ui/growth_board/faces/<人>.webp と faces/new/<人>.webp（160×160）
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
METRICS = ROOT / "data" / "portrait_metrics.json"
OUT = ROOT / "remake" / "img" / "ui" / "growth_board" / "faces"
SIZE = 160
SIDE_PER_FACE = 2.0   # 切り出す正方形の一辺 ÷ 顔の幅（SBD87 で 2.6→1.75、SBD88「アダムとかは拡大しすぎ」で 2.0）
FACE_PER_UNIT = 0.87  # 顔の幅 ÷ 顔の大きさ √(頭の高さ×頬の幅)（remake/js/daily/growth-board-screen.js の BOARD_FACE_PER_UNIT と同じ）
EYE_AT = 0.44         # 切り出した正方形の上から目の高さまでの割合（ふつう）
EYE_AT_MAX = 0.5      # 頭を入れるために目を下げてよい上限
HEAD_ROOM = 0.02      # 頭のてっぺん（髪・角・帽子）の上に残す余白（一辺に対する比）
# 札では金の枠が顔の上に重なるので（SBD87）、髪の先が枠の下に隠れるのは切れて見えない。目は下げすぎない（SBD84 の頭切れは EYE_AT_MAX までで受ける）

# 授業を教える人（growth-board-screen.js の BOARD_FACES と同じ）
WHO = ("sumi", "minto", "adam", "tsumugi", "naru", "rei", "ageha", "kumicho", "saku", "steve", "volk", "rio",
       "hiyori", "samechan", "mashiro", "sheikh", "da_silva", "hajime", "master_hookah", "dr_kemuri")
SPRITES = {"classic": ROOT / "assets" / "sprites" / "characters", "new": ROOT / "assets" / "sprites" / "character_variants" / "new"}


def eyes(entry):
    """[顔の中央 x（頬の中央）, 目の高さ y, 顔の幅]。立ち絵（896×1200）の画素"""
    (lx, ly), (rx, ry) = entry["eyes"]
    head = entry["chin"][1] - entry["crown"][1]
    cheek = entry["cheeks"][1] - entry["cheeks"][0]
    return (entry["cheeks"][0] + entry["cheeks"][1]) / 2, (ly + ry) / 2, (head * cheek) ** 0.5 * FACE_PER_UNIT


def head_top(im, ex, ey, fw):
    """顔の上（目の横 ±顔の幅）で、いちばん上に絵がある行。髪・角・帽子・フードを含む"""
    a = im.getchannel("A")
    x0, x1 = max(0, int(ex - fw)), min(im.width, int(ex + fw))
    for y in range(0, int(ey)):
        if sum(1 for v in a.crop((x0, y, x1, y + 1)).get_flattened_data() if v > 60) >= 3:
            return y
    return 0


def crop(im, entry):
    ex, ey, fw = eyes(entry)
    side = round(fw * SIDE_PER_FACE)
    top = head_top(im, ex, ey, fw)
    eye_at = min(EYE_AT_MAX, max(EYE_AT, (ey - top) / side + HEAD_ROOM))
    x0, y0 = round(ex - side / 2), round(ey - side * eye_at)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im.crop((max(0, x0), max(0, y0), x0 + side, y0 + side)), (max(0, -x0), max(0, -y0)))
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    metrics = json.loads(METRICS.read_text(encoding="utf-8"))
    done = []
    for style, root in SPRITES.items():
        found = metrics["characters"] if style == "classic" else metrics.get("styles", {}).get(style, {})
        out = OUT if style == "classic" else OUT / style
        out.mkdir(parents=True, exist_ok=True)
        for who in WHO:
            entry, src = found.get(who), root / who / f"chr_{who}_normal.png"
            if not entry or "eyes" not in entry or not src.exists():
                if style == "classic":
                    sys.exit(f"{who}: 現行の立ち絵か顔の位置の記録が無い")
                continue      # 新バージョンの立ち絵が無い・測っていない人は、盤でも現行の顔を出す
            if src.read_bytes()[:7] == b"version":
                sys.exit(f"{src.relative_to(ROOT)} は Git LFS のポインタ。git lfs pull --include=\"{src.relative_to(ROOT)}\" で実体を取る")
            im = crop(Image.open(src).convert("RGBA"), entry)
            dest = out / f"{who}.webp"
            im.save(dest, "WEBP", quality=88, method=6)
            done.append((f"{style}/{who}", im, dest))
    print(f"{len(done)} faces, total {sum(d.stat().st_size for _, _, d in done) // 1024}KB")
    if "--sheet" in sys.argv:
        cols, cell = 8, SIZE + 10
        sheet = Image.new("RGB", (cols * cell, ((len(done) + cols - 1) // cols) * (cell + 14)), (28, 22, 36))
        d = ImageDraw.Draw(sheet)
        for i, (who, im, _) in enumerate(done):
            x, y = (i % cols) * cell, (i // cols) * (cell + 14)
            sheet.paste(im, (x, y), im)
            d.text((x + 2, y + SIZE + 1), who, fill=(244, 210, 122))
        sheet.save(HERE / "contact_sheet.png")
        print("contact_sheet.png written")


if __name__ == "__main__":
    sys.exit(main())
