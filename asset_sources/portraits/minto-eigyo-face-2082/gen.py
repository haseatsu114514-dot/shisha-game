#!/usr/bin/env python3
"""#2082 みんと営業5表情（#2070版を土台）の顔を、素(ura)の顔を元に「同じ人が演技でコンカフェをしている」ノリで描き直す。
gpt-image-2.5-sunburst /v1/images/edits。image[0]=営業の顔周り(4倍), image[1]=対応する素の顔周り(参照)。
顔の楕円（目・鼻・口）だけ透過マスクで編集し、縮小してその楕円だけ元画像へ合成（髪・衣装・ポーズ・配置は不変）。
使い方: python3 gen.py <tag> <face> <base_png>"""
import base64, io, json, os, sys, uuid, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
ROOT = Path(__file__).resolve().parents[3]; HERE = Path(__file__).parent
BOX = (362, 202, 618, 458)
FACE = (440, 305, 545, 408)
REF = {"normal": "ura_normal", "smile": "ura_smile", "sad": "ura_sad", "surprise": "ura_surprise", "wink": "ura_smile"}
EXPR = {"normal": "a bright, practiced customer-service smile with closed mouth",
        "smile": "a big cheerful open-mouth smile with a small fang",
        "sad": "a cute, slightly exaggerated troubled sad pout",
        "surprise": "a lively surprised face with an open mouth",
        "wink": "a playful wink (left eye closed) with a cute smile and the tongue slightly out"}
PROMPT = ("Image 1 is the character to edit; image 2 is the same girl in her off-duty look. Redraw only the masked face (eyes, nose, mouth) of image 1 "
 "so it is clearly the same person as image 2: the same face structure and the same narrower, elegant almond green eyes, both eyes matching in size and shape, "
 "natural for the slight three-quarter view. She is acting as a concafe girl at work, so give the face {expr}, performed with energy. "
 "Do not change bangs, hair, horns, hands, skin tone or line style. Clean crisp anime line art.")
def png(im): o = io.BytesIO(); im.save(o, "PNG"); return o.getvalue()
def face(path):
    im = Image.open(path).convert("RGBA"); c = im.crop(BOX); bg = Image.new("RGBA", c.size, (255, 255, 255, 255)); bg.alpha_composite(c)
    return im, c, bg.resize((1024, 1024), Image.LANCZOS)
def call(imgs, mask, prompt):
    b = uuid.uuid4().hex
    def f(k, v): return f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    def fl(k, n, d): return f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{n}.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + d + b"\r\n"
    body = b"".join([f("model", "gpt-image-2.5-sunburst"), f("prompt", prompt), f("size", "1024x1024"), f("quality", "high")]
        + [fl("image[]", f"i{i}", png(x)) for i, x in enumerate(imgs)] + [fl("mask", "mask", png(mask))]) + f"--{b}--\r\n".encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body,
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}", "Content-Type": f"multipart/form-data; boundary={b}"})
    return Image.open(io.BytesIO(base64.b64decode(json.load(urllib.request.urlopen(req, timeout=600))["data"][0]["b64_json"]))).convert("RGBA")
def run(tag, name, base):
    src, crop, big = face(base)
    _, _, ref = face(ROOT / f"assets/sprites/characters/minto/chr_minto_{REF[name]}.png")
    k = 4; m = Image.new("RGBA", (1024, 1024), (0, 0, 0, 255))
    ImageDraw.Draw(m).ellipse([(FACE[0]-BOX[0])*k, (FACE[1]-BOX[1])*k, (FACE[2]-BOX[0])*k, (FACE[3]-BOX[1])*k], fill=(0, 0, 0, 0))
    out = call([big, ref], m, PROMPT.format(expr=EXPR[name])); out.save(HERE / f"raw/{name}_{tag}_crop.png")
    small = out.resize(crop.size, Image.LANCZOS); fe = Image.new("L", crop.size, 0)
    ImageDraw.Draw(fe).ellipse([FACE[0]-BOX[0]+3, FACE[1]-BOX[1]+3, FACE[2]-BOX[0]-3, FACE[3]-BOX[1]-3], fill=255)
    mg = Image.composite(small, crop, fe.filter(ImageFilter.GaussianBlur(3))); mg.putalpha(crop.split()[3])
    res = src.copy(); res.paste(mg, BOX[:2]); res.save(HERE / f"raw/{name}_{tag}_full.png", optimize=True); print(name, tag, "ok", flush=True)
if __name__ == "__main__":
    run(*sys.argv[1:4])
