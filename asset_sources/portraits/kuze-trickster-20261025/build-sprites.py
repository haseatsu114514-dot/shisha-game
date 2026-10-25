"""Build Kuze's paired 896x1200 transparent game sprites from saved imagegen sources."""

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / "assets/sprites/characters/kuze"
CANVAS = (896, 1200)
HEIGHT = 1008
TOP = 168


def build(face: str) -> None:
    source = Image.open(HERE / f"{face}-source.png").convert("RGBA")
    width = round(source.width * HEIGHT / source.height)
    if width > CANVAS[0]:
        raise ValueError(f"{face}: source too wide for canvas")
    sprite = source.resize((width, HEIGHT), Image.Resampling.LANCZOS)
    pixels = np.array(sprite)
    alpha = pixels[:, :, 3]

    # Keep the painted figure and close antialiasing, removing stray imagegen
    # pixels in otherwise transparent space without redrawing the character.
    labels, count = ndimage.label(alpha >= 8, structure=np.ones((3, 3)))
    if not count:
        raise ValueError(f"{face}: transparent source")
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    figure = labels == sizes.argmax()
    pixels[~figure] = 0

    canvas = Image.new("RGBA", CANVAS)
    canvas.paste(Image.fromarray(pixels, "RGBA"), ((CANVAS[0] - width) // 2, TOP))
    output = OUT / f"chr_kuze_{face}.png"
    canvas.save(output, optimize=True)
    print(output, canvas.getbbox())


for face in ("normal", "smug"):
    build(face)
