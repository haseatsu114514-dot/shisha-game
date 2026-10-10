#!/usr/bin/env python3
"""生成アトラスをUI部品に切り出す。原画・色・アルファは保持する。"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "asset_sources/ui/continue-v4-20261010/generated"
OUT = ROOT / "assets/ui/continue"


def part(source, name, row=None):
    image = Image.open(SOURCE / f"{source}.png")
    if row is not None:
        image = image.crop((0, row * 512, image.width, (row + 1) * 512))
    alpha = image.getchannel("A")
    box = alpha.point(lambda value: 255 if value >= 24 else 0).getbbox()
    if not box:
        raise ValueError(f"Empty generated component: {name}")
    # 低アルファの広い余白だけ除き、輪郭の外に8pxの透明な余裕を残す。
    x0, y0, x1, y1 = box
    image = image.crop((max(0, x0 - 8), max(0, y0 - 8),
                        min(image.width, x1 + 8), min(image.height, y1 + 8)))
    image.save(OUT / f"{name}.png", optimize=True)
    print(f"{name}: {image.width}x{image.height}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    part("titles", "continue_title", 0)
    part("titles", "game_over_title", 1)
    part("buttons", "retry_button", 0)
    part("buttons", "quit_button", 1)
    part("stamp", "approval_stamp")
    Image.open(SOURCE / "backdrop.png").save(OUT / "backdrop.png", optimize=True)


if __name__ == "__main__":
    main()
