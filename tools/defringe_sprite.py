#!/usr/bin/env python3
"""立ち絵の輪郭フリンジ（マット色の縁残り）除去ツール。

症状: 生成元の背景色（赤・マゼンタ等）が切り抜き後も輪郭に1〜2pxの
縁として残り、ゲームの暗い背景の上で「髪がズタズタ」に見える（F7）。

方針: 輪郭ゾーン（透明に接する数px）のうち「フリンジ色」と判定した画素だけ、
最寄りの内部画素（輪郭から離れた不透明画素）の色で塗り直す。
アルファは変更しない＝シルエットは1pxも変わらない。

- フリンジ判定: 赤みが強い(R - max(G,B) > 25) かつ 暗め(V < 180)。
  肌のハイライトは明るいので除外される。誤判定しても「最寄りの内部色」への
  置換なので破綻しない（同じ房の色に馴染む）。
- 半透明の輪郭画素(0<a<255)は判定に関係なく内部色へ寄せる（標準的なデフリンジ）。

使い方:
  python3 tools/defringe_sprite.py assets/sprites/characters/rin --dry-run
  python3 tools/defringe_sprite.py assets/sprites/characters/rin

⚠️ portrait-fix スキルの教訓: 一括適用しない。1キャラ処理→目視→次のキャラ。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

EDGE_PX = 3          # 透明に接する何pxを「輪郭ゾーン」とみなすか
INTERIOR_MARGIN = 4  # 内部色のサンプル元は輪郭からこれ以上離れた不透明画素
RED_DOM = 25         # 赤み判定: R - max(G,B) がこれを超える
DARK_V = 180         # 明るい画素（肌ハイライト等）は赤くても触らない


def defringe(path: Path, dry: bool) -> int:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    rgb = arr[..., :3].astype(int)
    a = arr[..., 3]

    transparent = a < 16
    if not transparent.any() or transparent.all():
        return 0
    edge_zone = ndimage.binary_dilation(transparent, iterations=EDGE_PX) & (a > 0)
    interior = (a >= 250) & ~ndimage.binary_dilation(transparent, iterations=INTERIOR_MARGIN)
    if not interior.any():
        return 0

    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    v = rgb.max(axis=2)
    reddish = (r - np.maximum(g, b) > RED_DOM) & (v < DARK_V)
    semi = (a > 0) & (a < 250)
    target = edge_zone & (reddish | semi)
    n = int(target.sum())
    if n == 0 or dry:
        return n

    # 各対象画素を「最寄りの内部画素」の色で置き換える
    dist, (iy, ix) = ndimage.distance_transform_edt(~interior, return_indices=True)
    ty, tx = np.where(target)
    src_y, src_x = iy[ty, tx], ix[ty, tx]
    out = arr.copy()
    # 不透明なフリンジは完全置換、半透明の縁は内部色へ7割寄せる（質感を少し残す）
    opaque_t = a[ty, tx] >= 250
    out[ty[opaque_t], tx[opaque_t], :3] = arr[src_y[opaque_t], src_x[opaque_t], :3]
    blend = ~opaque_t
    mixed = (arr[ty[blend], tx[blend], :3].astype(int) * 3 +
             arr[src_y[blend], src_x[blend], :3].astype(int) * 7) // 10
    out[ty[blend], tx[blend], :3] = mixed.astype(np.uint8)
    Image.fromarray(out).save(path)
    return n


def main() -> None:
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    dry = "--dry-run" in sys.argv
    if not args:
        print(__doc__)
        sys.exit(1)
    root = Path(args[0])
    files = sorted(root.glob("*.png")) if root.is_dir() else [root]
    for f in files:
        n = defringe(f, dry)
        print(f"{'DRY ' if dry else ''}{f}: fringe px {n}")


if __name__ == "__main__":
    main()
