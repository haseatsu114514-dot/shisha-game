#!/usr/bin/env python3
"""公開用に組んだ _site/ から、ゲームが読まないファイルを外す（GitHub Pages の配備が呼ぶ）。

Pages の公開物は 1GB までが目安で、2026-11 に約1.5GB になり警告が出ていた。
見た目・内容は変えず、次だけを公開物から外す（リポジトリのファイルはそのまま）。

1. WebP 版で表示している画像の元 PNG（assets/ 側）。
   ゲームは remake/data/manifest.json の "webp" に載った画像を remake/img/ の WebP で表示し、
   元の PNG は読まない（js/core/data.js の img() など）。ただし、コード・データ・ページが
   assets/ の URL を直接書いている画像は残す（下の「直接の参照」）
2. remake/test/ と remake/tools/（開発用。ゲームからもプレビューからも読まない）

直接の参照: 公開物の JS・CSS・HTML・JSON の文字列に出てくる "assets/…" を集め、
${…} は何にでも合う形にして、合った画像は外さない。WebP の有無を見てから assets/ を読む
決まった場所（WEBP_AWARE）だけは、その文字列を数えない。決まった場所が WebP を見なくなったら
remake/test/slim_deploy.mjs が落ちる。迷う書き方は「残す」側に倒れる（外しすぎて絵が消えることはない）。

  python3 remake/tools/slim_deploy.py _site
"""
import argparse
import json
import re
import shutil
import sys
from pathlib import Path

# 公開物の中で、assets/ を直接書くが WebP の一覧を先に見る場所（ファイル, 文字列）。
# ここに足すときは、その場所が manifest の webp を見てから assets/ を読むことを確かめる。
WEBP_AWARE = {
    ("remake/js/core/data.js", "`${ROOT}assets/${rel}`"),
    ("remake/js/core/portrait-resolver.js", "`../../../assets/${portrait.rel}`"),
    ("remake/js/core/venue-host.js", '"../../../assets/"'),
}
# 絵の名前を引数で受け取る場所。${file} を何にでも合う形にせず、実際の引数だけを残す
ARGUMENT_SITES = {
    ("remake/js/daily/facility-icons.js", "`../../../assets/ui/${file}`"): (r"single\(\s*'([^']+)'", "ui/"),
}
# JSON の中で、値が GitHub へのリンクとして出るだけ（公開物から読まない）の項目。
# 表題CGの選別ツールは sources・prompts・references[].path を sourceUrl() で GitHub に向け、
# history は文字として出すだけ。画面に読むのは image・thumbnail・references[].url（tools/title-review/app.js）
LINK_ONLY_KEYS = {
    "tools/title-review/catalog.json": {"sources", "prompts", "history", "path"},
}
TEXT_SUFFIXES = {".js", ".mjs", ".css", ".html", ".json"}
SKIP_TEXT = {"remake/data/manifest.json"}
DEV_ONLY = ["remake/test", "remake/tools"]
LITERAL = re.compile(r'`[^`]*`|"[^"\n]*"|\'[^\'\n]*\'|url\(\s*[^\'")\s][^)]*\)')


def without_link_only(text: str, keys: set) -> str:
    """JSON から、リンクとして出すだけの項目を除いた文字列（読めなければそのまま＝残す側）"""

    def walk(value):
        if isinstance(value, dict):
            return {k: walk(v) for k, v in value.items() if k not in keys}
        if isinstance(value, list):
            return [walk(v) for v in value]
        return value

    try:
        return json.dumps(walk(json.loads(text)), ensure_ascii=False)
    except ValueError:
        return text


def served_texts(site: Path):
    for path in sorted(site.rglob("*")):
        rel = path.relative_to(site).as_posix()
        if path.is_file() and path.suffix in TEXT_SUFFIXES and rel not in SKIP_TEXT and not rel.startswith("assets/"):
            text = path.read_text(encoding="utf-8", errors="replace")
            yield rel, without_link_only(text, LINK_ONLY_KEYS[rel]) if rel in LINK_ONLY_KEYS else text


def direct_reference_patterns(site: Path) -> list:
    """公開物の中の "assets/…" の書き方 → assets/ からの相対パスに合う正規表現（前方一致）"""
    patterns = []
    for rel, text in served_texts(site):
        # js-<版>/ は js/ の写し（stamp_deploy.py）。同じ場所として扱う
        source = re.sub(r"^remake/js-[0-9A-Za-z_-]+/", "remake/js/", rel)
        for literal in LITERAL.findall(text):
            if "assets/" not in literal or "res://assets/" in literal:
                continue
            if (source, literal) in WEBP_AWARE:
                continue
            if (source, literal) in ARGUMENT_SITES:
                arg, prefix = ARGUMENT_SITES[(source, literal)]
                patterns += [re.compile("^" + re.escape(prefix + name) + "$") for name in re.findall(arg, text)]
                continue
            rest = literal.split("assets/", 1)[1].rstrip("`\"')")
            pieces = re.split(r"\$\{.*?\}", rest)
            patterns.append(re.compile("^" + ".*".join(re.escape(p) for p in pieces)))
    return patterns


def slim(site: Path) -> dict:
    manifest = json.loads((site / "remake/data/manifest.json").read_text(encoding="utf-8"))
    size = 0
    # 開発用フォルダを先に外す（テストの中の assets/ の書き方を「直接の参照」に数えない）
    for rel in DEV_ONLY:
        target = site / rel
        if target.is_dir():
            size += sum(p.stat().st_size for p in target.rglob("*") if p.is_file())
            shutil.rmtree(target)
    patterns = direct_reference_patterns(site)
    removed, kept = [], []
    for rel in sorted(manifest.get("webp", [])):
        original = site / "assets" / rel
        shown = site / "remake/img" / (rel.rsplit(".", 1)[0] + ".webp")
        if not original.is_file() or not shown.is_file():
            continue
        if any(p.match(rel) for p in patterns):
            kept.append(rel)
            continue
        size += original.stat().st_size
        original.unlink()
        removed.append(rel)
    return {"removed": removed, "kept": kept, "bytes": size}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("site", type=Path, help="公開用に組んだフォルダ（_site）")
    args = ap.parse_args()
    if not (args.site / "remake/data/manifest.json").is_file():
        sys.exit(f"slim_deploy: {args.site}/remake/data/manifest.json が無い")
    result = slim(args.site)
    total = sum(p.stat().st_size for p in args.site.rglob("*") if p.is_file())
    print(f"slim_deploy: 元PNG {len(result['removed'])} 件と開発用フォルダを外した（{result['bytes'] / 1e6:.0f} MB）。"
          f"直接参照があり残した元PNG {len(result['kept'])} 件。公開物 {total / 1e6:.0f} MB")


if __name__ == "__main__":
    main()
