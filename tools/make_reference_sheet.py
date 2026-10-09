#!/usr/bin/env python3
"""既存の立ち絵・characters.json から、キャラのリファレンスシートPNGを作る。

新規の画像生成はしない。ゲーム内素材（assets/sprites/characters/）を切り出して並べるだけなので、
立ち絵を差し替えたら再実行すれば最新の見た目に追従する。
顔・表情の切り出しは160pxの顔アイコンではなく、現行の立ち絵から原寸で行う。

使い方:
    python3 tools/make_reference_sheet.py minto      # 1キャラ
    python3 tools/make_reference_sheet.py            # 全キャラ
出力: asset_sources/reference-sheets/<id>/<id>-reference-sheet.png
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT_PATHS = [
    "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
    "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
]
SPRITE = ROOT / "assets/sprites/characters"

BG = (24, 27, 33)
PANEL = (36, 40, 48)
LINE = (70, 76, 88)
TEXT = (232, 235, 240)
SUB = (150, 158, 172)

FACE_ORDER = [
    "normal", "smile", "wink", "serious", "thinking", "surprise", "sad", "excited",
    "intense", "smug", "evil", "angry", "smoke", "bow", "sleep", "ventriloquism",
]

# キャラごとの手書き設定。
#   points : デザインの要点（立ち絵を見て書く）
#   notes  : 運用上のメモ
#   tune   : 顔アップ(face_f)・表情切り出し(head_f)の辺をコンテンツ高さに対する比で指定。dx/dy は補正
#   whole  : True なら全身（マスコットなど）を顔アップ・表情にそのまま使う
CHARS = {
    "adam": {
        "points": [
            "左半分が緑・右半分が赤の短髪（ダブルアップルを思わせる二色）。眉が濃くきりっとした顔",
            "黒いヘンリーネックの七分袖シャツ、黒の腰エプロン、黒のスラックスと黒の革靴",
            "背が高く腕のしっかりした体格。職人らしい落ち着いた立ち姿",
        ],
    },
    "ageha": {
        "points": [
            "明るいオレンジ寄りの金髪ツインテール。クマ風の小さな髪飾りと黒のチョーカー",
            "ヒョウ柄のジャケットにピンクのクロップトップ、黒のプリーツミニスカート",
            "ガーター付きの黒ニーハイとピンクの厚底スニーカー。派手でノリの良いギャルの印象",
        ],
    },
    "dr_kemuri": {
        "points": [
            "乱れた茶髪に黒縁の四角い眼鏡",
            "白シャツに汚れ（茶・緑の染み）のある白衣、ベージュのチノパン",
            "素足に黒のサンダル。胸ポケットにペン、手首に時計とブレスレット",
        ],
        "notes": ["古い設定文の水色シャツ・ネクタイは使わない（現行の立ち絵が正）。邪悪表情は眼鏡が光って目が見えない"],
    },
    "hajime": {
        "points": [
            "黒髪に黒いキャップ（刺繍入り）。全身ほぼ黒でそろえた普段着",
            "黒のフード付きジャケット、黒のTシャツ（ペンダント）、黒のカーゴパンツ、黒の靴",
            "本編の会話では立ち絵を出さない（一人称視点）。冒頭の紹介など限られた場面だけ使用",
        ],
    },
    "kafuka": {
        "points": [
            "黒髪に濃い青のインナーカラー。青い瞳、笑うとギザ歯が見える",
            "サメのフード付きの黒×水色のジャケット、黒いスカートとガーター、黒タイツ、厚底スニーカー",
            "王冠をつけたサメのぬいぐるみ「コロちゃん」を抱える。通常と腹話術で小物の扱いが変わる",
        ],
        "notes": ["採用デザインは黒髪＋濃い青インナー。以前の銀髪や全身青の案へは戻さない"],
        "tune": {"face_f": 0.26, "head_f": 0.40, "dx": 0.0, "dy": 0.04},
    },
    "maezono": {
        "points": [
            "丸眼鏡に黒髪の短髪。ふくよかで人のよい体型",
            "紺のブレザーに水色のシャツ、ベージュのチノパン、茶色の革靴。胸ポケットにペン",
            "穏やかに手を振るポーズが基本（口癖は「シーシャはおいしいねえ」）",
        ],
    },
    "mashiro": {
        "points": [
            "淡い黄緑がかった髪の長い三つ編み2本と、そろった前髪。眠たげな目",
            "ベージュのケーブル編みカーディガンに白いブラウス、セージグリーンのロングスカート",
            "茶色のローファー。全体におっとりした落ち着いた色合い",
        ],
        "notes": ["表情に「sleep」（眠り）がある"],
    },
    "naru": {
        "points": [
            "短い銀髪、ピアスとネックレス。日焼けした肌で、涼しげな目元",
            "黒×白の切り替えのスポーツジャケット、黒のインナー、黒のカーゴパンツにチェーン",
            "白いスニーカー。ストリート寄りの装いだが人当たりは誠実（人格者の好敵手）",
        ],
    },
    "nagumo": {
        "points": [
            "黒髪を後ろへなでつけたオールバック。鋭い目つきと引き締まった表情",
            "黒の三つ揃いスーツに黒のネクタイ、胸ポケットのチーフ、腕時計、黒の革靴",
            "直立に近い堂々とした立ち姿。審査員長らしい威圧感",
        ],
    },
    "pakki": {
        "whole": True,
        "points": [
            "雲・泡のようなもこもこの白い体。黒い丸い目、ほんのりピンクの頬、大きく開けた赤い口",
            "赤い蝶ネクタイ。金色の口金のついた紺色のホースを片手で持つ",
            "人物ではなくマスコット。他キャラの頭身は当てはめない（全身を顔アップ・表情に使用）",
        ],
    },
    "rin": {
        "points": [
            "青みがかった暗い長髪。年上らしい落ち着いた半目と控えめな微笑み",
            "襟元をゆるめた白シャツに黒のスラックス、ヒール。片手に書類やノートを持つ",
            "ほかの女性キャラより大人びたシルエット。立ち絵の横幅は広め",
        ],
        "tune": {"face_f": 0.25, "head_f": 0.36, "dx": 0.0, "dy": 0.0},
    },
    "sumi": {
        "points": [
            "黒のハンチング、黒縁の眼鏡、無精ひげ。ベテランらしい渋い顔つき",
            "黒のシャツ（袖まくり）に茶色のロングエプロン、黒のスラックスと革靴",
            "両手を腰やポケットに入れた落ち着いた立ち姿",
        ],
    },
    "tsumugi": {
        "points": [
            "茶色のボブに、そろった前髪。赤みのある瞳でおとなしい表情",
            "紫の花柄刺繍入りパーカーでタブレットを抱える。黒のプリーツスカート",
            "黒のニーソックスと黒い靴。全体に小柄（spriteScaleは0.88）",
        ],
        "notes": ["専用の表情に「bow」（会釈）と「evil」（病み可愛い）がある"],
    },
}

# 調整済みの手書きシート（営業姿／私服の二衣装）
MINTO = {
    "title": "みんと",
    "subtitle": "緑川 栞 / Midorikawa Shiori",
    "accent": (127, 224, 194),
    "outfits": [
        {
            "label": "営業姿（ぺぱーみんと）",
            "prefix": "chr_minto_",
            "faces": ["normal", "smile", "wink", "surprise", "sad"],
            "face": (385, 238, 635, 488),
            "head": (335, 225, 685, 575),
            "palette": [
                ("髪", "#211F23"), ("瞳", "#62A35F"), ("肌", "#EDBB9B"),
                ("ドレス", "#2F2D31"), ("リボン", "#C6F0A9"), ("フリル", "#B8E79B"),
            ],
        },
        {
            "label": "私服・素の姿（栞 / お姉さん）",
            "prefix": "chr_minto_ura_",
            "faces": ["normal", "smile", "smug", "surprise", "sad"],
            "face": (395, 228, 645, 478),
            "head": (345, 215, 695, 565),
            "palette": [
                ("髪", "#252427"), ("瞳", "#88B96A"), ("肌", "#E4AD92"),
                ("カーディガン", "#D3C5BD"), ("スカート", "#25282A"), ("チャーム", "#81BD9D"),
            ],
        },
    ],
    "profile": [
        ("年齢", "自称20歳（公式の隠し設定では29歳）"),
        ("所属", "コンカフェ「ぺぱーみんと」オーナー兼唯一のキャスト"),
        ("プレイスタイル", "客商売（魅せ方）の極意"),
        ("得意フレーバー", "清涼感特化のミントミックス"),
        ("成長の軸", "魅力 / 洞察"),
        ("LIME", "みんと＠ぺぱーみんと（私用は「栞」）"),
    ],
    "points": [
        "営業姿：黒の長髪・ぱっつん前髪・緑の瞳。小さな角とコウモリ羽の髪飾り、ハート付きチョーカー",
        "営業姿：黒ワンピースに明るい緑のリボンとフリル、ガーター付き黒ニーハイ、緑縁の厚底メリージェーン",
        "私服：同じ黒髪・緑の瞳。生成りのケーブルカーディガン、黒インナー、ダークグレーのロングスカート",
        "私服：黒のショルダーバッグにハート型ミントのチャーム、緑のピアスとネックレス。派手さを消した静かな印象",
        "どちらも緑がアクセント色。髪色・目の色・輪郭は共通で、同一人物と分かること",
        "営業の場では必ず営業姿。私服は私的な約束・tonariでの「お姉さん」のとき（本名は聞いた後だけ）",
    ],
    "notes": [
        "characters.json の visual_concepts は旧案（ミントグリーンのツインテール）。現行の立ち絵は黒髪＋緑の瞳なので、このシートは現行立ち絵を優先した",
        "spriteScale 0.91。表示は一人称視点の会話カットイン・LIME・チェキなど",
    ],
}


def font(size):
    for p in FONT_PATHS:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def wrap(draw, text, fnt, width):
    lines, cur = [], ""
    for ch in text:
        if draw.textlength(cur + ch, font=fnt) > width and cur:
            lines.append(cur)
            cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def checker(size, cell=16):
    w, h = size
    im = Image.new("RGB", size, (44, 48, 56))
    d = ImageDraw.Draw(im)
    for y in range(0, h, cell):
        for x in range(0, w, cell):
            if (x // cell + y // cell) % 2:
                d.rectangle([x, y, x + cell - 1, y + cell - 1], fill=(52, 57, 66))
    return im


def paste_fit(canvas, img, box, bg=True):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    if bg:
        canvas.paste(checker((w, h)), (x0, y0))
    scale = min(w / img.width, h / img.height)
    im = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    canvas.paste(im, (x0 + (w - im.width) // 2, y0 + (h - im.height) // 2), im)


def auto_palette(img, n=6):
    """不透明部分の代表色。面積の大きい色だけだと肌と黒で埋まるので、
    すでに選んだ色から遠い色を、面積の平方根で重みづけして順に選ぶ。"""
    small = img.convert("RGBA").resize((img.width // 4, img.height // 4), Image.NEAREST)
    getter = getattr(small, "get_flattened_data", small.getdata)
    px = [p[:3] for p in getter() if p[3] > 250]
    q = Image.new("RGB", (len(px), 1))
    q.putdata(px)
    q = q.quantize(colors=32, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[: 32 * 3]
    total = len(px)
    cand = [(cnt, tuple(pal[i * 3: i * 3 + 3])) for cnt, i in q.getcolors() if cnt > total * 0.0006]
    cand.sort(reverse=True)
    out = [cand[0][1]]
    while len(out) < min(n, len(cand)):
        best = max(
            (c for c in cand if c[1] not in out),
            key=lambda c: math.sqrt(c[0]) * min(sum((a - b) ** 2 for a, b in zip(c[1], o)) ** 0.5 for o in out),
        )
        out.append(best[1])
    return ["#%02X%02X%02X" % c for c in out]


def load_characters():
    chars = {c["id"]: c for c in json.loads((ROOT / "data/characters.json").read_text(encoding="utf-8"))}
    k = ROOT / "data/dialogue/kafuka.json"
    if k.exists():
        prof = json.loads(k.read_text(encoding="utf-8")).get("profile")
        if prof:
            chars[prof["id"]] = prof
    return chars


def hex_rgb(hx):
    return tuple(int(hx[i:i + 2], 16) for i in (1, 3, 5))


def faces_in(cid):
    names = [p.name[len(f"chr_{cid}_"):-4] for p in (SPRITE / cid).glob(f"chr_{cid}_*.png")]
    order = {n: i for i, n in enumerate(FACE_ORDER)}
    return sorted(names, key=lambda n: (order.get(n, 99), n))


def auto_crops(cid, tune, whole):
    """通常立ち絵の不透明範囲から、顔アップと表情用の切り出し枠を決める。"""
    im = Image.open(SPRITE / cid / f"chr_{cid}_normal.png").convert("RGBA")
    a = im.getchannel("A")
    x0, y0, x1, y1 = a.getbbox()
    ch = y1 - y0
    if whole:
        side = max(x1 - x0, ch)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        box = (round(cx - side / 2), round(cy - side / 2), round(cx + side / 2), round(cy + side / 2))
        return box, box
    sl = a.crop((x0, y0, x1, y0 + int(ch * 0.14)))
    xs = [x for x in range(sl.width) for y in range(0, sl.height, 3) if sl.getpixel((x, y)) > 128]
    cx = x0 + (sum(xs) / len(xs) if xs else (x1 - x0) / 2) + tune.get("dx", 0) * ch

    def box(f, top_off):
        side = ch * f
        top = y0 + ch * top_off + tune.get("dy", 0) * ch
        return (round(cx - side / 2), round(top), round(cx + side / 2), round(top + side))

    return box(tune.get("face_f", 0.25), -0.005), box(tune.get("head_f", 0.36), -0.015)


def head_axis_body(im, whole=False, dx=0.0):
    """全身を、頭の中心軸が枠の中央に来るように切り出す。
    不透明範囲の中心で揃えると、白衣の裾・ぬいぐるみ・ヒレなど片側に広がる部分で
    顔の位置が中央からずれるため、顔アップと同じ頭の重心を軸に左右対称の余白で切る。"""
    a = im.getchannel("A")
    x0, y0, x1, y1 = a.getbbox()
    ch = y1 - y0
    if whole:
        cx = (x0 + x1) / 2
    else:
        sl = a.crop((x0, y0, x1, y0 + int(ch * 0.14)))
        xs = [x for x in range(sl.width) for y in range(0, sl.height, 3) if sl.getpixel((x, y)) > 128]
        cx = x0 + (sum(xs) / len(xs) if xs else (x1 - x0) / 2) + dx * ch
    half = max(cx - x0, x1 - cx)
    return im.crop((round(cx - half), y0, round(cx + half), y1))


def make_cfg(cid, chars):
    if cid == "minto":
        return MINTO
    entry = chars[cid]
    spec = CHARS[cid]
    tune = spec.get("tune", {})
    face_box, head_box = auto_crops(cid, tune, spec.get("whole", False))
    full = Image.open(SPRITE / cid / f"chr_{cid}_normal.png").convert("RGBA")
    nm = entry.get("display_name") or entry["name"]
    title = nm.split(" / ", 1)[0]
    full_name = entry.get("full_name") or (nm.split(" / ", 1)[1] if " / " in nm else "")
    sub = (full_name + "  " if full_name and full_name != title else "") + f"id: {cid}"
    accent = hex_rgb((entry.get("intro_cutin") or {}).get("color", "#9bb0d0"))
    g = entry.get("growth_stats") or {}
    growth = " / ".join(x for x in (g.get("primary"), g.get("secondary")) if x and x != "N/A")
    age = entry.get("age")
    profile = [
        ("年齢", f"{age}歳" if str(age).isdigit() else age),
        ("所属", entry.get("affiliation")),
        ("プレイスタイル", entry.get("play_style")),
        ("得意フレーバー", entry.get("specialty_flavor")),
        ("成長の軸", growth),
        ("表示倍率", f"spriteScale {entry['spriteScale']}" if entry.get("spriteScale") else None),
    ]
    profile = [(k, v) for k, v in profile if v and str(v) not in ("N/A", "None")]
    outfit = {
        "label": "通常衣装",
        "prefix": f"chr_{cid}_",
        "faces": faces_in(cid),
        "face": face_box,
        "head": head_box,
        "palette": [("", hx) for hx in auto_palette(full)],
    }
    return {
        "title": title,
        "subtitle": sub,
        "accent": accent,
        "outfits": [outfit],
        "profile": profile,
        "points": spec["points"],
        "notes": spec.get("notes", []),
        "auto_palette": True,
    }


def build(cid, chars, body_h=1000):
    cfg = make_cfg(cid, chars)
    accent = cfg["accent"]
    W = 2400
    margin = 48
    outfits = cfg["outfits"]
    two = len(outfits) > 1

    bodies = []
    for o in outfits:
        im = Image.open(SPRITE / cid / f"{o['prefix']}normal.png").convert("RGBA")
        spec = CHARS.get(cid, {})
        bodies.append(head_axis_body(im, spec.get("whole", False), spec.get("tune", {}).get("dx", 0.0)))

    expr_cell, expr_label_h = 400, 40
    sheet = Image.new("RGB", (W, 6000), BG)
    d = ImageDraw.Draw(sheet)
    f_title, f_sub, f_h, f_b, f_s = font(64), font(28), font(30), font(24), font(20)

    d.rectangle([0, 0, W, 8], fill=accent)
    d.text((margin, 36), cfg["title"], font=f_title, fill=TEXT)
    tw = d.textlength(cfg["title"], font=f_title)
    d.text((margin + tw + 24, 62), cfg["subtitle"], font=f_sub, fill=SUB)
    d.text((W - margin, 62), "CHARACTER REFERENCE SHEET", font=f_s, fill=SUB, anchor="ra")
    d.line([margin, 118, W - margin, 118], fill=LINE, width=2)

    y = 140
    col_w = 520 if two else 760
    for i, (o, body) in enumerate(zip(outfits, bodies)):
        x0 = margin + i * (col_w + 24)
        d.rounded_rectangle([x0, y, x0 + col_w, y + body_h + 56], 12, fill=PANEL, outline=LINE)
        d.text((x0 + 18, y + 12), o["label"], font=f_h, fill=accent)
        paste_fit(sheet, body, (x0 + 12, y + 56, x0 + col_w - 12, y + body_h + 44))

    rx = margin + len(outfits) * (col_w + 24) + 12
    rw = W - margin - rx
    ry = y
    d.rounded_rectangle([rx, ry, rx + rw, ry + body_h + 56], 12, fill=PANEL, outline=LINE)
    cx, cy = rx + 24, ry + 16

    d.text((cx, cy), "顔アップ（現行立ち絵・通常）", font=f_h, fill=accent)
    cy += 46
    fx = cx
    for o in outfits:
        spr = Image.open(SPRITE / cid / f"{o['prefix']}normal.png").convert("RGBA").crop(o["face"])
        spr = spr.resize((300, 300), Image.LANCZOS)
        sheet.paste(checker((300, 300)), (fx, cy))
        sheet.paste(spr, (fx, cy), spr)
        if two:
            d.text((fx, cy + 306), o["label"].split("（")[0], font=f_s, fill=SUB)
        fx += 300 + 24
    cy += 300 + 56

    d.text((cx, cy), "基調色" + ("（立ち絵から自動抽出）" if cfg.get("auto_palette") else "（立ち絵から実測した代表色）"),
           font=f_h, fill=accent)
    cy += 46
    sw = 110 if cfg.get("auto_palette") else 132
    for o in outfits:
        if two:
            d.text((cx, cy), o["label"].split("（")[0], font=f_b, fill=SUB)
            cy += 32
        sx = cx
        named = bool(o["palette"][0][0])
        for name, hx in o["palette"]:
            d.rectangle([sx, cy, sx + sw, cy + 48], fill=hex_rgb(hx), outline=LINE)
            yy = cy + 54
            if name:
                d.text((sx, yy), name, font=f_s, fill=TEXT)
                yy += 24
            d.text((sx, yy), hx, font=font(16), fill=SUB)
            sx += sw + 18
        cy += 54 + (46 if named else 22) + 14
    cy += 4

    inner = rw - 48
    d.line([cx, cy, rx + rw - 24, cy], fill=LINE)
    cy += 16
    d.text((cx, cy), "プロフィール（data/characters.json）", font=f_h, fill=accent)
    cy += 46
    for k, v in cfg["profile"]:
        d.text((cx, cy), k, font=f_b, fill=SUB)
        for ln in wrap(d, v, f_b, inner - 200):
            d.text((cx + 200, cy), ln, font=f_b, fill=TEXT)
            cy += 32
        cy += 6
    cy += 8
    d.line([cx, cy, rx + rw - 24, cy], fill=LINE)
    cy += 16
    d.text((cx, cy), "デザインの要点", font=f_h, fill=accent)
    cy += 46
    for p in cfg["points"]:
        d.ellipse([cx + 2, cy + 12, cx + 10, cy + 20], fill=accent)
        for ln in wrap(d, p, f_b, inner - 28):
            d.text((cx + 26, cy), ln, font=f_b, fill=TEXT)
            cy += 32
        cy += 6

    # 右パネルが溢れるときは全身パネルごと高くして描き直す
    need = cy + 24 - (ry + 56)
    if need > body_h:
        return build(cid, chars, need)

    y = ry + body_h + 56 + 28
    for o in outfits:
        d.text((margin, y), f"表情差分 — {o['label']}" if two else "表情差分", font=f_h, fill=accent)
        y += 44
        n = len(o["faces"])
        cols = n if n <= 5 else math.ceil(n / 2)
        gap = 18
        cell_w = (W - 2 * margin - gap * (cols - 1)) // cols
        for i, fn in enumerate(o["faces"]):
            r, c = divmod(i, cols)
            x0 = margin + c * (cell_w + gap)
            yy = y + r * (expr_cell + expr_label_h + gap)
            d.rounded_rectangle([x0, yy, x0 + cell_w, yy + expr_cell + expr_label_h], 10, fill=PANEL, outline=LINE)
            spr = Image.open(SPRITE / cid / f"{o['prefix']}{fn}.png").convert("RGBA").crop(o["head"])
            paste_fit(sheet, spr, (x0 + 8, yy + 8, x0 + cell_w - 8, yy + expr_cell - 4))
            d.text((x0 + cell_w // 2, yy + expr_cell + 4), fn, font=f_b, fill=TEXT, anchor="ma")
        rows = math.ceil(n / cols)
        y += rows * (expr_cell + expr_label_h + gap) + 12

    d.line([margin, y, W - margin, y], fill=LINE, width=2)
    y += 18
    if cfg["notes"]:
        d.text((margin, y), "メモ", font=f_h, fill=accent)
        y += 44
        for nline in cfg["notes"]:
            for ln in wrap(d, nline, f_b, W - 2 * margin - 28):
                d.text((margin + 24, y), ln, font=f_b, fill=SUB)
                y += 32
            y += 6
        y += 20
    d.text(
        (margin, y),
        f"出典: assets/sprites/characters/{cid}/*.png ・ data/characters.json（自動生成。新規画像の生成なし）",
        font=f_s,
        fill=SUB,
    )
    y += 50

    sheet = sheet.crop((0, 0, W, y))
    out_dir = ROOT / "asset_sources/reference-sheets" / cid
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{cid}-reference-sheet.png"
    sheet.save(out, optimize=True)
    print(out.relative_to(ROOT), sheet.size)
    return out


if __name__ == "__main__":
    chars = load_characters()
    targets = sys.argv[1:] or ["minto"] + list(CHARS)
    for t in targets:
        build(t, chars)
