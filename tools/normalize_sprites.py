#!/usr/bin/env python3
"""
normalize_sprites.py — キャラクター立ち絵の正規化ツール

やること:
  - 背景の白・単色を透過（RGBA変換）
  - キャンバスサイズを統一（デフォルト: 512x1024）
  - キャラを下中央に配置

使い方:
  # 単ファイル
  python3 tools/normalize_sprites.py path/to/image.png

  # フォルダ内を一括処理
  python3 tools/normalize_sprites.py assets/sprites/characters/minto/

  # サイズ指定（例: 1024x2048）
  python3 tools/normalize_sprites.py assets/sprites/characters/minto/ --size 1024x2048

  # 上書きせずに _normalized サフィックスで保存
  python3 tools/normalize_sprites.py assets/sprites/characters/minto/ --suffix _normalized

  # 背景除去の感度調整（0〜50, デフォルト: 30）
  python3 tools/normalize_sprites.py image.png --threshold 20
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("Pillow と numpy が必要です。以下を実行してください:")
    print("  pip install Pillow numpy")
    sys.exit(1)


CANVAS_W = 512
CANVAS_H = 1024


def remove_background(img: Image.Image, threshold: int = 30) -> Image.Image:
    """四隅のサンプルから背景色を推定して透過する。"""
    img = img.convert("RGBA")
    data = np.array(img, dtype=np.int32)

    # 四隅 2x2 ピクセルの平均を背景色とする
    corners = [
        data[0, 0, :3], data[0, -1, :3],
        data[-1, 0, :3], data[-1, -1, :3],
    ]
    bg = np.mean(corners, axis=0)

    diff = np.sqrt(np.sum((data[:, :, :3] - bg) ** 2, axis=2))
    mask = diff < threshold  # True = 背景

    data[:, :, 3] = np.where(mask, 0, data[:, :, 3])
    return Image.fromarray(data.astype(np.uint8), "RGBA")


def place_on_canvas(img: Image.Image, canvas_w: int, canvas_h: int) -> Image.Image:
    """透過済み画像をキャンバスの下中央に配置する。"""
    # 実際に不透明なピクセルのバウンディングボックスを取得
    bbox = img.getbbox()
    if bbox is None:
        return Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

    cropped = img.crop(bbox)
    cw, ch = cropped.size

    # キャンバスに収まるようにリサイズ（比率維持）
    scale = min(canvas_w / cw, canvas_h / ch, 1.0)  # 拡大はしない
    new_w = int(cw * scale)
    new_h = int(ch * scale)
    if scale < 1.0:
        cropped = cropped.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    x = (canvas_w - new_w) // 2
    y = canvas_h - new_h  # 下揃え
    canvas.paste(cropped, (x, y), cropped)
    return canvas


def process_file(src: Path, dst: Path, canvas_w: int, canvas_h: int, threshold: int, already_transparent: bool) -> None:
    img = Image.open(src)

    has_alpha = img.mode == "RGBA" and img.getextrema()[3][0] < 255

    if not has_alpha and not already_transparent:
        print(f"  背景除去中... (threshold={threshold})")
        img = remove_background(img, threshold)
    else:
        img = img.convert("RGBA")
        print(f"  既に透過済み — 背景除去スキップ")

    img = place_on_canvas(img, canvas_w, canvas_h)
    img.save(dst, "PNG")
    print(f"  保存: {dst}  ({canvas_w}x{canvas_h})")


def main():
    parser = argparse.ArgumentParser(description="立ち絵正規化ツール")
    parser.add_argument("input", help="処理対象のファイルまたはフォルダ")
    parser.add_argument("--size", default=f"{CANVAS_W}x{CANVAS_H}", help="キャンバスサイズ (例: 512x1024)")
    parser.add_argument("--suffix", default="", help="出力ファイル名のサフィックス（空=上書き）")
    parser.add_argument("--threshold", type=int, default=30, help="背景色検出の感度 0〜100 (デフォルト: 30)")
    parser.add_argument("--skip-bg-removal", action="store_true", help="背景除去をスキップ（既に透過済みの場合）")
    args = parser.parse_args()

    try:
        canvas_w, canvas_h = map(int, args.size.split("x"))
    except ValueError:
        print(f"サイズの指定が不正です: {args.size}  例: 512x1024")
        sys.exit(1)

    src_path = Path(args.input)
    targets = []

    if src_path.is_file():
        targets = [src_path]
    elif src_path.is_dir():
        targets = sorted(src_path.glob("*.png"))
        if not targets:
            print(f"PNG ファイルが見つかりません: {src_path}")
            sys.exit(1)
    else:
        print(f"ファイルまたはフォルダが存在しません: {src_path}")
        sys.exit(1)

    for src in targets:
        if src.suffix.lower() != ".png":
            continue
        stem = src.stem
        if stem.endswith(args.suffix) and args.suffix:
            continue  # 既に処理済みのファイルをスキップ
        dst_name = f"{stem}{args.suffix}.png"
        dst = src.parent / dst_name
        print(f"\n[{src.name}]")
        try:
            process_file(src, dst, canvas_w, canvas_h, args.threshold, args.skip_bg_removal)
        except Exception as e:
            print(f"  エラー: {e}")


if __name__ == "__main__":
    main()
