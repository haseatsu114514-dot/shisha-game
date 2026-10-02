#!/usr/bin/env python3
"""歩行スプライトシート（画像生成AIの出力・マゼンタ背景）を、ゲーム用の歩行シートに変換する。

実験ページ web/proto/walk/index.html 用（本編には未接続）。

やること:
  1. シート全体をクロマキー（tools/pixelize.py の chroma_key を再利用）
  2. 横5×縦2のグリッドに分割し、各コマから小さなゴミ（離れた点・飛沫）を除く
  3. **全コマ共通の縮小率**を決める（一番背の高いコマが指定の高さになるように）
  4. 各コマを固定サイズのセルに、**足元を下端中央に揃えて**貼る
     （1コマずつトリム＆拡縮すると、歩くたびに足元や頭身がブレるため）
  5. シート全体を1回で減色して、全コマのパレットを共通にする

入力シートの並び（画像生成プロンプトと同じ）:
  列 = 下向き / 右下向き / 右向き / 右上向き / 上向き（背中）
  行 = 歩行コマA / 歩行コマB
  左向き3方向はゲーム側で左右反転して作るので、シートには含めない。

使い方:
  python3 tools/proto_walk_sheet.py
  python3 tools/proto_walk_sheet.py asset_sources/images/proto_walk/tsumugi_walk_sheet_try2.png
  python3 tools/proto_walk_sheet.py --per-frame-fit       # コマごとに大きさがバラバラなシートを全コマ同じ高さに揃える
  python3 tools/proto_walk_sheet.py --sizes 32,40,48     # 高さ違いを確認用プレビューで比べる（ページで切り替えられるのは32と48）

出力（既定）:
  assets/proto_walk/tsumugi_walk_32.png / .json（セル24×36）
  assets/proto_walk/tsumugi_walk_48.png / .json（セル36×52）
  asset_sources/images/proto_walk/preview_walk.png（全サイズを4倍で並べた確認用。ゲームでは使わない）
"""

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixelize import chroma_key, detect_key_color, parse_color  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
DIRS = ["down", "down_right", "right", "up_right", "up"]
FRAMES = ["A", "B"]
DEFAULT_INPUT = REPO_ROOT / "asset_sources" / "images" / "proto_walk" / "tsumugi_walk_sheet.png"
DEFAULT_OUT = REPO_ROOT / "assets" / "proto_walk"
PREVIEW_PATH = REPO_ROOT / "asset_sources" / "images" / "proto_walk" / "preview_walk.png"
# キャラの高さ → セル寸法（web/proto/walk/index.html の SIZE_CELL と一致させる）
CELL_FOR = {32: (24, 36), 48: (36, 52)}
ALPHA_SOLID = 90       # これ未満の半透明は捨てる（ドット絵はパキッとさせる）
NOISE_RATIO = 0.02     # 最大の塊の2%未満の塊はゴミとして捨てる


def cell_size(height: int):
    if height in CELL_FOR:
        return CELL_FOR[height]
    return (round(height * 0.75), height + 4)


def keep_main_blobs(cell: Image.Image) -> Image.Image:
    """離れた小さな点（生成AIのゴミ・飛沫）を消す。scipy が無ければそのまま返す。"""
    try:
        import numpy as np
        from scipy import ndimage
    except ImportError:
        return cell
    arr = np.array(cell)
    mask = arr[:, :, 3] >= ALPHA_SOLID
    labels, n = ndimage.label(mask)
    if n <= 1:
        return cell
    sizes = ndimage.sum(mask, labels, index=range(1, n + 1))
    keep_ids = [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * NOISE_RATIO]
    keep = np.isin(labels, keep_ids)
    # 本体の輪郭にかかる半透明ピクセルは残す（塊から1px以内）
    keep = ndimage.binary_dilation(keep, iterations=1)
    arr[~keep, 3] = 0
    return Image.fromarray(arr, "RGBA")


def foot_center_x(cell: Image.Image) -> float:
    """足元（下から12%の行）の不透明ピクセルの横方向の重心。歩幅が違っても足元の基準がブレにくい。"""
    alpha = cell.getchannel("A")
    w, h = cell.size
    rows = max(2, round(h * 0.12))
    xs = []
    px = alpha.load()
    for y in range(h - rows, h):
        for x in range(w):
            if px[x, y] >= ALPHA_SOLID:
                xs.append(x + 0.5)
    if not xs:
        return w / 2
    return sum(xs) / len(xs)


def extract_frames(sheet: Image.Image, cols: int, rows: int):
    cw, ch = sheet.width // cols, sheet.height // rows
    frames = []
    for r in range(rows):
        for c in range(cols):
            cell = sheet.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
            cell = keep_main_blobs(cell)
            bbox = cell.getchannel("A").point(lambda v: 255 if v >= ALPHA_SOLID else 0).getbbox()
            if not bbox:
                sys.exit(f"マス (列{c + 1}, 行{r + 1}) にキャラが見つかりません。シートの並び（横{cols}×縦{rows}）を確認してください")
            crop = cell.crop(bbox)
            frames.append({"col": c, "row": r, "img": crop, "foot_x": foot_center_x(crop)})
    return frames


def build_sheet(frames, cols: int, rows: int, height: int, colors: int, per_frame_fit: bool = False):
    cw, ch = cell_size(height)
    anchor = (cw // 2, ch - 2)          # 足元の基準点（セル内座標）。足の最下段がこの行に来る
    tallest = max(f["img"].height for f in frames)
    out = Image.new("RGBA", (cw * cols, ch * rows), (0, 0, 0, 0))
    warnings = []
    for f in frames:
        src = f["img"]
        # 既定は全コマ共通の縮小率（脚を上げたコマが少し低い、などの差を残す）。
        # --per-frame-fit は生成AIがコマごとに大きさをブラした時の救済で、全コマを同じ高さにする
        scale = height / (src.height if per_frame_fit else tallest)
        w = max(1, round(src.width * scale))
        h = max(1, round(src.height * scale))
        small = src.resize((w, h), Image.LANCZOS)  # Pillow は RGBA を乗算済みで縮小する＝縁が黒ずまない
        fx = round(f["foot_x"] * scale)
        left = anchor[0] - fx
        top = anchor[1] + 1 - h
        if left < 0 or top < 0 or left + w > cw:
            warnings.append(f"{DIRS[f['col']]}/{FRAMES[f['row']]}: セルからはみ出したので切れています（{w}x{h}）")
        layer = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        layer.paste(small, (left, top), small)
        out.alpha_composite(layer, (f["col"] * cw, f["row"] * ch))

    # シート全体を一度に減色＝全コマでパレット共通
    alpha = out.getchannel("A").point(lambda v: 255 if v >= ALPHA_SOLID else 0)
    rgb = out.convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT).convert("RGB")
    final = rgb.convert("RGBA")
    final.putalpha(alpha)
    meta = {
        "cell": [cw, ch],
        "cols": cols,
        "rows": rows,
        "dirs": DIRS[:cols],
        "frames": FRAMES[:rows],
        "anchor": list(anchor),
        "charHeight": height,
        "mirror": {"down_left": "down_right", "left": "right", "up_left": "up_right"},
    }
    return final, meta, warnings


def write_preview(sheets, path: Path, zoom: int = 4):
    """全サイズを市松模様の上に4倍で並べた確認用画像。"""
    pad = 16
    width = max(s.width for s in sheets) * zoom + pad * 2
    height = sum(s.height * zoom + pad for s in sheets) + pad
    canvas = Image.new("RGBA", (width, height), (29, 24, 36, 255))
    y = pad
    for s in sheets:
        big = s.resize((s.width * zoom, s.height * zoom), Image.NEAREST)
        checker = Image.new("RGBA", big.size)
        cp = checker.load()
        for yy in range(big.height):
            for xx in range(big.width):
                on = ((xx // (4 * zoom)) + (yy // (4 * zoom))) % 2
                cp[xx, yy] = (59, 51, 70, 255) if on else (70, 61, 83, 255)
        checker.alpha_composite(big)
        canvas.alpha_composite(checker, (pad, y))
        y += big.height + pad
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", nargs="?", default=str(DEFAULT_INPUT), help="生成AIの歩行シート（マゼンタ背景）")
    ap.add_argument("--name", default="tsumugi_walk", help="出力ファイル名の頭")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT))
    ap.add_argument("--sizes", default="32,48", help="キャラの高さ(px)。カンマ区切り")
    ap.add_argument("--cols", type=int, default=5)
    ap.add_argument("--rows", type=int, default=2)
    ap.add_argument("--colors", type=int, default=48)
    ap.add_argument("--key", default="auto", help="auto / #RRGGBB（既定は四隅から自動検出）")
    ap.add_argument("--tolerance", type=int, default=70)
    ap.add_argument("--per-frame-fit", action="store_true", help="全コマを同じ高さに揃える（生成AIの大きさブレ対策）")
    ap.add_argument("--no-preview", action="store_true")
    args = ap.parse_args()

    src_path = Path(args.input)
    if not src_path.exists():
        sys.exit(f"入力が見つかりません: {src_path}")
    src = Image.open(src_path).convert("RGBA")
    key = detect_key_color(src) if args.key == "auto" else parse_color(args.key)
    print(f"クロマキー: 背景色 {key} / {src.width}x{src.height}（大きい画像は数秒かかります）")
    keyed = chroma_key(src, key, tolerance=args.tolerance)

    frames = extract_frames(keyed, args.cols, args.rows)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    built = []
    for height in [int(v) for v in args.sizes.split(",") if v.strip()]:
        sheet, meta, warnings = build_sheet(frames, args.cols, args.rows, height, args.colors, args.per_frame_fit)
        png = out_dir / f"{args.name}_{height}.png"
        sheet.save(png)
        (out_dir / f"{args.name}_{height}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {png} ({sheet.width}x{sheet.height}, セル{meta['cell'][0]}x{meta['cell'][1]})")
        for w in warnings:
            print(f"  WARN {w}")
        built.append(sheet)
    if not args.no_preview and built:
        write_preview(built, PREVIEW_PATH)
        print(f"wrote {PREVIEW_PATH}（確認用）")


if __name__ == "__main__":
    main()
