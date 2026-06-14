#!/usr/bin/env python3
"""第1章ブラウザ版を1ファイルのHTMLにまとめるスクリプト。

画像（背景・立ち絵・CG）を縮小圧縮して data URI として埋め込み、
CSS/JS/データも全てインライン化する。生成物はどこに置いても
ダブルクリックだけで遊べる。

使い方:
    python3 web/build_data.py          # 先にデータバンドルを更新
    python3 web/build_standalone.py    # → web/dist/shisha_ch1.html
"""

import base64
import io
import json
import re
from pathlib import Path

from PIL import Image

WEB_DIR = Path(__file__).resolve().parent
REPO_ROOT = WEB_DIR.parent
OUT_PATH = WEB_DIR / "dist" / "shisha_ch1.html"

# 第1章で使うキャラ（立ち絵を全表情埋め込む）
CH1_PORTRAIT_CHARS = ["hajime", "sumi", "naru", "adam", "minto", "tsumugi", "packii", "rin"]
BG_MAX_W = 1280
PORTRAIT_MAX_H = 900
JPEG_QUALITY = 80


def encode_background(path: Path) -> str:
    """背景は不透明なのでJPEG化して大幅に縮める。"""
    im = Image.open(path).convert("RGB")
    if im.width > BG_MAX_W:
        im = im.resize((BG_MAX_W, round(im.height * BG_MAX_W / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def encode_portrait(path: Path) -> str:
    """立ち絵は透過が必要なので減色PNGにする。"""
    im = Image.open(path).convert("RGBA")
    if im.height > PORTRAIT_MAX_H:
        im = im.resize((round(im.width * PORTRAIT_MAX_H / im.height), PORTRAIT_MAX_H), Image.LANCZOS)
    im = im.quantize(colors=256, method=Image.FASTOCTREE)
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def encode_png_asset(path: Path, max_w: int = BG_MAX_W) -> str:
    """作業台UIなど透過があり得るPNG素材を埋め込む。"""
    im = Image.open(path).convert("RGBA")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def collect_assets() -> dict:
    assets = {}
    # タイトルロゴ（煙のグラデーションを潰さないよう減色なしの透過PNG）
    logo = REPO_ROOT / "assets" / "ui" / "ui_title_logo.png"
    if logo.exists() and logo.stat().st_size > 0:
        im = Image.open(logo).convert("RGBA")
        if im.width > 1200:
            im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "PNG", optimize=True)
        assets["assets/ui/ui_title_logo.png"] = (
            "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        )
    # タイトル用キービジュアル: assets/ui/title_arts/*.png
    arts_dir = REPO_ROOT / "assets" / "ui" / "title_arts"
    if arts_dir.exists():
        for png in sorted(arts_dir.glob("*.png")):
            if png.stat().st_size == 0:
                continue
            im = Image.open(png).convert("RGB")
            if im.width > BG_MAX_W:
                im = im.resize((BG_MAX_W, round(im.height * BG_MAX_W / im.width)), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True)
            assets[f"assets/ui/title_arts/{png.name}"] = (
                "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
            )
    # 背景: ゲームから参照されうるものを全て
    # アルミ穴あけのテクスチャ（あれば埋め込み）
    foil = REPO_ROOT / "assets" / "ui" / "foil_taut.png"
    if foil.exists():
        assets["assets/ui/foil_taut.png"] = encode_background(foil)
    making_dir = REPO_ROOT / "assets" / "ui" / "making"
    if making_dir.exists():
        for png in sorted(making_dir.glob("*.png")):
            if png.stat().st_size == 0:
                continue
            assets[f"assets/ui/making/{png.name}"] = encode_png_asset(png)
    for png in sorted((REPO_ROOT / "assets" / "backgrounds").glob("*.png")):
        assets[f"assets/backgrounds/{png.name}"] = encode_background(png)
    # CG: show_cg 対象（恋愛・日常スチル含む全部。素材が増えたらそのまま乗る）
    for png in sorted((REPO_ROOT / "assets" / "cgs").glob("cg_*.png")):
        assets[f"assets/cgs/{png.name}"] = encode_background(png)
    # 立ち絵
    for char in CH1_PORTRAIT_CHARS:
        char_dir = REPO_ROOT / "assets" / "sprites" / "characters" / char
        for png in sorted(char_dir.glob("chr_*.png")):
            assets[f"assets/sprites/characters/{char}/{png.name}"] = encode_portrait(png)
    return assets


BGM_FILES = {"daily_part": "daily_part.mp3", "tonari": "tonari.mp3", "title": "title.mp3"}
BGM_MAX_BYTES = 1_200_000  # 1曲あたり約75秒で切ってループさせる


def encode_bgm() -> dict:
    """mp3をフレーム境界を気にせず先頭から切り出して埋め込む。
    （CBR mp3はデコーダが末尾の欠けを許容するため実用上問題ない）"""
    out = {}
    for key, name in BGM_FILES.items():
        path = REPO_ROOT / "assets" / "audio" / "bgm" / name
        if not path.exists() or path.stat().st_size == 0:
            continue
        data = path.read_bytes()[:BGM_MAX_BYTES]
        out[key] = "data:audio/mpeg;base64," + base64.b64encode(data).decode()
    return out


def inline_css(assets: dict) -> str:
    css = (WEB_DIR / "css" / "style.css").read_text(encoding="utf-8")

    def repl(m):
        rel = m.group(1)
        return f'url("{assets.get(rel, "../../" + rel)}")'

    return re.sub(r'url\("\.\./\.\./(assets/[^"]+)"\)', repl, css)


def main() -> None:
    assets = collect_assets()
    bgm = encode_bgm()
    html = (WEB_DIR / "index.html").read_text(encoding="utf-8")
    data_js = (WEB_DIR / "js" / "data.js").read_text(encoding="utf-8")
    sfx_js = (WEB_DIR / "js" / "sfx.js").read_text(encoding="utf-8")
    engine_js = (WEB_DIR / "js" / "engine.js").read_text(encoding="utf-8")
    reel_js = (WEB_DIR / "js" / "reel.js").read_text(encoding="utf-8")
    game_js = (WEB_DIR / "js" / "game.js").read_text(encoding="utf-8")

    asset_js = "window.ASSET_DATA = " + json.dumps(assets) + ";"
    bgm_js = "window.BGM_DATA = " + json.dumps(bgm) + ";"
    html = html.replace(
        '<link rel="stylesheet" href="css/style.css">',
        "<style>\n" + inline_css(assets) + "\n</style>",
    )
    html = html.replace(
        '<script src="js/data.js"></script>\n'
        '<script src="js/sfx.js"></script>\n'
        '<script src="js/engine.js"></script>\n'
        '<script src="js/reel.js"></script>\n'
        '<script src="js/game.js"></script>',
        "<script>\n" + asset_js + "\n" + bgm_js + "\n" + data_js + "\n</script>\n"
        "<script>\n" + sfx_js + "\n</script>\n"
        "<script>\n" + engine_js + "\n</script>\n"
        "<script>\n" + reel_js + "\n</script>\n"
        "<script>\n" + game_js + "\n</script>",
    )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(html, encoding="utf-8")
    size_mb = OUT_PATH.stat().st_size / 1024 / 1024
    print(f"wrote {OUT_PATH} ({size_mb:.1f} MB, assets: {len(assets)})")


if __name__ == "__main__":
    main()
