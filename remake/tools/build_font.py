"""リメイク版の本文フォント（しっぽり明朝 B1）を、ゲームで使う文字に絞って woff2 にする。

使い方:
    pip install fonttools brotli
    python3 remake/tools/build_font.py <元TTFのあるフォルダ>
      （フォルダに ShipporiMinchoB1-Medium.ttf / -Bold.ttf を置く。
        入手元: https://github.com/google/fonts/tree/main/ofl/shipporiminchob1 ・SIL OFL 1.1）

収録する文字 = 旧書体（Zen Kaku Gothic New）の同梱サブセットが持っていた字種
               ＋ data/ と remake/ に実際に出てくる全文字。
しっぽり明朝 B1 が持たない35字（℃・罫線・数学記号・キリル文字など、ヴォルクのロシア語と
レイの「†黒羅雨℃†」で使う）は、同梱済みの Zen Old Mincho Blue から字形を補って合成する
（端末のフォールバックに頼ると機種で見た目が変わるため）。太さは 500 / 700 の2段で、
800〜900 の指定は CSS 側で 700 のフェイスが受ける（重さ対策）。
"""
import sys
from pathlib import Path

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "remake" / "fonts"
WEIGHTS = ("Medium", "Bold")
FEATURES = ["kern", "liga", "ccmp", "locl", "mark", "mkmk"]
# しっぽり明朝 B1 に無く、Zen Old Mincho Blue から補う字（℃、記号、キリル）
SUPPLEMENT = [
    0x0412, 0x0414, 0x0416, 0x0422, 0x0434, 0x0435, 0x0437, 0x0438, 0x0439,
    0x043B, 0x043C, 0x043D, 0x043E, 0x0441, 0x0442, 0x0445, 0x0447, 0x044B,
    0x044C, 0x2103, 0x2208, 0x221E, 0x2252, 0x2261, 0x2266, 0x226B, 0x2500,
    0x2501, 0x25EF, 0xFF1C, 0xFF1E, 0xFF3E, 0xFF40, 0xFF5C, 0xFF61,
]


def used_chars():
    chars = set()
    for base, exts in ((ROOT / "data", ("*.json",)), (ROOT / "remake", ("*.js", "*.json", "*.html", "*.css"))):
        for ext in exts:
            for p in base.rglob(ext):
                chars.update(p.read_text(encoding="utf-8", errors="ignore"))
    return chars


def subset_font(src_path, unicodes, out_path):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = FEATURES
    opts.hinting = False
    opts.desubroutinize = True
    font = subset.load_font(str(src_path), opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=",".join(f"U+{c:04X}" for c in sorted(unicodes)))
    sub.subset(font)
    subset.save_font(font, str(out_path), opts)
    return TTFont(str(out_path)).getBestCmap()


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    blue_path = OUT / "ZenOldMincho-Blue-Regular.woff2"
    blue_cmap = TTFont(str(blue_path)).getBestCmap()
    base_unicodes = {ord(c) for c in used_chars()} | set(SUPPLEMENT)
    # 収録済みフォントが持つ字種は落とさない（安全集合として引き継ぐ）
    shipped = OUT / "ShipporiMinchoB1-Medium.woff2"
    if shipped.exists():
        base_unicodes |= set(TTFont(str(shipped)).getBestCmap())
    tmp = OUT / ".build_font_tmp"
    tmp.mkdir(exist_ok=True)
    try:
        supp_path = tmp / "supp.woff2"
        subset_font(blue_path, [c for c in SUPPLEMENT if c in blue_cmap], supp_path)
        for name in WEIGHTS:
            sub_path = tmp / f"ShipporiMinchoB1-{name}.woff2"
            cmap = subset_font(src / f"ShipporiMinchoB1-{name}.ttf", base_unicodes, sub_path)
            missing = [c for c in SUPPLEMENT if c not in cmap]
            dst = OUT / f"ShipporiMinchoB1-{name}.woff2"
            if missing:
                merged = Merger().merge([str(sub_path), str(supp_path)])
                merged.flavor = "woff2"
                merged.save(str(dst))
            else:
                sub_path.replace(dst)
            print(f"{dst.relative_to(ROOT)}: {dst.stat().st_size // 1024} KB")
    finally:
        for p in tmp.iterdir():
            p.unlink()
        tmp.rmdir()


if __name__ == "__main__":
    main()
