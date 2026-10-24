"""Reproduce the REJECTED experiment in an explicit directory, never in game assets."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PATCHES = [
    ('ageha', 'sad', [(485, 394), (493, 396), (498, 396), (505, 391), (513, 385), (520, 379)]),
    ('minto', 'normal', [(492, 397), (497, 398), (503, 394), (510, 389), (517, 383), (522, 377)]),
]

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', required=True, type=Path,
                        help='Directory for rejected experiment previews only')
    args = parser.parse_args()
    output = args.output_dir.resolve()
    for protected in ('assets', 'remake'):
        if output == ROOT / protected or ROOT / protected in output.parents:
            parser.error('Rejected experiments must not overwrite game assets')
    output.mkdir(parents=True, exist_ok=True)
    for character, face, points in PATCHES:
        stem = f'{character}-{face}'
        source = Image.open(HERE / f'{stem}-before.png').convert('RGBA')
        generated = Image.open(HERE / f'{stem}-generated.png').convert('RGB')
        patch = source.convert('RGB')
        patch.paste(generated.resize((180, 170), Image.Resampling.LANCZOS), (400, 280))
        mask = Image.new('L', source.size)
        ImageDraw.Draw(mask).line(points, fill=255, width=4, joint='curve')
        mask = mask.filter(ImageFilter.GaussianBlur(.65))
        result = Image.composite(patch, source.convert('RGB'), mask).convert('RGBA')
        result.putalpha(source.getchannel('A'))
        mask.save(output / f'{stem}-mask.png')
        result.save(output / f'{stem}-rejected.png')
