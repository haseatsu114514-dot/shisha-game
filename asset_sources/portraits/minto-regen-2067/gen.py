#!/usr/bin/env python3
"""#2067 みんと立ち絵10表情の再生成（OpenAI images edit, model gpt-image-2.5-sunburst）。"""
import base64, json, os, sys, concurrent.futures as cf, urllib.request, uuid
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).parent / "raw"
SRC = ROOT / "assets/sprites/characters/minto"
MODEL = "gpt-image-2.5-sunburst"
PROMPT = ("Redraw this exact same anime character sprite as a clean, high-quality full-body visual novel standing sprite. "
 "Keep the SAME person: identical face shape, eyes (green), hairstyle (long straight black hair with bangs), expression, pose, hand positions, "
 "outfit, accessories, colors and proportions. Do not redesign anything. Same framing: full body head to shoes, same size and position in the canvas. "
 "Fix only quality problems: remove JPEG-like crunchy noise, blurry smudges, jagged or broken line art, melted details on hands, fingers, frills, buttons, bag and shoes, "
 "and the heavy dark black outline along the jaw/face line (make the face contour a thin soft line matching the rest of the line art). "
 "Crisp clean cel-shaded anime line art, smooth shading. Transparent background, no shadow on the floor, no text.")
def run(name, tag):
    key = os.environ["OPENAI_API_KEY"]
    src = (SRC / f"chr_minto_{name}.png").read_bytes()
    b = uuid.uuid4().hex
    def part(k, v): return f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    body = b"".join(part(k, v) for k, v in [("model", MODEL), ("prompt", PROMPT), ("size", "1024x1536"),
        ("background", "transparent"), ("quality", "high"), ("output_format", "png")])
    body += f'--{b}\r\nContent-Disposition: form-data; name="image[]"; filename="ref.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + src + f"\r\n--{b}--\r\n".encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, headers={
        "Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={b}"})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=600))
    except urllib.error.HTTPError as e:
        return name, "ERR " + e.read().decode()[:400]
    out = OUT / f"chr_minto_{name}_{tag}.png"
    out.write_bytes(base64.b64decode(r["data"][0]["b64_json"]))
    return name, str(out.name)
if __name__ == "__main__":
    tag = sys.argv[1]; names = sys.argv[2:]
    with cf.ThreadPoolExecutor(5) as ex:
        for n, res in ex.map(lambda n: run(n, tag), names): print(n, res, flush=True)
    (Path(__file__).parent / f"prompt.txt").write_text(f"model: {MODEL}\nendpoint: /v1/images/edits (reference = current sprite)\nsize: 1024x1536, background transparent, quality high\n\n{PROMPT}\n")
