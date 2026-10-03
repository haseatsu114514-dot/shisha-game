"""リメイク版の表示用に、画像を軽い WebP へ変換して remake/img/ に置く（元の PNG は assets/ のまま・旧版も無変更）。

使い方:  python3 remake/tools/build_manifest.py  （最後にこのスクリプトも自動で走る）
         python3 remake/tools/build_images.py    （WebP だけ作り直すとき）
- 対象: remake/data/manifest.json に載っている 背景・CG・立ち絵・作業台素材 ＋ タイトル絵・ロゴ
- 1枚ずつ「可逆（ドット絵の輪郭がにじまない）」と「非可逆 q90」を作り、小さいほうを採る
- 作業台素材は長辺 1280px まで縮める（画面上の最大表示より大きい分は通信の無駄）
- 変換済みで元より新しいファイルは作り直さない。作った一覧は manifest.json の "webp" に書く
  （ゲームは一覧にある画像だけ WebP を使い、無いものは assets/ の PNG を読む）
"""
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"
OUT = ROOT / "remake" / "img"
MANIFEST = ROOT / "remake" / "data" / "manifest.json"
MAX_EDGE = {"ui/making": 1280}


def targets(m):
    rel = [f"backgrounds/{b}" for b in m["backgrounds"]]
    rel += [f"cgs/{c}" for c in m["cgs"]]
    rel += [f"ui/making/{x}" for x in m["making"]]
    rel += [f"ui/scene_props/{x}" for x in m.get("sceneProps", [])]
    for ch, p in m["portraits"].items():
        rel += [f"sprites/characters/{ch}/chr_{ch}_{f}.png" for f in p["faces"]]
    rel += ["ui/title_arts/title_art_keyvisual_01.png", "ui/ui_title_logo.png"]
    return [r for r in rel if (ASSETS / r).exists()]


def encode(src: Path, rel: str) -> bytes:
    im = Image.open(src)
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if has_alpha else "RGB")
    for prefix, edge in MAX_EDGE.items():
        if rel.startswith(prefix) and max(im.size) > edge:
            k = edge / max(im.size)
            im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    # かふかの清書版は、再生成しても原画の線・塗り・アルファを劣化させない。
    if rel.startswith("sprites/characters/kafuka/"):
        b = io.BytesIO()
        im.save(b, "WEBP", lossless=True, quality=100, method=6, exact=True)
        return b.getvalue()
    best = None
    for opts in ({"lossless": True, "method": 6}, {"quality": 90, "method": 6}):
        b = io.BytesIO()
        im.save(b, "WEBP", **opts)
        if best is None or len(b.getvalue()) < len(best):
            best = b.getvalue()
    return best


def main():
    m = json.loads(MANIFEST.read_text(encoding="utf-8"))
    done, before, after = [], 0, 0
    for rel in targets(m):
        src = ASSETS / rel
        dst = OUT / Path(rel).with_suffix(".webp")
        if not (dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime):
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(encode(src, rel))
        done.append(rel)
        before += src.stat().st_size
        after += dst.stat().st_size
    m["webp"] = sorted(done)
    MANIFEST.write_text(json.dumps(m, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(done)} images: PNG {before / 1e6:.1f}MB -> WebP {after / 1e6:.1f}MB")


if __name__ == "__main__":
    main()
