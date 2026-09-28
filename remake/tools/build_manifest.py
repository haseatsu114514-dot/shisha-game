#!/usr/bin/env python3
"""リメイク版のアセット目録を生成する（remake/data/manifest.json）。

リメイク版は data/*.json を実行時に直接読むのでバンドル不要だが、
画像の「どれが存在するか」と「立ち絵の透過余白」はブラウザから安く
調べられないため、ここで計測して1ファイルにまとめる。

立ち絵・背景・CGを追加/差し替えたときだけ実行すればよい:
    python3 remake/tools/build_manifest.py

依存: Pillow（必須）、numpy + scipy（推奨。無いと足元アンカー ax が
bbox 中心で代用され、表情差分で立ち絵が左右にずれやすくなる）
"""

import datetime
import json
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Pillow が必要です: pip install Pillow numpy scipy")

try:
    import numpy as np
    from scipy import ndimage
except ImportError:  # pragma: no cover
    np = None
    ndimage = None
    print("WARN: numpy/scipy が無いので ax は bbox 中心で代用します", file=sys.stderr)

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"
OUT = ROOT / "remake" / "data" / "manifest.json"


def measure(png: Path):
    """本体の bbox（画像比）と足元の重心x（画像比）を返す。"""
    im = Image.open(png).convert("RGBA")
    w, h = im.size
    if np is not None:
        alpha = np.asarray(im)[..., 3]
        visible = alpha >= 24
        if not visible.any():
            return None
        labels, n = ndimage.label(visible)
        mask = visible
        if n > 1:
            # 背景消し残りの小さな島を除外し、本体（最大成分とその近傍）だけを測る
            sizes = ndimage.sum(visible, labels, range(1, n + 1))
            main = int(np.argmax(sizes)) + 1
            near = ndimage.binary_dilation(labels == main, iterations=12)
            keep = np.zeros(n + 1, dtype=bool)
            for i, size in enumerate(sizes, start=1):
                keep[i] = i == main or size >= sizes[main - 1] * 0.01 or bool((labels == i)[near].any())
            mask = keep[labels]
        ys, xs = np.where(mask)
        x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
        feet_top = y1 - max(1, int((y1 - y0) * 0.2))
        _, fxs = np.where(mask[feet_top:y1])
        feet = float(fxs.mean()) if len(fxs) else (x0 + x1) / 2
    else:
        bbox = im.getbbox()
        if not bbox:
            return None
        x0, y0, x1, y1 = bbox
        feet = (x0 + x1) / 2
    return {"top": y0 / h, "bottom": y1 / h, "ax": feet / w, "aspect": w / h}


def portraits():
    """キャラごとに表情一覧と共通の framing 値（全表情で同じ＝表情を変えても絵が動かない）。"""
    out = {}
    base = ASSETS / "sprites" / "characters"
    for d in sorted(p for p in base.iterdir() if p.is_dir()):
        faces, metrics = [], {}
        for png in sorted(d.glob(f"chr_{d.name}_*.png")):
            m = re.match(rf"chr_{re.escape(d.name)}_(.+)\.png$", png.name)
            if not m:
                continue
            faces.append(m.group(1))
            r = measure(png)
            if r:
                metrics[m.group(1)] = r
        if not faces:
            continue
        entry = {"faces": faces}
        if metrics:
            top = min(r["top"] for r in metrics.values())
            bottom = max(r["bottom"] for r in metrics.values())
            ref = metrics.get("normal") or next(iter(metrics.values()))
            entry.update({
                "h": round(bottom - top, 4),     # 本体の高さ（画像高さ比）
                "b": round(1 - bottom, 4),       # 下端の余白（画像高さ比）
                "ax": round(ref["ax"], 4),       # 足元の重心x（画像幅比）
                "aspect": round(ref["aspect"], 4),
            })
        out[d.name] = entry
    return out


def making_boxes():
    """作業台パーツ（assets/ui/making）の実コンテンツ bbox（画像比 l,t,r,b）。
    キャンバスの余白が素材ごとにバラバラでも、CSS 側で絵そのものを正確に置けるようにする。"""
    out = {}
    for png in sorted((ASSETS / "ui" / "making").glob("*.png")):
        im = Image.open(png).convert("RGBA")
        box = im.getchannel("A").point(lambda a: 255 if a >= 24 else 0).getbbox()
        if box:
            w, h = im.size
            out[png.name] = [round(box[0] / w, 4), round(box[1] / h, 4), round(box[2] / w, 4), round(box[3] / h, 4), round(w / h, 4)]
    return out


def listing(sub: str, pattern: str = "*.png"):
    """実在する（0バイトのプレースホルダでない）ファイル名だけを返す。"""
    d = ASSETS / sub
    return sorted(p.name for p in d.glob(pattern) if p.stat().st_size > 0) if d.exists() else []


def is_placeholder(path: Path) -> bool:
    """文字だけの仮置き画像（無地の背景に説明文）を見分ける。ほぼ1色で埋まっていれば仮置きとみなす"""
    im = Image.open(path).convert("RGB").resize((160, 90))
    a = np.asarray(im).reshape(-1, 3).astype(int)
    vals, counts = np.unique(a // 8, axis=0, return_counts=True)
    return counts.max() / len(a) > 0.8


def main():
    manifest = {
        "_comment": "自動生成。編集しない。再生成: python3 remake/tools/build_manifest.py",
        "generated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "portraits": portraits(),
        "backgrounds": listing("backgrounds"),
        # 仮置きCG（文字だけの画像）は載せない＝場面では飛ばし、ギャラリーにも出さない
        "cgs": [f for f in listing("cgs") if not is_placeholder(ASSETS / "cgs" / f)],
        "faceIcons": listing("ui/face_icons"),
        "making": listing("ui/making"),
        "makingBox": making_boxes(),
        "bgm": listing("audio/bgm", "*.mp3"),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(manifest['portraits'])} characters, "
          f"{len(manifest['backgrounds'])} backgrounds, {len(manifest['cgs'])} cgs")
    # 表示用の軽い WebP（remake/img/）も作る。変換済みで新しいものは飛ばすので2回目以降は速い
    import build_images
    build_images.main()


if __name__ == "__main__":
    main()
