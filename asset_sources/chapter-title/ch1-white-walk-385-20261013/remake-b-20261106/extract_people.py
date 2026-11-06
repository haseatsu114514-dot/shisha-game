"""Extract Adam and Naru from the approved Chapter 1 title artwork."""

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[4]
SOURCE = Path(__file__).with_name("title.png")
LAYERS = ROOT / "assets/ui/chapters/ch1_layers"
WEBP = ROOT / "remake/img/ui/chapters/ch1"
SLOTS = {"adam": (216, 279, 211, 364), "naru": (440, 285, 208, 358)}


def extract(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    x, y, width, height = box
    rgb = np.asarray(image.crop((x, y, x + width, y + height)), dtype=np.uint8)
    # The artwork has an almost white paper background. The dark outline forms
    # one connected component; filling its holes keeps Adam's white shirt.
    seeds = (rgb.min(axis=2) < 245) | (np.ptp(rgb, axis=2) > 15)
    labels, _ = ndimage.label(seeds, structure=np.ones((3, 3)))
    counts = np.bincount(labels.ravel())
    counts[0] = 0
    body = ndimage.binary_fill_holes(labels == counts.argmax())

    # Preserve the source pixels inside the silhouette. Along the outside edge,
    # recover coverage from its contrast against nearby paper to soften pixels.
    alpha = np.where(body, 255.0, 0.0)
    outer = ndimage.binary_dilation(body, iterations=2) & ~body
    paper = np.median(np.concatenate((rgb[:, :3], rgb[:, -3:]), axis=1), axis=1)
    paper = paper[:, None, :]
    contrast = np.max(np.abs(rgb.astype(float) - paper), axis=2)
    alpha[outer] = np.clip((contrast[outer] - 2) * 10, 0, 180)
    rgba = np.dstack((rgb, alpha.astype(np.uint8)))
    rgba[rgba[:, :, 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def main() -> None:
    with Image.open(SOURCE) as image:
        for name, box in SLOTS.items():
            result = extract(image.convert("RGB"), box)
            result.save(LAYERS / f"{name}.png")
            result.save(WEBP / f"{name}.webp", format="WEBP", lossless=True, method=6)
            with Image.open(WEBP / f"{name}.webp") as delivered:
                source_pixels = np.asarray(result)
                webp_pixels = np.asarray(delivered.convert("RGBA"))
                visible = source_pixels[:, :, 3] > 0
                assert np.array_equal(source_pixels[:, :, 3], webp_pixels[:, :, 3])
                assert np.array_equal(source_pixels[visible], webp_pixels[visible])


if __name__ == "__main__":
    main()
