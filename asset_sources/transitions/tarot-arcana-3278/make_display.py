#!/usr/bin/env python3
"""占いの演出（remake/js/motions/tarot.js の c）で使う、表示用に縮めた札の絵を作る。

原寸の札（remake/img/ui/transitions/tarot/*.webp・arcana/*.webp。1枚 約2.7MB）をそのまま読むと、
1回の占いで約3MBを読むので、画面で使う大きさに縮めた絵を display/ に置く（原寸の絵は変えない）。
- 札の裏・表の枠: 1024x1536 の中の札の範囲（CARD_BOX）だけを切り出し、幅 640 に縮める
  （画面の札は最大 幅 320px。高密度の画面で2倍）
- 表の絵（大アルカナ19枚）: 幅 600 に縮める（窓は最大 幅 約240px。左右を約7%ずつ切って使う）

  python3 asset_sources/transitions/tarot-arcana-3278/make_display.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "remake/img/ui/transitions/tarot"
OUT = SRC / "display"
CARD_BOX = (89, 62, 936, 1456)  # tarot.js の CARD_BOX と同じ（x, y, x+w, y+h）
CARD_W = 640
ART_W = 600


def save(im, path):
    im.save(path, "WEBP", quality=86, method=6)
    print(f"{path.relative_to(ROOT)} {im.size} {path.stat().st_size // 1024}KB")


def main():
    OUT.mkdir(exist_ok=True)
    for name in ("card-back", "card-front-frame"):
        im = Image.open(SRC / f"{name}.webp").convert("RGBA").crop(CARD_BOX)
        h = round(CARD_W * im.height / im.width)
        save(im.resize((CARD_W, h), Image.LANCZOS), OUT / f"{name}.webp")
    (OUT / "arcana").mkdir(exist_ok=True)
    for src in sorted((SRC / "arcana").glob("*.webp")):
        im = Image.open(src).convert("RGB")
        h = round(ART_W * im.height / im.width)
        save(im.resize((ART_W, h), Image.LANCZOS), OUT / "arcana" / src.name)


if __name__ == "__main__":
    main()
