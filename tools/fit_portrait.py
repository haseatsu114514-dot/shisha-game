#!/usr/bin/env python3
"""作り直した立ち絵の原画を、ゲーム用の 896x1200 透過PNGに合わせる（縮小と配置だけ・描き直しはしない）。

いまの採用済みPNG（同じキャラ・同じ表情）と、人物の高さ・足元の下端・横位置（不透明部分の重心）を
そろえるので、ゲーム内の身長・立ち位置は変わらない。頭の大きさ・画風の違いだけが入れ替わる。

使い方:
    # 確認用（ゲームの素材は触らない）。比較画像も作る
    python3 tools/fit_portrait.py asset_sources/portraits/tsumugi-remaster-v2/normal-source.png tsumugi normal
    # 採用が決まったら、ゲームの素材へ書き込む
    python3 tools/fit_portrait.py <source.png> <id> <face> --apply

出力:
    asset_sources/portraits/<id>-remaster-v2/<face>-preview.png   896x1200（--apply ならこれを assets へ複製）
    asset_sources/portraits/<id>-remaster-v2/<face>-compare.png   いま／新しい を並べた確認画像
"""
import argparse
import hashlib
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SPRITES = ROOT / "assets/sprites/characters"
W, H = 896, 1200


def bbox(im):
    return im.getchannel("A").point(lambda v: 255 if v >= 16 else 0).getbbox()


def mass_x(im):
    a = im.getchannel("A").resize((im.width // 4, im.height // 4), Image.NEAREST)
    getter = getattr(a, "get_flattened_data", a.getdata)
    tot = sx = 0
    for i, v in enumerate(getter()):
        if v > 128:
            tot += 1
            sx += i % a.width
    return sx / tot * 4 if tot else im.width / 2


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("id")
    ap.add_argument("face")
    ap.add_argument("--apply", action="store_true", help="assets/sprites/characters へ書き込む")
    args = ap.parse_args()

    cur_path = SPRITES / args.id / f"chr_{args.id}_{args.face}.png"
    cur = Image.open(cur_path).convert("RGBA") if cur_path.exists() else None
    src = Image.open(args.source).convert("RGBA")
    if src.getchannel("A").getextrema()[0] == 255:
        sys.exit("原画に透過が無い（背景つき）。透過PNGで受け取り直す")

    cb, sb = bbox(cur) if cur else None, bbox(src)
    if sb is None:
        sys.exit("原画に人物が見つからない")
    fig = src.crop(sb)
    target_h = cb[3] - cb[1] if cb else 1160
    if fig.height < target_h:
        print(f"WARN: 原画の人物 {fig.height}px がゲーム用 {target_h}px より小さい（引き伸ばしになる）。1300px以上で作り直すのが望ましい")
    s = target_h / fig.height
    fig = fig.resize((max(1, round(fig.width * s)), target_h), Image.LANCZOS)

    # 足元の下端と、不透明部分の重心の横位置をいまの立ち絵に合わせる
    cur_cx = mass_x(cur) if cur else W / 2
    fig_cx = mass_x(fig)
    x = round(cur_cx - fig_cx)
    y = cb[3] - fig.height if cb else H - 20 - fig.height
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.alpha_composite(fig, (x, y))
    ob = bbox(out)
    if ob is None or ob[0] <= 0 or ob[2] >= W or ob[1] <= 0:
        print("WARN: 896x1200 の端で人物が切れている。原画の構図（腕・小物の広がり）を確認する")

    dest_dir = ROOT / "asset_sources/portraits" / f"{args.id}-remaster-v2"
    dest_dir.mkdir(parents=True, exist_ok=True)
    preview = dest_dir / f"{args.face}-preview.png"
    out.save(preview, optimize=True)

    # 比較画像: いま | 新しい（同じ縮尺・同じ足元）
    pad = 20
    comp = Image.new("RGB", (W * 2 + pad * 3, H + 70), (32, 36, 44))
    for i, im in enumerate([cur, out]):
        if im is None:
            continue
        tile = Image.new("RGBA", (W, H), (44, 48, 58, 255))
        tile.alpha_composite(im)
        comp.paste(tile.convert("RGB"), (pad + i * (W + pad), 50))
    d = ImageDraw.Draw(comp)
    d.text((pad, 16), f"{args.id} {args.face}: current (left) / new (right)", fill=(230, 230, 230))
    comp.save(dest_dir / f"{args.face}-compare.png", optimize=True)

    print(f"preview: {preview.relative_to(ROOT)}  人物 {target_h}px（原画 {sb[3]-sb[1]}px から {s:.2f}倍）")
    print(f"compare: {(dest_dir / f'{args.face}-compare.png').relative_to(ROOT)}")
    if args.apply:
        cur_path.parent.mkdir(parents=True, exist_ok=True)
        if cur_path.exists():
            prev_dir = dest_dir / "previous-runtime"
            prev_dir.mkdir(exist_ok=True)
            if not (prev_dir / cur_path.name).exists():
                shutil.copy2(cur_path, prev_dir / cur_path.name)
        shutil.copy2(preview, cur_path)
        print(f"applied: {cur_path.relative_to(ROOT)}  sha256 {sha(cur_path)}")
        print("次に: python3 remake/tools/build_manifest.py / python3 tools/make_face_icons.py "
              f"{args.id} / python3 tools/make_reference_sheet.py {args.id} facesize lineup")


if __name__ == "__main__":
    main()
