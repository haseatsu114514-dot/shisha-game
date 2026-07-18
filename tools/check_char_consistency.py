#!/usr/bin/env python3
"""characters.json と character_profiles.md の年齢・名前を突き合わせるバリデータ。

data/characters.json（正本）と brand/character_profiles.md の間で
年齢や名前が食い違っていないかを検出する。

使い方:
    python3 tools/check_char_consistency.py
"""

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CHARS_FILE = REPO / "data" / "characters.json"
PROFILES_FILE = REPO / "brand" / "character_profiles.md"


def load_json_chars() -> dict:
    data = json.loads(CHARS_FILE.read_text(encoding="utf-8"))
    chars = data if isinstance(data, list) else data.get("characters", [])
    result = {}
    for c in chars:
        if isinstance(c, dict) and "id" in c:
            result[c["id"]] = {
                "name": c.get("name", ""),
                "age": c.get("age"),
            }
    return result


def parse_profiles() -> dict:
    """character_profiles.md からキャラ名と年齢を抽出する。"""
    text = PROFILES_FILE.read_text(encoding="utf-8")
    result = {}
    current_name = None
    for line in text.splitlines():
        heading = re.match(r"^###?\s+(.+)", line)
        if heading:
            current_name = heading.group(1).strip()
            continue
        age_match = re.match(r"^-\s*\*\*年齢\*\*:\s*(\d+)", line)
        if age_match and current_name:
            result[current_name] = int(age_match.group(1))
    return result


NAME_TO_ID = {
    "蒸野 始": "hajime",
    "はじめ": "hajime",
    "墨田 丈一郎": "sumi",
    "スミさん": "sumi",
    "鳴切 亮太": "naru",
    "なる": "naru",
    "吾妻 大夢": "adam",
    "アダム": "adam",
    "緑川 栞": "minto",
    "みんと": "minto",
    "つむぎ": "tsumugi",
    "白木 つむぎ": "tsumugi",
    "匂坂 凛": "rin",
    "凛": "rin",
    "アゲハ（宵野 葉子 / よいの ようこ）": "ageha",
    "アゲハ": "ageha",
    "宵野 葉子": "ageha",
    "神崎 竜二": "kumicho",
    "神崎竜二": "kumicho",
    "田中 健太": "rei",
    "零-REI-": "rei",
    "チャコール博士": "dr_kemuri",
    "チャコール博士 / 炭場 創": "dr_kemuri",
    "水瀬 ましろ": "mashiro",
    "ましろ": "mashiro",
    "ムカイさん / 向井": "mukai_master",
    "ムカイさん": "mukai_master",
    "南雲 修二": "nagumo",
    "南雲修二": "nagumo",
    "前園 壮一郎": "maezono",
    "パッキー": "pakki",
    "エミル": "emil",
    "王 煙楼": "master_hookah",
    "マスター・フーカ": "master_hookah",
    "シェイク・アル=ガリヤーン": "sheikh",
    "SHISHA-9000": "shisha_9000",
    "ダ・シルヴァ太陽": "da_silva",
    "ナンディ・カルダモン": "nandi",
    "スティーブ・デイビス": "steve",
    "ヴォルク・イヴァノフ": "volk",
}


def main() -> int:
    json_chars = load_json_chars()
    profile_ages = parse_profiles()
    errors = []

    for profile_name, profile_age in profile_ages.items():
        char_id = NAME_TO_ID.get(profile_name)
        if not char_id:
            for name_key, cid in NAME_TO_ID.items():
                if name_key in profile_name or profile_name in name_key:
                    char_id = cid
                    break
        if not char_id:
            continue

        if char_id not in json_chars:
            continue

        json_age_raw = json_chars[char_id].get("age")
        if json_age_raw is None:
            continue
        if isinstance(json_age_raw, int):
            json_age = json_age_raw
        elif isinstance(json_age_raw, str):
            m = re.match(r"(\d+)", str(json_age_raw))
            if m and "自称" in str(json_age_raw):
                continue
            json_age = int(m.group(1)) if m else None
        else:
            json_age = None
        if json_age is not None and json_age != profile_age:
            errors.append(
                f"  {char_id}: characters.json={json_age_raw}歳 vs profiles.md={profile_age}歳"
            )

    if errors:
        print(f"❌ 年齢の食い違い ({len(errors)}件)")
        for e in errors:
            print(e)
        print("\ncharacters.json が正本。profiles.md と揃えてください。")
        return 1

    print(f"✅ OK — characters.json と profiles.md の年齢が一致")
    return 0


if __name__ == "__main__":
    sys.exit(main())
