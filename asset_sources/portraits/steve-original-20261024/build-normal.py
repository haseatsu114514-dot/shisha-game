"""Build the adopted 896x1200 Steve portrait from the saved imagegen source."""

from pathlib import Path

import numpy as np
from PIL import Image


root = Path(__file__).parent
source = root / "normal-source.png"
output = root.parents[2] / "assets/sprites/characters/steve/chr_steve_normal.png"

im = Image.open(source).convert("RGBA")
im = im.resize((896, 1200), Image.Resampling.LANCZOS)
pixels = np.array(im)

# Imagegen puts stray saturated red pixels in almost fully transparent space.
# Remove only invisible alpha noise; keep all visible painted and anti-aliased pixels.
pixels[pixels[:, :, 3] < 8] = 0

Image.fromarray(pixels, "RGBA").save(output, optimize=True)
print(output)
