#!/usr/bin/env python3
"""写真枠のあげはを、元ネタと同じ「両手で口元を覆う」ポーズに描き直す（OpenAI 画像API・images/edits）。

参照画像: photo.png（既存の驚き顔の立ち絵を店内背景に重ねたもの）と、本人確認用の通常立ち絵。
キーはコードに書かない。環境変数 OPENAI_API_KEY があれば付ける（クラウド環境ではプロキシが付ける）。

使い方: python3 generate_pose.py [出力名の連番]   → pose-candidates/pose-NN.png
"""
import base64, json, os, sys, urllib.request, uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2.6-sunburst")
REFS = [HERE / "photo.png", ROOT / "assets/sprites/characters/ageha/chr_ageha_normal.png"]
PROMPT = """Edit the first image. Keep exactly the same character, art style, lighting, blurred pink cafe background and head-and-shoulders framing.
Character (must stay identical, the second image is her approved reference): Ageha, a cheerful 22-year-old Japanese gyaru woman with a bright youthful face, amber eyes, soft cheeks, small nose, short gentle chin, long wavy honey-blonde twin ponytails with a pink bear hair clip and a cream bear hair clip, small gold hoop earrings, black choker, gold heart necklace, leopard-print bomber jacket over a pink crop top with a small heart. Fine painterly anime game illustration.
Change only the pose and expression: she is shocked and embarrassed, covering her mouth and nose with both hands. Both palms face her own face, so the viewer sees the backs of her hands and her fingernails; fingers point straight up, the two hands side by side and slightly overlapping in front of her mouth, wrists and jacket cuffs visible at the bottom. Eyes wide open looking at the viewer, eyebrows raised and worried, light blush, a tiny sweat drop. Like a woman who just realized "oh no... is it too weak?".
No text, no logos, no watermark, no shisha or hookah equipment, no smoke, no extra people, no extra fingers."""


def multipart(fields, files):
    b = uuid.uuid4().hex
    out = bytearray()
    for k, v in fields.items():
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    for f in files:
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"image[]\"; filename=\"{f.name}\"\r\nContent-Type: image/png\r\n\r\n".encode()
        out += f.read_bytes() + b"\r\n"
    out += f"--{b}--\r\n".encode()
    return bytes(out), f"multipart/form-data; boundary={b}"


def main():
    n = sys.argv[1] if len(sys.argv) > 1 else "01"
    body, ctype = multipart({"model": MODEL, "prompt": PROMPT, "size": "1024x1024", "quality": "medium", "n": "1"}, REFS)
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, method="POST")
    req.add_header("Content-Type", ctype)
    if os.environ.get("OPENAI_API_KEY"):
        req.add_header("Authorization", f"Bearer {os.environ['OPENAI_API_KEY']}")
    with urllib.request.urlopen(req, timeout=600) as r:
        res = json.loads(r.read())
    dest = HERE / "pose-candidates" / f"pose-{n}.png"
    dest.parent.mkdir(exist_ok=True)
    dest.write_bytes(base64.b64decode(res["data"][0]["b64_json"]))
    print(dest, MODEL)


if __name__ == "__main__":
    main()
