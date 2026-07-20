#!/usr/bin/env python3
"""旧名・旧ステータス・旧設定の残存チェッカー。

P2 CI/ローカル用: data/, web/js/, brand/story_and_structure.md, docs/ を走査し、
旧名・旧ステータスが残っていたら失敗させる。
lint_dialogue.py が対話 JSON だけを見るのに対し、こちらはソースコードと設定文書全般をカバーする。

使い方:
    python3 tools/check_legacy_terms.py          # 全対象走査
    python3 tools/check_legacy_terms.py --fix     # 安全な置換だけ自動適用（dry-run表示後）
"""

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

SCAN_DIRS = [
    REPO / "data",
    REPO / "web" / "js",
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
    "蒸野 はじめ": "蒸野 始 に統一",
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
    "lint_dialogue.py",
    "check_legacy_terms.py",
    "check_speakers.py",
    "review_scope.md",
    "story_review_prompt.md",
    "web_version_plan.md",
    "build_setting_reference.py",
    "story_and_structure.md",
    "story_review_report_20260616.md",
    "owner_requests.md",
}

EXTENSIONS = {".json", ".js", ".md", ".py", ".gd", ".txt", ".csv", ".sh"}


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
