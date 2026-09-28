"""リメイク版の文字フォント（Zen Kaku Gothic New）を、ゲームで使う文字に絞って woff2 にする。

使い方:
    pip install fonttools brotli
    python3 remake/tools/build_font.py <元TTFのあるフォルダ>
      （フォルダに ZenKakuGothicNew-Medium.ttf / -Bold.ttf / -Black.ttf を置く。
        入手元: https://github.com/google/fonts/tree/main/ofl/zenkakugothicnew ・SIL OFL 1.1）

収録する文字 = JIS X 0208 の全文字（かな・記号・第1/第2水準漢字）＋ ASCII ＋
               data/ と remake/ に実際に出てくる全文字（♡・〜 などの記号も拾う）。
台詞を足しても JIS 第2水準までの漢字なら作り直し不要。見慣れない字が豆腐になったら再実行する。
"""
import sys
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "remake" / "fonts"
WEIGHTS = {"Medium": 500, "Bold": 700, "Black": 900}


def jis_x0208():
    chars = set()
    for hi in range(0xA1, 0xFF):
        for lo in range(0xA1, 0xFF):
            try:
                chars.add(bytes([hi, lo]).decode("euc_jp"))
            except UnicodeDecodeError:
                pass
    return chars


def used_chars():
    chars = set()
    for base, exts in ((ROOT / "data", ("*.json",)), (ROOT / "remake", ("*.js", "*.json", "*.html", "*.css"))):
        for ext in exts:
            for p in base.rglob(ext):
                chars.update(p.read_text(encoding="utf-8", errors="ignore"))
    return chars


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    text = jis_x0208() | used_chars() | {chr(c) for c in range(0x20, 0x7F)} | set("　、。〜ー―…‥♡♥★☆♪・「」『』【】（）！？")
    text = "".join(sorted(c for c in text if c.isprintable() or c == "　"))
    OUT.mkdir(parents=True, exist_ok=True)
    for name in WEIGHTS:
        ttf = src / f"ZenKakuGothicNew-{name}.ttf"
        dst = OUT / f"ZenKakuGothicNew-{name}.woff2"
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]
        opts.notdef_outline = True
        font = subset.load_font(str(ttf), opts)
        sub = subset.Subsetter(opts)
        sub.populate(text=text)
        sub.subset(font)
        subset.save_font(font, str(dst), opts)
        print(f"{dst.relative_to(ROOT)}: {dst.stat().st_size // 1024} KB")
    print(f"{len(text)} chars")


if __name__ == "__main__":
    main()
