"""タイトルの EXTRA（あそびば）の部品と、ロゴの無いミニゲームの題字ロゴを作る（OpenAI 画像API・images/edits。要望台帳 EXT06・EXT07）。

2026-11-28 オーナー「今ミニゲームによってロゴがあったりなかったりなのでないのは作って　あとエクストラはなんかCSS感強いから必要に応じでパーツをAPIで用意」。
- ロゴ: 既存の題字ロゴ（砂丘 DESERT RIDE・ラクダ CAMEL RACE。asset_sources/ui/minigame-visuals-20261127/logos/prompts.md）と同じ作り方
  （1536x1024・背景透過・quality high・参照画像つき）。文字はゲームの中の呼び名（AXE THROW・TABLE TALK RPG・DJ MIX）。
- 部品: 本編の縦画面（煙の舞台）の部品（remake/img/ui/vertical/pad-ring・pad-button）と同じ「煙の入った紫の大理石＋細い磨いた金の縁」。
  文字は描かない（字は画面の文字で出す）。
キーはコードに書かない。環境変数 OPENAI_API_KEY があれば付ける（クラウド環境ではプロキシが付ける）。

使い方: python3 generate.py <id> [連番]   → originals/<id>-NN.png（ロゴは asset_sources/ui/minigame-visuals-20261127/logos/originals/<id>.png）
"""
import base64, json, os, sys, urllib.request, uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
UI = ROOT / "remake/img/ui"
MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2.6-sunburst")

LOGO_TAIL = ("Isolated on a fully transparent background, centred, fills most of the canvas. "
             "No other words, no subtitles, no small text, no watermark.")
PART_STYLE = ("Match the attached UI parts exactly: smoky deep-violet marble with soft lavender smoke swirls inside, rimmed by a thin "
              "polished antique-gold bevel, hand-painted premium mobile game UI, soft top-left light. No text, no letters, no numbers, no watermark.")

JOBS = {
    # ---- ミニゲームの題字ロゴ（3つ）
    "logo_axe_throw": ("1536x1024", True, [UI / "axe_throw/howto/how_score.webp", UI / "axe_throw/throwing_axe.webp", UI / "camel_race/ui/logo.webp"],
        "A premium mobile game title logo for an axe-throwing bar game. The logo text reads exactly AXE THROW (two words, spelled A-X-E and "
        "T-H-R-O-W, nothing else) on one or two lines, in a heavy rugged slab-serif display font with warm honey-wood to amber gradient letters, "
        "a thick dark walnut-brown outline, a cream inner bevel and a strong 3D extrusion, like a console sports game logo. Integrated emblem: "
        "a round end-grain wooden target with red bullseye behind the letters and a steel throwing axe with a wooden handle stuck in it at an "
        "angle, a few flying wood chips and small sparkles. Same logo style and polish as the attached CAMEL RACE logo; colours of the attached "
        "axe-throwing game. " + LOGO_TAIL),
    # 2026-11-28 オーナー「テーブルトークRPGね　テーブルトップではなくて」（最初は TABLETOP RPG で作った）
    "logo_table_talk_rpg": ("1536x1024", True, [UI / "extra/shots/trpg-2.webp", UI / "trpg/roll-logos/success.webp", UI / "camel_race/ui/logo.webp"],
        "A premium mobile game title logo for a table-talk role-playing game played at a cosy board-game cafe. The logo text reads exactly "
        "TABLE TALK RPG (three words, spelled T-A-B-L-E, T-A-L-K and R-P-G, nothing else), with TABLE TALK on the first line and a bigger RPG "
        "on the second line, in an ornate fantasy storybook serif with "
        "polished gold letters, a thick dark teal-green outline, a cream inner bevel and a 3D extrusion. Integrated emblem: an open old "
        "leather-bound adventure book behind the letters, a big faceted twenty-sided die and a six-sided die tumbling in front, a small "
        "brass lantern glow, a laurel flourish and a few sparkles. Same gold-and-teal finish as the attached SUCCESS dice logo; same logo "
        "polish as the attached CAMEL RACE logo. " + LOGO_TAIL),
    "logo_dj_mix": ("1536x1024", True, [UI / "extra/shots/dj-2.webp", UI / "dj/jog-wheel-purple.webp", UI / "camel_race/ui/logo.webp"],
        "A premium mobile game title logo for a nightclub DJ mixing rhythm game. The logo text reads exactly DJ MIX (two words, spelled D-J "
        "and M-I-X, nothing else) in a bold, slightly italic, futuristic display font with chrome-silver to neon-violet and cyan gradient "
        "letters, a thick dark indigo outline, a bright inner bevel and a 3D extrusion with a soft neon glow. Integrated emblem: a glowing "
        "vinyl turntable jog wheel (violet ring on the left, cyan ring on the right) behind the letters, a crossfader, sound-wave lines and "
        "small sparkles, like the attached DJ game. Same logo polish as the attached CAMEL RACE logo. " + LOGO_TAIL),
    # ---- EXTRA の部品
    "xs_frame": ("1536x1024", True, [UI / "vertical/pad-ring.webp", UI / "vertical/pad-button.webp"],
        "An ornate landscape picture frame for showing game screenshots in a premium game menu, wide 16:9 proportion, filling the canvas. "
        "The frame border is a moderately thin band of smoky deep-violet marble edged inside and outside by thin polished antique-gold "
        "bevels, with small elegant gold filigree ornaments at the four corners and a tiny gold diamond at the middle of the top and bottom "
        "edges. The opening inside the frame is completely empty and fully transparent. Front view, perfectly straight, symmetric. " + PART_STYLE),
    "xs_panel": ("1536x1024", True, [UI / "vertical/pad-ring.webp", UI / "vertical/pad-button.webp"],
        "A rectangular game UI information panel plate seen straight on, filling the canvas, with slightly rounded corners: the face is smoky "
        "deep-violet marble with faint lavender smoke swirls, darker toward the edges so text stays readable; a thin polished antique-gold "
        "bevel runs around the edge, with small gold filigree corner ornaments. Flat and empty inside. " + PART_STYLE),
    "xs_button": ("1536x1024", True, [UI / "vertical/pad-button.webp", UI / "vertical/pad-ring.webp"],
        "A single wide horizontal pill-shaped game UI button seen straight on, centred, about four times wider than tall: a glossy warm-gold "
        "face with a subtle honey gradient and soft inner glow, rimmed by a thicker polished antique-gold bevel with a dark violet inner "
        "groove, a small gold diamond ornament at each rounded end. Empty face (no text, no icon). Transparent background around the button. " + PART_STYLE),
    "xs_arrow": ("1024x1024", True, [UI / "vertical/pad-button.webp", UI / "vertical/pad-ring.webp"],
        "A single round game UI navigation button seen straight on, centred: a smoky deep-violet marble disc with lavender smoke swirls, "
        "rimmed by a polished antique-gold bevel ring exactly like the attached round button, with a clean bold polished-gold chevron arrow "
        "pointing to the RIGHT in the middle. Transparent background around the disc. " + PART_STYLE),
    "xs_gems": ("1536x1024", True, [UI / "vertical/pad-button.webp", UI / "vertical/pad-ring.webp"],
        "Two small rhombus (diamond-shaped) gemstones set in thin polished antique-gold bezels, side by side with wide empty space between "
        "them, same size, seen straight on: the LEFT gem is a dim, unlit smoky violet amethyst; the RIGHT gem is a glowing warm amber-gold "
        "topaz with a soft golden glow and a tiny sparkle. Transparent background. " + PART_STYLE),
    "xs_wordmark": ("1536x1024", True, [UI / "ui_title_logo_rich.webp", UI / "vertical/pad-ring.webp"],
        "An elegant title wordmark for a game's bonus menu. The text reads exactly EXTRA (five letters E-X-T-R-A, nothing else) in a refined "
        "high-contrast serif typeface like the attached Japanese game title logo: pearl-white to soft gold metallic letters with a thin dark "
        "outline and subtle bevel, wide letter spacing. Wisps of pale lavender shisha smoke curl gently around and through the letters, with "
        "a thin gold rule underneath ending in small diamonds. Isolated on a fully transparent background, centred, the word fills most of "
        "the width. No other words, no subtitles, no watermark."),
    "xs_backdrop": ("1536x1024", False, [UI / "vertical/pad-ring.webp", ROOT / "assets/backgrounds/kemurikusa.png"],
        "A dark, atmospheric full-screen menu backdrop for a shisha-lounge themed game's bonus room: deep violet-black space with slow "
        "swirling clouds of pale lavender and warm amber shisha smoke, faint warm bokeh lights far behind, subtle gold dust motes, darker "
        "toward the edges and the centre kept calm and empty so UI can sit on top. Painterly, soft, no objects, no people, no text, no "
        "logos, no watermark."),
}


def multipart(fields, files):
    b = uuid.uuid4().hex
    out = bytearray()
    for k, v in fields.items():
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    for f in files:
        kind = "image/webp" if f.suffix == ".webp" else "image/png"
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"image[]\"; filename=\"{f.name}\"\r\nContent-Type: {kind}\r\n\r\n".encode()
        out += f.read_bytes() + b"\r\n"
    out += f"--{b}--\r\n".encode()
    return bytes(out), f"multipart/form-data; boundary={b}"


def main():
    job = sys.argv[1]
    n = sys.argv[2] if len(sys.argv) > 2 else "01"
    size, transparent, refs, prompt = JOBS[job]
    fields = {"model": MODEL, "prompt": prompt, "size": size, "quality": "high", "n": "1", "output_format": "png"}
    if transparent:
        fields["background"] = "transparent"
    body, ctype = multipart(fields, refs)
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, method="POST")
    req.add_header("Content-Type", ctype)
    if os.environ.get("OPENAI_API_KEY"):
        req.add_header("Authorization", f"Bearer {os.environ['OPENAI_API_KEY']}")
    with urllib.request.urlopen(req, timeout=900) as r:
        res = json.loads(r.read())
    # ロゴの原画は既存の題字ロゴと同じ置き場へ（logo_<名前>.png。連番は試した時だけ付ける）
    logos = ROOT / "asset_sources/ui/minigame-visuals-20261127/logos/originals"
    dest = (logos / (f"{job}.png" if n == "01" else f"{job}-{n}.png")) if job.startswith("logo_") else HERE / "originals" / f"{job}-{n}.png"
    dest.parent.mkdir(exist_ok=True)
    dest.write_bytes(base64.b64decode(res["data"][0]["b64_json"]))
    print(dest, MODEL)


if __name__ == "__main__":
    main()
