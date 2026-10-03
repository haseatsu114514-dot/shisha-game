#!/usr/bin/env python3
"""歩行スプライトシート（画像生成AIの出力・マゼンタ背景）を、ゲーム用の歩行シートに変換する。

実験ページ web/proto/walk/index.html 用（本編には未接続）。

やること:
  1. シート全体をクロマキー（key_background。背景の色むらに強い。下の説明を参照）
  2. キャラの塊を10個見つけて、位置から 横5×縦2 のどのマスかを決める
     （生成AIのシートは寸法が列数・行数で割り切れず、グリッドで切ると端がずれるため）。
     小さなゴミ（離れた点・飛沫）は除く
  3. 背中向き（上向き）のコマBを「コマAの脚だけ左右反転」で作り直す（--mirror-step。
     生成AIの背中向きはA・Bとも同じ足を上げていて、交互に歩いて見えないことが多い）
  4. **全コマ共通の縮小率**を決める（一番背の高いコマが指定の高さになるように）
  5. 各コマを固定サイズのセルに、**足元を下端中央に揃えて**貼る
     （1コマずつトリム＆拡縮すると、歩くたびに足元や頭身がブレるため）
  6. シート全体を1回で減色して、全コマのパレットを共通にし、外周1ドットの輪郭を足す

入力シートの並び（画像生成プロンプトと同じ）:
  列 = 下向き / 右下向き / 右向き / 右上向き / 上向き（背中）
  行 = 歩行コマA / 歩行コマB
  左向き3方向はゲーム側で左右反転して作るので、シートには含めない。

使い方:
  python3 tools/proto_walk_sheet.py
  python3 tools/proto_walk_sheet.py asset_sources/images/proto_walk/tsumugi_walk_sheet_try2.png
  python3 tools/proto_walk_sheet.py --per-frame-fit       # コマごとに大きさがバラバラなシートを全コマ同じ高さに揃える
  python3 tools/proto_walk_sheet.py --sizes 32,40,48     # 高さ違いを確認用プレビューで比べる（ページで切り替えられるのは32と48）

出力（既定）:
  assets/proto_walk/tsumugi_walk_32.png / .json（セル24×36）
  assets/proto_walk/tsumugi_walk_48.png / .json（セル36×52）
  asset_sources/images/proto_walk/preview_walk.png（全サイズを4倍で並べた確認用。ゲームでは使わない）
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixelize import detect_key_color, parse_color  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
DIRS = ["down", "down_right", "right", "up_right", "up"]
FRAMES = ["A", "B"]
DEFAULT_INPUT = REPO_ROOT / "asset_sources" / "images" / "proto_walk" / "tsumugi_walk_sheet.png"
DEFAULT_OUT = REPO_ROOT / "assets" / "proto_walk"
PREVIEW_PATH = REPO_ROOT / "asset_sources" / "images" / "proto_walk" / "preview_walk.png"
# キャラの高さ → セル寸法（web/proto/walk/index.html の SIZE_CELL と一致させる）
CELL_FOR = {32: (24, 36), 48: (36, 52)}
ALPHA_SOLID = 90       # これ未満の半透明は捨てる（ドット絵はパキッとさせる）
NOISE_RATIO = 0.02     # 最大の塊の2%未満の塊はゴミとして捨てる
OUTLINE_COLOR = (36, 26, 42, 255)  # 外周の輪郭（web/proto/walk の仮スプライトの輪郭色と同じ）
KEY_CORE = 75          # 背景色からの距離がこれ以下＝背景候補（生成AIの背景は ±40 程度むらがある）
KEY_EDGE = 182         # 背景に接した画素で距離がこれ未満＝背景色が混ざった縁（半透明にして色を戻す）


def key_background(src: Image.Image, key, core=KEY_CORE, edge=KEY_EDGE, edge_px=3, erode=2) -> Image.Image:
    """背景の色むらに強いクロマキー。

    pixelize.chroma_key は「背景色に近い色」を画像全体で一律に抜くため、
    (a) 背景のむらを拾おうと許容値を上げると、建物のピンクのネオンなど絵の中の色まで半透明になる、
    (b) 下げるとむらが残る、の板挟みになる。ここでは
      - 距離 <= core ＝背景（外周の背景も、自転車のスポークの間・ツタの隙間に見える背景も同じ扱い。
        近マゼンタ色は絵の中にまず出てこない。今回の建物のピンクは距離 100 以上）
      - 背景に edge_px 以内で接し、距離 < edge の画素＝縁。背景色の混ざりを逆算して戻し、半透明にする
      - それ以外（絵の内側）は距離に関係なく不透明のまま
    最後に輪郭を erode px 侵食して、背景色の残る縁のリングを落とす（高解像度段階なので見た目は変わらない）。
    """
    rgb = np.asarray(src.convert("RGB")).astype(np.float32)
    k = np.array(key, np.float32)
    dist = np.sqrt(((rgb - k) ** 2).sum(axis=2))
    bg = dist <= core
    edge_zone = ndimage.binary_dilation(bg, iterations=edge_px) & ~bg & (dist < edge)
    alpha = np.ones(dist.shape, np.float32)
    alpha[bg] = 0.0
    a = np.clip((dist - core) / (edge - core), 0.05, 1.0)
    alpha[edge_zone] = a[edge_zone]
    # 縁の色を戻す: 観測色 = 描画色*α + 背景色*(1-α) → 描画色 = (観測色 - 背景色*(1-α)) / α
    unmixed = (rgb - k[None, None, :] * (1 - alpha[..., None])) / np.maximum(alpha[..., None], 0.05)
    out_rgb = np.where(edge_zone[..., None], np.clip(unmixed, 0, 255), rgb)
    alpha8 = (alpha * 255).round().astype(np.uint8)
    if erode:
        solid = ndimage.binary_erosion(alpha8 > 0, iterations=erode)
        alpha8[~solid] = 0
    rgba = np.dstack([out_rgb.round().astype(np.uint8), alpha8])
    return Image.fromarray(rgba, "RGBA")


def find_blobs(keyed: Image.Image, count: int, join_px: int = 6, min_ratio: float = 0.004):
    """不透明部分の塊を大きい順に count 個返す（近い小片は join_px で同じ塊にまとめる）。

    戻り値: [(x0, y0, x1, y1, 面積), ...]。count 個に満たなければ見つかった分だけ返す。
    """
    alpha = np.asarray(keyed.getchannel("A")) >= ALPHA_SOLID
    grown = ndimage.binary_dilation(alpha, iterations=join_px) if join_px else alpha
    labels, n = ndimage.label(grown)
    if n == 0:
        return []
    areas = ndimage.sum(alpha, labels, index=range(1, n + 1))
    objs = ndimage.find_objects(labels)
    total = alpha.size
    blobs = []
    for i, sl in enumerate(objs):
        if areas[i] < total * min_ratio:
            continue
        sub = alpha[sl] & (labels[sl] == i + 1)
        ys, xs = np.nonzero(sub)
        blobs.append((sl[1].start + xs.min(), sl[0].start + ys.min(), sl[1].start + xs.max() + 1, sl[0].start + ys.max() + 1, int(areas[i])))
    blobs.sort(key=lambda b: -b[4])
    return blobs[:count]


def order_in_grid(blobs, cols: int, rows: int):
    """塊を中心座標で 行→列 の順に並べる。各行に cols 個ずつ入らなければ None。"""
    if len(blobs) != cols * rows:
        return None
    by_y = sorted(blobs, key=lambda b: (b[1] + b[3]) / 2)
    grid = []
    for r in range(rows):
        row = sorted(by_y[r * cols:(r + 1) * cols], key=lambda b: (b[0] + b[2]) / 2)
        grid.append(row)
    # 行どうしが縦に重なっていたら並びの推定を信用しない
    for r in range(rows - 1):
        if max(b[3] for b in grid[r]) > min(b[1] for b in grid[r + 1]) + 8:
            return None
    return grid


def cell_size(height: int):
    if height in CELL_FOR:
        return CELL_FOR[height]
    return (round(height * 0.75), height + 4)


def keep_main_blobs(cell: Image.Image) -> Image.Image:
    """離れた小さな点（生成AIのゴミ・飛沫）を消す。"""
    arr = np.array(cell)
    mask = arr[:, :, 3] >= ALPHA_SOLID
    labels, n = ndimage.label(mask)
    if n <= 1:
        return cell
    sizes = ndimage.sum(mask, labels, index=range(1, n + 1))
    keep_ids = [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * NOISE_RATIO]
    keep = np.isin(labels, keep_ids)
    # 本体の輪郭にかかる半透明ピクセルは残す（塊から1px以内）
    keep = ndimage.binary_dilation(keep, iterations=1)
    arr[~keep, 3] = 0
    return Image.fromarray(arr, "RGBA")


def foot_center_x(cell: Image.Image) -> float:
    """足元（下から12%の行）の不透明ピクセルの横方向の重心。歩幅が違っても足元の基準がブレにくい。"""
    alpha = cell.getchannel("A")
    w, h = cell.size
    rows = max(2, round(h * 0.12))
    xs = []
    px = alpha.load()
    for y in range(h - rows, h):
        for x in range(w):
            if px[x, y] >= ALPHA_SOLID:
                xs.append(x + 0.5)
    if not xs:
        return w / 2
    return sum(xs) / len(xs)


def extract_frames(sheet: Image.Image, cols: int, rows: int):
    # まず塊の位置で各コマを切り出す。数や並びが合わない時だけ、等分グリッドで切る
    grid = order_in_grid(find_blobs(sheet, cols * rows), cols, rows)
    if grid is None:
        print(f"  塊の数・並びが {cols}x{rows} と合わないので、等分グリッドで切ります")
    cw, ch = sheet.width // cols, sheet.height // rows
    frames = []
    for r in range(rows):
        for c in range(cols):
            if grid:
                x0, y0, x1, y1, _ = grid[r][c]
                m = 4
                box = (max(0, x0 - m), max(0, y0 - m), min(sheet.width, x1 + m), min(sheet.height, y1 + m))
            else:
                box = (c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)
            cell = keep_main_blobs(sheet.crop(box))
            bbox = cell.getchannel("A").point(lambda v: 255 if v >= ALPHA_SOLID else 0).getbbox()
            if not bbox:
                sys.exit(f"マス (列{c + 1}, 行{r + 1}) にキャラが見つかりません。シートの並び（横{cols}×縦{rows}）を確認してください")
            crop = cell.crop(bbox)
            frames.append({"col": c, "row": r, "img": crop, "foot_x": foot_center_x(crop)})
    return frames


def leg_region_top(mask: np.ndarray) -> int:
    """脚の部分が始まる行（スカート・パーカーの裾の下）。見つからなければ -1。

    胴の幅（高さ45〜65%の行の幅の中央値）の75%より細くなった最初の行を、脚の始まりとみなす。
    （「脚が2本に分かれる行」で探すと、靴下がくっついている絵や、体から離れた手に惑わされる）
    """
    h = mask.shape[0]
    widths = np.zeros(h)
    for y in range(h):
        xs = np.nonzero(mask[y])[0]
        if len(xs):
            widths[y] = xs.max() - xs.min() + 1
    torso = np.median(widths[int(h * 0.45):int(h * 0.65)])
    for y in range(int(h * 0.6), h - 2):
        if 0 < widths[y] < torso * 0.75:
            return y
    return -1


def mirror_legs(img: Image.Image) -> Image.Image:
    """脚の部分だけを体の中心線で左右反転したコマを作る（上半身はそのまま）。

    生成AIの背中向き（上向き）の歩行コマは、コマA・Bとも同じ足を上げていることが多く、
    交互に歩いて見えない。背中から見た脚は左右対称なので、Aの脚だけを反転すれば
    「逆の足を上げたコマ」になる。カバンやスマホは上半身にあるので左右が入れ替わらない。
    """
    arr = np.array(img)
    mask = arr[:, :, 3] >= ALPHA_SOLID
    h, w = mask.shape
    y0 = leg_region_top(mask)
    if y0 < 0:
        return img
    # 中心線: 脚の始まりのすぐ下（腰まわり）の行で、いちばん長い連続部分（＝体。離れた手は除く）の真ん中
    xs = np.nonzero(mask[min(h - 1, y0 + 2)])[0]
    runs = np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1)
    body = max(runs, key=len)
    axis2 = int(body.min() + body.max())  # 中心線×2（0.5px単位）
    # 反転するのは脚の塊だけ。裾の線より下に少しかかった手などはその場に残す
    region = arr[y0:]
    labels, n = ndimage.label(mask[y0:])
    if n == 0:
        return img
    sizes = ndimage.sum(mask[y0:], labels, index=range(1, n + 1))
    legs = labels == (int(np.argmax(sizes)) + 1)
    merged = np.where(legs[..., None], 0, region)
    for x in range(w):
        src = axis2 - x
        if 0 <= src < w:
            col = legs[:, src]
            merged[col, x] = region[col, src]
    out = arr.copy()
    out[y0:] = merged
    return Image.fromarray(out, "RGBA")


def apply_mirror_step(frames, dirs_to_fix):
    """指定した向きのコマBを「コマAの脚だけ左右反転」に置き換える。"""
    for name in dirs_to_fix:
        if name not in DIRS:
            sys.exit(f"--mirror-step: 向き {name} はありません（{', '.join(DIRS)}）")
        col = DIRS.index(name)
        a = next((f for f in frames if f["col"] == col and f["row"] == 0), None)
        b = next((f for f in frames if f["col"] == col and f["row"] == 1), None)
        if not a or not b:
            continue
        img = mirror_legs(a["img"])
        b["img"] = img
        b["foot_x"] = foot_center_x(img)
        print(f"  {name}: コマBをコマAの脚の左右反転で作りました")


def add_outline(img: Image.Image, color=OUTLINE_COLOR) -> Image.Image:
    """不透明部分の外側1ドットに輪郭を足す（縮小で元絵の黒い輪郭がぼやけ、歩道の上で埋もれるため）。"""
    arr = np.array(img)
    solid = arr[:, :, 3] >= ALPHA_SOLID
    ring = ndimage.binary_dilation(solid, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]]) & ~solid
    arr[ring] = color
    return Image.fromarray(arr, "RGBA")


def build_sheet(frames, cols: int, rows: int, height: int, colors: int, per_frame_fit: bool = False, outline: bool = True):
    cw, ch = cell_size(height)
    anchor = (cw // 2, ch - 2)          # 足元の基準点（セル内座標）。足の最下段がこの行に来る
    tallest = max(f["img"].height for f in frames)
    out = Image.new("RGBA", (cw * cols, ch * rows), (0, 0, 0, 0))
    warnings = []
    for f in frames:
        src = f["img"]
        # 既定は全コマ共通の縮小率（脚を上げたコマが少し低い、などの差を残す）。
        # --per-frame-fit は生成AIがコマごとに大きさをブラした時の救済で、全コマを同じ高さにする
        scale = height / (src.height if per_frame_fit else tallest)
        w = max(1, round(src.width * scale))
        h = max(1, round(src.height * scale))
        small = src.resize((w, h), Image.LANCZOS)  # Pillow は RGBA を乗算済みで縮小する＝縁が黒ずまない
        fx = round(f["foot_x"] * scale)
        left = anchor[0] - fx
        top = anchor[1] + 1 - h
        if left < 0 or top < 0 or left + w > cw:
            warnings.append(f"{DIRS[f['col']]}/{FRAMES[f['row']]}: セルからはみ出したので切れています（{w}x{h}）")
        layer = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        layer.paste(small, (left, top), small)
        out.alpha_composite(layer, (f["col"] * cw, f["row"] * ch))

    # シート全体を一度に減色＝全コマでパレット共通
    alpha = out.getchannel("A").point(lambda v: 255 if v >= ALPHA_SOLID else 0)
    rgb = out.convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT).convert("RGB")
    final = rgb.convert("RGBA")
    final.putalpha(alpha)
    if outline:
        final = add_outline(final)
    meta = {
        "cell": [cw, ch],
        "cols": cols,
        "rows": rows,
        "dirs": DIRS[:cols],
        "frames": FRAMES[:rows],
        "anchor": list(anchor),
        "charHeight": height,
        "mirror": {"down_left": "down_right", "left": "right", "up_left": "up_right"},
    }
    return final, meta, warnings


def write_preview(sheets, path: Path, zoom: int = 4):
    """全サイズを市松模様の上に4倍で並べた確認用画像。"""
    pad = 16
    width = max(s.width for s in sheets) * zoom + pad * 2
    height = sum(s.height * zoom + pad for s in sheets) + pad
    canvas = Image.new("RGBA", (width, height), (29, 24, 36, 255))
    y = pad
    for s in sheets:
        big = s.resize((s.width * zoom, s.height * zoom), Image.NEAREST)
        checker = Image.new("RGBA", big.size)
        cp = checker.load()
        for yy in range(big.height):
            for xx in range(big.width):
                on = ((xx // (4 * zoom)) + (yy // (4 * zoom))) % 2
                cp[xx, yy] = (59, 51, 70, 255) if on else (70, 61, 83, 255)
        checker.alpha_composite(big)
        canvas.alpha_composite(checker, (pad, y))
        y += big.height + pad
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", nargs="?", default=str(DEFAULT_INPUT), help="生成AIの歩行シート（マゼンタ背景）")
    ap.add_argument("--name", default="tsumugi_walk", help="出力ファイル名の頭")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT))
    ap.add_argument("--sizes", default="32,48", help="キャラの高さ(px)。カンマ区切り")
    ap.add_argument("--cols", type=int, default=5)
    ap.add_argument("--rows", type=int, default=2)
    ap.add_argument("--colors", type=int, default=48)
    ap.add_argument("--key", default="auto", help="auto / #RRGGBB（既定は四隅から自動検出）")
    ap.add_argument("--core", type=int, default=KEY_CORE, help="背景とみなす背景色からの距離（色むらが残るなら上げる）")
    ap.add_argument("--per-frame-fit", action="store_true", help="全コマを同じ高さに揃える（生成AIの大きさブレ対策）")
    ap.add_argument("--no-outline", action="store_true", help="外周1ドットの輪郭を足さない")
    ap.add_argument("--mirror-step", default="up",
                    help="コマBを『コマAの脚だけ左右反転』で作り直す向き（カンマ区切り。既定 up＝背中向き。"
                         "生成AIの背中向きはA・Bとも同じ足を上げがちなため）。空文字で無効")
    ap.add_argument("--no-preview", action="store_true")
    ap.add_argument("--preview", default=str(PREVIEW_PATH), help="確認用プレビューの出力先")
    args = ap.parse_args()

    src_path = Path(args.input)
    if not src_path.exists():
        sys.exit(f"入力が見つかりません: {src_path}")
    src = Image.open(src_path).convert("RGBA")
    key = detect_key_color(src) if args.key == "auto" else parse_color(args.key)
    print(f"クロマキー: 背景色 {key} / {src.width}x{src.height}")
    keyed = key_background(src, key, core=args.core)

    frames = extract_frames(keyed, args.cols, args.rows)
    apply_mirror_step(frames, [d.strip() for d in args.mirror_step.split(",") if d.strip()])
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    built = []
    for height in [int(v) for v in args.sizes.split(",") if v.strip()]:
        sheet, meta, warnings = build_sheet(frames, args.cols, args.rows, height, args.colors, args.per_frame_fit, not args.no_outline)
        png = out_dir / f"{args.name}_{height}.png"
        sheet.save(png)
        (out_dir / f"{args.name}_{height}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {png} ({sheet.width}x{sheet.height}, セル{meta['cell'][0]}x{meta['cell'][1]})")
        for w in warnings:
            print(f"  WARN {w}")
        built.append(sheet)
    if not args.no_preview and built:
        write_preview(built, Path(args.preview))
        print(f"wrote {args.preview}（確認用）")


if __name__ == "__main__":
    main()
