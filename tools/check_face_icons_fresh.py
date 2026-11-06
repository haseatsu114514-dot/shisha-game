#!/usr/bin/env python3
"""顔アイコンが今の立ち絵から作られているかを確かめる（2026-10-31 オーナー「旧デザインは使わないで。この機に根絶して」SBD83）。

みんとの立ち絵を描き直した時（#2067〜#2082）に顔アイコンを作り直し忘れ、LIME・地図・名前欄に旧デザインの顔が残っていた。
tools/make_face_icons.py は、作ったアイコンごとに元の立ち絵の git 上の版（blob SHA）を assets/ui/face_icons/sources.json に残す。
ここでは、その版が今の立ち絵と同じかを見る。違えば、立ち絵だけ描き直してアイコンが古いまま。

2026-11-06 追加（顔アイコンを新バージョンの立ち絵に合わせる）:
- 新バージョンの顔アイコン（assets/ui/face_icons/new/）も同じように見る。
- ゲームは WebP（remake/img/ui/face_icons/）を優先して読む。PNG だけ作り直して WebP が古い切り抜きのまま
  22人分残っていたので、sources.json に残した WebP の版が今の WebP と同じかも見る。
- remake/data/manifest.json の一覧に無いアイコンはゲームに出ない（ヨルが漏れていた）。一覧とファイルが合っているかも見る。

直し方:  python3 tools/make_face_icons.py <キャラ>   （新バージョンは --style new。WebP と manifest も一緒に作り直す）
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "assets" / "ui" / "face_icons"
SOURCES = ICONS / "sources.json"
MANIFEST = ROOT / "remake" / "data" / "manifest.json"
WEBP = "remake/img/ui/face_icons"


def blob(rel: str) -> str | None:
    out = subprocess.run(["git", "ls-files", "-s", "--", rel], cwd=ROOT, capture_output=True, text=True).stdout.split()
    return out[1] if len(out) >= 2 else None


def tracked_icons() -> list[str]:
    """登録されている顔アイコン（face_icons からの相対パス。画風の別は new/face_x.png）。
    CI の quick は画像を checkout しないので、フォルダでなく git の一覧から取る"""
    out = subprocess.run(["git", "ls-files", "--", "assets/ui/face_icons/"], cwd=ROOT, capture_output=True, text=True).stdout
    rels = [Path(line).relative_to("assets/ui/face_icons") for line in out.split()]
    return sorted(str(r) for r in rels if r.name.startswith("face_") and r.suffix == ".png" and len(r.parts) <= 2)


def main() -> int:
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    problems = []
    icons = tracked_icons()
    for icon in icons:
        entry = sources.get(icon)
        style, _, name = icon.rpartition("/")
        who = name[5:-4]
        fix = f"python3 tools/make_face_icons.py {'--style ' + style + ' ' if style else ''}{who}"
        if not entry:
            problems.append(f"{icon}: どの立ち絵から作ったかの記録が無い（{fix}）")
            continue
        now = blob(entry["sprite"])
        if now is None:
            problems.append(f"{icon}: 元の立ち絵 {entry['sprite']} が無い")
        elif now != entry["blob"]:
            problems.append(f"{icon}: 立ち絵 {entry['sprite']} が描き直されたのに、顔アイコンが古いまま → {fix}")
        webp = blob(f"{WEBP}/{Path(icon).with_suffix('.webp')}")
        if webp is None:
            problems.append(f"{icon}: ゲームが読む WebP が無い → {fix}")
        elif webp != entry.get("webp"):
            problems.append(f"{icon}: WebP が今の PNG から作られていない（古い切り抜きが出る） → {fix}")
    for icon in sorted(set(sources) - set(icons)):
        problems.append(f"{icon}: sources.json にあるがアイコンが無い")
    listed = set(manifest.get("faceIcons", []))
    listed |= {f"{style}/{n}" for style, names in manifest.get("faceIconVariants", {}).items() for n in names}
    webp_listed = {w.removeprefix("ui/face_icons/") for w in manifest.get("webp", []) if w.startswith("ui/face_icons/")}
    for icon in icons:
        if icon not in listed:
            problems.append(f"{icon}: manifest の一覧に無いのでゲームに出ない → python3 tools/make_face_icons.py")
        elif icon not in webp_listed:
            problems.append(f"{icon}: manifest の webp に無い（PNG のまま読む） → python3 tools/make_face_icons.py")
    for icon in sorted(listed - set(icons)):
        problems.append(f"{icon}: manifest の一覧にあるがアイコンが無い")
    if problems:
        print("顔アイコンが今の立ち絵と合っていない:\n  " + "\n  ".join(problems))
        return 1
    print(f"face icons fresh: {len(icons)} icons (PNG and WebP) match their current portraits")
    return 0


if __name__ == "__main__":
    sys.exit(main())
