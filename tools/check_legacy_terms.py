#!/usr/bin/env python3
"""旧名・旧ステータス・旧設定の残存チェッカー。

P2 CI/ローカル用: data/, remake/js/, brand/story_and_structure.md, docs/ を走査し、
旧名・旧ステータスが残っていたら失敗させる。
lint_dialogue.py が対話 JSON だけを見るのに対し、こちらはソースコードと設定文書全般をカバーする。

使い方:
    python3 tools/check_legacy_terms.py          # 全対象走査
    python3 tools/check_legacy_terms.py --characters-only  # キャラ名・みんとの外見だけ検証
    python3 tools/check_legacy_terms.py --fix     # 安全な置換だけ自動適用（dry-run表示後）
"""

import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

SCAN_DIRS = [
    REPO / "data",
    REPO / "remake" / "js",
    REPO / "brand",
    REPO / "docs",
    REPO / "tools",
]
SCAN_ROOTS = [
    REPO / "CLAUDE.md",
]

SKIP_PATTERNS = {
    "data.js",
    "node_modules",
    ".git",
    "_legacy",  # 隔離した旧台本は履歴。正史へ戻す参照はcheck_story_canon.pyが検出。
}

SKIP_FILES = {
    Path(__file__).resolve(),
    (Path(__file__).resolve().parent / "lint_dialogue.py"),
}

LEGACY_ERROR = {
    "にしお": "なる（naru）に統一",
    "ドクター・ケムリ": "チャコール博士（dr_kemuri）に統一",
    "シーシャ・ステーション": "C.STATION に統一",
    "シーシャステーション": "C.STATION に統一",
    "逢縁 始": "逢縁 はじめ に統一（主人公の表記は平仮名の「はじめ」）",
    "逢縁始": "逢縁はじめ に統一",
    "ましろさん": "ましろちゃん に統一",
    "筋肉の記憶": "「体で覚えた手つき」等に言い換え（2026-07-20オーナー指定・禁止）",
}

# 2026-11-02 追加。過去の記録（要望台帳・archive・検証記録）には当時の名前が残るので、それ以外だけを見る。
LEGACY_ERROR_CURRENT = {
    "緑川": "木成頼 栞（きなりせ しおり）に統一",
    "薄羽": "泡沫 ひより（うたかた ひより）に統一",
    "汐見なぎさ": "サメちゃんの本名は熱海 なぎさ（あつみ なぎさ）に統一",
    "汐見 なぎさ": "サメちゃんの本名は熱海 なぎさ（あつみ なぎさ）に統一",
    "蒸野": "逢縁 はじめ（あいえん はじめ）に統一",
    "香坂 くゆり": "円頓寺 凛想（えんどうじ りお）に統一",
    "香坂": "円頓寺 凛想（えんどうじ りお）に統一",
    "くゆり": "凛想（rio）に統一",
    "kuyuri": "rio に統一",
    "スナック＆シーシャ": "みんとの店はコンセプトカフェ「ぺぱーみんと／PEPPERMINT」（旧設定資料集の誤り・2026-11-02削除）",
    "オーナーママ": "みんとはオーナー兼キャスト（スナックのママではない）",
    "炭場 創": "チャコール博士の本名は火浦 理一",
    "炭場創": "チャコール博士の本名は火浦 理一",
    "前園": "上園 文太郎（ID maezono）に統一",
}
HISTORY_PATHS = ("docs/archive/", "docs/qa/", "docs/owner_requests.md")

LEGACY_STAT_ERROR = {
    "技術力": "技術",
    "洞察力": "洞察",
}

LEGACY_WARN = {
    "地方予選": "SMOKE CROWN CUP に統一",
    "第12回": "旧大会名",
    "シトラスミント": "ch3ダブルアップル事件でましろが出すのはグレープが正（2026-07-20変更・シナモンも旧設定）。ミックス名としての使用は可",
    "林檎飴": "ダブルアップルは林檎そのものではなくアニスとリコリスで林檎を再現した味（2026-07-20確定）。果実の林檎味として描写しない",
}

ALLOWED_CONTEXTS = {
    "煙の向こう側": re.compile(r"(旧タイトル|第[５5]章|HTML comment|BANNED|check_legacy|lint_dialogue|演出上|残置)"),
}

DOC_CONTEXT_RE = re.compile(
    r"(禁止|旧名|旧キャラ名|旧大会名|旧店名|旧呼び方|旧設定|旧タイトル|旧表記|旧ステ|BANNED|❌|NG表現|は存在しない|は使わない|に統一|に置換|改名|削除済み|廃止)",
)

DOC_FILES = {
    "CLAUDE.md",
    "gameplay_agent_reference.md",
    "lint_dialogue.py",
    "check_legacy_terms.py",
    "check_speakers.py",
    "review_scope.md",
    "story_review_prompt.md",
    "story_and_structure.md",
    "owner_requests.md",
    # 2026-11-02 に owner_requests.md から archive/ へ移した 2026-09 以前の節（同じ禁止語の説明を含む）
    "owner_requests_2026-06_09.md",
}

EXTENSIONS = {".json", ".js", ".md", ".py", ".gd", ".txt", ".csv", ".sh"}

IDENTITY_TEXT_EXTENSIONS = EXTENSIONS | {".mjs", ".cjs", ".html", ".css", ".yml", ".yaml", ".svg", ".xml", ".toml", ".lock"}
# 2026-11-03 改名（#2474）。旧名は履歴・素材メモを含む全追跡ファイルで禁止する（「凛とした」等の一般語は許す）。
# 2026-11-04 追加（#2528）: kuyuri の姓「匂坂（さぎさか）」→「香坂（こうさか）」、suhail の「サイーフ」→「スハイル」。同じく全追跡ファイルで禁止。
# 同日追加: saku / rei / hiyori の改名。店名「零-ZERO-」と国名「朝霧の王国」、小文字の内部ID・保存キーは維持する。
RENAMED_CHARACTER_RE = re.compile(r"久世|くぜ さく|朝霧 ?ひより|あさぎり ひより|零-REI-|匂坂|さぎさか|サギサカ|\bSagisaka\b|サイーフ|\bSaif\b|凛(?!とし|々|然|冽|想)|水瀬|白木 ?つむぎ|さぎさか りん|南雲|なぐも しゅうじ|デイビス|Steve Davis|波多野|ラシード|\bRashid\b|アゲハ(?!蝶|チョウ)|路上占い師|\bPak(?:i|ie)\b|サラリーマンさん")
RENAMED_CHARACTER_FIX = "旧キャラ名 → 綾取 朔（saku）／鴉葬レヰ（rei・本名と店名は維持）／泡沫ひより（hiyori・国名の朝霧は維持）／円頓寺 凛想（rio）／猫柳 つむぎ（tsumugi）／黒葉 ましろ（mashiro）／須井 修二（sui）／スティーブ・ライマン（steve）／熱海 なぎさ（samechan）／ハリール（khalil）／あげは（ageha）／辻占のオババ（uranaishi）／Packy（pakki）／鉄仮面さん（salaryman）／スハイル（suhail）に統一（#2474・#2528）"
MINTO_HAIR_RE = re.compile(r"(?:mint|light)[ -]green (?:hair|twin)|black twin[ -]?tails|ミント(?:グリーン|色)のツイン|黒髪ツインテール|角ツインテール", re.IGNORECASE)
# 2026-11-04 追加（#2528 残骸チェック）: 改名済みキャラの旧ローマ字。英字は前後が英数字でない時だけ検出する
# （内部ID kuyuri / sui / maezono / samechan / dr_kemuri の小文字表記・ファイル名は対象外）。
RENAMED_ROMAJI_RE = re.compile(r"(?<![A-Za-z0-9_])(?:Kuze|KUZE|Asagiri|ASAGIRI|REI|Rin|RIN|Nagumo|NAGUMO|Maezono|MAEZONO|Hatano|HATANO)(?![A-Za-z0-9_])|Dr\.? ?Kemuri")
RENAMED_ROMAJI_FIX = "旧キャラ名（英字・旧表記） → Ayatori（saku）／Usuba（hiyori）／鴉葬レヰ（rei）／Rio（rio）／Sui（sui）／Uezono（maezono）／Shiomi（samechan）／Dr. Charcoal（dr_kemuri）に統一（#2528）"


JSON_STRING_RE = re.compile(r'"(?:[^"\\]|\\.)*"')


def has_renamed_romaji(line: str, json_strings: bool = False) -> bool:
    """Keep raw checks and also inspect decoded JSON text on its original line."""
    if RENAMED_ROMAJI_RE.search(line):
        return True
    if json_strings:
        for match in JSON_STRING_RE.finditer(line):
            try:
                value = json.loads(match.group())
            except json.JSONDecodeError:
                continue
            if RENAMED_ROMAJI_RE.search(value):
                return True
    return False


def scan_character_identity(errors: list):
    """疎チェックアウト未取得分も含め、追跡対象のみんとの旧髪設定を防ぐ。"""
    result = subprocess.run(
        ["git", "-C", str(REPO), "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        check=True, stdout=subprocess.PIPE,
    )
    for rel in sorted(set(result.stdout.decode("utf-8").split("\0")) - {""}):
        if "_legacy" in Path(rel).parts:
            continue
        if rel == "tools/check_legacy_terms.py":
            continue
        path = REPO / rel
        if path.suffix not in IDENTITY_TEXT_EXTENSIONS:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for number, line in enumerate(text.splitlines(), 1):
            if RENAMED_CHARACTER_RE.search(line):
                errors.append(f"{rel}:{number}: {RENAMED_CHARACTER_FIX}")
            if has_renamed_romaji(line, json_strings=path.suffix == ".json"):
                errors.append(f"{rel}:{number}: {RENAMED_ROMAJI_FIX}")
            if ("minto" in rel.lower() or "minto" in line.lower() or "みんと" in line) and MINTO_HAIR_RE.search(line):
                # 過去の検品を現行の事実に書き換えず、誤記を明示した訂正注記は残せる。
                if not ("旧" in line and "誤" in line):
                    errors.append(f"{rel}:{number}: みんとの旧髪型・髪色の指示 → 黒髪のストレートロングに統一")

    minto = next(c for c in json.loads((REPO / "data/characters.json").read_text(encoding="utf-8"))
                 if c["id"] == "minto")
    visual = json.dumps({key: minto[key] for key in
                         ("visual_concepts", "private_visual_concepts", "private_notes", "appearance_rules")},
                        ensure_ascii=False)
    if re.search(r"(?:mint|light)[ -]green (?:hair|twin)|ミント(?:グリーン|色)のツイン|ダークブラウン", visual, re.IGNORECASE):
        errors.append("data/characters.json: みんとの旧髪設定 → 営業・私服とも黒髪のストレートロングと緑の瞳に統一")


def should_skip(path: Path) -> bool:
    if path.resolve() in SKIP_FILES:
        return True
    parts = set(path.parts)
    return bool(parts & SKIP_PATTERNS)


def is_doc_context(path: Path, line: str) -> bool:
    if path.name in DOC_FILES and DOC_CONTEXT_RE.search(line):
        return True
    return False


def scan_file(path: Path, errors: list, warnings: list):
    if path.suffix not in EXTENSIONS:
        return
    if should_skip(path):
        return
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (UnicodeDecodeError, PermissionError):
        return

    rel = path.relative_to(REPO)
    for i, line in enumerate(lines, 1):
        if is_doc_context(path, line):
            continue

        for term, fix in LEGACY_ERROR.items():
            if term in line:
                errors.append(f"{rel}:{i}: 旧名 '{term}' → {fix}")

        if not str(rel).startswith(HISTORY_PATHS):
            for term, fix in LEGACY_ERROR_CURRENT.items():
                if term in line:
                    errors.append(f"{rel}:{i}: 旧名 '{term}' → {fix}")

        for term, fix in LEGACY_STAT_ERROR.items():
            if term in line:
                errors.append(f"{rel}:{i}: 旧ステータス '{term}' → {fix}")

        for term, fix in LEGACY_WARN.items():
            if term in line:
                warnings.append(f"{rel}:{i}: 要確認 '{term}' — {fix}")

        if "煙の向こう側" in line:
            ctx = ALLOWED_CONTEXTS["煙の向こう側"]
            if not ctx.search(line) and "chapter" not in str(rel).lower():
                errors.append(f"{rel}:{i}: 旧タイトル '煙の向こう側' → 水煙前線 -EN:CODE-")


def main() -> int:
    errors, warnings = [], []

    scan_character_identity(errors)
    if "--characters-only" in sys.argv[1:]:
        for error in errors:
            print("❌ " + error)
        if not errors:
            print("✅ OK — キャラ名・ID・みんとの外見に旧設定なし（追跡済み素材パスを含む）")
        return 1 if errors else 0

    for d in SCAN_DIRS:
        if d.is_dir():
            for path in sorted(d.rglob("*")):
                if path.is_file():
                    scan_file(path, errors, warnings)

    for path in SCAN_ROOTS:
        if path.is_file():
            scan_file(path, errors, warnings)

    if warnings:
        print(f"⚠️  WARN ({len(warnings)})")
        for w in warnings:
            print("   " + w)
        print()

    if errors:
        print(f"❌ ERROR ({len(errors)})")
        for e in errors:
            print("   " + e)
        return 1

    total = sum(1 for d in SCAN_DIRS if d.is_dir()
                for _ in d.rglob("*") if _.is_file()) + len(SCAN_ROOTS)
    print(f"✅ OK — 旧名・旧設定の残存なし（{total} ファイル走査）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
