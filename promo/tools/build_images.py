#!/usr/bin/env python3
"""公式サイト用の画像を、ゲームの採用済み素材から書き出す。

リポジトリのルートで実行する:
    python3 promo/tools/build_images.py            # 全部作り直す
    python3 promo/tools/build_images.py cast       # 一部だけ（hero / story / cast / world / gallery / ui）
    python3 promo/tools/build_images.py --sources  # 元にする絵のパスを並べる（Git LFS で取得する範囲を知る）
    python3 promo/tools/build_images.py --check    # ゲーム側の絵が、書き出した後に差し替わっていないか調べる
    python3 promo/tools/build_images.py screens <撮った画面のフォルダ>   # 「遊びかた」の画面写真

- **どの絵を使うかは、ゲームのコードの採用表から読む**（没・旧版を拾わないため）:
    キービジュアル … remake/js/core/title-art-unlock.js の TITLE_KEY_VISUALS（1キャラ1枚）
    店の中の絵     … remake/js/daily/spots.js の SPOT_PREVIEW（入ったときの背景）
    店のロゴ       … remake/js/core/store-logos.js の採用部分（frame）
    登場カットイン … remake/js/vn/intro-graphic.js の FRAME_OVERRIDES（置き方は index.html に書き込む）
    立ち絵・顔     … 採用済みの新版（remake/js/core/portrait-style.js の既定）
    章題の絵       … remake/js/core/chapter-title-art.js（採用済みの1枚絵。人物を切り分けた絵は使わない）
    ボタン         … シーシャ作りの現行スキン（remake/css/craft-paper.css の --cp-button-*）
- 例外は、サイトのために描いた横長のキービジュアル（#3232。2026-11-11 オーナーが6枚を全採用）。ゲームには無い絵なので、
  どの原画を使うかは下の WIDE_KEY_VISUALS が採用表になる（原画は asset_sources/promo-site-20261111/keyvisual/）。
  公開用の手順はこの原画を取得しないので、原画が手元に無い（ポインタのままも同じ）ときは、書き出し済みの絵と記録をそのまま残す。
- 絵そのものは描き変えず、大きさと圧縮だけをサイト向けに整える。
- 元の絵が Git LFS のポインタ（131バイトのテキスト）のままなら、そのパスを出して止まる。
    git lfs pull --include="$(python3 promo/tools/build_images.py --sources | paste -sd, -)"
  で、必要な絵だけ取得する（フォルダごとまとめて取得しない）。
- 書き出すたびに promo/img/sources.json へ「どの絵から作ったか」と元の絵の版（Git の blob）を記録する。
  --check はこの記録と今のリポジトリを比べ、差し替わった絵を知らせる（絵の実体が無くても調べられる）。
- 最後に index.html の <img> の width / height を実際の大きさへ合わせる（読み込み中に配置がずれないように）。
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PROMO = ROOT / "promo"
OUT = PROMO / "img"
GAME = ROOT / "remake" / "img"
RECORD = OUT / "sources.json"

# 人物紹介に出す人（第1〜2章で出会う人だけ。docs/marketing/sns_operation.md の出す順番に合わせる）
CAST_MAIN = ["hajime", "sumi", "naru", "adam", "minto", "tsumugi", "rio", "hiyori", "samechan", "ageha", "kumicho", "rei"]
CAST_SUB = ["pakki", "sui", "dr_kemuri", "maezono"]
# ヒーローで順に見せる人。第3章で出会うましろは載せない
KEY_VISUAL_CAST = ["minto", "tsumugi", "sumi", "rio", "naru", "hiyori", "samechan", "adam", "ageha"]
# サイトのために描いた横長のキービジュアル（#3232）。原画は 1536x1024。ヒーローでの並びは index.html の .hero-art と .hero-reel。
# サイトでの名前 → (原画, ヒーローの札に切り出す範囲 左・上・右・下 0〜1)。
# 6枚は「案A 夜のカウンター」「案B 夜の商店街」の2つの構図を3回ずつ描いた物なので、構図ごとに1枚を選んで使う（promo/README.md）。
PROMO_KEY_ART = ROOT / "asset_sources" / "promo-site-20261111" / "keyvisual"
WIDE_KEY_VISUALS = {
    "town": ("kv-b-01", (0.60, 0.36, 0.98, 0.92)),     # 夜の商店街を歩く6人。ヒーローの1枚目。OGP（build_parts.py）も
    "counter": ("kv-a-02", (0.48, 0.14, 0.86, 0.80)),  # 閉店前のtonariのカウンター。スミさんの絵の前に出す
}
# 舞台に載せる店: サイトでの名前 → ゲームの行き先 id（spots.js・store-logos.js のキー）
SHOPS = {"tonari": "tonari", "kemurikusa": "naru", "eden": "adam", "peppermint": "minto", "dr-fookah": "shop", "c-station": "c_station"}
SHOP_TONE = {"tonari": "night", "c-station": "night"}  # 昼夜のある店は、夜の絵を使う
GALLERY = {
    "sumi-training": "cg_ch1_sumi_training",
    "tournament": "cg_ch1_tournament_battle",
    "tsumugi-sketch": "cg_ch1_tsumugi_sketch_wip",
    "tsumugi-smoke": "cg_tsumugi_smoke_color",
}
GALLERY_SHELF = {"tournament", "tsumugi-sketch", "tsumugi-smoke"}
# ボタンの大きさ（表示の2倍で作る）。CSS の .btn / .btn-l / .head-play / .btn-wide と同じ比率
BUTTON_SIZES = {"m": (368, 120), "l": (496, 148), "s": (216, 92), "wide": (664, 120)}

CAST_BG_FOCUS = 0.78  # スマホの舞台で、人物の背景のどこを見せるか（0＝左端、1＝右端）
STAND_HEIGHT, STAND_FLOOR = 1200, 1188  # 立ち絵の台紙の高さと、足元を置く高さ（CSS の .cast-stand はこの比で置く）

LIST_ONLY = False          # --sources: 絵を開かず、パスだけ集める
used: list[str] = []       # いま作っている1枚が元にした絵
records: dict[str, list[str]] = {}
kept: dict[str, str] = {}  # 原画が無くて書き出さなかった絵の元の版（前の記録のまま残す）
all_sources: set[str] = set()


# ── ゲームの採用表を読む ──────────────────────────────────────────

def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def key_visuals() -> dict[str, str]:
    block = re.search(r"export const TITLE_KEY_VISUALS = \{(.*?)\};", read("remake/js/core/title-art-unlock.js"), re.S)
    table = dict(re.findall(r'(\w+): "([^"]+)\.png"', block.group(1)))
    missing = [cid for cid in KEY_VISUAL_CAST if cid not in table]
    if missing:
        sys.exit(f"TITLE_KEY_VISUALS に無い人物: {missing}")
    return {cid: table[cid] for cid in KEY_VISUAL_CAST}


def spot_previews() -> dict[str, str]:
    block = re.search(r"export const SPOT_PREVIEW = \{(.*?)\};", read("remake/js/daily/spots.js"), re.S)
    return dict(re.findall(r'(\w+): "([^"]+)"', block.group(1)))


def store_logos() -> dict[str, tuple[str, tuple[int, int, int, int]]]:
    source = read("remake/js/core/store-logos.js")
    table = {}
    for key, file, frame in re.findall(r'(\w+): \{ name: "[^"]*", file: "([^"]+)", ext: "webp", sheet: \[[^\]]*\], frame: \[([^\]]*)\]', source):
        table[key] = (file, tuple(int(n) for n in frame.split(",")))
    return table


def intro_frames() -> dict[str, dict]:
    frames = {}
    pattern = r"^\s*(\w+): \{width: (\d+), left: (-?\d+), top: (-?\d+)(?:, fade: (\d+))?(?:, right: ([\d.]+))?\},"
    for cid, width, left, top, fade, right in re.findall(pattern, read("remake/js/vn/intro-graphic.js"), re.M):
        frames[cid] = {"width": int(width), "left": int(left), "top": int(top), "fade": fade and int(fade), "right": right}
    return frames


def craft_buttons() -> dict[str, str]:
    """現行スキンのボタンの絵（主＝金、副＝白）。"""
    css = read("remake/css/craft-paper.css")
    gold = re.search(r'--cp-button-amber: url\("\.\./img/([^"]+)"\)', css).group(1)
    white = re.search(r'--cp-button-primary: url\("\.\./img/([^"]+)"\)', css).group(1)
    return {"gold": gold, "white": white}


# ── 読む・書く ────────────────────────────────────────────────

def load(path: Path) -> Image.Image:
    rel = path.relative_to(ROOT).as_posix()
    used.append(rel)
    all_sources.add(rel)
    if LIST_ONLY:
        return Image.new("RGBA", (64, 64), (0, 0, 0, 255))
    if not path.exists():
        sys.exit(f"入力がありません: {rel}")
    if path.stat().st_size < 200:
        sys.exit(f"Git LFS のポインタのままです: {rel}\n  git lfs pull --include=\"{rel}\" で取得してからやり直してください"
                 "（まとめて取得するなら、このファイルの冒頭の --sources の行）。")
    image = Image.open(path)
    image.load()
    return image


def load_site_art(path: Path) -> Image.Image | None:
    """サイトのために描いた原画（asset_sources/ の Git LFS）。手元に無い・ポインタのままなら None を返す。

    公開用の手順は asset_sources/ を取得しないので、そのときは keep() で書き出し済みの絵を残す。
    """
    rel = path.relative_to(ROOT).as_posix()
    used.append(rel)
    all_sources.add(rel)
    if LIST_ONLY:
        return Image.new("RGB", (64, 64), (0, 0, 0))
    if not path.exists() or path.stat().st_size < 200:
        return None
    image = Image.open(path)
    image.load()
    return image


def keep(rel: str) -> None:
    """原画が無いので書き出さず、書き出し済みの絵と、その元の版の記録をそのまま残す。"""
    sources = sorted(set(used))
    used.clear()
    was = json.loads(RECORD.read_text(encoding="utf-8")).get("sources", {}) if RECORD.exists() else {}
    if not (OUT / rel).exists() or any(src not in was for src in sources):
        print(f"{rel:44s} （原画が手元に無く、書き出し済みの絵も無い。git lfs pull --include=\"{','.join(sources)}\"）")
        return
    records[rel] = sources
    kept.update({src: was[src] for src in sources})
    print(f"{rel:44s} （原画が手元に無いので、書き出し済みの絵のまま）")


def save(image: Image.Image, rel: str, quality: int = 80, lossless: bool = False) -> None:
    records[rel] = sorted(set(used))
    used.clear()
    if LIST_ONLY:
        return
    target = OUT / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", quality=quality, method=6, lossless=lossless, exact=False)
    print(f"{rel:44s} {image.size[0]:5d}x{image.size[1]:<5d} {target.stat().st_size / 1024:7.1f} KB")


def fit_width(image: Image.Image, width: int, resample=Image.LANCZOS) -> Image.Image:
    if image.width <= width:
        return image
    return image.resize((width, round(image.height * width / image.width)), resample)


def cover(image: Image.Image, width: int, height: int, focus=(0.5, 0.5)) -> Image.Image:
    """縦横比を変えずに、指定の枠を埋めるよう切り抜く。focus は残したい位置（0〜1）。"""
    scale = max(width / image.width, height / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    left = round((resized.width - width) * focus[0])
    top = round((resized.height - height) * focus[1])
    return resized.crop((left, top, left + width, top + height))


def three_slice(source: Image.Image, width: int, height: int, cap: int) -> Image.Image:
    """ボタンの絵を、角と縁の形を保ったまま横だけ伸ばして指定の大きさにする。

    ブラウザの九分割（border-image）は、位置が半端な画素になると継ぎ目に細い線が出る。
    そこで、使う大きさごとに1枚の絵へ仕上げてから置く。cap は元の絵で両端として残す幅。
    """
    scale = height / source.height
    scaled = source.resize((max(1, round(source.width * scale)), height), Image.LANCZOS)
    edge = min(round(cap * scale), scaled.width // 2)
    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    out.paste(scaled.crop((0, 0, edge, height)), (0, 0))
    out.paste(scaled.crop((scaled.width - edge, 0, scaled.width, height)), (width - edge, 0))
    middle = scaled.crop((edge, 0, scaled.width - edge, height))
    if width - edge * 2 > 0 and middle.width > 0:
        out.paste(middle.resize((width - edge * 2, height), Image.LANCZOS), (edge, 0))
    return out


# ── 書き出す絵 ────────────────────────────────────────────────

def crop_box(image: Image.Image, box: tuple[float, float, float, float]) -> Image.Image:
    w, h = image.size
    return image.crop((round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h)))


def build_wide_key_visuals() -> None:
    """サイトのために描いた横長のキービジュアル: 原寸（PC）・幅960（スマホ）・ヒーローの札（縦長の絵の札と同じ3:4）。"""
    for name, (file, box) in WIDE_KEY_VISUALS.items():
        for rel, make, quality in (
            (f"hero/kv-{name}.webp", lambda art: art, 78),
            (f"hero/kv-{name}-s.webp", lambda art: fit_width(art, 960), 76),
            (f"hero/kv-{name}-thumb.webp", lambda art: cover(crop_box(art, box), 144, 192), 78),
        ):
            art = load_site_art(PROMO_KEY_ART / f"{file}.png")
            if art is None:
                keep(rel)
            else:
                save(make(art.convert("RGB")), rel, quality=quality)


# #3431: スマホ用の縦長原画。PC用の採用は WIDE_KEY_VISUALS のまま。
TALL_KEY_VISUALS = {"town": "kv-b-tall-01", "counter": "kv-a-tall-04"}


def build_tall_key_visuals() -> None:
    for name, file in TALL_KEY_VISUALS.items():
        rel = f"hero/kv-{name}-tall.webp"
        art = load_site_art(PROMO_KEY_ART / f"{file}.png")
        if art is None:
            keep(rel)
        else:
            save(fit_width(art.convert("RGB"), 1024), rel, quality=78)


def build_hero() -> None:
    # タイトル画面の背景（1280x720のドット絵）。ぼかさず整数倍に拡大して、ドットの角を保つ。
    lounge = load(GAME / "backgrounds" / "bg_title.webp").convert("RGB")
    save(lounge.resize((2560, 1440), Image.NEAREST), "hero/lounge.webp", quality=76)
    lounge = load(GAME / "backgrounds" / "bg_title.webp").convert("RGB")
    save(lounge.resize((1280, 720), Image.NEAREST), "hero/lounge-s.webp", quality=74)
    build_wide_key_visuals()
    build_tall_key_visuals()
    for cid, name in key_visuals().items():
        art = load(GAME / "ui" / "title_arts" / f"{name}.webp").convert("RGB")
        save(art, f"hero/kv-{cid}.webp", quality=80)
        art = load(GAME / "ui" / "title_arts" / f"{name}.webp").convert("RGB")
        save(cover(art, 144, 192, focus=(0.5, 0.18)), f"hero/kv-{cid}-thumb.webp", quality=78)
    logo = load(GAME / "ui" / "ui_title_logo_rich.webp").convert("RGBA")
    save(logo, "logo.webp", quality=84)
    logo = load(GAME / "ui" / "ui_title_logo_rich.webp").convert("RGBA")
    save(fit_width(logo, 640), "logo-s.webp", quality=88)


def build_story() -> None:
    # 章題は、ゲームが出すのと同じ採用済みの1枚絵をそのまま使う（第1章の人物を切り分けた絵は使わない）
    for chapter in (1, 2):
        save(load(GAME / "ui" / "chapters" / f"ch{chapter}-title.webp").convert("RGB"), f"story/ch{chapter}-title.webp", quality=82)
    # 章のはじめに出る詩のコマ絵（第1章）
    save(load(GAME / "ui" / "poems" / "poem_ch1.webp").convert("RGB"), "story/strip-ch1.webp", quality=80)
    save(fit_width(load(GAME / "backgrounds" / "bg_tonari_inside_night.webp").convert("RGB"), 1920), "story/tonari-night.webp", quality=74)
    # 暗く沈めて敷く絵なので、スマホでは小さい版で足りる
    save(fit_width(load(GAME / "backgrounds" / "bg_tonari_inside_night.webp").convert("RGB"), 960), "story/tonari-night-s.webp", quality=72)


def build_cast() -> None:
    intro = GAME / "ui" / "character_intros" / "graphic"
    sprites = GAME / "sprites" / "character_variants" / "new"
    faces = GAME / "ui" / "face_icons" / "new"
    for cid in CAST_MAIN:
        stand = load(sprites / cid / f"chr_{cid}_normal.webp").convert("RGBA")
        # 左右の透明な余白を落とし、足元を同じ高さへそろえる（絵の大きさは変えない＝身長差はそのまま）。
        # サイトで人物を狙った位置へ置き、全員が同じ床に立つようにするため
        if not LIST_ONLY:
            left, top, right, bottom = stand.getbbox()
            canvas = Image.new("RGBA", (right - left + 16, STAND_HEIGHT), (0, 0, 0, 0))
            canvas.paste(stand.crop((left, top, right, bottom)), (8, STAND_FLOOR - (bottom - top)))
            stand = canvas
        save(stand, f"chara/{cid}-stand.webp", quality=86)
    for cid in CAST_MAIN:
        save(load(faces / f"face_{cid}.webp").convert("RGBA"), f"chara/{cid}-face.webp", quality=88)
        save(fit_width(load(intro / f"{cid}.webp").convert("RGBA"), 880), f"chara/{cid}-graphic.webp", quality=84)
        save(fit_width(load(intro / f"bg_{cid}.webp").convert("RGB"), 1600), f"chara/{cid}-bg.webp", quality=76)
        # スマホでは縦長の舞台（3:4）に背景の右寄りだけが見える。見える所だけを切り出した軽い絵も作る
        # （切り出す位置は CSS の .cast-bg の横の位置 CAST_BG_FOCUS と同じ。見た目は変わらない）
        backdrop = load(intro / f"bg_{cid}.webp").convert("RGB")
        if not LIST_ONLY:
            crop_w = round(backdrop.height * 3 / 4)
            left = round((backdrop.width - crop_w) * CAST_BG_FOCUS)
            backdrop = backdrop.crop((left, 0, left + crop_w, backdrop.height))
        save(backdrop, f"chara/{cid}-bg-m.webp", quality=76)
    for cid in CAST_SUB:  # 大会の人びとは、立ち絵の胸から上
        stand = load(sprites / cid / f"chr_{cid}_normal.webp").convert("RGBA")
        if LIST_ONLY:
            save(stand, f"chara/{cid}-bust.webp")
            continue
        left, top, right, bottom = stand.getbbox()
        body_h = bottom - top
        centre = (left + right) // 2
        if cid == "pakki":  # マスコットは全身を入れる
            crop_h, crop_top = round(body_h * 1.08), top - round(body_h * 0.05)
        else:
            crop_h, crop_top = round(body_h * 0.40), top - round(body_h * 0.035)
        crop_w = round(crop_h * 5 / 4)
        frame = Image.new("RGBA", (crop_w, crop_h), (0, 0, 0, 0))
        frame.paste(stand, (crop_w // 2 - centre, -crop_top))
        save(frame, f"chara/{cid}-bust.webp", quality=88)


def build_world() -> None:
    for tone in ("day", "night"):
        save(load(GAME / "backgrounds" / f"bg_osu_map_{tone}.webp").convert("RGB"), f"world/map-{tone}.webp", quality=80)
    previews, logos = spot_previews(), store_logos()
    for name, spot in SHOPS.items():
        file, (x, y, w, h) = logos[spot]
        sheet = load(ROOT / "assets" / "ui" / "store_logos" / f"{file}.webp").convert("RGBA")
        logo = sheet if LIST_ONLY else sheet.crop((x, y, x + w, y + h))
        logo.thumbnail((480, 360), Image.LANCZOS)
        save(logo, f"world/logo-{name}.webp", quality=90)
        room = previews[spot]
        tone = SHOP_TONE.get(name)
        path = GAME / "backgrounds" / f"{room}_{tone}.webp" if tone else GAME / "backgrounds" / f"{room}.webp"
        save(cover(load(path).convert("RGB"), 960, 540), f"world/shop-{name}.webp", quality=78)


def build_gallery() -> None:
    for key, name in GALLERY.items():
        save(fit_width(load(GAME / "cgs" / f"{name}.webp").convert("RGB"), 1600), f"gallery/{key}.webp", quality=78)
        if key in GALLERY_SHELF:  # 場面の棚に並べる分だけ、小さい版も作る
            save(cover(load(GAME / "cgs" / f"{name}.webp").convert("RGB"), 640, 360), f"gallery/{key}-thumb.webp", quality=74)
    save(fit_width(load(GAME / "cgs" / "cg_minto_first_cheki.webp").convert("RGB"), 720), "gallery/minto-cheki.webp", quality=82)


def build_ui() -> None:
    # シーシャ作りの現行スキンのボタンを、そのままの絵で使う
    for tone, rel in craft_buttons().items():
        for key, (width, height) in BUTTON_SIZES.items():
            if (tone, key) == ("white", "s"):  # 小さい白は使っていない
                continue
            button = load(GAME / rel).convert("RGBA")
            # 絵によって周りの光の余白が違う。板の外形で切りそろえ、金と白が同じ大きさに見えるようにする
            box = button.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
            if box and not LIST_ONLY:
                button = button.crop((max(0, box[0] - 3), max(0, box[1] - 3), min(button.width, box[2] + 3), min(button.height, box[3] + 3)))
            save(three_slice(button, width, height, cap=64), f"parts/button-{tone}-{key}.webp", quality=92)


# 「遊びかた」の画面写真: サイトでの名前 → (撮った画面の名前, 幅, 切り出す範囲 0〜1)
# 撮った画面は promo/tools/capture/ のスクリプトが書き出す 2560x1440 の PNG。
SCREENS = {
    "map": ("map_day", 1600, None),
    "map-night": ("map_night", 800, None),
    "talk": ("vn_sumi_tonari", 1600, None),
    "talk-phone": ("phone_lime_minto", 520, (0.355, 0.015, 0.645, 0.985)),
    "craft": ("craft_holes", 1600, None),
    "craft-mix": ("craft_mix", 800, None),
    "craft-coals": ("craft_heat_coals", 800, None),
    "tournament": ("tournament_stage_opening", 1600, None),
    "tournament-vote": ("tournament_standings_round1", 800, None),
    "detour-axe": ("axe_throw_bullseye", 960, None),    # candidates/axe_throw_hit_N から、真ん中に刺さった1枚を選んでこの名前で置く
    "detour-slot": ("slot_pakki_big_bonus", 960, None),  # candidates/reel_big_after_NN から、7が揃った1枚を選んでこの名前で置く
}


SCREEN_SMALL = 1080  # スマホ（幅390前後・3倍の画素）で足りる幅


def build_screens(folder: Path) -> None:
    for name, (source, width, crop) in SCREENS.items():
        path = folder / f"{source}.png"
        if not path.exists():
            print(f"（無いので飛ばす）{path}")
            continue
        shot = Image.open(path).convert("RGB")
        if crop:
            w, h = shot.size
            shot = shot.crop((round(crop[0] * w), round(crop[1] * h), round(crop[2] * w), round(crop[3] * h)))
        sizes = {"": width}
        if width > SCREEN_SMALL:  # 大きい画面写真は、スマホ用の小さい版も作る（index.html の srcset が選ぶ）
            sizes["-s"] = SCREEN_SMALL
        for suffix, size in sizes.items():
            out = fit_width(shot, size)
            target = OUT / "system" / f"{name}{suffix}.webp"
            target.parent.mkdir(parents=True, exist_ok=True)
            out.save(target, "WEBP", quality=80, method=6)
            print(f"system/{name}{suffix}.webp {out.size[0]}x{out.size[1]} {target.stat().st_size / 1024:.1f} KB")


STEPS = {"hero": build_hero, "story": build_story, "cast": build_cast, "world": build_world, "gallery": build_gallery, "ui": build_ui}


# ── 記録・点検・HTMLへの反映 ───────────────────────────────────────

def blob_ids(paths: list[str]) -> dict[str, str]:
    """Git が持っている今の版（blob）。絵の実体を取得していなくても分かる。"""
    if not paths:
        return {}
    listing = subprocess.run(["git", "ls-files", "-s", "--", *paths], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return {line.split("\t", 1)[1]: line.split()[1] for line in listing.splitlines() if "\t" in line}


def write_record(partial: bool) -> None:
    previous = json.loads(RECORD.read_text(encoding="utf-8")) if RECORD.exists() else {"outputs": {}, "sources": {}}
    outputs = {**previous.get("outputs", {}), **records} if partial else dict(records)
    outputs = {rel: sources for rel, sources in outputs.items() if (OUT / rel).exists()}  # 消した絵は記録からも外す
    needed = sorted({src for sources in outputs.values() for src in sources})
    ids = {**blob_ids(needed), **kept}  # 書き出さなかった絵は、書き出したときの版のまま
    data = {
        "note": "promo/tools/build_images.py が書く記録。outputs＝サイトの絵が元にしたゲームの絵、sources＝書き出したときの版（Git の blob）。手で直さない。",
        "outputs": dict(sorted(outputs.items())),
        "sources": {src: ids.get(src, "") for src in needed},
    }
    RECORD.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def check() -> int:
    """採用表と元の絵が、書き出したときから変わっていないか。"""
    global LIST_ONLY
    LIST_ONLY = True
    for step in STEPS.values():
        step()
    recorded = json.loads(RECORD.read_text(encoding="utf-8"))
    problems = []
    for output, sources in sorted(records.items()):
        was = recorded["outputs"].get(output)
        if was is None:
            problems.append(f"まだ書き出していない絵: {output}")
        elif was != sources:
            problems.append(f"採用が変わった: {output}\n    今の採用 {sources}\n    書き出した時 {was}")
    for output in sorted(set(recorded["outputs"]) - set(records)):
        problems.append(f"もう使わない絵が残っている: {output}")
    now = blob_ids(sorted(recorded["sources"]))
    for src, was in sorted(recorded["sources"].items()):
        if src not in now:
            problems.append(f"元の絵が無くなった: {src}")
        elif now[src] != was:
            problems.append(f"元の絵が差し替わった: {src}")
    if problems:
        print("\n".join(problems))
        print(f"\n{len(problems)} 件。python3 promo/tools/build_images.py で書き出し直してください。")
    else:
        print(f"サイトの絵は、ゲームの今の採用（{len(recorded['sources'])} 枚）と一致しています。")
    return len(problems)


def sync_html() -> None:
    """index.html の <img> の width / height を実際の大きさへ、人物の置き方をゲームの登場カットインの数字へ合わせる。"""
    page = PROMO / "index.html"
    html = page.read_text(encoding="utf-8")

    def size(match: re.Match) -> str:
        tag = match.group(0)
        src = re.search(r'\ssrc="(img/[^"?]+)"', tag) or re.search(r'\sdata-src="(img/[^"?]+)"', tag)
        if not src or not (PROMO / src.group(1)).exists():
            return tag
        with Image.open(PROMO / src.group(1)) as image:
            w, h = image.size
        tag = re.sub(r'\s(?:width|height)="\d+"', "", tag)
        return tag[:-1] + f' width="{w}" height="{h}">'

    html = re.sub(r"<img\b[^>]*>", size, html)

    frames = intro_frames()

    def place(match: re.Match) -> str:
        cid, style = match.group(1), match.group(2)
        frame = frames.get(cid)
        if not frame:
            return match.group(0)
        accent = re.search(r"--accent:[^;]+", style).group(0)
        parts = [accent, f"--gw:{frame['width'] / 1280 * 100:.3f}%", f"--gl:{frame['left'] / 1280 * 100:.3f}%", f"--gt:{frame['top'] / 720 * 100:.3f}%"]
        if frame["fade"]:
            parts.append(f"--gfade:{100 - frame['fade']}%")
        if frame["right"]:
            parts.append(f"--gright:{frame['right']}%")
        return f'<article class="cast" id="cast-{cid}" data-cast="{cid}" style="{";".join(parts)}"'

    html = re.sub(r'<article class="cast" id="cast-(\w+)" data-cast="\w+" style="([^"]*)"', place, html)
    page.write_text(html, encoding="utf-8")


def main() -> None:
    global LIST_ONLY
    args = sys.argv[1:]
    if args[:1] == ["screens"] and len(args) >= 2:
        build_screens(Path(args[1]))
        sync_html()
        return
    if args[:1] == ["--check"]:
        sys.exit(1 if check() else 0)
    if args[:1] == ["--sources"]:
        LIST_ONLY = True
        for step in STEPS.values():
            step()
        print("\n".join(sorted(all_sources)))
        return
    unknown = [name for name in args if name not in STEPS]
    if unknown:
        sys.exit(f"知らない指定: {unknown}（使えるのは {', '.join(STEPS)}）")
    for name, step in STEPS.items():
        if not args or name in args:
            step()
    write_record(partial=bool(args))
    sync_html()


if __name__ == "__main__":
    main()
