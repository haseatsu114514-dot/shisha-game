#!/usr/bin/env python3
"""
normalize_sprites.py — キャラクター立ち絵の正規化ツール

やること:
  - 背景除去（rembg による AI 除去 or 従来の四隅推定）
  - キャンバスサイズを統一（デフォルト: 896x1200）
  - 同一キャラの全表情で union bbox を使い、位置とサイズを揃える

使い方:
  # キャラフォルダ単位で処理（推奨: 全表情の位置を揃える）
  python3 tools/normalize_sprites.py assets/sprites/characters/mashiro/

  # 全キャラまとめて処理
  python3 tools/normalize_sprites.py assets/sprites/characters/

  # rembg で高精度な背景除去をやり直す
  python3 tools/normalize_sprites.py assets/sprites/characters/ --rembg

  # サイズ指定（例: 1024x2048）
  python3 tools/normalize_sprites.py assets/sprites/characters/minto/ --size 1024x2048

  # 上書きせずに _normalized サフィックスで保存
  python3 tools/normalize_sprites.py assets/sprites/characters/minto/ --suffix _normalized

  # 背景除去の感度調整（0〜50, デフォルト: 30）
  python3 tools/normalize_sprites.py image.png --threshold 20

  # ドライランで変更内容だけ確認
  python3 tools/normalize_sprites.py assets/sprites/characters/ --dry-run
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


CANVAS_W = 896
CANVAS_H = 1200


def remove_background_legacy(img: Image.Image, threshold: int = 30) -> Image.Image:
    """四隅のサンプルから背景色を推定して透過する（従来方式）。"""
    img = img.convert("RGBA")
    data = np.array(img, dtype=np.int32)

    corners = [
        data[0, 0, :3], data[0, -1, :3],
        data[-1, 0, :3], data[-1, -1, :3],
    ]
    bg = np.mean(corners, axis=0)

    diff = np.sqrt(np.sum((data[:, :, :3] - bg) ** 2, axis=2))
    mask = diff < threshold

    data[:, :, 3] = np.where(mask, 0, data[:, :, 3])
    return Image.fromarray(data.astype(np.uint8), "RGBA")


def remove_background_rembg(img: Image.Image) -> Image.Image:
    """rembg (U2-Net) による高精度な背景除去。"""
    try:
        from rembg import remove
    except ImportError:
        print("  rembg が見つかりません。pip install rembg を実行してください。")
        print("  従来方式にフォールバックします。")
        return remove_background_legacy(img)

    img_rgba = img.convert("RGBA")
    result = remove(img_rgba)
    return result


def compute_union_bbox(images: list[Image.Image]) -> tuple[int, int, int, int] | None:
    """複数画像の不透明領域の union bounding box を返す。"""
    union = None
    for img in images:
        bbox = img.getbbox()
        if bbox is None:
            continue
        if union is None:
            union = bbox
        else:
            union = (
                min(union[0], bbox[0]),
                min(union[1], bbox[1]),
                max(union[2], bbox[2]),
                max(union[3], bbox[3]),
            )
    return union


def place_on_canvas_with_fixed_bbox(
    img: Image.Image,
    union_bbox: tuple[int, int, int, int],
    canvas_w: int,
    canvas_h: int,
) -> Image.Image:
    """union bbox に基づいてキャンバスの下中央に配置する。
    全表情で同じ union_bbox を使うことで、サイズと位置が揃う。
    """
    # union bbox の領域でクロップ
    cropped = img.crop(union_bbox)
    cw, ch = cropped.size

    # キャンバスに収まるようにリサイズ（比率維持、拡大なし）
    scale = min(canvas_w / cw, canvas_h / ch, 1.0)
    new_w = int(cw * scale)
    new_h = int(ch * scale)
    if scale < 1.0:
        cropped = cropped.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    x = (canvas_w - new_w) // 2
    y = canvas_h - new_h  # 下揃え
    canvas.paste(cropped, (x, y), cropped)
    return canvas


def place_on_canvas(img: Image.Image, canvas_w: int, canvas_h: int) -> Image.Image:
    """単体画像をキャンバスの下中央に配置する（後方互換）。"""
    bbox = img.getbbox()
    if bbox is None:
        return Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    return place_on_canvas_with_fixed_bbox(img, bbox, canvas_w, canvas_h)


def process_character_folder(
    folder: Path,
    canvas_w: int,
    canvas_h: int,
    threshold: int,
    use_rembg: bool,
    suffix: str,
    dry_run: bool,
) -> None:
    """キャラフォルダ内の全表情を union bbox で統一処理する。"""
    png_files = sorted(folder.glob("chr_*.png"))
    if not png_files:
        return

    char_name = folder.name
    print(f"\n{'=' * 40}")
    print(f"キャラクター: {char_name} ({len(png_files)} 枚)")
    print(f"{'=' * 40}")

    # Phase 1: 全画像を読み込み、必要なら背景除去
    processed: dict[Path, Image.Image] = {}
    for f in png_files:
        img = Image.open(f)
        has_alpha = img.mode == "RGBA" and img.getextrema()[3][0] < 255

        if use_rembg:
            print(f"  [{f.name}] rembg で背景除去中...")
            img = remove_background_rembg(img)
        elif not has_alpha:
            print(f"  [{f.name}] 従来方式で背景除去中... (threshold={threshold})")
            img = remove_background_legacy(img, threshold)
        else:
            img = img.convert("RGBA")
            print(f"  [{f.name}] 既に透過済み — 背景除去スキップ")

        processed[f] = img

    # Phase 2: union bbox を計算
    union_bbox = compute_union_bbox(list(processed.values()))
    if union_bbox is None:
        print(f"  警告: 不透明ピクセルが見つかりません。スキップします。")
        return

    uw = union_bbox[2] - union_bbox[0]
    uh = union_bbox[3] - union_bbox[1]
    print(f"\n  union bbox: {union_bbox}  (content: {uw}x{uh})")

    # 個別 bbox との差分を表示
    for f, img in processed.items():
        ind_bbox = img.getbbox()
        if ind_bbox and ind_bbox != union_bbox:
            iw = ind_bbox[2] - ind_bbox[0]
            ih = ind_bbox[3] - ind_bbox[1]
            print(f"    {f.name}: 個別 {iw}x{ih} → 統一 {uw}x{uh}")

    if dry_run:
        print(f"  [ドライラン] 保存をスキップします。")
        return

    # Phase 3: 統一キャンバスに配置して保存
    print()
    for f, img in processed.items():
        result = place_on_canvas_with_fixed_bbox(img, union_bbox, canvas_w, canvas_h)
        stem = f.stem
        if suffix and stem.endswith(suffix):
            continue
        dst_name = f"{stem}{suffix}.png"
        dst = f.parent / dst_name
        result.save(dst, "PNG")
        print(f"  保存: {dst.name}  ({canvas_w}x{canvas_h})")


def process_single_file(
    src: Path,
    canvas_w: int,
    canvas_h: int,
    threshold: int,
    use_rembg: bool,
    suffix: str,
) -> None:
    """単一ファイルを処理する（後方互換）。"""
    img = Image.open(src)
    has_alpha = img.mode == "RGBA" and img.getextrema()[3][0] < 255

    if use_rembg:
        print(f"  rembg で背景除去中...")
        img = remove_background_rembg(img)
    elif not has_alpha:
        print(f"  従来方式で背景除去中... (threshold={threshold})")
        img = remove_background_legacy(img, threshold)
    else:
        img = img.convert("RGBA")
        print(f"  既に透過済み — 背景除去スキップ")

    img = place_on_canvas(img, canvas_w, canvas_h)

    stem = src.stem
    dst_name = f"{stem}{suffix}.png"
    dst = src.parent / dst_name
    img.save(dst, "PNG")
    print(f"  保存: {dst}  ({canvas_w}x{canvas_h})")


def main():
    parser = argparse.ArgumentParser(description="立ち絵正規化ツール")
    parser.add_argument("input", help="処理対象のファイルまたはフォルダ")
    parser.add_argument("--size", default=f"{CANVAS_W}x{CANVAS_H}",
                        help="キャンバスサイズ (例: 896x1200)")
    parser.add_argument("--suffix", default="",
                        help="出力ファイル名のサフィックス（空=上書き）")
    parser.add_argument("--threshold", type=int, default=30,
                        help="背景色検出の感度 0〜100 (デフォルト: 30)")
    parser.add_argument("--skip-bg-removal", action="store_true",
                        help="背景除去をスキップ（既に透過済みの場合）")
    parser.add_argument("--rembg", action="store_true",
                        help="rembg (AI) による高精度な背景除去を使う")
    parser.add_argument("--dry-run", action="store_true",
                        help="実際には保存せず、変更内容だけ表示する")
    args = parser.parse_args()

    try:
        canvas_w, canvas_h = map(int, args.size.split("x"))
    except ValueError:
        print(f"サイズの指定が不正です: {args.size}  例: 896x1200")
        sys.exit(1)

    src_path = Path(args.input)

    if src_path.is_file():
        # 単一ファイルモード
        if src_path.suffix.lower() != ".png":
            print(f"PNG ファイルではありません: {src_path}")
            sys.exit(1)
        print(f"\n[{src_path.name}]")
        process_single_file(src_path, canvas_w, canvas_h, args.threshold,
                            args.rembg, args.suffix)

    elif src_path.is_dir():
        # chr_*.png があるキャラフォルダか判定
        chr_pngs = list(src_path.glob("chr_*.png"))
        if chr_pngs:
            # 直接キャラフォルダを指定された場合
            process_character_folder(src_path, canvas_w, canvas_h,
                                     args.threshold, args.rembg,
                                     args.suffix, args.dry_run)
        else:
            # 親ディレクトリ（全キャラまとめて）
            char_dirs = sorted([d for d in src_path.iterdir()
                                if d.is_dir() and list(d.glob("chr_*.png"))])
            if not char_dirs:
                print(f"処理対象の chr_*.png が見つかりません: {src_path}")
                sys.exit(1)
            for char_dir in char_dirs:
                process_character_folder(char_dir, canvas_w, canvas_h,
                                          args.threshold, args.rembg,
                                          args.suffix, args.dry_run)
    else:
        print(f"ファイルまたはフォルダが存在しません: {src_path}")
        sys.exit(1)

    print("\n完了!")


if __name__ == "__main__":
    main()
