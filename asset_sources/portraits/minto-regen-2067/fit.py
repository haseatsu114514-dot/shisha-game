#!/usr/bin/env python3
"""raw生成を現行スプライトの高さ・上端・中心(アルファ重心x)に合わせ 896x1200 RGBA に配置。"""
import sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[3]; HERE = Path(__file__).parent
def bbox(a): return a.point(lambda v: 255 if v > 40 else 0).getbbox()
def cx(a):
    a = a.point(lambda v: 255 if v > 40 else 0); w, h = a.size; px = a.load()
    s = n = 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if px[x, y]: s += x; n += 1
    return s / n
def main(name, tag):
    ref = Image.open(ROOT / f"assets/sprites/characters/minto/chr_minto_{name}.png").convert("RGBA")
    raw = Image.open(HERE / f"raw/chr_minto_{name}_{tag}.png").convert("RGBA")
    rb = bbox(ref.split()[3]); gb = bbox(raw.split()[3])
    raw = raw.crop(gb); k = (rb[3] - rb[1]) / raw.height
    raw = raw.resize((round(raw.width * k), rb[3] - rb[1]), Image.LANCZOS)
    a = raw.split()[3].point(lambda v: 0 if v < 8 else v); raw.putalpha(a)
    x = round(cx(ref.split()[3]) - cx(a))
    out = Image.new("RGBA", (896, 1200), (0, 0, 0, 0)); out.alpha_composite(raw, (x, rb[1]))
    out.save(ROOT / f"assets/sprites/characters/minto/chr_minto_{name}.png", optimize=True)
    print(name, "ref", rb, "new", bbox(out.split()[3]))
if __name__ == "__main__":
    tag = sys.argv[1]
    for n in sys.argv[2:]: main(n, tag)
