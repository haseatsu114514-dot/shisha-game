#!/usr/bin/env python3
"""ブラウザ版・第1章用のデータバンドル生成スクリプト。

リポジトリの data/ 配下のJSONを読み込み、web/js/data.js
（window.GAME_DATA）として書き出す。file:// で直接開いても
動くように、fetch ではなく <script> 読み込みでデータを渡す。

使い方:
    python3 web/build_data.py
"""

import base64
import json
import re
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
OUT_PATH = Path(__file__).resolve().parent / "js" / "data.js"

CH1_DIALOGUE_FILES = [
    "ch1_main.json",
    "ch1_tournament.json",
    "ch1_naru.json",
    "ch1_adam.json",
    "ch1_minto.json",
    "ch1_tsumugi.json",
    "ch1_sumi.json",
    "ch1_rin.json",
    "ch1_spots.json",
    "ch1_events.json",
    "ch2_main.json",
    "ch2_isolation.json",
    "confession.json",
]

# ch1 のバイトで使うイベントカテゴリ（story は章進行に紐づくため除外）
BAITO_CATEGORIES = ["beginner", "mob", "atmosphere", "regular", "rush", "trouble"]


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def collect_dialogues() -> dict:
    dialogues = {}
    for name in CH1_DIALOGUE_FILES:
        data = load_json(DATA_DIR / "dialogue" / name)
        for d in data.get("dialogues", []):
            dialogues[d["dialogue_id"]] = d
    return dialogues


def portrait_trim(png: Path):
    """透過余白を測り、立ち絵の実体サイズを正規化するための値を返す。

    h: 画像高さに対する実コンテンツの高さ比 / b: 下端の余白比
    l: 左端の余白比 / w: 実コンテンツの幅比
    （キャラごとの余白差で見かけサイズがズレるのを補正する。
     l/w はタイトル等の「アートウィンドウ」での切り出しに使う）
    """
    if Image is None:
        return None
    try:
        im = Image.open(png).convert("RGBA")
        bbox = im.getbbox()
        if not bbox:
            return None
        left, top, right, bottom = bbox
        return {
            "h": round((bottom - top) / im.height, 3),
            "b": round((im.height - bottom) / im.height, 3),
            "l": round(left / im.width, 3),
            "w": round((right - left) / im.width, 3),
        }
    except OSError:
        return None


def collect_portraits() -> tuple[dict, dict]:
    """assets/sprites/characters/ を走査して
    ({char_id: [face,...]}, {char_id: {face: trim}}) を返す。"""
    portraits = {}
    trims = {}
    chars_dir = REPO_ROOT / "assets" / "sprites" / "characters"
    for char_dir in sorted(chars_dir.iterdir()):
        if not char_dir.is_dir():
            continue
        faces = []
        face_trims = {}
        prefix = f"chr_{char_dir.name}_"
        for png in sorted(char_dir.glob("chr_*.png")):
            m = re.match(re.escape(prefix) + r"(.+)\.png$", png.name)
            if m:
                faces.append(m.group(1))
                t = portrait_trim(png)
                if t:
                    face_trims[m.group(1)] = t
        if faces:
            portraits[char_dir.name] = faces
            trims[char_dir.name] = face_trims
    return portraits, trims


def collect_backgrounds() -> list:
    bg_dir = REPO_ROOT / "assets" / "backgrounds"
    return sorted(p.name for p in bg_dir.glob("*.png"))


def collect_cgs() -> list:
    """存在するCGのid一覧。show_cg は素材が届くまで何も表示しない設計のため、
    エンジンがこのリストで存在チェックする（404ノイズ防止）。"""
    cg_dir = REPO_ROOT / "assets" / "cgs"
    return sorted(p.stem for p in cg_dir.glob("cg_*.png") if p.stat().st_size > 0)


def collect_face_icons() -> dict:
    """assets/ui/face_icons/face_{id}.png（顔ドット絵）を data URI で埋め込む。
    生成は tools/make_face_icons.py。1枚3〜5KBなので直接バンドルする。"""
    icons = {}
    icons_dir = REPO_ROOT / "assets" / "ui" / "face_icons"
    if not icons_dir.exists():
        return icons
    for png in sorted(icons_dir.glob("face_*.png")):
        cid = png.stem[len("face_"):]
        icons[cid] = "data:image/png;base64," + base64.b64encode(png.read_bytes()).decode()
    return icons


def collect_title_arts() -> list:
    """assets/ui/title_arts/ にある専用キービジュアル一覧。
    タイトルが起動時にここからランダムに1枚選んで表示する。
    画像が無ければ空配列 → タイトルはキャラランダム表示にフォールバック"""
    arts_dir = REPO_ROOT / "assets" / "ui" / "title_arts"
    if not arts_dir.exists():
        return []
    return sorted(p.name for p in arts_dir.glob("*.png") if p.stat().st_size > 0)


def main() -> None:
    flavors = load_json(DATA_DIR / "flavors.json")["flavors"]
    baito = load_json(DATA_DIR / "baito_events.json")
    characters = load_json(DATA_DIR / "characters.json")
    equipment = [
        e for e in load_json(DATA_DIR / "equipment.json")["equipment"]
        if e.get("chapter_min", 1) <= 1
    ]

    char_names = {}
    char_list = characters if isinstance(characters, list) else characters.get("characters", [])
    for c in char_list:
        if isinstance(c, dict) and "id" in c:
            char_names[c["id"]] = c.get("name", c["id"])

    portraits, portrait_trims = collect_portraits()
    bundle = {
        "dialogues": collect_dialogues(),
        "flavors": flavors,
        "equipment": equipment,
        "baito_settings": baito.get("baito_settings", {}),
        "baito_events": [
            e for e in baito.get("events", []) if e.get("category") in BAITO_CATEGORIES
        ],
        "char_names": char_names,
        "portraits": portraits,
        "portrait_trims": portrait_trims,
        "backgrounds": collect_backgrounds(),
        "cgs": collect_cgs(),
        "title_arts": collect_title_arts(),
        "face_icons": collect_face_icons(),
        "lime_messages": load_json(DATA_DIR / "lime_messages.json")["messages"],
        "glossary": load_json(DATA_DIR / "glossary.json")["groups"],
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    js = "// 自動生成ファイル。編集しないこと。再生成: python3 web/build_data.py\n"
    js += "window.GAME_DATA = "
    js += json.dumps(bundle, ensure_ascii=False, separators=(",", ":"))
    js += ";\n"
    OUT_PATH.write_text(js, encoding="utf-8")
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes)")
    print(f"  dialogues: {len(bundle['dialogues'])}")
    print(f"  baito_events: {len(bundle['baito_events'])}")
    print(f"  flavors: {len(bundle['flavors'])}")


if __name__ == "__main__":
    main()
