#!/usr/bin/env python3
"""ブラウザ版・第1章用のデータバンドル生成スクリプト。

リポジトリの data/ 配下のJSONを読み込み、web/js/data.js
（window.GAME_DATA）として書き出す。file:// で直接開いても
動くように、fetch ではなく <script> 読み込みでデータを渡す。

使い方:
    python3 web/build_data.py
"""

import json
import re
from pathlib import Path

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
    "ch1_spots.json",
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


def collect_portraits() -> dict:
    """assets/sprites/characters/ を走査して {char_id: [face,...]} を返す。"""
    portraits = {}
    chars_dir = REPO_ROOT / "assets" / "sprites" / "characters"
    for char_dir in sorted(chars_dir.iterdir()):
        if not char_dir.is_dir():
            continue
        faces = []
        prefix = f"chr_{char_dir.name}_"
        for png in sorted(char_dir.glob("chr_*.png")):
            m = re.match(re.escape(prefix) + r"(.+)\.png$", png.name)
            if m:
                faces.append(m.group(1))
        if faces:
            portraits[char_dir.name] = faces
    return portraits


def collect_backgrounds() -> list:
    bg_dir = REPO_ROOT / "assets" / "backgrounds"
    return sorted(p.name for p in bg_dir.glob("*.png"))


def main() -> None:
    flavors = load_json(DATA_DIR / "flavors.json")["flavors"]
    baito = load_json(DATA_DIR / "baito_events.json")
    characters = load_json(DATA_DIR / "characters.json")

    char_names = {}
    char_list = characters if isinstance(characters, list) else characters.get("characters", [])
    for c in char_list:
        if isinstance(c, dict) and "id" in c:
            char_names[c["id"]] = c.get("name", c["id"])

    bundle = {
        "dialogues": collect_dialogues(),
        "flavors": flavors,
        "baito_settings": baito.get("baito_settings", {}),
        "baito_events": [
            e for e in baito.get("events", []) if e.get("category") in BAITO_CATEGORIES
        ],
        "char_names": char_names,
        "portraits": collect_portraits(),
        "backgrounds": collect_backgrounds(),
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
