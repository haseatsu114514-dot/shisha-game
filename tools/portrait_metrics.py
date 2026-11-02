#!/usr/bin/env python3
"""立ち絵の顔の位置の記録（data/portrait_metrics.json）を扱う。規格の説明は docs/portrait_standard.md。

通常の立ち絵（896x1200）ごとに、目・あご・頭頂・頬の位置を1度だけ測って記録する。
顔アイコン（tools/make_face_icons.py）と顔の大きさの比較図はこの記録から作るので、
キャラを足しても手で拡大率を合わせる必要がない。

    python3 tools/portrait_metrics.py check              # 記録漏れ・古い記録・規格外を調べる（画像不要。CI の quick）
    python3 tools/portrait_metrics.py report             # 全員の表（Markdown）
    python3 tools/portrait_metrics.py sheet              # 顔の大きさの比較図（立ち絵の画像が要る）
    python3 tools/portrait_metrics.py faces [<id>..]     # 表情差分の上端・足元が通常からずれていないか（立ち絵の画像が要る）
    python3 tools/portrait_metrics.py grid <id> [OUT] [--image 候補.png]   # 測るための目盛り付き拡大図
    python3 tools/portrait_metrics.py calc <id> eyes=… chin=… crown=… cheeks=…   # 記録せずに頭身だけ出す（採用前の候補を測る）
    python3 tools/portrait_metrics.py set <id> eyes=x,y,x,y chin=x,y crown=x,y cheeks=左x,右x,y
    python3 tools/portrait_metrics.py overlay [<id>..] [--out OUT]   # 記録した点を重ねた確認図
    python3 tools/portrait_metrics.py stamp <id>         # 確認図で点が合っているのを見た後、今の立ち絵の版を記録する

測り方（座標は立ち絵 PNG の画素。左上が 0,0）:
    eyes   : 両目の黒目の中心（画面の左の目が先）。閉じた目は線の中央
    chin   : あごの先（いちばん下）
    crown  : 頭頂の髪の上端。帽子・フード・角・髪飾り・アホ毛は含めず、隠れているときは推定する
    cheeks : 目の少し下の高さでの、顔の左右の輪郭（耳・横の髪は含めない）と、その高さ y。ロボは耳の部品の内側まで
    accepted: 規格外でもオーナー判断で今のままにするときの理由（例 "2026-11-02 オーナー判断"）。check の警告を出さない
"""
import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
METRICS = ROOT / "data" / "portrait_metrics.json"
MANIFEST = ROOT / "remake" / "data" / "manifest.json"
CHARACTERS = ROOT / "data" / "characters.json"
SPRITES = ROOT / "assets" / "sprites" / "characters"
SHEET = ROOT / "asset_sources" / "reference-sheets" / "face-size-ingame.png"
STAGE_H = 720           # 1280x720 の会話画面
FRAMING_TARGET = 1.36   # remake/js/vn/engine.js の FRAMING.target（本体の高さ＝画面の高さ×1.36×spriteScale）
PAKKI_TARGET = 0.94     # 同 FRAMING.pakkiTarget


# ---------------------------------------------------------------- 読み書き

def load() -> dict:
    return json.loads(METRICS.read_text(encoding="utf-8"))


def save(data: dict) -> None:
    data["characters"] = dict(sorted(data["characters"].items()))
    METRICS.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def git_blob(rel: str) -> str | None:
    """立ち絵の git 上の版（blob SHA。LFS ならポインタの SHA）。
    手元にファイルがあれば中身から計算する（git add 前に測っても、add 後と同じ値になる。LFS は clean フィルタでポインタになる）。
    CI の quick は画像を checkout しないので、無ければ登録内容（ls-files）を使う"""
    path = ROOT / rel
    if path.exists():
        out = subprocess.run(["git", "hash-object", "--", rel], cwd=ROOT, capture_output=True, text=True).stdout.strip()
        if out:
            return out
    out = subprocess.run(["git", "ls-files", "-s", "--", rel], cwd=ROOT, capture_output=True, text=True).stdout.split()
    return out[1] if len(out) >= 2 else None


def tracked_normals() -> dict[str, str]:
    """登録されている通常の立ち絵 {キャラID: パス}"""
    out = subprocess.run(["git", "ls-files", "--", "assets/sprites/characters/*/chr_*_normal.png"],
                         cwd=ROOT, capture_output=True, text=True).stdout.split()
    found = {}
    for rel in out:
        cid = Path(rel).parent.name
        if Path(rel).name == f"chr_{cid}_normal.png":
            found[cid] = rel
    return found


def default_sprite(cid: str) -> str:
    return f"assets/sprites/characters/{cid}/chr_{cid}_normal.png"


# ---------------------------------------------------------------- 計算

def game_factor(entry: dict, cid: str, manifest: dict, chars: dict) -> float | None:
    """立ち絵の1画素が、1280x720 の会話画面で何画素になるか（engine.js の frame() と同じ計算）"""
    folder = entry.get("folder", cid)
    p = manifest["portraits"].get(folder)
    if not p:
        return None
    scale = (chars.get(folder) or {}).get("spriteScale") or 1
    target = (PAKKI_TARGET if folder == "pakki" else FRAMING_TARGET) * scale
    return min(target / p["h"], 2.4) * STAGE_H / 1200


def measure(entry: dict, cid: str, manifest: dict, chars: dict) -> dict | None:
    """記録した点から、規格で見る値を出す"""
    if not all(k in entry for k in ("eyes", "chin", "crown", "cheeks")):
        return None
    k = game_factor(entry, cid, manifest, chars)
    p = manifest["portraits"].get(entry.get("folder", cid))
    if k is None or p is None:
        return None
    (lx, ly), (rx, ry) = entry["eyes"]
    head = entry["chin"][1] - entry["crown"][1]
    cheek = entry["cheeks"][1] - entry["cheeks"][0]
    foot = 1200 * (1 - p["b"])                    # 足元（靴底）
    eye_y = (ly + ry) / 2
    return {
        "head_img": head,
        "head_game": head * k,                     # 会話画面での頭の高さ（頭頂〜あご）
        "cheek_game": cheek * k,                   # 会話画面での頬の幅
        "head_body": (foot - entry["crown"][1]) / head,   # 頭身（頭頂〜靴底 ÷ 頭頂〜あご）
        "eye_pos": (eye_y - entry["crown"][1]) / head,    # 頭の中の目の高さ（0＝頭頂・1＝あご）
        "face_unit": math.sqrt(head * cheek),      # 顔の大きさの単位（顔アイコンの拡大率に使う）
    }


def icon_box(entry: dict, icon: dict) -> tuple[float, float, float] | None:
    """顔アイコンの切り抜き枠 (x0, y0, 辺)。顔の大きさ（頭の高さ×頬の幅の相乗平均）が辺の icon.face 倍、
    頭の上下の中央が上から icon.mid_y の位置、頬の左右の中央が枠の中央に来る"""
    if not all(k in entry for k in ("chin", "crown", "cheeks")):
        return None
    head = entry["chin"][1] - entry["crown"][1]
    cheek = entry["cheeks"][1] - entry["cheeks"][0]
    side = math.sqrt(head * cheek) / icon["face"]
    cx = (entry["cheeks"][0] + entry["cheeks"][1]) / 2
    mid = (entry["crown"][1] + entry["chin"][1]) / 2
    return cx - side / 2, mid - side * icon["mid_y"], side


def status(entry: dict, m: dict | None, spec: dict) -> tuple[str, str]:
    """('ok'|'warn'|'exempt', 説明)"""
    cls = entry.get("class", "standard")
    rule = spec["classes"].get(cls) or {}
    if "head_body" not in rule:
        return "exempt", rule.get("label", cls)
    if m is None:
        return "warn", "測定値なし"
    lo, hi = rule["head_body"]
    if entry.get("accepted") and not lo <= m["head_body"] <= hi:
        return "ok", f"規格外だが今のまま（{entry['accepted']}）"
    if m["head_body"] < lo:
        return "warn", f"頭が大きい（{m['head_body']:.2f}頭身 < {lo}）"
    if m["head_body"] > hi:
        return "warn", f"頭が小さい（{m['head_body']:.2f}頭身 > {hi}）"
    return "ok", ""


def context():
    data = load()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    chars = {c["id"]: c for c in json.loads(CHARACTERS.read_text(encoding="utf-8"))}
    same = ROOT / "data" / "dialogue" / "samechan.json"   # サメちゃんの設定は台本側にある（make_reference_sheet.py と同じ）
    if same.exists():
        prof = json.loads(same.read_text(encoding="utf-8")).get("profile")
        if prof and prof.get("id"):
            chars.setdefault(prof["id"], prof)
    return data, manifest, chars


# ---------------------------------------------------------------- check / report

def cmd_check() -> int:
    data, manifest, chars = context()
    spec, entries = data["spec"], data["characters"]
    errors, warns = [], []
    normals = tracked_normals()
    for cid, rel in sorted(normals.items()):
        if cid not in entries:
            errors.append(f"{cid}: 顔の位置の記録が無い → python3 tools/portrait_metrics.py grid {cid} で測り、set で書く（docs/portrait_standard.md）")
    for cid, e in sorted(entries.items()):
        rel = e.get("sprite") or default_sprite(cid)
        now = git_blob(rel)
        if now is None:
            errors.append(f"{cid}: 立ち絵 {rel} が無い")
            continue
        if e.get("blob") != now:
            errors.append(f"{cid}: 立ち絵 {rel} が描き直されたのに、顔の位置の記録が古い → 測り直して set（位置が変わっていなければ overlay で確かめて stamp）")
        if e.get("class", "standard") not in spec["classes"]:
            errors.append(f"{cid}: 体型の区分 {e.get('class')} が spec.classes に無い")
        if "head_body" in spec["classes"].get(e.get("class", "standard"), {}) or "eyes" in e:
            missing = [k for k in ("eyes", "chin", "crown", "cheeks") if k not in e]
            if missing:
                errors.append(f"{cid}: {', '.join(missing)} が記録されていない")
                continue
        if "eyes" in e:
            (lx, ly), (rx, ry) = e["eyes"]
            if not (e["crown"][1] < min(ly, ry) and max(ly, ry) < e["chin"][1]):
                errors.append(f"{cid}: 目が頭頂とあごの間に無い（点の取り違え）")
            if not (e["cheeks"][0] < min(lx, rx) and max(lx, rx) < e["cheeks"][1] + 20):
                warns.append(f"{cid}: 目が頬の幅の外にある（横顔なら問題ない）")
        m = measure(e, cid, manifest, chars)
        st, why = status(e, m, spec)
        if st == "warn":
            warns.append(f"{cid}: 規格外 {why}")
        same = e.get("same_person")
        if same and m and same in entries:
            m2 = measure(entries[same], same, manifest, chars)
            if m2 and abs(m["head_game"] / m2["head_game"] - 1) > spec["same_person_tolerance"]:
                warns.append(f"{cid}: 同じ人物の {same} と会話画面での頭の大きさが {abs(m['head_game'] / m2['head_game'] - 1) * 100:.0f}% 違う")
    for w in warns:
        print(f"WARN: {w}")
    if errors:
        print("顔の位置の記録に問題がある:\n  " + "\n  ".join(errors))
        return 1
    print(f"portrait metrics: {len(entries)} entries match their current portraits ({len(warns)} warnings; 規格外は描き直しの候補で、CI は止めない)")
    return 0


def rows():
    data, manifest, chars = context()
    out = []
    for cid, e in data["characters"].items():
        m = measure(e, cid, manifest, chars)
        st, why = status(e, m, data["spec"])
        folder = e.get("folder", cid)
        name = (chars.get(folder) or {}).get("display_name") or (chars.get(folder) or {}).get("name") or cid
        name = e.get("label") or name.split(" / ", 1)[0].split("（")[0]
        out.append({"id": cid, "name": name, "class": e.get("class", "standard"), "m": m, "status": st, "why": why, "entry": e})
    return data, out


def cmd_report() -> int:
    data, rs = rows()
    spec = data["spec"]
    print("| キャラ | 区分 | 頭身 | 会話画面の頭の高さ | 頬の幅 | 判定 |")
    print("|---|---|---:|---:|---:|---|")
    order = {k: i for i, k in enumerate(spec["classes"])}
    for r in sorted(rs, key=lambda r: (order.get(r["class"], 9), r["m"]["head_body"] if r["m"] else 99)):
        m = r["m"]
        label = spec["classes"][r["class"]].get("label", r["class"])
        if not m:
            print(f"| {r['name']}（`{r['id']}`） | {label} | — | — | — | 対象外 |")
            continue
        verdict = {"ok": r["why"] or "規格内", "warn": r["why"], "exempt": "対象外"}[r["status"]]
        print(f"| {r['name']}（`{r['id']}`） | {label} | {m['head_body']:.2f} | {m['head_game']:.0f}px | {m['cheek_game']:.0f}px | {verdict} |")
    return 0


# ---------------------------------------------------------------- 画像（立ち絵の実体が要る）

def sprite_image(cid: str, entry: dict):
    from PIL import Image
    path = ROOT / (entry.get("sprite") or default_sprite(cid))
    if path.read_bytes()[:7] == b"version":
        raise SystemExit(f"{path} は Git LFS のポインタ。git lfs pull --include=\"{path.relative_to(ROOT)}\" で実体を取る")
    return Image.open(path).convert("RGBA")


def cmd_sheet(k: float = 2.0) -> int:
    """会話画面と同じ倍率（の k 倍）で、目の高さをそろえて全員の顔を並べる"""
    from PIL import Image, ImageDraw
    sys.path.insert(0, str(ROOT / "tools"))
    from make_reference_sheet import BG, PANEL, SUB, TEXT, font  # noqa: E402

    data, rs = rows()
    spec = data["spec"]
    _, manifest, chars = context()
    order = {c: i for i, c in enumerate(spec["classes"])}
    rs = [r for r in rs if r["m"]]
    rs.sort(key=lambda r: (order.get(r["class"], 9), r["m"]["head_body"]))
    tw, th, gap, cols = 250, 300, 12, 11
    groups = []
    for cls in spec["classes"]:
        g = [r for r in rs if r["class"] == cls]
        if g:
            groups.append((cls, g))
    n_rows = sum(math.ceil(len(g) / cols) for _, g in groups)
    width = 40 + cols * (tw + gap)
    height = 150 + n_rows * (th + 110) + len(groups) * 60
    sheet = Image.new("RGB", (width, height), BG)
    d = ImageDraw.Draw(sheet)
    d.text((40, 24), "ゲーム画面での顔の大きさ（全員同じ倍率・目の高さをそろえて配置）", font=font("black", 40), fill=TEXT)
    d.text((40, 82), "数値は 1280×720 の会話画面での頭の高さ（頭頂〜あご）と頭身。区分ごとの規格（docs/portrait_standard.md）を外れると赤",
           font=font("medium", 22), fill=SUB)
    y = 140
    for cls, g in groups:
        rule = spec["classes"][cls]
        rng = f"（{rule['head_body'][0]}〜{rule['head_body'][1]}頭身）" if "head_body" in rule else ""
        d.text((40, y), rule.get("label", cls) + rng, font=font("bold", 28), fill=TEXT)
        y += 50
        for i, r in enumerate(g):
            if i and i % cols == 0:
                y += th + 110
            e, m = r["entry"], r["m"]
            im = sprite_image(r["id"], e)
            f = game_factor(e, r["id"], manifest, chars) * k
            big = im.resize((round(im.width * f), round(im.height * f)), Image.LANCZOS)
            cx = (e["cheeks"][0] + e["cheeks"][1]) / 2 * f
            ey = (e["eyes"][0][1] + e["eyes"][1][1]) / 2 * f
            crop = big.crop((round(cx - tw / 2), round(ey - th * 0.45), round(cx + tw / 2), round(ey + th * 0.55)))
            tile = Image.new("RGBA", (tw, th), PANEL + (255,))
            tile.alpha_composite(crop)
            x = 40 + (i % cols) * (tw + gap)
            sheet.paste(tile.convert("RGB"), (x, y))
            col = (240, 110, 100) if r["status"] == "warn" else (SUB if r["status"] == "exempt" else TEXT)
            d.text((x + tw // 2, y + th + 12), r["name"], font=font("bold", 24), fill=TEXT, anchor="ma")
            d.text((x + tw // 2, y + th + 46), f"{m['head_game']:.0f}px・{m['head_body']:.2f}頭身", font=font("medium", 22), fill=col, anchor="ma")
        y += th + 110 + 10
    sheet = sheet.crop((0, 0, width, y)).quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)  # 確認用の図なので256色で軽くする
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(SHEET, optimize=True)
    print(SHEET.relative_to(ROOT), sheet.size)
    return 0


def cmd_faces(ids: list[str]) -> int:
    """表情差分の上端・下端を通常と比べる。上げた腕・跳ねるポーズでも出るので、出たものは目で見て判断する"""
    from PIL import Image
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    found = 0
    for cid, p in sorted(manifest["portraits"].items()):
        if ids and cid not in ids:
            continue
        box = {}
        for face in p["faces"]:
            path = SPRITES / cid / f"chr_{cid}_{face}.png"
            if not path.exists() or path.read_bytes()[:7] == b"version":
                continue
            l, t, r, b = Image.open(path).getchannel("A").point(lambda v: 255 if v >= 16 else 0).getbbox()
            box[face] = (t, b)
        ref = box.get("normal")
        if not ref:
            continue
        for face, (t, b) in box.items():
            if face != "normal" and (abs(t - ref[0]) >= 25 or abs(b - ref[1]) >= 8):
                found += 1
                print(f"{cid} {face}: 上端 {t - ref[0]:+d}px・足元 {b - ref[1]:+d}px（通常比）")
    print(f"{found} 件。頭の高さが違うものは縮んで／伸びて見える。足元が違うものは浮いて見える（portrait-fix スキル）")
    return 0


def cmd_grid(cid: str, out: Path, image: Path | None = None) -> int:
    """測るための拡大図。10px ごとの目盛りに座標を書く（黄色は 50px ごと）"""
    from PIL import Image, ImageDraw
    sys.path.insert(0, str(ROOT / "tools"))
    from make_reference_sheet import font  # noqa: E402

    data = load()
    e = data["characters"].get(cid, {})
    im = Image.open(image).convert("RGBA") if image else sprite_image(cid, e)
    a = im.getchannel("A")
    left, top, right, bottom = a.getbbox()
    head = a.crop((left, top, right, top + int((bottom - top) * 0.14)))
    xs = ws = 0
    for i, v in enumerate(head.getdata()):
        if v > 32:
            ws += v
            xs += (i % head.width) * v
    hx = left + (xs / ws if ws else head.width / 2)
    cw, ch, s = 220, 260, 3.5
    x0 = int((hx - cw / 2) // 10 * 10)
    y0 = int((top - 10) // 10 * 10)
    crop = im.crop((x0, y0, x0 + cw, y0 + ch))
    bg = Image.new("RGBA", crop.size, (70, 70, 80, 255))
    bg.alpha_composite(crop)
    big = bg.resize((int(cw * s), int(ch * s)), Image.LANCZOS)
    d = ImageDraw.Draw(big)
    for x in range(x0 + 10, x0 + cw, 10):
        X = (x - x0) * s
        d.line([(X, 0), (X, big.height)], fill=(255, 255, 0) if x % 50 == 0 else (0, 255, 255), width=1)
        d.text((X + 2, 2), str(x), fill=(255, 255, 0), font=font("bold", 14))
    for yy in range(y0 + 10, y0 + ch, 10):
        Y = (yy - y0) * s
        d.line([(0, Y), (big.width, Y)], fill=(255, 255, 0) if yy % 50 == 0 else (0, 255, 255), width=1)
        d.text((2, Y + 2), str(yy), fill=(255, 255, 0), font=font("bold", 14))
    out.parent.mkdir(parents=True, exist_ok=True)
    big.convert("RGB").save(out, quality=90)
    print(f"{out}  （枠が顔から外れていたら、別の表情や手の位置に引っ張られている。座標は画像の画素）")
    return 0


def cmd_overlay(ids: list[str], out: Path) -> int:
    """記録した点を重ねた確認図。赤丸＝目、緑＝あご、紫＝頭頂、黄＝頬の幅"""
    from PIL import Image, ImageDraw
    sys.path.insert(0, str(ROOT / "tools"))
    from make_reference_sheet import font  # noqa: E402

    data = load()
    ids = ids or [c for c, e in data["characters"].items() if "eyes" in e]
    tiles = []
    for cid in ids:
        e = data["characters"][cid]
        if "eyes" not in e:
            continue
        im = sprite_image(cid, e)
        ex = (e["eyes"][0][0] + e["eyes"][1][0]) / 2
        cy = (e["crown"][1] + e["chin"][1]) / 2
        side = int((e["chin"][1] - e["crown"][1]) * 1.5)
        x0, y0 = int(ex - side / 2), int(cy - side / 2)
        c = im.crop((x0, y0, x0 + side, y0 + side))
        bg = Image.new("RGBA", c.size, (70, 70, 80, 255))
        bg.alpha_composite(c)
        k = 280 / side
        big = bg.resize((280, 280), Image.LANCZOS)
        d = ImageDraw.Draw(big)

        def P(x, y):
            return (x - x0) * k, (y - y0) * k
        for pt in e["eyes"]:
            X, Y = P(*pt)
            d.ellipse([X - 3, Y - 3, X + 3, Y + 3], outline=(255, 0, 0), width=2)
        X, Y = P(*e["chin"])
        d.line([X - 12, Y, X + 12, Y], fill=(0, 255, 0), width=2)
        X, Y = P(*e["crown"])
        d.line([X - 12, Y, X + 12, Y], fill=(255, 0, 255), width=2)
        a, b, yy = e["cheeks"]
        X1, Y1 = P(a, yy)
        X2, _ = P(b, yy)
        d.line([X1, Y1, X2, Y1], fill=(255, 255, 0), width=1)
        d.text((4, 258), cid, fill=(255, 255, 255), font=font("bold", 16))
        tiles.append(big)
    cols = min(6, max(1, len(tiles)))
    rws = math.ceil(len(tiles) / cols)
    sheet = Image.new("RGB", (cols * 284, rws * 284), (0, 0, 0))
    for i, t in enumerate(tiles):
        sheet.paste(t.convert("RGB"), ((i % cols) * 284, (i // cols) * 284))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=92)
    print(out)
    return 0


def parse_points(e: dict, args: list[str]) -> dict:
    for a in args:
        key, _, val = a.partition("=")
        nums = [int(round(float(v))) for v in val.split(",")]
        if key == "eyes" and len(nums) == 4:
            e["eyes"] = [nums[:2], nums[2:]]
        elif key in ("chin", "crown") and len(nums) == 2:
            e[key] = nums
        elif key == "cheeks" and len(nums) == 3:
            e["cheeks"] = nums
        elif key == "class":
            e["class"] = val
        else:
            raise SystemExit(f"読めない指定: {a}")
    return e


def cmd_calc(cid: str, args: list[str]) -> int:
    """記録を書き換えずに、測った点から頭身と会話画面での頭の高さを出す（fit_portrait.py のプレビューは全身の高さが同じ）"""
    data, manifest, chars = context()
    e = parse_points(dict(data["characters"].get(cid, {})), args)
    m = measure(e, cid, manifest, chars)
    if not m:
        raise SystemExit("eyes・chin・crown・cheeks を全部書く")
    st, why = status(e, m, data["spec"])
    print(f"{cid}: {m['head_body']:.2f}頭身・会話画面の頭の高さ {m['head_game']:.0f}px・頬の幅 {m['cheek_game']:.0f}px → {why or '規格内'}")
    return 0


def cmd_set(cid: str, args: list[str]) -> int:
    data = load()
    e = parse_points(data["characters"].setdefault(cid, {}), args)
    rel = e.get("sprite") or default_sprite(cid)
    e["blob"] = git_blob(rel)
    save(data)
    print(f"{cid}: 記録した（{rel} の版 {e['blob'][:10]}）。overlay で点が合っているか確かめる")
    return 0


def cmd_stamp(cid: str) -> int:
    data = load()
    e = data["characters"][cid]
    rel = e.get("sprite") or default_sprite(cid)
    e["blob"] = git_blob(rel)
    save(data)
    print(f"{cid}: 今の立ち絵の版 {e['blob'][:10]} を記録した")
    return 0


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd, rest = argv[0], argv[1:]
    out = image = None
    if "--image" in rest:
        i = rest.index("--image")
        image = Path(rest[i + 1])
        rest = rest[:i] + rest[i + 2:]
    if "--out" in rest:
        i = rest.index("--out")
        out = Path(rest[i + 1])
        rest = rest[:i] + rest[i + 2:]
    if cmd == "check":
        return cmd_check()
    if cmd == "report":
        return cmd_report()
    if cmd == "sheet":
        return cmd_sheet()
    if cmd == "faces":
        return cmd_faces(rest)
    if cmd == "grid":
        return cmd_grid(rest[0], Path(rest[1]) if len(rest) > 1 else Path(f"portrait-grid-{rest[0]}.jpg"), image)
    if cmd == "calc":
        return cmd_calc(rest[0], rest[1:])
    if cmd == "overlay":
        return cmd_overlay(rest, out or Path("portrait-overlay.jpg"))
    if cmd == "set":
        return cmd_set(rest[0], rest[1:])
    if cmd == "stamp":
        return cmd_stamp(rest[0])
    raise SystemExit(f"知らないコマンド: {cmd}")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
