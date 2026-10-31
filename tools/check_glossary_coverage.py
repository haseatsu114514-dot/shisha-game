#!/usr/bin/env python3
"""用語集カバレッジチェック（#1915）。

data/dialogue/*.json（直下のみ。_legacy は対象外）の台詞テキストに現れるカタカナ語を数え、
data/glossary.json に収録されていない頻出語を一覧にする。
用語集へ足すべき語の棚卸し用で、CI の quick には入れない（手動実行専用）。

使い方:
    python3 tools/check_glossary_coverage.py [--top N] [--min-count N]

- カタカナ語は「ァ-ヶー」の連続（2文字以上）を1語として数える。
- 用語集の term は括弧書き（読み・英字）を除いた本体と、括弧内も収録語として扱う。
- 出力は未収録語を出現数の多い順に表示するだけ。判定（追加すべきか）は人間が行う。
"""
import argparse
import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KATAKANA_RUN = re.compile(r"[ァ-ヶー]{2,}")
PAREN = re.compile(r"[（(]([^）)]+)[）)]")


def iter_strings(node):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for value in node.values():
            yield from iter_strings(value)
    elif isinstance(node, list):
        for value in node:
            yield from iter_strings(value)


def glossary_words():
    data = json.loads((ROOT / "data" / "glossary.json").read_text(encoding="utf-8"))
    words = set()
    for group in data.get("groups", []):
        for entry in group.get("terms", []):
            term = entry.get("term", "")
            words.add(PAREN.sub("", term).strip())
            for inner in PAREN.findall(term):
                words.add(inner.strip())
    return words


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--top", type=int, default=40, help="表示する未収録語の件数（既定40）")
    parser.add_argument("--min-count", type=int, default=3, help="この出現数未満は表示しない（既定3）")
    args = parser.parse_args()

    known = glossary_words()
    counts = collections.Counter()
    dialogue_dir = ROOT / "data" / "dialogue"
    files = sorted(dialogue_dir.glob("*.json"))
    for path in files:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            print(f"warn: {path.relative_to(ROOT)} を読めませんでした: {exc}", file=sys.stderr)
            continue
        for text in iter_strings(data):
            for word in KATAKANA_RUN.findall(text):
                counts[word] += 1

    missing = [(w, c) for w, c in counts.most_common() if w not in known and c >= args.min_count]
    print(f"dialogue files: {len(files)} / katakana words: {len(counts)} / glossary terms: {len(known)}")
    print(f"未収録の頻出カタカナ語（出現数 >= {args.min_count}、上位 {args.top} 件）:")
    for word, count in missing[: args.top]:
        print(f"  {count:5d}  {word}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
