#!/usr/bin/env python3
"""台詞JSONの構造リンタ（矛盾・改行崩れの再発防止）。

CLAUDE.md「矛盾・改行崩れの再発防止ルール」§4 の手作業チェックを自動化する。
data/dialogue/*.json を走査し、以下を検査:

  ERROR（exit 1）:
    - JSON が壊れている
    - speaker が data/characters.json の id にもモブ話者ホワイトリストにも無い
    - 旧名・旧設定・旧タイトルの混入（にしお / ましろさん / シーシャ・ステーション /
      地方予選 / ドクター・ケムリ / 煙の向こう側 / 技術力 / 洞察力 など）

  WARN（exit は 0 のまま。気付きのため列挙）:
    - 手動改行 \\n（改行はコード側 autoWrap に一本化したい）
    - 1台詞が全角48文字（24×2行）を超過＝自動改ページで途中で割れやすい
    - 報酬キュー（「上がった」＋ステ名）の検出。誤発火・規定フレーズ外を発見しやすく

使い方:
    python3 tools/lint_dialogue.py            # data/dialogue/ 全部
    python3 tools/lint_dialogue.py ch1_main   # 部分一致でファイル指定
"""

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DLG_DIR = REPO / "data" / "dialogue"
CHARS = REPO / "data" / "characters.json"

# モブ・ナレーション等、characters.json に載せない正当な話者
MOB_SPEAKERS = {"", "???", "customer", "everyone", "old_man", "shop_clerk",
                "staff_choizap", "oneesan", "tumugi", "hazime"}

# 混入してはいけない旧名・旧設定・旧タイトル（明確に誤りのものだけ ERROR にする。
# 「度胸」「味覚」「集中力」「メンタル」は普通の日本語でもあるので WARN 扱い）
BANNED_ERROR = ["にしお", "ましろさん", "シーシャ・ステーション", "シーシャステーション",
                "地方予選", "第12回", "ドクター・ケムリ", "煙の向こう側",
                "技術力", "洞察力", "チュートリアル"]
BANNED_WARN = ["メンタル", "集中力"]  # 文脈次第。ステ名として使っていないか目視

STAT_WORDS = ["技術", "センス", "根性", "魅力", "洞察"]
CUE_RE = re.compile(r"(技術|センス|根性|魅力|洞察|好感度)")
TAG_RE = re.compile(r"\[/?[a-z]+\]")

WRAP_LIMIT = 24          # engine.js と一致（全角換算）
MAX_PAGE_FULLWIDTH = 48  # 24×2行。これを超えると改ページで割れやすい


def fullwidth_len(s: str) -> float:
    """engine.js autoWrap と同じ数え方: 半角=0.5 / 全角=1。装飾タグは0。"""
    s = TAG_RE.sub("", s)
    return sum(0.5 if ord(ch) <= 0xff else 1 for ch in s)


def load_speaker_whitelist() -> set:
    data = json.loads(CHARS.read_text(encoding="utf-8"))
    chars = data if isinstance(data, list) else data.get("characters", [])
    ids = {c["id"] for c in chars if isinstance(c, dict) and "id" in c}
    return ids | MOB_SPEAKERS


def iter_lines(dialogue):
    """lines と branches 配下の全行を (場所ラベル, line) で返す。"""
    for ln in dialogue.get("lines", []) or []:
        yield "lines", ln
    for key, arr in (dialogue.get("branches") or {}).items():
        for ln in arr or []:
            yield f"branches.{key}", ln


def main() -> int:
    filt = sys.argv[1] if len(sys.argv) > 1 else None
    files = sorted(p for p in DLG_DIR.glob("*.json") if not filt or filt in p.name)
    if not files:
        print(f"対象ファイルなし（filter={filt!r}）")
        return 1

    whitelist = load_speaker_whitelist()
    errors, warns = [], []

    for path in files:
        rel = path.relative_to(REPO)
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{rel}: JSON parse error: {e}")
            continue

        for dlg in data.get("dialogues", []) or []:
            did = dlg.get("dialogue_id", "?")
            for loc, ln in iter_lines(dlg):
                if not isinstance(ln, dict):
                    continue
                where = f"{rel} [{did} / {loc}]"

                sp = ln.get("speaker")
                if sp is not None and sp not in whitelist:
                    errors.append(f"{where}: 未登録の speaker '{sp}'（characters.json に無い）")

                text = ln.get("text")
                if not isinstance(text, str):
                    continue

                for bad in BANNED_ERROR:
                    if bad in text:
                        errors.append(f"{where}: 旧名/旧設定 '{bad}' が混入")
                for bad in BANNED_WARN:
                    if bad in text:
                        warns.append(f"{where}: 要確認語 '{bad}'（ステ名として使っていないか）")

                if "\\n" in text or "\n" in text:
                    warns.append(f"{where}: 手動改行を含む（autoWrap に任せたい）")

                flen = fullwidth_len(text)
                if flen > MAX_PAGE_FULLWIDTH:
                    warns.append(f"{where}: 1台詞が全角{flen:.0f}字（>48）。改ページで割れやすい → 台詞を分ける")

                if "上がった" in text and CUE_RE.search(text):
                    phrase = "大きく上がった" if "大きく上がった" in text else \
                             "少し上がった" if "少し上がった" in text else "上がった"
                    stats = "/".join(s for s in (STAT_WORDS + ["好感度"]) if s in text)
                    warns.append(f"{where}: 報酬キュー検出（{stats}・{phrase}）→ 意図通りか確認")

    if warns:
        print(f"⚠️  WARN ({len(warns)})")
        for w in warns:
            print("   " + w)
        print()
    if errors:
        print(f"❌ ERROR ({len(errors)})")
        for e in errors:
            print("   " + e)
        print(f"\n{len(files)} ファイル走査。ERROR {len(errors)} / WARN {len(warns)}")
        return 1

    print(f"✅ OK — {len(files)} ファイル走査。ERROR 0 / WARN {len(warns)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
