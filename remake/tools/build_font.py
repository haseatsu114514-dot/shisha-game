"""リメイク版の本文フォント（Noto Sans JP）を、ゲームで使う文字に絞って woff2 にする。

使い方:
    pip install fonttools brotli
    python3 remake/tools/build_font.py <元フォントのあるフォルダ>
      （フォルダに NotoSansJP[wght].ttf（可変フォント）と、補完用の
        ZenKakuGothicNew-Medium.ttf / -Bold.ttf を置く。
        入手元: https://github.com/google/fonts/tree/main/ofl/notosansjp ・
                https://github.com/google/fonts/tree/main/ofl/zenkakugothicnew
                いずれも SIL OFL 1.1）

起動用の部分書体だけを作り直す: python3 remake/tools/build_font.py --title

収録する文字 = 同梱済みサブセットが持っていた字種（安全集合として引き継ぐ）
               ＋ data/ と remake/ に実際に出てくる全文字。
Noto Sans JP が持たない字（キリル文字など、ヴォルクのロシア語で使う）は、
以前の本文フォントだった Zen Kaku Gothic New から字形を補い、別ファイルの
補完フェイスとして CSS の unicode-range で割り当てる
（端末のフォールバックに頼ると機種で見た目が変わるため）。
太さは可変フォントを 500 / 700 に固定した2段で、800〜900 の指定は CSS 側で
700 のフェイスが受ける（重さ対策）。
"""
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "remake" / "fonts"
WEIGHTS = (("Medium", 500), ("Bold", 700))
FEATURES = ["kern", "liga", "ccmp", "locl", "mark", "mkmk"]
# Noto Sans JP に無いことが分かっている字（℃・記号・キリル）。実際の補完は
# サブセット後の欠けを計算して行うため、この一覧は保証対象の明示用。
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
    # Noto Sans JP の cmap format 14（異体字セレクタ）があると fontTools の
    # subset が落ちるため、事前に取り除く（ゲームでは異体字セレクタを使わない）
    probe = TTFont(str(src_path))
    if "cmap" in probe and any(t.format == 14 for t in probe["cmap"].tables):
        probe["cmap"].tables = [t for t in probe["cmap"].tables if t.format != 14]
        stripped = Path(str(src_path) + ".nouvs")
        probe.save(str(stripped))
        src_path = stripped
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = FEATURES
    opts.hinting = False
    opts.desubroutinize = True
    # 可変フォント由来の HVAR 等が残ると Merger が VarStore で落ちるため落とす
    opts.drop_tables += ["HVAR", "VVAR", "MVAR", "STAT"]
    font = subset.load_font(str(src_path), opts)
    # fontTools 4.68 では Noto Sans JP に対して unicodes 指定の closure が
    # 落ちるため、cmap から引いたグリフ名で populate する
    src_cmap = TTFont(str(src_path)).getBestCmap()
    sub = subset.Subsetter(opts)
    sub.populate(glyphs=[src_cmap[c] for c in sorted(unicodes) if c in src_cmap])
    sub.subset(font)
    subset.save_font(font, str(out_path), opts)
    return TTFont(str(out_path)).getBestCmap()


def build_title_fonts():
    """タイトルとロード漫画で使う文字。未収録の文字は CSS で元の同書体へ戻す。"""
    paths = ["index.html", "js/scenes/title.js", "js/scenes/saves.js", "js/core/loading.js",
             "js/core/loading-comics.js", "js/core/chapter-clock.js"]
    text = "".join((OUT.parent / rel).read_text(encoding="utf-8") for rel in paths)
    codes = set(map(ord, text)) | set(range(32, 127)) | set(range(0x3041, 0x3100))
    for weight, _ in WEIGHTS:
        subset_font(OUT / f"NotoSansJP-{weight}.woff2", codes, OUT / f"Title-{weight}.woff2")


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    base_unicodes = {ord(c) for c in used_chars()} | set(SUPPLEMENT)
    # 収録済みフォントが持つ字種は落とさない（安全集合として引き継ぐ）
    for shipped_name in ("NotoSansJP-Medium.woff2", "ShipporiMinchoB1-Medium.woff2"):
        shipped = OUT / shipped_name
        if shipped.exists():
            base_unicodes |= set(TTFont(str(shipped)).getBestCmap())
            break
    if (OUT / "supplement-ranges.txt").exists():
        (OUT / "supplement-ranges.txt").unlink()
    tmp = OUT / ".build_font_tmp"
    tmp.mkdir(exist_ok=True)
    try:
        var_path = src / "NotoSansJP[wght].ttf"
        for name, wght in WEIGHTS:
            inst_path = tmp / f"NotoSansJP-{name}.ttf"
            vf = TTFont(str(var_path))
            instantiateVariableFont(vf, {"wght": wght})
            vf.save(str(inst_path))
            sub_path = tmp / f"NotoSansJP-{name}.woff2"
            # フォントに無い字を subset へ渡すと fontTools が落ちる字種があるため、
            # 実在する字だけを渡し、欠けは下の補完で埋める
            noto_cmap = TTFont(str(inst_path)).getBestCmap()
            cmap = subset_font(inst_path, [c for c in base_unicodes if c in noto_cmap], sub_path)
            donor_path = src / f"ZenKakuGothicNew-{name}.ttf"
            donor_cmap = TTFont(str(donor_path)).getBestCmap()
            missing = [c for c in sorted(base_unicodes) if c not in cmap and c in donor_cmap]
            dst = OUT / f"NotoSansJP-{name}.woff2"
            sub_path.replace(dst)
            # 補完字は合成せず、別ファイルにして CSS 側で unicode-range 付きの
            # 同名 @font-face として割り当てる（fontTools の Merger が可変フォント
            # 由来の VarStore を合成できないため）。範囲は base.css の
            # "Suien Gothic" 補完フェイスと supplement-ranges.txt に転記すること。
            if missing:
                supp_dst = OUT / f"NotoSansJP-Supp-{name}.woff2"
                subset_font(donor_path, missing, supp_dst)
                rng = ",".join(f"U+{c:04X}" for c in missing)
                (OUT / "supplement-ranges.txt").write_text(
                    (OUT / "supplement-ranges.txt").read_text(encoding="utf-8") if (OUT / "supplement-ranges.txt").exists() else ""
                    + f"{name}: {rng}\n", encoding="utf-8")
            nowhere = [c for c in sorted(base_unicodes) if c not in cmap and c not in donor_cmap]
            print(f"{dst.relative_to(ROOT)}: {dst.stat().st_size // 1024} KB"
                  f"（補完 {len(missing)} 字 / どちらにも無い {len(nowhere)} 字"
                  + (": " + ",".join(f"U+{c:04X}" for c in nowhere[:20]) if nowhere else "") + "）")
    finally:
        for p in tmp.iterdir():
            p.unlink()
        tmp.rmdir()


if __name__ == "__main__":
    if sys.argv[1:] != ["--title"]:
        main()
    build_title_fonts()
