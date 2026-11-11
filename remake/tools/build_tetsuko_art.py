"""てつこといっしょ（#2454・TKT01）の絵を、Codex の原画から画面用に作る。依頼と採用の記録は asset_sources/tetsuko-care/README.md。

使い方:
  git lfs pull --include="asset_sources/tetsuko-care/originals/prop_*"   # 原画の実体（小物だけなら約8MB）
  python3 remake/tools/build_tetsuko_art.py                             # 小物を作り直す
  python3 remake/tools/build_tetsuko_art.py ui cats scene               # TKT25・26 の UI の部品・猫のしぐさ・膝としっぽ（#3213・#3214）
  python3 remake/tools/build_tetsuko_art.py ui_b                        # TKT27 の UI の部品の B 段（#3243・PR #3248 の原画）

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


# ---- TKT25・26（#3213・#3214・2026-11-11）--------------------------------------------------------------------
# 背景のマゼンタが #FF00FF ちょうどでなく、場所によって (236,22,237)〜(244,14,243) と揺れる。原画の周りの帯から背景の色を
# 測り、その色からの近さで抜く（縁は、測った背景の色との混ざりを戻す）。絵の内側の色には触らない。
def key_tolerant(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    ring = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    bgc = np.median(ring, axis=0)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    base = max(1.0, min(bgc[0], bgc[2]) - bgc[1])
    mag = np.clip((np.minimum(r, b) - g) / base, 0.0, 1.0)      # 測った背景の色で 1
    hue = np.abs(r - b) < 48                                       # 赤みと青みがそろっている（マゼンタの系統）
    bg = (mag > 0.78) & hue
    band = np.asarray(Image.fromarray((bg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
    edge = band & ~bg
    alpha = np.ones_like(mag)
    alpha[bg] = 0.0
    alpha[edge] = np.clip((1.0 - mag[edge]) * 1.08, 0.0, 1.0)
    rgb = a.copy()
    safe = np.maximum(alpha, 1e-3)[..., None]
    unmixed = (a - (1.0 - alpha)[..., None] * bgc) / safe
    rgb[edge] = np.clip(unmixed[edge], 0, 255)
    rgb[alpha <= 0.02] = 0
    return np.dstack([rgb, alpha * 255.0]).astype(np.uint8)


def crop_box(rgba, pad=0):
    x0, y0, x1, y1 = bbox(rgba)
    h, w = rgba.shape[:2]
    return max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)


def save_as(stem, im):
    PNG_OUT.mkdir(parents=True, exist_ok=True)
    WEBP_OUT.mkdir(parents=True, exist_ok=True)
    im.save(PNG_OUT / f"{stem}.png", optimize=True)
    (WEBP_OUT / f"{stem}.webp").write_bytes(encode_webp(im))
    print(f"{stem}: {im.width}x{im.height}")


def fit_width(im, width):
    k = min(1.0, width / im.width)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


# UI の部品（専用テーマ「茶トラと段ボール」）。名前 → (原画, 書き出しの幅 px)。組は同じ切り出し枠（重ねても形がずれない）。
# #3213 の原画は2回分ある。正規名（PR #3223）ではなく、オーナー経由で届いた *_candidate2 を使う（README の採用の記録）。
UI_PARTS = {
    "ui_tk_token": ("ui_tk_token_candidate2.png", 320), "ui_tk_token_pressed": ("ui_tk_token_pressed_candidate2.png", 320), "ui_tk_token_active": ("ui_tk_token_active_candidate2.png", 320),
    "ui_tk_tab": ("ui_tk_tab_candidate2.png", 360), "ui_tk_tab_pressed": ("ui_tk_tab_pressed_candidate2.png", 360), "ui_tk_tab_door": ("ui_tk_tab_door_candidate2.png", 360),
    "ui_tk_heart": ("ui_tk_heart_candidate2.png", 112), "ui_tk_heart_empty": ("ui_tk_heart_empty_candidate2.png", 112),
    "ui_tk_pill": ("ui_tk_pill_candidate2.png", 480), "ui_tk_wish": ("ui_tk_wish_candidate2.png", 240),
    "ui_tk_caption": ("ui_tk_caption_candidate2.png", 1200), "ui_tk_title": ("ui_tk_title_candidate2.png", 720),
}
UI_GROUPS = [("ui_tk_token", "ui_tk_token_pressed", "ui_tk_token_active"), ("ui_tk_tab", "ui_tk_tab_pressed", "ui_tk_tab_door"),
             ("ui_tk_heart", "ui_tk_heart_empty")]
# シートの並び（左上から）。アイコンは 6×2、粒は 4×2。1つずつ切り出し、正方形の透明な台の真ん中に置く。
ICON_NAMES = ["hand", "teaser", "brush", "treat", "decor", "book", "photo", "back", "heart", "wish", "tap", "watch"]
FX_NAMES = ["heart", "spark", "note", "sweat", "fur", "paw", "purr", "puff"]


def sheet_cells(path, cols, rows, names, stem, size):
    rgba = key_tolerant(SRC / path)
    h, w = rgba.shape[:2]
    for i, name in enumerate(names):
        cx, cy = i % cols, i // cols
        cell = rgba[round(cy * h / rows):round((cy + 1) * h / rows), round(cx * w / cols):round((cx + 1) * w / cols)].copy()
        x0, y0, x1, y1 = crop_box(cell)
        part = Image.fromarray(cell[y0:y1, x0:x1], "RGBA")
        side = max(part.width, part.height)
        square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        square.paste(part, ((side - part.width) // 2, (side - part.height) // 2))
        save_as(f"{stem}_{name}", square.resize((size, size), Image.LANCZOS) if side > size else square)


def build_ui():
    keyed = {name: key_tolerant(SRC / src) for name, (src, _) in UI_PARTS.items()}
    boxes = {name: crop_box(rgba) for name, rgba in keyed.items()}
    for group in UI_GROUPS:
        x0 = min(boxes[n][0] for n in group); y0 = min(boxes[n][1] for n in group)
        x1 = max(boxes[n][2] for n in group); y1 = max(boxes[n][3] for n in group)
        for n in group:
            boxes[n] = (x0, y0, x1, y1)
    for name, (_, width) in UI_PARTS.items():
        x0, y0, x1, y1 = boxes[name]
        save_as(name, fit_width(Image.fromarray(keyed[name][y0:y1, x0:x1], "RGBA"), width))
    sheet_cells("ui_tk_icons_candidate2.png", 6, 2, ICON_NAMES, "ui_tk_icon", 128)
    sheet_cells("ui_tk_fx_candidate2.png", 4, 2, FX_NAMES, "ui_tk_fx", 128)


# 猫のしぐさ: 既存の立ち絵と同じ縮尺（立ち絵の px＝しぐさの絵の px）で、1024×768 の透明な画面の中央下（足元 y=736・中心 x=512）に置く。
# 縮尺は、原画の中の顔の幅（耳の付け根から反対の頬まで・目で測った値）を立ち絵の顔の幅 HEAD_PX にそろえて決める。
# 跳ぶ（leap）は体が地面から離れているので、足元を少し上げる（lift。画面が跳ぶ動きを付ける）。
HEAD_PX = 160  # chr_tetsuko_normal.png の顔の幅（頬から頬。耳の先は含めない）
POSE_CANVAS = (1024, 768, 512, 736)
CATS = {  # 名前 → (原画, 原画の中の顔の幅 px, 足元を上げる px)
    # #2690（PR #2715 の候補 a/b から1枚ずつ・2026-11-11 採用。理由は README の採用の記録）
    "loaf": ("cat_loaf_b.png", 485, 0),
    "crouch": ("cat_crouch_a.png", 430, 0),
    "reach": ("cat_reach_a.png", 477, 0),
    "hug": ("cat_hug_a.png", 420, 0),
    "groom": ("cat_groom_a.png", 490, 0),
    "yawn": ("cat_yawn_a.png", 477, 0),
    "belly": ("cat_belly_a.png", 450, 0),
    "rub": ("cat_rub_b.png", 400, 0),  # 横顔なので顔の幅が狭く見える分、少し小さめに測った
    # #3214（TKT26）
    "leap": ("cat_leap.png", 370, 0),
    "flop": ("cat_flop.png", 420, 0),
    "mew": ("cat_mew.png", 500, 0),
    "poke": ("cat_poke.png", 525, 0),
}


def build_cats():
    W, H, AX, AY = POSE_CANVAS
    for name, (src, head, lift) in CATS.items():
        rgba = key_tolerant(SRC / src)
        x0, y0, x1, y1 = crop_box(rgba)
        part = Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")
        k = HEAD_PX / head
        part = part.resize((round(part.width * k), round(part.height * k)), Image.LANCZOS)
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        left = AX - part.width // 2
        top = AY - lift - part.height
        canvas.alpha_composite(part, (max(0, left), max(0, top)))
        save_as(f"cat_{name}", canvas)


# 膝（はじめの膝・TKT-PROP10）と、トンネルから出るしっぽ。画面での幅の2倍で書き出す。
SCENE = {"prop_lap": ("prop_lap.png", 560), "prop_tunnel_tail": ("prop_tunnel_tail.png", 120)}


def build_scene():
    for name, (src, width) in SCENE.items():
        rgba = key_tolerant(SRC / src)
        x0, y0, x1, y1 = crop_box(rgba)
        save_as(name, scale_to(Image.fromarray(rgba[y0:y1, x0:x1], "RGBA"), width))


# UI の部品の B 段（#3243・Codex の PR #3248 の原画・2026-11-11 採用）。名前 → (原画, 切り出し枠（原画の px・None は絵の大きさ）, 書き出しの幅)。
# テープ2枚は、同じ絵に別の部品が混ざっていたので、その部品だけを切り出す（枠は ndimage で測った塊）。
UI_B = {
    "ui_tk_tray": ("ui_tk_tray.png", None, 1200),
    "ui_tk_card": ("ui_tk_card.png", None, 384),
    "ui_tk_panel": ("ui_tk_panel.png", None, 768),
    "ui_tk_book": ("ui_tk_book.png", (16, 16, 1623, 868), 1600),          # 右の端の別の帯（背）は使わない
    "ui_tk_book_spine": ("ui_tk_book_spine.png", None, 48),
    "ui_tk_photo": ("ui_tk_photo.png", None, 460),
    "ui_tk_tape": ("ui_tk_tape.png", (1209, 221, 2045, 504), 220),       # 左の小さな写真の枠は使わない
    "ui_tk_frame": ("ui_tk_frame.png", None, 1280),
    "ui_tk_flap": ("ui_tk_flap.png", None, 640),
    "ui_tk_packtape": ("ui_tk_packtape.png", (997, 95, 1148, 1234), 80),  # 左の箱のふたは使わない（ふたは ui_tk_flap）
    "ui_tk_slot": ("ui_tk_slot.png", None, 500),
    "ui_tk_badge": ("ui_tk_badge.png", None, 96),
    "ui_tk_nametag": ("ui_tk_nametag.png", None, 300),
    "ui_tk_unknown": ("ui_tk_unknown.png", None, 192),
}


def build_ui_b():
    for name, (src, box, width) in UI_B.items():
        rgba = key_tolerant(SRC / src)
        if box:
            x0, y0, x1, y1 = box
            rgba = rgba[y0:y1, x0:x1].copy()
        x0, y0, x1, y1 = crop_box(rgba)
        save_as(name, fit_width(Image.fromarray(rgba[y0:y1, x0:x1], "RGBA"), width))


def main(groups=("props",)):
    if "ui" in groups: build_ui()
    if "ui_b" in groups: build_ui_b()
    if "cats" in groups: build_cats()
    if "scene" in groups: build_scene()
    if "props" in groups: build_props()


def build_props():
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
    import sys
    main(tuple(sys.argv[1:]) or ("props",))
