#!/usr/bin/env python3
"""clean_sprite_alpha.py — 立ち絵の透過の消し残りを一括クリーンアップする。

背景除去AIの出力に残る3種類のゴミを取り除く（この順で処理する）:
  1. 内部の半透明化け: 図の内部なのに alpha が 255 未満のピクセル
     （例: minto ura_* のスカート全体が alpha 192〜250 の点描状で、
      明るい背景の上で服が透けて見える）。輪郭から3px以上内側で
     alpha>=144 のピクセルを不透明にする。輪郭のアンチエイリアスと
     意図的な煙の演出（薄い・細い）は触らない。
     ※ 必ず最初に行う。後段の「浮遊ゴミ除去」が点描の服を
       ゴミと誤判定して穴を開けないようにするため。
  2. 浮遊半透明ゴミ: 本体から離れた場所に残る薄いピクセル
     （例: ageha smile の左端の線）。
     不透明部（alpha>=240）から3px以上離れた半透明ピクセルを消す。
  3. 孤立ゴミ成分: 本体と連結していない小さな不透明の島
     （髪の毛の房などは本体の近くにあるので残る）。

例外: ryuji のような「枠付き一枚絵カード」（bbox 内をほぼ塗り潰す矩形
アート）は枠や余白が正規のデザインなので、内部固化以外は行わない。

使い方:
  python3 tools/clean_sprite_alpha.py                 # 全キャラ処理（上書き）
  python3 tools/clean_sprite_alpha.py minto ryuji     # フォルダ名で絞り込み
  python3 tools/clean_sprite_alpha.py --dry-run       # 変更内容の確認のみ

処理後は必ず再ビルドする:
  python3 web/build_data.py && python3 web/build_standalone.py
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
    from scipy import ndimage
except ImportError:
    print("Pillow / numpy / scipy が必要です: pip install Pillow numpy scipy")
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
CHARS_DIR = REPO_ROOT / "assets" / "sprites" / "characters"

# 浮遊半透明ゴミ: 不透明部からこの距離(px)以内はアンチエイリアスとして常に残す
FLOAT_SEMI_DIST = 3
# 髪の房の保護（2026-07-02）: 細い毛先は「そこそこ濃い半透明（α64〜）が本体の
# 4〜15px先に浮く」形で存在する。旧実装（3px超の半透明を全消し）はこれを
# ゴミと誤判定して髪を食っていた。本体からこの距離(px)までは α が
# GHOST_MAX_ALPHA 以上の半透明を髪として残す
WISP_KEEP_DIST = 24
GHOST_MAX_ALPHA = 64
# 孤立成分: 本体面積のこの割合未満 かつ 本体からこの距離(px)超なら消す
STRAY_RATIO = 0.01
STRAY_DIST = 12
# 内部固化: 輪郭からこの距離(px)以上内側で、alpha がこの値以上なら 255 へ
SOLIDIFY_ERODE = 3
SOLIDIFY_MIN_ALPHA = 144
# 一枚絵カード判定: bbox 内の可視ピクセル充填率がこの値以上なら
# 枠・余白が正規デザインとみなしてゴミ除去を行わない
CARD_FILL_RATIO = 0.9


def clean(png: Path, dry: bool) -> bool:
    im = Image.open(png).convert("RGBA")
    arr = np.array(im)
    alpha = arr[..., 3].astype(np.int32)
    orig = alpha.copy()

    # --- 1) 内部の半透明化け（服が透ける）。必ずゴミ除去より先に行う
    body = alpha >= 128
    if not body.any():
        return False
    interior = ndimage.binary_erosion(body, iterations=SOLIDIFY_ERODE)
    alpha[interior & (alpha >= SOLIDIFY_MIN_ALPHA) & (alpha < 255)] = 255

    # 一枚絵カード（ryuji 等）は枠が正規デザインなのでゴミ除去をスキップ
    ys, xs = np.where(alpha > 0)
    bbox_area = (ys.max() - ys.min() + 1) * (xs.max() - xs.min() + 1)
    is_card = len(ys) / bbox_area >= CARD_FILL_RATIO

    if not is_card:
        # --- 2) 浮遊半透明ゴミ（枠線・すじ）。髪の毛先（濃いめの半透明・本体の近く）は残す
        solid = alpha >= 240
        near_solid = ndimage.binary_dilation(solid, iterations=FLOAT_SEMI_DIST)
        wisp_zone = ndimage.binary_dilation(solid, iterations=WISP_KEEP_DIST)
        ghost = (alpha > 0) & (alpha < 240) & ~near_solid
        # 消すのは「ごく薄い（マット残り）」か「本体から遠すぎる」半透明だけ
        alpha[ghost & ((alpha < GHOST_MAX_ALPHA) | ~wisp_zone)] = 0

        # --- 3) 孤立ゴミ成分（本体から離れた小さな島）
        visible = alpha > 0
        labels, n = ndimage.label(visible)
        if n > 1:
            sizes = ndimage.sum(visible, labels, range(1, n + 1))
            main_label = int(np.argmax(sizes)) + 1
            main_size = sizes[main_label - 1]
            near_main = ndimage.binary_dilation(labels == main_label, iterations=STRAY_DIST)
            for i, size in enumerate(sizes, start=1):
                if i == main_label or size >= main_size * STRAY_RATIO:
                    continue
                comp = labels == i
                if not (comp & near_main).any():
                    alpha[comp] = 0

    changed = int((alpha != orig).sum())
    if changed == 0:
        return False
    removed = int(((orig > 0) & (alpha == 0)).sum())
    solidified = int((alpha == 255).sum() - (orig == 255).sum())
    rel = png.relative_to(REPO_ROOT)
    print(f"{rel}: 変更 {changed}px（除去 {removed}px / 不透明化 {max(solidified, 0)}px）")
    if not dry:
        arr[..., 3] = alpha.astype(np.uint8)
        # 完全透過になったピクセルは色も消してマットの色染みを残さない
        arr[alpha == 0] = 0
        Image.fromarray(arr).save(png)
    return True


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("chars", nargs="*", help="処理するキャラフォルダ名（省略で全キャラ）")
    ap.add_argument("--dry-run", action="store_true", help="書き込まずに変更内容だけ表示")
    args = ap.parse_args()

    dirs = sorted(d for d in CHARS_DIR.iterdir() if d.is_dir())
    if args.chars:
        dirs = [d for d in dirs if d.name in set(args.chars)]
    total = 0
    for d in dirs:
        for png in sorted(d.glob("chr_*.png")):
            if clean(png, args.dry_run):
                total += 1
    print(f"{'(dry-run) ' if args.dry_run else ''}{total} ファイルに変更")
    if total and not args.dry_run:
        print("再ビルドを忘れずに: python3 web/build_data.py && python3 web/build_standalone.py")


if __name__ == "__main__":
    main()
