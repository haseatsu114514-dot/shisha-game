"""原画を変更せず、変更前後・正式顔・手元を比較するQA図を作る。"""
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from PIL import Image

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[3]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "tools"))
from make_face_icons import face_box

rows = json.loads((BASE / "candidates.json").read_text())["items"]
out = BASE / "comparisons"
out.mkdir(exist_ok=True)
official = Image.open(ROOT / "assets/sprites/characters/minto/chr_minto_normal.png").convert("RGBA")
x, y, side = face_box("minto", official)
official_face = official.crop((x, y, x + side, y + side))

for row in rows:
    before = Image.open(ROOT / row["source_path"])
    after = Image.open(ROOT / row["path"])
    fig, axes = plt.subplots(1, 2, figsize=(10, 8))
    for ax, picture, label in zip(axes, [before, after], ["Before (unadopted)", "Background revision (unadopted)"]):
        ax.imshow(picture)
        ax.set_title(label)
        ax.axis("off")
    fig.tight_layout()
    fig.savefig(out / f"{row['id']}-before-after.jpg", dpi=150, bbox_inches="tight")
    plt.close(fig)

    face_roi = row["protected_roi_differences"]["face"]["box"]
    fig, axes = plt.subplots(1, 3, figsize=(12, 4))
    for ax, picture, label in zip(axes, [official_face, before.crop(face_roi), after.crop(face_roi)], ["Official Minto sprite", "Before face", "Revision face"]):
        ax.imshow(picture, interpolation="nearest")
        ax.set_title(label)
        ax.axis("off")
    fig.tight_layout()
    fig.savefig(out / f"{row['id']}-face-detail.jpg", dpi=150, bbox_inches="tight")
    plt.close(fig)

    rois = [(key, value["box"]) for key, value in row["protected_roi_differences"].items() if key != "face"]
    fig, axes = plt.subplots(len(rois), 2, figsize=(8, 4 * len(rois)), squeeze=False)
    for index, (key, box) in enumerate(rois):
        for ax, picture, label in zip(axes[index], [before, after], ["Before", "Revision"]):
            ax.imshow(picture.crop(box), interpolation="nearest")
            ax.set_title(f"{label}: {key}")
            ax.axis("off")
    fig.tight_layout()
    fig.savefig(out / f"{row['id']}-hardware-detail.jpg", dpi=150, bbox_inches="tight")
    plt.close(fig)

print("Saved 6 QA comparisons; original and revision PNG bytes unchanged")
