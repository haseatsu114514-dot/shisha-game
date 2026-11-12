#!/usr/bin/env python3
"""第2弾（GB05・SBD124・Issue #3408）: Codex の原画（originals/*.png・PR #3455）を、ゲーム用の WebP（remake/img/ui/growth_board/）にする。

  python3 -I asset_sources/ui/growth-board-20261112/convert.py           # 変換
  python3 -I asset_sources/ui/growth-board-20261112/convert.py --sheet   # 確認用の一覧 contact_sheet.png も作る

していること（第1弾の convert.py と同じ方法・同じ関数を使う）: マゼンタ（#FF00FF）の地を抜く・絵の外接矩形で切る・縮める。
節目の紋（真っ黒の地）は明るさを透過にする。色・形は触らない。
原画は LFS なので先に `git lfs pull --include="asset_sources/ui/growth-board-20261112/originals/*"`。
"""
import argparse
import importlib.util
import sys
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SRC = HERE / "originals"
ROOT = HERE.parents[2]
OUT = ROOT / "remake" / "img" / "ui" / "growth_board"

# 第1弾の変換（マゼンタ抜き・黒地を光にする・切り抜き）をそのまま使う
_spec = importlib.util.spec_from_file_location("gb_convert_1", HERE.parent / "growth-board-20261111" / "convert.py")
gb1 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gb1)

# name: (原画, 出力の長い辺 px)。九分割の縁は切った後の絵で測り、CSS（look-neo-board.css）に書く
PARTS = {
    "panel_dark": ("gb_panel_dark", 512),   # 右のパネルの板。九分割は各辺 64（原画の 128）
    "row_dark": ("gb_row_dark", 384),       # 近い目的地の行・財布の箱。九分割は各辺 32（原画の 64）
    "chip_gold": ("gb_chip_gold", 384),     # 「灯せる」の金の札。両端の丸は高さの半分
    "pill_dark": ("gb_pill_dark", 384),     # 倍率の札（−・全体・＋）と ✦ の札
    "flow_1": ("flow_1", 128),              # 「？」の見方「ながれ」の4手順（丸い台）
    "flow_2": ("flow_2", 128),
    "flow_3": ("flow_3", 128),
    "flow_4": ("flow_4", 128),
}
SQUARE = {"flow_1", "flow_2", "flow_3", "flow_4"}


def part(name):
    src, long_side = PARTS[name]
    im = gb1.trim(gb1.key_magenta(Image.open(SRC / f"{src}.png")))
    if name in SQUARE:
        side = max(im.size)
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
        im = canvas
    scale = long_side / max(im.size)
    return im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", action="store_true", help="確認用の一覧 contact_sheet.png も作る")
    args = ap.parse_args()
    if not (SRC / "gb_panel_dark.png").exists() or (SRC / "gb_panel_dark.png").stat().st_size < 1024:
        print("原画がありません（LFS の実体を取得してください）", file=sys.stderr)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    done = []
    for name in PARTS:
        gb1.save(name, part(name), done)
    crest = gb1.key_black(Image.open(SRC / "levelup_crest.png")).resize((512, 512), Image.LANCZOS)
    gb1.save("levelup_crest", crest, done, quality=82)
    print(f"total {sum(d.stat().st_size for _, d, _ in done) // 1024}KB ({len(done)} files)")
    if args.sheet:
        cell, cols = 200, 5
        rows = (len(done) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cell, rows * (cell + 24)), (24, 16, 32))
        draw = ImageDraw.Draw(sheet)
        for i, (name, _, im) in enumerate(done):
            x, y = (i % cols) * cell, (i // cols) * (cell + 24)
            thumb = im.convert("RGBA")
            thumb.thumbnail((cell - 16, cell - 16))
            sheet.paste(thumb, (x + (cell - thumb.width) // 2, y + 4 + (cell - 8 - thumb.height) // 2), thumb)
            draw.text((x + 6, y + cell), name, fill=(244, 210, 122))
        sheet.save(HERE / "contact_sheet.png")
        print("contact_sheet.png written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
