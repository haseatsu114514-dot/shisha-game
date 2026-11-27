#!/usr/bin/env python3
"""ロード漫画「モデルの仕事」の原画を OpenAI 画像API（images/edits）で生成する。

参照画像: 下敷き（tools/loading_comic_cut.py template で再生成）、はじめ・あげはの通常立ち絵、
同じシリーズのあげはの採用済み漫画2コマ（画風合わせ）。プロンプトは prompt.txt。
キーはコードに書かない。環境変数 OPENAI_API_KEY があれば付ける（クラウド環境ではプロキシが付ける）。

使い方: python3 generate.py <下敷きPNG> <出力名>   → raw/<出力名>.png
"""
import base64, json, os, sys, urllib.request, uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2.6-sunburst")


def multipart(fields, files):
    b = uuid.uuid4().hex
    out = bytearray()
    for k, v in fields.items():
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    for f in files:
        mime = "image/webp" if f.suffix == ".webp" else "image/png"
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"image[]\"; filename=\"{f.name}\"\r\nContent-Type: {mime}\r\n\r\n".encode()
        out += f.read_bytes() + b"\r\n"
    out += f"--{b}--\r\n".encode()
    return bytes(out), f"multipart/form-data; boundary={b}"


def main():
    template, name = Path(sys.argv[1]), sys.argv[2]
    refs = [template,
            ROOT / "assets/sprites/characters/hajime/chr_hajime_normal.png",
            ROOT / "assets/sprites/characters/ageha/chr_ageha_normal.png",
            ROOT / "remake/img/loading/ageha-full-coord-1.webp",
            ROOT / "remake/img/loading/ageha-full-coord-2.webp"]
    prompt = (HERE / "prompt.txt").read_text()
    body, ctype = multipart({"model": MODEL, "prompt": prompt, "size": "1536x1024", "quality": "medium", "n": "1"}, refs)
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, method="POST")
    req.add_header("Content-Type", ctype)
    if os.environ.get("OPENAI_API_KEY"):
        req.add_header("Authorization", f"Bearer {os.environ['OPENAI_API_KEY']}")
    with urllib.request.urlopen(req, timeout=600) as r:
        res = json.loads(r.read())
    dest = HERE / "raw" / f"{name}.png"
    dest.parent.mkdir(exist_ok=True)
    dest.write_bytes(base64.b64decode(res["data"][0]["b64_json"]))
    print(dest, MODEL)


if __name__ == "__main__":
    main()
