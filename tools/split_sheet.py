#!/usr/bin/env python3
"""立ち絵シート（横に5表情並び・単色背景）を分割して透過済み立ち絵にする。

pixelize.py と違い、ドット化・減色はせず**元解像度のまま**処理する
（生成画像が最初からドット絵調の場合はこちらを使う）。

やること:
  1. クロマキー透過（背景色は四隅から自動検出。緑・マゼンタどちらでも可）
  2. 透過後の「何もない縦の隙間」でキャラごとに自動分割（等幅でなくてもOK）
  3. 全コマを同じキャンバス（シートと同じ高さ・最大コマ幅）の下端中央に配置
     → 表情を切り替えても立ち位置・サイズがズレない
  4. assets/sprites/characters/{id}/chr_{id}_{face}.png に保存

使い方:
  # 5表情シートをつむぎの立ち絵として取り込む（表情名はシートの並び順）
  python3 tools/split_sheet.py sheet.png --char tsumugi \
      --names normal,surprise,sad,serious,smile

  # 取り込み後はビルドで反映
  python3 web/build_data.py && python3 web/build_standalone.py
  # 顔アイコンも作り直す場合
  python3 tools/make_face_icons.py

オプション:
  --names a,b,c,d,e   各コマの face 名（左から順）。省略時は
                      normal,smile,surprise,sad,serious
  --cols N            自動分割がうまくいかない時、等幅N分割に切り替える
  --key auto|none|#RRGGBB  背景色（既定: auto）
  --tolerance N       クロマキーの許容量（既定: 70）
  --margin N          コマの左右余白px（既定: 16）
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixelize import chroma_key, detect_key_color, parse_color  # noqa: E402

from PIL import Image  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_NAMES = ["normal", "smile", "surprise", "sad", "serious"]
VALID_FACES = {"normal", "smile", "surprise", "sad", "serious", "smug", "wink", "evil", "excited", "shy", "focus"}


def find_columns(im: Image.Image, expected: int):
    """透過済み画像をアルファの縦投影で分割し、コマの(x0,x1)リストを返す。"""
    alpha = im.getchannel("A")
    w, h = im.size
    # 各列に不透明ピクセルがあるか
    cols = []
    px = alpha.load()
    for x in range(w):
        opaque = any(px[x, y] > 8 for y in range(0, h, 3))
        cols.append(opaque)
    # 連続した不透明区間を拾う
    runs = []
    start = None
    for x, on in enumerate(cols + [False]):
        if on and start is None:
            start = x
        elif not on and start is not None:
            runs.append((start, x))
            start = None
    # ゴミ（幅が極端に狭い区間）を除外
    min_w = max(8, w // 100)
    runs = [r for r in runs if r[1] - r[0] >= min_w]
    if expected and len(runs) > expected:
        runs.sort(key=lambda r: r[1] - r[0], reverse=True)
        runs = sorted(runs[:expected])
    return runs


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("--char", required=True, help="キャラID（characters.json の id）")
    ap.add_argument("--names", help="各コマのface名（左から）。既定: " + ",".join(DEFAULT_NAMES))
    ap.add_argument("--cols", type=int, help="等幅N分割に切り替える")
    ap.add_argument("--key", default="auto", help="auto / none / #RRGGBB")
    ap.add_argument("--tolerance", type=int, default=70)
    ap.add_argument("--margin", type=int, default=16)
    args = ap.parse_args()

    names = [n.strip() for n in (args.names.split(",") if args.names else DEFAULT_NAMES)]
    unknown = [n for n in names if n not in VALID_FACES and n != "skip"]
    if unknown:
        print(f"WARN: 未知のface名 {unknown}（dialogue JSON で使う face と一致させること）")

    im = Image.open(args.input).convert("RGBA")
    if args.key != "none":
        key = detect_key_color(im) if args.key == "auto" else parse_color(args.key)
        print(f"key color: #{key[0]:02x}{key[1]:02x}{key[2]:02x}")
        im = chroma_key(im, key, tolerance=args.tolerance)

    if args.cols:
        cw = im.width // args.cols
        runs = [(i * cw, (i + 1) * cw) for i in range(args.cols)]
    else:
        runs = find_columns(im, len(names))
    if len(runs) != len(names):
        sys.exit(
            f"分割数が合いません: 検出 {len(runs)} コマ / 指定 {len(names)} 表情。"
            " --cols で等幅分割を試すか --names を合わせてください"
        )

    # 全コマ共通のキャンバス: 最大コマ幅 + 余白、高さはシートと同じ
    # （シート内で頭の高さ・足元が揃っている前提を活かして位置ズレを防ぐ）
    canvas_w = max(x1 - x0 for x0, x1 in runs) + args.margin * 2
    out_dir = REPO_ROOT / "assets" / "sprites" / "characters" / args.char
    out_dir.mkdir(parents=True, exist_ok=True)

    for (x0, x1), name in zip(runs, names):
        if name in ("", "skip"):
            continue
        cell = im.crop((x0, 0, x1, im.height))
        canvas = Image.new("RGBA", (canvas_w, im.height), (0, 0, 0, 0))
        canvas.paste(cell, ((canvas_w - cell.width) // 2, 0))
        out_path = out_dir / f"chr_{args.char}_{name}.png"
        canvas.save(out_path)
        print(f"wrote {out_path} ({canvas.width}x{canvas.height})")

    print("done. 反映: python3 web/build_data.py && python3 web/build_standalone.py")


if __name__ == "__main__":
    main()
