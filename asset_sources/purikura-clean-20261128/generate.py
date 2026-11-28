"""プリクラの写真（remake/img/cgs/cg_purikura_*.webp・640×1080 の2コマ）から、落書きだけを消した版を作る（OpenAI 画像API・images/edits）。

2026-11-28 オーナー「プリクラのリメイクであげはにお絵描き任せたりオートもできるけど、自分でスマホのキーボードで文字入れたり好きにやれるようにもしたい」
→ 確認の答え「落書き無しの写真を作り直す（まず数枚で試す）」「2回目以降の撮影だけ」（要望台帳 VPO22）。
「あげはにおまかせ」は今の絵（あげはの落書き入り）のまま、「自分でらくがき」はここで作る落書き無しの写真の上に描く。

入力の写真（640×1080）を左右に 40px ずつ広げた 720×1080（2:3）にして渡し、1024×1536 で受け取って、元の幅の所を切り出して 640×1080 に戻す。
キーはコードに書かない。環境変数 OPENAI_API_KEY があれば付ける（クラウド環境ではプロキシが付ける）。

使い方:
  python3 generate.py gen <id> [タグ]     → work/<id>-<タグ>.png（id は cg_purikura_ を除いた名前。例: ageha_gyarupi）
  python3 generate.py adopt <id> <タグ>   → originals/<id>.webp（原画）と remake/img/cgs/purikura-clean/cg_purikura_<id>.webp（ゲーム用 640×1080）
  python3 generate.py list                → 対象の写真の一覧
"""
import base64, io, json, os, sys, time, urllib.error, urllib.request, uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2.6-sunburst")
WORK = Path(os.environ.get("PURIKURA_WORK", HERE / "work"))
CG = ROOT / "remake/img/cgs"
GAME_OUT = CG / "purikura-clean"
PAD = 40  # 左右に足す幅（640 → 720 で 2:3）

PROMPT = (
    "This is a Japanese purikura (photo-booth sticker) strip from a visual-novel game: two stacked photo panels of the same people, "
    "decorated afterwards with hand-drawn doodles. Make the SAME strip WITHOUT any of the decorations that were added on top of the photos, "
    "so the player can decorate it again by themselves.\n"
    "REMOVE completely: every handwritten word or letter (Japanese or English, any color), every outline-lettered caption, every doodled heart, "
    "star, sparkle, crown, kiss mark, speech mark, emphasis line, sweat drop, arrow, underline and squiggle, every sticker or stamp drawn over "
    "the photo (gummy bears, bear faces, leopard hearts, camera icons, ribbons, flowers, glitter blobs), and every glitter dot or sparkle "
    "floating over the photos.\n"
    "KEEP exactly as it is: the two photo panels and their positions, the people in them (faces, expressions, eyes, hair, hands and fingers, "
    "pose, clothing, the cap logo, and every accessory the people actually wear: hair clips including small bear-shaped hair clips, earrings, "
    "chokers, necklaces), the camera framing, the lighting and the colors, and the printed frame of the strip around and between the panels "
    "(its pattern and colors at the top and bottom and the thin divider). Where a doodle covered the background, continue that panel's own "
    "photo-booth backdrop behind the people in its SAME base color as in the input (pink stays pink, sky blue stays sky blue, lavender stays "
    "lavender), as a soft plain gradient without pattern or sparkles. Where a doodle covered a person, restore the person naturally in the same "
    "style. Do not add anything new: no text, no logos, no new decorations, no new people.\n"
    "The image is padded with a plain band on the left and right; keep those bands plain and do not draw into them.\n"
    "STYLE: the same Japanese 2D visual-novel game art as the input: clean dark outlines, flat colors with soft cel shadows. Not a photo."
)

# 対象（core/purikura-data.js の PURIKURA_PHOTOS と同じ名前。cg_purikura_ を除く）
def targets():
    return sorted(p.stem.removeprefix("cg_purikura_") for p in CG.glob("cg_purikura_*.webp"))


def padded_png(src):
    from PIL import Image
    im = Image.open(src).convert("RGB")
    w, h = im.size
    out = Image.new("RGB", (w + PAD * 2, h), (246, 200, 222))
    out.paste(im, (PAD, 0))
    buf = io.BytesIO()
    out.save(buf, "PNG")
    return buf.getvalue()


def multipart(fields, files):
    b = uuid.uuid4().hex
    out = bytearray()
    for k, v in fields.items():
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    for name, data in files:
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"image[]\"; filename=\"{name}\"\r\nContent-Type: image/png\r\n\r\n".encode()
        out += data + b"\r\n"
    out += f"--{b}--\r\n".encode()
    return bytes(out), f"multipart/form-data; boundary={b}"


def gen(pid, tag="01"):
    src = CG / f"cg_purikura_{pid}.webp"
    if not src.exists() or src.stat().st_size < 1000:
        raise SystemExit(f"{src} が無い（Git LFS の実体を取ってから）")
    WORK.mkdir(parents=True, exist_ok=True)
    stem = WORK / f"{pid}-{tag}"
    stem.with_suffix(".prompt.txt").write_text(PROMPT + "\n", encoding="utf-8")
    body, ctype = multipart({"model": MODEL, "prompt": PROMPT, "size": "1024x1536", "quality": "high", "n": "1"}, [(f"{pid}.png", padded_png(src))])
    for attempt in range(3):
        req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, method="POST")
        req.add_header("Content-Type", ctype)
        if os.environ.get("OPENAI_API_KEY"):
            req.add_header("Authorization", f"Bearer {os.environ['OPENAI_API_KEY']}")
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                res = json.loads(r.read())
            break
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:400]
            print(f"{pid}-{tag}: HTTP {e.code} {msg}", file=sys.stderr)
            if e.code < 500 and e.code != 429:
                raise SystemExit(1)
            time.sleep(20 * (attempt + 1))
    else:
        raise SystemExit(f"{pid}-{tag}: 3回失敗")
    stem.with_suffix(".png").write_bytes(base64.b64decode(res["data"][0]["b64_json"]))
    print(stem.with_suffix(".png"), MODEL)


def crop_back(png):
    """1024×1536 の生成から、足した帯を除いた元の幅の所を切り出して 640×1080 に戻す"""
    from PIL import Image
    im = Image.open(png).convert("RGB")
    W, H = im.size
    left = round(W * PAD / (640 + PAD * 2))
    return im.crop((left, 0, W - left, H)).resize((640, 1080), Image.LANCZOS)


def adopt(pid, tag):
    src = WORK / f"{pid}-{tag}.png"
    im = crop_back(src)
    (HERE / "originals").mkdir(exist_ok=True)
    GAME_OUT.mkdir(parents=True, exist_ok=True)
    from PIL import Image
    Image.open(src).convert("RGB").save(HERE / "originals" / f"{pid}.webp", "WEBP", quality=95, method=6)
    im.save(GAME_OUT / f"cg_purikura_{pid}.webp", "WEBP", quality=86, method=6)
    print("adopted", pid, tag, im.size)


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    cmd = sys.argv[1]
    if cmd == "list":
        print("\n".join(targets()))
    elif cmd == "gen":
        gen(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "01")
    elif cmd == "adopt":
        adopt(sys.argv[2], sys.argv[3])
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
