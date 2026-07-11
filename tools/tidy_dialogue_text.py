#!/usr/bin/env python3
"""台詞テキストの句読点を規範（G1・2026-07-07 オーナー指定）に揃える整形ツール。

ルール（詳細は .claude/skills/text-style/SKILL.md が正本）:
  R1: 冒頭の interjection 直後の「。」は「、」にする
      例: 「え。俺が、大会にですか？」→「え、俺が、大会にですか？」
  R2: 「。……」＋短い続き（8文字以内・句点を含まない）は「、……」にする
      例: 「頑張れますよね。……えへへ」→「頑張れますよね、……えへへ」
      ※ 続きが独立した文のときは変えない（「〜だ。……だが、その後の話」等）
  R3: 台詞行（speaker あり）の末尾「。」は取る（閉じ括弧の直前も含む）
      例: 「わかりました。」→「わかりました」／「（そうか。）」→「（そうか）」
      ※ ナレーション（speaker 空）は散文なので「。」を残す

使い方:
  python3 tools/tidy_dialogue_text.py --dry-run   # 変更一覧だけ表示
  python3 tools/tidy_dialogue_text.py             # data/dialogue/*.json ほかへ適用
"""
import glob
import json
import re
import sys

INTERJ = r"(え|あ|お|わ|うわ|ん|えっ|あっ|おっ|うっ|はあ|ふう)"
R1 = re.compile(rf"^([「（]?){INTERJ}。(?=.)")
R2 = re.compile(r"。(……|…)(?![^。]*。)(?=[^。」』）]{1,8}[」』）]?$)")

changes = []


def tidy(text: str, speaker: str) -> str:
    orig = text
    # R1: 冒頭 interjection
    text = R1.sub(lambda m: f"{m.group(1)}{m.group(2)}、", text)
    # R2: 「。……」＋短い続き
    text = R2.sub(lambda m: f"、{m.group(1)}", text)
    # R3: 台詞末尾の句点（ナレーションは対象外）
    if speaker:
        text = re.sub(r"。([」』）]?)$", r"\1", text)
    if text != orig:
        changes.append((speaker or "(ナレ)", orig, text))
    return text


def walk_lines(lines):
    for ln in lines:
        if isinstance(ln, dict) and ln.get("text") and isinstance(ln["text"], str):
            ln["text"] = tidy(ln["text"], ln.get("speaker", ""))


def main() -> None:
    dry = "--dry-run" in sys.argv
    files = sorted(glob.glob("data/dialogue/*.json"))
    for p in files:
        with open(p) as f:
            d = json.load(f)
        before = len(changes)
        for dl in d.get("dialogues", []):
            walk_lines(dl.get("lines", []))
            for br in (dl.get("branches") or {}).values():
                walk_lines(br)
        if not dry and len(changes) > before:
            with open(p, "w") as f:
                json.dump(d, f, ensure_ascii=False, indent=2)
                f.write("\n")
    # LIME（吹き出し＝全部発話扱い）
    p = "data/lime_messages.json"
    with open(p) as f:
        d = json.load(f)
    before = len(changes)
    for m in d.get("messages", []):
        for b in m.get("messages", []):
            if isinstance(b, dict) and isinstance(b.get("text"), str):
                b["text"] = tidy(b["text"], m.get("sender", "x"))
        for key in ("decline_response",):
            r = m.get(key)
            if isinstance(r, dict) and isinstance(r.get("text"), str):
                r["text"] = tidy(r["text"], m.get("sender", "x"))
        for r in m.get("replies", []) or []:
            if isinstance(r.get("text"), str):
                r["text"] = tidy(r["text"], "me")
            if isinstance(r.get("response"), str):
                r["response"] = tidy(r["response"], m.get("sender", "x"))
    if not dry and len(changes) > before:
        with open(p, "w") as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
            f.write("\n")

    print(f"{'[DRY] ' if dry else ''}{len(changes)} 行を整形")
    for sp, a, b in changes[:40]:
        print(f"  {sp}: {a[:36]} → {b[:36]}")
    if len(changes) > 40:
        print(f"  ... 他 {len(changes) - 40} 行")


if __name__ == "__main__":
    main()
