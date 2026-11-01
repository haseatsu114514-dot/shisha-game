#!/usr/bin/env python3
"""登場カットイン（グラフィック絵柄）の人物・背景を1枚ずつ差し替える。

使い方（リポジトリ直下で）:
  python3 tools/intro_graphic_import.py adam 原画.png              # 人物
  python3 tools/intro_graphic_import.py adam 原画.png --background # 背景
  python3 tools/intro_graphic_import.py adam 原画.png --dry-run    # 確認画像だけ作る

人物の原画は、単色の背景（マゼンタ・ピンク・緑など。黒は髪や服と区別できないので不可）で描かれた正方形の絵。
背景色は外周から自動で読み取り、色の距離で抜く。人物の上端の少し上から正方形に切り出し、
1024×1024 の webp にする。左右の端で人物が切れている場合は警告する。
背景は 16:9 に切り出して 1672×941 の webp にする。

原画は asset_sources/character-intros/graphic-20261031/replacements/ に日付付きで保存し、
確認用に、緑の上に重ねた画像を同じ場所へ書き出す。ゲームでの見え方は
character-intros-preview.html か remake/test/intro_cutin.mjs（SHOTS=フォルダ）で確かめる。
"""
import argparse
import datetime
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "remake/img/ui/character_intros/graphic"
SRC = ROOT / "asset_sources/character-intros/graphic-20261031/replacements"
REGISTRY = ROOT / "remake/js/vn/intro-graphic.js"


def known_ids():
    text = REGISTRY.read_text(encoding="utf-8")
    body = text.split("PORTRAITS = new Set([", 1)[1].split("]", 1)[0]
    return {s.strip().strip('"') for s in body.replace("\n", "").split(",") if s.strip()}


def key_out(rgb):
    """外周の色を背景とみなして透明にし、縁に残る背景色を抑える"""
    a = rgb.astype(float)
    border = np.concatenate([a[:16].reshape(-1, 3), a[-16:].reshape(-1, 3), a[:, :16].reshape(-1, 3), a[:, -16:].reshape(-1, 3)])
    bg = np.median(border, 0)
    if bg.max() < 60:
        sys.exit("背景が黒に近いため抜けません。マゼンタなど人物に使わない単色の背景で描き直してください。")
    dist = np.sqrt(((a - bg) ** 2).sum(-1))
    alpha = np.clip((dist - 40) / 60, 0, 1)
    out = a.copy()
    semi = alpha < 1
    # 半透明の縁: 背景色の成分を引き、混ざった色を人物側の色へ戻す
    for c in range(3):
        out[..., c] = np.where(semi, np.clip((a[..., c] - bg[c] * (1 - alpha)) / np.maximum(alpha, 1e-3), 0, 255), a[..., c])
    return np.dstack([out, alpha * 255]).clip(0, 255).astype("uint8"), alpha, bg


def portrait(path, dry):
    rgb = np.array(Image.open(path).convert("RGB"))
    rgba, alpha, bg = key_out(rgb)
    fg = alpha > 0.5
    h, w = fg.shape
    rows, cols = np.where(fg.sum(1) > 5)[0], np.where(fg.sum(0) > 5)[0]
    if not len(rows):
        sys.exit("人物が見つかりません")
    top, left, right = int(rows.min()), int(cols.min()), int(w - 1 - cols.max())
    warnings = []
    if fg[:, :3].sum() > 20:
        warnings.append("人物が左の端で切れています")
    if fg[:, -3:].sum() > 20:
        warnings.append("人物が右の端で切れています")
    side = min(h, w)
    top0 = max(0, min(top - int(side * 0.02), h - side))
    x0 = max(0, min((w - side) // 2, left, w - side))
    image = Image.fromarray(rgba).crop((x0, top0, x0 + side, top0 + side)).resize((1024, 1024), Image.LANCZOS)
    return image, {"background_color": [round(v) for v in bg], "top": top, "left": left, "right": right, "warnings": warnings}


def background(path):
    image = Image.open(path).convert("RGB")
    w, h = image.size
    target = round(w * 941 / 1672)
    if target <= h:
        image = image.crop((0, (h - target) // 2, w, (h - target) // 2 + target))
    else:
        width = round(h * 1672 / 941)
        image = image.crop(((w - width) // 2, 0, (w - width) // 2 + width, h))
    return image.resize((1672, 941), Image.LANCZOS), {}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("id", help="キャラID（例: adam）")
    parser.add_argument("image", type=Path, help="原画の画像ファイル")
    parser.add_argument("--background", action="store_true", help="人物ではなく背景を差し替える")
    parser.add_argument("--dry-run", action="store_true", help="ゲームの画像は書き換えず、確認画像だけ作る")
    args = parser.parse_args()
    if args.id not in known_ids():
        sys.exit(f"未登録のID: {args.id}（remake/js/vn/intro-graphic.js の PORTRAITS に足してから）")
    kind = "bg" if args.background else "portrait"
    image, info = background(args.image) if args.background else portrait(args.image, args.dry_run)
    stamp = datetime.date.today().isoformat()
    folder = SRC / stamp
    folder.mkdir(parents=True, exist_ok=True)
    name = f"bg_{args.id}" if args.background else args.id
    shutil.copy(args.image, folder / f"{name}{args.image.suffix.lower()}")
    preview = Image.new("RGBA", image.size, (40, 160, 90, 255))
    preview.alpha_composite(image.convert("RGBA"))
    preview.convert("RGB").save(folder / f"{name}_check.jpg", quality=88)
    if not args.dry_run:
        image.save(OUT / f"{name}.webp", quality=88 if kind == "portrait" else 86, method=6)
    log = folder / "replacements.json"
    entries = json.loads(log.read_text(encoding="utf-8")) if log.exists() else []
    entries.append({"id": args.id, "kind": kind, "source": args.image.name, "applied": not args.dry_run, **info})
    log.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{'確認のみ' if args.dry_run else '差し替え'}: {name} ← {args.image}")
    print(f"  原画と確認画像: {folder.relative_to(ROOT)}/")
    for warning in info.get("warnings", []):
        print(f"  警告: {warning}")


if __name__ == "__main__":
    main()
