#!/usr/bin/env python3
"""第1章のタイトルコール（縦画面・案A）の絵の候補（VPN21）。OpenAI images edit, model gpt-image-2.6-sunburst。
人物の顔・服は正規の立ち絵、画風は採用済みの第3・4章の章タイトルの絵を参照に渡す。シーシャの機材は描かない（煙だけで「煙がつなぐ街」を表す）。
使い方: python3 gen.py <tag> [c1 c2 ...]  → raw/<id>_<tag>.png と prompts.json
"""
import base64, io, json, os, sys, uuid, urllib.request, urllib.error, concurrent.futures as cf
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
MODEL = "gpt-image-2.6-sunburst"
SPRITE = lambda cid: ROOT / f"assets/sprites/characters/{cid}/chr_{cid}_normal.png"
STYLE = [ROOT / "remake/img/ui/chapters/ch3-title.webp", ROOT / "remake/img/ui/chapters/ch4-title.webp"]
# 2回目（d1〜d5）は、人物に大きく寄った第2章の絵も画風の参照に足す（オーナー「いまなんか画像が微妙で」）
STYLE_V2 = [ROOT / "remake/img/ui/chapters/ch2-title.webp"] + STYLE
CLOSE = ("Frame the characters LARGE and close like the attached chapter title illustrations (waist-up or chest-up, faces big and expressive, "
         "strong cinematic key light and rich color), not small figures in a wide scene. ")

COMMON = (
    "Vertical 2:3 chapter title key visual for a Japanese visual-novel game about shisha (hookah) lounges, chapter 1 \"A Town Tied by Smoke\". "
    "Match the painting style, line quality, color richness and cinematic lighting of the attached chapter title illustrations (modern anime key visual, "
    "clean cel shading with 2-3 shadow steps, no airbrushed shine, NOT a 1990s OVA/cel style). "
    "Characters must be the SAME people as the attached standing sprites: identical faces, eye colors, hairstyles, outfits and colors. "
    "Hajime (the young man in a black cap, black hoodie and black pants) wears NO necklace. "
    "Composition: keep all characters and the main motif inside the upper 60% of the frame; the lower 35% must be a calm, darker, low-detail area "
    "(soft haze or shadow) because the chapter title text will be overlaid there later. "
    "Absolutely no text, letters, numbers, logos or readable signage anywhere (shop signs are glowing blank shapes or light only). "
    "Do not draw any hookah, shisha pipe, hose, charcoal, foil, cigarettes or vapes; smoke appears only as soft drifting wisps and ribbons."
)
CONCEPTS = {
    "c1": {
        "title": "煙の糸の交差点",
        "refs": ["hajime"],
        "prompt": "Night, high-angle view down onto a warm orange-lit Japanese downtown crossroads lined with small shops. Hajime stands small in the middle "
                  "of the crossing, looking up. From four different shop doorways, thin pale ribbons of smoke rise and braid together into one softly glowing "
                  "ribbon that curls above him — the smoke visibly ties the shops of the town together.",
    },
    "c2": {
        "title": "tonari の灯",
        "refs": ["hajime", "sumi"],
        "prompt": "Dusk. Hajime, seen from behind at three-quarter view, pushes open the wooden door of a small cozy shisha lounge. Warm light from Turkish mosaic "
                  "lamps of different shapes, colors and hanging lengths spills out over him. Inside, Sumi (flat cap, glasses, short beard, black shirt, brown apron) "
                  "looks up from behind the counter with a small knowing smile. Soft smoke curls out of the doorway into the blue evening street.",
    },
    "c3": {
        "title": "仲間とライバル",
        "refs": ["hajime", "sumi", "tsumugi", "minto", "naru", "adam"],
        "prompt": "Movie-poster composition. Hajime stands in the front center, determined, looking slightly off-camera. Behind him, layered in rising smoke and "
                  "fading toward the top: Sumi and Tsumugi close behind with warm light (allies), and further back Minto, Naru and Adam as rivals, partly "
                  "dissolving into the smoke like a memory. Night city lights glow faintly in the background.",
    },
    "c4": {
        "title": "煙の王冠",
        "refs": ["hajime"],
        "prompt": "Night rooftop above a small Japanese city. Hajime, seen from behind and slightly from the side, stands at the railing looking up. Above the town, "
                  "the smoke drifting up from many lit shop windows gathers in the sky into the faint, beautiful shape of a crown made of smoke, lit warmly from below "
                  "by the city lights — the cup he wants to win.",
    },
    # 2回目: 人物に寄った迫力のある構図
    "d1": {
        "title": "好敵手",
        "refs": ["hajime", "naru"], "style": "v2",
        "prompt": CLOSE + "Rival poster. Hajime in the front left, waist-up, determined eyes looking ahead past the viewer. Behind him on the right, Naru "
                  "(silver hair, white-and-black jacket) stands taller with arms crossed and a confident half smile. Split lighting: warm orange glow of a night "
                  "shopping street on Hajime, cool blue on Naru, a ribbon of pale smoke curling between them.",
    },
    "d2": {
        "title": "tonari のはじめくん",
        "refs": ["hajime", "sumi"], "style": "v2",
        "prompt": CLOSE + "Chest-up close portrait of Hajime inside a small cozy shisha lounge at night, a soft friendly smile toward the viewer. Behind him, "
                  "warm bokeh of Turkish mosaic lamps of varied shapes and colors; Sumi stands far behind out of focus. A single soft ribbon of smoke curls past "
                  "Hajime's face, catching the lamp light.",
    },
    "d3": {
        "title": "ライバルたち",
        "refs": ["hajime", "naru", "minto", "adam"], "style": "v2",
        "prompt": CLOSE + "Group poster of four, waist-up, overlapping like the attached three-person chapter title illustration: Hajime in the center front, "
                  "Naru to his right, Minto to his left with a playful smile, Adam (red-and-green hair) behind them looking proud. Each is lit by a different "
                  "colored glow from the night town; drifting smoke ties the four together.",
    },
    "d4": {
        "title": "夜明けの街",
        "refs": ["hajime"], "style": "v2",
        "prompt": CLOSE + "Waist-up shot of Hajime at dawn on a pedestrian bridge above a small Japanese town, wind in his hoodie, looking toward the sunrise with "
                  "quiet resolve. Morning mist and thin smoke rising from the streets below glow gold in the low sun; the sky shifts from deep blue to warm orange.",
    },
    "d5": {
        "title": "煙の糸",
        "refs": ["hajime", "sumi", "tsumugi", "minto", "naru", "adam"], "style": "v2",
        "prompt": CLOSE + "Symbolic poster: Hajime in the center, waist-up, holding out one open hand. Fine glowing threads of smoke run from his hand to the faint, "
                  "half-transparent figures of Sumi, Tsumugi, Minto, Naru and Adam arranged around and behind him in the dark, as if the smoke ties them all "
                  "together. Deep night blue with warm gold light on the threads.",
    },
}

def png_bytes(path, max_side=1536):
    im = Image.open(path).convert("RGBA")
    im.thumbnail((max_side, max_side))
    buf = io.BytesIO(); im.save(buf, "PNG"); return buf.getvalue()

def run(cid, tag):
    key = os.environ["OPENAI_API_KEY"]
    c = CONCEPTS[cid]
    prompt = COMMON + " Scene: " + c["prompt"]
    style = STYLE_V2 if c.get("style") == "v2" else STYLE
    images = [(f"{name}.png", png_bytes(SPRITE(name))) for name in c["refs"]] + [(p.stem + ".png", png_bytes(p)) for p in style]
    b = uuid.uuid4().hex
    def part(k, v): return f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    body = b"".join(part(k, v) for k, v in [("model", MODEL), ("prompt", prompt), ("size", "1024x1536"), ("quality", "high"), ("output_format", "png")])
    for fname, data in images:
        body += f'--{b}\r\nContent-Disposition: form-data; name="image[]"; filename="{fname}"\r\nContent-Type: image/png\r\n\r\n'.encode() + data + b"\r\n"
    body += f"--{b}--\r\n".encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, headers={
        "Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={b}"})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=900))
    except urllib.error.HTTPError as e:
        return cid, "ERR " + e.read().decode()[:400], prompt, [n for n, _ in images]
    out = HERE / "raw" / f"{cid}_{tag}.png"
    out.write_bytes(base64.b64decode(r["data"][0]["b64_json"]))
    return cid, out.name, prompt, [n for n, _ in images]

if __name__ == "__main__":
    tag = sys.argv[1]; ids = sys.argv[2:] or list(CONCEPTS)
    log_path = HERE / "prompts.json"
    log = json.loads(log_path.read_text()) if log_path.exists() else []
    with cf.ThreadPoolExecutor(5) as ex:
        for cid, res, prompt, refs in ex.map(lambda i: run(i, tag), ids):
            print(cid, res, flush=True)
            log.append({"id": cid, "title": CONCEPTS[cid]["title"], "tag": tag, "model": MODEL, "endpoint": "/v1/images/edits", "size": "1024x1536",
                        "quality": "high", "references": refs, "result": res, "prompt": prompt})
    log_path.write_text(json.dumps(log, ensure_ascii=False, indent=1) + "\n")
