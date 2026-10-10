#!/usr/bin/env python3
"""生成素材をUI部品に切り出し、紫背景と試用ステージを組み込む。

2026-10-10 オーナー指摘「赤黒は怖い」（優しい色にする必要はない）により、
英字ロゴの赤い影を青へ色替えする。可決の朱印は印の色なので保持。
CV20の背景は画像編集で生成した backdrop-purple.png をそのまま採用する。
CV30のGAME OVERは新規の煙・金の透過原画。CV32のステージは1280×720へ縮小。
"""
from pathlib import Path
import shutil
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "asset_sources/ui/continue-v4-20261010/generated"
OUT = ROOT / "assets/ui/continue"


def blue_shadow(image):
    """ロゴの赤い影・網点だけを青へ。クリーム色の文字と黒い縁は変えない。"""
    rgba = image.convert("RGBA")
    hsv = np.asarray(rgba.convert("RGB").convert("HSV")).copy()
    hue, sat = hsv[..., 0].astype(int), hsv[..., 1]
    red = ((hue < 18) | (hue > 236)) & (sat > 110)
    hsv[..., 0] = np.where(red, 148, hsv[..., 0])  # 約209°の青
    recolored = Image.fromarray(hsv, "HSV").convert("RGB")
    recolored.putalpha(rgba.getchannel("A"))
    return recolored


def part(source, name, row=None, recolor=None):
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
    if recolor:
        image = recolor(image)
    image.save(OUT / f"{name}.png", optimize=True)
    print(f"{name}: {image.width}x{image.height}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    part("titles", "continue_title", 0, blue_shadow)
    part("game-over-smoke", "game_over_title")
    part("stamp", "approval_stamp")
    shutil.copyfile(SOURCE / "backdrop-purple.png", OUT / "backdrop.png")
    stage = Image.open(SOURCE / "backdrop-stage.png").convert("RGB")
    stage.resize((1280, 720), Image.Resampling.LANCZOS).save(OUT / "backdrop_stage.png", optimize=True)


if __name__ == "__main__":
    main()
