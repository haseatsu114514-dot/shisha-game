#!/usr/bin/env python3
"""会話 JSON の speaker ID を characters.json と突き合わせる検証ツール。

lint_dialogue.py の speaker 検査をさらに拡張し、
全 speaker ID が characters.json に定義されていることを一覧で確認する。

使い方:
    python3 tools/check_speakers.py             # 全ファイル走査
    python3 tools/check_speakers.py ch1_main    # 部分一致でファイル指定
"""

import json
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DLG_DIR = REPO / "data" / "dialogue"
CHARS_FILE = REPO / "data" / "characters.json"

MOB_SPEAKERS = {"", "???", "customer", "everyone", "old_man", "shop_clerk",
                "staff_choizap", "oneesan", "tumugi", "hazime"}


def load_characters() -> dict:
    data = json.loads(CHARS_FILE.read_text(encoding="utf-8"))
    chars = data if isinstance(data, list) else data.get("characters", [])
    return {c["id"]: c.get("name", c["id"]) for c in chars if isinstance(c, dict) and "id" in c}


def collect_speakers(filt: str | None) -> dict[str, Counter]:
    files = sorted(p for p in DLG_DIR.glob("*.json") if not filt or filt in p.name)
    file_speakers: dict[str, Counter] = {}

    for path in files:
        counter = Counter()
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue

        for dlg in data.get("dialogues", []) or []:
            for ln in dlg.get("lines", []) or []:
                if isinstance(ln, dict) and "speaker" in ln:
                    counter[ln["speaker"]] += 1
            for branch_lines in (dlg.get("branches") or {}).values():
                for ln in branch_lines or []:
                    if isinstance(ln, dict) and "speaker" in ln:
                        counter[ln["speaker"]] += 1

        file_speakers[path.name] = counter

    return file_speakers


def main() -> int:
    filt = sys.argv[1] if len(sys.argv) > 1 else None
    char_ids = load_characters()
    valid_ids = set(char_ids.keys()) | MOB_SPEAKERS
    file_speakers = collect_speakers(filt)

    if not file_speakers:
        print(f"対象ファイルなし（filter={filt!r}）")
        return 1

    errors = []
    all_speakers: Counter = Counter()

    for fname, counter in sorted(file_speakers.items()):
        for sp, count in counter.most_common():
            all_speakers[sp] += count
            if sp not in valid_ids:
                errors.append(f"  {fname}: 未登録 speaker '{sp}' ({count}回)")

    if errors:
        print(f"❌ ERROR: 未登録の speaker ID ({len(errors)}件)")
        for e in errors:
            print(e)
        print()
        print("characters.json に追加するか、MOB_SPEAKERS に登録してください。")
        return 1

    print(f"✅ OK — 全 speaker ID が登録済み")
    print(f"   ファイル数: {len(file_speakers)}")
    print(f"   ユニーク speaker: {len(all_speakers)}")
    unique = sorted(all_speakers.keys())
    registered = [s for s in unique if s in char_ids]
    mob = [s for s in unique if s in MOB_SPEAKERS and s]
    print(f"   characters.json 登録: {', '.join(registered)}")
    if mob:
        print(f"   モブ/特殊: {', '.join(mob)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
