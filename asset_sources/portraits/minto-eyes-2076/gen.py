#!/usr/bin/env python3
"""#2076 みんと営業 normal/smile の目だけマスク編集（gpt-image-2.5-sunburst, /v1/images/edits）。
顔周り256x256を4倍拡大して目の範囲だけ透過マスクで編集し、縮小して目の範囲だけ羽根付きで元画像へ戻す。"""
import base64, io, json, os, sys, uuid, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
ROOT = Path(__file__).resolve().parents[3]; HERE = Path(__file__).parent
BOX = (362, 202, 618, 458)          # 顔周り crop（896x1200 座標）
EYES = [(446, 336, 487, 371), (493, 326, 533, 361)]  # 編集対象＝左右の目（楕円）
PROMPT = ("Edit only the two eyes inside the masked area. Make the left and right eyes a matching pair: same eye shape, same size, "
 "same iris size and green color, same highlights, same upper lash line thickness, naturally drawn for a slight three-quarter view "
 "anime face. Do not touch the bangs or hair strands. Keep the same gaze direction, eyebrows, bangs, skin, line style and expression. Clean crisp anime line art. Change nothing else.")
def call(img, mask):
    key = os.environ["OPENAI_API_KEY"]; b = uuid.uuid4().hex
    def f(k, v): return f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    def file(k, data): return f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{k}.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + data + b"\r\n"
    def png(im): o = io.BytesIO(); im.save(o, "PNG"); return o.getvalue()
    body = b"".join([f("model", "gpt-image-2.5-sunburst"), f("prompt", PROMPT), f("size", "1024x1024"), f("quality", "high"),
                     file("image[]", png(img)), file("mask", png(mask))]) + f"--{b}--\r\n".encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={b}"})
    return Image.open(io.BytesIO(base64.b64decode(json.load(urllib.request.urlopen(req, timeout=600))["data"][0]["b64_json"]))).convert("RGBA")
def run(name, tag):
    src = Image.open(ROOT / f"assets/sprites/characters/minto/chr_minto_{name}.png").convert("RGBA")
    crop = src.crop(BOX); bg = Image.new("RGBA", crop.size, (255, 255, 255, 255)); bg.alpha_composite(crop)
    big = bg.resize((1024, 1024), Image.LANCZOS)
    m = Image.new("RGBA", (1024, 1024), (0, 0, 0, 255)); k = 4
    for e in EYES: ImageDraw.Draw(m).ellipse([(e[0]-BOX[0])*k, (e[1]-BOX[1])*k, (e[2]-BOX[0])*k, (e[3]-BOX[1])*k], fill=(0, 0, 0, 0))
    out = call(big, m); out.save(HERE / f"raw/{name}_{tag}_crop.png")
    small = out.resize(crop.size, Image.LANCZOS)
    feather = Image.new("L", crop.size, 0)
    for e in EYES: ImageDraw.Draw(feather).ellipse([e[0]-BOX[0]+2, e[1]-BOX[1]+2, e[2]-BOX[0]-2, e[3]-BOX[1]-2], fill=255)
    feather = feather.filter(ImageFilter.GaussianBlur(2))
    merged = Image.composite(small, crop, feather); merged.putalpha(crop.split()[3])
    res = src.copy(); res.paste(merged, BOX[:2]); res.save(HERE / f"raw/{name}_{tag}_full.png", optimize=True)
    print(name, tag, "ok")
if __name__ == "__main__":
    for n in sys.argv[2:]: run(n, sys.argv[1])
