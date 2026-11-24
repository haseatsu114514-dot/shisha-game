#!/usr/bin/env python3
"""言いよどみの断片（「かな1文字＋読点」）の再発防止チェック。

正本ルール（2026-11-24 オーナー決定）: 言いよどみは断片吃音で書かず、
「…来るかと思った」のように「…」表記で書く。断片の形は誤字
（例: 「き、来るかと思った」= 来るは「くる」なので語頭不一致）が
演技の吃音に紛れて見逃されるため。

このチェックは、プレイヤーに見える文字列（data/ 配下の JSON の文字列値と
remake/js/ 配下の JS 文字列リテラル）から、文節の頭にある
「かな1文字＋、」を抽出し、許可リスト
（tools/hesitation_fragments_allowlist.txt）に無いものを失敗にする。

許可リストに残っているのは、感嘆・相づち・擬音など言いよどみではないと
仕分け済みのものだけ。新しく正当な感嘆などを書いて落ちた場合は、
その「かな＋次の1文字」の組を許可リストへ1行追加する。
言いよどみを書きたい場合は、許可リストへ足すのではなく「…」表記にする。

使い方: python3 tools/check_hesitation_fragments.py [--write-allowlist]
  --write-allowlist: 現在の抽出結果で許可リストを再生成する
                     （一括仕分け直しをした時だけ使う。通常は使わない）
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALLOWLIST = os.path.join(ROOT, "tools", "hesitation_fragments_allowlist.txt")

BOUNDARY = set("。！？!?…・「『（〈【\n 　]")
KANA = re.compile(r"([ぁ-んァ-ヶ])、")


def segments_start_fragments(text):
    """文節の頭にある「かな1文字＋、」と、その次の1文字の組を返す。"""
    found = []
    starts = [0]
    for i, ch in enumerate(text):
        if ch in BOUNDARY and i + 1 < len(text):
            starts.append(i + 1)
    for s in starts:
        m = KANA.match(text, s)
        if m:
            nxt = text[m.end():m.end() + 1]
            if nxt.isspace():
                nxt = ""
            found.append(m.group(1) + "、" + nxt)
    return found


def json_strings(path):
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return
    stack = [data]
    while stack:
        node = stack.pop()
        if isinstance(node, str):
            yield node
        elif isinstance(node, dict):
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)


def js_literals(path):
    """JS の文字列リテラル（'…' "…" `…`）の中身を取り出す。コメントは対象外。"""
    with open(path, encoding="utf-8", errors="ignore") as f:
        src = f.read()
    out = []
    i, n = 0, len(src)
    while i < n:
        ch = src[i]
        if ch == "/" and i + 1 < n and src[i + 1] == "/":
            j = src.find("\n", i)
            i = n if j < 0 else j + 1
        elif ch == "/" and i + 1 < n and src[i + 1] == "*":
            j = src.find("*/", i + 2)
            i = n if j < 0 else j + 2
        elif ch in "'\"`":
            quote = ch
            buf = []
            i += 1
            while i < n:
                c = src[i]
                if c == "\\" and i + 1 < n:
                    esc = src[i + 1]
                    if esc == "n":
                        buf.append("\n")
                    elif esc == "u" and i + 5 < n:
                        try:
                            buf.append(chr(int(src[i + 2:i + 6], 16)))
                            i += 4
                        except ValueError:
                            buf.append(esc)
                    else:
                        buf.append(esc)
                    i += 2
                elif c == quote:
                    i += 1
                    break
                elif quote == "`" and c == "$" and i + 1 < n and src[i + 1] == "{":
                    # テンプレートの式はコードとして読み飛ばす（文字列部分だけが対象）
                    depth = 1
                    i += 2
                    while i < n and depth:
                        if src[i] == "{":
                            depth += 1
                        elif src[i] == "}":
                            depth -= 1
                        i += 1
                    buf.append("\n")
                else:
                    buf.append(c)
                    i += 1
            out.append("".join(buf))
        else:
            i += 1
    return out


def collect():
    hits = {}  # pair -> [(file, example)]
    for base, pattern in (("data", ".json"), (os.path.join("remake", "js"), ".js")):
        top = os.path.join(ROOT, base)
        for dirpath, _dirs, files in os.walk(top):
            for name in sorted(files):
                if not name.endswith(pattern):
                    continue
                path = os.path.join(dirpath, name)
                rel = os.path.relpath(path, ROOT)
                strings = json_strings(path) if pattern == ".json" else js_literals(path)
                for text in strings:
                    for pair in segments_start_fragments(text):
                        hits.setdefault(pair, []).append((rel, text[:60]))
    return hits


def main():
    hits = collect()
    if "--write-allowlist" in sys.argv:
        lines = [
            "# 言いよどみ断片の許可リスト（tools/check_hesitation_fragments.py が参照）",
            "# 1行 = 「かな＋、＋次の1文字」。言いよどみではないと仕分け済みの組だけを残す。",
            "# 言いよどみはここへ足さず「…」表記で書くこと（2026-11-24 オーナー決定）。",
        ]
        lines += sorted(hits)
        with open(ALLOWLIST, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        print(f"allowlist regenerated: {len(hits)} pairs")
        return 0
    allowed = set()
    with open(ALLOWLIST, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                allowed.add(line)
    bad = {pair: where for pair, where in hits.items() if pair not in allowed}
    if bad:
        print("言いよどみ断片の未許可の組が見つかりました。")
        print("言いよどみなら「…」表記へ直し、感嘆など正当なものなら許可リストへ追加してください。")
        for pair in sorted(bad):
            rel, example = bad[pair][0]
            print(f"  {pair}  ({rel}: {example}…)")
        print(f"NG: {len(bad)} 組 / 全 {len(hits)} 組")
        return 1
    print(f"OK: 言いよどみ断片 {len(hits)} 組すべて許可リスト内")
    return 0


if __name__ == "__main__":
    sys.exit(main())
