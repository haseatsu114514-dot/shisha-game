#!/usr/bin/env python3
"""顔アイコンが今の立ち絵から作られているかを確かめる（2026-10-31 オーナー「旧デザインは使わないで。この機に根絶して」SBD83）。

みんとの立ち絵を描き直した時（#2067〜#2082）に顔アイコンを作り直し忘れ、LIME・地図・名前欄に旧デザインの顔が残っていた。
tools/make_face_icons.py は、作ったアイコンごとに元の立ち絵の git 上の版（blob SHA）を assets/ui/face_icons/sources.json に残す。
ここでは、その版が今の立ち絵と同じかを見る。違えば、立ち絵だけ描き直してアイコンが古いまま。

直し方:  python3 tools/make_face_icons.py <キャラ>   → 必要なら WebP も作り直す（python3 remake/tools/build_images.py）
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "assets" / "ui" / "face_icons"
SOURCES = ICONS / "sources.json"


def blob(rel: str) -> str | None:
    out = subprocess.run(["git", "ls-files", "-s", "--", rel], cwd=ROOT, capture_output=True, text=True).stdout.split()
    return out[1] if len(out) >= 2 else None


def tracked_icons() -> list[str]:
    """登録されている顔アイコン。CI の quick は画像を checkout しないので、フォルダでなく git の一覧から取る"""
    out = subprocess.run(["git", "ls-files", "--", "assets/ui/face_icons/face_*.png"], cwd=ROOT, capture_output=True, text=True).stdout
    return sorted(Path(line).name for line in out.split())


def main() -> int:
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))
    problems = []
    icons = tracked_icons()
    for icon in icons:
        entry = sources.get(icon)
        if not entry:
            problems.append(f"{icon}: どの立ち絵から作ったかの記録が無い（tools/make_face_icons.py で作る）")
            continue
        now = blob(entry["sprite"])
        if now is None:
            problems.append(f"{icon}: 元の立ち絵 {entry['sprite']} が無い")
        elif now != entry["blob"]:
            who = icon[5:-4]
            problems.append(f"{icon}: 立ち絵 {entry['sprite']} が描き直されたのに、顔アイコンが古いまま → python3 tools/make_face_icons.py {who}")
    for icon in sorted(set(sources) - set(icons)):
        problems.append(f"{icon}: sources.json にあるがアイコンが無い")
    if problems:
        print("顔アイコンが今の立ち絵と合っていない:\n  " + "\n  ".join(problems))
        return 1
    print(f"face icons fresh: {len(sources)} icons match their current portraits")
    return 0


if __name__ == "__main__":
    sys.exit(main())
