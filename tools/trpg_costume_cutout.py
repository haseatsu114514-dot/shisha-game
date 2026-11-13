#!/usr/bin/env python3
"""TRPGの役衣装の絵（remake/img/ui/trpg/costumes/**.webp）の、生成りの台紙を透過にする。

役衣装の絵は、平らな一色の台紙の上に全身が描かれて届く。台紙ごと出すと、判定のカットインや台詞の立ち姿が
「証明写真の札」に見える（TRF19・オーナー 2026-11-12）。台紙を抜いて人物だけにし、札として見せたい所
（行動宣言・キャラ作成・表紙・キャラクターシート）は CSS で台紙の色を敷く。

  python3 tools/trpg_costume_cutout.py                 # まだ台紙のある絵をすべて処理
  python3 tools/trpg_costume_cutout.py --check         # 書き込まず、台紙が残っている絵を一覧（残っていれば終了コード1）
  python3 tools/trpg_costume_cutout.py path/to/a.webp  # 指定した絵だけ

絵の寸法と人物の位置は変えない（顔の位置の測定値 frames.json はそのまま使える）。すでに透過の絵は触らない。
新しい役衣装の絵を足したら、組み込みの前に一度これを通す。必要なもの: Pillow と numpy。
"""
import argparse
import glob
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PATTERN = os.path.join(ROOT, "remake", "img", "ui", "trpg", "costumes", "*", "*.webp")
FILL_TOLERANCE = 12      # 縁からつながる台紙とみなす色の差（RGBの差の合計。台紙は一色で、人物の線で止まる）
HOLE_TOLERANCE = 5       # 腕と体の間などに閉じ込められた台紙: ほぼ同じ色のかたまりだけを抜く
HOLE_CORE = 9            # 抜く穴は、少なくとも 9×9 画素の台紙色の芯を持つ
HOLE_EDGE_DIFFERENCE = 150   # 穴の少し外側が、線や別の物（台紙から遠い色）で
HOLE_EDGE_SHARE = 0.5        # 半分以上囲まれている時だけ抜く（服の明るい所は 0.25 以下、本物のすき間は 0.7 以上だった）


def has_backing(image):
    """四隅が不透明なら、まだ台紙がある。"""
    if image.mode != "RGBA":
        return True
    w, h = image.size
    return all(image.getpixel(xy)[3] > 0 for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)])


def spread_within(seed, mask):
    """seed から mask の中をつながっている所まで広げる（塗りつぶし）。行と列の「連なり」単位で交互に広げる。"""
    h, w = mask.shape

    def runs(m):
        change = np.ones(m.shape, bool)
        change[:, 1:] = m[:, 1:] != m[:, :-1]
        return np.cumsum(change.ravel()).reshape(m.shape) - 1

    rows, columns = runs(mask), runs(mask.T).T
    reached = seed & mask
    while True:
        before = int(reached.sum())
        for ids in (rows, columns):
            hit = np.zeros(int(ids.max()) + 1, bool)
            hit[ids[reached]] = True
            reached = hit[ids] & mask
        if int(reached.sum()) == before:
            return reached


def grow(mask, size):
    """mask を size 画素の四角で太らせる（負の値は痩せさせる）。"""
    kernel = ImageFilter.MaxFilter(size) if size > 0 else ImageFilter.MinFilter(-size)
    return np.asarray(Image.fromarray(np.where(mask, 255, 0).astype(np.uint8), "L").filter(kernel)) == 255


def cutout(image):
    rgb = image.convert("RGB")
    pixels = np.asarray(rgb).astype(np.int32)
    border = np.concatenate([pixels[0, :], pixels[-1, :], pixels[:, 0], pixels[:, -1]])
    backing = np.median(border, axis=0)
    spread = np.abs(border - backing).max()
    if spread > FILL_TOLERANCE:
        raise ValueError(f"台紙が一色ではありません（縁の色の幅 {int(spread)}）。手で確かめてください")

    # 1) 縁からつながる台紙（人物の線で止まる）
    difference = np.abs(pixels - backing).sum(axis=2)
    near = difference <= FILL_TOLERANCE
    edge = np.zeros_like(near)
    edge[0, :] = edge[-1, :] = edge[:, 0] = edge[:, -1] = True
    outside = spread_within(edge, near)

    # 2) 人物の内側に閉じ込められた台紙（腕と体の間、弓と弦の間など）。台紙と同じ色の服（生成りのドレスの明るい所）を
    #    抜かないよう、9×9 の芯があるかたまりを1つずつ調べ、少し外側（3〜6画素先）が線や別の物で囲まれている時だけ抜く。
    candidates = (difference <= HOLE_TOLERANCE) & ~outside
    core = grow(candidates, -HOLE_CORE)
    holes = np.zeros_like(outside)
    while core.any():
        ys, xs = np.nonzero(core)
        seed = np.zeros_like(core)
        seed[ys[0], xs[0]] = True
        region = spread_within(seed, candidates)
        core &= ~region
        around = grow(region, 13) & ~grow(region, 5)
        if around.any() and (difference[around] > HOLE_EDGE_DIFFERENCE).mean() >= HOLE_EDGE_SHARE:
            holes |= region
    background = outside | holes

    # 3) 縁の1画素は、台紙の色との近さで半透明にし、色から台紙の分を引く（暗い背景に載せても生成りの縁取りが出ない）
    distance = np.sqrt(((pixels - backing) ** 2).sum(axis=2))
    alpha = np.where(background, 0, 255).astype(np.uint8)
    shrunk = np.asarray(Image.fromarray(alpha, "L").filter(ImageFilter.MinFilter(3)))
    ring = (alpha == 255) & (shrunk == 0)
    soft = np.clip((distance - 6) / 40.0, 0, 1)
    out_alpha = alpha.astype(np.float32)
    out_alpha[ring] = 255 * soft[ring]
    a = (out_alpha / 255.0)[..., None]
    colour = pixels.astype(np.float32)
    lifted = np.where(a > 0.05, (colour - (1 - a) * backing) / np.maximum(a, 0.05), colour)
    colour = np.where(ring[..., None], np.clip(lifted, 0, 255), colour)
    # 透明な所の色は台紙の色のままにしておく（縮小の時に暗い色がにじまない）
    colour = np.where(background[..., None], backing, colour)
    result = Image.fromarray(np.dstack([colour, out_alpha[..., None]]).astype(np.uint8), "RGBA")
    return result, {"backing": tuple(int(v) for v in backing), "figure": round(float(1 - background.mean()), 3), "holes": int(holes.sum())}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("files", nargs="*", help="処理する絵（省略すると役衣装の絵すべて）")
    parser.add_argument("--check", action="store_true", help="書き込まず、台紙が残っている絵を一覧")
    args = parser.parse_args()
    files = args.files or sorted(glob.glob(PATTERN))
    pending, failed = [], []
    for path in files:
        with Image.open(path) as opened:
            image = opened.copy()
        if not has_backing(image):
            continue
        pending.append(path)
        if args.check:
            continue
        try:
            result, info = cutout(image)
        except ValueError as error:
            failed.append(path)
            print(f"SKIP {os.path.relpath(path, ROOT)}: {error}")
            continue
        result.save(path, "WEBP", quality=90, alpha_quality=100, method=6)
        print(f"OK   {os.path.relpath(path, ROOT)}  台紙 {info['backing']}  人物 {info['figure']:.0%}  内側の抜き {info['holes']}px")
    if args.check:
        for path in pending:
            print("台紙あり:", os.path.relpath(path, ROOT))
        print(f"{len(files)} 枚中 {len(pending)} 枚に台紙が残っています")
        return 1 if pending else 0
    print(f"{len(pending) - len(failed)} 枚を透過にしました（{len(files)} 枚中。手で確かめる絵 {len(failed)} 枚）")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
