#!/usr/bin/env python3
"""なる（裏ボス）のサンドボード6ポーズ（Issue #3222・Codex 原画）をゲーム用 WebP にする。

主人公の背面（remake/img/ui/desert_ride/rider_<pose>.webp）と同じ縮尺・同じ基準点の考え方にそろえる:
- 縮尺: 主人公の同じポーズと「絵の上端（頭）から板の中心まで」の長さが同じになる倍率（転倒だけは板が離れるので、絵の高さ）。
  なるの身長（176cm）とヌール（168cm）の差は、絵ではなく描く時の倍率（desert-ride.js の RIVAL_ART_SCALE）で付ける。
- 基準点: 板の中心（クリーム色の画素の重心）。転倒は、主人公の転倒の基準点が絵の範囲のどこにあるかを写す。
- 透明部分の薄いノイズ（不透明度 10 未満で、人物から 6px 以上離れた点）を消す。キャンバスは絵の範囲＋2px。

使い方: python3 asset_sources/desert-ride-naru-3222/build.py
出力: remake/img/ui/desert_ride/rider_naru_<pose>.webp と、同じフォルダの adoption.json（寸法・基準点・倍率・原画の SHA-256）。
desert-ride-art.js の naruRider… の size / anchor はこの adoption.json と同じ値（remake/test/desert_ride.mjs が照合する）。
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RIDE = ROOT / "remake/img/ui/desert_ride"
REF_RECORD = json.loads((ROOT / "asset_sources/desert-ride-2306/adoption.json").read_text())
POSES = ["ride", "lean_left", "lean_right", "jump", "brace", "fall"]
MARGIN = 2


def rgba(path):
    return np.asarray(Image.open(path).convert("RGBA")).astype(np.int32)


def content_box(a):
    ys, xs = np.nonzero(a[..., 3] > 128)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def board_center(a, kind):
    r, g, b, al = (a[..., i] for i in range(4))
    if kind == "orange":  # 主人公の板
        m = (r > 190) & (g > 60) & (g < 170) & (b < 110) & (r - g > 60)
    else:  # なるのクリーム色の板（白い靴・銀の髪・日焼けした肌は入らない）
        m = (r > 222) & (g > 188) & (b > 125) & (b < 210) & (r - b > 32) & (g - b > 12)
    ys, xs = np.nonzero(m & (al > 200))
    return float(xs.mean()), float(ys.mean())


def clean_alpha(im):
    """人物から離れた薄い点を消す（縁のなめらかさは残す）。"""
    alpha = im.getchannel("A")
    near = alpha.point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.MaxFilter(13))  # 半径6px
    a = np.asarray(alpha).copy()
    a[(a < 10) & (np.asarray(near) == 0)] = 0
    out = im.copy()
    out.putalpha(Image.fromarray(a))
    return out


def build(pose):
    raw_path = HERE / f"rider_naru_{pose}.png"
    ref_path = RIDE / f"rider_{pose}.webp"
    ref = rgba(ref_path)
    ref_box = content_box(ref)
    raw_im = clean_alpha(Image.open(raw_path).convert("RGBA"))
    raw = np.asarray(raw_im).astype(np.int32)
    raw_box = content_box(raw)
    if pose == "fall":
        scale = (ref_box[3] - ref_box[1]) / (raw_box[3] - raw_box[1])
    else:
        ref_board, raw_board = board_center(ref, "orange"), board_center(raw, "cream")
        scale = (ref_board[1] - ref_box[1]) / (raw_board[1] - raw_box[1])
    # 絵の範囲だけを切り出して縮小する（乗算済みアルファで縮め、縁に黒いにじみを出さない）
    crop = raw_im.crop((raw_box[0] - MARGIN, raw_box[1] - MARGIN, raw_box[2] + MARGIN, raw_box[3] + MARGIN))
    size = (round(crop.width * scale), round(crop.height * scale))
    out = crop.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")
    out_a = np.asarray(out).astype(np.int32)
    if pose == "fall":
        # 主人公の転倒の基準点が、絵の範囲のどこにあるか（割合）を写す
        ref_anchor = REF_RECORD["rider_fall"]["anchor"]
        h, w = ref.shape[:2]
        fx = (ref_anchor["x"] * w - ref_box[0]) / (ref_box[2] - ref_box[0])
        fy = (ref_anchor["y"] * h - ref_box[1]) / (ref_box[3] - ref_box[1])
        box = content_box(out_a)
        ax, ay = box[0] + fx * (box[2] - box[0]), box[1] + fy * (box[3] - box[1])
    else:
        ax, ay = board_center(out_a, "cream")
    webp = RIDE / f"rider_naru_{pose}.webp"
    out.save(webp, "WEBP", quality=90, method=6)
    return {
        "raw": raw_path.relative_to(ROOT).as_posix(),
        "raw_sha256": hashlib.sha256(raw_path.read_bytes()).hexdigest(),
        "webp": webp.relative_to(ROOT).as_posix(),
        "size": [out.width, out.height],
        "anchor": {"x": round(float(ax) / out.width, 4), "y": round(float(ay) / out.height, 4)},
        "scale": round(scale, 4),
        "reference": ref_path.relative_to(ROOT).as_posix(),
    }


def main():
    record = {
        "source": "Codex image_gen (Issue #3222). Raw PNGs as delivered (SHA-256 checked against the handoff SHA256.json). Rebuilt here to the protagonist's scale and board-centre anchors; Codex's own centred canvas candidates were not adopted.",
        "basis": "per pose, the same head-top-to-board-centre length as the protagonist's sprite (fall: the same content height); anchor = board centre (fall: the protagonist's fall anchor mapped into the content box)",
    }
    for pose in POSES:
        record[f"rider_naru_{pose}"] = build(pose)
        entry = record[f"rider_naru_{pose}"]
        print(pose, entry["size"], entry["anchor"], entry["scale"])
    (HERE / "adoption.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
