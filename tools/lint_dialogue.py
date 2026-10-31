#!/usr/bin/env python3
"""台詞JSONの構造リンタ（矛盾・改行崩れの再発防止）。

CLAUDE.md「矛盾・改行崩れの再発防止ルール」§4 の手作業チェックを自動化する。
data/dialogue/*.json を走査し、以下を検査:

  ERROR（exit 1）:
    - JSON が壊れている
    - speaker が data/characters.json の id にもモブ話者ホワイトリストにも無い
    - 旧名・旧設定・旧タイトルの混入（にしお / ましろさん / シーシャ・ステーション /
      地方予選 / ドクター・ケムリ / 煙の向こう側 / 技術力 / 洞察力 など）
    - 略記「DA」（ダブルアップルは略さない）
    - 選択肢が全角26字を超える（選択肢は1行・GUI22。バイトの対応 data/baito_events.json と
      恋人の会話 remake/data/lover.json の選択肢も同じ枠に出るので一緒に見る）

  WARN（exit は 0 のまま。気付きのため列挙）:
    - 手動改行 \\n（改行はコード側 autoWrap に一本化したい）
    - 1台詞の中で「」『』（）が閉じていない＝一文が吹き出しをまたいでいる
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
                "技術力", "洞察力", "チュートリアル",
                "チャド", "SHOWTIME",  # チャドはダ・シルヴァ太陽に完全統合済み（2026-07-18）
                "ヤニネコ", "ヤニ猫", "テツコ"]  # mukaiの看板猫は「てつこ」（2026-10-31 #1993）
BANNED_WARN = ["メンタル", "集中力"]  # 文脈次第。ステ名として使っていないか目視

STAT_WORDS = ["技術", "センス", "根性", "魅力", "洞察"]
CUE_RE = re.compile(r"(技術|センス|根性|魅力|洞察|好感度)")
TAG_RE = re.compile(r"\[/?[a-z]+\]")

WRAP_LIMIT = 24          # engine.js と一致（全角換算）
MAX_PAGE_FULLWIDTH = 48  # 24×2行。これを超えると改ページで割れやすい
# リメイク版の選択肢の枠（.vn-choice: 幅720px・内幅658px・24px・字間0.04em）に1行で入る字数。
# 1字24.96px なので26字（649px）まで。CSS を変えたら remake/test/choice_oneline.mjs で測り直す
CHOICE_LIMIT = 26
EXTRA_CHOICE_FILES = [REPO / "data" / "baito_events.json", REPO / "remake" / "data" / "lover.json"]


DA_RE = re.compile(r"(?<![A-Za-z])DA(?![A-Za-z])")
BRACKETS = {"「": "」", "『": "』", "（": "）"}


def bracket_problem(text: str) -> str:
    """1台詞の中で「」『』（）が閉じていなければ理由を返す。心の声の色は「（」で始まる行だけに付く。"""
    stack = []
    for ch in text:
        if ch in BRACKETS:
            stack.append(ch)
        elif ch in BRACKETS.values():
            if not stack or BRACKETS[stack[-1]] != ch:
                return f"閉じ括弧「{ch}」に対応する開き括弧がない"
            stack.pop()
    return f"「{''.join(stack)}」が閉じていない" if stack else ""


def fullwidth_len(s: str) -> float:
    """engine.js autoWrap と同じ数え方: 半角=0.5 / 全角=1。装飾タグは0。"""
    s = TAG_RE.sub("", s)
    return sum(0.5 if ord(ch) <= 0xff else 1 for ch in s)


def load_speaker_whitelist() -> set:
    data = json.loads(CHARS.read_text(encoding="utf-8"))
    chars = data if isinstance(data, list) else data.get("characters", [])
    ids = {c["id"] for c in chars if isinstance(c, dict) and "id" in c}
    # remake/core/data.js と同じ独立profileのoverlay。告白等の他ファイルでも本人を話者に使う。
    overlay = json.loads((DLG_DIR / "samechan.json").read_text(encoding="utf-8"))
    if overlay.get("profile", {}).get("id"):
        ids.add(overlay["profile"]["id"])
    return ids | MOB_SPEAKERS


def iter_lines(dialogue):
    """lines と branches 配下の全行を (場所ラベル, line) で返す。"""
    for ln in dialogue.get("lines", []) or []:
        yield "lines", ln
    for key, arr in (dialogue.get("branches") or {}).items():
        for ln in arr or []:
            yield f"branches.{key}", ln


def choice_texts(o):
    """選択肢の文言を全部返す（type:"choice" の choices／バイトの choices／恋人の会話の optA・optB）。"""
    if isinstance(o, dict):
        if isinstance(o.get("choices"), list):
            for c in o["choices"]:
                if isinstance(c, dict) and isinstance(c.get("text"), str):
                    yield c["text"]
        for k in ("optA", "optB"):
            if isinstance(o.get(k), dict) and isinstance(o[k].get("text"), str):
                yield o[k]["text"]
        for v in o.values():
            yield from choice_texts(v)
    elif isinstance(o, list):
        for v in o:
            yield from choice_texts(v)


def check_choice(where: str, text: str, errors: list) -> None:
    flen = fullwidth_len(re.sub(r"<[^>]+>", "", text))
    if flen > CHOICE_LIMIT:
        errors.append(f"{where}: 選択肢が全角{flen:g}字（>{CHOICE_LIMIT}）。1行に収まらない → 文言を短く「{text}」")


def check_inner(where: str, value, errors: list, warns: list) -> None:
    """本心も台詞と同じ正史・字数・改行規範で検査する。報酬としては使わない。"""
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{where}: inner は空でない文字列にする")
        return
    text = value.strip()
    wrapped = text if text.startswith("（") and text.endswith("）") else f"（{text}）"
    for bad in BANNED_ERROR:
        if bad in text:
            errors.append(f"{where}: 本心に旧名/旧設定 '{bad}' が混入")
    if DA_RE.search(text):
        errors.append(f"{where}: 本心でも略記「DA」は禁止")
    if problem := bracket_problem(wrapped):
        errors.append(f"{where}: 本心の括弧が壊れている: {problem}")
    if "\\n" in text or "\n" in text:
        warns.append(f"{where}: 本心の手動改行はautoWrapに任せる")
    if fullwidth_len(wrapped) > MAX_PAGE_FULLWIDTH:
        warns.append(f"{where}: 本心が括弧込みで48字を超える。短くするか改ページを確認")
    if text.rstrip("」』）").endswith("。"):
        warns.append(f"{where}: 本心の末尾「。」は取る")


def extra_inner_fields(o, where, errors, warns):
    """動的デート・友人会話でも、ひよりの欄にだけ本心を置く。"""
    if isinstance(o, dict):
        for key, value in o.items():
            location = f"{where}.{key}"
            if key == "inner":
                if ".hiyori." not in location:
                    errors.append(f"{location}: inner はひより固有の演出")
                check_inner(location, value, errors, warns)
            else:
                extra_inner_fields(value, location, errors, warns)
    elif isinstance(o, list):
        for i, value in enumerate(o):
            extra_inner_fields(value, f"{where}[{i}]", errors, warns)


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

        profile = data.get("profile") or {}
        local_id = profile.get("id") if isinstance(profile, dict) else None
        file_whitelist = whitelist | ({local_id} if isinstance(local_id, str) and local_id else set())

        for dlg in data.get("dialogues", []) or []:
            did = dlg.get("dialogue_id", "?")
            for loc, ln in iter_lines(dlg):
                if not isinstance(ln, dict):
                    continue
                where = f"{rel} [{did} / {loc}]"

                if ln.get("type") == "choice":
                    for t in choice_texts({"choices": ln.get("choices")}):
                        check_choice(where, t, errors)

                sp = ln.get("speaker")
                if sp is not None and sp not in file_whitelist:
                    errors.append(f"{where}: 未登録の speaker '{sp}'（characters.json に無い）")

                if "inner" in ln:
                    if sp != "hiyori" or ln.get("type"):
                        errors.append(f"{where}: inner はひよりの通常台詞行だけに付ける")
                    if not isinstance(ln.get("text"), str) or not ln["text"].strip():
                        errors.append(f"{where}: inner だけの行にはせず、表の台詞を置く")
                    check_inner(f"{where} / inner", ln["inner"], errors, warns)

                text = ln.get("text")
                if not isinstance(text, str):
                    continue

                for bad in BANNED_ERROR:
                    if bad in text:
                        errors.append(f"{where}: 旧名/旧設定 '{bad}' が混入")
                if DA_RE.search(text):
                    errors.append(f"{where}: 略記「DA」は禁止（必ず「ダブルアップル」と書く）")
                if (b := bracket_problem(text)):
                    warns.append(f"{where}: {b}。一文が吹き出しをまたいでいる（心の声は各行を（）で閉じる）")
                for bad in BANNED_WARN:
                    if bad in text:
                        warns.append(f"{where}: 要確認語 '{bad}'（ステ名として使っていないか）")

                if "\\n" in text or "\n" in text:
                    warns.append(f"{where}: 手動改行を含む（画面合わせには使わず、演出意図と語中分割を確認）")

                # 句読点規範（G1・2026-07-07 オーナー指定。正本: .claude/skills/text-style）
                # 「。……＋短い続き」だけ警告（続きが独立文なら「。……」のままで良い＝tidyと同じ判定）
                if re.search(r"。(……|…)(?![^。]*。)(?=[^。」』）]{1,8}[」』）]?$)", text):
                    warns.append(f"{where}: 「。……＋短い続き」→「、……」に（tidy_dialogue_text.py で自動整形可）")
                if re.match(r"^[「（]?(え|あ|お|わ|うわ|ん)。", text):
                    warns.append(f"{where}: 冒頭の間投詞のあとは「。」でなく「、」（例: 「え、俺が〜」）")
                if sp and text.rstrip("」』）").endswith("。"):
                    warns.append(f"{where}: 台詞の末尾「。」は取る（本作の台詞は末尾句点なしで統一）")
                if sp and text.count("。") >= 3:
                    warns.append(f"{where}: 台詞に「。」が3個以上。行の分割を検討（。の多すぎ対策）")

                flen = fullwidth_len(text)
                if flen > MAX_PAGE_FULLWIDTH:
                    warns.append(f"{where}: 1台詞が全角{flen:.0f}字（>48）。改ページで割れやすい → 台詞を分ける")

                if "上がった" in text and CUE_RE.search(text):
                    phrase = "大きく上がった" if "大きく上がった" in text else \
                             "かなり上がった" if "かなり上がった" in text else \
                             "少し上がった" if "少し上がった" in text else "上がった"
                    stats = "/".join(s for s in (STAT_WORDS + ["好感度"]) if s in text)
                    warns.append(f"{where}: 報酬キュー検出（{stats}・{phrase}）→ 意図通りか確認")

    for path in EXTRA_CHOICE_FILES:
        if filt and filt not in path.name:
            continue
        rel = path.relative_to(REPO)
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            errors.append(f"{rel}: 読めない: {e}")
            continue
        for t in choice_texts(data):
            check_choice(str(rel), t, errors)
        extra_inner_fields(data, str(rel), errors, warns)

    friend_path = REPO / "remake" / "data" / "friends.json"
    if not filt or filt in friend_path.name:
        extra_inner_fields(json.loads(friend_path.read_text(encoding="utf-8")), str(friend_path.relative_to(REPO)), errors, warns)

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
