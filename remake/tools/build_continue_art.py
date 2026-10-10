#!/usr/bin/env python3
"""生成アトラスをUI部品に切り出す。原画は保持し、赤黒の配色だけ夜の藍色へ置き換える。

2026-10-10 オーナー指摘「赤黒は怖い」（優しい色にする必要はない）。背景の赤い煙と
ロゴの赤い影を、輪郭・質感を変えずに藍〜青緑へ色替えする。可決の朱印は印の色なので保持。
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "asset_sources/ui/continue-v4-20261010/generated"
OUT = ROOT / "assets/ui/continue"


# 背景: 明るさを夜空の藍→青→青緑の階調へ写す。真っ黒にせず、少し持ち上げる。
NIGHT = [(0.0, (16, 21, 46)), (0.22, (34, 46, 96)), (0.5, (62, 104, 160)), (1.0, (150, 222, 214))]


def night_backdrop(image):
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32) / 255
    # 赤い煙は輝度が低いので、色の強さも含めた明るさで階調を取る。
    level = np.clip(np.maximum(rgb.max(axis=2), rgb @ [.3, .59, .11] * 1.6) / .62, 0, 1)
    out = np.zeros_like(rgb)
    for channel in range(3):
        out[..., channel] = np.interp(level, [p for p, _ in NIGHT], [c[channel] for _, c in NIGHT])
    return Image.fromarray(out.astype(np.uint8), "RGB")


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
    part("titles", "game_over_title", 1, blue_shadow)
    part("stamp", "approval_stamp")
    night_backdrop(Image.open(SOURCE / "backdrop.png")).save(OUT / "backdrop.png", optimize=True)


if __name__ == "__main__":
    main()
