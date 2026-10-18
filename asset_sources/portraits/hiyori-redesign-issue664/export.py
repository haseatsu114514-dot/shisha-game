#!/usr/bin/env python3
"""Export approved Hiyori source PNGs to 896x1200 sprites at cast height."""
import argparse
from pathlib import Path
from PIL import Image

FACES = ('normal', 'sad', 'smile', 'surprise', 'tears', 'serious',
         'love_blush', 'student_smile', 'axe_normal', 'axe_laugh',
         'axe_shout', 'axe_throw', 'office_mukii')
CANVAS = (896, 1200)
TARGET_HEIGHT = 1000
BASELINE = 1173
ALPHA_CUTOFF = 16


def export(src: Path, dst: Path):
    image = Image.open(src).convert('RGBA')
    a = image.getchannel('A').point(lambda value: 0 if value < ALPHA_CUTOFF else value)
    image.putalpha(a)
    bbox = a.getbbox()
    if not bbox:
        raise ValueError(f'Empty source: {src}')
    figure = image.crop(bbox)
    width = round(figure.width * TARGET_HEIGHT / figure.height)
    if width > CANVAS[0] - 32:
        raise ValueError(f'Figure too wide for canvas: {src} ({width}px)')
    figure = figure.resize((width, TARGET_HEIGHT), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
    canvas.alpha_composite(figure, ((CANVAS[0] - width) // 2, BASELINE - TARGET_HEIGHT))
    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst, optimize=True)
    box = canvas.getchannel('A').point(lambda value: 255 if value >= 24 else 0).getbbox()
    print(f'{src.name}: bbox={box}, bytes={dst.stat().st_size}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source-dir', type=Path, required=True)
    ap.add_argument('--output-dir', type=Path, required=True)
    args = ap.parse_args()
    for face in FACES:
        export(args.source_dir / f'{face}-source.png', args.output_dir / f'chr_hiyori_{face}.png')


if __name__ == '__main__':
    main()
