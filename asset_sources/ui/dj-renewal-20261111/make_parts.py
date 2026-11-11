#!/usr/bin/env python3
"""DJ ミニゲームのリニューアル（2026-11-11・DJS20〜）の部品を描いて remake/img/ui/dj/ に書き出す。

画像生成 API が使えなかった（クレジット切れ）ので、機材まわりの部品はこのスクリプトが Pillow と numpy で描く
（3倍で描いて縮小。乱数は固定なので何度実行しても同じ絵になる）。人物の絵（フロアの観客）は描けないので Codex へ依頼する
（同じフォルダの CODEX_PROMPTS.md）。

  python3 asset_sources/ui/dj-renewal-20261111/make_parts.py

| 出力 | 大きさ | 使う場所（remake/previews/dj/style.css） |
|---|---|---|
| play-a / play-b / play-go.webp | 256×256 | ▶ボタン（A 紫・B 水色・「いま押す」金） |
| xfader-plate.webp | 920×240 | 横フェーダーの台座（溝・目盛り・左右のランプ） |
| pitch-plate.webp | 136×340 | PITCH フェーダーの台座 |
| arrow.webp | 256×256 | 「ここを動かす／押す」の矢印（右向き。CSS で回す） |
| chevron.webp | 120×160 | 横フェーダーの向きの矢印（右向き） |
| bubble.webp / bubble-cold.webp | 560×216 | お客さんの声の吹き出し（良い反応／冷めた反応） |
| flame.webp | 96×96 | 曲のノリ（盛り上がり）の炎 |
| zone.webp / zone-ok.webp | 224×136 | 横フェーダーの「ここ」の目印（追いかける先／乗れているとき） |
| deck-strip.webp | 640×200 | デッキの下の台座（曲名と BPM の表示窓・▶ の受け皿。右デッキは左右反転） |
| floor-room.webp | 1600×533 | フロアの奥: 誰もいない店内（raw/floor-room.png・Codex） |
| floor-pov-1〜4.webp | 1600×436 | フロアの手前: シルエットの客の4段階から切り出した観客の帯（raw/floor-sil-1〜4.png・Codex。上はぼかして透明、下に暗い余白） |
| heat-frame.webp | 597×160 | フロアの熱のゲージの枠（craft-night の温度計の枠を横向きにしたもの） |
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "remake" / "img" / "ui" / "dj"
KIT = ROOT / "remake" / "img" / "ui" / "craft-night"
SS = 3  # 3倍で描いて縮小する
rng = np.random.default_rng(20261111)

VIOLET, VIOLET_HI = (180, 92, 240), (226, 204, 255)
CYAN, CYAN_HI = (63, 208, 232), (206, 246, 255)
GOLD, GOLD_HI, GOLD_LO = (255, 200, 87), (255, 244, 204), (214, 134, 30)
PLUM = (42, 24, 64)


def rgba(size, color=(0, 0, 0, 0)):
    return Image.new("RGBA", size, color)


def solid(mask, color):
    """mask（L）の形を color で塗った RGBA。"""
    img = rgba(mask.size, (*color[:3], 0))
    img.putalpha(mask if len(color) < 4 else mask.point(lambda v: v * color[3] // 255))
    return img


def blur(img, radius):
    return img.filter(ImageFilter.GaussianBlur(radius))


def over(base, top, offset=(0, 0)):
    layer = rgba(base.size)
    layer.paste(top, offset)
    return Image.alpha_composite(base, layer)


def add(base, top):
    """加算合成（光）。"""
    b, t = np.asarray(base).astype(np.float32), np.asarray(top).astype(np.float32)
    a = t[..., 3:4] / 255
    rgb = np.clip(b[..., :3] + t[..., :3] * a, 0, 255)
    alpha = np.clip(b[..., 3:4] + t[..., 3:4], 0, 255)
    return Image.fromarray(np.concatenate([rgb, alpha], -1).astype(np.uint8), "RGBA")


def glow(mask, color, radius, strength=1.0):
    g = blur(mask, radius).point(lambda v: min(255, int(v * strength)))
    return solid(g, color)


def vgrad(size, stops):
    """縦のグラデーション。stops = [(位置0..1, (r,g,b)), ...]"""
    w, h = size
    ys = np.linspace(0, 1, h)
    pos = [p for p, _ in stops]
    chans = [np.interp(ys, pos, [c[i] for _, c in stops]) for i in range(3)]
    arr = np.stack([np.repeat(c[:, None], w, 1) for c in chans], -1)
    return Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")


def clip(img, mask):
    out = img.copy()
    out.putalpha(ImageChops.multiply(img.getchannel("A"), mask))
    return out


def noise(size, amount, streak=None):
    """細かい粒（streak を渡すと、その向きに流れたヘアライン）。中央が 128 の L 画像。"""
    w, h = size
    if streak == "x":
        arr = rng.normal(0, 1, (h, max(2, w // 60)))
        img = Image.fromarray(np.clip(128 + arr * amount, 0, 255).astype(np.uint8), "L").resize((w, h), Image.BILINEAR)
    elif streak == "y":
        arr = rng.normal(0, 1, (max(2, h // 60), w))
        img = Image.fromarray(np.clip(128 + arr * amount, 0, 255).astype(np.uint8), "L").resize((w, h), Image.BILINEAR)
    else:
        arr = rng.normal(0, 1, (h, w))
        img = Image.fromarray(np.clip(128 + arr * amount, 0, 255).astype(np.uint8), "L")
    return img


def grain(img, n):
    """RGBA に粒を乗せる（128 を中心に明暗）。"""
    a = np.asarray(img).astype(np.float32)
    a[..., :3] = np.clip(a[..., :3] + (np.asarray(n).astype(np.float32)[..., None] - 128), 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def save(img, name, size):
    img = img.resize(size, Image.LANCZOS)
    arr = np.asarray(img).copy()
    arr[arr[..., 3] == 0, :3] = 0  # 透明画素の色を黒にそろえる（縮小時のにじみ防止）
    out = OUT / f"{name}.webp"
    Image.fromarray(arr, "RGBA").save(out, "WEBP", quality=92, method=6)
    print(f"{out.relative_to(ROOT)} {size[0]}x{size[1]} {out.stat().st_size}B")


def circle_mask(size, center, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).ellipse([center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius], fill=255)
    return m


def rr_mask(size, box, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius, fill=255)
    return m


def poly_mask(size, points):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon(points, fill=255)
    return m


def metal_ring(size, center, r_out, r_in):
    """削り出しの金属の輪（角度で明暗が回る）。"""
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    ang = np.arctan2(yy - center[1], xx - center[0])
    light = .5 + .5 * np.cos(2 * (ang + np.pi * .28))
    rad = np.hypot(xx - center[0], yy - center[1])
    bevel = np.clip(1 - np.abs((rad - (r_out + r_in) / 2) / ((r_out - r_in) / 2)), 0, 1) ** .6
    v = 34 + light * 120 * (.45 + .55 * bevel)
    arr = np.stack([v * .96, v * .93, v * 1.06, np.full_like(v, 255)], -1)
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    ring = ImageChops.subtract(circle_mask(size, center, r_out), circle_mask(size, center, r_in))
    return clip(img, ring)


def play_pad(name, color, hi):
    """▶ボタン: 金属の輪・LED の輪・ゴムの面・光る再生の三角。"""
    S = 256 * SS
    c = (S / 2, S / 2)
    img = rgba((S, S))
    # 台座の受け皿（deck-strip.webp）に収まるボタン。外へ漏れる光は弱く、LED の輪は細く色つき（白く飛ばさない）
    img = add(img, glow(circle_mask((S, S), c, S * .44), color, S * .022, .22))
    img = Image.alpha_composite(img, metal_ring((S, S), c, S * .47, S * .40))
    led = ImageChops.subtract(circle_mask((S, S), c, S * .402), circle_mask((S, S), c, S * .372))
    img = Image.alpha_composite(img, solid(led, tuple(int(v * .78) for v in color)))
    core = ImageChops.subtract(circle_mask((S, S), c, S * .392), circle_mask((S, S), c, S * .382))
    img = add(img, glow(core, hi, S * .006, .55))
    disc = circle_mask((S, S), c, S * .372)
    face = vgrad((S, S), [(0, (58, 52, 76)), (.45, (30, 26, 42)), (1, (12, 10, 20))])
    face = grain(face, noise((S, S), 5))
    img = Image.alpha_composite(img, clip(face, disc))
    shine = Image.new("L", (S, S), 0)  # 面の上側の柔らかい照り
    ImageDraw.Draw(shine).ellipse([S * .22, S * .14, S * .78, S * .5], fill=70)
    img = add(img, clip(solid(blur(shine, S * .05), (255, 255, 255)), disc))
    inner = ImageChops.subtract(disc, circle_mask((S, S), c, S * .358))  # 面のふちの暗い溝
    img = Image.alpha_composite(img, solid(inner, (0, 0, 0, 150)))
    tri = poly_mask((S, S), [(S * .425, S * .345), (S * .425, S * .655), (S * .69, S * .5)])
    tri = blur(tri, S * .008).point(lambda v: 255 if v > 110 else 0)  # 角を少し丸める
    tri = blur(tri, SS * .8)
    img = add(img, glow(tri, color, S * .03, .9))
    img = Image.alpha_composite(img, clip(vgrad((S, S), [(.3, hi), (.5, tuple((a + b) // 2 for a, b in zip(hi, color))), (.7, color)]), tri))
    save(img, name, (256, 256))


def screw(img, center, r):
    S = img.size
    img = Image.alpha_composite(img, solid(circle_mask(S, (center[0], center[1] + r * .25), r * 1.15), (0, 0, 0, 120)))
    img = Image.alpha_composite(img, clip(vgrad(S, [(0, (150, 146, 168)), (1, (40, 36, 54))]), circle_mask(S, center, r)))
    slot = Image.new("L", S, 0)
    ImageDraw.Draw(slot).line([center[0] - r * .62, center[1] - r * .62, center[0] + r * .62, center[1] + r * .62], fill=255, width=max(2, int(r * .28)))
    return Image.alpha_composite(img, solid(slot, (14, 12, 22, 220)))


def plate(size, radius, streak):
    """ヘアラインの入った暗い金属の板（面取り・上の照り・下の影）。"""
    w, h = size
    m = rr_mask(size, [SS * 2, SS * 2, w - SS * 2, h - SS * 3], radius)
    img = rgba(size)
    img = over(img, blur(solid(rr_mask(size, [SS * 2, SS * 4, w - SS * 2, h - SS], radius), (0, 0, 0, 170)), SS * 2.2))
    face = vgrad(size, [(0, (74, 68, 92)), (.08, (52, 47, 68)), (.5, (38, 34, 52)), (.94, (26, 23, 38)), (1, (14, 12, 22))])
    face = grain(face, noise(size, 16, streak))
    face = grain(face, noise(size, 3))
    img = Image.alpha_composite(img, clip(face, m))
    edge = ImageChops.subtract(m, rr_mask(size, [SS * 3.4, SS * 3.4, w - SS * 3.4, h - SS * 4.4], radius - SS * 1.4))
    img = Image.alpha_composite(img, clip(vgrad(size, [(0, (190, 182, 214)), (.5, (90, 84, 112)), (1, (10, 8, 16))]), edge))
    return img, m


def groove(img, box, radius):
    """溝: 黒い穴・上の内側の影・下のふちの照り。"""
    S = img.size
    hole = rr_mask(S, box, radius)
    lip = rr_mask(S, [box[0] - SS * 1.6, box[1] - SS * 1.6, box[2] + SS * 1.6, box[3] + SS * 1.6], radius + SS * 1.6)
    img = Image.alpha_composite(img, clip(vgrad(S, [(0, (8, 6, 14)), (1, (150, 142, 178))]), ImageChops.subtract(lip, hole)))
    img = Image.alpha_composite(img, solid(hole, (4, 3, 8)))
    inner = ImageChops.multiply(hole, ImageChops.invert(blur(ImageChops.offset(hole, 0, int(SS * 2.5)), SS * 1.5)))
    return Image.alpha_composite(img, solid(inner, (0, 0, 0, 255)))


def lamp(img, center, r, color, hi):
    S = img.size
    img = add(img, glow(circle_mask(S, center, r * 1.5), color, r * 1.1, .9))
    img = Image.alpha_composite(img, solid(circle_mask(S, center, r * 1.25), (16, 13, 24)))
    img = Image.alpha_composite(img, solid(circle_mask(S, center, r), color))
    return Image.alpha_composite(img, solid(blur(circle_mask(S, (center[0] - r * .25, center[1] - r * .3), r * .42), r * .2), hi))


def xfader_plate():
    """横フェーダーの台座: 長い溝、下に目盛り（中央は長く白い）、左右に A（紫）・B（水色）のランプ、四隅にねじ。"""
    W, H = 920 * SS, 240 * SS
    img, m = plate((W, H), H * .13, "x")
    y = H * .44
    x0, x1 = W * .085, W * .915
    img = groove(img, [x0, y - H * .045, x1, y + H * .045], H * .045)
    d = ImageDraw.Draw(img)
    for i in range(41):  # 目盛り（2.5%刻み、10%ごとに長く、中央はいちばん長く白い）
        x = x0 + (x1 - x0) * i / 40
        major, mid = i % 4 == 0, i == 20
        top, bottom = H * .64, H * (.82 if mid else .76 if major else .71)
        col = (255, 255, 255, 235) if mid else (206, 198, 232, 200) if major else (150, 142, 178, 130)
        d.line([x, top, x, bottom], fill=col, width=int(SS * (3 if mid else 2 if major else 1.4)))
    tri = poly_mask((W, H), [(W / 2 - H * .035, H * .2), (W / 2 + H * .035, H * .2), (W / 2, H * .27)])  # 中央の印
    img = Image.alpha_composite(img, solid(tri, (255, 255, 255, 220)))
    img = lamp(img, (W * .045, y), H * .034, VIOLET, VIOLET_HI)
    img = lamp(img, (W * .955, y), H * .034, CYAN, CYAN_HI)
    for cx, cy in [(W * .03, H * .16), (W * .97, H * .16), (W * .03, H * .82), (W * .97, H * .82)]:
        img = screw(img, (cx, cy), H * .032)
    save(img, "xfader-plate", (920, 240))


def pitch_plate():
    """PITCH フェーダーの台座: 縦の溝、横に目盛り（中央 0 は長く白い）。"""
    W, H = 136 * SS, 340 * SS
    img, m = plate((W, H), W * .16, "y")
    x = W * .5
    y0, y1 = H * .075, H * .925
    img = groove(img, [x - W * .07, y0, x + W * .07, y1], W * .07)
    d = ImageDraw.Draw(img)
    for i in range(17):
        y = y0 + (y1 - y0) * i / 16
        mid, major = i == 8, i % 4 == 0
        for side in (-1, 1):
            a, b = x + side * W * .16, x + side * W * (.4 if mid else .32 if major else .26)
            col = (255, 255, 255, 235) if mid else (206, 198, 232, 190) if major else (150, 142, 178, 120)
            d.line([a, y, b, y], fill=col, width=int(SS * (3 if mid else 2 if major else 1.4)))
    save(img, "pitch-plate", (136, 340))


def gold_shape(mask, size, pad):
    """金色の案内の形（矢印）: 外の光・濃い縁・金の面・上の照り。"""
    S = mask.size
    img = rgba(S)
    img = add(img, glow(mask, GOLD, pad * .55, .75))
    img = over(img, blur(solid(ImageChops.offset(mask, 0, int(pad * .12)), (0, 0, 0, 130)), pad * .12))
    outline = mask.filter(ImageFilter.MaxFilter(int(pad * .26) | 1))
    img = Image.alpha_composite(img, solid(blur(outline, SS * .6), PLUM))
    face = vgrad(S, [(.12, GOLD_HI), (.42, GOLD), (.9, GOLD_LO)])
    img = Image.alpha_composite(img, clip(face, blur(mask, SS * .6)))
    inner = ImageChops.subtract(mask, ImageChops.offset(mask, 0, int(pad * .1)))  # 上のふちの照り
    img = Image.alpha_composite(img, solid(blur(inner, SS * .8), (255, 252, 236, 210)))
    save(img, size[0], size[1])


def arrow():
    S = 256 * SS
    pts = [(.14, .36), (.5, .36), (.5, .16), (.9, .5), (.5, .84), (.5, .64), (.14, .64)]
    mask = poly_mask((S, S), [(x * S, y * S) for x, y in pts])
    mask = blur(mask, S * .018).point(lambda v: 255 if v > 118 else 0)  # 角を丸める
    gold_shape(mask, ("arrow", (256, 256)), S * .12)


def chevron():
    W, H = 120 * SS, 160 * SS
    pts = [(.2, .12), (.46, .12), (.84, .5), (.46, .88), (.2, .88), (.56, .5)]
    mask = poly_mask((W, H), [(x * W, y * H) for x, y in pts])
    mask = blur(mask, W * .03).point(lambda v: 255 if v > 118 else 0)
    gold_shape(mask, ("chevron", (120, 160)), W * .2)


def bubble(name, top, bottom, line):
    """お客さんの声の吹き出し: 角の丸い箱と下向きのしっぽ。中は空（文字はコードで重ねる）。"""
    W, H = 560 * SS, 216 * SS
    body = rr_mask((W, H), [W * .03, H * .07, W * .97, H * .74], H * .3)
    tail = poly_mask((W, H), [(W * .40, H * .7), (W * .52, H * .7), (W * .43, H * .95)])
    mask = ImageChops.lighter(body, tail)
    mask = blur(mask, SS * 2.2).point(lambda v: 255 if v > 124 else 0)
    img = rgba((W, H))
    img = over(img, blur(solid(ImageChops.offset(mask, 0, int(SS * 5)), (10, 4, 24, 150)), SS * 5))
    img = Image.alpha_composite(img, solid(blur(mask, SS * .7), line))
    inner = mask.filter(ImageFilter.MinFilter(int(SS * 7) | 1))
    face = grain(vgrad((W, H), [(.08, top), (.74, bottom)]), noise((W, H), 2.2))
    img = Image.alpha_composite(img, clip(face, blur(inner, SS * .7)))
    shine = ImageChops.subtract(inner, ImageChops.offset(inner, 0, int(SS * 5)))
    img = Image.alpha_composite(img, solid(blur(shine, SS), (255, 255, 255, 150)))
    save(img, name, (560, 216))


def flame():
    S = 96 * SS
    t = np.linspace(0, 1, 60)
    left = [(.5 - .34 * np.sin(np.pi * v) ** .8 * (1 - .35 * v), .93 - .82 * v) for v in t]
    right = [(.5 + .30 * np.sin(np.pi * v) ** .9 * (1 - .15 * v) + .06 * np.sin(np.pi * 2.2 * v) * (v > .45), .93 - .82 * v) for v in t][::-1]
    mask = poly_mask((S, S), [(x * S, y * S) for x, y in left + right])
    mask = blur(mask, S * .02).point(lambda v: 255 if v > 120 else 0)
    img = rgba((S, S))
    img = add(img, glow(mask, (255, 95, 168), S * .06, .7))
    img = Image.alpha_composite(img, solid(blur(mask.filter(ImageFilter.MaxFilter(int(S * .05) | 1)), SS * .6), PLUM))
    img = Image.alpha_composite(img, clip(vgrad((S, S), [(.15, (255, 95, 168)), (.6, (255, 140, 120)), (.95, GOLD)]), blur(mask, SS * .6)))
    core = poly_mask((S, S), [((.5 + (x - .5) * .5) * S, (.93 - (.93 - y) * .55) * S) for x, y in left + right])
    img = Image.alpha_composite(img, solid(blur(core, S * .03), (255, 236, 170, 235)))
    save(img, "flame", (96, 96))


def zone(name, color, hi):
    """横フェーダーの「ここ」の目印: 光る枠と中央の線。中は薄く光るだけなので、下のフェーダーのつまみが見える。"""
    W, H = 224 * SS, 136 * SS
    box = [W * .07, H * .12, W * .93, H * .88]
    outer = rr_mask((W, H), box, H * .16)
    inner = rr_mask((W, H), [box[0] + SS * 4, box[1] + SS * 4, box[2] - SS * 4, box[3] - SS * 4], H * .16 - SS * 4)
    ring = ImageChops.subtract(outer, inner)
    img = rgba((W, H))
    img = add(img, glow(ring, color, SS * 7, 1.1))
    img = Image.alpha_composite(img, solid(inner, (*color, 46)))
    img = Image.alpha_composite(img, solid(blur(ring, SS * .6), hi))
    line = rr_mask((W, H), [W / 2 - SS * 1.5, box[1] - SS * 5, W / 2 + SS * 1.5, box[3] + SS * 5], SS * 1.5)
    img = add(img, glow(line, color, SS * 4, 1.2))
    img = Image.alpha_composite(img, solid(blur(line, SS * .5), (255, 255, 255, 235)))
    save(img, name, (224, 136))


def deck_strip():
    """デッキの下の台座（左デッキ用。右は CSS で左右反転）: 左に曲名と BPM の表示窓、右に ▶ の受け皿（丸いくぼみ）。
    表示窓 = 幅 2.2〜68.8 %・高さ 11〜89 %、受け皿の中心 = 幅 84.4 %・高さ 50 %・直径 92px（表示 320×100 のとき）。"""
    W, H = 640 * SS, 200 * SS
    img, m = plate((W, H), H * .14, "x")
    # 表示窓: 暗いガラス、内側の影、下のふちの照り、うすい走査線
    box = [14 * SS, 22 * SS, 440 * SS, 178 * SS]
    img = groove(img, box, 12 * SS)
    glass = clip(vgrad((W, H), [(.1, (10, 8, 20)), (.5, (16, 12, 30)), (.9, (8, 6, 16))]), rr_mask((W, H), [box[0] + SS * 3, box[1] + SS * 3, box[2] - SS * 3, box[3] - SS * 3], 10 * SS))
    img = Image.alpha_composite(img, glass)
    lines = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(lines)
    for y in range(int(box[1]) + SS * 4, int(box[3]) - SS * 4, SS * 4):
        d.line([box[0] + SS * 5, y, box[2] - SS * 5, y], fill=16, width=SS)
    img = add(img, solid(lines, (150, 130, 220)))
    shine = poly_mask((W, H), [(box[0] + SS * 6, box[1] + SS * 4), (box[0] + (box[2] - box[0]) * .46, box[1] + SS * 4), (box[0] + (box[2] - box[0]) * .34, box[1] + SS * 60), (box[0] + SS * 6, box[1] + SS * 60)])
    img = add(img, clip(solid(blur(shine, SS * 10), (255, 255, 255, 22)), rr_mask((W, H), box, 12 * SS)))
    # ▶ の受け皿: ふちの輪（上が暗く下が明るい）と、暗いくぼみ
    c, r = (540 * SS, 100 * SS), 92 * SS
    lip = ImageChops.subtract(circle_mask((W, H), c, r + SS * 4), circle_mask((W, H), c, r))
    img = Image.alpha_composite(img, clip(vgrad((W, H), [(.05, (6, 5, 12)), (.95, (160, 152, 190))]), lip))
    img = Image.alpha_composite(img, solid(circle_mask((W, H), c, r), (9, 7, 16)))
    well = ImageChops.multiply(circle_mask((W, H), c, r), ImageChops.invert(blur(circle_mask((W, H), (c[0], c[1] + SS * 10), r - SS * 4), SS * 6)))
    img = Image.alpha_composite(img, solid(well, (0, 0, 0, 255)))
    for cx, cy in [(W * .012, H * .1), (W * .012, H * .9)]:
        img = screw(img, (cx + SS * 2, cy), H * .028)
    save(img, "deck-strip", (640, 200))


RAW = Path(__file__).resolve().parent / "raw"
# 観客の帯（DJS32）: 元の絵（2172×724）の行 BAND_TOP から下を使い、上 BAND_FADE 行をぼかして透明にする。
# 下には BAND_PAD 行の暗い余白を足す（拍で帯が上がったときに、絵の下端の外が見えないように）。
# style.css の .room・.band の位置はこの3つの数と合わせてある（絵の高さの 31% から下が画面に映る）。
BAND_TOP, BAND_FADE, BAND_PAD = 180, 52, 48


def floor_pov():
    """主人公（DJ）目線のフロアの2層（DJS28・DJS32）。元は Codex の5枚（raw/、Issue #3224）。
    奥 = floor-room.webp: 誰もいない店内（raw/floor-room.png）を幅 1600 に縮小。
    手前 = floor-pov-1〜4.webp: シルエットの客の4段階（raw/floor-sil-1〜4.png）から観客の帯を切り出したもの（透過）。
      絵の側で熱ごとに明るさ・照明を描き分けてあるので、色は変えない。"""
    room = Image.open(RAW / "floor-room.png").convert("RGB")
    rw, rh = 1600, round(room.height * 1600 / room.width)
    room = room.resize((rw, rh), Image.LANCZOS)
    path = OUT / "floor-room.webp"
    room.save(path, "WEBP", quality=86, method=6)
    print(f"{path.relative_to(ROOT)} {rw}x{rh} {path.stat().st_size}B")
    for level in (1, 2, 3, 4):
        src = Image.open(RAW / f"floor-sil-{level}.png").convert("RGB")
        w = src.width
        band = np.asarray(src.crop((0, BAND_TOP, w, src.height))).astype(np.float32)
        t = np.linspace(0, 1, BAND_PAD)[:, None, None] ** .7
        pad = band[-1:].repeat(BAND_PAD, 0) * (1 - t) + np.array([11, 8, 18], np.float32) * t  # 最後の行から床の暗さへ
        rgb = np.concatenate([band, pad], 0)
        ys = np.arange(rgb.shape[0])[:, None].repeat(w, 1)
        a = np.clip(ys / BAND_FADE, 0, 1)
        a = a * a * (3 - 2 * a)
        out = np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)
        img = Image.fromarray(out, "RGBA")
        bw, bh = 1600, round(img.height * 1600 / w)
        img = img.resize((bw, bh), Image.LANCZOS)
        arr = np.asarray(img).copy()
        arr[arr[..., 3] == 0, :3] = 0
        path = OUT / f"floor-pov-{level}.webp"
        Image.fromarray(arr, "RGBA").save(path, "WEBP", quality=86, method=6)
        print(f"{path.relative_to(ROOT)} {bw}x{bh} {path.stat().st_size}B")


def heat_frame():
    """フロアの熱のゲージの枠: ゲーム共通の夜のUIキット（craft-night）の温度計の枠を横向きにしたもの。透明な窓の位置は style.css の .heat-bar。"""
    src = Image.open(KIT / "thermo-frame.webp").convert("RGBA")
    out = src.rotate(-90, expand=True)
    arr = np.asarray(out).copy()
    arr[arr[..., 3] == 0, :3] = 0
    path = OUT / "heat-frame.webp"
    Image.fromarray(arr, "RGBA").save(path, "WEBP", quality=94, method=6)
    a = arr[..., 3]
    row, col = np.where(a[a.shape[0] // 2] < 10)[0], np.where(a[:, a.shape[1] // 2] < 10)[0]
    print(f"{path.relative_to(ROOT)} {out.size[0]}x{out.size[1]} window x {row.min()}..{row.max()} y {col.min()}..{col.max()}")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    play_pad("play-a", VIOLET, VIOLET_HI)
    play_pad("play-b", CYAN, CYAN_HI)
    play_pad("play-go", GOLD, GOLD_HI)
    xfader_plate()
    pitch_plate()
    arrow()
    chevron()
    bubble("bubble", (255, 249, 236), (246, 230, 208), PLUM)
    bubble("bubble-cold", (226, 223, 240), (192, 188, 214), (43, 39, 64))
    flame()
    zone("zone", GOLD, GOLD_HI)
    zone("zone-ok", (150, 240, 200), (226, 255, 242))
    deck_strip()
    floor_pov()
    heat_frame()
