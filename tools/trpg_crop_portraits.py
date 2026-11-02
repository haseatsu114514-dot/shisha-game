#!/usr/bin/env python3
"""Cut a TRPG portrait sheet (transparent grid) into 512x512 round-frame portraits.

Usage:
  python3 tools/trpg_crop_portraits.py looks <sheet.png> <out_dir>   # 4x2: ordinary ink/ash/rust/moss, shark ink/salt/rust/deep
  python3 tools/trpg_crop_portraits.py pcs   <sheet.png> <out_dir>   # 4x3: nico pippin luca leaf / otto midori mackin sera / noa
Each cell keeps only its largest opaque shape (drops specks and spill from neighbours), then a square is taken
around the head (centroid of the upper part) so the face sits in the middle of the game's round frames.
"""
import sys, pathlib
import numpy as np
from PIL import Image

LAYOUTS = {
    "looks": (4, 2, ["look-ordinary-ink", "look-ordinary-ash", "look-ordinary-rust", "look-ordinary-moss",
                     "look-shark-ink", "look-shark-salt", "look-shark-rust", "look-shark-deep"]),
    "pcs": (4, 3, ["pc-nico", "pc-pippin", "pc-luca", "pc-leaf", "pc-otto", "pc-midori", "pc-mackin", "pc-sera", "pc-noa"]),
}

def largest_shape(alpha, step=4):
    """Largest 4-connected opaque region, found on a coarse grid and scaled back (no extra dependencies)."""
    small = alpha[::step, ::step] > 32
    seen = np.zeros_like(small, dtype=bool)
    best, best_size = None, 0
    hgt, wid = small.shape
    for y0, x0 in zip(*np.nonzero(small)):
        if seen[y0, x0]: continue
        stack, region = [(y0, x0)], []
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop(); region.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < hgt and 0 <= nx < wid and small[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; stack.append((ny, nx))
        if len(region) > best_size: best, best_size = region, len(region)
    if not best: return None
    coarse = np.zeros_like(small, dtype=bool)
    ys, xs = zip(*best); coarse[list(ys), list(xs)] = True
    # Grow one coarse cell so anti-aliased edges survive, then scale back to the full cell.
    grown = coarse.copy()
    grown[1:, :] |= coarse[:-1, :]; grown[:-1, :] |= coarse[1:, :]; grown[:, 1:] |= coarse[:, :-1]; grown[:, :-1] |= coarse[:, 1:]
    full = np.repeat(np.repeat(grown, step, axis=0), step, axis=1)
    return full[:alpha.shape[0], :alpha.shape[1]]

def crop(cell):
    a = np.array(cell.getchannel("A"))
    keep = largest_shape(a)
    if keep is None: return None
    rgba = np.array(cell); rgba[..., 3] = np.where(keep, rgba[..., 3], 0)
    ys, xs = np.nonzero(rgba[..., 3] > 32)
    top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()
    w, h = right - left + 1, bottom - top + 1
    upper = rgba[top: top + int(h * 0.45), :, 3] > 32
    cx = int(np.nonzero(upper)[1].mean()) if upper.any() else (left + right) // 2
    side = int(max(w * 0.82, h * 0.72))
    x0 = cx - side // 2; y0 = top - int(side * 0.04)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(Image.fromarray(rgba), (-x0, -y0))
    return canvas.resize((512, 512), Image.LANCZOS)

def main(kind, sheet, out):
    cols, rows, names = LAYOUTS[kind]
    im = Image.open(sheet).convert("RGBA")
    cw, ch = im.width / cols, im.height / rows
    out = pathlib.Path(out); out.mkdir(parents=True, exist_ok=True)
    for i, name in enumerate(names):
        r, c = divmod(i, cols)
        cell = im.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
        portrait = crop(cell)
        if portrait is None: raise SystemExit("empty cell for " + name)
        portrait.save(out / (name + ".png"))
    print("cut", len(names), "portraits into", out)

if __name__ == "__main__":
    main(*sys.argv[1:4])
