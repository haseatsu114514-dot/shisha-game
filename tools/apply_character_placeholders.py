#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CHAR_DIR = ROOT / "assets" / "sprites" / "characters"
FACE_DIR = ROOT / "assets" / "sprites" / "faces"

HUMAN_SOURCE = CHAR_DIR / "placeholder_valhalla.png"
PACKII_SOURCE = CHAR_DIR / "placeholder_packii.png"


def crop_center(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    src_w, src_h = img.size
    src_ratio = src_w / src_h
    dst_ratio = target_w / target_h

    if src_ratio > dst_ratio:
        new_h = src_h
        new_w = int(src_h * dst_ratio)
    else:
        new_w = src_w
        new_h = int(src_w / dst_ratio)

    left = (src_w - new_w) // 2
    top = (src_h - new_h) // 2
    cropped = img.crop((left, top, left + new_w, top + new_h))
    return cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)


def save_set(source: Path, names: list[str], size: tuple[int, int]) -> None:
    with Image.open(source) as img:
        rgb = img.convert("RGB")
        out = crop_center(rgb, size[0], size[1])
        for name in names:
            out.save(CHAR_DIR / name, format="PNG")


def save_faces(source: Path, names: list[str]) -> None:
    with Image.open(source) as img:
        rgb = img.convert("RGB")
        out = crop_center(rgb, 64, 64)
        for name in names:
            out.save(FACE_DIR / name, format="PNG")


def main() -> None:
    human_files = [
        "chr_hajime_normal.png",
        "chr_hajime_smile.png",
        "chr_hajime_serious.png",
        "chr_hajime_surprise.png",
        "chr_hajime_sad.png",
        "chr_sumi_normal.png",
        "chr_sumi_smile.png",
        "chr_sumi_serious.png",
        "chr_sumi_thinking.png",
        "chr_naru_normal.png",
        "chr_naru_smile.png",
        "chr_naru_fired_up.png",
        "chr_naru_sad.png",
        "chr_adam_normal.png",
        "chr_adam_intense.png",
        "chr_adam_silent.png",
        "chr_kirara_normal.png",
        "chr_kirara_smile.png",
        "chr_kirara_wink.png",
        "chr_kirara_serious.png",
        "chr_tsumugi_normal.png",
        "chr_tsumugi_shy.png",
        "chr_tsumugi_focus.png",
    ]

    packii_files = [
        "chr_packii_normal.png",
        "chr_packii_smoke.png",
        "chr_packii_angry.png",
    ]

    human_faces = [
        "face_hajime.png",
        "face_sumi.png",
        "face_naru.png",
        "face_adam.png",
        "face_kirara.png",
        "face_tsumugi.png",
    ]

    save_set(HUMAN_SOURCE, human_files, (256, 512))
    save_set(PACKII_SOURCE, packii_files, (256, 512))
    save_faces(HUMAN_SOURCE, human_faces)
    save_faces(PACKII_SOURCE, ["face_packii.png"])

    print("updated character placeholders")


if __name__ == "__main__":
    main()
