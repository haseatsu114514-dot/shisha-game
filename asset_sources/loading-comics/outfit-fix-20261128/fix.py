"""ロード漫画のコマの、旧い設定のまま描かれた人物の服・小物だけを、新バージョンの立ち絵に合わせて直す（images/edits）。

2026-11-28 オーナー「このゲームのロード漫画で服の色とか古い設定の人いたら直して　ピアスやネックレスの皆無とか
修正したようなやつは跡が分かりやすかったら作り直し」（要望台帳 LDC46）。
入力: 今のコマ（remake/img/loading/<話>-<コマ>.webp）＋直す人物の新バージョンの立ち絵。台詞の吹き出し・文字・構図・ほかの人物はそのまま。
出力: 1536×1024 で生成し、work/ に置く。採用すると originals/ に原画、remake/img/loading/ に 1440×960 の WebP。
キーはコードに書かない。環境変数 OPENAI_API_KEY があれば付ける（クラウド環境ではプロキシが付ける）。

使い方: python3 fix.py gen <話>-<コマ> [タグ] / python3 fix.py adopt <話>-<コマ> <タグ> / python3 fix.py list
"""
import base64, json, os, sys, time, urllib.error, urllib.request, uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
LOADING = ROOT / "remake/img/loading"
NEW = ROOT / "remake/img/sprites/character_variants/new"
WORK = Path(os.environ.get("LDC_WORK", HERE / "work"))
MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2.6-sunburst")

NARU = ("Naru (the young man with short tousled silver-ash hair and amber eyes): change ONLY his clothes to his current official outfit "
        "shown in the reference sprite: a cropped zip jacket in dark chocolate brown and light beige blocks with a white stripe on each "
        "sleeve and a high stand collar, over a dark brown ribbed turtleneck sweater. Remove his old black-and-white track jacket, the black "
        "t-shirt, all silver chains and dog-tag necklaces, and any earring. Keep his face, hair, expression, pose and hands.")
ADAM = ("Adam (the young man whose short hair is red on the screen-left side and green on the screen-right side): change ONLY his clothes "
        "to his current official outfit shown in the reference sprite: a plain WHITE short-sleeved crew-neck t-shirt with a long BLACK waist "
        "apron tied at the waist. Remove the black henley shirt. Keep his face, hair, expression, pose and hands.")
SAKU = ("Ayatori (the young man with messy curly light-brown hair and amber eyes): change ONLY his clothes to his current official outfit "
        "shown in the reference sprite: a loose red-brown pullover hoodie with an ochre-yellow panel over one shoulder, a cream hood lining "
        "and a small zip at the neck, over a cream henley collar. Remove the old black jacket with red trim and its name badge. Keep his face, "
        "hair, expression, pose and hands.")
MUKAI = ("Mukai (the bearded cafe owner in a fedora): change him to his current official look shown in the reference sprite: a BROWN fedora "
         "with a black band, black hair with a grey streak at the temple, a trimmed short black beard, NO sunglasses (his eyes are visible "
         "under the brim, calm and half-lidded), a brown tailored suit jacket over a dark charcoal waistcoat and a white open-collar shirt "
         "with NO tie. Remove the black hat, black suit, black shirt, grey tie and dark glasses. Keep his pose, hands and expression.")
NO_TAG = ("Hajime (the young man in the black cap and black zip hoodie): remove the silver dog-tag necklace from his chest; under the open "
          "hoodie there is only his plain black t-shirt with a bare neckline, exactly like his official sprite. Do not change anything else about him.")

# (直す人の立ち絵, 指示)。立ち絵は remake/img/sprites/character_variants/new/<id>/chr_<id>_<表情>.webp
FIXES = {
    "sweet-unit-1": ([("naru", "normal")], [NARU]),
    "sweet-unit-2": ([("naru", "smile")], [NARU]),
    "cake-apology-1": ([("naru", "sad")], [NARU]),
    "cake-apology-2": ([("naru", "sad")], [NARU + " In this panel he is bowing his head deeply onto the table, so mostly his back, shoulders and sleeves show."]),
    "restored-39-1": ([("naru", "smile")], [NARU]),
    "restored-39-2": ([("naru", "smile")], [
        "Naru here wears a black graduation gown and mortarboard as a gag costume: keep that costume as it is.",
        "The top-left corner of the picture has a blurry, smeared patch over the university building and the pink cherry trees, left over "
        "from an old retouch. Repaint that corner cleanly so the building, windows and cherry blossoms continue naturally, in the same style "
        "as the rest of the picture."]),
    "adam-key-ring-1": ([("adam", "normal")], [ADAM]),
    "adam-key-ring-2": ([("adam", "surprise"), ("hajime", "normal")], [ADAM, NO_TAG]),
    "adam-photo-album-1": ([("adam", "normal")], [ADAM]),
    "adam-photo-album-2": ([("adam", "normal")], [ADAM]),
    "restored-26-1": ([("adam", "serious")], [ADAM]),
    "saku-every-order-1": ([("saku", "smile")], [SAKU]),
    "saku-every-order-2": ([("saku", "smile")], [SAKU]),
    "saku-photo-face-1": ([("saku", "smile")], [SAKU]),
    "saku-photo-face-2": ([("saku", "surprise")], [SAKU + " The photo on the phone screen also shows Ayatori: dress him in the same red-brown hoodie there too, keeping the purple lightning backdrop and his comic villain grin."]),
    "restored-15-1": ([("mukai_master", "normal")], [MUKAI]),
    "restored-15-2": ([("mukai_master", "normal")], [MUKAI]),
    "ageha-model-job-2": ([("hajime", "normal")], [NO_TAG]),
}

COMMON = (
    "Edit IMAGE 1, one panel of a two-panel gag comic shown on a game's loading screen. Change only what is listed below and keep everything "
    "else exactly the same: the composition and camera, every speech bubble with its exact Japanese text (same characters, same position, "
    "same font look), the background, the props, the lighting and colors, and every other person. Keep the same chibi comic style "
    "(2 to 3 heads tall, clean thick outlines, cel shading, warm colors). The other images are the official character sprites: use them only "
    "for the correct outfit and accessories, drawn in the comic's chibi style. Repaint the panel cleanly at full resolution (no blur, no "
    "jpeg noise). Fill the whole canvas with the panel edge to edge, no added border, frame, text or watermark.\n\nCHANGES:\n- "
)


def multipart(fields, files):
    b = uuid.uuid4().hex
    out = bytearray()
    for k, v in fields.items():
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    for f in files:
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"image[]\"; filename=\"{f.name}\"\r\nContent-Type: image/webp\r\n\r\n".encode()
        out += f.read_bytes() + b"\r\n"
    return bytes(out + f"--{b}--\r\n".encode()), f"multipart/form-data; boundary={b}"


def gen(panel, tag="01"):
    sprites, changes = FIXES[panel]
    refs = [LOADING / f"{panel}.webp"] + [NEW / c / f"chr_{c}_{f}.webp" for c, f in sprites]
    prompt = COMMON + "\n- ".join(changes)
    WORK.mkdir(parents=True, exist_ok=True)
    stem = WORK / f"{panel}-{tag}"
    stem.with_suffix(".prompt.txt").write_text(prompt + "\n\nREFS:\n" + "\n".join(str(r.relative_to(ROOT)) for r in refs) + "\n", encoding="utf-8")
    body, ctype = multipart({"model": MODEL, "prompt": prompt, "size": "1536x1024", "quality": "high", "n": "1"}, refs)
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
            print(panel, e.code, e.read().decode(errors="replace")[:300], file=sys.stderr)
            if e.code < 500 and e.code != 429:
                raise SystemExit(1)
            time.sleep(20 * (attempt + 1))
    else:
        raise SystemExit(f"{panel}: 3回失敗")
    stem.with_suffix(".png").write_bytes(base64.b64decode(res["data"][0]["b64_json"]))
    print(stem.with_suffix(".png"))


def adopt(panel, tag):
    from PIL import Image
    im = Image.open(WORK / f"{panel}-{tag}.png").convert("RGB")
    (HERE / "originals").mkdir(exist_ok=True)
    (HERE / "prompts").mkdir(exist_ok=True)
    im.save(HERE / "originals" / f"{panel}.webp", "WEBP", quality=95, method=6)
    im.resize((1440, 960), Image.LANCZOS).save(LOADING / f"{panel}.webp", "WEBP", quality=88, method=6)
    (HERE / "prompts" / f"{panel}.txt").write_text((WORK / f"{panel}-{tag}.prompt.txt").read_text(encoding="utf-8"), encoding="utf-8")
    print("adopted", panel, tag)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    if cmd == "list":
        print("\n".join(FIXES))
    elif cmd == "gen":
        gen(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "01")
    elif cmd == "adopt":
        adopt(sys.argv[2], sys.argv[3])
