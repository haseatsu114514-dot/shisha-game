#!/usr/bin/env python3
"""煙の見本（docs/owner_requests.md の KMR）用: 本編の立ち絵と背景を「繊細なドット絵」に変換した見本の絵を作る。

見本（remake/previews/smoke-styles/）だけが読む試作で、本編の絵は書き換えない。
ねらいは 640×360 の升目（1280×720 の画面でドット1つが2px）の細かいドット絵:
  立ち絵: 面積平均で縮小 → 線の濃さを残す → 弱い輪郭強調 → その絵の色から作った少ない色へ寄せる（網点なし）
          → ぽつんと浮いた1ドットを掃除 → 透明度は2値
  背景  : 面積平均で縮小 → 少しだけコントラスト → 少ない色へ寄せる（網点なし）

使い方: python3 remake/previews/smoke-styles/make_pixel_art.py   （Pillow・numpy が必要）
"""
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
IMG = HERE.parents[1] / "img"
OUT = HERE / "img"

GRID_H = 360          # 升目の高さ（画面 720px に対してドット2px）
PORTRAIT_SCALE = 1.5  # 見本での立ち絵の高さ（画面の高さに対する倍率。app.mjs の .chara と同じ）
CELL = 3              # 1ドットを作るのに使う元の画素（3×3）

PORTRAITS = {
    "sumi": "sprites/characters/sumi/chr_sumi_normal.webp",
    "minto": "sprites/characters/minto/chr_minto_normal.webp",
    "tsumugi": "sprites/characters/tsumugi/chr_tsumugi_normal.webp",
}
BACKGROUNDS = {
    "shop": "backgrounds/bg_tonari_inside_night.webp",
    "stage": "backgrounds/bg_tournament_stage.webp",
}


def to_lab(rgb):
    """sRGB(0..1) → OKLab。色の近さを目の感じ方に合わせて測るため"""
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    m = lin @ np.array([[0.4122214708, 0.2119034982, 0.0883024619], [0.5363325363, 0.6806995451, 0.2817188376], [0.0514459929, 0.1073969566, 0.6299787005]])
    return np.cbrt(m) @ np.array([[0.2104542553, 1.9779984951, 0.0259040371], [0.7936177850, -2.4285922050, 0.7827717662], [-0.0040720468, 0.4505937099, -0.8086757660]])


def palette_of(rgb, weight, colors, rounds=14, seed=7):
    """その絵の色から colors 色を選ぶ（k-means・OKLab）。rgb: (n,3) 0..1"""
    lab = to_lab(rgb)
    rng = np.random.default_rng(seed)
    # 明るさ順に並べて等間隔に取った色から始める（暗い線の色と明るい色を必ず含める）
    order = np.argsort(lab[:, 0])
    centers = lab[order[np.linspace(0, len(order) - 1, colors).astype(int)]].copy()
    centers += rng.normal(0, 1e-3, centers.shape)
    for _ in range(rounds):
        idx = nearest(lab, centers)
        for k in range(colors):
            sel = idx == k
            if sel.any():
                centers[k] = np.average(lab[sel], axis=0, weights=weight[sel])
            else:
                centers[k] = lab[rng.integers(len(lab))]
    idx = nearest(lab, centers)
    out = np.zeros((colors, 3))
    for k in range(colors):
        sel = idx == k
        out[k] = np.average(rgb[sel], axis=0, weights=weight[sel]) if sel.any() else 0
    return out


def nearest(lab, centers):
    idx = np.empty(len(lab), dtype=np.int32)
    for a in range(0, len(lab), 60000):
        part = lab[a:a + 60000]
        idx[a:a + 60000] = np.argmin(((part[:, None, :] - centers[None, :, :]) ** 2).sum(-1), axis=1)
    return idx


def pool(arr, cell):
    h, w = arr.shape[0] // cell, arr.shape[1] // cell
    return arr[:h * cell, :w * cell].reshape(h, cell, w, cell, -1)


def sharpen(rgb, amount):
    """弱い輪郭強調（上下左右の平均との差を足す）"""
    pad = np.pad(rgb, ((1, 1), (1, 1), (0, 0)), mode="edge")
    blur = (pad[:-2, 1:-1] + pad[2:, 1:-1] + pad[1:-1, :-2] + pad[1:-1, 2:]) / 4
    return np.clip(rgb + (rgb - blur) * amount, 0, 1)


def tidy(index, alpha, pal_lab):
    """ぽつんと浮いた1ドット（上下左右のどれとも違う色）を、いちばん近い隣の色にそろえる。
    目の光のように、隣よりはっきり明るい1ドットは残す。"""
    out = index.copy()
    h, w = index.shape
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if not alpha[y, x]:
                continue
            c = index[y, x]
            near = [index[y - 1, x], index[y + 1, x], index[y, x - 1], index[y, x + 1]]
            solid = [alpha[y - 1, x], alpha[y + 1, x], alpha[y, x - 1], alpha[y, x + 1]]
            if c in near or not all(solid):
                continue
            if pal_lab[c, 0] - max(pal_lab[n, 0] for n in near) > 0.08:
                continue
            out[y, x] = min(near, key=lambda n: ((pal_lab[n] - pal_lab[c]) ** 2).sum())
    return out


def portrait(src, colors=44):
    im = Image.open(src).convert("RGBA")
    gh = round(GRID_H * PORTRAIT_SCALE)
    gw = round(im.width * gh / im.height)
    big = np.asarray(im.resize((gw * CELL, gh * CELL), Image.Resampling.LANCZOS), dtype=np.float64) / 255
    cells = pool(big, CELL)                                   # (gh, CELL, gw, CELL, 4)
    a = cells[..., 3:4]
    cover = a.mean(axis=(1, 3))[..., 0]
    rgb = (cells[..., :3] * a).sum(axis=(1, 3)) / np.maximum(a.sum(axis=(1, 3)), 1e-6)
    # 線を残す: 升目の中に暗い線の画素が十分あれば、平均の色を線の色へ寄せる（平均だけだと線が灰色にぼける）
    lum = (cells[..., :3] * np.array([0.299, 0.587, 0.114])).sum(-1)
    dark = (lum < 0.3) & (cells[..., 3] > 0.5)
    share = dark.mean(axis=(1, 3))
    ink = (cells[..., :3] * dark[..., None]).sum(axis=(1, 3)) / np.maximum(dark.sum(axis=(1, 3)), 1)[..., None]
    k = np.clip((share - 0.2) * 2.4, 0, 0.85)[..., None]
    rgb = rgb * (1 - k) + ink * k
    rgb = sharpen(rgb, 0.35)
    # 少しだけ彩度を上げる（縮めると色が濁るぶんを戻す）
    gray = rgb.mean(-1, keepdims=True)
    rgb = np.clip(gray + (rgb - gray) * 1.1, 0, 1)
    solid = cover >= 0.5
    flat = rgb[solid]
    pal = palette_of(flat, np.ones(len(flat)), colors)
    pal_lab = to_lab(pal)
    index = np.zeros(solid.shape, dtype=np.int32)
    index[solid] = nearest(to_lab(flat), pal_lab)
    index = tidy(index, solid, pal_lab)
    out = np.zeros((gh, gw, 4), dtype=np.uint8)
    out[..., :3] = np.round(pal[index] * 255)
    out[..., 3] = np.where(solid, 255, 0)
    return Image.fromarray(out, "RGBA")


def background(src, colors=96):
    im = Image.open(src).convert("RGB")
    gw = round(GRID_H * 16 / 9)
    big = np.asarray(im.resize((gw * CELL, GRID_H * CELL), Image.Resampling.LANCZOS), dtype=np.float64) / 255
    rgb = pool(big, CELL).mean(axis=(1, 3))
    rgb = sharpen(rgb, 0.25)
    rgb = np.clip((rgb - 0.5) * 1.06 + 0.5, 0, 1)
    flat = rgb.reshape(-1, 3)
    pal = palette_of(flat, np.ones(len(flat)), colors)
    index = nearest(to_lab(flat), to_lab(pal)).reshape(rgb.shape[:2])
    return Image.fromarray(np.round(pal[index] * 255).astype(np.uint8), "RGB")


def main():
    OUT.mkdir(exist_ok=True)
    jobs = [(f"dot_{name}.webp", portrait, rel) for name, rel in PORTRAITS.items()]
    jobs += [(f"dot_bg_{name}.webp", background, rel) for name, rel in BACKGROUNDS.items()]
    for file, make, rel in jobs:
        im = make(IMG / rel)
        im.save(OUT / file, "WEBP", lossless=True, quality=100, method=6)  # 色を変えない圧縮（ドットをにじませない）
        print(file, im.size, (OUT / file).stat().st_size)


if __name__ == "__main__":
    main()
