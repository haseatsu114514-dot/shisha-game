#!/usr/bin/env python3
"""日本のシーシャ店・機材の参考写真を、手元の git 管理外フォルダへ取ってくる。

写真は各サイトの著作物なので、リポジトリには入れない（このリポジトリは公開）。
一覧 asset_sources/shisha-hardware-reference/web-refs/refs.json の URL から取り、
asset_sources/shisha-hardware-reference/web-refs/images/ に保存する（.gitignore 済み）。
画像生成の前に見る・生成ツールに渡す参考にだけ使い、ゲーム素材として使わない・配らない。

使い方:
  python3 tools/fetch_shisha_web_refs.py            # 全部（取得済みは飛ばす）
  python3 tools/fetch_shisha_web_refs.py --only hmd # 部位で絞る（id の接頭辞）
  python3 tools/fetch_shisha_web_refs.py --list     # 一覧だけ表示
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "asset_sources" / "shisha-hardware-reference" / "web-refs"
UA = "shisha-game-reference-fetch/1.0 (+https://github.com/haseatsu114514-dot/shisha-game)"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--only", help="id の接頭辞で絞る（stand / bowl / hmd / interior など）")
    ap.add_argument("--list", action="store_true", help="取得せず一覧を表示する")
    args = ap.parse_args()
    refs = json.loads((BASE / "refs.json").read_text(encoding="utf-8"))
    if args.only:
        refs = [r for r in refs if r["id"].startswith(args.only)]
    if args.list:
        for r in refs:
            print(f'{r["id"]:28s} {r["note"]}\n{"":28s} {r["page"]}')
        return 0
    try:
        from PIL import Image
    except ImportError:
        Image = None
    cache = BASE / "images"
    cache.mkdir(exist_ok=True)
    ok = skip = fail = 0
    for r in refs:
        dst = cache / f'{r["id"]}.jpg'
        if dst.exists():
            skip += 1
            continue
        req = urllib.request.Request(r["image"], headers={"User-Agent": UA, "Referer": r["page"]})
        try:
            data = urllib.request.urlopen(req, timeout=60).read()
        except (urllib.error.URLError, TimeoutError) as e:
            print(f'NG {r["id"]}: {e}  （ページ: {r["page"]}）')
            fail += 1
            continue
        if Image is None:
            dst.write_bytes(data)
        else:
            im = Image.open(io.BytesIO(data)).convert("RGB")
            im.thumbnail((1600, 1600))
            im.save(dst, "JPEG", quality=88)
        ok += 1
        print(f'ok {r["id"]}')
        time.sleep(1.0)
    print(f"取得 {ok} / 取得済み {skip} / 失敗 {fail} → {cache.relative_to(ROOT)}")
    if fail:
        print("失敗した写真はリンク切れの可能性がある。ページを開いて別の写真に差し替え、refs.json を直す。")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
