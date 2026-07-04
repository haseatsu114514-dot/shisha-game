#!/usr/bin/env python3
"""表情差分の「絵ごと平行移動」を原画側で整列するツール。

AI生成の表情差分は、同じポーズでもキャンバス内で体が丸ごと左右に
ずれて描かれることがある（例: つむぎ surprise は normal 比で約90px左）。
engine.js は足元アンカー ax をキャラ単位で共通化してキャンバスを固定する
ため、絵の中身がずれていると立ち絵が表情切替でジャンプして見える。

このツールは各表情の足元重心(ax)と下端余白(b)を build_data.py と同じ
方法で計測し、基準表情（normal）と一致するように**画像の中身を平行移動**
して保存する。ポーズ違い（腕の上げ下げ等）はそのまま残る＝足だけ揃う。

- みんとのように私服差分（chr_<id>_ura_*）を持つキャラは、通常セットと
  ura セットを別グループとして各グループの normal に整列する。
- 移動でコンテンツがキャンバス外に出る場合は出ない範囲までに抑えて警告。
- 実行後は必ず `python3 web/build_data.py` で trim を再計測すること。

使い方:
    python3 tools/align_sprite_anchor.py --dry-run   # 計測と移動量の表示のみ
    python3 tools/align_sprite_anchor.py             # 全キャラ整列
    python3 tools/align_sprite_anchor.py -c tsumugi  # 1キャラのみ
"""

import argparse
import importlib.util
import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
CHARS_DIR = REPO_ROOT / "assets" / "sprites" / "characters"

# 移動がこの px 以下なら誤差とみなして触らない
MIN_SHIFT_PX = 3


def load_build_data_module():
    spec = importlib.util.spec_from_file_location(
        "bd", REPO_ROOT / "web" / "build_data.py"
    )
    bd = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bd)
    return bd


def group_key(png: Path) -> str:
    return "ura" if "_ura_" in png.name else "main"


def align_character(bd, char_dir: Path, dry_run: bool) -> int:
    pngs = sorted(char_dir.glob("*.png"))
    if not pngs:
        return 0
    groups = {}
    for p in pngs:
        groups.setdefault(group_key(p), []).append(p)
    changed = 0
    for gname, files in groups.items():
        trims = {}
        for p in files:
            t = bd.portrait_trim(p)
            if t and isinstance(t.get("ax"), (int, float)):
                trims[p] = t
        if len(trims) < 2:
            continue
        ref = next(
            (p for p in trims if p.stem.endswith("_normal")), next(iter(trims))
        )
        rt = trims[ref]
        for p, t in trims.items():
            if p == ref:
                continue
            with Image.open(p) as im:
                W, H = im.size
                dx = round((rt["ax"] - t["ax"]) * W)
                dy = round((t["b"] - rt["b"]) * H)  # +で下へ（下端余白を基準に合わせる）
                if abs(dx) < MIN_SHIFT_PX and abs(dy) < MIN_SHIFT_PX:
                    continue
                # コンテンツ（計測bbox）がキャンバス外へ出ない範囲に丸める
                left = t["l"] * W
                right = (t["l"] + t["w"]) * W
                top = (1 - t["b"] - t["h"]) * H
                bottom = (1 - t["b"]) * H
                dx_c = max(-left, min(W - right, dx))
                dy_c = max(-top, min(H - bottom, dy))
                clip_note = "" if (dx_c, dy_c) == (dx, dy) else f"（クリップ回避で {dx},{dy}→{dx_c},{dy_c}）"
                print(
                    f"  {char_dir.name}/{p.name}: shift dx={dx_c:+d}px dy={dy_c:+d}px {clip_note}"
                )
                changed += 1
                if dry_run:
                    continue
                canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                canvas.paste(im.convert("RGBA"), (int(dx_c), int(dy_c)))
                canvas.save(p)
    return changed


def main():
    ap = argparse.ArgumentParser(description="立ち絵の足元アンカー整列")
    ap.add_argument("--character", "-c", help="対象キャラ（省略で全キャラ）")
    ap.add_argument("--dry-run", "-n", action="store_true", help="解析のみ")
    args = ap.parse_args()

    bd = load_build_data_module()
    if getattr(bd, "label", None) is None and not hasattr(bd, "portrait_trim"):
        print("build_data.py から portrait_trim を読み込めませんでした", file=sys.stderr)
        return 1

    total = 0
    for d in sorted(CHARS_DIR.iterdir()):
        if not d.is_dir():
            continue
        if args.character and d.name != args.character:
            continue
        total += align_character(bd, d, args.dry_run)
    print(f"{'[DRY RUN] ' if args.dry_run else ''}整列した差分: {total} 枚")
    if total and not args.dry_run:
        print("→ python3 web/build_data.py で trim を再計測してください")
    return 0


if __name__ == "__main__":
    sys.exit(main())
