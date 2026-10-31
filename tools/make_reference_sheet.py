#!/usr/bin/env python3
"""既存の立ち絵・characters.json から、キャラのリファレンスシートPNGを作る。

新規の画像生成はしない。ゲーム内素材（assets/sprites/characters/）を切り出して並べるだけなので、
立ち絵を差し替えたら再実行すれば最新の見た目に追従する。

- 顔アップと表情差分は、顔アイコン（tools/make_face_icons.py）と同じ切り抜き枠を基準にする。
  アイコンは TUNE で全キャラの顔の大きさを揃えてあるので、シートでも顔の大きさが揃う。
  ただし160pxへの縮小・減色はせず、立ち絵から原寸で切り出して拡大表示する。
- 全身は不透明部分の重心で左右中央に置く（白衣の裾・ぬいぐるみ等で片寄って見えないように）。
- 全身の高さは身長の設定（cm）に比例させた全シート共通の縮尺。設定の無いキャラはゲーム内の spriteScale で換算。

使い方:
    python3 tools/make_reference_sheet.py            # 全キャラ
    python3 tools/make_reference_sheet.py minto rin  # 指定キャラ
    python3 tools/make_reference_sheet.py lineup     # 背比べ図
    python3 tools/make_reference_sheet.py facesize   # ゲーム画面での顔の大きさの比較図
出力: asset_sources/reference-sheets/<id>/<id>-reference-sheet.png
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from make_face_icons import face_box  # noqa: E402

SPRITE = ROOT / "assets/sprites/characters"
OUT_ROOT = ROOT / "asset_sources/reference-sheets"

# ゲーム本編（登場紹介）と同じ Zen Kaku Gothic New。無ければIPAゴシックへ
FONT_FILES = {
    "black": ["remake/fonts/ZenKakuGothicNew-Black.woff2"],
    "bold": ["remake/fonts/ZenKakuGothicNew-Bold.woff2"],
    "medium": ["remake/fonts/ZenKakuGothicNew-Medium.woff2"],
}
FALLBACK_FONT = "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf"

BG = (20, 22, 28)
PANEL = (32, 36, 44)
PANEL_HI = (40, 45, 55)
LINE = (58, 64, 76)
TEXT = (236, 238, 242)
SUB = (146, 154, 168)
MUTED = (110, 117, 130)

W = 2400
M = 56          # 外周の余白
GAP = 28        # 列の間隔
FACE_PX = 230   # 表情差分で、顔アイコン枠1辺をこの大きさで表示（全キャラ共通の顔の大きさ）
FACEUP_PAD = 1.18  # 顔アップはアイコン枠より少しだけ引く（アイコンは円形用で端が詰まるため）

FACE_JA = {
    "normal": "通常", "smile": "笑顔", "wink": "ウインク", "serious": "真剣", "thinking": "思案",
    "surprise": "驚き", "sad": "悲しみ", "excited": "熱弁", "intense": "気迫", "smug": "含み笑い",
    "evil": "邪悪", "angry": "怒り", "smoke": "一服", "bow": "会釈", "sleep": "眠り",
    "ventriloquism": "腹話術",
}
FACE_ORDER = list(FACE_JA)

# キャラごとの手書き設定。
#   points : デザインの要点（立ち絵を見て書く）
#   notes  : 運用上のメモ
#   face_ja: 表情名の上書き（キャラ固有の呼び方）
CHARS = {
    "adam": {
        "points": [
            "本人の左が緑・右が赤の短髪（正面は画面左が赤・右が緑）。眉が濃くきりっとした顔",
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
    "samechan": {
        "points": [
            "黒髪に濃い青のインナーカラー。青い瞳、笑うとギザ歯が見える",
            "サメのフード付きの黒×水色のジャケット、黒いスカートとガーター、黒タイツ、厚底スニーカー",
            "王冠をつけたサメのぬいぐるみ「コロちゃん」を抱える。通常と腹話術で小物の扱いが変わる",
        ],
        "notes": ["採用デザインは黒髪＋濃い青インナー。以前の銀髪や全身青の案へは戻さない"],
    },
    "maezono": {
        "points": [
            "丸眼鏡に黒髪の短髪。ふくよかで人のよい体型",
            "紺のブレザーに水色のシャツ、ベージュのチノパン、茶色の革靴。胸ポケットにペン",
            "穏やかに手を振るポーズが基本（口癖は「シーシャはおいしいねえ」）",
        ],
        "face_ja": {"excited": "上機嫌"},
    },
    "mashiro": {
        "points": [
            "淡い黄緑がかった髪の長い三つ編み2本と、そろった前髪。眠たげな目",
            "ベージュのケーブル編みカーディガンに白いブラウス、セージグリーンのロングスカート",
            "茶色のローファー。全体におっとりした落ち着いた色合い",
        ],
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
        "points": [
            "雲・泡のようなもこもこの白い体。黒い丸い目、ほんのりピンクの頬、大きく開けた赤い口",
            "赤い蝶ネクタイ。金色の口金のついた紺色のホースを片手で持つ",
            "人物ではなくマスコット。他キャラの頭身は当てはめない。顔アップは目・口・蝶ネクタイまでの寄り",
        ],
    },
    "rin": {
        "points": [
            "青みがかった暗い長髪。年上らしい落ち着いた半目と控えめな微笑み",
            "襟元をゆるめた白シャツに黒のスラックス、ヒール。片手に書類やノートを持つ",
            "ほかの女性キャラより大人びたシルエット。立ち絵の横幅は広め",
        ],
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
        "face_ja": {"evil": "病み可愛い"},
    },
}

# 営業姿／私服の二衣装を持つ、みんとだけの手書き設定
MINTO = {
    "title": "みんと",
    "subtitle": "緑川 栞（みどりかわ しおり）",
    "outfits": [
        {
            "label": "営業姿",
            "label_long": "営業姿（ぺぱーみんと）",
            "prefix": "chr_minto_",
            "icon_key": "minto",
            "faces": ["normal", "smile", "wink", "surprise", "sad"],
            "palette": [
                ("髪", "#211F23"), ("瞳", "#62A35F"), ("肌", "#EDBB9B"),
                ("ドレス", "#2F2D31"), ("リボン", "#C6F0A9"), ("フリル", "#B8E79B"),
            ],
        },
        {
            "label": "私服",
            "label_long": "私服・素の姿（栞／お姉さん）",
            "prefix": "chr_minto_ura_",
            "icon_key": "minto_private",
            "faces": ["normal", "smile", "smug", "surprise", "sad"],
            "palette": [
                ("髪", "#252427"), ("瞳", "#88B96A"), ("肌", "#E4AD92"),
                ("カーディガン", "#D3C5BD"), ("スカート", "#25282A"), ("チャーム", "#81BD9D"),
            ],
        },
    ],
    "profile": [
        ("年齢", "自称20歳（隠し設定では29歳）"),
        ("所属", "コンカフェ「ぺぱーみんと」オーナー兼唯一のキャスト"),
        ("プレイスタイル", "客商売（魅せ方）の極意"),
        ("得意フレーバー", "清涼感特化のミントミックス"),
        ("成長の軸", "魅力 / 洞察"),
        ("LIME", "みんと＠ぺぱーみんと（私用は「栞」）"),
        ("表示倍率", "spriteScale 0.91"),
    ],
    "points": [
        "営業姿：黒の長髪・ぱっつん前髪・緑の瞳。小さな角とコウモリ羽の髪飾り、ハート付きチョーカー",
        "営業姿：黒ワンピースに明るい緑のリボンとフリル、ガーター付き黒ニーハイ、緑縁の厚底メリージェーン",
        "私服：同じ黒髪・緑の瞳。生成りのケーブルカーディガン、黒インナー、ダークグレーのロングスカート",
        "私服：黒のショルダーバッグにハート型ミントのチャーム、緑のピアスとネックレス。派手さを消した静かな印象",
        "どちらも緑がアクセント色。髪色・目の色・輪郭は共通で、同一人物と分かること",
    ],
    "notes": [
        "営業の場では必ず営業姿。私服は私的な約束と、tonariでの「お姉さん」のとき（本名は聞いた後だけ）",
        "characters.json と character_profiles.md の外見設定は採用済みの立ち絵と共通。黒髪と緑の瞳を両方の姿で保つ",
    ],
    "face_ja": {"smug": "照れ笑い"},
}


# ---------------------------------------------------------------- 描画の部品

_font_cache = {}


def font(weight, size):
    key = (weight, size)
    if key not in _font_cache:
        f = None
        for rel in FONT_FILES[weight]:
            p = ROOT / rel
            if p.exists():
                try:
                    f = ImageFont.truetype(str(p), size)
                    break
                except OSError:
                    pass
        _font_cache[key] = f or ImageFont.truetype(FALLBACK_FONT, size)
    return _font_cache[key]


def wrap(draw, text, fnt, width):
    """全角主体の文を幅で折る。行頭に来てはいけない記号は前の行へ送る。"""
    no_head = "、。，．）」』】！？・ー〜…"
    lines, cur = [], ""
    for ch in text:
        if draw.textlength(cur + ch, font=fnt) > width and cur and ch not in no_head:
            lines.append(cur)
            cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def hex_rgb(hx):
    return tuple(int(hx[i:i + 2], 16) for i in (1, 3, 5))


def mix(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def rounded_mask(size, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], r, fill=255)
    return m


def stage(size, accent):
    """人物を置く台。上から下へ薄く暗くなるグラデーションと、アクセント色のごく弱い照り。"""
    w, h = size
    top, bot = mix(PANEL_HI, accent, 0.06), mix(PANEL, BG, 0.4)
    im = Image.new("RGB", size)
    d = ImageDraw.Draw(im)
    for y in range(h):
        d.line([(0, y), (w, y)], fill=mix(top, bot, y / max(1, h - 1)))
    return im


def paste_round(canvas, img, xy, r):
    canvas.paste(img, xy, rounded_mask(img.size, r))


def fit(img, w, h):
    s = min(w / img.width, h / img.height)
    return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)


def heading(d, xy, text, accent, size=30):
    x, y = xy
    d.rectangle([x, y + 6, x + 6, y + size + 2], fill=accent)
    d.text((x + 18, y), text, font=font("bold", size), fill=TEXT)
    return y + size + 22


# ---------------------------------------------------------------- 素材の解析

def auto_palette(img, n=6):
    """不透明部分の代表色。面積だけで選ぶと肌と黒で埋まるので、
    すでに選んだ色から遠い色を、面積の平方根で重みづけして順に選ぶ。"""
    small = img.resize((img.width // 4, img.height // 4), Image.NEAREST)
    getter = getattr(small, "get_flattened_data", small.getdata)
    px = [p[:3] for p in getter() if p[3] > 250]
    q = Image.new("RGB", (len(px), 1))
    q.putdata(px)
    q = q.quantize(colors=32, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[: 32 * 3]
    cand = [(cnt, tuple(pal[i * 3: i * 3 + 3])) for cnt, i in q.getcolors() if cnt > len(px) * 0.0006]
    cand.sort(reverse=True)
    out = [cand[0][1]]
    while len(out) < min(n, len(cand)):
        best = max(
            (c for c in cand if c[1] not in out),
            key=lambda c: math.sqrt(c[0]) * min(math.dist(c[1], o) for o in out),
        )
        out.append(best[1])
    return [("", "#%02X%02X%02X" % c) for c in out]


def mass_center_x(im):
    """不透明部分の重心（横）。全身を見た目の中央に置く基準。"""
    a = im.getchannel("A").resize((im.width // 4, im.height // 4), Image.NEAREST)
    getter = getattr(a, "get_flattened_data", a.getdata)
    tot = sx = 0
    for i, v in enumerate(getter()):
        if v > 128:
            tot += 1
            sx += i % a.width
    return (sx / tot) * 4 if tot else im.width / 2


def body_crop(im):
    x0, y0, x1, y1 = im.getchannel("A").getbbox()
    cx = mass_center_x(im)
    half = max(cx - x0, x1 - cx)
    return im.crop((round(cx - half), y0, round(cx + half), y1))


def faces_in(cid, prefix):
    names = [p.name[len(prefix):-4] for p in (SPRITE / cid).glob(f"{prefix}*.png")]
    if prefix == f"chr_{cid}_":
        names = [n for n in names if not n.startswith("ura_")]
    order = {n: i for i, n in enumerate(FACE_ORDER)}
    return sorted(names, key=lambda n: (order.get(n, 99), n))


def load_characters():
    chars = {c["id"]: c for c in json.loads((ROOT / "data/characters.json").read_text(encoding="utf-8"))}
    k = ROOT / "data/dialogue/samechan.json"
    if k.exists():
        prof = json.loads(k.read_text(encoding="utf-8")).get("profile")
        if prof:
            chars[prof["id"]] = prof
    return chars


# ---------------------------------------------------------------- 設定の組み立て

def make_cfg(cid, chars, light=False):
    entry = chars[cid]
    cut = entry.get("intro_cutin") or {}
    accent = hex_rgb(cut.get("color", "#9bb0d0"))
    tagline = (cut.get("title"), (cut.get("line") or "").replace("／", "") or None)
    if cid == "minto":
        cfg = dict(MINTO)
    else:
        spec = CHARS[cid]
        nm = entry.get("display_name") or entry["name"]
        title = nm.split(" / ", 1)[0]
        full = entry.get("full_name") or (nm.split(" / ", 1)[1] if " / " in nm else "")
        g = entry.get("growth_stats") or {}
        growth = " / ".join(x for x in (g.get("primary"), g.get("secondary")) if x and x != "N/A")
        age = entry.get("age")
        profile = [
            ("年齢", f"{age}歳" if str(age).isdigit() else age),
            ("所属", entry.get("affiliation")),
            ("プレイスタイル", (entry.get("play_style") or "").strip("「」")),
            ("得意フレーバー", entry.get("specialty_flavor")),
            ("成長の軸", growth),
            ("表示倍率", f"spriteScale {entry['spriteScale']}" if entry.get("spriteScale") else None),
        ]
        cfg = {
            "title": title,
            "subtitle": full if full and full != title else "",
            "outfits": [{
                "label": "通常衣装",
                "label_long": "通常衣装",
                "prefix": f"chr_{cid}_",
                "icon_key": cid,
                "faces": faces_in(cid, f"chr_{cid}_"),
            }],
            "profile": [(k, v) for k, v in profile if v and str(v) not in ("N/A", "None")],
            "points": spec["points"],
            "notes": spec.get("notes", []),
            "face_ja": spec.get("face_ja", {}),
        }
    cfg["outfits"] = [dict(o) for o in cfg["outfits"]]
    cfg["accent"] = accent
    cfg["tagline"] = tagline
    for o in cfg["outfits"]:
        o["normal"] = Image.open(SPRITE / cid / f"{o['prefix']}normal.png").convert("RGBA")
        o["sprite_scale"] = entry.get("spriteScale") or 1.0
        if light:
            continue
        o["box"] = face_box(o["icon_key"], o["normal"])  # (x0, y0, side) 顔アイコンと同じ枠
        if not o.get("palette"):
            o["palette"] = auto_palette(o["normal"])
            cfg["auto_palette"] = True
    return cfg


# ---------------------------------------------------------------- シート

def draw_header(d, cid, cfg):
    accent = cfg["accent"]
    d.rectangle([0, 0, W, 10], fill=accent)
    f_name = font("black", 88)
    d.text((M, 40), cfg["title"], font=f_name, fill=TEXT)
    nx = M + d.textlength(cfg["title"], font=f_name) + 28
    if cfg["subtitle"]:
        d.text((nx, 84), cfg["subtitle"], font=font("medium", 32), fill=SUB)
    title, line = cfg["tagline"]
    y = 160
    x = M
    if title:
        f = font("bold", 24)
        tw = d.textlength(title, font=f)
        d.rounded_rectangle([x, y, x + tw + 32, y + 42], 21, fill=mix(BG, accent, 0.22), outline=accent)
        d.text((x + 16, y + 7), title, font=f, fill=mix(TEXT, accent, 0.25))
        x += tw + 32 + 20
    if line:
        d.text((x, y + 6), f"「{line}」", font=font("medium", 26), fill=SUB)
    d.text((W - M, 52), "CHARACTER REFERENCE SHEET", font=font("bold", 22), fill=SUB, anchor="ra")
    d.text((W - M, 86), "水煙前線 -EN:CODE-", font=font("medium", 22), fill=MUTED, anchor="ra")
    d.text((W - M, 170), f"id: {cid}", font=font("medium", 24), fill=MUTED, anchor="ra")
    d.line([M, 228, W - M, 228], fill=LINE, width=2)
    return 256


def draw_mid(sheet, d, x, y, w, cfg):
    """顔アップと基調色の列。描いた後の下端yを返す。"""
    accent = cfg["accent"]
    two = len(cfg["outfits"]) > 1
    y = heading(d, (x, y), "顔アップ", accent)
    fw = 330 if two else w  # 二衣装は縦に2枚並ぶので小さめ
    for o in cfg["outfits"]:
        x0, y0, side = o["box"]
        pad = side * (FACEUP_PAD - 1) / 2
        face = o["normal"].crop((round(x0 - pad), round(y0 - pad), round(x0 + side + pad), round(y0 + side + pad)))
        face = face.resize((fw, fw), Image.LANCZOS)
        tile = stage((fw, fw), accent)
        tile.paste(face, (0, 0), face)
        paste_round(sheet, tile, (x, y), 20)
        d.rounded_rectangle([x, y, x + fw - 1, y + fw - 1], 20, outline=mix(LINE, accent, 0.35), width=2)
        if two:
            f = font("bold", 22)
            tw = d.textlength(o["label"], font=f)
            d.rounded_rectangle([x + 12, y + 12, x + 12 + tw + 24, y + 48], 18, fill=(0, 0, 0))
            d.text((x + 24, y + 17), o["label"], font=f, fill=TEXT)
        y += fw + 18
    y += 22
    y = heading(d, (x, y), "基調色" + ("（自動抽出・目安）" if cfg.get("auto_palette") else ""), accent)
    cols, gap = 3, 14
    cw = (w - gap * (cols - 1)) // cols
    for o in cfg["outfits"]:
        if two:
            d.text((x, y), o["label"], font=font("bold", 22), fill=SUB)
            y += 34
        named = bool(o["palette"][0][0])
        rows = math.ceil(len(o["palette"]) / cols)
        cell_h = 56 + (58 if named else 34)
        for i, (name, hx) in enumerate(o["palette"]):
            r, c = divmod(i, cols)
            cx, cy = x + c * (cw + gap), y + r * (cell_h + 12)
            d.rounded_rectangle([cx, cy, cx + cw, cy + 56], 10, fill=hex_rgb(hx), outline=LINE)
            ty = cy + 64
            if named:
                d.text((cx + 2, ty), name, font=font("bold", 22), fill=TEXT)
                ty += 28
            d.text((cx + 2, ty), hx, font=font("medium", 18), fill=SUB)
        y += rows * (cell_h + 12) + 10
    return y


def draw_right(d, x, y, w, cfg):
    accent = cfg["accent"]
    y = heading(d, (x, y), "プロフィール", accent)
    lw = 196
    f_k, f_v = font("bold", 23), font("medium", 25)
    for i, (k, v) in enumerate(cfg["profile"]):
        lines = wrap(d, str(v), f_v, w - lw - 28)
        h = 22 + 36 * len(lines)
        if i % 2 == 0:
            d.rounded_rectangle([x, y, x + w, y + h], 8, fill=PANEL)
        d.text((x + 16, y + 13), k, font=f_k, fill=SUB)
        for j, ln in enumerate(lines):
            d.text((x + lw, y + 10 + 36 * j), ln, font=f_v, fill=TEXT)
        y += h
    y += 38
    y = heading(d, (x, y), "デザインの要点", accent)
    f_p = font("medium", 25)
    for p in cfg["points"]:
        d.ellipse([x + 4, y + 13, x + 14, y + 23], fill=accent)
        for ln in wrap(d, p, f_p, w - 34):
            d.text((x + 30, y), ln, font=f_p, fill=TEXT)
            y += 38
        y += 10
    if cfg["notes"]:
        y += 26
        f_n = font("medium", 23)
        blocks = [wrap(d, n, f_n, w - 74) for n in cfg["notes"]]
        h = 62 + sum(34 * len(b) + 10 for b in blocks) + 14
        d.rounded_rectangle([x, y, x + w, y + h], 14, fill=PANEL, outline=LINE)
        d.text((x + 22, y + 18), "メモ", font=font("bold", 24), fill=accent)
        yy = y + 62
        for b in blocks:
            d.text((x + 22, yy), "※", font=f_n, fill=MUTED)
            for ln in b:
                d.text((x + 52, yy), ln, font=f_n, fill=SUB)
                yy += 34
            yy += 10
        y += h
    return y


BODY_PAD_W, BODY_PAD_H, MIN_ROW_H = 60, 110, 1270
BODY_W_ONE, BODY_W_TWO = 760, 500
_body_k = None


PAKKI_RATIO = 0.94 / 1.36  # remake/js/vn/engine.js の FRAMING（pakkiTarget / target）


# 身長の設定（cm）。正本は brand/character_profiles.md（サメちゃんは data/dialogue/samechan.json の height_cm）。
# 設定の無いキャラは None（ゲーム内の spriteScale から換算する）。
HEIGHT_CM = {
    "hajime": 172, "sumi": 182, "naru": 176, "adam": 178, "minto": 156, "ageha": 160,
    "nagumo": 178, "dr_kemuri": 175, "mashiro": 155, "samechan": 156,
    "tsumugi": None, "rin": None, "maezono": None, "pakki": None,
}
BASE_CM = 172  # spriteScale 1.0 ＝ はじめの身長


def game_height(o, cid):
    """ゲーム内の見かけの全身の高さ（はじめ＝1.0）。会話エンジンは絵の余白や原寸に関係なく、
    不透明部分の高さを spriteScale に比例させて表示する（engine.js の frame()）。"""
    return o["sprite_scale"] * (PAKKI_RATIO if cid == "pakki" else 1.0)


def sheet_height(o, cid):
    """シートで描く全身の高さ（はじめ＝1.0）。身長の設定があればそれに合わせ、無ければゲーム内の値。"""
    cm = HEIGHT_CM.get(cid)
    return cm / BASE_CM if cm else game_height(o, cid)


def body_scale(chars):
    """全シート共通の全身の縮尺 REF（ゲーム内の高さ1.0を何pxで描くか）。
    1枚ずつ枠に合わせると、横に広い立ち絵（凛）が小さく写り、身長の比較ができなくなるため、
    ゲームと同じく spriteScale に比例した高さで描き、いちばん大きい立ち絵が枠に収まる値にする。"""
    global _body_k
    if _body_k is None:
        ks = []
        for cid in ["minto", *CHARS]:
            cfg = make_cfg(cid, chars, light=True)
            avail_w = (BODY_W_TWO if len(cfg["outfits"]) > 1 else BODY_W_ONE) - BODY_PAD_W
            for o in cfg["outfits"]:
                b = body_crop(o["normal"])
                gh = sheet_height(o, cid)
                ks.append(min((MIN_ROW_H - BODY_PAD_H) / gh, avail_w * b.height / (b.width * gh)))
        _body_k = min(ks)
    return _body_k


def draw_body(sheet, d, bx, top, bottom, w, o, label, accent, k, cid):
    ph = bottom - top
    tile = stage((w, ph), accent)
    floor = ph - 40
    # 全シート共通の目安線（ゲーム内の高さ1.0＝はじめの身長の1/10ごと）
    gd = ImageDraw.Draw(tile)
    step = k / 10
    yy = floor - step
    while yy > 70:
        gd.line([(14, round(yy)), (w - 14, round(yy))], fill=mix(PANEL, TEXT, 0.07), width=1)
        yy -= step
    src = body_crop(o["normal"])
    s = k * sheet_height(o, cid) / src.height
    body = src.resize((max(1, round(src.width * s)), max(1, round(src.height * s))), Image.LANCZOS)
    fx = (w - body.width) // 2
    fy = floor - body.height
    sh = Image.new("L", (body.width + 80, 46), 0)
    ImageDraw.Draw(sh).ellipse([0, 0, sh.width - 1, sh.height - 1], fill=90)
    tile.paste((10, 11, 14), (fx - 40, ph - 40 - 24), sh)
    tile.paste(body, (fx, fy), body)
    paste_round(sheet, tile, (bx, top), 20)
    d.rounded_rectangle([bx, top, bx + w - 1, bottom - 1], 20, outline=LINE, width=2)
    f = font("bold", 24)
    tw = d.textlength(label, font=f)
    d.rounded_rectangle([bx + 16, top + 16, bx + 16 + tw + 28, top + 56], 20, fill=mix(BG, accent, 0.25))
    d.text((bx + 30, top + 22), label, font=f, fill=TEXT)


def draw_expressions(sheet, d, cid, y, o, title, cfg):
    """表情差分。顔の大きさは全キャラ共通（顔アイコン枠1辺 = FACE_PX）。"""
    inner = W - 2 * M
    y = heading(d, (M, y), title, cfg["accent"])
    face_ja = {**FACE_JA, **cfg.get("face_ja", {})}
    names = o["faces"]
    gap = 16
    cell_w = (inner - gap * (len(names) - 1)) // len(names)
    cell_h = 420
    x0, y0, side = o["box"]
    scale = FACE_PX / side
    cw, ch = cell_w / scale, cell_h / scale
    cx = x0 + side / 2
    top_src = y0 - side * 0.06
    for i, fn in enumerate(names):
        spr = Image.open(SPRITE / cid / f"{o['prefix']}{fn}.png").convert("RGBA")
        crop = spr.crop((round(cx - cw / 2), round(top_src), round(cx + cw / 2), round(top_src + ch)))
        crop = crop.resize((cell_w, cell_h), Image.LANCZOS)
        tile = stage((cell_w, cell_h), cfg["accent"]).convert("RGBA")
        tile.alpha_composite(crop)
        band = Image.new("RGBA", (cell_w, 58), (14, 16, 20, 215))
        tile.alpha_composite(band, (0, cell_h - 58))
        ex = M + i * (cell_w + gap)
        paste_round(sheet, tile.convert("RGB"), (ex, y), 16)
        d.rounded_rectangle([ex, y, ex + cell_w - 1, y + cell_h - 1], 16, outline=LINE, width=2)
        d.text((ex + 18, y + cell_h - 46), face_ja.get(fn, fn), font=font("bold", 26), fill=TEXT)
        d.text((ex + cell_w - 16, y + cell_h - 40), fn, font=font("medium", 19), fill=SUB, anchor="ra")
    return y + cell_h + 40


def build(cid, chars):
    cfg = make_cfg(cid, chars)
    accent = cfg["accent"]
    outfits = cfg["outfits"]
    two = len(outfits) > 1

    sheet = Image.new("RGB", (W, 7000), BG)
    d = ImageDraw.Draw(sheet)
    top = draw_header(d, cid, cfg)

    inner = W - 2 * M
    body_w = BODY_W_TWO if two else BODY_W_ONE
    bodies_w = body_w * len(outfits) + GAP * (len(outfits) - 1)
    mid_w = 440 if two else 500
    right_w = inner - bodies_w - mid_w - 2 * GAP
    mid_x = M + bodies_w + GAP
    right_x = mid_x + mid_w + GAP

    # 情報列を先に描いて行の高さを決め、全身パネルをその高さに合わせる
    mid_bottom = draw_mid(sheet, d, mid_x, top, mid_w, cfg)
    right_bottom = draw_right(d, right_x, top, right_w, cfg)
    row_bottom = max(mid_bottom, right_bottom, top + MIN_ROW_H)
    for i, o in enumerate(outfits):
        draw_body(sheet, d, M + i * (body_w + GAP), top, row_bottom, body_w, o,
                  o["label_long"] if two else o["label"], accent, body_scale(chars), cid)

    y = row_bottom + 56
    for o in outfits:
        y = draw_expressions(sheet, d, cid, y, o, "表情差分" + (f" — {o['label_long']}" if two else ""), cfg)

    d.line([M, y, W - M, y], fill=LINE, width=2)
    y += 22
    d.text(
        (M, y),
        f"出典: assets/sprites/characters/{cid}/ ・ data/characters.json　｜　顔の切り抜きは tools/make_face_icons.py と同じ枠"
        "　｜　python3 tools/make_reference_sheet.py で再生成（新規の画像生成なし）",
        font=font("medium", 19), fill=MUTED,
    )
    y += 56

    sheet = sheet.crop((0, 0, W, y))
    out_dir = OUT_ROOT / cid
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{cid}-reference-sheet.png"
    sheet.save(out, optimize=True)
    print(out.relative_to(ROOT), sheet.size)
    return out


def build_lineup(chars, ref=760):
    """全員を同じ床・同じ縮尺（身長の設定どおり）に並べた背比べ図。"""
    items = []
    for cid in ["minto", *CHARS]:
        cfg = make_cfg(cid, chars, light=True)
        name = cfg.get("title") or cid
        if cid != "minto":
            entry = chars[cid]
            name = (entry.get("display_name") or entry["name"]).split(" / ", 1)[0].split("（")[0]
        for o in cfg["outfits"]:
            lab = name + (f"（{o['label']}）" if len(cfg["outfits"]) > 1 else "")
            items.append((cid, lab, o))
    items.sort(key=lambda t: -sheet_height(t[2], t[0]))

    px_cm = ref / BASE_CM
    gap, left, top_pad, foot = 28, 150, 150, 230
    bodies = []
    for cid, lab, o in items:
        src = body_crop(o["normal"])
        sc = ref * sheet_height(o, cid) / src.height
        bodies.append(src.resize((max(1, round(src.width * sc)), max(1, round(src.height * sc))), Image.LANCZOS))
    width = left + sum(b.width for b in bodies) + gap * (len(bodies) - 1) + 60
    tallest = max(b.height for b in bodies)
    floor = top_pad + tallest + 20
    sheet = Image.new("RGB", (width, floor + foot), BG)
    d = ImageDraw.Draw(sheet)
    d.text((M, 40), "背比べ（身長の設定どおりの縮尺）", font=font("black", 56), fill=TEXT)
    d.text((M, 108), "設定の無いキャラはゲーム内の表示倍率で換算。頭の上の帽子・角・フード、厚底靴も含めた高さで並べている",
           font=font("medium", 24), fill=SUB)
    for cm in range(100, 200, 10):
        y = round(floor - cm * px_cm)
        if y < top_pad - 10:
            break
        d.line([(left - 10, y), (width - 30, y)], fill=mix(BG, TEXT, 0.12 if cm % 50 else 0.22), width=1)
        d.text((left - 20, y - 14), f"{cm}cm", font=font("medium", 20), fill=MUTED, anchor="ra")
    d.line([(left - 10, floor), (width - 30, floor)], fill=mix(BG, TEXT, 0.4), width=2)
    x = left
    for (cid, lab, o), b in zip(items, bodies):
        sheet.paste(b, (x, floor - b.height), b)
        cx = x + b.width // 2
        cm = HEIGHT_CM.get(cid)
        game_cm = BASE_CM * game_height(o, cid)
        d.text((cx, floor + 24), lab, font=font("bold", 24), fill=TEXT, anchor="ma")
        d.text((cx, floor + 62), f"設定 {cm}cm" if cm else "設定なし", font=font("medium", 20), fill=SUB, anchor="ma")
        d.text((cx, floor + 90), f"ゲーム内 約{game_cm:.0f}cm", font=font("medium", 20), fill=SUB, anchor="ma")
        if cm and abs(game_cm - cm) >= 3:
            # ゲーム内の高さが設定とずれている場合は、ゲーム内の頭の位置を赤い点線で示す
            y = round(floor - game_cm * px_cm)
            for xx in range(x, x + b.width, 14):
                d.line([(xx, y), (xx + 7, y)], fill=(230, 80, 70), width=3)
            d.text((cx, floor + 118), "ゲーム内と設定がずれている", font=font("bold", 18), fill=(230, 80, 70), anchor="ma")
        x += b.width + gap
    out = OUT_ROOT / "height-lineup.png"
    sheet.save(out, optimize=True)
    print(out.relative_to(ROOT), sheet.size)
    return out


def build_face_size(chars, k=2.0):
    """ゲーム画面での顔の大きさの比較図。全員を同じ倍率（1280x720画面のk倍）で、目の高さをそろえて並べる。
    顔の幅は顔アイコンの調整値（頬の幅＝枠の0.5）から求めた目安。"""
    ids = ["hajime", "sumi", "naru", "adam", "nagumo", "dr_kemuri", "maezono",
           "minto", "ageha", "mashiro", "samechan", "tsumugi", "rin"]
    data = []
    for cid in ids:
        cfg = make_cfg(cid, chars, light=True)
        o = cfg["outfits"][0]
        im = o["normal"]
        x0, y0, x1, y1 = im.getchannel("A").getbbox()
        disp = 1.36 * o["sprite_scale"] * 720 * k / (y1 - y0)
        fx, fy, side = face_box(o["icon_key"], im)
        name = cfg.get("title") if cid == "minto" else \
            (chars[cid].get("display_name") or chars[cid]["name"]).split(" / ", 1)[0].split("（")[0]
        data.append((name, im, disp, fx, fy, side, 0.5 * side * disp / k))
    med = sorted(t[6] for t in data)[len(data) // 2]
    tw, th = 300, 330
    sheet = Image.new("RGB", (40 + len(ids) * (tw + 14), th + 260), BG)
    d = ImageDraw.Draw(sheet)
    d.text((40, 24), "ゲーム画面での顔の大きさ（全員同じ倍率・目の高さをそろえて配置）", font=font("black", 40), fill=TEXT)
    d.text((40, 80), f"数値は1280×720画面での頬の幅の目安。中央値 {med:.0f}px からの差。±10%を超えると赤",
           font=font("medium", 24), fill=SUB)
    for i, (name, im, disp, fx, fy, side, w) in enumerate(data):
        big = im.resize((round(im.width * disp), round(im.height * disp)), Image.LANCZOS)
        cx, ey = (fx + side / 2) * disp, (fy + side * 0.55) * disp
        crop = big.crop((round(cx - tw / 2), round(ey - th * 0.45), round(cx + tw / 2), round(ey + th * 0.55)))
        x, y = 40 + i * (tw + 14), 130
        tile = Image.new("RGB", (tw, th), PANEL)
        tile.paste(crop, (0, 0), crop)
        sheet.paste(tile, (x, y))
        dev = (w / med - 1) * 100
        col = (240, 110, 100) if abs(dev) > 10 else ((240, 200, 110) if abs(dev) >= 5 else TEXT)
        d.text((x + tw // 2, y + th + 16), name, font=font("bold", 28), fill=TEXT, anchor="ma")
        d.text((x + tw // 2, y + th + 56), f"{w:.0f}px（{dev:+.0f}%）", font=font("medium", 24), fill=col, anchor="ma")
    out = OUT_ROOT / "face-size-ingame.png"
    sheet.save(out, optimize=True)
    print(out.relative_to(ROOT), sheet.size)
    return out


if __name__ == "__main__":
    chars = load_characters()
    targets = sys.argv[1:] or ["minto", *CHARS, "lineup", "facesize"]
    for t in targets:
        if t == "lineup":
            build_lineup(chars)
        elif t == "facesize":
            build_face_size(chars)
        else:
            build(t, chars)
