#!/usr/bin/env python3
"""Cut a TRPG portrait sheet (transparent grid) into 512x512 round-frame portraits.

Usage:
  python3 tools/trpg_crop_portraits.py looks <sheet.png> <out_dir>   # 4x2: ordinary ink/ash/rust/moss, shark ink/salt/rust/deep
  python3 tools/trpg_crop_portraits.py pcs   <sheet.png> <out_dir>   # 4x3: nico pippin luca leaf / otto midori mackin sera / noa
  python3 tools/trpg_crop_portraits.py scenario <sheet.png> <scenario-id>
      # 4x2 from asset_sources/trpg-scenarios/README.md: row 1 = the four builder looks, row 2 = the four companion builds.
      # Writes 512px PNG to assets/ui/trpg/, 256px WebP to remake/img/ui/trpg/, and fills every matching "portrait" in the JSON.
Each cell keeps only its largest opaque shape (drops specks and spill from neighbours), then a square is taken
around the head (centroid of the upper part) so the face sits in the middle of the game's round frames.
"""
import sys, json, pathlib
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

ROOT = pathlib.Path(__file__).resolve().parent.parent


def scenario(sheet, sid):
    catalog = json.loads((ROOT / "data/trpg_catalog.json").read_text(encoding="utf-8"))
    path = ROOT / "data" / next(e["file"] for e in catalog["scenarios"] if e["id"] == sid)
    s = json.loads(path.read_text(encoding="utf-8"))
    looks = s["builder"]["looks"]
    builds = [o for seat in s["companionBuilds"].values() for opts in seat.values() for o in opts]
    names = [f"look-{sid}-{l['id']}" for l in looks] + [f"pc-{o['id']}" for o in builds]
    if len(names) != 8: raise SystemExit(f"{sid}: expected 4 looks and 4 companion builds, got {len(names)}")
    # Companion ids share one folder with every other story: never overwrite another story's face.
    for name in names[4:]:
        if (ROOT / "assets/ui/trpg" / (name + ".png")).exists() and f'img/ui/trpg/{name}.webp"' not in path.read_text(encoding="utf-8"):
            raise SystemExit(f"{name}.png already belongs to another story; rename the build id first")
    LAYOUTS[sid] = (4, 2, names)
    main(sid, sheet, ROOT / "assets/ui/trpg")
    url = lambda name: f"../../img/ui/trpg/{name}.webp"
    for name in names:
        Image.open(ROOT / "assets/ui/trpg" / (name + ".png")).resize((256, 256), Image.LANCZOS).save(
            ROOT / "remake/img/ui/trpg" / (name + ".webp"), quality=90, method=6)
    for look, name in zip(looks, names): look["portrait"] = url(name)
    faces = {o["name"]: url(f"pc-{o['id']}") for o in builds}
    for o in builds: o["portrait"] = url(f"pc-{o['id']}")
    for c in s["cast"]:
        if c.get("sheet") and c["sheet"].get("name") in faces: c["sheet"]["portrait"] = faces[c["sheet"]["name"]]
    path.write_text(json.dumps(s, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wired", len(names), "portraits into", path.relative_to(ROOT))


if __name__ == "__main__":
    if sys.argv[1:2] == ["scenario"]: scenario(*sys.argv[2:4])
    else: main(*sys.argv[1:4])
