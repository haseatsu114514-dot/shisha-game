#!/usr/bin/env python3
"""通りの試作（web/proto/street/・本編未接続）用に、画像生成AIの街並みをゲーム用の小さなドット絵へ変換する。

入力（asset_sources/images/proto_street/）:
  facades_sheet.png  建物の正面 6棟（横3×縦2・マゼンタ背景）
  props_sheet.png    街の小物 6個（横3×縦2・マゼンタ背景）
  ground_strip.png   歩道→縁石→車道の横長の帯（背景なし）

出力（assets/proto_street/）:
  facade_{cafe,peppermint,kemurikusa,filler_a,filler_b,filler_c}.png
  prop_{vending,bench,aboard,plant,lamp,bicycle}.png
  ground.png             横につなげて敷ける地面（左右の端が継ぎ目なくつながる幅で切ってある）
  street_assets.json     各画像の大きさ・ドアの位置（ページはこれを読んで入口の当たりを決める）
確認用（ゲームでは使わない・水色の枠＝ドアと看板）:
  asset_sources/images/proto_street/preview_street.png

やること:
  - クロマキーは tools/proto_walk_sheet.py の key_background（背景の色むらに強い・絵の中のピンクは抜かない）
  - シートを等分せず、塊の位置で 6 個を切り出す（シートの寸法は列数・行数で割り切れない）
  - 建物は「ドアの高さが揃う」倍率で 1 棟ずつ縮める（生成画像のドアは ±8% ほど大きさがばらつく）。
    ただし建物の高さが --facade-max-h を超えないように抑える（画面の上で屋根が切れないように）
  - 小物は種類ごとの高さに縮める（元の絵どうしの縮尺がばらばらなため）
  - 地面は歩道のタイル（約100px周期）と車道の白線（約198px周期）をそれぞれ整数周期で切り、
    タイル10ドット・白線20ドットの周期にそろえて、幅200ドットのつなげられる帯にする
  - 縮小は LANCZOS、減色はシートごと。半透明は二値化（tools/pixelize.py と同じ方針）

⚠️ ドアと看板の位置（FACADES）は今の facades_sheet.png を目で測った値。画像を作り直したら、
   --preview の確認画像（水色の枠）を見て測り直すこと。

使い方:
  python3 tools/proto_street_assets.py                 # 320×180 の試作用 → assets/proto_street/
  python3 tools/proto_street_assets.py --profile hd    # 640×360 の高解像度2.5D版 → assets/proto_street_hd/
  python3 tools/proto_street_assets.py --door-h 38 --facade-max-h 112
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixelize import detect_key_color  # noqa: E402
from proto_walk_sheet import ALPHA_SOLID, find_blobs, key_background, order_in_grid  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "asset_sources" / "images" / "proto_street"
OUT_DIR = REPO_ROOT / "assets" / "proto_street"   # main() で --profile に合わせて差し替える
PREVIEW_PATH = SRC_DIR / "preview_street.png"

# 建物（シートの左上から順）と、元画像でのドア・無地の看板の矩形 (x0, y0, x1, y1)。
# 看板の文字はページ側で描く（画像に焼き込まない）
FACADES = [
    ("cafe", (355, 340, 420, 492), (148, 226, 362, 272)),
    ("peppermint", (826, 350, 893, 494), (663, 243, 873, 302)),
    ("kemurikusa", (1322, 330, 1398, 495), (1122, 222, 1381, 277)),
    ("filler_a", (362, 800, 428, 966), (137, 690, 387, 740)),     # 古着屋
    ("filler_b", (880, 800, 945, 962), (617, 698, 877, 752)),     # シャッターの下りた店
    ("filler_c", (1340, 797, 1418, 966), (1093, 683, 1330, 741)),  # たい焼き屋
]
# 小物（シートの左上から順）と、ゲームでの高さ（ドット）
PROPS = [("vending", 34), ("bench", 16), ("aboard", 19), ("plant", 18), ("lamp", 56), ("bicycle", 19)]

# 地面の帯（ground_strip.png の行）: 歩道 0〜405 / 縁石 405〜445 / 車道 445〜
GROUND_CURB_Y = (405, 445)
GROUND_TILE_PERIOD = 100.5   # 歩道タイルの横周期（元画像px）
GROUND_DASH_PERIOD = 197.5   # 車道の白線の横周期（元画像px）
GROUND_TILES = 20            # 出力の帯にタイル20枚 = 白線10本ぶん（左右の端が継ぎ目なくつながる）
GROUND_DASHES = 10

# 出力の種類。base = 320×180 の試作（web/proto/street の標準）、hd = 640×360 の高解像度2.5D版（AA9）
PROFILES = {
    "base": {"out": "proto_street", "door_h": 36, "facade_max_h": 110, "ground_h": 68, "ground_w": 200, "prop_scale": 1.0},
    "hd": {"out": "proto_street_hd", "door_h": 56, "facade_max_h": 172, "ground_h": 150, "ground_w": 400, "prop_scale": 1.6,
           "depth": True, "far_h": 210, "pole_h": 380},
}


def shrink(img: Image.Image, size, colors: int) -> Image.Image:
    """縮小→減色→半透明の二値化。"""
    small = img.resize(size, Image.LANCZOS)
    alpha = small.getchannel("A").point(lambda v: 255 if v >= ALPHA_SOLID else 0)
    rgb = small.convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT).convert("RGB").convert("RGBA")
    rgb.putalpha(alpha)
    return rgb


def cut_sheet(path: Path, cols: int, rows: int):
    src = Image.open(path).convert("RGBA")
    key = detect_key_color(src)
    keyed = key_background(src, key)
    grid = order_in_grid(find_blobs(keyed, cols * rows, join_px=4), cols, rows)
    if grid is None:
        sys.exit(f"{path.name}: 塊が {cols}x{rows} 個に分かれませんでした（建物どうしが近すぎる・ゴミが大きい等）")
    return keyed, [b for row in grid for b in row]


def build_facades(args, report):
    keyed, blobs = cut_sheet(SRC_DIR / "facades_sheet.png", 3, 2)
    meta = {}
    for (name, door, sign), (x0, y0, x1, y1, _) in zip(FACADES, blobs):
        for label, (rx0, ry0, rx1, ry1) in (("ドア", door), ("看板", sign)):
            if not (x0 <= rx0 < rx1 <= x1 and y0 <= ry0 < ry1 <= y1):
                sys.exit(f"facade_{name}: {label}の矩形 {(rx0, ry0, rx1, ry1)} が建物 {(x0, y0, x1, y1)} の外にあります。FACADES を測り直してください")
        dx0, dy0, dx1, dy1 = door
        crop = keyed.crop((x0, y0, x1, y1))
        scale = min(args.door_h / (dy1 - dy0), args.facade_max_h / crop.height)
        w, h = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
        out = shrink(crop, (w, h), args.colors)
        out.save(OUT_DIR / f"facade_{name}.png")
        rect = lambda r: [round((r[0] - x0) * scale), round((r[1] - y0) * scale), round((r[2] - r[0]) * scale), round((r[3] - r[1]) * scale)]
        d, sg = rect(door), rect(sign)
        meta[name] = {"w": w, "h": h, "door": d, "sign": sg}
        report.append((f"facade_{name}", out, [d, sg]))
        print(f"facade_{name}: {w}x{h}  ドア x{d[0]} y{d[1]} {d[2]}x{d[3]}  看板 x{sg[0]} y{sg[1]} {sg[2]}x{sg[3]}（倍率 {scale:.3f}）")
    return meta


def build_props(args, report):
    keyed, blobs = cut_sheet(SRC_DIR / "props_sheet.png", 3, 2)
    meta = {}
    for (name, base_h), (x0, y0, x1, y1, _) in zip(PROPS, blobs):
        height = round(base_h * args.prop_scale)
        crop = keyed.crop((x0, y0, x1, y1))
        scale = height / crop.height
        w = max(1, round(crop.width * scale))
        out = shrink(crop, (w, height), args.colors)
        out.save(OUT_DIR / f"prop_{name}.png")
        meta[name] = {"w": w, "h": height}
        report.append((f"prop_{name}", out, []))
        print(f"prop_{name}: {w}x{height}")
    return meta


def phase_of(profile: np.ndarray, period: float) -> int:
    """周期 period の縞の、いちばん暗い位置（タイルの目地・白線の間）の位相を返す。"""
    best, best_x = None, 0
    for x in range(int(period)):
        idx = (x + np.arange(int((len(profile) - x) / period)) * period).astype(int)
        v = profile[idx].mean()
        if best is None or v < best:
            best, best_x = v, x
    return best_x


def build_ground(args, report):
    src = Image.open(SRC_DIR / "ground_strip.png").convert("RGB")
    lum = np.asarray(src).astype(np.float32).mean(axis=2)
    curb0, curb1 = GROUND_CURB_Y
    # 歩道＋縁石: タイルの目地（暗い縦線）から GROUND_TILES 枚ぶん
    walk_profile = lum[:curb0].mean(axis=0)
    tx = phase_of(walk_profile, GROUND_TILE_PERIOD)
    tw = GROUND_TILE_PERIOD * GROUND_TILES
    if tx + tw > src.width:
        sys.exit("ground_strip.png の幅がタイル20枚ぶんに足りません")
    # 車道: 白線と白線の間（暗いところ）から GROUND_DASHES 本ぶん。白線の行だけで位相を測る
    road_profile = lum[curb1:].max(axis=0)
    rx = phase_of(road_profile, GROUND_DASH_PERIOD)
    rw = GROUND_DASH_PERIOD * GROUND_DASHES
    if rx + rw > src.width:
        rx = max(0, int(src.width - rw))
    total_h = args.ground_h
    sy = total_h / src.height
    top_h = round(curb1 * sy)
    gw = args.ground_w
    top = src.crop((tx, 0, round(tx + tw), curb1)).resize((gw, top_h), Image.LANCZOS)
    road = src.crop((rx, curb1, round(rx + rw), src.height)).resize((gw, total_h - top_h), Image.LANCZOS)
    strip = Image.new("RGB", (gw, total_h))
    strip.paste(top, (0, 0))
    strip.paste(road, (0, top_h))
    # 歩道と車道は別々に減色する（一緒にすると、少ない白線の白が点字ブロックの黄色に吸われる）
    q_top = strip.crop((0, 0, gw, top_h)).quantize(colors=args.ground_colors, method=Image.MEDIANCUT)
    q_road = strip.crop((0, top_h, gw, total_h)).quantize(colors=max(4, args.ground_colors // 2), method=Image.MEDIANCUT)
    strip = Image.new("RGBA", (gw, total_h))
    strip.paste(q_top.convert("RGBA"), (0, 0))
    strip.paste(q_road.convert("RGBA"), (0, top_h))
    strip.save(OUT_DIR / "ground.png")
    meta = {
        "w": gw,
        "h": total_h,
        "sidewalk": [0, round(curb0 * sy)],
        "curb": [round(curb0 * sy), top_h],
        "road": [top_h, total_h],
    }
    # 継ぎ目の確認用に2枚つなげたものを出す
    twice = Image.new("RGBA", (gw * 2, total_h))
    twice.paste(strip, (0, 0))
    twice.paste(strip, (gw, 0))
    report.append(("ground x2 (seam check)", twice, []))
    print(f"ground: {gw}x{total_h}  歩道 {meta['sidewalk']} / 縁石 {meta['curb']} / 車道 {meta['road']}")
    return meta


def seamless(img: Image.Image, overlap: float = 0.08) -> Image.Image:
    """左右の端を重ねてなじませ、横に並べても継ぎ目が見えない画像にする（幅は overlap ぶん縮む）。"""
    w, h = img.size
    k = max(2, int(w * overlap))
    body = img.crop((0, 0, w - k, h)).convert("RGBA")
    tail = img.crop((w - k, 0, w, h)).convert("RGBA")
    head = body.crop((0, 0, k, h))
    mask = Image.linear_gradient("L").rotate(90, expand=True).resize((k, h))   # 左=255 → 右=0
    body.paste(Image.composite(tail, head, mask), (0, 0))
    return body


def build_depth(args, report):
    """高解像度2.5D版の奥行き素材（Codexに発注中・届いていれば変換する）。

    far_day.png / far_night.png … 遠景のパノラマ（横長・左右がつながる）。地面の上端までの高さに縮めて継ぎ目をなじませる
    fg_utility_pole.png         … 手前を横切る電柱（マゼンタ背景）。透過して画面の高さ＋αに縮める（ゲーム側でぼかす）
    """
    meta = {}
    for name in ("far_day", "far_night"):
        src = SRC_DIR / f"{name}.png"
        if not src.exists():
            print(f"{name}: 元画像なし（{src.name} が届いたら変換する）")
            continue
        im = Image.open(src).convert("RGB")
        h = args.far_h
        im = im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)
        out = seamless(im)
        out.save(OUT_DIR / f"{name}.png")
        meta[name] = {"w": out.width, "h": out.height}
        report.append((name, out, []))
        print(f"{name}: {out.width}x{out.height}")
    src = SRC_DIR / "fg_utility_pole.png"
    if src.exists():
        im = Image.open(src).convert("RGBA")
        keyed = key_background(im, detect_key_color(im))
        bbox = keyed.getchannel("A").point(lambda v: 255 if v >= ALPHA_SOLID else 0).getbbox()
        pole = keyed.crop(bbox)
        h = args.pole_h
        pole = pole.resize((max(1, round(pole.width * h / pole.height)), h), Image.LANCZOS)
        pole.save(OUT_DIR / "fg_utility_pole.png")
        meta["fg_utility_pole"] = {"w": pole.width, "h": pole.height}
        report.append(("fg_utility_pole", pole, []))
        print(f"fg_utility_pole: {pole.width}x{pole.height}")
    else:
        print("fg_utility_pole: 元画像なし（届いたら変換する）")
    return meta


def write_preview(report, path: Path, zoom: int = 3):
    pad = 12
    items = []
    for label, img, rects in report:
        big = img.resize((img.width * zoom, img.height * zoom), Image.NEAREST)
        items.append((label, big, rects))
    width = 1600
    x, y, row_h = pad, pad, 0
    placed = []
    for label, big, rects in items:
        if x + big.width + pad > width:
            x, y = pad, y + row_h + pad + 16
            row_h = 0
        placed.append((x, y + 16, label, big, rects))
        x += big.width + pad
        row_h = max(row_h, big.height)
    height = y + row_h + pad + 16
    canvas = Image.new("RGBA", (width, height), (142, 134, 122, 255))
    d = ImageDraw.Draw(canvas)
    for px, py, label, big, rects in placed:
        d.text((px, py - 14), label, fill=(20, 16, 24, 255))
        canvas.alpha_composite(big, (px, py))
        for rx, ry, rw, rh in rects:
            d.rectangle((px + rx * zoom, py + ry * zoom, px + (rx + rw) * zoom - 1, py + (ry + rh) * zoom - 1), outline=(0, 255, 255, 255))
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path)
    print(f"wrote {path}（確認用・水色の枠＝ドアと看板）")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--profile", choices=sorted(PROFILES), default="base",
                    help="base = 320×180 の試作（assets/proto_street/）／ hd = 640×360 の高解像度2.5D版（assets/proto_street_hd/）")
    ap.add_argument("--door-h", type=int, help="ドアの高さ（ドット）。既定は base 36（キャラ32）／hd 56（キャラ48）")
    ap.add_argument("--facade-max-h", type=int, help="建物の高さの上限（ドット）")
    ap.add_argument("--ground-h", type=int, help="地面の帯の高さ（ドット）")
    ap.add_argument("--ground-w", type=int, help="地面の帯の幅（ドット。タイル20枚ぶん）")
    ap.add_argument("--prop-scale", type=float, help="小物の高さの倍率（base の高さが基準）")
    ap.add_argument("--colors", type=int, default=48)
    ap.add_argument("--ground-colors", type=int, default=24)
    ap.add_argument("--no-preview", action="store_true")
    args = ap.parse_args()

    global OUT_DIR, PREVIEW_PATH
    prof = PROFILES[args.profile]
    for key in ("door_h", "facade_max_h", "ground_h", "ground_w", "prop_scale"):
        if getattr(args, key) is None:
            setattr(args, key, prof[key])
    OUT_DIR = REPO_ROOT / "assets" / prof["out"]
    if args.profile != "base":
        PREVIEW_PATH = SRC_DIR / f"preview_street_{args.profile}.png"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    report = []
    meta = {
        "note": "tools/proto_street_assets.py が生成。手で編集しない",
        "facades": build_facades(args, report),
        "props": build_props(args, report),
        "ground": build_ground(args, report),
    }
    if prof.get("depth"):
        args.far_h, args.pole_h = prof["far_h"], prof["pole_h"]
        meta["depth"] = build_depth(args, report)
    (OUT_DIR / "street_assets.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT_DIR / 'street_assets.json'}")
    if not args.no_preview:
        write_preview(report, PREVIEW_PATH)


if __name__ == "__main__":
    main()
