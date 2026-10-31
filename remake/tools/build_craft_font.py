"""制作画面の見出し・操作ボタン用の明朝「Craft Mincho」を、Zen Old Mincho Bold から必要な字へ絞る。

使い方（ネット取得なし。fontTools と brotli が必要: pip install fonttools brotli）:
    python3 remake/tools/build_craft_font.py

元フォントは同梱の remake/fonts/ZenOldMincho-Name-Bold.woff2（Zen Old Mincho Bold v1.500、
SIL OFL 1.1、ライセンスは remake/fonts/OFL-ZenOldMincho.txt）。
収録する文字 = ASCII・全角英数記号・かな全部・和文の約物 ＋ remake/js/craft/ に実際に出てくる全文字。
制作画面の文言に新しい漢字を足したら、このスクリプトを再実行する（足りない字は単語の途中で書体が割れる）。
"""
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / "remake/fonts"
SOURCE = FONTS / "ZenOldMincho-Name-Bold.woff2"
DEST = FONTS / "ZenOldMincho-Craft.woff2"
CRAFT_JS = ROOT / "remake/js/craft"


def ranges(*pairs):
    return {chr(c) for a, b in pairs for c in range(a, b + 1)}


def craft_text():
    chars = ranges(
        (0x20, 0x7E),      # ASCII
        (0x3000, 0x303F),  # 和文の約物（、。「」〜 など）
        (0x3041, 0x309F),  # ひらがな
        (0x30A0, 0x30FF),  # カタカナ
        (0xFF01, 0xFF5E),  # 全角英数・記号
    ) | set("…‥・℃％×÷±→←↑↓▲▼△▽◎○●◇◆□■☆★♪♡")
    for path in sorted(CRAFT_JS.rglob("*.js")):
        chars.update(path.read_text(encoding="utf-8"))
    return "".join(sorted(c for c in chars if c.isprintable()))


def main():
    font = TTFont(SOURCE)
    options = subset.Options()
    options.name_IDs = ["*"]
    options.flavor = "woff2"
    options.layout_features = ["*"]
    sub = subset.Subsetter(options=options)
    sub.populate(text=craft_text())
    sub.subset(font)
    names = {1: "Craft Mincho", 3: "CraftMincho-Bold-1.1", 4: "Craft Mincho Bold",
             6: "CraftMincho-Bold", 16: "Craft Mincho"}
    for name in font["name"].names:
        if name.nameID in names:
            name.string = names[name.nameID].encode(name.getEncoding())
    font.flavor = "woff2"
    font.save(DEST)
    print(f"wrote {DEST.relative_to(ROOT)} ({DEST.stat().st_size:,} bytes, {len(font.getBestCmap())} chars)")


if __name__ == "__main__":
    main()
