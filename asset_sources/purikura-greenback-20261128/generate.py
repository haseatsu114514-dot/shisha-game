"""プリクラの写真（remake/img/cgs/cg_purikura_*.webp・640×1080 の2コマ）から、落書きを消してコマの背景をグリーンバックにした版を作り、
緑を透明に抜いてゲームに入れる（OpenAI 画像API・images/edits）。

2026-11-28 オーナー「自分でスマホのキーボードで文字入れたり好きにやれるようにもしたい」（要望台帳 VPO22）、
続けて「らくがきの時点で立ち絵ではなく文字が入ってない版のそのプリにする／文字消すというよりは再生成してもいいけど／
あと背景選んだりプリクラらしさも入れたい」（VPO24〜）。
本物のプリ機と同じく、人物の後ろをグリーンバックにして抜き、背景はゲームの中で選ぶ（js/core/purikura-doodle.js の DOODLE_BGS）。
コマの外の枠（上下の柄の帯・コマの間の線）はそのまま残す。「あげはにおまかせ」は今の絵（落書き入り）のまま。

入力の写真（640×1080）を左右に 40px ずつ広げた 720×1080（2:3）にして渡し、1024×1536 で受け取って、元の幅の所を切り出して 640×1080 に戻す。
キーはコードに書かない。環境変数 OPENAI_API_KEY があれば付ける（クラウド環境ではプロキシが付ける）。

使い方:
  python3 generate.py gen <id> [タグ]       → work/<id>-<タグ>.png（id は cg_purikura_ を除いた名前。例: ageha_gyarupi）
  python3 generate.py adopt <id> <タグ>     → originals/<id>.webp（原画）、remake/img/cgs/purikura-key/cg_purikura_<id>.webp（緑を抜いた 640×1080）、
                                              コマの位置を remake/js/core/purikura-key-data.js へ
  python3 generate.py strip [タグ]          → 初プリの半分こシール（cg_ch2_ageha_purikura_strip）の文字なし版（背景はそのまま）を work/strip-<タグ>.png
  python3 generate.py adopt-strip <タグ>    → remake/img/cgs/purikura-clean/cg_ch2_ageha_purikura_strip.webp（演出の落書きの場面で写す）
  python3 generate.py list                  → 対象の写真と、取り込み済みか
  python3 generate.py panels                → 取り込み済みの絵からコマの位置を測り直して purikura-key-data.js を書き直す
"""
import base64, io, json, os, sys, time, urllib.error, urllib.request, uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2.6-sunburst")
WORK = Path(os.environ.get("PURIKURA_WORK", HERE / "work"))
CG = ROOT / "remake/img/cgs"
KEY_OUT = CG / "purikura-key"
CLEAN_OUT = CG / "purikura-clean"
PANELS_JS = ROOT / "remake/js/core/purikura-key-data.js"
STRIP = "cg_ch2_ageha_purikura_strip"
PAD = 40  # 左右に足す幅（640 → 720 で 2:3）

STYLE = "STYLE: the same Japanese 2D visual-novel game art as the input: clean dark outlines, flat colors with soft cel shadows. Not a photo."
REMOVE = (
    "It was decorated afterwards with hand-drawn doodles. First REMOVE completely every decoration drawn over the photos: every handwritten word "
    "or letter (Japanese or English, any color), every outline-lettered caption, every doodled heart, star, sparkle, crown, kiss mark, speech "
    "mark, emphasis line, sweat drop, arrow, underline and squiggle, every sticker or stamp (gummy bears, bear faces, leopard hearts, camera "
    "icons, ribbons, flowers, glitter blobs) and every glitter dot floating over the photos. Where a doodle covered a person, restore the person "
    "naturally in the same style.\n"
)
KEEP = (
    "KEEP exactly as they are: the people (faces, expressions, eyes, hair, hands and fingers, pose, clothing, the cap logo, and every accessory "
    "they actually wear: hair clips including small bear-shaped clips, earrings, chokers, necklaces), their positions and size, the camera "
    "framing, the panel positions, and the printed frame of the strip around and between the panels (the patterned bands at the top and bottom "
    "and the thin divider). Do not add anything new: no text, no logos, no decorations, no new people.\n"
)
# 落書きを消して、コマの中の背景だけをグリーンバックに（人物に緑の服・髪がある時は KEY_BLUE の写真で青に）
PROMPT_KEY = (
    "This is a Japanese purikura (photo-booth sticker) strip from a visual-novel game: two stacked photo panels of the same people inside a "
    "printed frame. " + REMOVE +
    "Then make it a photo-booth {screen} SCREEN shot: replace ONLY the photo backdrop behind the people inside BOTH photo panels with a "
    "perfectly flat, uniform chroma-key {screen_lower} (pure {hex}). No gradient, no shading, no texture, no shadow on the {screen_lower}, no "
    "glow, no sparkles. The {screen_lower} fills every backdrop pixel inside the panels right up to the panel edges and right up to the "
    "people's outlines, including the small gaps between hair strands, between arms and body and between fingers.\n" + KEEP +
    "The people keep their own colors and clean dark outlines: no {screen_lower} tint, no {screen_lower} reflections, no {screen_lower} rim "
    "light on them.\nThe image is padded with a plain band on the left and right; keep those bands plain.\n" + STYLE
)
# 初プリの半分こシール（演出の落書きの場面で写す）: 落書きだけ消して、背景はそのまま
PROMPT_CLEAN = (
    "This is a Japanese purikura (photo-booth sticker) strip from a visual-novel game: two stacked photo panels of the same people. " + REMOVE +
    KEEP + "Where a doodle covered the background, continue that panel's own photo-booth backdrop behind the people in its SAME base color as "
    "in the input, as a soft plain gradient without pattern or sparkles.\n"
    "The image is padded with a plain band on the left and right; keep those bands plain and do not draw into them.\n" + STYLE
)
KEY_BLUE = set()  # 人物の服・髪に緑がある写真（青で抜く）。生成して緑が人物にかかったら足す
SCREENS = {"green": ("GREEN", "green", "#00FF00"), "blue": ("BLUE", "blue", "#0000FF")}


def targets():
    return sorted(p.stem.removeprefix("cg_purikura_") for p in CG.glob("cg_purikura_*.webp"))


def screen_of(pid):
    return "blue" if pid in KEY_BLUE else "green"


def padded_png(src):
    from PIL import Image
    im = Image.open(src).convert("RGB")
    if im.size != (640, 1080):
        raise SystemExit(f"{src} は 640×1080 ではない（{im.size}）")
    out = Image.new("RGB", (640 + PAD * 2, 1080), (246, 200, 222))
    out.paste(im, (PAD, 0))
    buf = io.BytesIO()
    out.save(buf, "PNG")
    return buf.getvalue()


def call(png, prompt, out):
    b = uuid.uuid4().hex
    body = bytearray()
    for k, v in {"model": MODEL, "prompt": prompt, "size": "1024x1536", "quality": "high", "n": "1"}.items():
        body += f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    body += f"--{b}\r\nContent-Disposition: form-data; name=\"image[]\"; filename=\"in.png\"\r\nContent-Type: image/png\r\n\r\n".encode()
    body += png + b"\r\n" + f"--{b}--\r\n".encode()
    for attempt in range(3):
        req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=bytes(body), method="POST")
        req.add_header("Content-Type", f"multipart/form-data; boundary={b}")
        if os.environ.get("OPENAI_API_KEY"):
            req.add_header("Authorization", f"Bearer {os.environ['OPENAI_API_KEY']}")
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                res = json.loads(r.read())
            break
        except urllib.error.HTTPError as e:
            print(f"{out.name}: HTTP {e.code} {e.read().decode(errors='replace')[:400]}", file=sys.stderr)
            if e.code < 500 and e.code != 429:
                raise SystemExit(1)
            time.sleep(20 * (attempt + 1))
    else:
        raise SystemExit(f"{out.name}: 3回失敗")
    out.write_bytes(base64.b64decode(res["data"][0]["b64_json"]))
    print(out, MODEL)


def gen(pid, tag="01"):
    src = CG / f"cg_purikura_{pid}.webp"
    if not src.exists() or src.stat().st_size < 1000:
        raise SystemExit(f"{src} が無い（Git LFS の実体を取ってから）")
    WORK.mkdir(parents=True, exist_ok=True)
    screen, lower, hexv = SCREENS[screen_of(pid)]
    prompt = PROMPT_KEY.format(screen=screen, screen_lower=lower, hex=hexv)
    (WORK / f"{pid}-{tag}.prompt.txt").write_text(prompt + "\n", encoding="utf-8")
    call(padded_png(src), prompt, WORK / f"{pid}-{tag}.png")


def crop_back(png):
    """1024×1536 の生成から、足した帯を除いた元の幅の所を切り出して 640×1080 に戻す"""
    from PIL import Image
    im = Image.open(png).convert("RGB")
    W, H = im.size
    left = round(W * PAD / (640 + PAD * 2))
    return im.crop((left, 0, W - left, H)).resize((640, 1080), Image.LANCZOS)


def key_out(im, screen="green"):
    """グリーン（ブルー）バックを透明に。縁は少し透かし、縁の数画素だけ色かぶりを抜く（人物の中の緑・青には触れない）"""
    import numpy as np
    from PIL import Image, ImageFilter
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    c, o1, o2 = (g, r, b) if screen == "green" else (b, r, g)
    spill = c - np.maximum(o1, o2)  # 抜く色の強さ（純粋な緑・青は 200 以上）
    alpha = np.clip(1 - (spill - 40) / 70, 0, 1)
    # 透明になった所から 3 画素以内だけ、抜く色を他の2色の大きい方までに抑える
    hole = Image.fromarray(((alpha < 0.5) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))
    near = np.asarray(hole) > 0
    fixed = np.where(near & (spill > 0), np.maximum(o1, o2), c)
    if screen == "green":
        g = fixed
    else:
        b = fixed
    return Image.fromarray(np.dstack([r, g, b, alpha * 255]).astype(np.uint8), "RGBA")


def panel_rects(rgba):
    """透明な所（コマの背景）の、上のコマ・下のコマの外接矩形 [x, y, w, h]。
    写真の真ん中あたり（y 300〜780）で透明が一番少ない行（コマの間の線）で上下に分ける。外接矩形が枠にはみ出しても、枠の絵が隠す"""
    import numpy as np
    alpha = np.asarray(rgba)[..., 3]
    clear = alpha < 128
    count = clear.sum(axis=1).astype(float)
    smooth = np.convolve(count, np.ones(9) / 9, mode="same")
    lo, hi = 300, 780
    band = smooth[lo:hi]
    low = np.where(band <= band.min() + 1)[0]
    split = lo + int(low[np.argmin(np.abs(low + lo - 540))])  # 一番少ない行のうち、真ん中に近いもの
    out = []
    for y0, y1 in ((0, split), (split, clear.shape[0])):
        part = clear[y0:y1]
        rows = np.where(part.sum(axis=1) >= 3)[0]
        if not len(rows):
            continue
        cols = np.where(part[rows[0] : rows[-1] + 1].sum(axis=0) >= 3)[0]
        out.append([int(cols[0]), int(y0 + rows[0]), int(cols[-1] - cols[0] + 1), int(rows[-1] - rows[0] + 1)])
    return out


def write_panels():
    from PIL import Image
    data = {}
    for p in sorted(KEY_OUT.glob("cg_purikura_*.webp")):
        data[p.stem] = panel_rects(Image.open(p).convert("RGBA"))
    lines = ",\n".join(f'  {k}: {json.dumps(v)}' for k, v in data.items())
    PANELS_JS.write_text(
        "// プリクラの写真のグリーンバック版（img/cgs/purikura-key/）の、背景を抜いたコマの位置 [x, y, 幅, 高さ]（写真の画素 640×1080）。\n"
        "// 生成: asset_sources/purikura-greenback-20261128/generate.py（adopt・panels）。手で書き換えない。\n"
        f"export const PURIKURA_KEY_PANELS = Object.freeze({{\n{lines},\n}});\n", encoding="utf-8")
    print(PANELS_JS, len(data))


def adopt(pid, tag):
    from PIL import Image
    src = WORK / f"{pid}-{tag}.png"
    keyed = key_out(crop_back(src), screen_of(pid))
    (HERE / "originals").mkdir(exist_ok=True)
    KEY_OUT.mkdir(parents=True, exist_ok=True)
    Image.open(src).convert("RGB").save(HERE / "originals" / f"{pid}.webp", "WEBP", quality=95, method=6)
    keyed.save(KEY_OUT / f"cg_purikura_{pid}.webp", "WEBP", quality=88, alpha_quality=100, method=6)
    rects = panel_rects(keyed)
    print("adopted", pid, tag, keyed.size, rects)
    if len(rects) != 2:
        print(f"!! {pid}: コマが2つに分かれない（{rects}）。絵を見て確かめる", file=sys.stderr)
    write_panels()


def strip(tag="01"):
    src = CG / f"{STRIP}.webp"
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / f"strip-{tag}.prompt.txt").write_text(PROMPT_CLEAN + "\n", encoding="utf-8")
    call(padded_png(src), PROMPT_CLEAN, WORK / f"strip-{tag}.png")


def adopt_strip(tag):
    from PIL import Image
    src = WORK / f"strip-{tag}.png"
    (HERE / "originals").mkdir(exist_ok=True)
    CLEAN_OUT.mkdir(parents=True, exist_ok=True)
    Image.open(src).convert("RGB").save(HERE / "originals" / "strip.webp", "WEBP", quality=95, method=6)
    crop_back(src).save(CLEAN_OUT / f"{STRIP}.webp", "WEBP", quality=86, method=6)
    print("adopted strip", tag)


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == "list":
        for pid in targets():
            print(pid, "済" if (KEY_OUT / f"cg_purikura_{pid}.webp").exists() else "")
    elif cmd == "gen":
        gen(args[0], args[1] if len(args) > 1 else "01")
    elif cmd == "adopt":
        adopt(args[0], args[1])
    elif cmd == "strip":
        strip(args[0] if args else "01")
    elif cmd == "adopt-strip":
        adopt_strip(args[0])
    elif cmd == "panels":
        write_panels()
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
