#!/usr/bin/env python3
"""Codex の原画（originals/*.png・Issue #3367）を、ゲーム用の WebP（remake/img/ui/growth_board/）にする。

  python3 asset_sources/ui/growth-board-20261111/convert.py            # 変換（火種は A案）
  python3 asset_sources/ui/growth-board-20261111/convert.py --fire b   # 火種を B案にして変換
  python3 asset_sources/ui/growth-board-20261111/convert.py --sheet    # 確認用の一覧 contact_sheet.png も作る

していること: マゼンタ（#FF00FF）の地を抜く・絵の外接矩形で切る・縮める。放射の光（真っ黒の地）は明るさを透過にする。
色は、白火だけ白金に寄せる（WHITE_FIRE。原画は琥珀色のガラスで、紙の地で茶色に見えるため）。ほかは触らない。
原画は LFS なので先に `git lfs pull --include="asset_sources/ui/growth-board-20261111/originals/*"`。
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SRC = HERE / "originals"
ROOT = HERE.parents[2]
OUT = ROOT / "remake" / "img" / "ui" / "growth_board"

KINDS = ["any", "body", "sense", "wisdom"]
# 火種: 256px のマスに対する粒の大きさ（長い辺）。丸は同じ高さだと大きく見えるので少し小さく
FIRE_SIZE, FIRE_FILL = 256, {"any": 0.90, "body": 0.98, "sense": 0.96, "wisdom": 0.93}
# 白火の色: 明暗（lo〜hi を 0〜1 に伸ばして gamma）を、濃い金 → 白金 #f6e0b0 → 白 の3色に置き換える
WHITE_FIRE = {"gamma": 0.6, "stops": [(0.0, (176, 128, 66)), (0.45, (246, 224, 176)), (1.0, (255, 255, 252))]}

# name: (原画, 出力の長い辺 px)。原画は枠の中に余白があるので、絵の外接矩形で切ってから縮める（九分割の縁は切った後の絵で測る）
PARTS = {
    "socket": ("hidane_socket", 128),
    "levelup_plate": ("levelup_plate", 732),   # 732×100。九分割: 左右 56・上下 34
    "tab_on": ("gb_tab_on", 379),              # 379×74。九分割: 左右 40・上 30・下 0
    "tab_off": ("gb_tab_off", 373),            # 373×64。九分割: 左右 40・上 26・下 6
    "badge_cost": ("gb_badge_cost", 96),
    "badge_check": ("gb_badge_check", 96),
    "badge_unknown": ("gb_badge_unknown", 96),
    "card": ("gb_card", 360),                  # 360×76。九分割: 左 36・右 34・上下 30
    "round_btn": ("gb_round_btn", 128),
    "title_rule": ("gb_title_rule", 453),      # 453×12
}
# 使っていない原画: gb_gauge（ゲームのゲージは高さ 4〜8px の棒で、飾りつきの枠は読めない大きさになる）、
# hidane_small_sheet_a/b（大きい絵を縮めたほうが、財布の大きさでも形と質感が残る）
# 正方形のマスの中央に置く部品（丸い部品。縦横の差は数 px）
SQUARE = {"socket", "badge_cost", "badge_check", "badge_unknown", "round_btn"}


def _grow(mask, times):
    """True の範囲を 8 方向に times px 広げる。"""
    for _ in range(times):
        p = np.pad(mask, 1)
        mask = (p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
                | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:])
    return mask


def key_magenta(im):
    """マゼンタの地を透過にする。
    地との境目の画素（地から 3px 以内でマゼンタが混ざった画素）は、色を内側のいちばん近い画素から取り、
    透過は「内側の色とマゼンタの混ざり具合」から出す。こうすると縁にマゼンタも緑も残らない
    （ラベンダーの細い線は、ただ引き算するとマゼンタを引きすぎて緑に寄る）。"""
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.clip((np.minimum(r, b) - g) / 255.0, 0, 1)  # マゼンタらしさ（地は 1、ラベンダーの線は 0.13 ほど）
    bg = m > 0.85
    band = ~bg & (m > 0.30) & _grow(bg, 3)
    core = ~bg & ~band
    color, m_core, known = a.copy(), m.copy(), core.copy()
    for _ in range(5):  # 内側の色と、そのマゼンタらしさを、境目へ 1px ずつ伸ばす
        if not (band & ~known).any():
            break
        pk = np.pad(known, 1).astype(np.float32)
        pc = np.pad(np.where(known[..., None], color, 0), ((1, 1), (1, 1), (0, 0)))
        pm = np.pad(np.where(known, m_core, 0), 1)
        count = np.zeros_like(m)
        csum, msum = np.zeros_like(a), np.zeros_like(m)
        h, w = m.shape
        for dy in (0, 1, 2):
            for dx in (0, 1, 2):
                if dy == 1 and dx == 1:
                    continue
                count += pk[dy:dy + h, dx:dx + w]
                csum += pc[dy:dy + h, dx:dx + w]
                msum += pm[dy:dy + h, dx:dx + w]
        fill = band & ~known & (count > 0)
        color[fill] = csum[fill] / count[fill][:, None]
        m_core[fill] = msum[fill] / count[fill]
        known = known | fill
    lone = band & ~known  # 近くに内側が無い粒（細い線の先など）は、そのままの色で
    mix = 1 - np.clip((m - m_core) / np.maximum(1 - m_core, 1e-3), 0, 1)
    alpha = np.where(core, 1.0, np.where(bg, 0.0, np.where(lone, 1 - np.clip((m - 0.3) / 0.55, 0, 1), mix)))
    out = np.dstack([np.where(core[..., None] | lone[..., None], a, color), alpha * 255])
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def key_black(im):
    """真っ黒の地に描いた光を、明るさ＝透過の絵にする（普通に重ねても光として足される）。"""
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    alpha = a.max(-1)
    safe = np.maximum(alpha, 1.0)
    rgb = np.clip(a / safe[..., None] * 255, 0, 255)
    return Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), "RGBA")


def trim(im):
    box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    return im.crop(box) if box else im


def white_gold(im):
    """白火を白金に寄せる（形と明暗はそのまま、色だけを白金の3色に置き換える）。"""
    a = np.asarray(im).astype(np.float32)
    rgb, alpha = a[..., :3] / 255.0, a[..., 3:]
    lum = (rgb * np.array([0.299, 0.587, 0.114])).sum(-1)
    lo, hi = np.percentile(lum[alpha[..., 0] > 200], [2, 99.5])
    t = np.clip((lum - lo) / (hi - lo), 0, 1) ** WHITE_FIRE["gamma"]
    xs = [stop[0] for stop in WHITE_FIRE["stops"]]
    out = np.stack([np.interp(t, xs, [stop[1][i] / 255.0 for stop in WHITE_FIRE["stops"]]) for i in range(3)], -1)
    return Image.fromarray(np.dstack([np.clip(out, 0, 1) * 255, alpha]).astype(np.uint8), "RGBA")


def fire(kind, variant):
    im = trim(key_magenta(Image.open(SRC / f"hidane_{kind}_{variant}.png")))
    if kind == "any":
        im = white_gold(im)
    side = round(FIRE_SIZE * FIRE_FILL[kind])
    scale = side / max(im.size)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (FIRE_SIZE, FIRE_SIZE), (0, 0, 0, 0))
    canvas.paste(im, ((FIRE_SIZE - im.width) // 2, (FIRE_SIZE - im.height) // 2))
    return canvas


def part(name):
    src, long_side = PARTS[name]
    im = trim(key_magenta(Image.open(SRC / f"{src}.png")))
    if name in SQUARE:
        side = max(im.size)
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
        im = canvas
    scale = long_side / max(im.size)
    return im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)


def dim(im):
    """選んでいない札: 選んでいる札（黒いガラス）の金の線を落として暗くしたもの。"""
    a = np.asarray(im).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3:]
    gray = (rgb * np.array([0.299, 0.587, 0.114])).sum(-1, keepdims=True)
    out = (gray * 0.7 + rgb * 0.3) * 0.5 + np.array([10, 6, 16], np.float32)
    return Image.fromarray(np.dstack([np.clip(out, 0, 255), alpha]).astype(np.uint8), "RGBA")


def save(name, im, done, quality=90):
    dst = OUT / f"{name}.webp"
    im.save(dst, "WEBP", quality=quality, method=6, lossless=False, exact=False)
    done.append((name, dst, im))
    print(f"{name}: {im.size} -> {dst.relative_to(ROOT)} {dst.stat().st_size / 1024:.1f}KB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fire", choices=["a", "b"], default="a", help="火種の案（A＝火を封じた玉／B＝熾った火の粒）")
    ap.add_argument("--sheet", action="store_true", help="確認用の一覧 contact_sheet.png も作る")
    args = ap.parse_args()
    if not (SRC / "hidane_any_a.png").exists() or (SRC / "hidane_any_a.png").stat().st_size < 1024:
        print("原画がありません（LFS の実体を取得してください）", file=sys.stderr)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    done = []
    for kind in KINDS:
        save(f"hidane_{kind}", fire(kind, args.fire), done)
    for name in PARTS:
        save(name, part(name), done)
    save("tab_dim", dim(part("tab_on")), done)
    rays = key_black(Image.open(SRC / "burst_rays.png")).resize((512, 512), Image.LANCZOS)
    save("burst_rays", rays, done, quality=82)
    print(f"total {sum(d.stat().st_size for _, d, _ in done) // 1024}KB ({len(done)} files)・火種は {args.fire.upper()}案")
    if args.sheet:
        cell, cols = 200, 5
        rows = (len(done) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cell, rows * (cell + 24)), (24, 16, 32))
        draw = ImageDraw.Draw(sheet)
        for i, (name, _, im) in enumerate(done):
            x, y = (i % cols) * cell, (i // cols) * (cell + 24)
            thumb = im.convert("RGBA")
            thumb.thumbnail((cell - 16, cell - 16))
            sheet.paste(thumb, (x + (cell - thumb.width) // 2, y + 4 + (cell - 8 - thumb.height) // 2), thumb)
            draw.text((x + 6, y + cell), name, fill=(244, 210, 122))
        sheet.save(HERE / "contact_sheet.png")
        print("contact_sheet.png written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
