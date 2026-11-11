#!/usr/bin/env python3
"""公式サイト用の画像を、ゲームの採用済み素材から書き出す。

リポジトリのルートで実行する:
    python3 promo/tools/build_images.py

- 入力はゲームが実際に使っている絵（remake/img/・assets/ui/store_logos/）。絵そのものは描き変えず、
  大きさと圧縮だけをサイト向けに整える。ゲーム側の絵を差し替えたら、もう一度実行すれば追従する。
- 入力が Git LFS のポインタ（131バイトのテキスト）のままなら、そのファイル名を表示して止まる。
  `git lfs pull --include="<パス>"` で必要な分だけ取得してから実行し直す。
- 出力は promo/img/。サイトは promo/ の中だけで完結し、ゲームのフォルダを参照しない。
- 「遊びかた」の画面写真だけは別: python3 promo/tools/build_images.py screens <撮った画面のフォルダ>
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "promo" / "img"
GAME = ROOT / "remake" / "img"

# ヒーローで順に見せるキービジュアル。タイトル画面と同じ、オーナー選定の1キャラ1枚
# （remake/js/core/title-art-unlock.js の TITLE_KEY_VISUALS）。第3章で出会うましろは載せない。
KEY_VISUALS = {
    "minto": "title_art_minto_05_mint_cloud",
    "tsumugi": "title_art_tsumugi_04_painting_studio",
    "sumi": "title_art_sumi_01_own_clay_bowl",
    "rio": "title_art_rio_04_rainy_neon_umbrella",
    "naru": "title_art_naru_01_bakery_morning",
    "hiyori": "title_art_hiyori_06_riverside_hoodie",
    "samechan": "title_art_samechan_04_throne_pose",
    "adam": "title_art_adam_01_sunset_proclamation",
    "ageha": "title_art_ageha_04_gummy_light",
}

# 人物紹介に出す人（第1〜2章で出会う人だけ。docs/marketing/sns_operation.md の出す順番に合わせる）
CAST_MAIN = ["hajime", "sumi", "naru", "adam", "minto", "tsumugi", "rio", "hiyori", "samechan", "ageha", "kumicho", "rei"]
CAST_SUB = ["pakki", "sui", "dr_kemuri", "maezono"]

# 店ロゴの採用部分（remake/js/core/store-logos.js の frame と同じ数字）
STORE_LOGOS = {
    "tonari": ("tonari", (812, 15, 551, 684)),
    "kemurikusa": ("kemurikusa", (45, 240, 736, 248)),
    "eden": ("eden", (36, 53, 605, 719)),
    "peppermint": ("peppermint", (772, 242, 640, 231)),
    "dr-fookah": ("dr-fookah", (1337, 281, 662, 260)),
    "c-station": ("c-station", (1533, 157, 481, 440)),
}

SHOP_INTERIORS = {
    "tonari": "bg_tonari_inside_night",
    "kemurikusa": "kemurikusa",
    "eden": "eden",
    "peppermint": "peppermint",
    "dr-fookah": "bg_shop",
    "c-station": "bg_c_station_night",
}

GALLERY = {
    "sumi-training": "cg_ch1_sumi_training",
    "tournament": "cg_ch1_tournament_battle",
    "tsumugi-sketch": "cg_ch1_tsumugi_sketch_wip",
    "tsumugi-smoke": "cg_tsumugi_smoke_color",
}


def load(path: Path) -> Image.Image:
    if not path.exists():
        sys.exit(f"入力がありません: {path.relative_to(ROOT)}")
    if path.stat().st_size < 200:
        sys.exit(
            f"Git LFS のポインタのままです: {path.relative_to(ROOT)}\n"
            f"  git lfs pull --include=\"{path.relative_to(ROOT)}\" を実行してからやり直してください。"
        )
    image = Image.open(path)
    image.load()
    return image


def save(image: Image.Image, rel: str, quality: int = 80, lossless: bool = False) -> None:
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


def build_hero() -> None:
    # タイトル画面の背景（1280x720のドット絵）。ぼかさず整数倍に拡大して、ドットの角を保つ。
    lounge = load(GAME / "backgrounds" / "bg_title.webp").convert("RGB")
    save(lounge.resize((2560, 1440), Image.NEAREST), "hero/lounge.webp", quality=76)
    save(lounge.resize((1280, 720), Image.NEAREST), "hero/lounge-s.webp", quality=74)
    for cid, name in KEY_VISUALS.items():
        art = load(GAME / "ui" / "title_arts" / f"{name}.webp").convert("RGB")
        save(art, f"hero/kv-{cid}.webp", quality=80)
        save(cover(art, 144, 192, focus=(0.5, 0.18)), f"hero/kv-{cid}-thumb.webp", quality=78)
    logo = load(GAME / "ui" / "ui_title_logo_rich.webp").convert("RGBA")
    save(logo, "logo.webp", quality=84)
    save(fit_width(logo, 640), "logo-s.webp", quality=88)


def build_story() -> None:
    for cid in ["minto", "adam", "naru", "tsumugi", "sumi", "hajime"]:
        walk = load(GAME / "ui" / "chapters" / "ch1" / f"{cid}.webp").convert("RGBA")
        # 小さなドット絵なので、整数倍に拡大してから保存する（表示時にぼけない）
        save(walk.resize((walk.width * 2, walk.height * 2), Image.NEAREST), f"story/walk-{cid}.webp", lossless=True)
    save(load(GAME / "ui" / "chapters" / "ch2-title.webp").convert("RGB"), "story/ch2-title.webp", quality=80)
    for n in (1, 2):
        save(load(GAME / "ui" / "poems" / f"poem_ch{n}.webp").convert("RGB"), f"story/strip-ch{n}.webp", quality=80)
    save(fit_width(load(GAME / "backgrounds" / "bg_tonari_inside_night.webp").convert("RGB"), 1920), "story/tonari-night.webp", quality=74)
    save(fit_width(load(GAME / "backgrounds" / "bg_street_night.webp").convert("RGB"), 1920), "story/street-night.webp", quality=74)
    save(fit_width(load(GAME / "backgrounds" / "bg_tournament_stage.webp").convert("RGB"), 1920), "story/stage.webp", quality=74)


def build_cast() -> None:
    intro = GAME / "ui" / "character_intros" / "graphic"
    sprites = GAME / "sprites" / "character_variants" / "new"
    faces = GAME / "ui" / "face_icons" / "new"
    for cid in CAST_MAIN + CAST_SUB:
        stand = load(sprites / cid / f"chr_{cid}_normal.webp").convert("RGBA")
        save(stand, f"chara/{cid}-stand.webp", quality=86)
        save(load(faces / f"face_{cid}.webp").convert("RGBA"), f"chara/{cid}-face.webp", quality=88)
    for cid in CAST_MAIN:
        graphic = load(intro / f"{cid}.webp").convert("RGBA")
        save(fit_width(graphic, 880), f"chara/{cid}-graphic.webp", quality=84)
        backdrop = load(intro / f"bg_{cid}.webp").convert("RGB")
        save(fit_width(backdrop, 1600), f"chara/{cid}-bg.webp", quality=76)


def build_world() -> None:
    for tone in ("day", "night"):
        town = load(GAME / "backgrounds" / f"bg_osu_map_{tone}.webp").convert("RGB")
        save(town, f"world/map-{tone}.webp", quality=80)
    for key, (file, (x, y, w, h)) in STORE_LOGOS.items():
        sheet = load(ROOT / "assets" / "ui" / "store_logos" / f"{file}.webp").convert("RGBA")
        logo = sheet.crop((x, y, x + w, y + h))
        logo.thumbnail((480, 360), Image.LANCZOS)
        save(logo, f"world/logo-{key}.webp", quality=90)
    for key, name in SHOP_INTERIORS.items():
        room = load(GAME / "backgrounds" / f"{name}.webp").convert("RGB")
        save(cover(room, 960, 540), f"world/shop-{key}.webp", quality=76)


def build_gallery() -> None:
    for key, name in GALLERY.items():
        still = load(GAME / "cgs" / f"{name}.webp").convert("RGB")
        save(fit_width(still, 1600), f"gallery/{key}.webp", quality=78)
        save(cover(still, 640, 360), f"gallery/{key}-thumb.webp", quality=74)
    cheki = load(GAME / "cgs" / "cg_minto_first_cheki.webp").convert("RGB")
    save(fit_width(cheki, 720), "gallery/minto-cheki.webp", quality=82)


def three_slice(source: Image.Image, width: int, height: int, cap: int) -> Image.Image:
    """ボタンの絵を、角と縁の形を保ったまま横だけ伸ばして指定の大きさにする。

    ブラウザの九分割（border-image）は、位置が半端な画素になると継ぎ目に細い線が出る。
    そこで、使う大きさごとに1枚の絵へ仕上げてから置く。cap は元の絵で両端として残す幅。
    """
    scale = height / source.height
    scaled = source.resize((round(source.width * scale), height), Image.LANCZOS)
    edge = round(cap * scale)
    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    out.paste(scaled.crop((0, 0, edge, height)), (0, 0))
    out.paste(scaled.crop((scaled.width - edge, 0, scaled.width, height)), (width - edge, 0))
    middle = scaled.crop((edge, 0, scaled.width - edge, height)).resize((width - edge * 2, height), Image.LANCZOS)
    out.paste(middle, (edge, 0))
    return out


# ボタンの大きさ（表示の2倍で作る）。CSS の .btn / .btn-l / .head-play / .btn-wide と同じ比率
BUTTON_SIZES = {"m": (368, 120), "l": (496, 148), "s": (216, 92), "wide": (664, 120)}


def build_ui() -> None:
    # ゲームのUI「紙とラベンダー」のボタンを、そのままの絵で使う
    for tone in ("amber", "paper"):
        button = load(GAME / "ui" / "craft-paper" / f"button-{tone}.webp").convert("RGBA")
        for key, (width, height) in BUTTON_SIZES.items():
            save(three_slice(button, width, height, cap=72), f"parts/button-{tone}-{key}.webp", quality=92)


def build_busts() -> None:
    """大会の人びとの欄に置く、立ち絵の胸から上。"""
    sprites = GAME / "sprites" / "character_variants" / "new"
    for cid in CAST_SUB:
        stand = load(sprites / cid / f"chr_{cid}_normal.webp").convert("RGBA")
        left, top, right, bottom = stand.getbbox()
        body_h = bottom - top
        centre = (left + right) // 2
        if cid == "pakki":  # マスコットは全身を入れる
            crop_h = round(body_h * 1.08)
            crop_top = top - round(body_h * 0.05)
        else:
            crop_h = round(body_h * 0.40)
            crop_top = top - round(body_h * 0.035)
        crop_w = round(crop_h * 5 / 4)
        frame = Image.new("RGBA", (crop_w, crop_h), (0, 0, 0, 0))
        frame.paste(stand, (crop_w // 2 - centre, -crop_top))
        scale = 2 if crop_h < 520 else 1
        if scale > 1:  # ドット絵は整数倍で大きくして角を保つ
            frame = frame.resize((crop_w * scale, crop_h * scale), Image.NEAREST)
        save(frame, f"chara/{cid}-bust.webp", quality=88)


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
        save(fit_width(shot, width), f"system/{name}.webp", quality=80)


def main() -> None:
    if len(sys.argv) >= 3 and sys.argv[1] == "screens":
        build_screens(Path(sys.argv[2]))
        return
    only = set(sys.argv[1:])
    steps = {"hero": build_hero, "story": build_story, "cast": build_cast, "world": build_world,
             "gallery": build_gallery, "ui": build_ui, "busts": build_busts}
    for name, step in steps.items():
        if not only or name in only:
            step()


if __name__ == "__main__":
    main()
