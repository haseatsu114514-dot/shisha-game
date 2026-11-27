#!/usr/bin/env python3
"""②（オチ）のコマだけを OpenAI 画像API（images/edits）で 1536x1024 の1枚絵として生成する。
参照: 採用済みの①（panel1.png）、はじめ・あげはの通常立ち絵。プロンプトは prompt-panel2.txt。
キーはコードに書かない（環境変数 OPENAI_API_KEY か、クラウド環境のプロキシ）。
使い方: python3 generate_panel2.py <出力名> → raw/<出力名>.png"""
import base64, json, os, sys, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate import multipart, HERE, ROOT, MODEL  # noqa: E402

refs = [HERE / "panel1.png",
        ROOT / "assets/sprites/characters/hajime/chr_hajime_normal.png",
        ROOT / "assets/sprites/characters/ageha/chr_ageha_normal.png"]
body, ctype = multipart({"model": MODEL, "prompt": (HERE / "prompt-panel2.txt").read_text(),
                         "size": "1536x1024", "quality": "medium", "n": "1"}, refs)
req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, method="POST")
req.add_header("Content-Type", ctype)
if os.environ.get("OPENAI_API_KEY"):
    req.add_header("Authorization", f"Bearer {os.environ['OPENAI_API_KEY']}")
with urllib.request.urlopen(req, timeout=600) as r:
    res = json.loads(r.read())
dest = HERE / "raw" / f"{sys.argv[1]}.png"
dest.write_bytes(base64.b64decode(res["data"][0]["b64_json"]))
print(dest, MODEL)
