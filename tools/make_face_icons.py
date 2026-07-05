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

# 頭部クロップの調整値。
# 立ち絵（透過スプライト）は「頭部スライスの重心」を顔の中心とみなし、
# コンテンツ高さ ch に対する比 f で正方形の辺を決める（bbox幅基準だと
# ツインテール・広げた腕などで拡大率がキャラごとにバラつくため・2026-07-02）。
#   f:  辺 = ch * f（大きいほど引き＝顔が小さく写る）
#   dx/dy: 辺に対する比での微調整（+で右/下）
# 背景込み一枚絵のキャラは abs 指定（画像全体に対する顔中心 cx/cy と辺 side の比）。
DEFAULT = {"f": 0.20, "dx": 0.0, "dy": 0.0}
TUNE = {
    "pakki":   {"f": 0.98, "dy": 0.02},  # マスコットは全身がほぼ顔（フォルダ改名 packii→pakki に追随）
    # 顔の大きさ・目線の高さを全キャラで揃える微調整（丸アイコンでのズレ対策・2026-07-03）。
    # 髪飾り・ツインテール・帽子で bbox 上端が実際の頭より高いキャラは dy+ で下へ寄せる
    "minto":   {"f": 0.18, "dy": 0.12},   # 角ツインテールの分、顔が下に沈む
    "ageha":   {"f": 0.215, "dy": 0.09},  # お団子ツインの分。顔が大きすぎたので少し引き（2026-07-04）
    "mashiro": {"f": 0.23, "dy": 0.04},   # コンテンツ高が低く相対ズーム過多だったので引き（2026-07-04）
    "tsumugi": {"f": 0.19, "dy": 0.05},
    "hajime":  {"f": 0.19, "dx": -0.05, "dy": 0.07},  # キャップの分
    "dr_kemuri": {"f": 0.17, "dx": -0.06, "dy": 0.05},
    "rin":     {"f": 0.18, "dy": 0.04},
}
# 頭部重心を取るスライス（bbox上端からコンテンツ高さのこの比率まで）
HEAD_SLICE = 0.14
# 円形アイコンで頭が切れないよう、上に持たせる余白（辺に対する比）
HEADROOM = 0.08


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
        side = int(ch * p["f"])
        # 頭部スライス（bbox上端付近）のアルファ重心 = 顔の横中心。
        # bbox中心だと髪・腕・持ち物に引っ張られて顔が偏る
        alpha = im.getchannel("A")
        head = alpha.crop((left, top, right, top + max(1, int(ch * HEAD_SLICE))))
        hx = head.size[0] / 2
        data = list(head.getdata())
        wsum = 0
        xsum = 0.0
        hw = head.size[0]
        for i, a in enumerate(data):
            if a > 32:
                wsum += a
                xsum += (i % hw) * a
        if wsum:
            hx = xsum / wsum
        cx = left + hx + side * p["dx"]
        x0 = int(cx - side / 2)
        y0 = int(top - side * (HEADROOM - p["dy"]))
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
