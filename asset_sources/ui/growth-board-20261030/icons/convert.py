#!/usr/bin/env python3
"""生成したアイコン（このフォルダの *.png）を 64×64 の WebP に（remake/img/ui/growth_board/icons/）。外接矩形で切り詰めて中央に置く。色は触らない。

  python3 asset_sources/ui/growth-board-20261030/icons/convert.py [--sheet]
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / "remake" / "img" / "ui" / "growth_board" / "icons"
SIZE = 64


def fit(im):
    im = im.convert("RGBA")
    box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if box:
        im = im.crop(box)
    side = max(im.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    done = []
    for src in sorted(HERE.glob("*.png")):
        if src.name == "contact_sheet.png":
            continue
        im = fit(Image.open(src))
        dst = OUT / f"{src.stem}.webp"
        im.save(dst, "WEBP", quality=90, method=6)
        done.append((src.stem, im))
    total = sum((OUT / f"{n}.webp").stat().st_size for n, _ in done)
    print(f"{len(done)} icons, total {total // 1024}KB")
    if "--sheet" in sys.argv:
        cell, cols = 96, 8
        rows = (len(done) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cell, rows * (cell + 16)), (12, 10, 16))
        draw = ImageDraw.Draw(sheet)
        for i, (name, im) in enumerate(done):
            x, y = (i % cols) * cell, (i // cols) * (cell + 16)
            sheet.paste(im, (x + 16, y + 8), im)
            draw.text((x + 4, y + cell - 4), name[:14], fill=(244, 210, 122))
        sheet.save(HERE / "contact_sheet.png")
        print("contact_sheet.png written")


if __name__ == "__main__":
    sys.exit(main())
