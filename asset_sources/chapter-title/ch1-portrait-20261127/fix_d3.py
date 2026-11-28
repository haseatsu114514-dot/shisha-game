#!/usr/bin/env python3
"""案7（ライバルたち・d3_v1）の、なるとアダムを新しいデザインの立ち絵に合わせて描き直す（VPN25）。
構図・光・はじめ・みんとはそのまま。OpenAI images edit, model gpt-image-2.6-sunburst。
使い方: python3 fix_d3.py <tag> → raw/d3_fix_<tag>.png（prompts.json に追記）"""
import base64, io, json, os, sys, uuid, urllib.request, urllib.error, concurrent.futures as cf
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
MODEL = "gpt-image-2.6-sunburst"
NEW = lambda cid: ROOT / f"remake/img/sprites/character_variants/new/{cid}/chr_{cid}_normal.webp"
PROMPT = (
    "Edit the FIRST image. Keep everything the same: the vertical composition, camera, poses, positions, lighting colors, smoke, background, "
    "the dark calm lower third, and the young man in the black cap and black hoodie in the center and the black-haired girl with horns on the left must stay exactly as they are. "
    "Redraw ONLY two people to match the current character designs in the attached reference sprites: "
    "(1) the silver-haired young man on the right: match reference 'naru' exactly — cream and dark-brown color-block zip jacket with a high collar over a dark brown turtleneck, "
    "NO necklace, NO chains, NO dog tags, same silver hair and amber eyes, same confident smile and pose; "
    "(2) the man with red-and-green split hair at the back: match reference 'adam' exactly — white crew-neck T-shirt and a black apron tied at the waist, muscular build, "
    "same arms-crossed pose and proud look. "
    "Same painting style as the first image. No text, no letters, no logos anywhere. No hookah or shisha equipment."
)
def png_bytes(path, max_side=1536):
    im = Image.open(path).convert("RGBA"); im.thumbnail((max_side, max_side))
    buf = io.BytesIO(); im.save(buf, "PNG"); return buf.getvalue()
def run(tag):
    key = os.environ["OPENAI_API_KEY"]
    images = [("d3_v1.png", png_bytes(HERE / "raw/d3_v1.png")), ("naru.png", png_bytes(NEW("naru"))), ("adam.png", png_bytes(NEW("adam")))]
    b = uuid.uuid4().hex
    def part(k, v): return f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    body = b"".join(part(k, v) for k, v in [("model", MODEL), ("prompt", PROMPT), ("size", "1024x1536"), ("quality", "high"), ("output_format", "png")])
    for fname, data in images:
        body += f'--{b}\r\nContent-Disposition: form-data; name="image[]"; filename="{fname}"\r\nContent-Type: image/png\r\n\r\n'.encode() + data + b"\r\n"
    body += f"--{b}--\r\n".encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, headers={"Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={b}"})
    try: r = json.load(urllib.request.urlopen(req, timeout=900))
    except urllib.error.HTTPError as e: return tag, "ERR " + e.read().decode()[:400]
    out = HERE / "raw" / f"d3_fix_{tag}.png"; out.write_bytes(base64.b64decode(r["data"][0]["b64_json"]))
    return tag, out.name
if __name__ == "__main__":
    tags = sys.argv[1:] or ["a"]
    log_path = HERE / "prompts.json"; log = json.loads(log_path.read_text())
    with cf.ThreadPoolExecutor(len(tags)) as ex:
        for tag, res in ex.map(run, tags):
            print(tag, res, flush=True)
            log.append({"id": "d3_fix", "title": "ライバルたち（なる・アダムを新しいデザインに）", "tag": tag, "model": MODEL, "endpoint": "/v1/images/edits", "size": "1024x1536",
                        "quality": "high", "references": ["raw/d3_v1.png", "new/naru/chr_naru_normal.webp", "new/adam/chr_adam_normal.webp"], "result": res, "prompt": PROMPT})
    log_path.write_text(json.dumps(log, ensure_ascii=False, indent=1) + "\n")
