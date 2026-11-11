"""#3207 / AXR14: 採用済みの斧投げUI部品（PR #3210）から、色違い2枚を作り、CSS に要る寸法を測る。

使い方（リポジトリの直下で）: python3 -I asset_sources/ui/axe-focus-ui-20261111/tools/make_axe_ui.py
- 入力: assets/ui/axe_throw/tag-slate.png・tag-selected.png、remake/img/ui/axe_throw/*.webp（PR #3210 の採用版）
- 出力: assets/ui/axe_throw/tag-slate-blue.png・tag-selected-amber.png と、同じ名前の remake/img/ui/axe_throw/*.webp
        asset_sources/ui/axe-focus-ui-20261111/tools/geometry.json（各部品の画像寸法・絵の外接範囲・ゲージの溝・針の矢じり）
色違いは元の絵と同じ寸法・同じ形のまま、面の色だけを変える（ふちの木・真鍮・光り方は元のまま）。
"""
import json, colorsys
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[4]
ADOPT = ROOT / "assets/ui/axe_throw"
DISP = ROOT / "remake/img/ui/axe_throw"
OUT = Path(__file__).resolve().parent / "geometry.json"

def hsv(arr):
    rgb = arr[:, :, :3].astype(float) / 255
    mx, mn = rgb.max(2), rgb.min(2); d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    h = np.select([d < 1e-6, mx == r, mx == g], [0, ((g - b) / np.maximum(d, 1e-6)) % 6, (b - r) / np.maximum(d, 1e-6) + 2], (r - g) / np.maximum(d, 1e-6) + 4) / 6
    return h, s, mx

def from_hsv(h, s, v):
    i = np.floor(h * 6).astype(int) % 6; f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    return np.stack([np.choose(i, c) for c in ((v, q, p, p, t, v), (t, v, v, q, p, p), (p, p, t, v, v, q))], -1)

def face_mask(arr, inset_ratio):
    """面（ふちの内側）: 外接範囲を ふちの厚み ぶん内側へ縮めた矩形のうち、不透明な画素。"""
    a = arr[:, :, 3]; ys, xs = np.where(a > 128)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    k = int((y1 - y0) * inset_ratio)
    yy, xx = np.mgrid[0:arr.shape[0], 0:arr.shape[1]]
    return (yy > y0 + k) & (yy < y1 - k) & (xx > x0 + k) & (xx < x1 - k) & (a > 200)

def shift_to(arr, mask, target_hex, keep_texture=True):
    """面の色の中央値を target へずらす。明暗の起伏（質感・光）は保つ。"""
    target = np.array([int(target_hex[i:i + 2], 16) for i in (1, 3, 5)], float)
    out = arr.astype(float)
    out[mask, :3] += target - np.median(out[mask][:, :3], 0)
    return np.clip(out, 0, 255).round().astype(np.uint8)

def recolor_hue(arr, mask, target_hex):
    """面の色相だけを target へ（彩度と明るさの比を保つ）。光の反射の白い所は残る。"""
    th, ts, tv = colorsys.rgb_to_hsv(*[int(target_hex[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    h, s, v = hsv(arr)
    sel = mask & (s > .4)
    s0, v0 = np.median(s[sel]), np.median(v[sel])
    rgb = from_hsv(np.full_like(h, th), np.clip(s * ts / s0, 0, 1), np.clip(v * tv / v0, 0, 1)) * 255
    w = np.clip((s - .03) / .12, 0, 1) * mask  # 薄い光の所（彩度が低い青）も同じ色相へ寄せる
    out = arr.astype(float)
    out[:, :, :3] = out[:, :, :3] * (1 - w[:, :, None]) + rgb * w[:, :, None]
    return np.clip(out, 0, 255).round().astype(np.uint8)

def save_pair(name, arr, display_size):
    im = Image.fromarray(arr)
    im.save(ADOPT / f"{name}.png", optimize=True)
    d = im.resize(display_size, Image.LANCZOS)
    d.save(DISP / f"{name}.webp", "WEBP", quality=90, method=6, exact=True)

slate = np.array(Image.open(ADOPT / "tag-slate.png").convert("RGBA"))
selected = np.array(Image.open(ADOPT / "tag-selected.png").convert("RGBA"))
disp_size = Image.open(DISP / "tag-slate.webp").size
# 選んでいない青（キルショット）の札: 黒板の面だけを濃紺 #153a5c 系へずらす
save_pair("tag-slate-blue", shift_to(slate, face_mask(slate, .08), "#153a5c"), disp_size)
# 選んだ「通常」の札: 真鍮の枠の札の青い面だけを、レーンの橙 #ff8c3a 系へ（青はキルショットの意味なので）
h, s, v = hsv(selected)
blue = (h > .5) & (h < .72) & (selected[:, :, 3] > 0)  # 枠は金色なので、青い色相の画素は全部が面
save_pair("tag-selected-amber", recolor_hue(selected, blue, "#ff8c3a"), disp_size)

geometry = {}
for path in sorted(DISP.glob("*.webp")):
    if not path.stem.startswith(("button-throw-", "gauge-", "tag-")): continue
    arr = np.array(Image.open(path).convert("RGBA")); a = arr[:, :, 3]
    ys, xs = np.where(a > 128)
    geometry[path.stem] = {"image": [arr.shape[1], arr.shape[0]], "object": [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]}
# ゲージの溝（色の帯を入れる黒い内側）: 枠の真ん中の行と列で、暗い溝の範囲を測る
g = np.array(Image.open(DISP / "gauge-frame.webp").convert("RGBA")).astype(float)
gh, gw = g.shape[:2]
lum = g[:, :, :3] @ [.299, .587, .114]
row = (lum[gh // 2] < 40) & (g[gh // 2, :, 3] > 200)
col = (lum[:, gw // 2] < 40) & (g[:, gw // 2, 3] > 200)
xs = np.where(row)[0]; ys = np.where(col)[0]
mid = gw // 2
# 真ん中の列を含む連続した暗い範囲だけ（枠の外の暗い所を拾わない）
def run(idx, center):
    idx = list(idx); best = [i for i in idx if abs(i - center) <= 1] or [min(idx, key=lambda i: abs(i - center))]
    lo = hi = best[0]
    while lo - 1 in idx: lo -= 1
    while hi + 1 in idx: hi += 1
    return lo, hi
x0, x1 = run(xs, mid); y0, y1 = run(ys, gh // 2)
geometry["gauge-frame"]["slot"] = [int(x0), int(y0), int(x1) + 1, int(y1) + 1]
# 針の矢じりの先: 不透明な列の高さが、棒の太さまで細くなる最初の列
n = np.array(Image.open(DISP / "gauge-needle.webp").convert("RGBA"))[:, :, 3] > 128
heights = n.sum(0); xs = np.where(heights > 0)[0]
bar = int(np.median(heights[xs[len(xs) // 2 - 20: len(xs) // 2 + 20]]))
tip = next(int(x) for x in xs if heights[x] <= bar + 2 and x > xs[0] + 5)
geometry["gauge-needle"]["bar_height"] = bar; geometry["gauge-needle"]["tip_x"] = tip
OUT.write_text(json.dumps(geometry, indent=2) + "\n")
print(json.dumps(geometry, indent=2))
