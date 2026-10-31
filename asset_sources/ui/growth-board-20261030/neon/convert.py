#!/usr/bin/env python3
"""生成した原画（このフォルダの *.png）をゲーム用の WebP に変換する（GB03 5.2 の大きさ）。縮小・切り出しだけで、色は触らない。

  python3 asset_sources/ui/growth-board-20261030/neon/convert.py          # 変換
  python3 asset_sources/ui/growth-board-20261030/neon/convert.py --sheet  # 確認用の一覧 contact_sheet.png も作る
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / "remake" / "img" / "ui" / "growth_board"

# name: (出力の幅, 出力の高さ, 透過を残すか, 透過部分を外接矩形で切り詰めるか)
TARGETS = {
    "board_glass": (1520, 976, False, False),
    "screen_backdrop": (1920, 1080, False, False),
    "hub_body": (256, 256, True, True), "hub_sense": (256, 256, True, True), "hub_wisdom": (256, 256, True, True),
    "frame_skill": (192, 192, True, True), "frame_lesson": (192, 192, True, True), "frame_gate": (160, 160, True, True),
    "frame_peak": (208, 208, True, True), "frame_seal": (192, 192, True, True),
    "wall_seal": (192, 64, True, True), "silhouette_unknown": (160, 160, True, True),
    "hidane_any": (96, 96, True, True), "hidane_body": (96, 96, True, True), "hidane_sense": (96, 96, True, True), "hidane_wisdom": (96, 96, True, True),
    "panel_frame": (192, 192, True, False),
}


def fit(im, w, h, alpha, trim):
    im = im.convert("RGBA" if alpha else "RGB")
    if alpha and trim:
        box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        if box:
            im = im.crop(box)
        # 正方形の中央に収める（縮小後に余白を少し残す）
        side = max(im.size)
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
        im = canvas
    scale = max(w / im.width, h / im.height)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    left, top = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((left, top, left + w, top + h))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    done = []
    for name, (w, h, alpha, trim) in TARGETS.items():
        src = HERE / f"{name}.png"
        if not src.exists():
            print("skip (no source):", name)
            continue
        im = fit(Image.open(src), w, h, alpha, trim)
        dst = OUT / f"{name}.webp"
        im.save(dst, "WEBP", quality=88, method=6, lossless=False)
        done.append((name, dst, im))
        print(f"{name}: {im.size} -> {dst.relative_to(ROOT)} {dst.stat().st_size // 1024}KB")
    total = sum(d.stat().st_size for _, d, _ in done)
    print(f"total {total // 1024}KB ({len(done)} files)")
    if "--sheet" in sys.argv and done:
        cell, cols = 200, 5
        rows = (len(done) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cell, rows * (cell + 24)), (12, 10, 16))
        draw = ImageDraw.Draw(sheet)
        for i, (name, _, im) in enumerate(done):
            x, y = (i % cols) * cell, (i // cols) * (cell + 24)
            thumb = im.convert("RGBA")
            thumb.thumbnail((cell - 16, cell - 16))
            sheet.paste(thumb, (x + (cell - thumb.width) // 2, y + 4 + (cell - 8 - thumb.height) // 2), thumb)
            draw.text((x + 6, y + cell), name, fill=(244, 210, 122))
        sheet.save(HERE / "contact_sheet.png")
        print("contact_sheet.png written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
