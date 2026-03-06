#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import hashlib

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"


def size_for(path: Path) -> tuple[int, int]:
    rel = path.relative_to(ASSETS).as_posix()
    name = path.name

    if rel.startswith("sprites/characters/"):
        return (256, 512)
    if rel.startswith("sprites/faces/"):
        return (64, 64)
    if rel.startswith("backgrounds/"):
        return (1280, 720)

    if name == "ui_title_packii.png":
        return (512, 512)
    if name == "ui_title_logo.png":
        return (1024, 256)
    if name in {"ui_phone_frame.png", "ui_lime_bg.png", "ui_sheesha_bg.png"}:
        return (1280, 720)
    if name in {"ui_dialogue_box.png"}:
        return (1120, 240)
    if name in {"ui_dialogue_namebox.png"}:
        return (300, 72)
    if name in {"ui_status_bg.png"}:
        return (1280, 720)
    if name in {"ui_status_radar.png"}:
        return (512, 512)
    if name in {"ui_hud_calendar.png", "ui_hud_money.png", "ui_hud_action.png"}:
        return (300, 90)
    if name.startswith("ui_button_"):
        return (280, 72)
    if name in {"ui_map_pin.png", "ui_map_pin_event.png", "ui_invitation_mark.png"}:
        return (96, 96)
    if name.startswith("ui_stamp_packii_"):
        return (256, 256)
    if name.endswith("_icon.png"):
        return (128, 128)

    return (256, 256)


def color_for(path: Path) -> tuple[int, int, int]:
    digest = hashlib.md5(path.as_posix().encode("utf-8")).digest()
    return (48 + digest[0] % 140, 48 + digest[1] % 140, 48 + digest[2] % 140)


def text_color(bg: tuple[int, int, int]) -> tuple[int, int, int]:
    lum = (bg[0] * 299 + bg[1] * 587 + bg[2] * 114) / 1000
    return (20, 20, 20) if lum > 140 else (235, 235, 235)


def draw_label(img: Image.Image, path: Path) -> None:
    draw = ImageDraw.Draw(img)
    fg = text_color(img.getpixel((0, 0)))
    font = ImageFont.load_default()

    label = path.stem
    max_len = 18
    lines = [label[i : i + max_len] for i in range(0, len(label), max_len)] or [label]

    y = 6
    for line in lines[:5]:
        draw.text((6, y), line, fill=fg, font=font)
        y += 12


def create_or_replace(path: Path) -> None:
    size = size_for(path)
    bg = color_for(path)
    img = Image.new("RGB", size, bg)
    draw_label(img, path)
    img.save(path, format="PNG")


def main() -> None:
    pngs = sorted(ASSETS.rglob("*.png"))
    replaced = 0
    for p in pngs:
        if not p.exists() or p.stat().st_size == 0:
            create_or_replace(p)
            replaced += 1

    print(f"generated={replaced}")


if __name__ == "__main__":
    main()
