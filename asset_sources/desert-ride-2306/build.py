#!/usr/bin/env python3
"""DESERT RIDE（第4章ドバイ・サンドボード、PR #2306・DSR04）の採用画像を raw/ から作り直す。

    python3 asset_sources/desert-ride-2306/build.py

- 採用は ADOPT の1か所（候補を差し替えるときはここの A/B/C を変えて再実行する）。
- 原画（raw/）は Codex の生成そのまま。ここで行う加工は、低い alpha の微粒子の除去・余白の切り抜き・縮小・
  遠景の空と陸の分離だけ。描き足し・色の変更はしない。
- 出力: assets/ui/desert_ride/*.png（採用版）・remake/img/ui/desert_ride/*.webp（配信用）・
  assets/backgrounds/bg_dubai_dunes_day.png（会話の背景。WebP は build_manifest.py --backgrounds-only が作る）・adoption.json。
- ゲームが使う寸法・基準点は adoption.json に書き、remake/js/minigames/desert-ride-art.js の ART と一致することを
  remake/test/desert_ride.mjs が確かめる。
依存: Pillow・NumPy・SciPy。
"""
import hashlib
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RAW = HERE / "raw"
ASSET_DIR = ROOT / "assets" / "ui" / "desert_ride"
WEB_DIR = ROOT / "remake" / "img" / "ui" / "desert_ride"
BG = ROOT / "assets" / "backgrounds" / "bg_dubai_dunes_day.png"
BG_DUSK = ROOT / "assets" / "backgrounds" / "bg_dubai_dunes_dusk.png"

# 採用（2026-11-02 Claude 選定。オーナーが別案を選んだら、ここを変えて再実行する）
ADOPT = {
    "backdrop": "phase1/backdrop_day-B-raw.png",      # 中景の砂丘の稜線がはっきりして、走っている時も奥行きが読める
    "vn": "phase1/bg_dubai_dunes_day-C-raw.png",      # 車が一番小さく、中央手前が一番空いている（立ち絵の場所）
    "puff": "phase1/sand_puff-C-raw.png",             # 横に広く低い形が、板の後ろに流れる砂煙に合う
    "rock_large": "phase2/rock_large-A-raw.png",      # 陰が濃く、明るい砂の上で遠くからも形が読める
    "rock_small": "phase2/rock_small-A-raw.png",      # 大岩Aと同じ描き方で、ひと目で同じ「岩」と分かる
    "flag": "phase2/flag_pole-A-raw.png",             # 旗が一番大きく、細く縮めても旗だと読める
    "goal": "phase2/goal_banner-A-raw.png",           # 布の色が砂と夕日の色になじむ
    "rider": "rider/rider_ride-B-raw.png",            # 頭が真後ろで耳・頬が見えない（背面だけの条件に一番合う）
    # 第4弾（PR #2333 のコメント・DSR08）: 採用した昼の遠景B・会話C・背面Bを基準に Codex が描いた続き。各1案
    "backdrop_dusk": "phase4/backdrop_dusk-raw.png",  # 遠景Bと同じ構図の夕方（太陽はゲームが描く）
    "vn_dusk": "phase4/bg_dubai_dunes_dusk-raw.png",  # 会話Cと同じ構図の夕方（右に夕日）
    "rider_lean_left": "phase4/rider_lean_left-raw.png",    # 画面の左へ体重をかける
    "rider_lean_right": "phase4/rider_lean_right-raw.png",  # 画面の右へ体重をかける
    "rider_jump": "phase4/rider_jump-raw.png",              # 空中で膝を抱える
    "rider_brace": "phase4/rider_brace-raw.png",            # 着地の構え（低くしゃがむ）
    "rider_fall": "phase4/rider_fall-raw.png",              # 転倒（板が離れる）
}
# ヌールの立ち絵 normal A/B/C（raw/phase4/noor-candidates/）は別々のデザイン案。オーナーの選択待ちで、ここでは使わない。
RIDER_POSES = ("rider_lean_left", "rider_lean_right", "rider_jump", "rider_brace", "rider_fall")

# 遠景（Codex B 1983×793）の行: 空が終わる稜線のいちばん上と、平らな砂が始まる地平線（原画の画素）
BACKDROP_RAW_DUNE_TOP = 310
BACKDROP_RAW_HORIZON = 445
BACKDROP_WIDTH = 1800


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def clean_alpha(im, floor=8, keep=0.01):
    """alpha が floor 未満を透明にし、最大の塊の keep 未満の小さな塊（はみ出した微粒子）を消す。戻り値: (画像, 消した画素数)"""
    a = np.asarray(im.convert("RGBA")).copy()
    alpha = a[..., 3]
    weak = (alpha > 0) & (alpha < floor)
    alpha[weak] = 0
    labels, n = ndimage.label(alpha > 0, structure=np.ones((3, 3)))
    removed = int(weak.sum())
    if n > 1:
        sizes = ndimage.sum(np.ones_like(alpha), labels, range(1, n + 1))
        small = [i + 1 for i, s in enumerate(sizes) if s < keep * sizes.max()]
        mask = np.isin(labels, small)
        removed += int(mask.sum())
        alpha[mask] = 0
    a[..., :3][alpha == 0] = 0
    return Image.fromarray(a, "RGBA"), removed


def crop(im, pad=2):
    box = im.getchannel("A").getbbox()
    w, h = im.size
    return im.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(w, box[2] + pad), min(h, box[3] + pad)))


def resize(im, width=None, height=None):
    """縦横比を保って縮める。透過は乗算済みアルファで縮め、縁に暗い色がにじまないようにする。"""
    w, h = im.size
    k = width / w if width else height / h
    size = (max(1, round(w * k)), max(1, round(h * k)))
    if im.mode == "RGBA":
        return im.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")
    return im.resize(size, Image.LANCZOS)


def webp(im, lossy_only=False):
    """可逆と非可逆 q90 の小さいほう（不透明な大きい絵は非可逆 q86 だけ）。"""
    out = []
    if not lossy_only:
        buf = io.BytesIO(); im.save(buf, "WEBP", lossless=True, method=6); out.append(buf.getvalue())
    buf = io.BytesIO(); im.save(buf, "WEBP", quality=86 if lossy_only else 90, method=6, exact=True); out.append(buf.getvalue())
    return min(out, key=len)


def save(name, im, lossy_only=False):
    ASSET_DIR.mkdir(parents=True, exist_ok=True); WEB_DIR.mkdir(parents=True, exist_ok=True)
    png = ASSET_DIR / f"{name}.png"
    im.save(png, optimize=True)
    web = WEB_DIR / f"{name}.webp"
    web.write_bytes(webp(im, lossy_only))
    return {"png": str(png.relative_to(ROOT)), "png_sha256": sha(png), "webp": str(web.relative_to(ROOT)), "webp_sha256": sha(web),
            "size": list(im.size)}


def backdrop():
    """昼の遠景を空と陸の2枚に分ける。夕方（昼と同じ構図・1画素以内でそろう）は、昼で作った陸の透明度をそのまま使う。"""
    def load(key):
        raw = Image.open(RAW / ADOPT[key]).convert("RGB")
        k = BACKDROP_WIDTH / raw.width
        return raw.resize((BACKDROP_WIDTH, round(raw.height * k)), Image.LANCZOS), k
    im, k = load("backdrop")
    horizon, dune_top = round(BACKDROP_RAW_HORIZON * k), round(BACKDROP_RAW_DUNE_TOP * k)
    # 空: 地平線より少し下まで（陸の絵が上に重なる）
    sky = im.crop((0, 0, im.width, horizon + 8))
    # 陸: 稜線の少し上から下端まで。空の画素（青み・雲の白）を透明にして、沈む太陽が砂丘の後ろへ隠れるようにする
    land_top = dune_top - 12
    land = np.asarray(im.crop((0, land_top, im.width, im.height)).convert("RGBA")).astype(np.float32)
    r, g, b = land[..., 0], land[..., 1], land[..., 2]
    skyness = np.clip((b - r + 4) / 22, 0, 1)
    alpha = 1 - skyness
    rows = np.arange(land.shape[0]) + land_top
    alpha[rows < dune_top - 4, :] = 0                                 # 稜線より上は必ず空
    alpha[rows > round((BACKDROP_RAW_DUNE_TOP + 40) * k), :] = 1     # 稜線の下は必ず陸
    alpha = ndimage.gaussian_filter(alpha, 0.7)
    land[..., 3] = np.clip(alpha * 255, 0, 255)
    land_im = Image.fromarray(land.astype(np.uint8), "RGBA")
    near = np.asarray(im.crop((0, horizon + 4, im.width, horizon + 40))).reshape(-1, 3).mean(0)
    far = np.asarray(im.crop((0, im.height - 60, im.width, im.height))).reshape(-1, 3).mean(0)
    dusk, _ = load("backdrop_dusk")
    assert dusk.size == im.size, "夕方の遠景は昼と同じ寸法・構図であること"
    dusk_land = np.asarray(dusk.crop((0, land_top, dusk.width, dusk.height)).convert("RGBA")).copy()
    dusk_land[..., 3] = land[..., 3].astype(np.uint8)
    return (save("backdrop_day_sky", sky, lossy_only=True), save("backdrop_day_land", land_im),
            save("backdrop_dusk_sky", dusk.crop((0, 0, dusk.width, horizon + 8)), lossy_only=True),
            save("backdrop_dusk_land", Image.fromarray(dusk_land, "RGBA")),
            {"width": im.width, "height": im.height, "horizon": horizon, "duneTop": dune_top, "landTop": land_top,
             "sandHorizon": [round(v) for v in near], "sandNear": [round(v) for v in far]})


def sprite(key, name, width=None, height=None, scale=None):
    """scale を渡すと、切り抜いた原画をその倍率で縮める（背面の差分を基準の背面Bと同じ縮尺にそろえる）。"""
    im, removed = clean_alpha(Image.open(RAW / ADOPT[key]))
    im = crop(im)
    if scale:
        return resize(im, width=max(1, round(im.width * scale))), removed
    return resize(im, width, height), removed


def anchor_body(im):
    """転倒の基準点: 体と板を含む不透明な画素の横の中心と、いちばん下の少し上（板が離れて重心が使えない）。"""
    alpha = np.asarray(im.getchannel("A"))
    ys, xs = np.nonzero(alpha > 32)
    return {"x": round(float(xs.mean()) / alpha.shape[1], 4), "y": round(float(ys.max() - alpha.shape[0] * 0.04) / alpha.shape[0], 4)}


def anchor_board(im):
    """板（明るい橙）の重心を、足元の基準点にする（画像に対する比率）。"""
    a = np.asarray(im).astype(int)
    h = a.shape[0]
    board = (a[..., 0] > 200) & (a[..., 1] > 70) & (a[..., 1] < 175) & (a[..., 2] < 90) & (a[..., 3] > 200)
    board[: int(h * 0.55)] = False
    ys, xs = np.nonzero(board)
    return {"x": round(float(xs.mean()) / a.shape[1], 4), "y": round(float(ys.mean()) / h, 4),
            "boardLeft": round(float(xs.min()) / a.shape[1], 4), "boardRight": round(float(xs.max()) / a.shape[1], 4)}


def anchor_foot(im):
    """旗竿の足（いちばん下の数行の不透明な画素の中心）。"""
    alpha = np.asarray(im.getchannel("A"))
    ys, xs = np.nonzero(alpha > 32)
    bottom = ys.max()
    sel = ys >= bottom - max(2, alpha.shape[0] // 80)
    return {"x": round(float(xs[sel].mean()) / alpha.shape[1], 4), "y": round(float(bottom + 1) / alpha.shape[0], 4)}


def main():
    sky, land, dusk_sky, dusk_land, geo = backdrop()
    report = {"source": "Codex image_gen candidates delivered on PR #2306 and #2333 (gigafile ZIPs, SHA-256 checked against the handoff comments)",
              "adopt": {k: {"raw": f"raw/{v}", "raw_sha256": sha(RAW / v)} for k, v in ADOPT.items()},
              "backdrop": {"sky": sky, "land": land, **geo}, "backdrop_dusk": {"sky": dusk_sky, "land": dusk_land}}
    puff, removed = sprite("puff", "sand_puff", width=256)
    report["sand_puff"] = {**save("sand_puff", puff), "stray_alpha_cleared": removed}
    for key, width in (("rock_large", 512), ("rock_small", 384)):
        im, removed = sprite(key, key, width=width)
        report[key] = {**save(key, im), "stray_alpha_cleared": removed}
    flag, removed = sprite("flag", "flag_pole", height=512)
    report["flag_pole"] = {**save("flag_pole", flag), "stray_alpha_cleared": removed, "foot": anchor_foot(flag)}
    goal, removed = sprite("goal", "goal_banner", width=1024)
    report["goal_banner"] = {**save("goal_banner", goal), "stray_alpha_cleared": removed}
    rider, removed = sprite("rider", "rider_ride", height=768)
    report["rider_ride"] = {**save("rider_ride", rider), "stray_alpha_cleared": removed, "anchor": anchor_board(rider)}
    # 背面の差分: 原画はどれも 1024×1536 で同じ縮尺に描かれているので、背面Bを 768px 高にした倍率をそのまま掛ける
    base_scale = rider.height / crop(clean_alpha(Image.open(RAW / ADOPT["rider"]))[0]).height
    for key in RIDER_POSES:
        im, removed = sprite(key, key, scale=base_scale)
        report[key] = {**save(key, im), "stray_alpha_cleared": removed, "scale": round(base_scale, 6),
                       "anchor": anchor_body(im) if key == "rider_fall" else {k: v for k, v in anchor_board(im).items() if k in ("x", "y")}}
    # 会話の背景: 1672×941 → 1280×720（縦横比はほぼ16:9。はみ出す分だけ中央で切る）
    # 夕方は昼と同じ寸法・同じ切り方（夕日の場面。第4弾）
    for key, path, name in (("vn", BG, "bg_dubai_dunes_day"), ("vn_dusk", BG_DUSK, "bg_dubai_dunes_dusk")):
        vn = Image.open(RAW / ADOPT[key]).convert("RGB")
        k = max(1280 / vn.width, 720 / vn.height)
        vn = vn.resize((round(vn.width * k), round(vn.height * k)), Image.LANCZOS)
        left, top = (vn.width - 1280) // 2, (vn.height - 720) // 2
        vn = vn.crop((left, top, left + 1280, top + 720))
        vn.save(path, optimize=True)
        report[name] = {"png": str(path.relative_to(ROOT)), "png_sha256": sha(path), "size": [1280, 720]}
    (HERE / "adoption.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "adopt"}, ensure_ascii=False, indent=1)[:3000])


if __name__ == "__main__":
    main()
