#!/usr/bin/env python3
"""既存の立ち絵・顔アイコン・characters.json から、キャラのリファレンスシートPNGを作る。

新規の画像生成はしない。ゲーム内素材（assets/）を切り出して並べるだけなので、
立ち絵を差し替えたら再実行すれば最新の見た目に追従する。

使い方: python3 tools/make_reference_sheet.py minto
出力:   asset_sources/reference-sheets/<id>/<id>-reference-sheet.png
"""
import json
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

# キャラごとの設定: 衣装ごとの表情ファイルと頭部の切り出し範囲(元画像座標)
CONFIGS = {
    "minto": {
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
    },
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


def build(cid, body_h=1000):
    cfg = CONFIGS[cid]
    chars = json.loads((ROOT / "data/characters.json").read_text(encoding="utf-8"))
    entry = next(c for c in chars if c["id"] == cid)
    accent = cfg["accent"]

    W = 2400
    margin = 48
    outfits = cfg["outfits"]

    # 全身は元画像の不透明範囲で切り抜いて同じ高さに揃える
    bodies = []
    for o in outfits:
        im = Image.open(SPRITE / cid / f"{o['prefix']}normal.png").convert("RGBA")
        bodies.append((im.crop(im.getchannel("A").getbbox()), im))

    expr_cell = 400
    expr_label_h = 40

    # 先に高さを見積もる（本文の折り返し行数は幅固定なので概算で十分）
    H = 1000 + 2 * (expr_cell + expr_label_h + 90) + 700
    sheet = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(sheet)

    f_title, f_sub, f_h, f_b, f_s = font(64), font(28), font(30), font(24), font(20)

    # ヘッダー
    d.rectangle([0, 0, W, 8], fill=accent)
    d.text((margin, 36), cfg["title"], font=f_title, fill=TEXT)
    tw = d.textlength(cfg["title"], font=f_title)
    d.text((margin + tw + 24, 62), cfg["subtitle"], font=f_sub, fill=SUB)
    d.text((W - margin, 62), f"CHARACTER REFERENCE SHEET  /  id: {cid}", font=f_s, fill=SUB, anchor="ra")
    d.line([margin, 118, W - margin, 118], fill=LINE, width=2)

    y = 140
    # 全身（衣装ごと）
    col_w = 520
    for i, (o, (body, _)) in enumerate(zip(outfits, bodies)):
        x0 = margin + i * (col_w + 24)
        d.rounded_rectangle([x0, y, x0 + col_w, y + body_h + 56], 12, fill=PANEL, outline=LINE)
        d.text((x0 + 18, y + 12), o["label"], font=f_h, fill=accent)
        paste_fit(sheet, body, (x0 + 12, y + 56, x0 + col_w - 12, y + body_h + 44))

    # 右側: 顔アイコン・パレット・プロフィール
    rx = margin + 2 * (col_w + 24) + 12
    rw = W - margin - rx
    ry = y
    d.rounded_rectangle([rx, ry, rx + rw, ry + body_h + 56], 12, fill=PANEL, outline=LINE)
    cx, cy = rx + 24, ry + 16

    # 顔アイコン
    d.text((cx, cy), "顔アップ（現行立ち絵・通常）", font=f_h, fill=accent)
    cy += 46
    # 顔アップは160pxの丸アイコンを使わず、現行の通常立ち絵から原寸で切り出す
    fx = cx
    for o in outfits:
        spr = Image.open(SPRITE / cid / f"{o['prefix']}normal.png").convert("RGBA").crop(o["face"])
        spr = spr.resize((300, 300), Image.LANCZOS)
        sheet.paste(checker((300, 300)), (fx, cy))
        sheet.paste(spr, (fx, cy), spr)
        d.text((fx, cy + 306), o["label"].split("（")[0], font=f_s, fill=SUB)
        fx += 300 + 24
    d.text((fx, cy + 8), "ゲーム内の160pxアイコンは\n立ち絵から自動で縮小したもの。\nこのシートでは立ち絵から\n原寸で顔を切り出している", font=f_s, fill=SUB)

    # パレット（営業・私服）: 立ち絵から実測した代表色
    py = cy + 300 + 56
    d.text((cx, py), "基調色（立ち絵から実測した代表色）", font=f_h, fill=accent)
    py += 46
    for o in outfits:
        d.text((cx, py), o["label"].split("（")[0], font=f_b, fill=SUB)
        py += 32
        sx = cx
        for name, hx in o["palette"]:
            rgb = tuple(int(hx[i:i + 2], 16) for i in (1, 3, 5))
            d.rectangle([sx, py, sx + 132, py + 48], fill=rgb, outline=LINE)
            d.text((sx, py + 54), name, font=f_s, fill=TEXT)
            d.text((sx, py + 78), hx, font=font(16), fill=SUB)
            sx += 150
        py += 118
    cy = py + 4

    # プロフィール
    d.line([cx, cy, rx + rw - 24, cy], fill=LINE)
    cy += 16
    d.text((cx, cy), "プロフィール（data/characters.json）", font=f_h, fill=accent)
    cy += 46
    inner = rw - 48
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
        lines = wrap(d, p, f_b, inner - 28)
        d.ellipse([cx + 2, cy + 12, cx + 10, cy + 20], fill=accent)
        for ln in lines:
            d.text((cx + 26, cy), ln, font=f_b, fill=TEXT)
            cy += 32
        cy += 6
    # 右パネルが溢れるときは全身パネルごと高くして描き直す
    need = cy + 24 - (ry + 56)
    if need > body_h:
        return build(cid, need)

    y = ry + body_h + 56 + 28

    # 表情差分（営業・私服）
    for o in outfits:
        d.text((margin, y), f"表情差分 — {o['label']}", font=f_h, fill=accent)
        y += 44
        n = len(o["faces"])
        gap = 18
        cell_w = (W - 2 * margin - gap * (n - 1)) // n
        cell_h = expr_cell
        hx0, hy0, hx1, hy1 = o["head"]
        for i, fn in enumerate(o["faces"]):
            x0 = margin + i * (cell_w + gap)
            d.rounded_rectangle([x0, y, x0 + cell_w, y + cell_h + expr_label_h], 10, fill=PANEL, outline=LINE)
            spr = Image.open(SPRITE / cid / f"{o['prefix']}{fn}.png").convert("RGBA").crop(o["head"])
            paste_fit(sheet, spr, (x0 + 8, y + 8, x0 + cell_w - 8, y + cell_h - 4))
            d.text((x0 + cell_w // 2, y + cell_h + 4), fn, font=f_b, fill=TEXT, anchor="ma")
        y += cell_h + expr_label_h + 30

    # 注記
    d.line([margin, y, W - margin, y], fill=LINE, width=2)
    y += 18
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
        "出典: assets/sprites/characters/%s/*.png ・ data/characters.json（自動生成。新規画像の生成なし）"
        % (cid,),
        font=f_s,
        fill=SUB,
    )
    y += 50

    sheet = sheet.crop((0, 0, W, y))
    out_dir = ROOT / "asset_sources/reference-sheets" / cid
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{cid}-reference-sheet.png"
    sheet.save(out, optimize=True)
    print(out, sheet.size)
    return out


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "minto")
