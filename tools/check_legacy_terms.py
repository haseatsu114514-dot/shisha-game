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
    "蒸野 始": "蒸野 はじめ に統一（2026-10-16 オーナー指定: 主人公の表記は平仮名の「はじめ」）",
    "蒸野始": "蒸野はじめ に統一（2026-10-16 オーナー指定）",
    "ましろさん": "ましろちゃん に統一",
    "筋肉の記憶": "「体で覚えた手つき」等に言い換え（2026-07-20オーナー指定・禁止）",
}

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

# セーブ互換処理・その回帰テスト・この検査定義だけに旧名のリテラルを許す。
LEGACY_CHARACTER_RE = re.compile(r"kafuka|カフカ|かふか", re.IGNORECASE)
IDENTITY_FIXTURES = {"remake/test/samechan_migration.mjs", "tools/check_legacy_terms.py"}
IDENTITY_TEXT_EXTENSIONS = EXTENSIONS | {".mjs", ".cjs", ".html", ".css", ".yml", ".yaml", ".svg", ".xml", ".toml", ".lock"}
MINTO_HAIR_RE = re.compile(r"(?:mint|light)[ -]green (?:hair|twin)|black twin[ -]?tails|ミント(?:グリーン|色)のツイン|黒髪ツインテール|角ツインテール", re.IGNORECASE)


def scan_character_identity(errors: list):
    """素材のファイル名・疎チェックアウト未取得分も含め、追跡対象の旧名を防ぐ。"""
    result = subprocess.run(
        ["git", "-C", str(REPO), "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        check=True, stdout=subprocess.PIPE,
    )
    for rel in sorted(set(result.stdout.decode("utf-8").split("\0")) - {""}):
        if "_legacy" in Path(rel).parts:
            continue
        if LEGACY_CHARACTER_RE.search(rel):
            errors.append(f"{rel}: 旧キャラIDのファイル名 → samechan に統一")
        if rel in IDENTITY_FIXTURES:
            continue
        path = REPO / rel
        if path.suffix not in IDENTITY_TEXT_EXTENSIONS:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if rel == "remake/js/core/state.js":
            # この関数の外に互換IDや旧表記を増やすことは許さない。
            text = re.sub(r"^function migrateSamechanIdentity\(value\) \{.*?^\}",
                          lambda match: "\n" * match.group().count("\n"), text, flags=re.MULTILINE | re.DOTALL)
        for number, line in enumerate(text.splitlines(), 1):
            if LEGACY_CHARACTER_RE.search(line):
                errors.append(f"{rel}:{number}: 旧キャラ名・ID → サメちゃん / samechan に統一")
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
