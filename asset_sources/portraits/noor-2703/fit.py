#!/usr/bin/env python3
"""Fit Noor source portraits to the 896x1200 standing-portrait canvas."""
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).resolve().parent
for style in ('new', 'nanami'):
    out_dir = ROOT / 'assets/sprites/character_variants' / style / 'noor'
    out_dir.mkdir(parents=True, exist_ok=True)
    for expression in ('normal', 'smile', 'surprise'):
        source = Image.open(SOURCE / style / f'{expression}-source.png').convert('RGBA')
        alpha = np.asarray(source.getchannel('A'))
        ys, xs = np.where(alpha >= 24)
        left, top, right, bottom = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
        crop = source.crop((left, top, right, bottom))
        # Generator leaves red/yellow guide pixels at alpha 1-4 around the cutout.
        # They are invisible in-game but contaminate some viewers and WebP edges.
        pixels = np.asarray(crop).copy()
        pixels[pixels[..., 3] < 24] = 0
        crop = Image.fromarray(pixels, 'RGBA')
        scale = min(1080 / crop.height, 850 / crop.width)
        size = (round(crop.width * scale), round(crop.height * scale))
        resized = crop.resize(size, Image.Resampling.LANCZOS)
        pixels = np.asarray(resized).copy()
        pixels[pixels[..., 3] < 24] = 0
        resized = Image.fromarray(pixels, 'RGBA')
        canvas = Image.new('RGBA', (896, 1200))
        canvas.alpha_composite(resized, ((896-size[0])//2, 1140-size[1]))
        dest = out_dir / f'chr_noor_{expression}.png'
        canvas.save(dest, optimize=True)
        print(f'{dest.relative_to(ROOT)}: source bbox={(left,top,right,bottom)}, scale={scale:.5f}, output bbox={canvas.getbbox()}')
