#!/usr/bin/env python3
"""リメイク版のアセット目録を生成する（remake/data/manifest.json）。

リメイク版は data/*.json を実行時に直接読むのでバンドル不要だが、
画像の「どれが存在するか」と「立ち絵の透過余白」はブラウザから安く
調べられないため、ここで計測して1ファイルにまとめる。

立ち絵・背景・CG・BGMを追加/差し替えたときに実行する:
    python3 remake/tools/build_manifest.py

制作UIのパーツだけを追加するとき（他の採用済み画像目録を維持する）:
    python3 remake/tools/build_manifest.py --making-only ui_mockup_inhale_button.png ui_mockup_flavor_leaf.png

新規キャラの立ち絵だけを追加するとき（他の採用済み画像を維持する）:
    python3 remake/tools/build_manifest.py --portraits-only kumicho rei volk

依存: Pillow・NumPy・SciPy（すべて必須）。pip install Pillow numpy scipy
"""

import datetime
import argparse
import json
import re
import sys
import hashlib
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Pillow が必要です: pip install Pillow numpy scipy")

try:
    import numpy as np
except ImportError:  # pragma: no cover
    sys.exit("NumPy が必要です: pip install Pillow numpy scipy")

try:
    from scipy import ndimage
except ImportError:  # pragma: no cover
    sys.exit("SciPy が必要です: pip install Pillow numpy scipy")

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"
OUT = ROOT / "remake" / "data" / "manifest.json"


def load_characters():
    """ゲームの DB.characters と同じ順序で人物定義と独立 profile を合成する。"""
    characters = {c["id"]: c for c in json.loads(
        (ROOT / "data/characters.json").read_text(encoding="utf-8"))}
    samechan = json.loads((ROOT / "data/dialogue/samechan.json").read_text(encoding="utf-8"))
    profile = samechan.get("profile")
    if profile and profile.get("id"):
        characters[profile["id"]] = profile
    return characters


def measure(png: Path, anchor="feet"):
    """本体の bbox と横アンカー。通常は足元、指定時は頭部の重心を使う。"""
    if anchor not in ("feet", "head"):
        raise ValueError(f"Unknown spriteAnchor: {anchor}")
    im = Image.open(png).convert("RGBA")
    w, h = im.size
    alpha = np.asarray(im)[..., 3]
    visible = alpha >= 24
    if not visible.any():
        return None
    labels, n = ndimage.label(visible)
    mask = visible
    if n > 1:
        # 背景消し残りの小さな島を除外し、本体（最大成分とその近傍）だけを測る
        sizes = ndimage.sum(visible, labels, range(1, n + 1))
        main = int(np.argmax(sizes)) + 1
        near = ndimage.binary_dilation(labels == main, iterations=12)
        keep = np.zeros(n + 1, dtype=bool)
        for i, size in enumerate(sizes, start=1):
            keep[i] = i == main or size >= sizes[main - 1] * 0.01 or bool((labels == i)[near].any())
        mask = keep[labels]
    ys, xs = np.where(mask)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    band = max(1, int((y1 - y0) * 0.2))
    anchor_top, anchor_bottom = (y0, y0 + band) if anchor == "head" else (y1 - band, y1)
    _, fxs = np.where(mask[anchor_top:anchor_bottom])
    feet = float(fxs.mean()) if len(fxs) else (x0 + x1) / 2
    return {"top": y0 / h, "bottom": y1 / h, "ax": feet / w, "aspect": w / h}


def portraits(character_ids=None):
    """キャラごとに表情一覧と共通の framing 値（全表情で同じ＝表情を変えても絵が動かない）。"""
    out = {}
    base = ASSETS / "sprites" / "characters"
    anchor_modes = {cid: c.get("spriteAnchor", "feet")
                    for cid, c in load_characters().items()}
    for d in sorted(p for p in base.iterdir() if p.is_dir()):
        if character_ids is not None and d.name not in character_ids:
            continue
        faces, metrics = [], {}
        for png in sorted(d.glob(f"chr_{d.name}_*.png")):
            m = re.match(rf"chr_{re.escape(d.name)}_(.+)\.png$", png.name)
            if not m:
                continue
            faces.append(m.group(1))
            r = measure(png, anchor=anchor_modes.get(d.name, "feet"))
            if r:
                metrics[m.group(1)] = r
        if not faces:
            continue
        entry = {"faces": faces}
        if metrics:
            top = min(r["top"] for r in metrics.values())
            bottom = max(r["bottom"] for r in metrics.values())
            ref = metrics.get("normal") or next(iter(metrics.values()))
            entry.update({
                "h": round(bottom - top, 4),     # 本体の高さ（画像高さ比）
                "b": round(1 - bottom, 4),       # 下端の余白（画像高さ比）
                "ax": round(ref["ax"], 4),       # normal の横アンカー（全表情共通）
                "aspect": round(ref["aspect"], 4),
            })
        if anchor_modes.get(d.name) == "head":
            entry["anchor"] = "head"
        out[d.name] = entry
    return out


def making_boxes(names=None):
    """作業台パーツ（assets/ui/making）の実コンテンツ bbox（画像比 l,t,r,b）。
    キャンバスの余白が素材ごとにバラバラでも、CSS 側で絵そのものを正確に置けるようにする。"""
    out = {}
    folder = ASSETS / "ui" / "making"
    paths = [folder / name for name in names] if names else folder.glob("*.png")
    for png in sorted(paths):
        im = Image.open(png).convert("RGBA")
        box = im.getchannel("A").point(lambda a: 255 if a >= 24 else 0).getbbox()
        if box:
            w, h = im.size
            out[png.name] = [round(box[0] / w, 4), round(box[1] / h, 4), round(box[2] / w, 4), round(box[3] / h, 4), round(w / h, 4)]
    return out


def listing(sub: str, pattern: str = "*.png"):
    """実在する（0バイトのプレースホルダでない）ファイル名だけを返す。"""
    d = ASSETS / sub
    return sorted(p.name for p in d.glob(pattern) if p.stat().st_size > 0) if d.exists() else []


def title_arts():
    """採用済みPNGだけをキャラ別に登録。修正待ちの候補はassetsへコピーしない。"""
    # titleArtDisplayCharacters uses this character order when picking a title art.
    # Keep manifest groups aligned so callers indexing its unique characters agree.
    character_order = (
        "ageha", "hiyori", "samechan", "mashiro", "minto", "rin", "tsumugi",
        "sumi", "naru", "adam",
    )
    rank = {character: index for index, character in enumerate(character_order)}
    out = []
    for name in listing("ui/title_arts"):
        match = re.fullmatch(r"title_art_([a-z]+)_\d{2}_.+\.png", name)
        if match:
            out.append({"character": match[1], "file": name})
    return sorted(out, key=lambda art: (rank.get(art["character"], len(rank)), art["file"]))


def continue_portraits():
    """正規立ち絵の顔を中央に寄せる。顔アイコンと同じ測定値を元画像の比で記録。"""
    sys.path.insert(0, str(ROOT / "tools"))
    from make_face_icons import face_box
    out = {}
    for character in ("sumi", "tsumugi", "minto", "rin", "ageha", "mashiro", "samechan", "hiyori"):
        faces = {}
        for path in sorted((ASSETS / "sprites/characters" / character).glob(f"chr_{character}_*.png")):
            image = Image.open(path).convert("RGBA")
            box = face_box(character, image)
            if box:
                x, y, side = box
                face = path.stem.removeprefix(f"chr_{character}_")
                faces[face] = {"cx": round((x + side / 2) / image.width, 5),
                               "top": round(y / image.height, 5), "size": round(side / image.height, 5)}
        out[character] = faces
    return out


def intro_art(character_ids=None):
    """採用した登場背景の配色と、現行人物PNGの配置だけを目録化する。

    文言・表情・名前はゲームで正本データから読む。レビューの台詞を複製しない。
    """
    source = ROOT / "asset_sources/character-intros/ch1-v3/characters.json"
    records = json.loads(source.read_text())
    for collection in ("ch3-v1", "recent-cast"):
        records += json.loads((ROOT / f"asset_sources/character-intros/{collection}/characters.json").read_text())
    out = {}
    for record in records:
        cid = record["id"].removesuffix("_unknown")
        if character_ids is not None and cid not in character_ids:
            continue
        background = ASSETS / f"ui/character_intros/{cid}.png"
        if not background.exists():
            continue
        art = out.setdefault(cid, {
            "color": record["color"], "secondary": record["secondary"],
            "shadow": record["shadow"], "background": f"ui/character_intros/{cid}.png",
            "frames": {},
        })
        folder = "minto" if cid == "oneesan" else cid
        for png in (ASSETS / f"sprites/characters/{folder}").glob(f"chr_{folder}_*.png"):
            face = png.stem.removeprefix(f"chr_{folder}_")
            if cid == "oneesan" and not face.startswith("ura_"):
                continue
            if face in art["frames"]:
                continue
            im = Image.open(png).convert("RGBA")
            alpha = np.asarray(im)[..., 3]
            ys, xs = np.where(alpha >= 20)
            if not len(xs):
                continue
            x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
            scale = (560 if cid == "pakki" else 1140) / (y1 - y0)
            weights = alpha[y0:y0 + max(1, int((y1 - y0) * .2))].astype(float)
            head_x = float((weights.sum(axis=0) * np.arange(im.width)).sum() / weights.sum())
            art["frames"][face] = {
                "width": round(im.width * scale, 3),
                "left": round(304 - head_x * scale - (36 if cid in ("hajime", "sumi", "tsumugi") else 0), 3),
                "top": round((100 if cid == "pakki" else 38) - y0 * scale, 3),
            }
        # 採用時の構図が現在の同じ人物PNGに対応している場合はそのまま使う。
        face = record["expression"]
        png = ASSETS / f"sprites/characters/{folder}/chr_{folder}_{face}.png"
        if record.get("frame") and png.exists() and hashlib.sha256(png.read_bytes()).hexdigest() == record["portrait_sha256"]:
            art["frames"][face] = record["frame"]
    return out


def is_placeholder(path: Path) -> bool:
    """文字だけの仮置き画像（無地の背景に説明文）を見分ける。ほぼ1色で埋まっていれば仮置きとみなす"""
    im = Image.open(path).convert("RGB").resize((160, 90))
    a = np.asarray(im).reshape(-1, 3).astype(int)
    vals, counts = np.unique(a // 8, axis=0, return_counts=True)
    return counts.max() / len(a) > 0.8


def lime_media():
    """LIME の採用素材だけを登録し、ゲーム用ファイルの寸法を照合する。"""
    catalog = json.loads((ROOT / "remake/data/lime_media.json").read_text(encoding="utf-8"))
    for entry in catalog.values():
        with Image.open(ROOT / "remake" / entry["src"]) as image:
            if image.size != (entry["width"], entry["height"]):
                raise ValueError(f"LIME素材の寸法が不一致: {entry['src']}")
    return catalog


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    scope = parser.add_mutually_exclusive_group()
    scope.add_argument("--lime-only", action="store_true", help="LIME素材台帳だけ更新")
    scope.add_argument("--audio-only", action="store_true", help="既存の画像目録を保ち、BGM一覧だけ更新")
    scope.add_argument("--title-only", action="store_true", help="採用済みタイトル絵の目録・WebPだけ更新")
    scope.add_argument("--backgrounds-only", nargs="+", metavar="PNG", help="指定した背景の目録・WebPだけ更新")
    scope.add_argument("--cgs-only", nargs="+", metavar="PNG", help="指定したCGの目録・WebPだけ更新")
    scope.add_argument("--making-only", nargs="+", metavar="PNG", help="指定した制作UIパーツの目録・WebPだけ更新")
    scope.add_argument("--scene-props-only", nargs="+", metavar="PNG", help="指定した背景の重ね素材の目録・WebPだけ更新")
    scope.add_argument("--portraits-only", nargs="+", metavar="ID", help="指定した人物の立ち絵計測・WebPだけ更新")
    scope.add_argument("--intros-only", nargs="+", metavar="ID", help="指定した人物の登場背景・配置・WebPだけ更新")
    args = parser.parse_args()
    generated = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    if args.intros_only:
        import build_images
        ids = set(args.intros_only)
        entries = intro_art(ids)
        if ids != entries.keys() or any(not art["frames"] for art in entries.values()):
            parser.error("指定した登場背景・立ち絵が揃っていません")
        manifest = json.loads(OUT.read_text(encoding="utf-8"))
        manifest["generated"] = generated
        manifest.setdefault("introArt", {}).update(entries)
        webp = list(manifest.get("webp", []))
        for art in entries.values():
            rel = art["background"]
            dst = build_images.OUT / Path(rel).with_suffix(".webp")
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(build_images.encode(ASSETS / rel, rel))
            if rel not in webp:
                webp.append(rel)
        manifest["webp"] = webp
        OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"wrote {len(entries)} intro backgrounds, portrait frames and WebP files")
        return
    if args.cgs_only:
        import build_images
        names = sorted(set(args.cgs_only))
        for name in names:
            src = ASSETS / "cgs" / name
            if Path(name).name != name or not name.endswith(".png") or not src.is_file() or is_placeholder(src):
                parser.error(f"完成CGのPNGがありません: {name}")
        manifest = json.loads(OUT.read_text(encoding="utf-8"))
        manifest["generated"] = generated
        manifest["cgs"] = sorted(set(manifest["cgs"]) | set(names))
        webp = list(manifest.get("webp", []))
        for name in names:
            rel = f"cgs/{name}"
            dst = build_images.OUT / Path(rel).with_suffix(".webp")
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(build_images.encode(ASSETS / rel, rel))
            if rel not in webp:
                webp.append(rel)
        manifest["webp"] = webp
        OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"wrote {len(names)} CGs and WebP files (other images unchanged)")
        return
    if args.portraits_only:
        import build_images
        ids = sorted(set(args.portraits_only))
        known = load_characters()
        for cid in ids:
            if cid not in known:
                parser.error(f"人物設定がありません: {cid}")
        entries = portraits(ids)
        for cid in ids:
            if cid not in entries or "normal" not in entries[cid]["faces"]:
                parser.error(f"通常立ち絵のPNGがありません: {cid}")
        manifest = json.loads(OUT.read_text(encoding="utf-8"))
        manifest["generated"] = generated
        manifest["portraits"].update(entries)
        webp = list(manifest.get("webp", []))
        for cid, entry in entries.items():
            for face in entry["faces"]:
                rel = f"sprites/characters/{cid}/chr_{cid}_{face}.png"
                dst = build_images.OUT / Path(rel).with_suffix(".webp")
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.write_bytes(build_images.encode(ASSETS / rel, rel))
                if rel not in webp:
                    webp.append(rel)
        manifest["webp"] = webp
        OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"wrote {len(entries)} portrait families and WebP files (other images unchanged)")
        return
    if args.backgrounds_only:
        import build_images
        names = sorted(set(args.backgrounds_only))
        for name in names:
            if Path(name).name != name or not name.endswith(".png") or not (ASSETS / "backgrounds" / name).is_file():
                parser.error(f"背景のPNGがありません: {name}")
        manifest = json.loads(OUT.read_text(encoding="utf-8"))
        manifest["generated"] = generated
        manifest["backgrounds"] = sorted(set(manifest["backgrounds"]) | set(names))
        webp = set(manifest.get("webp", []))
        for name in names:
            rel = f"backgrounds/{name}"
            dst = build_images.OUT / Path(rel).with_suffix(".webp")
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(build_images.encode(ASSETS / rel, rel))
            webp.add(rel)
        manifest["webp"] = sorted(webp)
        OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"wrote {len(names)} backgrounds and WebP files (other images unchanged)")
        return
    if args.title_only:
        import build_images
        manifest = json.loads(OUT.read_text(encoding="utf-8"))
        manifest.update(generated=generated, titleArts=title_arts())
        webp = set(manifest.get("webp", []))
        for art in manifest["titleArts"]:
            rel = f"ui/title_arts/{art['file']}"
            dst = build_images.OUT / Path(rel).with_suffix(".webp")
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(build_images.encode(ASSETS / rel, rel))
            webp.add(rel)
        manifest["webp"] = sorted(webp)
        OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"wrote {len(manifest['titleArts'])} title arts and WebP files (other images unchanged)")
        return
    if args.scene_props_only:
        import build_images
        names = sorted(set(args.scene_props_only))
        for name in names:
            if Path(name).name != name or not name.endswith(".png") or not (ASSETS / "ui/scene_props" / name).is_file():
                parser.error(f"背景の重ね素材PNGがありません: {name}")
        manifest = json.loads(OUT.read_text(encoding="utf-8"))
        manifest["generated"] = generated
        manifest["sceneProps"] = sorted(set(manifest.get("sceneProps", [])) | set(names))
        webp = set(manifest.get("webp", []))
        for name in names:
            rel = f"ui/scene_props/{name}"
            dst = build_images.OUT / Path(rel).with_suffix(".webp")
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(build_images.encode(ASSETS / rel, rel))
            webp.add(rel)
        manifest["webp"] = sorted(webp)
        OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"wrote {len(names)} scene props and WebP files (other images unchanged)")
        return
    if args.making_only:
        import build_images
        names = sorted(set(args.making_only))
        for name in names:
            if Path(name).name != name or not name.endswith(".png") or not (ASSETS / "ui/making" / name).is_file():
                parser.error(f"制作UIのPNGがありません: {name}")
        manifest = json.loads(OUT.read_text(encoding="utf-8"))
        manifest["generated"] = generated
        manifest["making"] = sorted(set(manifest["making"]) | set(names))
        manifest["makingBox"].update(making_boxes(names))
        manifest["makingBox"] = dict(sorted(manifest["makingBox"].items()))
        webp = set(manifest.get("webp", []))
        for name in names:
            rel = f"ui/making/{name}"
            dst = build_images.OUT / Path(rel).with_suffix(".webp")
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(build_images.encode(ASSETS / rel, rel))
            webp.add(rel)
        manifest["webp"] = sorted(webp)
        OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"wrote {OUT.relative_to(ROOT)}: {len(names)} making parts and WebP files (other images unchanged)")
        return
    if args.lime_only:
        manifest = json.loads(OUT.read_text(encoding="utf-8"))
        manifest["limeMedia"] = lime_media()
        OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print("wrote remake/data/manifest.json: LIME media (other assets unchanged)")
        return
    bgm = sorted(listing("audio/bgm", "*.mp3") + listing("audio/bgm", "*.bgm"))
    if args.audio_only:
        manifest = json.loads(OUT.read_text(encoding="utf-8"))
        manifest.update(generated=generated, bgm=bgm)
        OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"wrote {OUT.relative_to(ROOT)}: {len(bgm)} BGM files (images unchanged)")
        return
    manifest = {
        "_comment": "自動生成。編集しない。再生成: python3 remake/tools/build_manifest.py",
        "generated": generated,
        "limeMedia": lime_media(),
        "portraits": portraits(),
        "backgrounds": listing("backgrounds"),
        # 仮置きCG（文字だけの画像）は載せない＝場面では飛ばし、ギャラリーにも出さない
        "cgs": [f for f in listing("cgs") if not is_placeholder(ASSETS / "cgs" / f)],
        "faceIcons": listing("ui/face_icons"),
        "making": listing("ui/making"),
        "sceneProps": listing("ui/scene_props"),
        "continueUI": listing("ui/continue"),
        "continuePortraits": continue_portraits(),
        "introArt": intro_art(),
        "titleArts": title_arts(),
        "makingBox": making_boxes(),
        "bgm": bgm,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(manifest['portraits'])} characters, "
          f"{len(manifest['backgrounds'])} backgrounds, {len(manifest['cgs'])} cgs")
    # 表示用の軽い WebP（remake/img/）も作る。変換済みで新しいものは飛ばすので2回目以降は速い
    import build_images
    build_images.main()


if __name__ == "__main__":
    main()
