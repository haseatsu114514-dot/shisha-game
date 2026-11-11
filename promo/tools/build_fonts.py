#!/usr/bin/env python3
"""公式サイトで使う文字だけを入れた軽いフォントを作る。

リポジトリのルートで実行する（fonttools と brotli が必要: pip install fonttools brotli）:
    python3 promo/tools/build_fonts.py            # 作り直す
    python3 promo/tools/build_fonts.py --check    # index.html の文字がフォントに入っているかだけ調べる

- 日本語フォントはゲームに同梱しているもの（remake/fonts/・assets/fonts/、すべて SIL OFL 1.1）から切り出す。
- 入れる文字は promo/index.html と promo/js/site.js に出てくる文字＋かな・記号・英数字。
  **文章を書き換えて新しい漢字を足したら、このスクリプトを実行し直す**（足りない字は端末の明朝体・ゴシック体で表示される）。
- 欧文の見出し用 Cormorant Garamond は、--latin に元の TTF を渡したときだけ作り直す（出典は promo/README.md）。
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
PROMO = ROOT / "promo"
OUT = PROMO / "fonts"

# いつも入れておく文字（文章を少し直しただけで欠けないように）
KANA = "".join(chr(c) for c in range(0x3041, 0x3097)) + "".join(chr(c) for c in range(0x30A1, 0x30FD))
ASCII = "".join(chr(c) for c in range(0x20, 0x7F))
SYMBOLS = "、。，．・：；？！゛゜´｀¨＾￣＿ヽヾゝゞ〃仝々〆〇ー―‐／＼～∥｜…‥‘’“”（）〔〕［］｛｝〈〉《》「」『』【】＋－±×÷＝≠＜＞♪♡♥★☆○●◎◇◆□■△▲▽▼※〒→←↑↓〜—–©＆＃％＠　０１２３４５６７８９"
BASE = KANA + ASCII + SYMBOLS

# 出力名: (元フォント, 入れる文字の範囲)
JAPANESE = {
    "ZenOldMincho-Promo.woff2": ROOT / "remake" / "fonts" / "ZenOldMincho-Blue-Regular.woff2",
    "ZenOldMincho-Promo-Bold.woff2": ROOT / "remake" / "fonts" / "ZenOldMincho-Name-Bold.woff2",
    "ZenKakuGothicNew-Promo-Medium.woff2": ROOT / "remake" / "fonts" / "ZenKakuGothicNew-Medium.woff2",
    "DotGothic16-Promo.woff2": ROOT / "assets" / "fonts" / "DotGothic16-Regular.ttf",
}
LATIN = {
    "CormorantGaramond-Promo-Italic.woff2": "CormorantGaramond-Italic[wght].ttf",
    "CormorantGaramond-Promo.woff2": "CormorantGaramond[wght].ttf",
}
LATIN_TEXT = ASCII + "—–’‘“”&é"


def site_text() -> str:
    text = (PROMO / "index.html").read_text(encoding="utf-8")
    text = re.sub(r"<script.*?</script>|<style.*?</style>", "", text, flags=re.S)
    script = PROMO / "js" / "site.js"
    if script.exists():
        # 画面に出るのは文字列だけ。説明のコメントの字までフォントに入れない
        code = script.read_text(encoding="utf-8")
        code = re.sub(r"/\*.*?\*/", "", code, flags=re.S)
        text += re.sub(r"(^|\s)//[^\n]*", r"\1", code)
    return "".join(sorted(set(text) - set("\n\r\t")))


def make(source: Path, target: Path, text: str, variable_weight: float | None = None) -> None:
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = [1, 2, 3, 4, 6]
    options.notdef_outline = True
    options.desubroutinize = True
    font = TTFont(source)
    if variable_weight is not None and "fvar" in font:
        from fontTools.varLib import instancer
        font = instancer.instantiateVariableFont(font, {"wght": variable_weight})
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    target.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = "woff2"
    font.save(target)
    print(f"{target.name:42s} {target.stat().st_size / 1024:7.1f} KB")


def missing(font_path: Path, text: str) -> str:
    cmap = TTFont(font_path).getBestCmap()
    return "".join(ch for ch in text if ord(ch) not in cmap and not ch.isspace())


def check(text: str) -> int:
    bad = 0
    for name in ("ZenOldMincho-Promo.woff2", "ZenKakuGothicNew-Promo-Medium.woff2"):
        gone = missing(OUT / name, text)
        if gone:
            bad += 1
            print(f"{name}: 入っていない字 → {gone}")
    if bad:
        print("python3 promo/tools/build_fonts.py を実行してフォントを作り直してください。")
    else:
        print("フォントは index.html の文字をすべて含んでいます。")
    return bad


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--latin", type=Path, help="Cormorant Garamond の可変フォント（TTF）を置いたフォルダ")
    args = parser.parse_args()
    text = site_text()
    if args.check:
        sys.exit(1 if check(text) else 0)
    wanted = "".join(sorted(set(text + BASE)))
    for name, source in JAPANESE.items():
        make(source, OUT / name, wanted)
        gone = missing(OUT / name, text)
        if gone and not name.startswith("DotGothic16"):
            print(f"  元のフォントに無い字（端末の書体で表示されます）: {gone}")
    if args.latin:
        make(args.latin / LATIN["CormorantGaramond-Promo-Italic.woff2"], OUT / "CormorantGaramond-Promo-Italic.woff2", LATIN_TEXT, 500)
        make(args.latin / LATIN["CormorantGaramond-Promo.woff2"], OUT / "CormorantGaramond-Promo.woff2", LATIN_TEXT, 500)


if __name__ == "__main__":
    main()
