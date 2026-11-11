"""カードゲーム「一台勝負」の絵を、採用した PNG から画面用の WebP にし、ゲームが読む一覧を書き直す。
依頼と記録は asset_sources/card_game/README.md。

使い方:
  python3 remake/tools/build_ichidai_art.py          # 作り直す
  python3 remake/tools/build_ichidai_art.py --check  # 一覧と WebP が採用した PNG とそろっているかだけ確かめる（何も書かない）

- 採用した絵を assets/ui/ichidai/<種類>/<id>.png に置く。種類は flavor（葉）・card（デッキのカード）・table（卓の天板）。
  id は remake/js/minigames/ichidai-data.js の FLAVORS / CARDS の id。卓の天板は counter。
- flavor と card は正方形の絵。中央を正方形に切って 512×512 の WebP にする（画面では最大 120px 角ほど。2倍強）。
- table は横長の絵。16:9 に切って 1280×720 の WebP にする。
- remake/img/ui/ichidai/<種類>/<id>.webp を書き、remake/js/minigames/ichidai-art.js の一覧（ICHIDAI_ART）を置いた絵にそろえる。
  一覧に無い絵は読みに行かないので、絵が無いカードは色と1文字のまま出る。
- どちらも新しい画像なので Git LFS になる（git add のあと git lfs ls-files で確かめる）。
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PNG_DIR = ROOT / "assets" / "ui" / "ichidai"
WEBP_DIR = ROOT / "remake" / "img" / "ui" / "ichidai"
ART_JS = ROOT / "remake" / "js" / "minigames" / "ichidai-art.js"
DATA_JS = ROOT / "remake" / "js" / "minigames" / "ichidai-data.js"
KINDS = {"flavor": (512, 512), "card": (512, 512), "table": (1280, 720)}
TABLE_IDS = {"counter"}


def known_ids():
    """ichidai-data.js から、葉とカードの id を読む（一覧に無い名前の絵を混ぜない）。"""
    text = DATA_JS.read_text(encoding="utf-8")
    flavors = text[text.index("export const FLAVORS"):text.index("export const BOWLS")]
    cards = text[text.index("export const CARDS"):text.index("export const TYPE_LABEL")]
    ids = lambda block: set(re.findall(r'\{ id: "([a-z0-9_]+)"', block))
    return {"flavor": ids(flavors), "card": ids(cards), "table": TABLE_IDS}


def cover(image, size):
    """中央を目的の縦横比に切ってから縮める（拡大はしない）。"""
    from PIL import Image  # 作り直すときだけ要る（--check は CI の quick でも動くよう、Pillow 無しで通す）
    w, h = image.size
    tw, th = size
    ratio = tw / th
    if w / h > ratio:
        nw = round(h * ratio); box = ((w - nw) // 2, 0, (w - nw) // 2 + nw, h)
    else:
        nh = round(w / ratio); box = (0, (h - nh) // 2, w, (h - nh) // 2 + nh)
    cut = image.crop(box)
    if cut.size[0] > tw:
        cut = cut.resize((tw, th), Image.LANCZOS)
    return cut


def collect():
    valid, found, errors = known_ids(), {}, []
    for kind in KINDS:
        found[kind] = []
        for path in sorted((PNG_DIR / kind).glob("*.png")) if (PNG_DIR / kind).is_dir() else []:
            if path.stem not in valid[kind]:
                errors.append(f"{path.relative_to(ROOT)}: {kind} に {path.stem} という id は無い")
                continue
            found[kind].append(path.stem)
    return found, errors


def art_js(found):
    text = ART_JS.read_text(encoding="utf-8")
    block = "export const ICHIDAI_ART = Object.freeze({\n" + "".join(
        f"  {kind}: [{', '.join(repr(i).replace(chr(39), chr(34)) for i in found[kind])}],\n" for kind in KINDS) + "});"
    return re.sub(r"export const ICHIDAI_ART = Object\.freeze\(\{.*?\}\);", lambda _m: block, text, count=1, flags=re.S)


def main():
    check = "--check" in sys.argv
    found, errors = collect()
    new_js = art_js(found)
    if check:
        if new_js != ART_JS.read_text(encoding="utf-8"):
            errors.append("ichidai-art.js の一覧が、assets/ui/ichidai の絵とそろっていない（build_ichidai_art.py を実行する）")
        for kind, ids in found.items():
            for i in ids:
                if not (WEBP_DIR / kind / f"{i}.webp").is_file():
                    errors.append(f"remake/img/ui/ichidai/{kind}/{i}.webp が無い")
        for kind in KINDS:
            for path in (WEBP_DIR / kind).glob("*.webp") if (WEBP_DIR / kind).is_dir() else []:
                if path.stem not in found[kind]:
                    errors.append(f"{path.relative_to(ROOT)}: 採用した PNG が無い")
    else:
        from PIL import Image
        for kind, ids in found.items():
            for i in ids:
                out = WEBP_DIR / kind / f"{i}.webp"
                out.parent.mkdir(parents=True, exist_ok=True)
                cover(Image.open(PNG_DIR / kind / f"{i}.png").convert("RGB"), KINDS[kind]).save(out, "WEBP", quality=86, method=6)
        ART_JS.write_text(new_js, encoding="utf-8")
    for line in errors:
        print("ERROR:", line)
    total = sum(len(v) for v in found.values())
    print(f"ichidai art: {total} 枚（" + "・".join(f"{k} {len(v)}" for k, v in found.items()) + f"）{'を確かめた' if check else 'を書いた'}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
