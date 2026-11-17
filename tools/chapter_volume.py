#!/usr/bin/env python3
"""章ごとの台詞ボリュームを測る（#3097・#3726 A-3 の物差し）。

数え方（#3097 の 2026-11-17 の集計と同じ）:
- 対象は data/dialogue/ の、名前が chN または remake_chN で始まる JSON。
  LIME（lime_*）や章の接頭辞の無いファイルは数えない。
- ファイル内のすべての "text" の文字列を、空白（改行・全角空白を含む）を抜いて数える。
- 章はファイル名の接頭辞で決める（場面 ID の中身では付け替えない）。

目標（オーナー決定 RLS03・2026-11-17）: 第2〜4章を第1章の量にそろえる。第5章は増やさない。

使い方:
  python3 tools/chapter_volume.py              # 作業ツリーを数える
  python3 tools/chapter_volume.py --ref origin/main
  python3 tools/chapter_volume.py --json       # 機械向け
  python3 tools/chapter_volume.py --files      # ファイル別の内訳も出す
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIALOGUE_DIR = "data/dialogue"
FILE_RE = re.compile(r"^(?:remake_)?ch(\d)")
SPACE_RE = re.compile(r"\s")
# 第1章を基準に、第1章の量へそろえる章（RLS03）。第5章は目標なし。
TARGET_CHAPTERS = (2, 3, 4)


def chapter_of(name: str) -> int | None:
    """ファイル名（拡張子なし）から章番号を返す。数えないファイルは None。"""
    m = FILE_RE.match(name)
    return int(m.group(1)) if m else None


def count_text(node) -> int:
    """JSON のどこにあっても "text" の文字列だけを、空白抜きで数える。"""
    if isinstance(node, dict):
        total = 0
        for key, value in node.items():
            if key == "text" and isinstance(value, str):
                total += len(SPACE_RE.sub("", value))
            else:
                total += count_text(value)
        return total
    if isinstance(node, list):
        return sum(count_text(x) for x in node)
    return 0


def _git(*args: str) -> str:
    return subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True, check=True).stdout


def load_files(ref: str | None) -> dict[str, object]:
    """{ファイル名（拡張子なし）: JSON} を返す。ref が無ければ作業ツリーから読む。"""
    out: dict[str, object] = {}
    if ref:
        names = [p for p in _git("ls-tree", "--name-only", f"{ref}:{DIALOGUE_DIR}").split() if p.endswith(".json")]
        for name in names:
            stem = name[:-5]
            if chapter_of(stem) is None:
                continue
            out[stem] = json.loads(_git("show", f"{ref}:{DIALOGUE_DIR}/{name}"))
    else:
        for path in sorted((ROOT / DIALOGUE_DIR).glob("*.json")):
            if chapter_of(path.stem) is None:
                continue
            out[path.stem] = json.loads(path.read_text(encoding="utf-8"))
    return out


def measure(files: dict[str, object]) -> dict:
    by_file: dict[str, dict] = {}
    chapters: dict[int, int] = {}
    for stem, data in sorted(files.items()):
        ch = chapter_of(stem)
        if ch is None:
            continue
        n = count_text(data)
        by_file[stem] = {"chapter": ch, "chars": n}
        chapters[ch] = chapters.get(ch, 0) + n
    base = chapters.get(1, 0)
    rows = []
    for ch in sorted(chapters):
        chars = chapters[ch]
        row = {"chapter": ch, "chars": chars, "ratio": (chars / base) if base else None}
        row["to_target"] = max(0, base - chars) if ch in TARGET_CHAPTERS else None
        rows.append(row)
    return {"chapters": rows, "files": by_file}


def render(result: dict, with_files: bool) -> str:
    lines = ["| 章 | 字数 | 第1章比 | 第1章の量まで |", "|---|---:|---:|---:|"]
    for r in result["chapters"]:
        ratio = "基準" if r["chapter"] == 1 else (f"{r['ratio'] * 100:.0f}%" if r["ratio"] is not None else "-")
        if r["chapter"] == 1:
            gap = "基準"
        elif r["to_target"] is None:
            gap = "目標なし"
        else:
            gap = f"{r['to_target']:,}"
        lines.append(f"| 第{r['chapter']}章 | {r['chars']:,} | {ratio} | {gap} |")
    if with_files:
        lines += ["", "| ファイル | 章 | 字数 |", "|---|---:|---:|"]
        for stem, info in sorted(result["files"].items(), key=lambda kv: (kv[1]["chapter"], -kv[1]["chars"])):
            lines.append(f"| {stem} | {info['chapter']} | {info['chars']:,} |")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--ref", help="git の参照（例: origin/main）。省略時は作業ツリー")
    ap.add_argument("--json", action="store_true", help="JSON で出力する")
    ap.add_argument("--files", action="store_true", help="ファイル別の内訳も出す")
    args = ap.parse_args(argv)
    result = measure(load_files(args.ref))
    if args.json:
        json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
    else:
        print(render(result, args.files))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
