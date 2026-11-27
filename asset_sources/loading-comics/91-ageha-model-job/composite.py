#!/usr/bin/env python3
"""採用した②（raw/v2-panel2-b.png）のスマホの空白の画面に screen.png（render_screen.js の出力）をはめ込み、
panel2.png を作る。画面の位置は白い画素から検出し、角の丸みは白い画素のマスクで合わせる。"""
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

HERE = Path(__file__).resolve().parent
im = Image.open(HERE / "raw/v2-panel2-b.png").convert("RGB")
a = np.asarray(im).astype(int)
X0, Y0, X1, Y1 = 560, 200, 1040, 980
white = a[Y0:Y1, X0:X1].min(axis=2) > 240
rows = np.where(white.mean(axis=1) > 0.5)[0]; cols = np.where(white.mean(axis=0) > 0.5)[0]
x0, x1, y0, y1 = cols.min() + X0, cols.max() + X0, rows.min() + Y0, rows.max() + Y0
w, h = x1 - x0 + 1, y1 - y0 + 1
mask = np.zeros(a.shape[:2], dtype=np.uint8)
inner = a[y0:y1 + 1, x0:x1 + 1].min(axis=2) > 200  # 縁のなじみ（薄い灰色）も画面として塗る
mask[y0:y1 + 1, x0:x1 + 1] = inner * 255
m = Image.fromarray(mask).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
screen = Image.open(HERE / "screen.png").convert("RGB").resize((w, h), Image.LANCZOS)
layer = Image.new("RGB", im.size); layer.paste(screen, (x0, y0))
out = Image.composite(layer, im, m)
out.save(HERE / "panel2.png")
print("screen area", (int(x0), int(y0), int(w), int(h)))
