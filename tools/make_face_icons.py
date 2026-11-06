#!/usr/bin/env python3
"""立ち絵から顔ドット絵アイコンを生成する。

assets/sprites/characters/{id}/chr_{id}_normal.png の頭部を切り出し、
160x160 に縮小 → 256色に減色した顔アイコンにする。
出力: assets/ui/face_icons/face_{id}.png と、ゲームが読む WebP（remake/img/ui/face_icons/face_{id}.webp）
（UIの好感度バナー・マップピン・LIME画面のアバターに使う）

設定の「会話の立ち絵」で選べる別の画風（新バージョン＝new）も、その画風の通常絵から同じ枠で作る
（2026-11-06 オーナー「顔アイコンを新バージョンの立ち絵に合わせる」）。
出力: assets/ui/face_icons/new/face_{id}.png（ゲームは新バージョンを選んでいる時だけこちらを出す）。
顔の位置を測った画風（data/portrait_metrics.json の styles）だけ作る。測っていない画風は現行のアイコンのまま。

使い方:
    python3 tools/make_face_icons.py            # 全キャラ・全画風を生成
    python3 tools/make_face_icons.py --sheet    # 確認用シートも出力
    python3 tools/make_face_icons.py rio samechan # 指定キャラだけ生成（立ち絵を差し替えたキャラだけ更新する）
    python3 tools/make_face_icons.py --style new adam   # 新バージョンのアダムだけ
    python3 tools/make_face_icons.py --compare  # 立ち絵と顔アイコンの比較シート（asset_sources/reference-sheets/face-icons-by-style.png）
最後に remake/data/manifest.json の顔アイコンの一覧・顔の枠（faceFrames）と WebP を更新する。
"""

import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from portrait_metrics import CLASSIC, icon_box, load as load_portrait_metrics, styles as metric_styles  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
CHARS_DIR = REPO_ROOT / "assets" / "sprites" / "characters"
VARIANTS_DIR = REPO_ROOT / "assets" / "sprites" / "character_variants"
OUT_DIR = REPO_ROOT / "assets" / "ui" / "face_icons"
WEBP_DIR = REPO_ROOT / "remake" / "img" / "ui" / "face_icons"
MANIFEST = REPO_ROOT / "remake" / "data" / "manifest.json"

SIZE = 160         # 解像度（2026-10-04 オーナー指定で48→96→160。顔の切り抜きは元絵で約180〜240pxなので、これ以上は拡大になる）
COLORS = 256       # パレット色数（32色では瞳の色・肌の階調が潰れた）
# 減色後に k-means で色を詰め直す回数。median cut だけだと、面積の小さい鮮やかな色（みんと・栞の緑の瞳とピアス、
# SHISHA-9000 の目の光）が肌や髪の色にまとめられて灰色に潰れていた（2026-11-06）。4回で全員の誤差が減る
KMEANS = 4

# 顔の切り抜き枠は data/portrait_metrics.json（立ち絵ごとに測った目・あご・頭頂・頬の位置）から決める
# （2026-11-02 立ち絵の規格 docs/portrait_standard.md）。顔の大きさ（頭頂〜あごの高さ×頬の幅の相乗平均）が
# 枠の spec.icon.face 倍、頭の上下の中央が上から spec.icon.mid_y、頬の左右の中央が枠の中央に来る。
# 値は 2026-10-04〜10-10 にオーナー確認で手調整した主要キャラのアイコン（「顔のサイズ近くなるように」）の中央値。
# 立ち絵を差し替えたら tools/portrait_metrics.py で測り直す（古い記録のままだと、このスクリプトは止まる）。
#
# TUNE は測れないキャラだけの手調整（キャラ固有の例外。どの画風にも使う）。
#   f:  辺 = 本体の高さ ch * f（大きいほど引き＝顔が小さく写る）
#   dx/dy: 辺に対する比での微調整（+で右/下）
#   size: そのキャラだけ解像度を変える（既定は SIZE）
#   abs: 画像全体に対する顔中心 cx/cy と辺 side の比で指定する
DEFAULT = {"f": 0.20, "dx": 0.0, "dy": 0.0}
TUNE = {
    # マスコット。2026-10-09 に目・口・蝶ネクタイまで寄せたが、頭の巻き毛が切れたため（#575）、巻き毛の先から蝶ネクタイまで収める
    "pakki":   {"f": 0.70, "dx": -0.03, "dy": 0.12},
}
# 別衣装のアイコン: 出力名 → (キャラのフォルダ, 表情)。
# minto_private = 本名「栞」を聞いた後の私的な場面（LIME・恋人の絆）で使う私服の顔
EXTRA = {"minto_private": ("minto", "ura_normal")}
# 頭部重心を取るスライス（bbox上端からコンテンツ高さのこの比率まで）
HEAD_SLICE = 0.14
# 円形アイコンで頭が切れないよう、上に持たせる余白（辺に対する比）
HEADROOM = 0.08
# 頭のてっぺんの上に必ず残す余白（辺に対する比。SBD84）
HEAD_ROOM = 0.03
# 頭を入れるために下へずらしてよい量（辺に対する比）。これより多く要る時は少し引いて顔を小さくする
MAX_SHIFT = 0.10


_METRICS = None


def load_metrics() -> dict:
    global _METRICS
    if _METRICS is None:
        _METRICS = load_portrait_metrics()
    return _METRICS


def metrics_entry(char_id: str, style: str = CLASSIC) -> dict | None:
    data = load_metrics()
    return (data["characters"] if style == CLASSIC else data.get("styles", {}).get(style, {})).get(char_id)


def face_box(char_id: str, im: Image.Image, style: str = CLASSIC) -> tuple[int, int, int] | None:
    """顔アイコンの切り抜き枠 (x0, y0, side) を返す。TUNE で顔の大きさを全キャラ揃えてある。
    tools/make_reference_sheet.py も同じ枠を使い、シートの顔アップの大きさをアイコンと揃える。
    style は立ち絵の画風（classic / new）。その画風の通常絵で測った記録を使う"""
    bbox = im.getbbox()
    if not bbox:
        return None
    left, top, right, bottom = bbox
    cw, ch = right - left, bottom - top
    p = {**DEFAULT, **TUNE.get(char_id, {})}
    entry = metrics_entry(char_id, style)
    if char_id not in TUNE and entry and "chin" in entry:
        bx, by, bside = icon_box(entry, load_metrics()["spec"]["icon"])
        x0, y0, side = int(round(bx)), int(round(by)), int(round(bside))
    elif p.get("abs"):
        side = int(im.height * p["side"])
        x0 = int(im.width * p["cx"] - side / 2)
        y0 = int(im.height * p["cy"] - side / 2)
    else:
        side = int(ch * p["f"])
        # 頭部スライス（bbox上端付近）のアルファ重心 = 顔の横中心。
        # bbox中心だと髪・腕・持ち物に引っ張られて顔が偏る
        alpha = im.getchannel("A")
        head = alpha.crop((left, top, right, top + max(1, int(ch * HEAD_SLICE))))
        hx = head.size[0] / 2
        data = list(head.getdata())
        wsum = 0
        xsum = 0.0
        hw = head.size[0]
        for i, a in enumerate(data):
            if a > 32:
                wsum += a
                xsum += (i % hw) * a
        if wsum:
            hx = xsum / wsum
        cx = left + hx + side * p["dx"]
        x0 = int(cx - side / 2)
        y0 = int(top - side * (HEADROOM - p["dy"]))
    # 頭のてっぺん（髪・角・帽子・フード）を切らない（2026-10-31 オーナー「アイコンが上の頭切れてる」SBD84）。
    # 枠の左右の範囲で、いちばん上に絵がある行より HEAD_ROOM だけ上から始める。顔の大きさ（side）は変えず、下へずらすだけ
    alpha = im.getchannel("A")
    span = alpha.crop((max(0, x0 + side // 6), 0, min(im.width, x0 + side * 5 // 6), max(1, y0 + side // 2)))
    rows = [y for y in range(span.height) if sum(1 for v in span.crop((0, y, span.width, y + 1)).get_flattened_data() if v > 60) >= 3]
    if rows and not p.get("allow_cut"):
        head = rows[0]
        need = y0 - (head - side * HEAD_ROOM)          # 頭を入れるのに上へ広げたい量
        if need > 0:
            shift = min(need, side * MAX_SHIFT)        # まずは少しだけ下へずらす
            y0 -= int(shift)
            if need > shift:                           # それでも入らない時は、顔の真ん中を軸に少し引く
                cx, cy = x0 + side / 2, y0 + side / 2
                side = int((cy - head) / (0.5 - HEAD_ROOM)) + 1
                x0, y0 = int(cx - side / 2), int(cy - side / 2)
    return x0, y0, side


def make_icon(char_id: str, src: Path, style: str = CLASSIC) -> Image.Image | None:
    im = Image.open(src).convert("RGBA")
    box = face_box(char_id, im, style)
    if box is None:
        return None
    x0, y0, side = box
    p = {**DEFAULT, **TUNE.get(char_id, {})}
    crop = im.crop((x0, y0, x0 + side, y0 + side))
    # 縮小 → 減色（αは別管理: quantizeで半透明が荒れるのを防ぐ。輪郭は二値化せず滑らかに残す）
    size = p.get("size", SIZE)
    small = crop.resize((size, size), Image.LANCZOS)
    alpha = small.getchannel("A")
    rgb = small.convert("RGB").quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, kmeans=KMEANS)
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


SOURCES = OUT_DIR / "sources.json"


def git_version(path: Path) -> str:
    """git 上の版（blob SHA。LFS ならポインタの SHA）。手元のファイルの中身から計算する（git add 前でも add 後と同じ値）"""
    rel = str(path.relative_to(REPO_ROOT))
    if path.exists():
        out = subprocess.run(["git", "hash-object", "--", rel], cwd=REPO_ROOT, capture_output=True, text=True).stdout.strip()
        if out:
            return out
    out = subprocess.run(["git", "ls-files", "-s", "--", rel], cwd=REPO_ROOT, capture_output=True, text=True).stdout.split()
    return out[1] if len(out) >= 2 else ""


def sprite_blob(src: Path) -> str:
    """立ち絵の git 上の版（ls-files の blob SHA）。未登録なら中身の hash-object"""
    rel = str(src.relative_to(REPO_ROOT))
    out = subprocess.run(["git", "ls-files", "-s", "--", rel], cwd=REPO_ROOT, capture_output=True, text=True).stdout.split()
    if len(out) >= 2:
        return out[1]
    return subprocess.run(["git", "hash-object", rel], cwd=REPO_ROOT, capture_output=True, text=True).stdout.strip()


def sprite_root(style: str) -> Path:
    return CHARS_DIR if style == CLASSIC else VARIANTS_DIR / style


def icon_name(style: str, cid: str) -> str:
    """sources.json・manifest で使う名前（face_icons からの相対パス）"""
    return f"face_{cid}.png" if style == CLASSIC else f"{style}/face_{cid}.png"


def icon_styles() -> list[str]:
    """顔アイコンを作る画風。現行と、顔の位置を測った画風（その画風の立ち絵がある時だけ）"""
    return [s for s in metric_styles(load_metrics()) if s == CLASSIC or sprite_root(s).is_dir()]


def jobs_for(style: str) -> list[tuple[str, str, Path]]:
    """(アイコンのID, 立ち絵のフォルダ, 元の立ち絵) の一覧"""
    root = sprite_root(style)
    jobs = []
    for char_dir in sorted(root.iterdir()):
        if not char_dir.is_dir():
            continue
        cid = char_dir.name
        src = char_dir / f"chr_{cid}_normal.png"
        if not src.exists():
            if style != CLASSIC:
                continue          # 別の画風は通常絵がある人だけ（無い人は会話でも現行の絵になる）
            cands = sorted(char_dir.glob("chr_*.png"))
            if not cands:
                continue
            src = cands[0]
        jobs.append((cid, cid, src))
        jobs += [(name, cid, char_dir / f"chr_{cid}_{face}.png")
                 for name, (folder, face) in EXTRA.items() if folder == cid and (char_dir / f"chr_{cid}_{face}.png").exists()]
    return jobs


def is_pointer(path: Path) -> bool:
    """Git LFS のポインタのまま（画像の実体を取っていない）"""
    return path.exists() and path.read_bytes()[:7] == b"version"


def frames() -> dict:
    """ゲームが顔を切り出すときの枠（manifest の faceFrames）。画風ごと・人ごとに
    box = 顔アイコンと同じ切り抜き枠 [x0, y0, 辺]、eye = [頬の中央 x, 目の高さ y]、unit = 顔の大きさ（√(頭の高さ×頬の幅)）。
    座標は立ち絵（896×1200）の画素。作業台の審査員の顔（craft/audience.js）・心得の盤の顔（growth-board-screen.js）が使う"""
    out = {}
    for style in icon_styles():
        found = {}
        for cid, folder, src in jobs_for(style):
            if cid != folder or not src.exists() or is_pointer(src):
                continue
            e = metrics_entry(cid, style)
            if cid not in TUNE and not (e and "chin" in e):
                continue
            box = face_box(cid, Image.open(src).convert("RGBA"), style)
            if not box:
                continue
            item = {"box": list(box)}
            if e and "eyes" in e:
                (lx, ly), (rx, ry) = e["eyes"]
                head = e["chin"][1] - e["crown"][1]
                cheek = e["cheeks"][1] - e["cheeks"][0]
                item["eye"] = [round((e["cheeks"][0] + e["cheeks"][1]) / 2), round((ly + ry) / 2)]
                item["unit"] = round((head * cheek) ** 0.5, 1)
            found[cid] = item
        out[style] = found
    return out


CONTINUE_CAST = ("sumi", "tsumugi", "minto", "rio", "ageha", "mashiro", "samechan", "hiyori")


def continue_portraits(style: str = CLASSIC) -> dict:
    """コンティニュー画面の顔のアップ（remake/js/chapters/continue-view.js）。表情ごとに顔アイコンと同じ枠を、元画像の比で記録。
    style が new などのときは、その画風の立ち絵とその画風で測った顔の位置を使う（manifest の continuePortraitVariants）"""
    out = {}
    for character in CONTINUE_CAST:
        if style != CLASSIC and not (metrics_entry(character, style) or {}).get("chin"):
            continue          # その画風で顔の位置を測っていない（会話でも現行の絵になる人を含む）
        faces = {}
        for path in sorted((sprite_root(style) / character).glob(f"chr_{character}_*.png")):
            if is_pointer(path):
                sys.exit(f"{path.relative_to(REPO_ROOT)} は Git LFS のポインタ。git lfs pull --include=\"{path.relative_to(REPO_ROOT)}\" で実体を取る")
            image = Image.open(path).convert("RGBA")
            box = face_box(character, image, style)
            if box:
                x, y, side = box
                face = path.stem.removeprefix(f"chr_{character}_")
                faces[face] = {"cx": round((x + side / 2) / image.width, 5),
                               "top": round(y / image.height, 5), "size": round(side / image.height, 5)}
        out[character] = faces
    return out


def sync_manifest() -> None:
    """manifest の顔アイコンの一覧（faceIcons・faceIconVariants）・顔の枠（faceFrames）と WebP をアイコンに合わせる。
    WebP は毎回作り直す（2026-11-06: build_images.py は更新日時で作り直しを飛ばすので、アイコンを作り直しても
    古い切り抜きの WebP が22人分残り、ゲームではそちらが出ていた）"""
    sys.path.insert(0, str(REPO_ROOT / "remake" / "tools"))
    import build_images  # noqa: E402
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    names = sorted(p.name for p in OUT_DIR.glob("face_*.png"))
    variants = {d.name: sorted(p.name for p in d.glob("face_*.png")) for d in sorted(OUT_DIR.iterdir()) if d.is_dir()}
    manifest["faceIcons"] = names
    manifest["faceIconVariants"] = {k: v for k, v in variants.items() if v}
    manifest["faceFrames"] = frames()
    webp = {w for w in manifest.get("webp", []) if not w.startswith("ui/face_icons/")}
    for rel in [f"ui/face_icons/{n}" for n in names] + [f"ui/face_icons/{k}/{n}" for k, v in variants.items() for n in v]:
        src = build_images.ASSETS / rel
        dst = build_images.OUT / Path(rel).with_suffix(".webp")
        if not is_pointer(src):           # LFS の実体が無い手元では作れない（前の WebP をそのまま使う）
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(build_images.encode(src, rel))
        if dst.exists():
            webp.add(rel)
    manifest["webp"] = sorted(webp)
    # 現行のコンティニューの枠（continuePortraits）はオーナー確認済みの見た目なので、ここでは作り直さない（全体の再生成 build_manifest.py で作る）
    manifest["continuePortraitVariants"] = {s: continue_portraits(s) for s in icon_styles() if s != CLASSIC}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def record_webp(sources: dict) -> None:
    """アイコンごとに WebP の版も残す（tools/check_face_icons_fresh.py が PNG と WebP の食い違いを見る）"""
    for name, entry in sources.items():
        webp = WEBP_DIR / Path(name).with_suffix(".webp")
        if webp.exists():
            entry["webp"] = git_version(webp)


COMPARE_SHEET = REPO_ROOT / "asset_sources" / "reference-sheets" / "face-icons-by-style.png"
BOARD_FACES = REPO_ROOT / "remake" / "img" / "ui" / "growth_board" / "faces"


def compare_sheet() -> Path:
    """確認用の比較シート: 人ごとに、現行と新バージョンの立ち絵（顔アイコンの切り抜き枠を黄色で描く）・
    顔アイコン（ゲームと同じ丸）・心得の盤の札の顔を並べる。新バージョンの立ち絵が無い人は現行のまま（会話と同じ）"""
    from PIL import ImageDraw
    from make_reference_sheet import BG, PANEL, SUB, TEXT, font  # noqa: E402

    T, gap, name_w = 170, 10, 190
    cols = ["現行の立ち絵", "現行の顔アイコン", "現行の盤の顔", "新バージョンの立ち絵", "新バージョンの顔アイコン", "新バージョンの盤の顔"]
    rows = []
    for cid, folder, src in jobs_for(CLASSIC):
        new_src = next((s for c, _, s in jobs_for("new") if c == cid), None) if "new" in icon_styles() else None
        rows.append((cid, folder, src, new_src))
    width = name_w + len(cols) * (T + gap) + 20
    sheet = Image.new("RGB", (width, 120 + len(rows) * (T + gap)), BG)
    d = ImageDraw.Draw(sheet)
    d.text((20, 18), "顔アイコンと立ち絵の対応（黄色の枠＝顔アイコンの切り抜き）", font=font("black", 30), fill=TEXT)
    for i, c in enumerate(cols):
        d.text((name_w + i * (T + gap) + T // 2, 82), c, font=font("bold", 17), fill=SUB, anchor="ma")

    def portrait_tile(path: Path, cid: str, style: str) -> Image.Image:
        im = Image.open(path).convert("RGBA")
        x0, y0, side = face_box(cid, im, style)
        k = 1.7
        cx, cy, s = x0 + side / 2, y0 + side / 2, side * k
        crop = im.crop((round(cx - s / 2), round(cy - s / 2), round(cx + s / 2), round(cy + s / 2))).resize((T, T), Image.LANCZOS)
        tile = Image.new("RGBA", (T, T), PANEL + (255,))
        tile.alpha_composite(crop)
        f = T / s
        bx, by = (x0 - (cx - s / 2)) * f, (y0 - (cy - s / 2)) * f
        ImageDraw.Draw(tile).rectangle([bx, by, bx + side * f, by + side * f], outline=(255, 220, 60), width=2)
        return tile

    def circle(path: Path) -> Image.Image | None:
        if not path.exists() or is_pointer(path):
            return None
        icon = Image.open(path).convert("RGBA").resize((T, T), Image.LANCZOS)
        mask = Image.new("L", (T * 4, T * 4), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, T * 4 - 1, T * 4 - 1], fill=255)
        tile = Image.new("RGBA", (T, T), PANEL + (255,))
        disc = Image.new("RGBA", (T, T), (90, 90, 104, 255))
        disc.alpha_composite(icon)
        tile.paste(disc, (0, 0), mask.resize((T, T), Image.LANCZOS))
        return tile

    for r, (cid, folder, src, new_src) in enumerate(rows):
        y = 120 + r * (T + gap)
        d.text((20, y + T // 2), cid, font=font("bold", 20), fill=TEXT, anchor="lm")
        tiles = [portrait_tile(src, cid, CLASSIC), circle(WEBP_DIR / f"face_{cid}.webp"), circle(BOARD_FACES / f"{folder}.webp") if cid == folder else None]
        if new_src:
            tiles += [portrait_tile(new_src, cid, "new"), circle(WEBP_DIR / "new" / f"face_{cid}.webp"),
                      circle(BOARD_FACES / "new" / f"{folder}.webp") if cid == folder else None]
        for i, tile in enumerate(tiles):
            if tile is not None:
                sheet.paste(tile.convert("RGB"), (name_w + i * (T + gap), y))
        if not new_src:
            d.text((name_w + 3 * (T + gap) + 8, y + T // 2), "新バージョンの立ち絵なし（現行の顔のまま）", font=font("medium", 17), fill=SUB, anchor="lm")
    sheet = sheet.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)  # 確認用の図なので256色で軽くする
    COMPARE_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(COMPARE_SHEET, optimize=True)
    return COMPARE_SHEET


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    args = sys.argv[1:]
    if args == ["--compare"]:
        print(compare_sheet().relative_to(REPO_ROOT))
        return 0
    only_style = None
    if "--style" in args:
        i = args.index("--style")
        only_style = args[i + 1]
        args = args[:i] + args[i + 2:]
    sources = json.loads(SOURCES.read_text(encoding="utf-8")) if SOURCES.exists() else {}
    only = {a for a in args if not a.startswith("--")}
    icons = {}
    stale = []
    for style in icon_styles():
        if only_style and style != only_style:
            continue
        for cid, folder, src in jobs_for(style):
            if only and cid not in only and folder not in only:
                continue
            entry = metrics_entry(cid, style)
            label = cid if style == CLASSIC else f"{style}/{cid}"
            if cid not in TUNE:
                if not entry or "chin" not in entry:
                    if style != CLASSIC:
                        print(f"skip {label}: 顔の位置の記録が無い → python3 tools/portrait_metrics.py grid {cid} --style {style} で測る")
                        continue
                    print(f"WARN {cid}: 顔の位置の記録が無いので仮の枠で作る → tools/portrait_metrics.py で測る")
                elif entry.get("blob") != sprite_blob(src):
                    stale.append(label)
                    continue
            icon = make_icon(cid, src, style)
            if icon is None:
                print(f"skip {label} (empty bbox)")
                continue
            name = icon_name(style, cid)
            dest = OUT_DIR / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            icon.save(dest, optimize=True)
            icons[label] = icon
            sources[name] = {"sprite": str(src.relative_to(REPO_ROOT)), "blob": sprite_blob(src)}
            print(f"wrote {dest.relative_to(REPO_ROOT)} ({dest.stat().st_size:,} bytes)")
    # どの立ち絵（の版）から作ったかを残す（SBD83「旧デザインを根絶」）。立ち絵を描き直したのにアイコンを作り直し忘れると
    # tools/check_face_icons_fresh.py が落ちる。blob は git の登録内容（LFS ならポインタ）の SHA で、手元と CI で同じ値になる
    sync_manifest()
    record_webp(sources)
    SOURCES.write_text(json.dumps(dict(sorted(sources.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if stale:
        print("立ち絵が描き直されたのに顔の位置の記録が古いので作らなかった: " + ", ".join(stale)
              + "\n  → python3 tools/portrait_metrics.py grid <id> [--style <画風>] で測り直して set（位置が同じなら overlay で確かめて stamp）")
        return 1

    if "--sheet" in args:
        scale = 4
        pad = 8
        cell = SIZE * scale + pad
        sheet = Image.new("RGBA", (cell * len(icons), cell), (40, 30, 50, 255))
        for i, (cid, icon) in enumerate(icons.items()):
            big = icon.resize((SIZE * scale, SIZE * scale), Image.NEAREST)
            sheet.paste(big, (i * cell + pad // 2, pad // 2), big)
        sheet_path = OUT_DIR / "_sheet_preview.png"
        sheet.save(sheet_path)
        print(f"wrote {sheet_path} (order: {', '.join(icons)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
