#!/usr/bin/env python3
"""#3941 チェキ・プリクラの追加候補（2026-11-27）を OpenAI の画像の編集（images/edits）で作る。

使い方: python3 gen.py [ID ...]   （ID を省くと jobs.json の全部。例: python3 gen.py C31 P34）
- 鍵は環境変数 OPENAI_API_KEY から読む（値は記録しない）。モデルは gpt-image-2.6-sunburst、品質 high、1024×1536。
- 参照に渡す絵: 正規の立ち絵（remake/img/sprites/character_variants/new/）、採用済みのチェキ（cg_minto_first_cheki）・プリクラ（cg_ch2_ageha_purikura_strip）。
- チェキは本編の台紙の型（採用済みのチェキの台紙と窓の位置をそのまま白紙にした物）を1枚目に渡し、出てきた台紙を本編と同じ位置（台紙 x45〜948・y72〜1530、
  写真の窓 x105〜888・y128〜1231）へ合わせ直して 993×1584 の透過PNGにする（本編の演出 motions/cheki.js が、この位置で写真を切り抜く）。
- プリクラは 1024×1536 の真ん中を 910×1536 で切り、640×1080 に縮める（本編の半分こ用シールと同じ大きさ）。
出力: raw/（API の出力そのまま）と、本体（C31.png など。候補の本番の大きさ）。
"""
import base64, io, json, os, sys, uuid, urllib.request, urllib.error, concurrent.futures as cf
from pathlib import Path
from PIL import Image
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
IMG = ROOT / "remake/img"
RAW = HERE / "raw"
MODEL = "gpt-image-2.6-sunburst"
JOBS = json.loads((HERE / "jobs.json").read_text())

STYLE = ("STYLE STANDARD (shisha-game cast): draw every character in the same artist's hand as the approved Minto, Ageha and Rio sprites. "
         "Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; "
         "highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, "
         "no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Keep each character's own eye, brow, nose and mouth shapes and natural age and gender differences; "
         "do not drift toward a generic AI pretty face.")
HAJIME = ("Hajime (22-year-old Japanese man) exactly as in his official sprite: black baseball cap with the small grey smoke-swirl mark, messy black hair under it, dark eyes, "
          "black zip hoodie over a black t-shirt. He wears NO necklace, no chain and no pendant.")
WHO = {
    "minto": "Minto exactly as in her official sprite: an adult woman (late twenties) with a youthful idol-like look, long straight black hair with blunt bangs, green eyes, small black devil horns and bat-wing hair ornaments, black off-shoulder concept-cafe dress with neon-green frills, a large green ribbon and a heart choker. Keep her face shape and eye shape.",
    "ageha": "Ageha exactly as in her official sprite: bright friendly 22-year-old face with amber eyes, soft cheeks and short gentle chin, honey-blonde twin ponytails with the pink and cream bear hair clips, leopard-print jacket over a pink top. Not heavy makeup, not cold narrow eyes.",
    "kumicho": "Kanzaki (53-year-old man) exactly as in his official sprite: short black-and-grey hair, stern brows, moustache, tinted sunglasses, light checked double-breasted suit, black shirt, purple tie and pocket square.",
    "rei": "Kuraudo (25-year-old man, visual-kei concept cafe owner) exactly as in his official sprite: layered black hair with irregular deep burgundy streaks on both sides (never a left/right split dye), tattoos, ornate black-and-red jacket.",
    "mashiro": "Mashiro exactly as in her official sprite: 22-year-old petite woman, pale ash-blonde hair in two long braids with soft bangs, sleepy half-lidded golden eyes, beige oversized knit cardigan over a white blouse.",
    "tsumugi": "Tsumugi exactly as in her official sprite: 21-year-old petite art student, brown bob with straight bangs, reddish-brown eyes, oversized purple zip hoodie with floral embroidery on the sleeves.",
    "samechan": "Same-chan exactly as in her official sprite: petite young woman, black hair with bright blue streaks, blue eyes, shark hood with fins, small fang, holding her blue shark plush with a crown.",
    "naru": "Naru (23-year-old slim man) exactly as in his official sprite: warm golden amber eyes, short tousled silver-ash hair with an asymmetric long fringe, tanned skin, open black stand-collar jacket with white shoulder and sleeve panels over a black t-shirt.",
    "hiyori": "Hiyori (25-year-old woman) exactly as in her official sprite: pink-brown hair tied in a HIGH PONYTAIL with light bangs (never hair worn down), light brown eyes, friendly soft face, white blouse.",
    "yoru": "Yoru (41-year-old tall woman, a DJ) exactly as in her official sprite: black short bob with silver-white mesh streaks, one side shaved, sharp eyes, small silver hoop earrings, big black headphones around her neck, oversized black bomber jacket, purple nails, calm adult smile. Clearly a woman in her forties, not a young man.",
    "rio": "Rio (27-year-old woman) exactly as in her official sprite: very dark long wolf-cut hair with subtle slate-blue undertones, thick sweeping bangs, languid half-lidded blue-grey eyes, subtle cool smile, white shirt with rolled sleeves.",
    "shiori": "Shiori, who is Minto off duty (the same adult woman, late twenties) exactly as in her official plain-clothes sprite: long straight black hair with blunt bangs, green eyes, NO horns, NO wings, NO concept-cafe dress; cream cable-knit cardigan over a black top, long dark green skirt, small shoulder bag. Quiet, a little shy and tired, gentle smile.",
    "adam": "Adam (28-year-old man, double-apple shisha craftsman) exactly as in his official sprite: hair split in two colors — on the viewer's LEFT side apple red, on the viewer's RIGHT side apple green — serious deadpan face, plain white t-shirt and a black waist apron.",
    "sumi": "Sumi (46-year-old man, shisha shop owner) exactly as in his official sprite: black newsboy cap, square black-framed glasses, full short beard, tanned skin, charcoal shirt with rolled sleeves and a brown waist apron.",
}
SPRITE = {"minto": "minto/chr_minto_smile", "hajime": "hajime/chr_hajime_smile", "ageha": "ageha/chr_ageha_smile", "kumicho": "kumicho/chr_kumicho_normal",
          "rei": "rei/chr_rei_normal", "mashiro": "mashiro/chr_mashiro_smile", "tsumugi": "tsumugi/chr_tsumugi_smile", "samechan": "samechan/chr_samechan_smile",
          "naru": "naru/chr_naru_smile", "hiyori": "hiyori/chr_hiyori_smile", "sumi": "sumi/chr_sumi_smile", "yoru": "yoru/chr_yoru_smile", "rio": "rio/chr_rio_smile",
          "shiori": "minto/chr_minto_ura_smile", "adam": "adam/chr_adam_normal"}

# 本編のチェキの台紙と写真の窓（motions/cheki.js の CARD・PHOTO_BOX と同じ）
CW, CH = 993, 1584
CARD = (45, 72, 948, 1530)
WINDOW = (105, 128, 889, 1232)
CARD_WHITE = (247, 246, 245)
CANVAS = (1024, 1536)
CANVAS_BG = (46, 40, 58)
FIT = CANVAS[1] / CH  # 型を1024×1536へ置く倍率（高さいっぱい）
OFFSET_X = round((CANVAS[0] - CW * FIT) / 2)


def png_bytes(img):
    buf = io.BytesIO(); img.save(buf, "PNG"); return buf.getvalue()


def sprite(who):
    return png_bytes(Image.open(IMG / f"sprites/character_variants/new/{SPRITE[who]}.webp").convert("RGBA"))


def cheki_template():
    """採用済みのチェキから、台紙の形（透過）だけを取り、白紙の台紙と灰色の窓にして 1024×1536 の地へ置く"""
    first = Image.open(IMG / "cgs/cg_minto_first_cheki.webp").convert("RGBA")
    card = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    card.paste(Image.new("RGBA", (CW, CH), CARD_WHITE + (255,)), mask=first.split()[3])
    card.paste(Image.new("RGBA", (WINDOW[2] - WINDOW[0], WINDOW[3] - WINDOW[1]), (196, 194, 204, 255)), WINDOW[:2])
    canvas = Image.new("RGB", CANVAS, CANVAS_BG)
    scaled = card.resize((round(CW * FIT), CANVAS[1]), Image.LANCZOS)
    canvas.paste(scaled, (OFFSET_X, 0), scaled)
    return png_bytes(canvas), first.split()[3]


def cheki_prompt(job):
    two = job.get("two")
    frame = job.get("frame")
    ink = job.get("ink") or "thick, slightly wobbly pink and green paint-marker handwriting"
    return " ".join([
        "Make a NEW Japanese concept-cafe cheki (instant photo) taken at PEPPERMINT, a cozy retro concept cafe with warm lamps, dark green walls and pink accents.",
        "Image 1 is the exact cheki card template: keep the card's size, position and rounded corners, the photo window position and the dark background outside the card exactly the same. Output the whole canvas with this same layout.",
        *([f"Change only the card's color and pattern: make it {frame}. The photo window stays exactly where it is."] if frame else ["Keep the card plain white."]),
        "Fill the grey photo window edge to edge with the photo. The photo:", job["pose"] + ".",
        f"Image 2 is the approved finished cheki of this cafe: match its photo quality" + ("; the handwriting here is quieter than in that cheki" if job.get("rare") else f" and copy its handwriting style for the message ({ink}, small hearts, sparkles and a mint leaf)") + ".",
        *([f"Handwriting: {ink}."] if job.get("rare") else []),
        *(["Image 3 is the official plain-clothes sprite of Shiori, who is Minto off duty.", WHO["shiori"],
           "This is an ultra-rare cheki: Minto is NOT in her concept-cafe costume — no horns, no bat wings, no frilly dress — just Shiori in her plain clothes, quiet and shy."]
          if job.get("who") == "shiori" else ["Image 3 is Minto's official sprite.", WHO["minto"]]),
        *(["Image 4 is Hajime's official sprite.", HAJIME] if two else []),
        f"In the bottom margin of the card, she has hand-written exactly this Japanese message in two lines — " + " ".join(f"line {i + 1}: 「{t}」" for i, t in enumerate(job["text"].split("\n"))) + " — and her signature 「" + ("栞" if job.get("who") == "shiori" else "みんと") + "」 smaller at the right. Write the Japanese characters correctly and legibly; write nothing else (no slashes or separators between the lines).",
        ("Keep the margins almost empty: at most two tiny hand-drawn hearts. " if job.get("rare") else "Add a few small hand-drawn hearts and sparkles in the margins. ") + "No text, logos or watermarks inside the photo. Upper-body framing unless the photo description says otherwise, both hands drawn with correct fingers.",
        STYLE,
    ])


NAME = {"kumicho": "Kanzaki", "rei": "Kuraudo", "samechan": "Same-chan", "shiori": "Shiori"}


def partners(job):
    who = job.get("with")
    return [] if not who else who if isinstance(who, list) else [who]


def purikura_prompt(job):
    others = partners(job)
    people = "Hajime alone" if job.get("solo") else "Hajime, " + " and ".join(NAME.get(w, w.capitalize()) for w in others)
    refs = ["Image 1 is an approved purikura sticker strip from this game: match its quality, its two stacked photo frames and its doodle style.", "Image 2 is Hajime's official sprite.", HAJIME]
    for i, w in enumerate(others):
        refs += [f"Image {3 + i} is the official sprite of {NAME.get(w, w.capitalize())}.", WHO[w]]
    text = " and ".join(f"「{t}」" for t in job["text"])
    return " ".join([
        "Make a NEW Japanese purikura (photo-booth sticker) strip, tall portrait, with two stacked photo frames (top and bottom) inside a decorative border.",
        f"Theme of the border and stamps: {job['theme']}.",
        f"Top photo: {people} — {job['top']}. Bottom photo: {job['bottom']}.",
        *refs,
        "Purikura look: bright soft studio lighting, eyes slightly enlarged and sparkly, but each face must stay recognisably the same person as the sprite.",
        (f"Very few doodles, in small, neat, modest handwriting (she is shy): exactly {text}, written correctly and legibly, plus one or two tiny hearts or leaves. Write no other words." if job.get("quiet") else
         f"Hand-written glitter-pen doodles in Japanese on the photos and border: exactly {text}, written correctly and legibly, plus small hearts, stars and stamps. Write no other words."),
        "Keep every face, hand and doodle inside the central 86% of the width (the left and right edges will be trimmed). Waist-up framing, correct hands and fingers. No logos, no watermark.",
        STYLE,
    ])


def call(images, prompt):
    key = os.environ["OPENAI_API_KEY"]
    b = uuid.uuid4().hex
    part = lambda k, v: f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    body = b"".join(part(k, v) for k, v in [("model", MODEL), ("prompt", prompt), ("size", "1024x1536"), ("quality", "high"), ("output_format", "png")])
    for i, data in enumerate(images):
        body += f'--{b}\r\nContent-Disposition: form-data; name="image[]"; filename="ref{i}.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + data + b"\r\n"
    body += f"--{b}--\r\n".encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, headers={"Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={b}"})
    r = json.load(urllib.request.urlopen(req, timeout=900))
    return base64.b64decode(r["data"][0]["b64_json"])


# 色・柄のある台紙は白で見つけられないので、白い台紙28枚で毎回同じだった位置を使う
FIXED_CARD = (76, 70, 949, 1482)      # 出力（1024×1536）の中の台紙
FIXED_WINDOW = (101, 128, 891, 1260)  # 台紙を本編の位置へ合わせた後（993×1584）の写真の窓


def fit_cheki(raw, mask, job=None):
    """出てきた台紙を見つけ、本編の台紙の位置へ合わせ、写真の窓も本編の位置へそろえて、台紙の外を透過にする"""
    a = np.asarray(raw.convert("RGB")).astype(int)
    if job and job.get("frame"):
        if job.get("patterned"):  # 柄の台紙（ハート・ギンガム）と、写真も暗くて色で分けられない黒い台紙
            return fit_cheki_fixed(raw, mask)
        # 無地の色の台紙（黒・アイボリー）: 台紙の左の余白の色に近い所を台紙とみなす
        color = np.median(a[600:900, 88:112].reshape(-1, 3), axis=0)
        white = np.abs(a - color).sum(axis=2) < 40
    else:
        # 台紙の白（およそ246〜248）だけを拾う。地は暗くても明るい灰色（〜220）でもよい。写真の行は左右の白い余白だけなので、行・列とも5%を目安にする
        white = a.min(axis=2) > 238
    rows = np.where(white.mean(axis=1) > 0.05)[0]; cols = np.where(white.mean(axis=0) > 0.05)[0]
    box = (cols.min(), rows.min(), cols.max() + 1, rows.max() + 1)
    card = raw.convert("RGB").crop(box).resize((CARD[2] - CARD[0], CARD[3] - CARD[1]), Image.LANCZOS)
    fill = CARD_WHITE if not (job and job.get("frame")) else tuple(int(v) for v in color)
    out = Image.new("RGB", (CW, CH), fill)
    out.paste(card, CARD[:2])
    # 写真の窓: 台紙の中で台紙の色でない所が9割を超える行・列を窓とみなし、本編の窓へ縮め直す
    b = np.asarray(out).astype(int)
    nw = (b.min(axis=2) <= 225) if fill == CARD_WHITE else (np.abs(b - np.array(fill)).sum(axis=2) >= 40)
    cy = np.where(nw[:, 300:700].mean(axis=1) > 0.9)[0]; cx = np.where(nw[200:1100, :].mean(axis=0) > 0.9)[0]
    cy = cy[(cy > 80) & (cy < 1300)]; cx = cx[(cx > 50) & (cx < 950)]
    win = (int(cx.min()), int(cy.min()), int(cx.max()) + 1, int(cy.max()) + 1)
    photo = out.crop(win).resize((WINDOW[2] - WINDOW[0], WINDOW[3] - WINDOW[1]), Image.LANCZOS)
    draw_box = (min(win[0], WINDOW[0]), min(win[1], WINDOW[1]), max(win[2], WINDOW[2]), max(win[3], WINDOW[3]))
    out.paste(Image.new("RGB", (draw_box[2] - draw_box[0], draw_box[3] - draw_box[1]), fill), draw_box[:2])
    out.paste(photo, WINDOW[:2])
    rgba = out.convert("RGBA"); rgba.putalpha(mask)
    return rgba, box, win


def fit_cheki_fixed(raw, mask):
    """色・柄のある台紙: 決まった位置で切り、窓の継ぎ目は台紙の色（左の余白の中央値）で埋める"""
    card = raw.convert("RGB").crop(FIXED_CARD).resize((CARD[2] - CARD[0], CARD[3] - CARD[1]), Image.LANCZOS)
    out = Image.new("RGB", (CW, CH), CARD_WHITE)
    out.paste(card, CARD[:2])
    win = FIXED_WINDOW  # 合わせ直した後（993×1584）の座標
    strip = np.asarray(out.crop((CARD[0] + 8, 500, WINDOW[0] - 12, 900))).reshape(-1, 3)
    color = tuple(int(v) for v in np.median(strip, axis=0))
    photo = out.crop(win).resize((WINDOW[2] - WINDOW[0], WINDOW[3] - WINDOW[1]), Image.LANCZOS)
    draw_box = (min(win[0], WINDOW[0]), min(win[1], WINDOW[1]), max(win[2], WINDOW[2]), max(win[3], WINDOW[3]))
    out.paste(Image.new("RGB", (draw_box[2] - draw_box[0], draw_box[3] - draw_box[1]), color), draw_box[:2])
    out.paste(photo, WINDOW[:2])
    rgba = out.convert("RGBA"); rgba.putalpha(mask)
    return rgba, FIXED_CARD, win


def fit_purikura(raw):
    w, h = raw.size; cw = round(h * 640 / 1080)
    return raw.convert("RGB").crop(((w - cw) // 2, 0, (w - cw) // 2 + cw, h)).resize((640, 1080), Image.LANCZOS)


def run(job, kind, template, mask):
    jid = job["id"]
    try:
        if kind == "cheki":
            imgs = [template, png_bytes(Image.open(IMG / "cgs/cg_minto_first_cheki.webp").convert("RGBA")), sprite(job.get("who") or "minto")] + ([sprite("hajime")] if job.get("two") else [])
            prompt = cheki_prompt(job)
        else:
            imgs = [png_bytes(Image.open(IMG / "cgs/cg_ch2_ageha_purikura_strip.webp").convert("RGB")), sprite("hajime")] + [sprite(w) for w in partners(job)]
            prompt = purikura_prompt(job)
        data = call(imgs, prompt)
    except urllib.error.HTTPError as e:
        return jid, "ERR " + e.read().decode()[:300]
    except Exception as e:  # noqa: BLE001 通信の失敗は、その1枚だけ報告して続ける
        return jid, f"ERR {e}"
    RAW.mkdir(exist_ok=True)
    (RAW / f"{jid}.png").write_bytes(data)
    raw = Image.open(io.BytesIO(data))
    if kind == "cheki":
        final, box, win = fit_cheki(raw, mask, job)
        final.save(HERE / f"{jid}.png")
        return jid, f"ok card={box} window={win}"
    fit_purikura(raw).save(HERE / f"{jid}.png")
    return jid, "ok"


def refit(ids):
    """API を呼ばずに、raw/ から合わせ直しだけをやり直す"""
    _, mask = cheki_template()
    for jid in ids:
        raw = Image.open(RAW / f"{jid}.png")
        if jid.startswith("C"):
            job = next((j for j in JOBS["cheki"] if j["id"] == jid), None)
            final, box, win = fit_cheki(raw, mask, job); final.save(HERE / f"{jid}.png"); print(jid, "refit card", box, "window", win)
        else:
            fit_purikura(raw).save(HERE / f"{jid}.png"); print(jid, "refit")


if __name__ == "__main__":
    if sys.argv[1:2] == ["--refit"]:
        refit(sys.argv[2:]); sys.exit()
    want = set(sys.argv[1:])
    template, mask = cheki_template()
    todo = [(j, "cheki") for j in JOBS["cheki"]] + [(j, "purikura") for j in JOBS["purikura"]]
    todo = [t for t in todo if not want or t[0]["id"] in want]
    with cf.ThreadPoolExecutor(6) as ex:
        for jid, res in ex.map(lambda t: run(t[0], t[1], template, mask), todo):
            print(jid, res, flush=True)
