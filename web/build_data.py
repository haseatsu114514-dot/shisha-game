#!/usr/bin/env python3
"""ブラウザ版・第1章用のデータバンドル生成スクリプト。

リポジトリの data/ 配下のJSONを読み込み、web/js/data.js
（window.GAME_DATA）として書き出す。file:// で直接開いても
動くように、fetch ではなく <script> 読み込みでデータを渡す。

使い方:
    python3 web/build_data.py
"""

import base64
import json
import re
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None

try:
    import numpy as np
    from scipy import ndimage
except ImportError:
    np = None
    ndimage = None

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
OUT_PATH = Path(__file__).resolve().parent / "js" / "data.js"

CH1_DIALOGUE_FILES = [
    "ch1_main.json",
    "ch1_tournament.json",
    "ch1_naru.json",
    "ch1_adam.json",
    "ch1_minto.json",
    "ch1_tsumugi.json",
    "ch1_sumi.json",
    "ch1_rin.json",
    "ch1_ageha.json",
    "ch1_spots.json",
    "ch1_events.json",
    "ch2_main.json",
    "ch2_isolation.json",
    "ch2_kumicho.json",
    "ch2_ageha.json",
    "ch2_rei.json",
    "ch2_volk.json",
    "confession.json",
    "lover_events.json",
]

# ch1 のバイトで使うイベントカテゴリ（story は章進行に紐づくため除外）
BAITO_CATEGORIES = ["beginner", "mob", "atmosphere", "regular", "rush", "trouble"]


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def collect_dialogues() -> dict:
    dialogues = {}
    for name in CH1_DIALOGUE_FILES:
        data = load_json(DATA_DIR / "dialogue" / name)
        for d in data.get("dialogues", []):
            dialogues[d["dialogue_id"]] = d
    return dialogues


def portrait_trim(png: Path):
    """透過余白を測り、立ち絵の実体サイズを正規化するための値を返す。

    h: 画像高さに対する実コンテンツの高さ比 / b: 下端の余白比
    l: 左端の余白比 / w: 実コンテンツの幅比
    ax: 横アンカー比（本体下部＝足元の重心x）。表情差分で腕の出し方が
        変わっても bbox 中心のように引っ張られないので、engine.js は
        これを使って立ち絵の横位置を固定する
    （キャラごとの余白差で見かけサイズがズレるのを補正する。
     l/w はタイトル等の「アートウィンドウ」での切り出しに使う）

    scipy がある環境では、背景消し残りのゴミピクセル（本体から離れた
    小さな島）を無視して本体だけを測る。無い環境は従来の getbbox。
    """
    if Image is None:
        return None
    try:
        im = Image.open(png).convert("RGBA")
        if np is not None and ndimage is not None:
            bbox, feet_cx = _measure_main_content(im)
        else:
            bbox, feet_cx = im.getbbox(), None
        if not bbox:
            return None
        left, top, right, bottom = bbox
        trim = {
            "h": round((bottom - top) / im.height, 3),
            "b": round((im.height - bottom) / im.height, 3),
            "l": round(left / im.width, 3),
            "w": round((right - left) / im.width, 3),
        }
        if feet_cx is not None:
            trim["ax"] = round(feet_cx / im.width, 3)
        return trim
    except OSError:
        return None


def _measure_main_content(im):
    """本体（最大連結成分＋その近傍/同規模の成分）の bbox と足元重心xを返す。

    alpha>=24 で二値化し、最大成分の1%未満かつ本体から12px超離れた
    孤立ゴミを計測から除外する。足元重心はコンテンツ下端20%の重心x。
    """
    alpha = np.asarray(im)[..., 3]
    visible = alpha >= 24
    if not visible.any():
        return None, None
    labels, n = ndimage.label(visible)
    mask = visible
    if n > 1:
        sizes = ndimage.sum(visible, labels, range(1, n + 1))
        main_label = int(np.argmax(sizes)) + 1
        main_size = sizes[main_label - 1]
        near_main = ndimage.binary_dilation(labels == main_label, iterations=12)
        keep = np.zeros(n + 1, dtype=bool)
        for i, size in enumerate(sizes, start=1):
            keep[i] = (
                i == main_label
                or size >= main_size * 0.01
                or bool((labels == i)[near_main].any())
            )
        mask = keep[labels]
    ys, xs = np.where(mask)
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    feet_top = y1 - max(1, int((y1 - y0) * 0.2))
    fys, fxs = np.where(mask[feet_top:y1])
    feet_cx = float(fxs.mean()) if len(fxs) else (x0 + x1) / 2
    return (x0, y0, x1, y1), feet_cx


def collect_portraits() -> tuple[dict, dict]:
    """assets/sprites/characters/ を走査して
    ({char_id: [face,...]}, {char_id: {face: trim}}) を返す。

    会話中の表情差分では、同じキャラの立ち絵が上下に動かないことを優先する。
    そのため表示用の h/b はキャラ単位の共通値にそろえる。
    l/w はタイトル等の切り出し用途に使えるよう、各表情の実測値を残す。
    """
    portraits = {}
    trims = {}
    chars_dir = REPO_ROOT / "assets" / "sprites" / "characters"
    for char_dir in sorted(chars_dir.iterdir()):
        if not char_dir.is_dir():
            continue
        faces = []
        face_trims = {}
        prefix = f"chr_{char_dir.name}_"
        for png in sorted(char_dir.glob("chr_*.png")):
            m = re.match(re.escape(prefix) + r"(.+)\.png$", png.name)
            if m:
                faces.append(m.group(1))
                t = portrait_trim(png)
                if t:
                    face_trims[m.group(1)] = t
        if faces:
            if face_trims:
                common_top = 1.0
                common_bottom = 0.0
                for t in face_trims.values():
                    top = 1.0 - t["b"] - t["h"]
                    bottom = 1.0 - t["b"]
                    common_top = min(common_top, top)
                    common_bottom = max(common_bottom, bottom)
                common_h = round(common_bottom - common_top, 3)
                common_b = round(1.0 - common_bottom, 3)
                for t in face_trims.values():
                    t["h"] = common_h
                    t["b"] = common_b
            portraits[char_dir.name] = faces
            trims[char_dir.name] = face_trims
    return portraits, trims


def collect_backgrounds() -> list:
    bg_dir = REPO_ROOT / "assets" / "backgrounds"
    return sorted(p.name for p in bg_dir.glob("*.png"))


def collect_cgs() -> list:
    """存在するCGのid一覧。show_cg は素材が届くまで何も表示しない設計のため、
    エンジンがこのリストで存在チェックする（404ノイズ防止）。"""
    cg_dir = REPO_ROOT / "assets" / "cgs"
    return sorted(p.stem for p in cg_dir.glob("cg_*.png") if p.stat().st_size > 0)


def collect_face_icons() -> dict:
    """assets/ui/face_icons/face_{id}.png（顔ドット絵）を data URI で埋め込む。
    生成は tools/make_face_icons.py。1枚3〜5KBなので直接バンドルする。"""
    icons = {}
    icons_dir = REPO_ROOT / "assets" / "ui" / "face_icons"
    if not icons_dir.exists():
        return icons
    for png in sorted(icons_dir.glob("face_*.png")):
        cid = png.stem[len("face_"):]
        icons[cid] = "data:image/png;base64," + base64.b64encode(png.read_bytes()).decode()
    return icons


def collect_title_arts() -> list:
    """assets/ui/title_arts/ にある専用キービジュアル一覧。
    タイトルが起動時にここからランダムに1枚選んで表示する。
    画像が無ければ空配列 → タイトルはキャラランダム表示にフォールバック"""
    arts_dir = REPO_ROOT / "assets" / "ui" / "title_arts"
    if not arts_dir.exists():
        return []
    return sorted(p.name for p in arts_dir.glob("*.png") if p.stat().st_size > 0)


def collect_making_assets() -> list:
    """assets/ui/making/ にある作業台素材一覧。
    web側はこのリストで存在チェックし、未着素材はCSSフォールバックを使う。"""
    making_dir = REPO_ROOT / "assets" / "ui" / "making"
    if not making_dir.exists():
        return []
    return sorted(p.name for p in making_dir.glob("*.png") if p.stat().st_size > 0)


def main() -> None:
    flavors = load_json(DATA_DIR / "flavors.json")["flavors"]
    baito = load_json(DATA_DIR / "baito_events.json")
    characters = load_json(DATA_DIR / "characters.json")
    # ブラウザ版は ch2 まで遊べるため、ch2 解禁の機材（家シーシャ等）までバンドルする
    equipment = [
        e for e in load_json(DATA_DIR / "equipment.json")["equipment"]
        if e.get("chapter_min", 1) <= 2
    ]

    char_names = {}
    char_list = characters if isinstance(characters, list) else characters.get("characters", [])
    for c in char_list:
        if isinstance(c, dict) and "id" in c:
            char_names[c["id"]] = c.get("name", c["id"])

    portraits, portrait_trims = collect_portraits()
    # キャラ別の立ち絵スケール係数（characters.json の任意フィールド spriteScale、既定1.0）。
    # engine.js はスプライトの「フォルダ名」で引くため、characters.json の id と
    # フォルダ名が違うキャラはここで読み替える（engine.js SPEAKER_ID_ALIASES と対応）
    SPRITE_FOLDER_ALIASES = {"kumicho": "ryuji", "oneesan": "minto"}
    portrait_scales = {}
    for c in (characters if isinstance(characters, list) else []):
        if isinstance(c, dict) and "id" in c and c.get("spriteScale"):
            portrait_scales[SPRITE_FOLDER_ALIASES.get(c["id"], c["id"])] = c["spriteScale"]
    bundle = {
        "dialogues": collect_dialogues(),
        "flavors": flavors,
        "equipment": equipment,
        "baito_settings": baito.get("baito_settings", {}),
        "baito_events": [
            e for e in baito.get("events", []) if e.get("category") in BAITO_CATEGORIES
        ],
        "char_names": char_names,
        "portraits": portraits,
        "portrait_trims": portrait_trims,
        "portrait_scales": portrait_scales,
        "backgrounds": collect_backgrounds(),
        "cgs": collect_cgs(),
        "title_arts": collect_title_arts(),
        "making_assets": collect_making_assets(),
        "face_icons": collect_face_icons(),
        "lime_messages": load_json(DATA_DIR / "lime_messages.json")["messages"],
        "glossary": load_json(DATA_DIR / "glossary.json")["groups"],
        "kuji": load_json(DATA_DIR / "kuji.json"),
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    js = "// 自動生成ファイル。編集しないこと。再生成: python3 web/build_data.py\n"
    js += "window.GAME_DATA = "
    js += json.dumps(bundle, ensure_ascii=False, separators=(",", ":"))
    js += ";\n"
    OUT_PATH.write_text(js, encoding="utf-8")
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes)")
    print(f"  dialogues: {len(bundle['dialogues'])}")
    print(f"  baito_events: {len(bundle['baito_events'])}")
    print(f"  flavors: {len(bundle['flavors'])}")


if __name__ == "__main__":
    main()
