"""#3207 / AXR14: Codex の原画から、ゲームで使う斧投げUI部品を作る（切り抜き・小さな修正・書き出し）。
使い方: python3 -I make_axe_ui.py <raw_dir> <adopted_png_dir> <display_webp_dir> <report_json>
"""
import sys, json, colorsys, hashlib
from PIL import Image
import numpy as np

RAW, ADOPT, DISP, REPORT = sys.argv[1:5]

def load(name):
    return Image.open(f"{RAW}/{name}.png").convert("RGBA")

def crop(im, thr=8):
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > thr)
    out = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    arr = np.array(out); arr[arr[:, :, 3] <= thr, 3] = 0  # 板の外の微小なalphaを消す（板の画素は変えない）
    return Image.fromarray(arr)

def hsv_arrays(arr):
    rgb = arr[:, :, :3].astype(float) / 255
    mx = rgb.max(2); mn = rgb.min(2); d = mx - mn
    v = mx; s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    h = np.zeros_like(mx)
    m = d > 1e-6
    rc = np.where(m & (mx == r), ((g - b) / np.maximum(d, 1e-6)) % 6, 0)
    gc = np.where(m & (mx == g) & (mx != r), (b - r) / np.maximum(d, 1e-6) + 2, 0)
    bc = np.where(m & (mx == b) & (mx != r) & (mx != g), (r - g) / np.maximum(d, 1e-6) + 4, 0)
    h = (rc + gc + bc) / 6
    return h, s, v

def hsv_to_rgb(h, s, v):
    i = np.floor(h * 6).astype(int) % 6; f = h * 6 - np.floor(h * 6)
    p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s)
    choices = [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    out = np.zeros(h.shape + (3,))
    for k, (a, b, c) in enumerate(choices):
        sel = i == k
        out[sel, 0] = a[sel]; out[sel, 1] = b[sel]; out[sel, 2] = c[sel]
    return out

def recolor(im, src_mask_fn, target_hex, region=None):
    """面の色だけを別の色へ塗り替える（明暗の起伏は保つ）。縁・ふち・影の低彩度の画素は残す。"""
    arr = np.array(im).astype(float)
    h, s, v = hsv_arrays(arr)
    weight = src_mask_fn(h, s, v)
    if region is not None: weight = weight * region
    ref = weight > .9
    s0, v0 = np.median(s[ref]), np.median(v[ref])
    th, ts, tv = colorsys.rgb_to_hsv(*[int(target_hex[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    nh = np.full_like(h, th); ns = np.clip(s * ts / s0, 0, 1); nv = np.clip(v * tv / v0, 0, 1)
    rgb = hsv_to_rgb(nh, ns, nv) * 255
    w = weight[:, :, None]
    arr[:, :, :3] = arr[:, :, :3] * (1 - w) + rgb * w
    return Image.fromarray(np.clip(arr, 0, 255).round().astype(np.uint8))

report = {}
def save(name, im, display_size, adopt_size):
    a = im.copy(); a.thumbnail(adopt_size, Image.LANCZOS); a.save(f"{ADOPT}/{name}.png", optimize=True)
    d = im.copy(); d.thumbnail(display_size, Image.LANCZOS)
    d.save(f"{DISP}/{name}.webp", "WEBP", quality=90, method=6, exact=True)
    report[name] = {"display": list(d.size), "adopted": list(a.size)}
    return d

# 1) 投げる札（橙）: 原画のまま切り抜く
orange = crop(load("button-throw-orange"))
# 2) 投げる札（緑）: Codex の緑は中央の透過に穴（alpha 最小153）と色むらがあるため使わず、橙を塗り替えて作る（形は橙と同じ）
orange_face = lambda h, s, v: np.clip((s - .35) / .3, 0, 1) * ((h < .14) | (h > .97))
green = recolor(orange, orange_face, "#b8e5aa")
# 3) 札（黒板）: 原画のまま
slate = crop(load("tag-slate"))
# 4) 選んだ札（青）: 中央の青い面の四角い透過の穴（alpha 最小211）と白い点を、面の左右の端のきれいな青で塗り直す
sel = crop(load("tag-selected"))
arr = np.array(sel).astype(float)
h, s, v = hsv_arrays(arr)
blue = (h > .52) & (h < .64) & (s > .45) & (arr[:, :, 3] > 200)
ys, xs = np.where(blue)
y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
H, W = y1 - y0, x1 - x0
pad = 3
ry0, ry1, rx0, rx1 = y0 + pad, y1 - pad, x0 + pad, x1 - pad
corner = int(H * .08)
yy, xx = np.mgrid[0:arr.shape[0], 0:arr.shape[1]]
inside = (yy >= ry0) & (yy <= ry1) & (xx >= rx0) & (xx <= rx1)
near_corner = ((yy < ry0 + corner) | (yy > ry1 - corner)) & ((xx < rx0 + corner) | (xx > rx1 - corner))
repaint = inside & (~near_corner | blue)
band = max(6, int(W * .04))
left = arr[:, rx0:rx0 + band, :3]; right = arr[:, rx1 - band:rx1, :3]
lmask = blue[:, rx0:rx0 + band]; rmask = blue[:, rx1 - band:rx1]
lcol = np.zeros((arr.shape[0], 3)); rcol = np.zeros((arr.shape[0], 3))
for y in range(ry0, ry1 + 1):
    lcol[y] = np.median(left[y][lmask[y]], 0) if lmask[y].any() else lcol[y - 1]
    rcol[y] = np.median(right[y][rmask[y]], 0) if rmask[y].any() else rcol[y - 1]
t = np.clip((xx - rx0) / max(1, rx1 - rx0), 0, 1)[:, :, None]
fill = lcol[:, None, :] * (1 - t) + rcol[:, None, :] * t
before_alpha = arr[repaint, 3].min()
arr[repaint, :3] = fill[repaint]; arr[repaint, 3] = 255
selected = Image.fromarray(np.clip(arr, 0, 255).round().astype(np.uint8))
report["tag-selected-repair"] = {"face_box": [int(x0), int(y0), int(x1), int(y1)], "repainted_px": int(repaint.sum()), "alpha_min_before": float(before_alpha)}
# 5) 選んだ「通常」: 同じ札の青い面だけを橙に（青はキルショットの意味なので、通常は橙）
face = np.zeros(arr.shape[:2]); face[repaint | blue] = 1
blue_face = lambda h, s, v: ((h > .5) & (h < .66) & (s > .35)).astype(float)
amber = recolor(selected, blue_face, "#ff8c3a", region=face)
# 5b) 選んでいない青の札: 黒板の札の面だけを濃紺へずらす（チョークの粉の質感は保つ）。ふちの木と真鍮の線は変えない
sarr = np.array(slate).astype(float)
sh, ss, sv = hsv_arrays(sarr)
sy, sx = np.mgrid[0:sarr.shape[0], 0:sarr.shape[1]]
inset = int(sarr.shape[0] * .06)
slate_face = (ss < .45) & (sv < .3) & (sarr[:, :, 3] > 200) & (sy > inset) & (sy < sarr.shape[0] - inset) & (sx > inset) & (sx < sarr.shape[1] - inset)
shift = np.array([0x15, 0x3a, 0x5c], float) - np.median(sarr[slate_face][:, :3], 0)
sarr[slate_face, :3] += shift
slate_blue = Image.fromarray(np.clip(sarr, 0, 255).round().astype(np.uint8))
report["tag-slate-blue"] = {"face_px": int(slate_face.sum()), "shift_rgb": [round(float(x), 1) for x in shift]}
# 6) ゲージの枠・針: 原画のまま
gauge = crop(load("gauge-frame"))
needle = crop(load("gauge-needle"))

# 書き出し（表示用は画面で最大 約3倍に拡大しても足りる大きさ）
save("focus-throw-orange", orange, (1400, 300), (2400, 520))
save("focus-throw-green", green, (1400, 300), (2400, 520))
save("focus-tag-slate", slate, (500, 224), (1600, 720))
save("focus-tag-slate-blue", slate_blue, (500, 224), (1600, 720))
save("focus-tag-selected", selected, (500, 224), (1600, 720))
save("focus-tag-selected-amber", amber, (500, 224), (1600, 720))
save("focus-gauge-frame", gauge, (160, 1600), (200, 1800))
save("focus-needle", needle, (260, 40), (1300, 140))

# ゲージの枠の中の溝（黒い帯を描く場所）を、表示用の画像の画素で測る
g = np.array(Image.open(f"{DISP}/focus-gauge-frame.webp").convert("RGBA")).astype(float)
gh, gw = g.shape[:2]
lum = g[:, :, :3] @ [.299, .587, .114]
row = lum[gh // 2]; col = lum[:, gw // 2]
brass_row = np.where((g[gh // 2, :, 0] > 120) & (g[gh // 2, :, 0] - g[gh // 2, :, 2] > 40))[0]
mid = gw // 2
lb = brass_row[brass_row < mid]; rb = brass_row[brass_row > mid]
brass_col = np.where((g[:, mid, 0] > 120) & (g[:, mid, 0] - g[:, mid, 2] > 40))[0]
tb = brass_col[brass_col < gh // 2]; bb = brass_col[brass_col > gh // 2]
report["gauge-slot"] = {"image": [gw, gh], "left": int(lb.max()) + 1, "right": int(gw - rb.min()), "top": int(tb.max()) + 1, "bottom": int(gh - bb.min())}
# 針の矢じりの先（右向きの三角の頂点）: 不透明な列の高さが最初に細くなる所
n = np.array(Image.open(f"{DISP}/focus-needle.webp").convert("RGBA"))
report["needle"] = {"image": list(n.shape[1::-1])}
json.dump(report, open(REPORT, "w"), indent=2)
print(json.dumps(report, indent=2))
