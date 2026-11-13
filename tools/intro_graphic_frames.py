#!/usr/bin/env python3
"""登場カットイン（グラフィック絵柄）の人物絵を、全員ほぼ同じ頭の大きさで出す配置を計算する。

人物絵は原画ごとに寄り・引きが違う（頭の高さが 240〜480px）。共通の配置のままだと、
寄りの絵は頭が大きく、引きの絵は小さく見える（2026-11-02 オーナー「みんな似たような拡大率で出せるようにしたい」）。

使い方（リポジトリ直下で）:
  python3 tools/intro_graphic_frames.py          # intro-graphic.js の配置表を書き直す
  python3 tools/intro_graphic_frames.py --check  # 測っていない人物があれば失敗する（書き換えない）

入力: asset_sources/character-intros/graphic-20261031/heads.json（人物ごとの [頭頂のy, 顎のy, 顔の中心のx]）
     と remake/img/ui/character_intros/graphic/<id>.webp の透明部分。
絵を差し替えたら、その人物の3つの値を測り直してから実行する。
"""
import argparse
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HEADS = ROOT / "asset_sources/character-intros/graphic-20261031/heads.json"
ART = ROOT / "remake/img/ui/character_intros/graphic"
REGISTRY = ROOT / "remake/js/vn/intro-graphic.js"

HEAD = 280      # 画面上の頭の高さ（1280×720 の画面で px）
HEAD_TOP = 16   # 画面上の頭頂の位置
FACE_X = 268    # 画面上の顔の中心
MIN_BOTTOM = 680  # 寄りの絵を縮めすぎない（絵の下端をこの高さより上に上げない）
FADE = 14       # 絵の下端が画面の下に届かないとき、下から何%を薄くするか
RIGHT_EDGE = 640  # 人物はこの線より右に出さない（名前・一言の側）
SKIP = {"pakki"}  # マスコットは全身で見せるので、共通の配置のまま
SAFE_TOP_IDS = {"master_hookah", "emil", "da_silva", "yoru", "sheikh", "mukai_master"}
MAX_FRAME_WIDTH = {"da_silva": 900, "emil": 1024, "mukai_master": 1024}
SAFE_HAND_LEFT = {"adam": -110, "emil": -170, "mukai_master": -200}


def touches(alpha, box):
    return alpha.crop(box).point(lambda v: 255 if v > 40 else 0).getbbox() is not None


def frame_for(pid, head_top, chin, face_x):
    alpha = Image.open(ART / f"{pid}.webp").convert("RGBA").getchannel("A")
    size = alpha.size[0]
    bounds = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    top_cut = touches(alpha, (0, 0, size, 3))
    left_cut = touches(alpha, (0, 0, 3, size))
    scale = HEAD / (chin - head_top)
    top = HEAD_TOP + HEAD - chin * scale
    if top_cut and top > 0:
        top = 0  # 髪が原画の上端で切れている絵は、上に隙間を作らない
    if top + size * scale < MIN_BOTTOM:
        scale = (MIN_BOTTOM - min(top, 0)) / size
        top = HEAD_TOP + HEAD - chin * scale
        if top_cut and top > 0:
            top = 0
        if top + size * scale < MIN_BOTTOM:
            scale = (MIN_BOTTOM - top) / size
    if pid in MAX_FRAME_WIDTH and size * scale > MAX_FRAME_WIDTH[pid]:
        # 両手が左半分に収まる範囲で数%だけ引く。
        scale = MAX_FRAME_WIDTH[pid] / size
        top = HEAD_TOP + HEAD - chin * scale
    if pid in SAFE_TOP_IDS and bounds:
        # 帽子・頭布・高い指が頭頂位置の正規化で画面外へ出ないようにする。
        top = max(top, 8 - bounds[1] * scale)
    left = FACE_X - face_x * scale
    if pid in SAFE_HAND_LEFT:
        left = max(left, SAFE_HAND_LEFT[pid])
    if left_cut and left > 0:
        left = 0
    width = size * scale
    frame = {"width": round(width), "left": round(left), "top": round(top)}
    if top + width < 720:
        frame["fade"] = FADE
    if left + width > RIGHT_EDGE:
        frame["right"] = round((RIGHT_EDGE - left) / width * 100, 1)
    return frame


def registered():
    text = REGISTRY.read_text(encoding="utf-8")
    body = text.split("PORTRAITS = new Set([", 1)[1].split("]", 1)[0]
    return [s.strip().strip('"') for s in body.replace("\n", "").split(",") if s.strip()]


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="測っていない人物があれば失敗する")
    args = parser.parse_args()
    heads = {k: v for k, v in json.loads(HEADS.read_text(encoding="utf-8")).items() if not k.startswith("_")}
    missing = [pid for pid in registered() if pid not in heads and pid not in SKIP]
    if missing:
        print("頭の位置を測っていない人物: " + "、".join(missing), file=sys.stderr)
        print(f"{HEADS.relative_to(ROOT)} に [頭頂のy, 顎のy, 顔の中心のx] を足してください", file=sys.stderr)
        return 1
    if args.check:
        print("OK: 全員の頭の位置がある")
        return 0
    frames = {pid: frame_for(pid, *heads[pid]) for pid in sorted(heads) if (ART / f"{pid}.webp").exists()}
    lines = ["// FRAMES:BEGIN tools/intro_graphic_frames.py が heads.json から書き出す（手で直さない）"]
    lines.append("const FRAME_OVERRIDES = {")
    for pid, f in frames.items():
        lines.append(f"  {pid}: {json.dumps(f).replace(chr(34), '')},")
    lines.append("};")
    lines.append("// FRAMES:END")
    text = REGISTRY.read_text(encoding="utf-8")
    block = "\n".join(lines)
    if "// FRAMES:BEGIN" in text:
        text = re.sub(r"// FRAMES:BEGIN.*?// FRAMES:END", lambda _: block, text, flags=re.S)
    else:
        text = re.sub(r"const FRAME_OVERRIDES = \{[^}]*\};", lambda _: block, text, count=1)
    REGISTRY.write_text(text, encoding="utf-8")
    print(f"{REGISTRY.relative_to(ROOT)} に {len(frames)}人の配置を書き出した")
    return 0


if __name__ == "__main__":
    sys.exit(main())
