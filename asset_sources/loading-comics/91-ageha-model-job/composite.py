#!/usr/bin/env python3
"""採用原画 raw/v1-b.png の②のポスターの空白に poster.png（render_poster.js の出力）をはめ込み、
原画 91-ageha-model-job.png を作る。空白の位置は白い画素の行・列から検出する。"""
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

HERE = Path(__file__).resolve().parent
im = Image.open(HERE / "raw/v1-b.png").convert("RGB")
a = np.asarray(im).astype(int)
Y0, X0 = 280, 880
white = a[Y0:600, X0:1300].min(axis=2) > 243
rows = np.where(white.mean(axis=1) > 0.6)[0]; cols = np.where(white.mean(axis=0) > 0.6)[0]
x0, x1, y0, y1 = cols.min() + X0, cols.max() + X0, rows.min() + Y0, rows.max() + Y0
w, h = x1 - x0 + 1, y1 - y0 + 1
poster = Image.open(HERE / "poster.png").convert("RGB").resize((w, h), Image.LANCZOS)
poster = poster.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
im.paste(poster, (x0, y0))
im.save(HERE / "91-ageha-model-job.png")
print("poster area", (x0, y0, w, h))
