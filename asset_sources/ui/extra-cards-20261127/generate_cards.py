"""タイトルの EXTRA（あそびば・要望台帳 EXT03）の、ミニゲームのカード絵を作る（OpenAI 画像API・images/edits）。

2026-11-27 オーナー「エクストラのミニゲームを選ぶ画面はビジュアルも凝りたい　生成してもいいかも」。
参照画像: その遊びの場所の採用済み背景（場所の参照）と、背景の規格の基準画像 kemurikusa.png（画風の参照。docs/background_standard.md 2節）。
人物は描かない（本人性の崩れを避ける。遊びの見せ場の道具と場所で見せる）。文字・ロゴも描かない（名前は画面の文字で出す）。
キーはコードに書かない。環境変数 OPENAI_API_KEY があれば付ける（クラウド環境ではプロキシが付ける）。

使い方: python3 generate_cards.py <id> [連番]   → originals/card-<id>-NN.png（id: axe trpg dj camel desert）
"""
import base64, json, os, sys, urllib.request, uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
BG = ROOT / "assets/backgrounds"
MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2.6-sunburst")
STYLE_REF = BG / "kemurikusa.png"

# docs/background_standard.md 2節の英文（人物なしの決まりもここに入っている）
STYLE = ("STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, "
         "in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, "
         "one clear light source, forms built from painted planes rather than outlines, warm lighting by default. "
         "No people, no text, no logos, no signboard lettering, no watermark, no UI.")

CARD = ("Make a NEW vertical key-art illustration (portrait, 2:3) for a minigame selection card in a Japanese visual-novel game menu. "
        "The attached images are references only: the first shows the location, the last shows the painting style. Do not copy their framing. "
        "Dramatic close-to-mid camera with a strong focal object in the middle third, depth with a softly blurred background, "
        "rich contrast so it reads well as a small card. Keep the top 15% and bottom 25% calmer (darker, less detail) because the card puts its title text there. ")

CARDS = {
    "axe": (BG / "bg_axe_lane.png",
            "Axe-throwing lane in a warm wooden throwing bar at night. A single throwing axe has just struck the red bullseye of a round end-grain wooden target "
            "made of vertical planks, the handle still vibrating, small wood chips flying in the amber spotlight. Chain-link fence side walls, painted target rings "
            "(red center, blue and black rings), sawdust on the floor. Low angle looking slightly up at the target, motion feel."),
    "trpg": (BG / "bg_yuzugaya_trpg.webp",
             "Tabletop role-playing night at a cozy board-game cafe. Close view over a long wooden table: two polyhedral dice (a d20 and a d6) tumbling mid-air above "
             "a hand-drawn fantasy map, small painted miniatures, character sheets, pencils, an open rulebook and a brass lantern. Warm lantern light, "
             "bookshelves full of game boxes softly blurred behind. Playful anticipation of the roll."),
    "dj": (BG / "bg_club_seam.png",
           "Underground club DJ booth seen from behind the decks. A two-deck DJ controller in the foreground with glowing jog wheels (one cyan, one purple), "
           "faders and knobs lit by stage light, headphones resting on the mixer. Beyond it a dance floor under purple and blue moving beams, a few hands raised "
           "as soft out-of-focus silhouettes only (no faces). Haze in the light beams, reflective floor."),
    "camel": (BG / "bg_dubai_camel_track_morning.png",
              "Camel racing in the Dubai desert at golden morning. Three racing camels galloping toward the viewer on a sandy track beside a white rail, "
              "each with a small boxy remote-control robot jockey on its back (no human riders), red ribbons fluttering, sand kicked up behind them, "
              "a checkered finish flag on a pole at one side. Long shadows, warm sunrise light, distant dunes and grandstand."),
    "desert": (BG / "bg_dubai_dunes_dusk.png",
               "Sandboarding on huge golden dunes at dusk. A sandboard carving down a steep dune face at speed, throwing a long arc of glittering sand spray "
               "that catches the orange sunset light; the board's carved trail curving down the slope behind it. The rider is only a tiny distant dark "
               "silhouette near the dune crest or omitted (no faces). Purple-orange sky, wind-rippled sand, sense of speed and height."),
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


def prompt_for(game):
    return f"{CARD}\nSCENE: {CARDS[game][1]}\n\n{STYLE}"


def main():
    game = sys.argv[1]
    n = sys.argv[2] if len(sys.argv) > 2 else "01"
    place, _ = CARDS[game]
    body, ctype = multipart({"model": MODEL, "prompt": prompt_for(game), "size": "1024x1536", "quality": "high", "n": "1"}, [place, STYLE_REF])
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, method="POST")
    req.add_header("Content-Type", ctype)
    if os.environ.get("OPENAI_API_KEY"):
        req.add_header("Authorization", f"Bearer {os.environ['OPENAI_API_KEY']}")
    with urllib.request.urlopen(req, timeout=900) as r:
        res = json.loads(r.read())
    dest = HERE / "originals" / f"card-{game}-{n}.png"
    dest.parent.mkdir(exist_ok=True)
    dest.write_bytes(base64.b64decode(res["data"][0]["b64_json"]))
    print(dest, MODEL)


if __name__ == "__main__":
    main()
