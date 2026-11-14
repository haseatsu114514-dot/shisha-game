#!/usr/bin/env python3
"""公開用に組んだ _site/ の remake/ へ「版の名札」を付ける（GitHub Pages の配備が呼ぶ）。

Pages はファイルを10分キャッシュさせ、スマホは開いたままのタブを読み直さないので、
名札が同じままだと自分で開いたリンクだけ古い版が出る。公開のたびに次を行う。

- remake/js を js-<版>/ へ複製し、index.html の本体の読み込み先をそこへ向ける
  （ESモジュールは互いを相対で読むので、フォルダごと変えれば全部が新しくなる。
  プレビュー用のページや、キャッシュに残った古い index.html のために js/ も残す）
- index.html の CSS と、CSS の @import に ?v=<版>（スクリプトから差し込む CSS は
  js/core/asset-version.js が同じ版を付ける）
- index.html の <meta name="suien-build"> に版と公開日時を書く（タイトル画面の右下に出す）
- remake/build.json に版と公開日時を書く。起動時とタブへ戻ったときにキャッシュなしで読み、
  開いている版が古ければ新しい版へ読み直す（index.html の起動スクリプト）
- 試遊ページ（ミニゲームなどの単体ページ。<meta name="suien-build" content="dev"> を持つ remake/*.html）にも
  同じ名札を付ける: meta に版、CSS と起動スクリプト js/page-boot.js に ?v=<版>。page-boot.js が build.json で
  最新かを確かめ、ページの本体を js-<版>/ から読む（2026-11-11 オーナー「試遊リンクだと過去の仕様になってしまう」）

画像・音の URL は変えない（同じ画像を先読みと表示で別の書き方で参照している所があり、
片方だけ変えると二重に読んで表示が遅れる）。手元（python3 -m http.server）では使わない。

  python3 remake/tools/stamp_deploy.py _site --build abc1234
"""
import argparse
import json
import posixpath
import re
import shutil
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

JST = timezone(timedelta(hours=9))
BUILD_META = '<meta name="suien-build" content="dev" data-built="">'


def replace_required(text: str, pattern: str, repl: str, what: str) -> str:
    new, n = re.subn(pattern, repl, text)
    if not n:
        sys.exit(f"stamp_deploy: index.html に {what} が見つからない（{pattern}）")
    return new


def version_css_refs(text: str, base: str, remake: Path, build: str) -> str:
    """href="…css" と url(…css) の相対パスを base（remake/ からのフォルダ）から解き、実在する CSS に ?v=<版>"""

    def versioned(ref: str) -> str:
        if re.match(r"^(data:|https?:|//|#)", ref) or "?" in ref or not ref.endswith(".css"):
            return ref
        target = posixpath.normpath(posixpath.join(base, ref))
        return f"{ref}?v={build}" if (remake / target).is_file() else ref

    text = re.sub(r'url\((["\']?)([^"\')]+)\1\)', lambda m: f"url({m.group(1)}{versioned(m.group(2))}{m.group(1)})", text)
    return re.sub(r'href="([^"]+)"', lambda m: f'href="{versioned(m.group(1))}"', text)


def stamp(site: Path, build: str, built_at: str) -> None:
    remake = site / "remake"
    index = remake / "index.html"
    if not index.is_file():
        sys.exit(f"stamp_deploy: {index} が無い")

    js_dir = f"js-{build}"
    shutil.copytree(remake / "js", remake / js_dir, dirs_exist_ok=True)

    html = index.read_text(encoding="utf-8")
    html = replace_required(html, r'import\("\./js/main\.js"\)', f'import("./{js_dir}/main.js")', "本体の import")
    html = replace_required(
        html, re.escape(BUILD_META),
        f'<meta name="suien-build" content="{build}" data-built="{built_at}">', "版の meta",
    )
    html = version_css_refs(html, "", remake, build)
    # 版付けの確認は、先頭の CSS リンク（バンドル化後は bundles.json の先頭）で行う
    first_css = "css/base.css"
    bundles_file = remake / "css" / "bundles.json"
    if bundles_file.is_file():
        first_css = "css/" + json.loads(bundles_file.read_text(encoding="utf-8"))["segments"][0]["out"]
    if f'href="{first_css}?v={build}"' not in html:
        sys.exit("stamp_deploy: index.html の CSS に版を付けられなかった")
    index.write_text(html, encoding="utf-8")

    for css in sorted((remake / "css").rglob("*.css")):
        text = css.read_text(encoding="utf-8")
        new = version_css_refs(text, css.parent.relative_to(remake).as_posix(), remake, build)
        if new != text:
            css.write_text(new, encoding="utf-8")

    for page in sorted(remake.glob("*.html")):
        if page.name != "index.html":
            stamp_trial_page(page, remake, build, built_at)

    (remake / "build.json").write_text(json.dumps({"build": build, "builtAt": built_at}, ensure_ascii=False), encoding="utf-8")


PAGE_BOOT = re.compile(r'<script src="js/page-boot\.js" data-page="js/[\w./-]+\.js"></script>')


def stamp_trial_page(page: Path, remake: Path, build: str, built_at: str) -> None:
    """試遊ページ（版の meta を持つ単体ページ）に名札を付ける。meta の無いページ（開発用の見比べ等）は触らない。"""
    html = page.read_text(encoding="utf-8")
    if BUILD_META not in html:
        return
    if not PAGE_BOOT.search(html):
        sys.exit(f"stamp_deploy: {page.name} に版の meta があるのに js/page-boot.js の起動が無い")
    html = html.replace(BUILD_META, f'<meta name="suien-build" content="{build}" data-built="{built_at}">')
    html = html.replace('<script src="js/page-boot.js"', f'<script src="js/page-boot.js?v={build}"')
    html = version_css_refs(html, "", remake, build)
    page.write_text(html, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("site", type=Path, help="公開用に組んだフォルダ（_site）")
    ap.add_argument("--build", required=True, help="版（コミットの短いハッシュ）")
    ap.add_argument("--built-at", default=None, help="公開日時（省略時は今・日本時間）")
    args = ap.parse_args()
    build = re.sub(r"[^0-9A-Za-z_-]", "", args.build)
    if not build:
        sys.exit("stamp_deploy: --build が空")
    built_at = args.built_at or datetime.now(JST).strftime("%Y-%m-%d %H:%M")
    stamp(args.site, build, built_at)
    print(f"stamp_deploy: 版 {build}（{built_at}）")


if __name__ == "__main__":
    main()
