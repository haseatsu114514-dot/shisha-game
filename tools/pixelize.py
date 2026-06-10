#!/usr/bin/env python3
"""画像生成AIの出力をゲーム用アセットに変換する統一処理スクリプト。

やること（順番に全部自動）:
  1. クロマキー透過   — 単色背景(マゼンタ推奨)を高解像度のまま除去
  2. 余白トリム       — 透過部分を切り落とす
  3. ドット化         — 共通グリッドに縮小してから等倍拡大（粒度が全画像で揃う）
  4. 減色             — 共通の色数に量子化（パレットの質感が揃う）
  5. グリッド分割     — 表情シート(3x2等)を1枚ずつに切り出して命名

使い方の例:
  # 表情シート(横3x縦2)を5表情に分割してキャラフォルダへ出力
  python3 tools/pixelize.py sheet.png --char hajime --slice 3x2 \
      --names normal,smile,sad,serious,surprise

  # 1枚絵の立ち絵を変換
  python3 tools/pixelize.py art.png --out assets/sprites/characters/hajime/chr_hajime_normal.png

  # 背景(透過不要)を粒度だけ揃える
  python3 tools/pixelize.py bg.png --key none --grid 360 \
      --out assets/backgrounds/bg_tournament_stage.png

主なオプション:
  --key auto|none|#RRGGBB  背景色。auto=四隅の色を自動検出(既定)
  --grid N                 ドット化の基準高さ(px)。立ち絵300/背景360が目安
  --scale N                ドットの拡大倍率(既定4 → 出力は grid*4 px)
  --colors N               減色後の色数(既定64)
  --slice CxR              横C×縦Rのシートとして分割
  --names a,b,c            分割した各マスのファイル名(face名)。空欄マスは skip と書く
  --char ID                出力先を assets/sprites/characters/ID/chr_ID_{face}.png にする
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageFilter

REPO_ROOT = Path(__file__).resolve().parent.parent


def parse_color(s: str):
    s = s.lstrip("#")
    return tuple(int(s[i : i + 2], 16) for i in (0, 2, 4))


def detect_key_color(im: Image.Image):
    """四隅のピクセルの多数決で背景色を推定する。"""
    w, h = im.size
    corners = [im.getpixel((x, y))[:3] for x, y in [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]]
    corners.sort()
    return corners[len(corners) // 2]


def chroma_key(im: Image.Image, key, tolerance=60, despill=True) -> Image.Image:
    """高解像度のままクロマキー。

    エッジの半透明ピクセルは「元色 = 描画色×α + 背景色×(1-α)」を逆算して
    背景色成分を取り除く（アンミックス）ので、フチに色かぶりが残らない。
    """
    im = im.convert("RGBA")
    px = im.load()
    kr, kg, kb = key
    t0 = tolerance          # ここまでは完全に背景
    t1 = tolerance * 2.6    # ここからは完全に前景
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = ((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2) ** 0.5
            if d <= t0:
                px[x, y] = (0, 0, 0, 0)
            elif d < t1:
                alpha = (d - t0) / (t1 - t0)
                if despill:
                    inv = 1.0 - alpha
                    r = int(min(255, max(0, (r - kr * inv) / alpha)))
                    g = int(min(255, max(0, (g - kg * inv) / alpha)))
                    b = int(min(255, max(0, (b - kb * inv) / alpha)))
                px[x, y] = (r, g, b, min(a, int(255 * alpha)))
    # 輪郭を2px侵食して、背景色が混ざったエッジのリングごと落とす
    # （高解像度段階なのでドット化後の見た目には影響しない）
    alpha_ch = im.getchannel("A")
    for _ in range(2):
        alpha_ch = alpha_ch.filter(ImageFilter.MinFilter(3))
    im.putalpha(alpha_ch)
    return im


def trim(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def pixelize(im: Image.Image, grid_h: int, scale: int, colors: int) -> Image.Image:
    """縮小→減色→等倍拡大で、粒度と色数を統一する。"""
    if im.height > grid_h:
        small = im.resize((max(1, round(im.width * grid_h / im.height)), grid_h), Image.LANCZOS)
    else:
        small = im
    has_alpha = small.mode == "RGBA"
    if has_alpha:
        alpha = small.getchannel("A")
        rgb = small.convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT).convert("RGB")
        small = rgb.convert("RGBA")
        small.putalpha(alpha)
        # 半端な半透明ピクセルを整理（ドット絵はパキッとさせる）
        small.putalpha(alpha.point(lambda v: 0 if v < 90 else 255))
    else:
        small = small.quantize(colors=colors, method=Image.MEDIANCUT).convert("RGB")
    return small.resize((small.width * scale, small.height * scale), Image.NEAREST)


def process_one(im: Image.Image, args) -> Image.Image:
    if args.key != "none":
        key = detect_key_color(im.convert("RGBA")) if args.key == "auto" else parse_color(args.key)
        im = chroma_key(im, key, tolerance=args.tolerance)
        im = trim(im)
    return pixelize(im, args.grid, args.scale, args.colors)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("--out", help="出力パス(単体変換時)")
    ap.add_argument("--key", default="auto", help="auto / none / #RRGGBB")
    ap.add_argument("--tolerance", type=int, default=70)
    ap.add_argument("--grid", type=int, default=300, help="ドット化の基準高さpx")
    ap.add_argument("--scale", type=int, default=4)
    ap.add_argument("--colors", type=int, default=64)
    ap.add_argument("--slice", help="例: 3x2 (横3マス×縦2マス)")
    ap.add_argument("--names", help="分割マスのface名。例: normal,smile,sad,serious,surprise")
    ap.add_argument("--char", help="キャラID。出力先とファイル名を自動にする")
    args = ap.parse_args()

    src = Image.open(args.input).convert("RGBA")

    if args.slice:
        cols, rows = (int(v) for v in args.slice.lower().split("x"))
        names = (args.names or "").split(",") if args.names else []
        if not names:
            sys.exit("--slice には --names で各マスの名前を指定してください")
        if not args.char and not args.out:
            sys.exit("--char か --out で出力先を指定してください")
        cw, ch = src.width // cols, src.height // rows
        idx = 0
        for r in range(rows):
            for c in range(cols):
                if idx >= len(names):
                    break
                name = names[idx].strip()
                idx += 1
                if name in ("", "skip"):
                    continue
                cell = src.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
                out_im = process_one(cell, args)
                if args.char:
                    out_dir = REPO_ROOT / "assets" / "sprites" / "characters" / args.char
                    out_dir.mkdir(parents=True, exist_ok=True)
                    out_path = out_dir / f"chr_{args.char}_{name}.png"
                else:
                    out_path = Path(args.out).with_name(f"{Path(args.out).stem}_{name}.png")
                out_im.save(out_path)
                print(f"wrote {out_path} ({out_im.width}x{out_im.height})")
        return

    out_im = process_one(src, args)
    if args.char:
        out_dir = REPO_ROOT / "assets" / "sprites" / "characters" / args.char
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"chr_{args.char}_normal.png"
    elif args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
    else:
        out_path = Path(args.input).with_name(Path(args.input).stem + "_px.png")
    out_im.save(out_path)
    print(f"wrote {out_path} ({out_im.width}x{out_im.height})")


if __name__ == "__main__":
    main()
