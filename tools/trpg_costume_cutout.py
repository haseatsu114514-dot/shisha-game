#!/usr/bin/env python3
"""TRPGの役衣装の絵の、生成りの台紙を透過にする。

役衣装の絵は、平らな一色の台紙の上に全身が描かれて届く。台紙ごと出すと、判定のカットインや台詞の立ち姿が
「証明写真の札」に見える（TRF19・オーナー 2026-11-12）。台紙を抜いて人物だけにし、札として見せたい所
（行動宣言・キャラ作成・表紙・キャラクターシート）は CSS で台紙の色を敷く。

  台紙つきの原画: asset_sources/trpg-costumes/backing/<シナリオ>/<絵>.webp   （ここが元。消さない）
  ゲームで使う絵: remake/img/ui/trpg/costumes/<シナリオ>/<絵>.webp           （この道具が書き出す）
  抜くすき間の点: tools/trpg_costume_cutout_gaps.json                         （人が絵を見て決める）

  python3 tools/trpg_costume_cutout.py                      # まだ透過版が無い絵だけ作る
  python3 tools/trpg_costume_cutout.py --all                # 全部作り直す
  python3 tools/trpg_costume_cutout.py leaf-mail/hiyori_yura.webp   # 指定した絵だけ作り直す
  python3 tools/trpg_costume_cutout.py --check              # 書き込まず、原画・透過版・すき間の点の食い違いを一覧
  python3 tools/trpg_costume_cutout.py --survey DIR [絵…]   # 抜き残しの候補を拡大して DIR に並べる（座標つき）
  python3 tools/trpg_costume_cutout.py --preview DIR [絵…]  # 暗い背景に載せた確認用の絵を DIR に出す

抜き方（TRF22・オーナー 2026-11-13「切り抜きは雑にしない。髪の毛や隙間がまだ抜けていない」）:
  1. 縁からつながる台紙を抜く（人物の線で止まる）。
  2. 線に囲まれて縁から届かないすき間（髪の房の間・腕と体の間・脚の間・弓や竪琴の弦の間）は、色だけでは
     生成りの服・肌・小物と区別できない。gaps.json に人が書いた点から、その色のかたまりだけを抜く。
       gaps = 台紙〜「紙の影」の色のすき間 / rims = 線と線の間の細い筋（髪の縁）/ wide = 黄みの強い生成りのすき間
     点は --survey の候補を1つずつ見て決める。服や肌の上、判断がつかない所は書かない（抜かない）。
  3. 抜いた所に接する「線のまわりのにじみ」を2画素まで台紙に含め、取り残された明るい粒を消す。
  4. 縁の1画素は、台紙と線の混ざり具合を透明度にして、色を線の色に置き換える（生成りの縁取りを残さない）。
  5. 透明な所の色は、近くの人物の色をにじませておく（圧縮で台紙の色が縁へ戻らない）。

絵の寸法と人物の位置は変えない（顔の位置の測定値 frames.json はそのまま使える）。
新しい役衣装の絵を足す手順は asset_sources/trpg-costumes/README.md。必要なもの: Pillow と numpy。
"""
import argparse
import glob
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
SOURCES = os.path.join(ROOT, "asset_sources", "trpg-costumes", "backing")
TARGETS = os.path.join(ROOT, "remake", "img", "ui", "trpg", "costumes")
GAPS = os.path.join(ROOT, "tools", "trpg_costume_cutout_gaps.json")

FILL_TOLERANCE = 14      # 縁からつながる台紙とみなす色の差（RGBの差の合計）
# 線に囲まれたすき間の色: 台紙そのものか、少し暗く塗られた「紙の影」。台紙から影の色へ向かう直線の近くだけを拾う
SHADE = np.array([7.0, 20.0, 35.0]) / np.linalg.norm([7.0, 20.0, 35.0])
GAP_RANGE = (-4.0, 62.0)     # 直線に沿った位置（0=台紙、約41=測った紙の影）
GAP_SPREAD = 9.0             # 直線からの離れ
# 抜いた所に接する「線のまわりのにじみ」（少し暗い画素と明るい画素が線の外側に並ぶ）は、色の幅を広げて2画素まで拾う
HALO_RANGE = (-10.0, 75.0)
HALO_SPREAD = 16.0
HALO_STEPS = 2
SPECK_SIZE = 40              # 抜いた所に取り残された明るい粒（人物の太い所につながらない小さなかたまり）
SPECK_CORE = 7               # 「太い所」= この画素数の四角が入る所
SPECK_CONTRAST = 150         # 粒とみなすのは、台紙からこれ以上離れた色（線・髪の先）を含まないものだけ
RIM_REACH = 6                # 細い筋を探すのは、抜いた所からこの画素数まで
# 黄みの強い生成りで塗られたすき間（髪の房の間に多い）。肌の色に近いので、人が決めた点（wide）だけに使う
WIDE_RANGE = (-15.0, 80.0)
WIDE_SPREAD = 28.0
LINE_STRENGTH = 60.0         # 縁の画素を半透明にするのは、隣にこれだけ台紙から遠い色（線）がある時だけ
BLEED_STEPS = 6
PREVIEW_COLOUR = (27, 36, 48)


def has_backing(image):
    """四隅が不透明なら、まだ台紙がある。"""
    if image.mode != "RGBA":
        return True
    w, h = image.size
    return all(image.getpixel(xy)[3] > 0 for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)])


def spread_within(seed, mask):
    """seed から mask の中をつながっている所まで広げる（上下左右の塗りつぶし）。行と列の「連なり」単位で交互に広げる。"""
    def runs(m):
        change = np.ones(m.shape, bool)
        change[:, 1:] = m[:, 1:] != m[:, :-1]
        return np.cumsum(change.ravel()).reshape(m.shape) - 1

    rows, columns = runs(mask), runs(mask.T).T
    reached = seed & mask
    while True:
        before = int(reached.sum())
        for ids in (rows, columns):
            hit = np.zeros(int(ids.max()) + 1, bool)
            hit[ids[reached]] = True
            reached = hit[ids] & mask
        if int(reached.sum()) == before:
            return reached


def grow(mask, size):
    """mask を size 画素の四角で太らせる。"""
    return np.asarray(Image.fromarray(np.where(mask, 255, 0).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(size))) == 255


def shifted(array, dy, dx, fill):
    """array を (dy, dx) だけずらす（はみ出た所は fill）。"""
    out = np.full_like(array, fill)
    h, w = array.shape[:2]
    out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = array[max(0, -dy):h + min(0, -dy), max(0, -dx):w + min(0, -dx)]
    return out


NEIGHBOURS = [(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]


def backing_of(pixels):
    border = np.concatenate([pixels[0, :], pixels[-1, :], pixels[:, 0], pixels[:, -1]])
    backing = np.median(border, axis=0)
    spread = np.abs(border - backing).max()
    if spread > FILL_TOLERANCE:
        raise ValueError(f"台紙が一色ではありません（縁の色の幅 {int(spread)}）。手で確かめてください")
    return backing


def shrink(mask, size):
    """mask を size 画素の四角で痩せさせる。"""
    return np.asarray(Image.fromarray(np.where(mask, 255, 0).astype(np.uint8), "L").filter(ImageFilter.MinFilter(size))) == 255


def layers(pixels):
    """(台紙の色, 台紙からの差, 縁からつながる台紙, すき間の色の画素, にじみの色の画素, 黄みの強いすき間の色の画素) を返す。"""
    backing = backing_of(pixels)
    difference = np.abs(pixels - backing).sum(axis=2)
    edge = np.zeros(difference.shape, bool)
    edge[0, :] = edge[-1, :] = edge[:, 0] = edge[:, -1] = True
    outside = spread_within(edge, difference <= FILL_TOLERANCE)
    away = backing - pixels
    along = (away * SHADE).sum(axis=2)
    off = np.sqrt(np.maximum((away ** 2).sum(axis=2) - along ** 2, 0))
    paper = (along >= GAP_RANGE[0]) & (along <= GAP_RANGE[1]) & (off <= GAP_SPREAD) & ~outside
    halo = (along >= HALO_RANGE[0]) & (along <= HALO_RANGE[1]) & (off <= HALO_SPREAD)
    wide = (along >= WIDE_RANGE[0]) & (along <= WIDE_RANGE[1]) & (off <= WIDE_SPREAD)
    return backing, difference, outside, paper, halo, wide


def tidy(background, halo, difference):
    """抜いた所に接する「線のまわりのにじみ」を台紙に含め、取り残された明るい粒を消す。"""
    for _ in range(HALO_STEPS):
        more = grow(background, 3) & ~background & halo
        if not more.any():
            break
        background |= more
    figure = ~background
    loose = figure & ~spread_within(shrink(figure, SPECK_CORE), figure)
    for ys, xs in regions_of(loose):
        if len(ys) <= SPECK_SIZE and difference[ys, xs].max() < SPECK_CONTRAST:
            background[ys, xs] = True
    return background


def rim_mask(background, halo):
    """線と線の間に残る、幅1〜2画素の台紙色の筋（抜いた所から RIM_REACH 画素以内）。"""
    cream = halo & ~background
    return cream & ~grow(shrink(cream, 3), 3) & grow(background, 2 * RIM_REACH + 1)


def stages(pixels, gaps=(), rims=(), wide=()):
    """人が決めた点までを抜き終えた (台紙の色, 台紙, にじみの色の画素, 黄みの強いすき間の色の画素, 台紙からの差, すき間ごとの画素数) を返す。"""
    h, w, _ = pixels.shape
    backing, difference, outside, paper, halo, wide_tone = layers(pixels)
    background = outside.copy()
    sizes = []

    def flood(points, tone, label):
        for x, y in points:
            if not (0 <= x < w and 0 <= y < h) or not tone[y, x]:
                raise ValueError(f"{label}の点 ({x}, {y}) が台紙の色の上にありません（絵や前の点が変わったなら決め直してください）")
            if background[y, x]:
                raise ValueError(f"{label}の点 ({x}, {y}) は、別の点と同じ所です")
            start = np.zeros((h, w), bool)
            start[y, x] = True
            region = spread_within(start, tone & ~background)
            background[region] = True
            sizes.append(int(region.sum()))

    # 2) 線に囲まれたすき間
    flood(gaps, paper, "すき間")
    background = tidy(background, halo, difference)
    # 髪の縁などの「線と線の間の細い筋」
    if rims:
        thin = rim_mask(background, halo)
        wanted = set(rims)
        for x, y in rims:
            if not (0 <= x < w and 0 <= y < h) or not thin[y, x]:
                raise ValueError(f"筋の点 ({x}, {y}) が細い台紙色の筋の上にありません（絵や前の点が変わったなら決め直してください）")
        for ys, xs in regions_of(thin, diagonal=True):
            if wanted.intersection(zip(xs.tolist(), ys.tolist())):
                background[ys, xs] = True
        background = tidy(background, halo, difference)
    # 黄みの強い生成りで塗られたすき間
    if wide:
        flood(wide, wide_tone, "黄みのすき間")
        background = tidy(background, halo, difference)
    return backing, background, halo, wide_tone, difference, sizes


def cutout(image, gaps=(), rims=(), wide=()):
    """台紙つきの絵を透過にする。gaps・rims・wide は人が決めた点 [(x, y), …]（すき間・細い筋・黄みの強いすき間）。"""
    pixels = np.asarray(image.convert("RGB")).astype(np.float32)
    h, w, _ = pixels.shape
    # 1)〜3) 縁からつながる台紙、人が決めたすき間と筋、線のまわりのにじみと粒
    backing, background, _, _, _, sizes = stages(pixels, gaps, rims, wide)

    # 4) 縁の1画素: となりの一番濃い色（線）と台紙の間のどこにあるかを透明度にし、色は線の色にする
    figure = ~background
    distance = np.where(figure, np.sqrt(((pixels - backing) ** 2).sum(axis=2)), 0.0)
    strongest, line = distance.copy(), pixels.copy()
    for dy, dx in NEIGHBOURS:
        near_distance, near_pixels = shifted(distance, dy, dx, 0.0), shifted(pixels, dy, dx, 0.0)
        better = near_distance > strongest
        strongest = np.where(better, near_distance, strongest)
        line = np.where(better[..., None], near_pixels, line)
    ring = figure & grow(background, 3) & (strongest > LINE_STRENGTH)
    span = line - backing
    share = np.clip(((pixels - backing) * span).sum(axis=2) / np.maximum((span ** 2).sum(axis=2), 1.0), 0.0, 1.0)
    alpha = np.where(figure, 255.0, 0.0)
    alpha[ring] = 255.0 * share[ring]
    colour = np.where(ring[..., None], line, pixels)

    # 5) 透明な所の色は、近くの人物の色をにじませる。遠い所は台紙の色のまま
    known = alpha > 0
    colour = np.where(known[..., None], colour, backing)
    for _ in range(BLEED_STEPS):
        total, count = np.zeros_like(colour), np.zeros((h, w), np.float32)
        for dy, dx in NEIGHBOURS:
            near_known = shifted(known, dy, dx, False)
            total += np.where(near_known[..., None], shifted(colour, dy, dx, 0.0), 0.0)
            count += near_known
        fresh = ~known & (count > 0)
        colour[fresh] = total[fresh] / count[fresh][:, None]
        known |= fresh

    result = Image.fromarray(np.dstack([np.clip(colour, 0, 255), alpha[..., None]]).round().astype(np.uint8), "RGBA")
    return result, {"backing": tuple(int(v) for v in backing), "figure": round(float((alpha > 0).mean()), 3), "points": len(gaps) + len(rims) + len(wide), "removed": sum(sizes)}


def regions_of(mask, diagonal=False):
    """mask のかたまり（上下左右でつながる画素。diagonal なら斜めも）を [(ys, xs), …] で返す。"""
    steps = NEIGHBOURS if diagonal else [(-1, 0), (1, 0), (0, -1), (0, 1)]
    h, w = mask.shape
    todo = mask.copy()
    found = []
    for y0, x0 in zip(*(axis.tolist() for axis in np.nonzero(todo))):
        if not todo[y0, x0]:
            continue
        stack, ys, xs = [(y0, x0)], [], []
        todo[y0, x0] = False
        while stack:
            y, x = stack.pop()
            ys.append(y)
            xs.append(x)
            for dy, dx in steps:
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and todo[ny, nx]:
                    todo[ny, nx] = False
                    stack.append((ny, nx))
        found.append((np.array(ys), np.array(xs)))
    return found


def survey(image, gaps=(), rims=(), wide=(), smallest=6):
    """まだ抜いていない候補を返す（人が見て、抜くかを決める）。
    gap = 線か抜いた所に囲まれた台紙色のかたまり、rim = 線と線の間の細い台紙色の筋、
    wide = 黄みの強い生成りのかたまり（肌でない色で、線に囲まれ、輪郭の近くにあるもの）。"""
    pixels = np.asarray(image.convert("RGB")).astype(np.float32)
    h, w, _ = pixels.shape
    _, _, _, paper, _, _ = layers(pixels)
    _, background, halo, wide_tone, difference, _ = stages(pixels, gaps, rims, wide)
    dark = (difference > 150) & ~background
    near = grow(background, 29)
    found = []

    def judge(kind, ys, xs, reach, least_dark, most_open):
        y0, y1, x0, x1 = max(0, ys.min() - reach), min(h, ys.max() + reach + 1), max(0, xs.min() - reach), min(w, xs.max() + reach + 1)
        inside = np.zeros((y1 - y0, x1 - x0), bool)
        inside[ys - y0, xs - x0] = True
        around = grow(inside, 2 * reach + 1) & ~inside
        lines = (around & dark[y0:y1, x0:x1]).sum() / around.sum()
        opened = (around & background[y0:y1, x0:x1]).sum() / around.sum()
        if lines < least_dark or opened > most_open or lines + opened < 0.75:
            return      # 服の明るい所など、線や抜いた所に囲まれていない
        centre = int(np.argmin((xs - xs.mean()) ** 2 + (ys - ys.mean()) ** 2))
        found.append({"kind": kind, "x": int(xs[centre]), "y": int(ys[centre]), "area": len(ys), "ys": ys, "xs": xs})

    taken = np.zeros((h, w), bool)
    for ys, xs in regions_of(paper & ~background):
        if len(ys) >= smallest:
            before = len(found)
            judge("gap", ys, xs, 2, 0.25, 1.0)
            if len(found) > before:
                taken[ys, xs] = True
    for ys, xs in regions_of(rim_mask(background, halo), diagonal=True):
        if len(ys) >= smallest:
            judge("rim", ys, xs, 1, 0.55, 0.3)
    for ys, xs in regions_of(wide_tone & ~background):
        colour = np.median(pixels[ys, xs], axis=0)
        if 20 <= len(ys) <= 4000 and colour[0] - colour[1] <= 32 and near[ys, xs].any() and not taken[ys, xs].any():
            judge("wide", ys, xs, 2, 0.5, 1.0)
    return sorted(found, key=lambda item: (item["y"], item["x"]))


def survey_sheet(image, found, half=55, scale=3, columns=6):
    """候補を1つずつ拡大して並べる（紫の線が候補の輪郭。札の文字は種類と、gaps.json に書く [x, y] と画素数）。"""
    tile = 2 * half * scale
    rows = (len(found) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * tile, rows * (tile + 18)), (20, 20, 20))
    draw = ImageDraw.Draw(sheet)
    rgb = image.convert("RGB")
    for index, item in enumerate(found):
        x0 = max(0, min(rgb.size[0] - 2 * half, item["x"] - half))
        y0 = max(0, min(rgb.size[1] - 2 * half, item["y"] - half))
        mask = np.zeros((2 * half, 2 * half), np.uint8)
        ys, xs = item["ys"] - y0, item["xs"] - x0
        ok = (ys >= 0) & (ys < 2 * half) & (xs >= 0) & (xs < 2 * half)
        mask[ys[ok], xs[ok]] = 255
        big = Image.fromarray(mask, "L").resize((tile, tile), Image.NEAREST)
        outline = np.asarray(big) > np.asarray(big.filter(ImageFilter.MinFilter(3)))
        crop = np.asarray(rgb.crop((x0, y0, x0 + 2 * half, y0 + 2 * half)).resize((tile, tile), Image.NEAREST)).copy()
        crop[outline] = (255, 0, 255)
        left, top = (index % columns) * tile, (index // columns) * (tile + 18)
        sheet.paste(Image.fromarray(crop), (left, top + 18))
        draw.text((left + 3, top + 3), f"{item['kind']} [{item['x']}, {item['y']}]  {item['area']}px", fill=(255, 255, 120))
    return sheet


def preview(result):
    """暗い背景に載せる（抜き残しの生成りが目立つ）。"""
    base = Image.new("RGBA", result.size, PREVIEW_COLOUR + (255,))
    return Image.alpha_composite(base, result).convert("RGB")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("files", nargs="*", help="作り直す絵（<シナリオ>/<絵>.webp。省略すると、まだ透過版が無い絵）")
    parser.add_argument("--all", action="store_true", help="全部作り直す")
    parser.add_argument("--check", action="store_true", help="書き込まず、原画・透過版・すき間の点の食い違いを一覧")
    parser.add_argument("--survey", metavar="DIR", help="抜き残しの候補を拡大して DIR に並べる")
    parser.add_argument("--preview", metavar="DIR", help="暗い背景に載せた確認用の絵を DIR に出す")
    parser.add_argument("--out", metavar="DIR", help="ゲームの絵を上書きせず DIR に書き出す（試し用）")
    args = parser.parse_args()

    with open(GAPS, encoding="utf-8") as handle:
        marked = json.load(handle)
    gaps, rims, wide = marked["gaps"], marked["rims"], marked["wide"]
    sources = sorted(os.path.relpath(path, SOURCES).replace(os.sep, "/") for path in glob.glob(os.path.join(SOURCES, "*", "*.webp")))
    problems = [f"すき間・筋の点はあるが原画が無い: {name}" for name in sorted(set(gaps) | set(rims) | set(wide)) if name not in sources]

    def needs(name):
        target = os.path.join(TARGETS, name)
        if not os.path.exists(target):
            return "透過版が無い"
        with Image.open(target) as opened:
            return "台紙が残っている" if has_backing(opened) else ""

    if args.check:
        problems += [f"{needs(name)}: {name}" for name in sources if needs(name)]
        targets = sorted(os.path.relpath(path, TARGETS).replace(os.sep, "/") for path in glob.glob(os.path.join(TARGETS, "*", "*.webp")))
        problems += [f"透過版はあるが原画が無い: {name}" for name in targets if name not in sources]
        for line in problems:
            print(line)
        count = lambda marks: sum(len(points) for points in marks.values())
        print(f"原画 {len(sources)} 枚・点 すき間 {count(gaps)} / 筋 {count(rims)} / 黄みのすき間 {count(wide)} か所。食い違い {len(problems)} 件")
        return 1 if problems else 0

    names = [name.replace(os.sep, "/") for name in args.files] or [name for name in sources if args.all or args.survey or needs(name)]
    missing = [name for name in names if name not in sources]
    if missing:
        print("原画がありません:", ", ".join(missing))
        return 1
    failed = 0
    for name in names:
        with Image.open(os.path.join(SOURCES, name)) as opened:
            image = opened.copy()
        points = [[tuple(point) for point in marks.get(name, [])] for marks in (gaps, rims, wide)]
        flat = name.replace("/", "__")[:-5]
        try:
            if args.survey:
                os.makedirs(args.survey, exist_ok=True)
                found = survey(image, *points)
                if found:
                    survey_sheet(image, found).save(os.path.join(args.survey, flat + ".png"))
                print(f"{name}: 候補 {len(found)} か所  " + " ".join(f"{item['kind']}[{item['x']},{item['y']}]" for item in found))
                continue
            result, info = cutout(image, *points)
        except ValueError as error:
            failed += 1
            print(f"NG   {name}: {error}")
            continue
        target = os.path.join(args.out or TARGETS, name)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        result.save(target, "WEBP", quality=90, alpha_quality=100, method=6, exact=True)
        if args.preview:
            os.makedirs(args.preview, exist_ok=True)
            preview(result).save(os.path.join(args.preview, flat + ".png"))
        print(f"OK   {name}  人物 {info['figure']:.0%}  人が決めた点 {info['points']} か所（すき間 {info['removed']}px）")
    for line in problems:
        print(line)
    print(f"{len(names) - failed} 枚を処理しました（失敗 {failed} 枚）")
    return 1 if failed or problems else 0


if __name__ == "__main__":
    sys.exit(main())
