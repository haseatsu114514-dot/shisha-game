"""てつこといっしょ（#2454・TKT01）の絵を、Codex の原画から画面用に作る。依頼と採用の記録は asset_sources/tetsuko-care/README.md。

使い方:
  git lfs pull --include="asset_sources/tetsuko-care/originals/prop_*"   # 原画の実体（小物だけなら約8MB）
  python3 remake/tools/build_tetsuko_art.py                             # 小物を作り直す

- 原画は単色マゼンタ（#FF00FF）の背景。マゼンタを透過にする。縁（背景から3px以内）だけは、混ざったマゼンタの分を
  半透明に戻して色を引き戻す（輪郭が紫ににじまない）。絵の内側の色には触らない。
- 余白を切り、画面に出す大きさの2倍（@2x）へ LANCZOS で縮める。拡大はしない。
- 箱とベッドは、口より手前の壁・縁を *_front に分ける（猫が中にいる時だけ、猫の上に重ねる。tetsuko-time.css）。
  分け目は原画を余白で切った後の座標で書く（下の FRONT）。トンネルは中の猫を隠してしっぽだけ出すので分けない。
- 採用版の PNG を assets/ui/tetsuko/、実行時の WebP を remake/img/ui/tetsuko/ に書く（どちらも新しい画像なので Git LFS）。
  ブラシは手元の道具のカーソル（48px の PNG）も作る。
- 書いた後は remake/js/minigames/tetsuko-art.js の ART_READY に名前を足すと、その小物だけ CSS の絵から差し替わる。
"""
import io
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "asset_sources" / "tetsuko-care" / "originals"
PNG_OUT = ROOT / "assets" / "ui" / "tetsuko"
WEBP_OUT = ROOT / "remake" / "img" / "ui" / "tetsuko"
MAGENTA = np.array([255.0, 0.0, 255.0], dtype=np.float32)

# 名前 → 原画・画面での幅（1280×720 の px。書き出しはこの2倍）。採用の理由は README の採用の記録。
PROPS = {
    "box": ("prop_box.png", 330),
    "ball": ("prop_ball.png", 58),
    "cushion": ("prop_cushion.png", 250),
    "scratcher": ("prop_scratcher.png", 230),
    "tunnel": ("prop_tunnel.png", 300),
    "bed": ("prop_bed.png", 290),
    "plate_full": ("prop_plate_full.png", 140),
    "plate_empty": ("prop_plate_empty.png", 140),
    "teaser_tip": ("prop_teaser_tip.png", 76),
    "teaser_stick": ("prop_teaser_stick.png", 600),
    "brush": ("prop_brush.png", 120),
}
# 同じ切り出し枠を使う組（おやつの前後で皿の位置・大きさが跳ねない）
SHARED_BOX = {"plate_full": ("plate_full", "plate_empty"), "plate_empty": ("plate_full", "plate_empty")}
# 口より手前（余白で切った後の座標）。below: その行から下。curve: 3点を通る放物線より下（外側は端の高さ）。
FRONT = {
    "box": ("below", 445),
    "bed": ("curve", [(204, 347), (510, 502), (806, 342)]),
}
CURSOR = ("brush", 48)


def key_magenta(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = np.clip((np.minimum(r, b) - g) / 255.0, 0.0, 1.0)  # 純粋なマゼンタで 1
    bg = mag > 0.85
    band = np.asarray(Image.fromarray((bg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
    edge = band & ~bg
    alpha = np.ones_like(mag)
    alpha[bg] = 0.0
    alpha[edge] = np.clip((1.0 - mag[edge]) * 1.05, 0.0, 1.0)
    rgb = a.copy()
    safe = np.maximum(alpha, 1e-3)[..., None]
    unmixed = (a - (1.0 - alpha)[..., None] * MAGENTA) / safe
    rgb[edge] = np.clip(unmixed[edge], 0, 255)
    rgb[alpha <= 0.02] = 0
    return np.dstack([rgb, alpha * 255.0]).astype(np.uint8)


def bbox(rgba):
    ys, xs = np.where(rgba[..., 3] > 8)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def front_mask(shape, spec):
    h, w = shape
    yy = np.arange(h)[:, None].repeat(w, axis=1)
    if spec[0] == "below":
        return yy >= spec[1]
    (x0, y0), (x1, y1), (x2, y2) = spec[1]
    coef = np.polyfit([x0, x1, x2], [y0, y1, y2], 2)
    xs = np.clip(np.arange(w), x0, x2)
    cut = np.polyval(coef, xs)
    return yy >= cut[None, :]


def encode_webp(im):
    best = None
    for opts in ({"lossless": True, "method": 6, "exact": False}, {"quality": 90, "method": 6, "alpha_quality": 100}):
        buf = io.BytesIO()
        im.save(buf, "WEBP", **opts)
        if best is None or len(buf.getvalue()) < len(best):
            best = buf.getvalue()
    return best


def save(name, im):
    PNG_OUT.mkdir(parents=True, exist_ok=True)
    WEBP_OUT.mkdir(parents=True, exist_ok=True)
    im.save(PNG_OUT / f"prop_{name}.png", optimize=True)
    (WEBP_OUT / f"prop_{name}.webp").write_bytes(encode_webp(im))
    print(f"prop_{name}: {im.width}x{im.height} (画面 {im.width / 2:g}x{im.height / 2:g})")


def scale_to(im, display_width):
    target = min(im.width, display_width * 2)
    k = target / im.width
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)


def main():
    keyed = {name: key_magenta(SRC / src) for name, (src, _) in PROPS.items()}
    for name, (src, width) in PROPS.items():
        rgba = keyed[name]
        group = SHARED_BOX.get(name, (name,))
        boxes = [bbox(keyed[n]) for n in group]
        x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
        x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
        crop = rgba[y0:y1, x0:x1].copy()
        im = Image.fromarray(crop, "RGBA")
        save(name, scale_to(im, width))
        if name in FRONT:
            front = crop.copy()
            front[..., 3] = np.where(front_mask(crop.shape[:2], FRONT[name]), front[..., 3], 0)
            save(f"{name}_front", scale_to(Image.fromarray(front, "RGBA"), width))
        if name == CURSOR[0]:
            cur = im.copy()
            cur.thumbnail((CURSOR[1], CURSOR[1]), Image.LANCZOS)
            WEBP_OUT.mkdir(parents=True, exist_ok=True)
            cur.save(WEBP_OUT / f"prop_{name}_cursor.png", optimize=True)
            print(f"prop_{name}_cursor: {cur.width}x{cur.height}")


if __name__ == "__main__":
    main()
