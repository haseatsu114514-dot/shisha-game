#!/usr/bin/env python3
"""Make labeled review sheets; never modify the source/runtime images."""
import argparse
import io
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def font(size):
    return ImageFont.truetype("DejaVuSans.ttf", size)


def place(canvas, image, box):
    image = image.convert("RGBA")
    image.thumbnail((box[2], box[3]), Image.Resampling.LANCZOS)
    canvas.paste(image, (box[0] + (box[2] - image.width) // 2,
                         box[1] + (box[3] - image.height) // 2), image)


def label(canvas, xy, text, size=16):
    ImageDraw.Draw(canvas).text(xy, text, fill="#26232b", font=font(size))


def save_checked(image, target, **options):
    """Write a complete image atomically and verify its persisted pixels."""
    buffer = io.BytesIO()
    image.save(buffer, format="PNG" if target.suffix == ".png" else "JPEG", **options)
    data = buffer.getvalue()
    temporary = target.with_suffix(target.suffix + ".tmp")
    with temporary.open("wb") as output:
        output.write(data)
        output.flush()
        os.fsync(output.fileno())
    os.replace(temporary, target)
    assert target.read_bytes() == data, target
    with Image.open(target) as decoded:
        decoded.load()
        assert decoded.size == image.size, target


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--before-root", type=Path, required=True)
    p.add_argument("--after-root", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    a.output.mkdir(parents=True, exist_ok=True)
    roots = [a.before_root, a.after_root]
    faces = ["normal", "smile", "serious", "surprise", "intense"]
    centers = [432, 415, 450, 438, 432]
    sheet = Image.new("RGB", (1500, 1030), "#eeeae6")
    label(sheet, (20, 10), "Adam: anatomical LEFT = GREEN / RIGHT = RED", 24)
    label(sheet, (20, 45), "Front view AFTER: screen LEFT = RED / RIGHT = GREEN. Original faces, poses and alpha retained.", 18)
    for i, (face, cx) in enumerate(zip(faces, centers)):
        rel = f"assets/sprites/characters/adam/chr_adam_{face}.png"
        label(sheet, (300 * i + 15, 90), face, 20)
        for j, root in enumerate(roots):
            image = Image.open(root / rel)
            label(sheet, (300 * i + 15, 120 + j * 280), ["BEFORE", "AFTER"][j])
            place(sheet, image.crop((cx - 106, 115, cx + 106, 320)), (300 * i + 10, 145 + j * 280, 280, 250))
            place(sheet, image, (300 * i + j * 145 + 3, 708, 144, 300))
        label(sheet, (300 * i + 30, 685), "Before          After", 15)
    save_checked(sheet, a.output / "portraits-before-after.jpg", quality=90, optimize=True, subsampling=0)

    sheet = Image.new("RGB", (1440, 1390), "#eeeae6")
    pairs = [
        ("assets/ui/character_intros/adam.png", "Intro: apple pair and colored backing only", 0),
        ("assets/cgs/cg_ch1_tournament_battle.png", "Tournament CG: Adam's hair only", 450),
        ("assets/backgrounds/bg_eden_shop.png", "EDEN: two foreground apples in the CENTER frame only", 900),
    ]
    for rel, caption, top in pairs:
        label(sheet, (16, top + 8), caption, 21)
        for j, root in enumerate(roots):
            label(sheet, (j * 720 + 16, top + 37), ["BEFORE", "AFTER"][j])
            place(sheet, Image.open(root / rel), (j * 720 + 10, top + 62, 700, 394))
    save_checked(sheet, a.output / "scenes-before-after.jpg", quality=90, optimize=True, subsampling=0)

    sheet = Image.new("RGB", (1200, 820), "#eeeae6")
    details = [
        ("assets/ui/face_icons/face_adam.png", None, (40, 70, 160, 160), "Face icon (160px)", 15),
        ("assets/backgrounds/bg_eden_shop.png", (590, 186, 704, 251), (260, 70, 300, 171), "EDEN CENTER frame", 15),
        ("assets/cgs/cg_ch1_tournament_battle.png", (1140, 60, 1400, 305), (30, 340, 520, 450), "Tournament hair detail", 275),
    ]
    for rel, crop, box, caption, text_y in details:
        for j, root in enumerate(roots):
            image = Image.open(root / rel)
            if crop:
                image = image.crop(crop)
                scale = min(box[2] / image.width, box[3] / image.height)
                image = image.resize((round(image.width * scale), round(image.height * scale)),
                                     Image.Resampling.NEAREST if "backgrounds" in rel else Image.Resampling.LANCZOS)
            label(sheet, (box[0] + j * 600, text_y), caption, 16)
            label(sheet, (box[0] + j * 600, text_y + 25), ["BEFORE", "AFTER"][j])
            place(sheet, image, (box[0] + j * 600, box[1], box[2], box[3]))
    save_checked(sheet, a.output / "details-before-after.png", optimize=True)

    sheet = Image.new("RGB", (1280, 820), "#eeeae6")
    label(sheet, (20, 15), "Preserved adopted art: no replacement", 25)
    logo = Image.open(a.before_root / "assets/ui/store_logos/eden.png").crop((36, 53, 641, 772))
    place(sheet, logo, (20, 85, 330, 390))
    label(sheet, (20, 52), "EDEN logo: red-left / green-right", 18)
    title = Image.open(a.before_root / "remake/img/ui/chapters/ch1-title.webp")
    place(sheet, title, (370, 90, 890, 500))
    label(sheet, (370, 52), "Current Chapter 1 title: original composition", 18)
    place(sheet, title.crop((208, 256, 434, 656)), (400, 590, 125, 215))
    label(sheet, (565, 615), "Adam's profile already shows his LEFT side green.", 19)
    label(sheet, (565, 650), "Historical layer filename is naru.png (visually Adam).", 17)
    label(sheet, (565, 682), "Do not reverse the profile or rename unrelated art.", 17)
    save_checked(sheet, a.output / "preserved-art.jpg", quality=90, optimize=True, subsampling=0)
    print("Created four labeled comparison sheets from original and edited assets.")


if __name__ == "__main__":
    main()
