# 心得の盤の店番のスキル（K28〜K30。SBD157）のアイコン。既存（skill_K25〜K27）と同じクリーム色のモノライン 64x64。
# 使い方: python3 asset_sources/ui/growth-board-floor-skills-20261127/make_icons.py remake/img/ui/growth_board/icons
# 8倍で描いて縮め、薄い光をにじませる。
import math, sys
from PIL import Image, ImageDraw, ImageFilter
S = 8; N = 64 * S
INK = (255, 255, 234, 255)
W = int(3.1 * S)  # 線の太さ（既存と同じ約3px）

def canvas():
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0)); return im, ImageDraw.Draw(im)
def P(x, y): return (x * S, y * S)
def line(d, pts, w=W):
    pts = [P(*p) for p in pts]
    d.line(pts, fill=INK, width=w, joint="curve")
    for p in (pts[0], pts[-1]):
        d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=INK)
def circle(d, cx, cy, r, w=W):
    d.ellipse([P(cx - r, cy - r), P(cx + r, cy + r)], outline=INK, width=w)
def dot(d, cx, cy, r):
    d.ellipse([P(cx - r, cy - r), P(cx + r, cy + r)], fill=INK)
def curve(d, f, t0, t1, n=80, w=W):
    line(d, [f(t0 + (t1 - t0) * i / n) for i in range(n + 1)], w)
def star(d, cx, cy, r):
    k = 0.32
    pts = []
    for i in range(8):
        a = -math.pi / 2 + i * math.pi / 4
        rr = r if i % 2 == 0 else r * k
        pts.append(P(cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=INK)
def finish(im, path):
    small = im.resize((64, 64), Image.LANCZOS)
    glow = small.getchannel("A").filter(ImageFilter.GaussianBlur(2.2)).point(lambda v: int(v * 0.10))
    base = Image.new("RGBA", (64, 64), (255, 255, 255, 0)); base.putalpha(glow)
    out = Image.alpha_composite(base, small)
    out.save(path, "WEBP", lossless=True)
    return out

def k28():  # 売り上手: 円の硬貨と、上へ伸びる矢印（歩合が上がる）
    im, d = canvas()
    circle(d, 25, 37, 17)
    line(d, [(19, 28), (25, 36), (31, 28)]); line(d, [(25, 36), (25, 47)])
    line(d, [(19.5, 39), (30.5, 39)]); line(d, [(19.5, 43.5), (30.5, 43.5)])
    line(d, [(52, 50), (52, 13)]); line(d, [(45, 20), (52, 13), (59, 20)])
    return im
def k29():  # 波に乗る: 波と、その上に広がる三つの灯り（フィーバーが3卓へ）
    im, d = canvas()
    curve(d, lambda t: (t, 44 + 5 * math.sin((t - 6) / 52 * 2 * math.pi * 1.5)), 6, 58)
    curve(d, lambda t: (t, 55 + 4 * math.sin((t - 12) / 40 * 2 * math.pi * 1.25)), 12, 52)
    star(d, 13, 25, 7.5); star(d, 32, 15, 9.5); star(d, 51, 25, 7.5)
    return im
def k30():  # フロアを読む: 目と、その下の三つの卓
    im, d = canvas()
    curve(d, lambda t: (t, 19 - 10 * math.sin((t - 12) / 40 * math.pi)), 12, 52)
    curve(d, lambda t: (t, 19 + 10 * math.sin((t - 12) / 40 * math.pi)), 12, 52)
    dot(d, 32, 19, 5.2)
    for x, y in ((13, 50), (32, 54), (51, 50)):
        circle(d, x, y, 6.2)
    line(d, [(23, 33), (18, 40)]); line(d, [(32, 34), (32, 43)]); line(d, [(41, 33), (46, 40)])
    return im

out = sys.argv[1]
made = {k: finish(f(), f"{out}/skill_{k}.webp") for k, f in (("K28", k28), ("K29", k29), ("K30", k30))}
