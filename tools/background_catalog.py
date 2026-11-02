#!/usr/bin/env python3
"""背景の台帳（data/background_catalog.json）を扱う。規格の説明は docs/background_standard.md。

assets/backgrounds/ の1枚ごとに、場所・時間帯・天候・画素数・明るさ・git上の版を記録する。
比較図（同じ場所の昼・夜・曇りを1行に並べる）はこの記録と実画像から作る。

    python3 tools/background_catalog.py sync             # 画像を測って台帳に足す・更新する（画像が要る）
    python3 tools/background_catalog.py check            # 記録漏れ・古い記録・規格外を調べる（画像不要。CI の quick）
    python3 tools/background_catalog.py report           # 全件の表（Markdown）
    python3 tools/background_catalog.py sheet [--out DIR]  # 場所ごとの比較図（画像が要る）

台帳の手書き項目（sync で消えない）:
    accepted : 規格外でも今のまま使う理由（例 "2026-11-02 規格制定前の既存絵"）。check の警告を出さない
    prompt   : 生成に使った依頼文の場所（例 "tools/bg_prompts.txt R4"）
    note     : 場所の説明・店固有の決め事など一言
自動項目: place / time / weather / size / luma / blob（sync が上書きする）
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "data" / "background_catalog.json"
BG_DIR = ROOT / "assets" / "backgrounds"
SHEET_DIR = ROOT / "asset_sources" / "reference-sheets" / "backgrounds"
TIME_WORDS = ("day", "night", "dusk", "morning", "evening")
TIME_ORDER = {"morning": 0, "day": 1, "dusk": 2, "evening": 3, "night": 4, "": 5}


# ---------------------------------------------------------------- 読み書き

def load() -> dict:
    return json.loads(CATALOG.read_text(encoding="utf-8"))


def save(data: dict) -> None:
    data["backgrounds"] = dict(sorted(data["backgrounds"].items()))
    CATALOG.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def git_blob(rel: str) -> str | None:
    """git 上の版（blob SHA。LFS ならポインタの SHA）。手元にファイルがあれば中身から計算し、無ければ登録内容を使う"""
    if (ROOT / rel).exists():
        out = subprocess.run(["git", "hash-object", "--", rel], cwd=ROOT, capture_output=True, text=True).stdout.strip()
        if out:
            return out
    out = subprocess.run(["git", "ls-files", "-s", "--", rel], cwd=ROOT, capture_output=True, text=True).stdout.split()
    return out[1] if len(out) >= 2 else None


def tracked() -> list[str]:
    """登録されている背景。CI の quick は画像を checkout しないので、フォルダでなく git の一覧から取る"""
    out = subprocess.run(["git", "ls-files", "--", "assets/backgrounds/*.png", "assets/backgrounds/*.webp"],
                         cwd=ROOT, capture_output=True, text=True).stdout
    return sorted(Path(line).name for line in out.split())


# ---------------------------------------------------------------- 名前の分解

def parse_name(name: str) -> dict:
    """bg_tonari_inside_overcast_night.png → place=tonari_inside, time=night, weather=overcast"""
    stem = re.sub(r"\.(png|webp)$", "", name)
    stem = re.sub(r"^bg_", "", stem)
    parts = stem.split("_")
    time = weather = ""
    if parts and parts[-1] in TIME_WORDS:
        time = parts.pop()
    if parts and parts[-1] == "overcast":
        weather = parts.pop()
    return {"place": "_".join(parts) or stem, "time": time, "weather": weather}


def measure(name: str) -> dict | None:
    path = BG_DIR / name
    if not path.exists() or path.stat().st_size < 400:
        return None  # LFS のポインタだけ・未取得
    from PIL import Image
    with Image.open(path) as im:
        size = list(im.size)
        g = im.convert("L")
        g.thumbnail((320, 320))
        getter = getattr(g, "get_flattened_data", g.getdata)
        px = list(getter())
        luma = round(sum(px) / max(1, len(px)))
    return {"size": size, "luma": luma}


# ---------------------------------------------------------------- 判定

def status(entry: dict, spec: dict) -> tuple[str, str]:
    """(判定, 説明)。判定は ok / accepted / warn"""
    w, h = entry.get("size") or (0, 0)
    problems = []
    if [w, h] != spec["canvas"]:
        problems.append(f"{w}x{h}（規格 {spec['canvas'][0]}x{spec['canvas'][1]}）")
    if w and abs(w / h - 16 / 9) > 0.01:
        problems.append("16:9 でない")
    luma = entry.get("luma")
    if luma is not None and luma < spec["luma_min"]:
        problems.append(f"暗さが焼き込まれている（平均輝度 {luma} < {spec['luma_min']}）")
    if not problems:
        return "ok", "規格内"
    if entry.get("accepted"):
        return "accepted", "規格外だが今のまま（" + entry["accepted"] + "）: " + "、".join(problems)
    return "warn", "、".join(problems)


def cmd_check() -> int:
    data = load()
    spec = data["spec"]
    entries = data["backgrounds"]
    names = tracked()
    errors, warns = [], []
    for name in names:
        e = entries.get(name)
        if not e:
            errors.append(f"{name}: 台帳に無い → python3 tools/background_catalog.py sync")
            continue
        now = git_blob(f"assets/backgrounds/{name}")
        if now and e.get("blob") != now:
            errors.append(f"{name}: 画像が差し替わったのに台帳が古い → python3 tools/background_catalog.py sync")
            continue
        st, why = status(e, spec)
        if st == "warn":
            warns.append(f"{name}: {why}")
    for name in sorted(set(entries) - set(names)):
        errors.append(f"{name}: 台帳にあるが画像が無い → sync で消す")
    for a in data.get("anchors", []):
        if a not in names:
            errors.append(f"画風の基準 {a} が assets/backgrounds に無い")
    for w in warns:
        print("WARN:", w)
    if errors:
        print("背景の台帳が今の画像と合っていない:\n  " + "\n  ".join(errors))
        return 1
    print(f"background catalog: {len(names)} backgrounds match the catalog ({len(warns)} warnings; 規格外は描き直しの候補で、CI は止めない)")
    return 0


def cmd_sync() -> int:
    data = load()
    entries = data["backgrounds"]
    names = tracked()
    added = updated = skipped = 0
    for name in names:
        e = entries.setdefault(name, {})
        if not e:
            added += 1
        e.update(parse_name(name))
        m = measure(name)
        blob = git_blob(f"assets/backgrounds/{name}")
        if m is None:
            skipped += 1
            if not e.get("size"):
                print(f"WARN: {name}: 画像の実体が無い（git lfs pull --include='assets/backgrounds/{name}'）")
            continue
        if e.get("blob") != blob or e.get("size") != m["size"]:
            updated += 1
        e.update(m)
        e["blob"] = blob
        # 項目の順番をそろえる
        order = ["place", "time", "weather", "size", "luma", "blob", "accepted", "prompt", "note"]
        entries[name] = {k: e[k] for k in order if k in e} | {k: v for k, v in e.items() if k not in order}
    for name in sorted(set(entries) - set(names)):
        print(f"removed: {name}（画像が無い）")
        del entries[name]
    save(data)
    print(f"background catalog: {len(names)} backgrounds ({added} added, {updated} measured, {skipped} without image)")
    return 0


def cmd_report() -> int:
    data = load()
    spec = data["spec"]
    print("| 背景 | 場所 | 時間帯 | 天候 | 画素数 | 平均輝度 | 判定 |")
    print("|---|---|---|---|---:|---:|---|")
    for name, e in sorted(data["backgrounds"].items(), key=lambda kv: (kv[1].get("place", ""), TIME_ORDER.get(kv[1].get("time", ""), 9), kv[0])):
        st, why = status(e, spec)
        size = "x".join(str(v) for v in e.get("size", [])) or "—"
        anchor = "★基準 " if name in data.get("anchors", []) else ""
        print(f"| {anchor}`{name}` | {e.get('place', '')} | {e.get('time') or '—'} | {e.get('weather') or '—'} | {size} | {e.get('luma', '—')} | {why} |")
    return 0


# ---------------------------------------------------------------- 比較図

def cmd_sheet(out_dir: Path) -> int:
    from PIL import Image, ImageDraw, ImageFont
    data = load()
    spec = data["spec"]
    anchors = set(data.get("anchors", []))
    groups: dict[str, list[str]] = {}
    for name, e in data["backgrounds"].items():
        groups.setdefault(e.get("place", name), []).append(name)
    for names in groups.values():
        names.sort(key=lambda n: (data["backgrounds"][n].get("weather", ""), TIME_ORDER.get(data["backgrounds"][n].get("time", ""), 9), n))
    try:
        font = ImageFont.truetype(str(ROOT / "remake/fonts/ZenKakuGothicNew-Medium.woff2"), 18)
    except OSError:
        font = ImageFont.truetype("/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf", 18)
    TW, TH, GAP, LABEL = 400, 225, 12, 48
    max_cols = max(len(v) for v in groups.values())
    cols = min(max_cols, spec.get("sheet_columns", 5))
    per_sheet = spec.get("sheet_rows", 12)
    places = sorted(groups)
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for i in range(0, len(places), per_sheet):
        chunk = places[i:i + per_sheet]
        rows = sum(max(1, -(-len(groups[p]) // cols)) for p in chunk)
        W = GAP + cols * (TW + GAP)
        H = GAP + rows * (TH + LABEL + GAP) + len(chunk) * 30
        im = Image.new("RGB", (W, H), (20, 22, 28))
        d = ImageDraw.Draw(im)
        y = GAP
        for place in chunk:
            d.text((GAP, y), place, font=font, fill=(236, 238, 242))
            y += 30
            for j, name in enumerate(groups[place]):
                e = data["backgrounds"][name]
                x = GAP + (j % cols) * (TW + GAP)
                if j and j % cols == 0:
                    y += TH + LABEL + GAP
                path = BG_DIR / name
                if path.exists() and path.stat().st_size >= 400:
                    t = Image.open(path).convert("RGB")
                    t.thumbnail((TW, TH))
                    im.paste(t, (x, y))
                else:
                    d.rectangle([x, y, x + TW, y + TH], outline=(90, 90, 90))
                    d.text((x + 10, y + 10), "(画像なし)", font=font, fill=(150, 150, 150))
                st, _ = status(e, spec)
                color = {"ok": (160, 220, 160), "accepted": (200, 200, 140), "warn": (240, 150, 120)}[st]
                tag = ("★基準 " if name in anchors else "") + name
                d.text((x, y + TH + 4), tag[:40], font=font, fill=(236, 238, 242))
                label = {"ok": "規格内", "accepted": "規格外・容認", "warn": "規格外"}[st]
                d.text((x, y + TH + 26), f"{'x'.join(map(str, e.get('size', [])))}  輝度{e.get('luma', '—')}  {label}", font=font, fill=color)
            y += TH + LABEL + GAP
        first, last = chunk[0], chunk[-1]
        path = out_dir / f"backgrounds-{i // per_sheet + 1:02d}-{first}--{last}.jpg"
        im.save(path, quality=82)
        written.append(path)
    for p in written:
        print("wrote", p.relative_to(ROOT) if p.is_relative_to(ROOT) else p)
    return 0


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd, rest = argv[0], argv[1:]
    if cmd == "check":
        return cmd_check()
    if cmd == "sync":
        return cmd_sync()
    if cmd == "report":
        return cmd_report()
    if cmd == "sheet":
        out = Path(rest[rest.index("--out") + 1]) if "--out" in rest else SHEET_DIR
        return cmd_sheet(out)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
