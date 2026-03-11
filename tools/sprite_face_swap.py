#!/usr/bin/env python3
"""
sprite_face_swap.py — 立ち絵の顔入れ替えツール

各キャラクターの表情差分を解析し、normal の体をベースに
顔部分だけを各表情から合成することで、表情ごとのサイズ・位置ブレを解消する。

使い方:
  python3 tools/sprite_face_swap.py                    # 全キャラ処理
  python3 tools/sprite_face_swap.py --character tsumugi # 1キャラだけ
  python3 tools/sprite_face_swap.py --dry-run           # 解析のみ（上書きしない）
  python3 tools/sprite_face_swap.py --backup            # 元画像をバックアップ

仕組み:
  1. normal 画像をベース（体）として使用
  2. 各表情と normal のピクセル差分を解析し、差分ヒートマップを生成
  3. ヒートマップが高い部分（顔や表情変化部分）は各表情のピクセルを使用
  4. ヒートマップが低い部分（体）は normal のピクセルで統一
  5. 中間部分はアルファブレンドで滑らかに合成
"""

import argparse
import glob
import os
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter
    import numpy as np
except ImportError:
    print("Error: Pillow と numpy が必要です")
    print("  pip install Pillow numpy")
    sys.exit(1)

SPRITES_DIR = Path("assets/sprites/characters")
BACKUP_DIR = Path("assets/sprites/characters_backup")

# 差分解析パラメータ
DIFF_THRESHOLD = 25       # この値以上のRGB差分を「有意な差」とみなす
MIN_FACE_PIXELS = 200     # これ以上の差分ピクセルがないと「同一画像」扱い
POSE_CHANGE_RATIO = 0.60  # 差分面積がこの割合を超えたら「別ポーズ」

# ヒートマップベースのブレンドパラメータ
HEATMAP_BLUR_RADIUS = 20  # ヒートマップのぼかし半径
MASK_THRESHOLD_HIGH = 0.06 # これ以上のヒートマップ値は完全に表情側を使う
MASK_THRESHOLD_LOW = 0.02  # これ以下のヒートマップ値は完全にベース側を使う


def find_characters() -> list[str]:
    """スプライトディレクトリからキャラクター一覧を取得"""
    chars = []
    for d in sorted(SPRITES_DIR.iterdir()):
        if d.is_dir() and (d / f"chr_{d.name}_normal.png").exists():
            chars.append(d.name)
    return chars


def get_expressions(character: str) -> list[str]:
    """キャラクターの全表情名を取得（normal含む）"""
    pattern = SPRITES_DIR / character / f"chr_{character}_*.png"
    expressions = []
    for f in sorted(glob.glob(str(pattern))):
        name = Path(f).stem
        face = name.split(f"chr_{character}_")[1]
        expressions.append(face)
    return expressions


def classify_expressions(
    base_arr: np.ndarray,
    expr_arrays: dict[str, np.ndarray],
) -> dict[str, str]:
    """各表情を identical / same_pose / different_pose に分類"""
    base_f = base_arr.astype(np.int16)
    base_opaque = np.sum(base_arr[:, :, 3] > 0)
    categories = {}

    for expr_name, expr_arr in expr_arrays.items():
        if expr_name == "normal":
            categories["normal"] = "base"
            continue

        expr_f = expr_arr.astype(np.int16)
        diff = np.abs(base_f - expr_f)[:, :, :3].max(axis=2)
        mask = (base_arr[:, :, 3] > 0) | (expr_arr[:, :, 3] > 0)
        significant = (diff > DIFF_THRESHOLD) & mask
        sig_count = int(np.sum(significant))

        if sig_count < MIN_FACE_PIXELS:
            categories[expr_name] = "identical"
            print(f"    {expr_name}: identical（差分 {sig_count}px → スキップ）")
        elif sig_count / max(base_opaque, 1) > POSE_CHANGE_RATIO:
            ratio = sig_count / max(base_opaque, 1)
            categories[expr_name] = "different_pose"
            print(
                f"    {expr_name}: different_pose"
                f"（差分 {sig_count}px = {ratio:.1%} → 別ポーズとしてスキップ）"
            )
        else:
            categories[expr_name] = "same_pose"
            ys, xs = np.where(significant)
            print(
                f"    {expr_name}: same_pose"
                f"（差分 {sig_count}px, 領域=({xs.min()},{ys.min()})"
                f"-({xs.max()},{ys.max()})）"
            )

    return categories


def build_blend_mask(
    base_arr: np.ndarray,
    expr_arr: np.ndarray,
) -> np.ndarray:
    """
    差分ヒートマップから表情ブレンドマスクを生成。

    差分が大きい部分（顔）は 1.0（= 表情側を使う）、
    差分がない部分（体）は 0.0（= ベース側を使う）、
    中間部分は滑らかにブレンド。
    """
    h, w = base_arr.shape[:2]
    base_f = base_arr.astype(np.float32)
    expr_f = expr_arr.astype(np.float32)

    # RGB差分の最大値をピクセルごとに計算
    diff = np.abs(base_f - expr_f)[:, :, :3].max(axis=2) / 255.0

    # ガウスぼかしで差分ヒートマップを作る（散在するノイズを平滑化）
    diff_img = Image.fromarray((diff * 255).astype(np.uint8), mode="L")
    diff_blurred = diff_img.filter(
        ImageFilter.GaussianBlur(radius=HEATMAP_BLUR_RADIUS)
    )
    heatmap = np.array(diff_blurred).astype(np.float32) / 255.0

    # ヒートマップを [0, 1] のマスクに変換
    # MASK_THRESHOLD_LOW 以下 → 0, MASK_THRESHOLD_HIGH 以上 → 1, 中間は線形補間
    span = MASK_THRESHOLD_HIGH - MASK_THRESHOLD_LOW
    if span <= 0:
        mask = (heatmap > MASK_THRESHOLD_LOW).astype(np.float32)
    else:
        mask = np.clip((heatmap - MASK_THRESHOLD_LOW) / span, 0.0, 1.0)

    return mask


def composite_with_mask(
    base_arr: np.ndarray,
    expr_arr: np.ndarray,
    mask: np.ndarray,
) -> np.ndarray:
    """マスクに基づいてベースと表情を合成"""
    base_f = base_arr.astype(np.float32)
    expr_f = expr_arr.astype(np.float32)
    mask_4ch = mask[:, :, np.newaxis]

    result = base_f * (1.0 - mask_4ch) + expr_f * mask_4ch
    return np.clip(result, 0, 255).astype(np.uint8)


def group_expressions_by_pose(expressions: list[str]) -> list[tuple[str, list[str]]]:
    """
    表情をポーズグループに分ける。
    プレフィックスが共通のものをグループ化する。
    例: [normal, sad, smile, ura_normal, ura_sad] →
        [("normal", [normal, sad, smile]), ("ura_normal", [ura_normal, ura_sad])]
    """
    # まず「ベース表情」の候補を見つける（normal を含むもの）
    groups: dict[str, list[str]] = {}
    for expr in expressions:
        if expr == "normal":
            groups.setdefault("normal", [])
        elif expr.endswith("_normal"):
            groups.setdefault(expr, [])

    # 各表情をグループに振り分け
    for expr in expressions:
        if expr in groups:
            # ベース表情自身は既に登録済み
            continue
        # どのグループに属するか判定（プレフィックスが最も長く一致するもの）
        best_base = "normal"
        best_len = 0
        for base_name in groups:
            if base_name == "normal":
                # プレフィックスなし表情は normal グループ
                # ura_xxx は "normal" にはマッチさせない
                if "_" not in expr:
                    best_base = "normal"
                continue
            prefix = base_name.replace("_normal", "_")
            if expr.startswith(prefix) and len(prefix) > best_len:
                best_base = base_name
                best_len = len(prefix)

        groups.setdefault(best_base, []).append(expr)

    return [(base, members) for base, members in groups.items()]


def process_character(
    character: str, dry_run: bool = False, backup: bool = False
) -> dict:
    """1キャラクターの全表情を処理（ポーズグループごと）"""
    print(f"\n{'='*50}")
    print(f"  {character}")
    print(f"{'='*50}")

    char_dir = SPRITES_DIR / character
    expressions = get_expressions(character)
    print(f"  表情: {expressions}")

    if "normal" not in expressions:
        print(f"  ⚠ normal がありません。スキップ。")
        return {"status": "skipped", "reason": "no_normal"}

    # 全画像を読み込み
    arrays = {}
    for expr in expressions:
        path = char_dir / f"chr_{character}_{expr}.png"
        img = Image.open(path).convert("RGBA")
        arrays[expr] = np.array(img)

    # ポーズグループに分ける
    pose_groups = group_expressions_by_pose(expressions)

    all_categories = {}
    all_processed = []

    for base_name, members in pose_groups:
        if base_name not in arrays:
            continue
        base_arr = arrays[base_name]

        # グループ内の表情を分類
        group_arrays = {base_name: base_arr}
        for m in members:
            if m in arrays:
                group_arrays[m] = arrays[m]

        if len(group_arrays) <= 1:
            all_categories[base_name] = "base"
            continue

        print(f"\n  --- ポーズグループ: {base_name} ---")
        categories = classify_expressions(base_arr, group_arrays)
        all_categories.update(categories)

        same_pose_count = sum(
            1 for v in categories.values() if v == "same_pose"
        )
        if same_pose_count == 0:
            continue

        if dry_run:
            print(f"  → [DRY RUN] {same_pose_count} 表情を処理予定")
            continue

        # バックアップ
        if backup:
            backup_dir = BACKUP_DIR / character
            backup_dir.mkdir(parents=True, exist_ok=True)
            for expr in [base_name] + members:
                src = char_dir / f"chr_{character}_{expr}.png"
                dst = backup_dir / f"chr_{character}_{expr}.png"
                if src.exists() and not dst.exists():
                    shutil.copy2(src, dst)
                    print(f"  backup: {dst}")

        # 各 same_pose 表情を合成
        for expr, category in categories.items():
            if category != "same_pose":
                continue
            mask = build_blend_mask(base_arr, arrays[expr])
            composite = composite_with_mask(base_arr, arrays[expr], mask)
            out_path = char_dir / f"chr_{character}_{expr}.png"
            Image.fromarray(composite, "RGBA").save(out_path)
            all_processed.append(expr)
            face_pixels = int(np.sum(mask > 0.5))
            print(f"  ✓ {expr} → 保存完了（マスク有効領域: {face_pixels}px）")

    total_same = sum(
        1 for v in all_categories.values() if v == "same_pose"
    )

    if total_same == 0 and not dry_run:
        print(f"  → 処理対象の表情なし。スキップ。")
        return {
            "status": "skipped",
            "reason": "no_same_pose",
            "categories": all_categories,
        }

    if dry_run:
        print(f"\n  → [DRY RUN] 合計 {total_same} 表情を処理予定")
        return {"status": "dry_run", "categories": all_categories}

    print(f"\n  → {len(all_processed)} 表情を処理完了")
    return {
        "status": "processed",
        "categories": all_categories,
        "processed": all_processed,
    }


def main():
    parser = argparse.ArgumentParser(
        description="立ち絵の顔入れ替えツール"
    )
    parser.add_argument(
        "--character", "-c",
        help="処理するキャラクター名（省略で全キャラ）",
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="解析のみ行い、画像は上書きしない",
    )
    parser.add_argument(
        "--backup", "-b",
        action="store_true",
        help="元画像を characters_backup/ にバックアップ",
    )
    args = parser.parse_args()

    os.chdir(Path(__file__).resolve().parent.parent)

    if args.character:
        characters = [args.character]
    else:
        characters = find_characters()

    print(f"対象キャラクター: {characters}")

    results = {}
    for char in characters:
        results[char] = process_character(
            char, dry_run=args.dry_run, backup=args.backup
        )

    # サマリー
    print(f"\n{'='*50}")
    print("  サマリー")
    print(f"{'='*50}")
    for char, result in results.items():
        status = result["status"]
        if status == "processed":
            exprs = ", ".join(result["processed"])
            print(f"  {char}: {len(result['processed'])} 表情処理 ({exprs})")
        elif status == "dry_run":
            cats = result.get("categories", {})
            same = sum(1 for v in cats.values() if v == "same_pose")
            print(f"  {char}: [DRY RUN] {same} 表情が処理対象")
        else:
            print(f"  {char}: スキップ ({result.get('reason', '')})")


if __name__ == "__main__":
    main()
