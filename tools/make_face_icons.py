#!/usr/bin/env python3
"""立ち絵から顔ドット絵アイコンを生成する。

assets/sprites/characters/{id}/chr_{id}_normal.png の頭部を切り出し、
160x160 に縮小 → 256色に減色した顔アイコンにする。
出力: assets/ui/face_icons/face_{id}.png
（UIの好感度バナー・マップピン・LIME画面のアバターに使う）

使い方:
    python3 tools/make_face_icons.py            # 全キャラ生成
    python3 tools/make_face_icons.py --sheet    # 確認用シートも出力
    python3 tools/make_face_icons.py rin samechan # 指定キャラだけ生成（立ち絵を差し替えたキャラだけ更新する）
"""

import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
CHARS_DIR = REPO_ROOT / "assets" / "sprites" / "characters"
OUT_DIR = REPO_ROOT / "assets" / "ui" / "face_icons"

SIZE = 160         # 解像度（2026-10-04 オーナー指定で48→96→160。顔の切り抜きは元絵で約180〜240pxなので、これ以上は拡大になる）
COLORS = 256       # パレット色数（32色では瞳の色・肌の階調が潰れた）

# 頭部クロップの調整値。
# 立ち絵（透過スプライト）は「頭部スライスの重心」を顔の中心とみなし、
# コンテンツ高さ ch に対する比 f で正方形の辺を決める（bbox幅基準だと
# ツインテール・広げた腕などで拡大率がキャラごとにバラつくため・2026-07-02）。
#   f:  辺 = ch * f（大きいほど引き＝顔が小さく写る）
#   dx/dy: 辺に対する比での微調整（+で右/下）
#   size: そのキャラだけ解像度を変える（既定は SIZE）
# 背景込み一枚絵のキャラは abs 指定（画像全体に対する顔中心 cx/cy と辺 side の比）。
DEFAULT = {"f": 0.20, "dx": 0.0, "dy": 0.0}
TUNE = {
    "hiyori": {"abs": True, "cx": 0.46, "cy": 0.23, "side": 0.18},
    # 2026-10-31 上げた腕で頭部の重心がずれ、顔が端に寄っていた（SBD83）。立ち絵の顔（目 x453・y80、頬幅99px）に合わせる
    "da_silva": {"abs": True, "cx": 0.506, "cy": 0.08, "side": 0.165},  # 採用立ち絵の顔を中央に合わせ、髪の余白を保つ。
    # マスコット。2026-10-09 に目・口・蝶ネクタイまで寄せたが、頭の巻き毛が切れたため（#575）、巻き毛の先から蝶ネクタイまで収める
    "pakki":   {"f": 0.70, "dx": -0.03, "dy": 0.12},
    # 2026-10-04 顔の大きさを全キャラで揃える（オーナー「顔のサイズ近くなるように」）。
    # 目の下の頬の幅がアイコン幅の約0.50になるよう、目線の位置（横0.5・縦0.55）を固定して拡大縮小した値。
    # 立ち絵を差し替えたら、頬の幅を測り直して f を比例で直す（f_new = f_old × 測った幅 / 0.50）
    "adam": {"f": 0.188, "dy": 0.03},
    "ageha": {"f": 0.228, "dy": 0.058},
    "dr_kemuri": {"f": 0.173, "dx": -0.059, "dy": 0.04},
    "hajime": {"f": 0.186, "dx": -0.051, "dy": 0.081},
    # 2026-10-10 立ち絵そろえ: 新原画の頬幅・目線で切り抜きを再調整。
    # つむぎの元の頭身、ましろの大きめの丸い顔は全身側で保持する。
    "samechan": {"f": 0.192, "dx": -0.093, "dy": 0.295},
    "maezono": {"f": 0.215, "dx": -0.038, "dy": -0.059},
    "mashiro": {"f": 0.230, "dy": 0.068},
    "minto": {"f": 0.213, "dy": 0.101},
    "minto_private": {"f": 0.214, "dy": 0.089},
    "nagumo": {"f": 0.169, "dx": -0.055, "dy": 0.068},
    "naru": {"f": 0.18, "dy": 0.052},
    "rin": {"f": 0.188, "dx": 0.011, "dy": 0.158},
    "sumi": {"f": 0.182, "dx": -0.038, "dy": 0.011},
    "tsumugi": {"f": 0.218, "dx": -0.045, "dy": 0.143},
}
# 別衣装のアイコン: 出力名 → (キャラのフォルダ, 表情)。
# minto_private = 本名「栞」を聞いた後の私的な場面（LIME・恋人の絆）で使う私服の顔
EXTRA = {"minto_private": ("minto", "ura_normal")}
# 頭部重心を取るスライス（bbox上端からコンテンツ高さのこの比率まで）
HEAD_SLICE = 0.14
# 円形アイコンで頭が切れないよう、上に持たせる余白（辺に対する比）
HEADROOM = 0.08
# 頭のてっぺんの上に必ず残す余白（辺に対する比。SBD84）
HEAD_ROOM = 0.03
# 頭を入れるために下へずらしてよい量（辺に対する比）。これより多く要る時は少し引いて顔を小さくする
MAX_SHIFT = 0.10


def face_box(char_id: str, im: Image.Image) -> tuple[int, int, int] | None:
    """顔アイコンの切り抜き枠 (x0, y0, side) を返す。TUNE で顔の大きさを全キャラ揃えてある。
    tools/make_reference_sheet.py も同じ枠を使い、シートの顔アップの大きさをアイコンと揃える。"""
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
    # 頭のてっぺん（髪・角・帽子・フード）を切らない（2026-10-31 オーナー「アイコンが上の頭切れてる」SBD84）。
    # 枠の左右の範囲で、いちばん上に絵がある行より HEAD_ROOM だけ上から始める。顔の大きさ（side）は変えず、下へずらすだけ
    alpha = im.getchannel("A")
    span = alpha.crop((max(0, x0 + side // 6), 0, min(im.width, x0 + side * 5 // 6), max(1, y0 + side // 2)))
    rows = [y for y in range(span.height) if sum(1 for v in span.crop((0, y, span.width, y + 1)).get_flattened_data() if v > 60) >= 3]
    if rows and not p.get("allow_cut"):
        head = rows[0]
        need = y0 - (head - side * HEAD_ROOM)          # 頭を入れるのに上へ広げたい量
        if need > 0:
            shift = min(need, side * MAX_SHIFT)        # まずは少しだけ下へずらす
            y0 -= int(shift)
            if need > shift:                           # それでも入らない時は、顔の真ん中を軸に少し引く
                cx, cy = x0 + side / 2, y0 + side / 2
                side = int((cy - head) / (0.5 - HEAD_ROOM)) + 1
                x0, y0 = int(cx - side / 2), int(cy - side / 2)
    return x0, y0, side


def make_icon(char_id: str, src: Path) -> Image.Image | None:
    im = Image.open(src).convert("RGBA")
    box = face_box(char_id, im)
    if box is None:
        return None
    x0, y0, side = box
    p = {**DEFAULT, **TUNE.get(char_id, {})}
    crop = im.crop((x0, y0, x0 + side, y0 + side))
    # 縮小 → 減色（αは別管理: quantizeで半透明が荒れるのを防ぐ。輪郭は二値化せず滑らかに残す）
    size = p.get("size", SIZE)
    small = crop.resize((size, size), Image.LANCZOS)
    alpha = small.getchannel("A")
    rgb = small.convert("RGB").quantize(colors=COLORS, method=Image.MEDIANCUT)
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


SOURCES = OUT_DIR / "sources.json"


def sprite_blob(src: Path) -> str:
    """立ち絵の git 上の版（ls-files の blob SHA）。未登録なら中身の hash-object"""
    rel = str(src.relative_to(REPO_ROOT))
    out = subprocess.run(["git", "ls-files", "-s", "--", rel], cwd=REPO_ROOT, capture_output=True, text=True).stdout.split()
    if len(out) >= 2:
        return out[1]
    return subprocess.run(["git", "hash-object", rel], cwd=REPO_ROOT, capture_output=True, text=True).stdout.strip()


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    icons = {}
    sources = json.loads(SOURCES.read_text(encoding="utf-8")) if SOURCES.exists() else {}
    only = {a for a in sys.argv[1:] if not a.startswith("--")}
    jobs = []
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
        jobs.append((cid, cid, src))
        jobs += [(name, cid, char_dir / f"chr_{cid}_{face}.png")
                 for name, (folder, face) in EXTRA.items() if folder == cid]
    for cid, folder, src in jobs:
        if only and cid not in only and folder not in only:
            continue
        icon = make_icon(cid, src)
        if icon is None:
            print(f"skip {cid} (empty bbox)")
            continue
        dest = OUT_DIR / f"face_{cid}.png"
        icon.save(dest, optimize=True)
        icons[cid] = icon
        sources[f"face_{cid}.png"] = {"sprite": str(src.relative_to(REPO_ROOT)), "blob": sprite_blob(src)}
        print(f"wrote {dest} ({dest.stat().st_size:,} bytes)")
    # どの立ち絵（の版）から作ったかを残す（SBD83「旧デザインを根絶」）。立ち絵を描き直したのにアイコンを作り直し忘れると
    # remake/test/face_icons_fresh.mjs が落ちる。blob は git の登録内容（LFS ならポインタ）の SHA で、手元と CI で同じ値になる
    SOURCES.write_text(json.dumps(dict(sorted(sources.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

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
