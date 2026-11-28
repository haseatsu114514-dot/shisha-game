#!/usr/bin/env python3
"""縦画面のタイトルコール用の、文字なし・正方形の章タイトルの絵を作る（VPN28）。
オーナー「今の横長画像をベースに縦画面用のを再生成してみて　タイトルや章情報は上下でやるから画像メインのに」。
元の絵は各章の横長の章タイトル（remake/img/ui/chapters/chN-title.webp・1280×720）。OpenAI images edit, model gpt-image-2.6-sunburst, 1024x1024, quality high。
使い方: python3 gen.py ch2:a ch2:b ch3:a ... → raw/chN_<tag>.png（prompts.json に追記）"""
import base64, io, json, os, sys, uuid, urllib.request, urllib.error, concurrent.futures as cf
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
MODEL = "gpt-image-2.6-sunburst"
SRC = lambda n: ROOT / f"remake/img/ui/chapters/ch{n}-title.webp"

COMMON = (
    "Recreate the attached chapter title illustration as a new SQUARE (1:1) illustration for a vertical smartphone screen. "
    "It will be shown on its own between a game logo above and the chapter name below, so it must be a pure picture: "
    "remove ALL text, titles, letters, numbers, logos, captions and lettering from the image — no writing of any kind anywhere. "
    "Keep the same characters (same faces, hairstyles, eye colors, outfits and accessories), the same art style and rendering, "
    "the same color palette, lighting, mood and setting as the attached image. Do not add any new people. "
    "Recompose for the square frame so the subject fills it: faces fully visible and not cut by the edges, nothing important touching the borders. "
    "The young man in the black cap and black hoodie wears NO necklace and NO pendant. "
    "No hookah, no shisha pipes or water pipes, no smoking equipment anywhere (soft drifting smoke in the air is fine). "
)
CHAPTERS = {
    1: {
        "a": "Keep the clean white background and the exact same crisp pixel-art style. Show the same six pixel-art characters in the same order, "
             "walking together to the right as a group in two staggered rows (three slightly behind, three in front), larger than in the original so they fill the square. "
             "Add only a few faint grey wisps of smoke drifting behind them.",
        "b": "Keep the clean white background and the exact same crisp pixel-art style. Show the same six pixel-art characters in the same order, "
             "walking to the right in one line that recedes diagonally from the front-right to the back-left, the nearest one largest, so the line fills the square. "
             "Add only a few faint grey wisps of smoke drifting along the line.",
    },
    2: {
        "a": "Center the orange-haired girl (twin tails, small bear hair clip, leopard-print jacket, red top, choker) as the main subject from the chest up, slightly smiling, "
             "with the young man in the black cap seen from behind in the lower left foreground. Keep the dark crimson and magenta glowing background.",
        "b": "A slightly closer framing: the orange-haired girl (twin tails, small bear hair clip, leopard-print jacket, red top, choker) fills most of the square, "
             "her face in the upper middle, the young man in the black cap small in silhouette at the bottom. Keep the dark crimson and magenta glowing background.",
    },
    3: {
        "a": "Keep the three of them side by side at night by the rainy glass windows: the young man in the black cap on the left, "
             "the girl with long pale-blonde braids in the center as the focus, the boy with curly reddish-brown hair and a hoodie on the right. "
             "Show all three from the chest up with every face fully visible.",
        "b": "The girl with long pale-blonde braids in the center, a little in front and largest; the young man in the black cap on the left and the curly reddish-brown haired boy "
             "on the right slightly behind her, all three faces fully visible. Night, rainy glass windows and city lights behind them.",
    },
    4: {
        "a": "Keep the young man in the black cap and black hoodie in front (upper body, looking into the distance) and the bearded man with glasses and a flat cap behind him on the right, "
             "with the golden sunset sky and the Dubai skyline behind them. Both faces fully visible.",
        "b": "Frame the young man in the black cap and black hoodie and the bearded man with glasses and a flat cap side by side from the chest up, the young man slightly in front, "
             "with the sunset Dubai skyline and palm trees by the water behind them. Both faces fully visible.",
    },
    5: {
        "a": "Center the enormous mechanical metal head with the glowing blue and purple eyes, facing the viewer, filling the square, "
             "surrounded by purple gears and machinery and glowing purple smoke.",
        "b": "The enormous mechanical metal head with glowing blue and purple eyes seen slightly from below, looming and filling the square, "
             "with purple gears, cables and sparks around it and glowing purple smoke.",
    },
}

def png_bytes(path, max_side=1536):
    im = Image.open(path).convert("RGBA"); im.thumbnail((max_side, max_side))
    buf = io.BytesIO(); im.save(buf, "PNG"); return buf.getvalue()

def run(job):
    n, tag = job
    key = os.environ["OPENAI_API_KEY"]
    prompt = COMMON + CHAPTERS[n][tag]
    b = uuid.uuid4().hex
    def part(k, v): return f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    body = b"".join(part(k, v) for k, v in [("model", MODEL), ("prompt", prompt), ("size", "1024x1024"), ("quality", "high"), ("output_format", "png")])
    body += f'--{b}\r\nContent-Disposition: form-data; name="image[]"; filename="ch{n}-title.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + png_bytes(SRC(n)) + b"\r\n"
    body += f"--{b}--\r\n".encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, headers={"Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={b}"})
    try: r = json.load(urllib.request.urlopen(req, timeout=900))
    except urllib.error.HTTPError as e: return job, prompt, "ERR " + e.read().decode()[:400]
    except Exception as e: return job, prompt, f"ERR {e}"
    out = HERE / "raw" / f"ch{n}_{tag}.png"; out.write_bytes(base64.b64decode(r["data"][0]["b64_json"]))
    return job, prompt, out.name

if __name__ == "__main__":
    jobs = [(int(a.split(":")[0][2:]), a.split(":")[1]) for a in sys.argv[1:]] or [(n, t) for n in CHAPTERS for t in CHAPTERS[n]]
    log_path = HERE / "prompts.json"; log = json.loads(log_path.read_text()) if log_path.exists() else []
    with cf.ThreadPoolExecutor(len(jobs)) as ex:
        for (n, tag), prompt, res in ex.map(run, jobs):
            print(f"ch{n}:{tag}", res, flush=True)
            log.append({"chapter": n, "tag": tag, "model": MODEL, "endpoint": "/v1/images/edits", "size": "1024x1024", "quality": "high",
                        "references": [f"remake/img/ui/chapters/ch{n}-title.webp"], "result": res, "prompt": prompt})
    log_path.write_text(json.dumps(log, ensure_ascii=False, indent=1) + "\n")
