"""スチル（イベントCG）を縦画面向けの2:3に作り直す（OpenAI 画像API・images/edits）。

2026-11-28 オーナー「このゲームのスチルを縦画面レイアウトに合わせてAPIで作り直していって」
「質感の統一感もしたい。今の新バージョンの立ち絵の絵柄に合わせてかつ、AI臭さを減らす感じで」
「スチルは室内の場合で元の見た目から破綻する場合は背景しっかりわからないようにしたい。部屋の構成が破綻したりよくある」。

1回の生成に渡す参照画像（役割はプロンプトに書く）:
  1. 今の横長のスチル（remake/img/cgs/<id>.webp）… 中身（瞬間・人物・しぐさ・小物・時間帯・場所の色）だけ。描き方・顔・服・背景は写さない
  2. 写る人物の新バージョンの立ち絵（remake/img/sprites/character_variants/new/<id>/chr_<id>_<face>.webp）… 本人
  3. 画風の目標2枚（docs/portrait_standard.md 6節の③④: みんと営業姿・あげはの新版の通常。場面に本人がいる時は凛想・つむぎで代える）
室内は部屋を描かず、場所の色だけのぼけにする（間取りの破綻を出さない）。屋外は場所が分かる程度に簡素に描く。
シーシャ台が写る場面は docs/shisha_reference.md §4.2 の英文をそのまま足し、§4.3 の8行を SCENES に残す。

キーはコードに書かない。環境変数 OPENAI_API_KEY があれば付ける（クラウド環境ではプロキシが付ける）。

使い方:
  python3 generate.py gen <cg_id> [タグ]     → $STILLS_WORK/<cg_id>-<タグ>.png と .prompt.txt（既定 ./work）
  python3 generate.py prompt <cg_id>          → 渡す文面と参照画像を表示するだけ（生成しない）
  python3 generate.py adopt <cg_id> <タグ>    → originals/<cg_id>.webp（原画）と remake/img/cgs/portrait/<cg_id>.webp（ゲーム用）
  python3 generate.py list                    → 登録済みの場面の一覧
"""
import base64, json, os, re, sys, time, urllib.error, urllib.request, uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2.6-sunburst")
WORK = Path(os.environ.get("STILLS_WORK", HERE / "work"))
CG = ROOT / "remake/img/cgs"
NEW = ROOT / "remake/img/sprites/character_variants/new"
GAME_OUT = ROOT / "remake/img/cgs/portrait"
PROMPTS_3952 = ROOT / "asset_sources/stills-ch2-ch5-3952/prompts.md"

# ───────── 共通の文 ─────────

FORMAT = (
    "FORMAT: one finished vertical story still (portrait 2:3) for a Japanese visual-novel game played on a smartphone held upright. "
    "The game shows this picture across the full width of the phone screen, and later lays its OWN dialogue box over the bottom 30% and "
    "its own small status text over the top 6%. Do NOT draw those yourself: no dialogue box, text window, name plate, panel, frame, status "
    "bar, icons, buttons or any other interface anywhere; paint only the scene, continuing to all four edges. Put every face, the key hands "
    "and the key prop between 8% and 62% of the image height (measured from the top). Fill the bottom 30% with a calm, simpler and darker "
    "continuation of the scene (laps, a table top, the floor, clothes, soft shadow) with nothing important in it; never an empty band, "
    "border or frame. Frame the people closer than in a landscape "
    "picture: they fill most of the width, cropped at the waist, thighs or knees as the moment needs. When two or three people stood side by "
    "side in the landscape version, stagger them in depth (one nearer and lower, the other a step behind and higher) so every face fits the "
    "narrow frame at a readable size. Choose a camera with a reason (eye level of the viewer unless the scene says otherwise); avoid a stiff, "
    "perfectly centered, symmetric layout."
)

STYLE = (
    "STYLE STANDARD (shisha-game stills, same hand as the new character sprites): draw every person exactly in the same artist's hand as the "
    "attached official sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and "
    "thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the "
    "hair and small catchlights in the eyes. Matte surfaces everywhere: no skin gloss, no airbrush gradients, no rim light, no glow or bloom, "
    "no lens flare, no floating sparkles, dust motes or light particles, no photographic texture, no pore or fabric micro-detail, no dense "
    "ornamental noise, no hundreds of thin hair strands, no dithering or pixel-art grain. Limited palette: besides hair and skin, three or "
    "four main colors in the whole picture. Light comes only from the real light sources of the place; no orange-and-teal movie grading and "
    "no overall yellow cast unless the lamps of the place are warm. Every face keeps that character's own eye, brow, nose and mouth shapes, "
    "age and build exactly as in their sprite; never beautify anyone into a generic anime face. Natural, slightly asymmetric poses and "
    "correct hands with relaxed fingers. Body proportions as in the sprites (adults about 7 heads tall; Tsumugi, Mashiro, Ageha and "
    "Same-chan about 5.8 heads tall)."
)

BG_INDOOR = (
    "BACKGROUND (indoors; the room must stay unreadable): do NOT draw the room. Behind the people paint only a soft, completely "
    "out-of-focus wash of the place's colors ({palette}), as if a long lens threw the whole room out of focus: a few large blurred color "
    "masses and broad soft light from the real lamps. No readable architecture or furniture structure anywhere behind them: no wall corners, "
    "windows or window frames, shelves or bottles on shelves, doors, stairs, ceiling lines, pendant lamps drawn in detail, posters, "
    "paintings or plants. Only what the people touch, sit on or stand at is drawn sharply (the table or counter edge right in front of them, "
    "the seat, the objects in their hands, the hookah they use). Keep the blur calm and painterly: flat soft shapes, not glittering bokeh circles."
)

BG_OUTDOOR = (
    "BACKGROUND (outdoors): keep the place recognizable but secondary and simple: painted with clearly fewer details than the people, a "
    "little soft in focus, consistent perspective, no repeated clutter; no lettering on any sign, awning, shop front or vehicle."
)

CONTENT_REF = (
    "IMAGE 1 is the current landscape version of this same story still. Use it ONLY to know the content: the moment, who is there, their "
    "gestures and expressions, the props, the time of day and the colors of the place. Do NOT copy its rendering, line art, faces, outfits "
    "or background details, and do not just crop it: compose a new vertical picture. IMAGE 1 was drawn with older character designs: "
    "wherever IMAGE 1 or the scene text differs from a character sprite (face, hair, outfit, accessories), the sprite is correct; dress "
    "everyone exactly as in their sprite."
)

HAJIME = {
    "pov": "The viewer is Hajime (first person). If any part of him shows, it is only his hand(s) and forearm in the sleeve of his black zip "
           "hoodie, entering from the bottom or a side edge; never his face.",
    "back": "Hajime (22, short black hair, black cap, black zip hoodie over a black t-shirt, dark cargo trousers; see his sprite) appears only "
            "from behind or the side: his back, shoulder, arm or the back of his head; his face stays out of view.",
    "visible": "Hajime (22, short black hair, black cap with a small white smoke-line emblem, black zip hoodie over a black t-shirt, dark "
               "cargo trousers, no necklace; see his sprite) is in the picture with his face visible.",
    "none": "Hajime is not in the picture and there is no first-person hand.",
}

NO_HOOKAH = "No hookah, hose, bowl or charcoal anywhere in the picture."
# 好感度の締めくくり（VPT16）は、長く使ってきた素焼きの器を渡す場面が多い。器だけを描き、台は描かない
BOWL_ONLY = ("The only shisha item in the picture is that small unglazed clay bowl: a palm-sized cup on a short slim neck, clearly "
             "visible and smaller than a hand. No hookah stand, glass base, hose, handle, heat management device, foil or charcoal.")

# §4.2 の英文のあとに足す補足（試作で、ロータス型が王冠のようなギザギザの縁になり、ハガルが顔の0.7倍に膨らんだため）
HOOKAH_NOTE = (
    "Hookah look in this picture: a lotus-type HMD is a low, round, flat-topped metal can (like a small tin) with vent slots around its "
    "side and a lid with a small knob; the coals are inside it and mostly hidden by the lid; it has no jagged crown rim. The bowl under it "
    "is a short black silicone cup. Measure against the face: bowl + HMD together are at most half the height of the nearest face. A "
    "floor-standing hookah reaches about the shoulder of a seated person; do not enlarge it to show it off."
)

TEXT_RULE = (
    "No text, letters, numbers, logos, borders, signature or watermark anywhere, and no game interface (no dialogue window, menu or status "
    "icons, battery or signal marks, play buttons); papers, screens, labels, signs and packages are blank "
    "or show only abstract shapes. Unnamed people are ordinary adults with plain everyday faces, kept smaller, softer or partly out of frame."
)


def hookah_text():
    """docs/shisha_reference.md §4.2 の英文（要約しない）"""
    for line in (ROOT / "docs/shisha_reference.md").read_text(encoding="utf-8").splitlines():
        if line.startswith("> Draw the hookah"):
            return line[2:].strip()
    raise SystemExit("shisha_reference.md §4.2 の英文が見つからない")


def scenes_3952():
    """#3952 の prompts.md から、場面文（Scene:）と §4.3 の8行を cg_id ごとに取り出す"""
    text = PROMPTS_3952.read_text(encoding="utf-8")
    parts = re.split(r"\n## (\d-\d+) `(cg_[a-z0-9_]+)`\n", text)
    out = {}
    for i in range(1, len(parts), 3):
        blocks = re.findall(r"```text\n(.*?)\n```", parts[i + 2], re.S)
        scene = next((b for b in blocks if b.startswith("Scene")), "")
        eight = next((b for b in blocks if b.startswith("人物")), "")
        # 横長の時の「添付の部屋を使う」は、部屋を描かない今回の決まりと食い違うので外す
        scene = re.sub(r"\s*\((?:use )?the attached [^)]*\)", "", scene)
        scene = scene.replace("the attached room", "the place").replace("as the attached room", "as before")
        out[parts[i + 1]] = {"num": parts[i], "scene": scene, "eight": eight}
    return out


# ───────── 場面 ─────────
# chars: (立ち絵のフォルダ, 表情, 本文での呼び名)。place: indoor / outdoor。hajime: pov / back / visible / none。
# hookah: §4.3 の8行（シーシャ台が写る場面だけ）。scene: 英文。from3952: True なら prompts.md の場面文を使い、note を足す。

TONARI = "warm amber light, dark brown wood, deep green leather, and a few jewel-colored glows (cobalt blue, ruby red, emerald) from Turkish mosaic lamps"
MUKAI_DAY = "muted blue-grey, olive green, pale daylight and light wood"
MUKAI_NIGHT = "deep navy blue, dark wood and warm amber wall-lamp light"
STAGE = "deep navy and violet darkness with blue, purple and magenta stage light and warm spotlights"
LAB = "clean white, pale grey, light wood and soft cool daylight"

# ───────── 回想のスチル（VPT09。オーナー「回想シーン用に若いシェイクとかスミさんとか先代のマスターとかは立ち絵ではなくスチルで描きたい
# デザインは任せる　これは何枚か候補みたい」「15年前のスミさんが全然見た目若くない」）。候補のタグ（a・b・c）ごとに DESIGN を変える ─────────

MEMORY = ("MEMORY TONE: this is a flashback. Slightly faded, warm memory colors (a little desaturated, gentle warm light), but the same clean "
          "anime rendering as everything else: no sepia filter, no film grain, no vignette, no blur over the people.")
YOUNG_SHEIKH_30 = ("the young Sheikh at about 30, travelling incognito in Japan: the same face design as his sprite (same eye shape, brows, nose "
                   "and warm brown skin) but 22 years younger, smooth face, a neatly trimmed short black beard, thick black wavy hair, no "
                   "headdress, no gold, no jewelry; a plain beige linen jacket over a white open-collar shirt; a kind, curious, slightly "
                   "mischievous smile")
# 2026-11-28 オーナー「昔のスミさんはちょっとだけ今のはじめに似てるのも良い」→ 若いスミは案B（眼鏡）で決定。はじめに少し似ていてよい
YOUNG_SUMI_LOOK = ("Young Sumi's look in every memory scene: the same square black glasses as his sprite, messy short black hair with a "
                   "fringe, a lean build, clearly young with smooth skin and no grey hair; a slight family-like resemblance to Hajime "
                   "(similar messy black hair and soft eye shape) is welcome, but he is a different person with glasses.")
YOUNG_SUMI = {
    "a": "DESIGN A for young Sumi: clean-shaven, NO glasses, NO cap, short neat black hair with a soft fringe, lean and a little lanky; the "
         "same eye shape, brows and jaw as his sprite but clearly young, smooth skin, no wrinkles",
    "b": "DESIGN B for young Sumi: the same square black glasses as his sprite, light stubble only (no full beard), NO cap, black hair a "
         "little longer and messy, lean; clearly young, smooth skin, no wrinkles",
    "c": "DESIGN C for young Sumi: NO glasses, a dark bandana tied over his head instead of the cap, black hair sticking out at the nape, a "
         "thin line of stubble along the jaw, lean and sharp-eyed; clearly young, smooth skin, no wrinkles",
}
MASTER = {
    "a": "DESIGN A for the Master (the owner of the cigar bar, about 60): a small, upright elderly gentleman, neatly combed white hair, "
         "round gold-rimmed glasses, white shirt with sleeve garters, black waistcoat and a black bow tie, a gentle, dignified smile",
    "b": "DESIGN B for the Master (the owner of the cigar bar, late 50s): a broad-shouldered man, bald head, a thick grey walrus "
         "mustache, rolled-up shirt sleeves under a dark brown leather apron, warm crinkled eyes and a hearty grin",
    # 2026-11-28 オーナー「マスターは赤茶色のやつが良い」→ 案Cの顔に、赤茶のカーディガン（どの場面も）で決定
    "c": "DESIGN C for the Master (the owner of the cigar bar, mid 50s): a lean man with swept-back salt-and-pepper hair, a thin "
         "mustache and calm, slightly hooded eyes; he wears a RED-BROWN (burgundy-brown) knit cardigan over a dark charcoal "
         "waistcoat and a dark shirt without a tie, a small pocket square; a calm, wry half-smile. The red-brown cardigan is his "
         "signature in every scene",
}
CIGAR_BAR = "deep mahogany brown, oxblood leather red, brass and amber lamp glow, a faint haze of cigar smoke"

SCENES = {
    # ── 第1章 ──
    "cg_ch1_dr_kemuri_hook": dict(
        chars=[("dr_kemuri", "smile", "Dr. Charcoal")], place="indoor", palette=STAGE, hajime="none",
        scene="Chapter 1, right after the local shisha tournament. The awards are over and the audience seats of the event hall are being "
              "cleared. Dr. Charcoal (38; messy brown hair, square black glasses, green eyes, short stubble, open-collar white shirt, white lab "
              "coat with green and brown stains, three pens in the breast pocket, beige chinos, black sandals), one of the judges, sits alone in "
              "a seat in a corner of the emptying audience rows, legs crossed, a laptop open on his knee, typing without talking to anyone. The "
              "pale screen light falls on his face; he is absorbed, with the faint private smile of someone who has just found something "
              "interesting. Seen from a little distance, as Hajime glances at him from the lobby. Only he and his seat are sharp; the rows of "
              "seats and the stage behind dissolve into dark blur. The laptop lid is plain with no logo."),
    "cg_ch1_minto_casual_reveal": dict(
        chars=[("minto", "ura_normal", "Minto (in her private clothes)")], place="outdoor", hajime="pov",
        scene="Chapter 1, the day of their promised outing, noon, in front of a small Japanese train station. Minto has just arrived and said "
              "'Sorry I kept you waiting' in a small voice. She stands a step away from the viewer in her private clothes (long straight black "
              "hair with blunt bangs, green eyes, cream cable-knit cardigan over a black lace-trimmed top, small green pendant, long dark skirt, "
              "black shoulder bag with a mint-green heart charm), with light makeup and no horns or wings. Shy and a little embarrassed to be "
              "seen out of her café uniform, she re-grips the strap of her shoulder bag with both hands, a soft hesitant smile, eyes half lowered "
              "and just lifting toward the viewer. Bright clear daylight. Behind her: the station entrance with ticket gates and a tiled plaza, "
              "a few small plain passers-by far away."),
    "cg_ch1_sui_smile": dict(
        chars=[("sui", "smile", "Chairman Sensu")], place="indoor", palette=STAGE, hajime="none",
        scene="Chapter 1, the local tournament has just ended and Hajime is lifting the trophy on stage; applause fills the hall. At the long "
              "judges' table, Chairman Sensu (45; slicked-back black hair with grey at the temples, a stern face famous for never moving, black "
              "three-piece suit, white shirt, dark tie) sits with his chin resting on one hand and looks straight at the viewer. The corner of "
              "his mouth lifts very slightly: the smallest, most certain praise. Keep the smile tiny and restrained, his eyes still sharp; not a "
              "grin. On the table in front of him: a glass of water and blank score sheets. Warm light on the table from above, stage colors behind."),
    "cg_ch1_sumi_training": dict(
        chars=[("sumi", "serious", "Sumi")], place="indoor", palette=TONARI, hajime="pov",
        scene="Chapter 1, tonari, the small shisha café where Hajime works, after closing: only the orange indirect light is left and the shop "
              "looks different from the daytime. Sumi (46, the owner; black flat cap, square black glasses, short beard, dark charcoal shirt "
              "with rolled sleeves, brown waist apron) stands behind the wooden counter. He has taken an old glass bottle from the end of the back "
              "shelf, something he has never opened in front of Hajime, and holds it in both hands at chest height, about to open it. The bottle "
              "is small and old, filled with deep amber liquid, its glass covered with fine scratches from years of being carried, with a faded "
              "paper label that has no readable writing. His fingers tremble for just a moment; his face is quiet and serious, eyes on the bottle. "
              "The viewer stands across the counter; at most his forearm rests on the counter at the lower edge.",
        no_hookah=True),
    "cg_ch1_tournament_battle": dict(
        chars=[("hajime", "serious", "Hajime"), ("naru", "serious", "Naru")], place="indoor", palette=STAGE, hajime="visible",
        hookah="人物      : はじめ（自分の台でハンドルを取る）、なる（隣の台・奥）、ほかの出場者2人（さらに奥・ぼけ）\n"
               "場面      : 完成・喫煙の直前（蒸らしを終えた台を吸い出す）\n"
               "台の型    : 日本の店の業務用。ステンレスの細いステム＋幅の広いガラスベース。大会の作業台の上に1台ずつ\n"
               "HMD       : シリコンボウル＋ロータス型HMD（蓋あり）\n"
               "炭        : HMDの中に2〜3個（蓋で見えにくい）\n"
               "ホース    : 台の側面ポート → 作業台の上をたわむ → はじめが持ち上げた硬いハンドル。1本だけ\n"
               "吸い口    : ハンドル先端に使い捨てチップ\n"
               "構図      : はじめは腰から上、台は同じ奥行きで受け皿とステム上部が写る。奥の台はぼけて小さく、形だけ",
        scene="Chapter 1, on stage at the local shisha tournament, mid-match. Hajime (face visible) stands at his competition table in the "
              "near foreground, waist-up, focused and a little tense, steadying himself ('Calm down. Same as always. Draw it, then deliver it'): "
              "his hookah has finished steaming and he has just lifted the hose handle, about to take the first pull. At the next table, one step "
              "behind him and higher in the frame, Naru (23) works on his own hookah and glances over. Two more competitors stand further back, "
              "small and out of focus: Adam (28, short hair red on the screen-left side and green on the screen-right side, white t-shirt "
              "and black waist apron) and Minto in her café uniform (long straight black hair, small black horns, black dress with mint-green frills); no "
              "one else wears a cap like Hajime. Spotlights from above; the hall beyond is dark blur."),
    "cg_ch1_tsumugi_heart_art": dict(
        chars=[("tsumugi", "normal", "Tsumugi")], place="indoor", palette=TONARI, hajime="pov",
        scene="Chapter 1, tonari just before closing. Tsumugi (21, art student; short straight chestnut bob, brown eyes, purple zip hoodie with "
              "small embroidered flowers, black pleated skirt) stands across the counter from the viewer and holds up her tablet with both hands, "
              "screen toward the viewer, to show the finished picture she will submit to a contest: 'It's done. The picture I'm entering.' Her "
              "expression is shy but proud: a small careful smile and a faint blush, her eyes moving from the screen to the viewer's face. The "
              "tablet screen shows her painting, small and loose inside the screen: a warm café interior, the back of a young man in a black cap "
              "facing customers through soft smoke, and a small cat by a window; no text. The tablet and its screen are intact and clean: no "
              "cracks, scratches or white lines across the glass. The viewer's hand rests on the counter at the lower edge.",
        no_hookah=True),
    "cg_minto_casual": dict(
        chars=[("minto", "ura_smile", "Minto (in her private clothes)")], place="outdoor", hajime="pov",
        scene="Chapter 1, an outing on a free afternoon. Minto, in her private clothes (long straight black hair with blunt bangs, green eyes, "
              "cream cable-knit cardigan over a black lace-trimmed top, small green pendant, long dark skirt, black shoulder bag with a mint-green "
              "heart charm; no horns, no wings), was waiting in front of the café and has just turned toward the viewer, waving one hand at "
              "shoulder height with a gentle, grown-up, happy smile: 'Thanks for coming.' Soft daytime sunlight on a quiet Japanese shopping "
              "street: small shop fronts and a paved sidewalk behind her, simple and soft."),
    "cg_minto_cheki": dict(
        chars=[("minto", "smile", "Minto (café uniform)"), ("hajime", "smile", "Hajime")], place="indoor",
        palette="mint green, soft pink, cream and a little brass", hajime="visible",
        scene="Chapter 1, PEPPERMINT, the mint-and-pink concept café where Minto works, at noon. The two-shot photo she insisted on: Minto in her "
              "café uniform (black dress with mint-green frills and a big mint bow, small black horns and little bat-wing hair ornaments, black "
              "choker with a green heart) sits on a pink sofa and leans close to Hajime, making a peace sign by her cheek with a bright, natural, "
              "off-duty smile. Hajime (face visible: black cap, black zip hoodie, black t-shirt) sits beside her, shoulders a little stiff, with "
              "an awkward, shy smile. Waist-up, framed like a snapshot taken from straight in front at their eye level with a soft flash; Minto "
              "slightly nearer and lower, Hajime a little behind and higher, both faces large and clear.",
        no_hookah=True),
    "cg_oneesan_first_smoke": dict(
        chars=[("minto", "ura_normal", "the lady (Minto in her private clothes)")], place="indoor", palette=TONARI + ", soft afternoon daylight",
        hajime="none",
        hookah="人物      : お姉さん（＝私服のみんと）。ソファで一口吸って吐く\n"
               "場面      : 完成・喫煙\n"
               "台の型    : 日本の店の業務用。ステンレスの細いステム＋幅の広いガラスベース。ソファの横の床に1台（上端は座った彼女の肩の高さ）\n"
               "HMD       : シリコンボウル＋ロータス型HMD（蓋あり）\n"
               "炭        : HMDの中に2〜3個（蓋で見えにくい）\n"
               "ホース    : 側面ポート → 卓の上をたわむ → 彼女の右手の硬いハンドル。1本だけ\n"
               "吸い口    : ハンドル先端に使い捨てチップ\n"
               "構図      : 座った膝上まで。台は彼女と同じ奥行きの卓の上で、受け皿とステム上部が写る",
        scene="Chapter 1, tonari, the small shisha café where Hajime works, in the afternoon; daylight mixes with warm lamps. A calm young woman, "
              "the regular customer Hajime calls 'the lady' (she is Minto in her private clothes, though the player does not know it yet: long "
              "straight black hair with blunt bangs, green eyes, cream cable-knit cardigan over a black lace-trimmed top, small green pendant, long "
              "dark skirt), sits on a green leather sofa with her legs crossed. She has just taken a puff of the mint shisha Hajime made for her "
              "and exhales slowly, eyes gently closed, a thin soft stream of pale smoke leaving her lips and rising. One hand holds the hose handle "
              "loosely near her chest, the other rests on her knee. Calm, private, quietly satisfied. A finished floor-standing hookah stands "
              "on the floor beside the sofa, at the same depth as her, its top at about her shoulder height."),
    "cg_tsumugi_smoke_color": dict(
        chars=[("tsumugi", "normal", "Tsumugi")], place="indoor", palette=TONARI, hajime="none",
        scene="Chapter 1, tonari at night. Tsumugi (21; short straight chestnut bob, brown eyes, purple zip hoodie with small embroidered "
              "flowers, black pleated skirt, black knee socks) sits curled up on a green leather sofa, chin resting on one hand, her dark tablet "
              "on her knees, quietly watching the smoke Hajime has just exhaled drift through the air between them. To her eyes the smoke has "
              "color: one slow ribbon of smoke is tinted indigo and lavender with a faint thin rainbow edge (her synesthesia), painted as flat "
              "cel-shaded color, not a neon glow; it is the only colored thing in the air. Her face is peaceful and wondering, a faint smile.",
        no_hookah=True),

    # ── 第2章 ──
    "cg_ch2_sofa_wet_cloth": dict(from3952=True, chars=[("sumi", "serious", "Sumi")], place="indoor", palette=TONARI, hajime="pov",
                                  note="No full hookah in frame: only the plain steel tongs, the small metal dish and the one small coal."),
    "cg_ch2_ageha_lesson": dict(from3952=True, chars=[("ageha", "surprise", "Ageha")], place="indoor",
                                palette="bright even white ceiling light, light wood and soft teal", hajime="pov"),
    "cg_ch2_kanzaki_id_check": dict(from3952=True, chars=[("kumicho", "serious", "Kanzaki")], place="indoor",
                                    palette="dark walnut brown, black leather, muted gold leaf and cream marble", hajime="pov", no_hookah=True),
    "cg_ch2_naru_score_sheet": dict(from3952=True, chars=[("naru", "serious", "Naru")], place="indoor",
                                    palette="dark green, warm pendant-lamp amber and dark wood", hajime="pov",
                                    note="Naru's outfit follows his sprite (brown-and-beige zip jacket over a dark brown turtleneck), not the outfit words above."),
    "cg_ch2_rei_earphone": dict(from3952=True, chars=[("rei", "normal", "Kuraudo")], place="outdoor", hajime="pov", no_hookah=True),
    "cg_ch2_rest_notebook": dict(from3952=True, chars=[], place="indoor", palette="dim cool grey-blue room shadow and one warm bedside-lamp glow",
                                 hajime="pov", no_hookah=True),
    "cg_ch2_ageha_white_bear": dict(from3952=True, chars=[("ageha", "sad", "Ageha")], place="indoor",
                                    palette="dim candy pink, deep raspberry red and a little leopard brown, lights half off", hajime="none", no_hookah=True),
    "cg_naru_after_hours": dict(
        chars=[("naru", "serious", "Naru")], place="indoor", palette="night blue, warm desk-lamp yellow and worn wood", hajime="none",
        scene="Chapter 2, the same night, in an unfamiliar seaside town. In a small borrowed workshop, Naru (23; see his sprite for his face, "
              "hair and outfit) sits at a scuffed wooden workbench under a single desk lamp, writing today's failures into a worn notebook with a "
              "pen (scribbles only, unreadable). Three times in a row the steps he brought did not work with the borrowed equipment; instead of "
              "erasing his successful recipe, he is rewriting it next to the equipment, the room temperature and the taste after fifteen minutes. "
              "Tired but stubborn, focused eyes. On the bench: crumpled paper and a glass of water. Under the bench, a bag he has not unpacked. "
              "His fingertips show the marks of washing work.",
        no_hookah=True),

    # ── 第3章 ──
    "cg_ch3_childhood_offered_hand": dict(
        chars=[("saku", "sad", "Ayatori (only as the grown-up model for the boy)"), ("mashiro", "normal", "Mashiro (only as the grown-up model for the girl)")],
        place="outdoor", hajime="none",
        scene="Chapter 3 prologue, a memory: a small park in autumn, afternoon light, fallen yellow leaves rolling in the wind. Two children about "
              "six years old (draw them as real small children with child proportions, about 4 heads tall; the sprites only show who they grow up "
              "to be). A small boy, the child Ayatori (messy curly light-brown hair, brown eyes, red-brown sweater, khaki shorts), sits on a low "
              "concrete ledge with a crayon drawing turned face-down on his knees, hurt and quiet, after another child laughed and called him a "
              "liar. A small girl, the child Mashiro (pale ash-blonde hair in two short braids, sleepy golden eyes, cream knit cardigan over a "
              "sage-green dress), has crouched down beside him and holds out her small hand to him, calm and matter-of-fact, with a sleepy, gentle "
              "face. A small plastic bottle of tea stands beside them. Behind them: a simple park with a slide and trees, soft."),
    "cg_saku_mashiro_childhood": dict(
        chars=[("saku", "smile", "Ayatori (only as the grown-up model for the boy)"), ("mashiro", "smile", "Mashiro (only as the grown-up model for the girl)")],
        place="outdoor", hajime="none",
        scene="Chapter 3 prologue, a memory, a moment later: the same small autumn park in warm afternoon light. The two six-year-olds (real small "
              "children with child proportions, about 4 heads tall; the sprites only show who they grow up to be) now sit side by side on the low "
              "concrete ledge. The boy (the child Ayatori: messy curly light-brown hair, red-brown sweater, khaki shorts) has folded his crayon "
              "drawing of a lemon cake in half and given one half to the girl; each holds a half on their lap. He smiles shyly for the first time; "
              "the girl (the child Mashiro: pale ash-blonde hair in two short braids, sleepy golden eyes, cream knit cardigan over a sage-green "
              "dress) smiles with sleepy contentment. 'Will you drink here again tomorrow?' 'Yeah. We're friends.' A small bottle of tea between "
              "them; fallen leaves. The drawing halves show only simple child crayon shapes, no text."),
    "cg_ch3_mashiro_no_craft_day": dict(from3952=True, chars=[("mashiro", "normal", "Mashiro")], place="indoor", palette=MUKAI_DAY, hajime="pov", no_hookah=True),
    "cg_ch3_liars_night": dict(from3952=True, chars=[("hajime", "normal", "Hajime"), ("mashiro", "normal", "Mashiro"), ("saku", "normal", "Ayatori")],
                               place="outdoor", hajime="back", no_hookah=True,
                               note="In the vertical frame: Hajime nearest and lowest, seen from behind; the other two smaller, further up the street, each going a different way."),
    "cg_ch3_national_ask_customer": dict(from3952=True, chars=[("saku", "serious", "Ayatori")], place="indoor", palette=STAGE, hajime="pov"),
    "cg_ch3_half_cake": dict(from3952=True, chars=[("mashiro", "smile", "Mashiro"), ("saku", "smile", "Ayatori")], place="indoor",
                             palette="warm red-brown, cream and soft morning light", hajime="pov", no_hookah=True),
    "cg_ch3_mukai_latte_cat": dict(from3952=True, chars=[("mukai_master", "normal", "Mukai"), ("mashiro", "normal", "Mashiro")], place="indoor",
                                   palette=MUKAI_NIGHT, hajime="pov", no_hookah=True),
    "cg_mashiro_double_apple": dict(
        chars=[("mashiro", "normal", "Mashiro")], place="indoor", palette=MUKAI_NIGHT, hajime="pov",
        hookah="人物      : ましろ（ハンドルを差し出す）\n"
               "場面      : 完成・喫煙（提供の瞬間）\n"
               "台の型    : 画角の外（卓の向こう側・下）\n"
               "HMD       : 画角の外（ロータス型の想定。描かない）\n"
               "炭        : 画角の外\n"
               "ホース    : ハンドルの太い下端の金具 → 1本のホースが卓の縁の向こうへ垂れて見えなくなる\n"
               "吸い口    : ハンドル先端に使い捨てチップ（こちら向き）\n"
               "構図      : 一人称。卓越しに胸から上のましろの寄り。ハンドルと手は顔のすぐ下、画面の上半分。左右は腕とぼけた背景だけ",
        scene="Chapter 3, after closing at mukai, a small café-style shisha shop in Tokyo, night. Mashiro (22; pale ash-blonde hair in two long "
              "braids with soft bangs, sleepy half-lidded golden eyes, beige oversized knit cardigan over a white blouse with a small ribbon tie) "
              "has packed and lit a shisha without explaining anything, and now holds the hose handle out to the viewer across the table: her arm "
              "extended toward the camera, the rigid handle held loosely in her fingers with its short disposable tip (the narrow end) pointing "
              "toward the viewer and its thicker lower end with the hose adapter toward her; the single soft hose hangs from that lower end down "
              "behind the table edge and out of view. Her usual sleepy, calm face with a tiny relaxed smile: 'Here. Double apple. The simple "
              "one.' The hookah itself, the bowl, the HMD, the coals and any flavor package are out of frame: no hookah stand, glass base or "
              "tray anywhere in the picture, only the handle and the one hose. Nobody is smoking yet: no smoke anywhere. Frame it as a close "
              "shot from her chest up so that there is no room for a hookah: on both sides there is only her arm, her braids and the blurred "
              "background. The one hose drops straight down from the handle's lower end to below the table edge; it does not pass behind "
              "her or around her."),
    "cg_naru_last_chance": dict(
        chars=[("naru", "sad", "Naru")], place="indoor", palette="deep indigo, violet stage light and warm white spotlight", hajime="none",
        scene="Chapter 3, the last-chance qualifier in a regional event hall. The final result has just named Naru (23; see his sprite) the "
              "second representative of Japan. Standing on the small stage, he grips the trophy he was handed (a plain silver cup with two "
              "handles, no engraving) against his chest with one hand; he tries to smile, but his eyes blur and crease with tears first: a "
              "relieved, hard-won, slightly broken smile ('Damn. Finally, I won'). A spotlight from above; the clapping audience below is only "
              "dark soft shapes.",
        no_hookah=True),
    "cg_naru_next_entry": dict(
        chars=[("naru", "serious", "Naru")], place="indoor", palette="pale grey, cool fluorescent white and muted blue", hajime="none",
        scene="Chapter 3, the waiting room of a regional event hall before the last-chance qualifier, where players who lost at home and players "
              "from other regions all start equal. Naru (23; see his sprite) sits on a plain bench with his battered notebook open on his knees, "
              "his thumb tracing a line of rewritten dates (scribbles only, unreadable); a black hard-shell equipment case and a backpack beside "
              "him. Calm, focused and determined, eyes down on his notes: 'Today, I'll see what taste comes out here.'",
        no_hookah=True),

    # ── 第4章 ──
    "cg_ch4_dubai_arrival": dict(
        chars=[("naru", "smile", "Naru")], place="indoor", palette="bright warm white, sand beige, pale gold and the soft green of palms", hajime="pov",
        scene="Chapter 4, the arrival hall of Dubai's airport in bright daylight. Naru (23; see his sprite), now the second representative of "
              "Japan, lifts his black hard-shell equipment case with one hand and grins at the viewer: 'Yeah. This time we're in the same venue "
              "from the start.' At the lower edge, Hajime's own hand grips the handle of his own black equipment case. Airy, warm, a little "
              "excited.",
        no_hookah=True),
    "cg_ch4_traveler_chair": dict(from3952=True, chars=[("sheikh", "normal", "the traveler")], place="outdoor", hajime="pov", no_hookah=True),
    "cg_ch4_festa_welcome": dict(from3952=True, chars=[("da_silva", "excited", "Taiyo"), ("naru", "normal", "Naru")], place="indoor",
                                 palette="festive green, warm yellow, red and turquoise bunting colors", hajime="pov",
                                 note="Naru, if shown, is only his back or shoulder at a side edge, in his sprite's brown-and-beige jacket."),
    "cg_ch4_traveler_tongs": dict(from3952=True, chars=[("sheikh", "normal", "the traveler")], place="indoor",
                                  palette="warm old lamp light, sand-colored plaster and dark old wood", hajime="pov",
                                  note="The traveler's hair under the hood is dark (black with a little grey), matching the sprite's dark, neatly trimmed beard; not blond, not ash grey."),
    "cg_ch4_creek_dhow": dict(from3952=True, chars=[], place="outdoor", hajime="pov", no_hookah=True),
    "cg_ch4_noor_pencil_x": dict(from3952=True, chars=[("noor", "smile", "Noor")], place="indoor",
                                 palette="warm sandstone, faded turquoise and bright daylight", hajime="pov", no_hookah=True),
    "cg_ch4_sheikh_reveal": dict(from3952=True, chars=[("sheikh", "serious", "the Sheikh"), ("naru", "serious", "Naru")], place="indoor",
                                 palette="dark audience shadow with warm gold spotlights", hajime="pov",
                                 note="In the vertical frame: the Sheikh standing at the far station is the clear focus in the upper half; Naru only as a shoulder at a side edge."),
    "cg_ch4_world_handshake": dict(
        chars=[("naru", "smile", "Naru")], place="indoor", palette="warm gold stage light and dark audience shadow", hajime="pov",
        hookah="人物      : なる（握手）。奥に決勝の他の2人（ぼけ・小さく）\n"
               "場面      : 完成・喫煙（決勝の台がまだ煙を上げている）\n"
               "台の型    : 日本の店の業務用。ステンレスの細いステム＋幅の広いガラスベース。奥の作業台の上\n"
               "HMD       : シリコンボウル＋ロータス型HMD（蓋あり）。奥でぼけているので形だけ\n"
               "炭        : HMDの中（見えない）\n"
               "ホース    : 各台1本。作業台の上に置かれたハンドルへ\n"
               "吸い口    : ハンドル先端に使い捨てチップ\n"
               "構図      : 一人称。手前ではじめの手となるの握手、腰から上のなる。台は奥で小さくぼける",
        scene="Chapter 4, the world final in Dubai has just ended and Hajime has won. On the stage, Naru (23; see his sprite) grips Hajime's hand "
              "firmly in a handshake (Hajime's hand and black hoodie sleeve come from the lower edge), with a frustrated but warm grin: 'This was "
              "my best, damn it. Congratulations. Next time, I'm taking it.' Behind him, far and out of focus, the other finalists' stations with "
              "their hookahs still sending up thin smoke, and the cheering hall as dim shapes under golden stage light."),
    "cg_ch4_young_sumi_water": dict(from3952=True, chars=[("sumi", "normal", "young Sumi")], place="indoor",
                                    palette="faded warm late-afternoon light, sand plaster and old wood", hajime="none", no_hookah=True),

    # ── 第5章 ──
    "cg_ch5_shisha_9000": dict(
        chars=[("shisha_9000", "normal", "SHISHA-9000"), ("dr_kemuri", "normal", "Dr. Charcoal")], place="indoor", palette=LAB, hajime="pov",
        hookah="人物      : SHISHA-9000（台の向こうに立つ）、チャコール博士（横）\n"
               "場面      : 準備中（ボウル未装着）\n"
               "台の型    : 日本の店の業務用。ステンレスの細いステム＋幅の広いガラスベース。白い実験台の上に同型2台\n"
               "HMD       : なし（未装着）\n"
               "炭        : なし\n"
               "ホース    : 各台1本。側面ポートから出て台の上に巻かずに置く（ハンドルは台の上）\n"
               "吸い口    : なし\n"
               "構図      : 一人称。台は手前の実験台、受け皿とステム上部が写る。ステムの先は小さな凸型の金属ポストだけ",
        scene="Chapter 5, SMOKE LAB, Dr. Charcoal's research room on the day of the final match: white, clean and bright. Behind a white lab "
              "table stands SHISHA-9000, a white humanoid robot exactly as its sprite, facing the viewer with its head slightly tilted as if "
              "scanning; a small blank inspection tag hangs at the seam at the base of its neck. Dr. Charcoal (38; see his sprite) stands to one "
              "side holding a tablet, watching the viewer's reaction with interest. On the table between them and the viewer: two identical "
              "hookahs, not yet assembled.",
        note="Hookah state: no bowls, no HMD, no coals and no foil; each stem ends in a small convex metal post."),
    "cg_ch5_adam_two_bowls": dict(from3952=True, chars=[("adam", "serious", "Adam")], place="indoor",
                                  palette="warm dark wood, deep red and apple green accents, low warm lamps", hajime="pov"),
    "cg_ch5_tsumugi_serves_hajime": dict(from3952=True, chars=[("tsumugi", "baito_smile", "Tsumugi")], place="indoor",
                                         palette=TONARI + ", soft daylight", hajime="pov"),
    "cg_ch5_doctor_yunomi": dict(from3952=True, chars=[("dr_kemuri", "normal", "Dr. Charcoal")], place="indoor",
                                 palette=TONARI + ", soft daylight", hajime="pov", no_hookah=True),
    "cg_ch5_regular_hose_lap": dict(from3952=True, chars=[], place="indoor", palette=LAB, hajime="pov"),
    "cg_ch5_cocreation_notes": dict(from3952=True, chars=[("dr_kemuri", "serious", "Dr. Charcoal"), ("shisha_9000", "normal", "SHISHA-9000")],
                                    place="indoor", palette="clean white and pale grey with half the lights off, cool shadow", hajime="pov"),
    "cg_ch5_sumi_pulls_chair": dict(from3952=True, chars=[("sumi", "smile", "Sumi")], place="indoor", palette=TONARI, hajime="pov", no_hookah=True,
                                    note="In the vertical frame Sumi and the chair are the subject, close enough that Sumi is seen from the waist up. His face is clearly visible under the cap brim (not hidden in shadow), looking at the viewer with a small warm smile."),
    "cg_ch5_party_toast": dict(from3952=True, chars=[("sumi", "smile", "Sumi"), ("naru", "excited", "Naru")], place="indoor", palette=TONARI,
                               hajime="pov", no_hookah=True),
    "cg_ending_tonari_night": dict(
        chars=[("sumi", "smile", "Sumi")], place="indoor", palette=TONARI, hajime="pov",
        scene="Ending, tonari after closing, some days after the final match. Sumi (46; black flat cap, square black glasses, short beard, "
              "dark charcoal shirt with rolled sleeves, brown waist apron), who has dropped by, is placing washed glasses upside down in a row on "
              "a folded towel on the wooden counter without being asked, one glass still in his hand. Relaxed, eyes down on the glasses, a quiet "
              "half-smile. The viewer stands across the counter.",
        no_hookah=True),

    # ── 告白 ──
    "cg_ageha_confession": dict(
        chars=[("ageha", "smile", "Ageha"), ("hajime", "normal", "Hajime")], place="outdoor", hajime="back",
        scene="Confession accepted, night, a quiet back alley just off the shopping street, brick walls and warm amber street lamps against deep "
              "navy night. Ageha (22; the same bright, friendly, youthful face as her sprite) said 'Bend down a bit. I wanna mess up your hair', "
              "and Hajime has leaned down toward her. She reaches up and ruffles his black hair with one hand (his cap is off, in his hand), "
              "laughing out loud with her eyes closed in pure delight. Hajime is seen from behind and the side at a near edge, his face hidden; "
              "Ageha's laughing face is the focus.",
        no_hookah=True),
    "cg_hiyori_confession": dict(
        chars=[("hiyori", "love_blush", "Hiyori"), ("hajime", "normal", "Hajime")], place="outdoor", hajime="back",
        scene="Confession accepted, walking home at night down a quiet Japanese shopping street with warm shop lights against a deep navy sky. "
              "Hiyori (25; pink-brown hair in a high ponytail, light brown eyes, white short-sleeved blouse with a lace front, black high-waist "
              "slacks, small black handbag) has just said 'I like you too', and her usual fragile, distant act has fallen apart: one hand touches "
              "her hair by her ear, her cheeks are flushed, and she smiles a flustered, truly happy smile with slightly teary eyes, looking up at "
              "Hajime ('I can't be fragile, my heart is way too loud!'). Hajime is only his shoulder and the back of his head in the black cap at "
              "a near edge, face hidden.",
        no_hookah=True),
    "cg_mashiro_confession": dict(
        chars=[("mashiro", "smile", "Mashiro"), ("hajime", "normal", "Hajime")], place="indoor",
        palette="warm afternoon cream, soft beige and muted sage green in gentle daylight", hajime="back",
        scene="Confession accepted, a quiet holiday afternoon; the two of them sit side by side on a low sofa with cushions. Mashiro (22; pale "
              "ash-blonde hair in two long braids, sleepy half-lidded golden eyes, beige oversized knit cardigan over a white blouse with a small "
              "ribbon tie, long sage-green skirt) leans her head on Hajime's shoulder and hugs his arm with both of her arms, her cheek against "
              "his upper arm, looking up at him with a melting, sleepy, blissful smile ('Is it heavy?'). Hajime is only his shoulder, upper arm "
              "and the side of his torso in the black hoodie at a side edge, his face out of frame.",
        no_hookah=True),
    "cg_minto_confession": dict(
        chars=[("minto", "ura_smile", "Shiori (Minto, in her private clothes)"), ("hajime", "normal", "Hajime")], place="outdoor", hajime="back",
        scene="Confession accepted, a quiet riverside walking path in a Japanese city at night. Shiori, the woman who works as Minto (long straight "
              "black hair with blunt bangs, green eyes, cream cable-knit cardigan over a black lace-trimmed top, small green pendant, long dark "
              "skirt, black shoulder bag with a mint-green heart charm; no horns, no wings), clings to Hajime's upper arm with both hands near her "
              "chest and looks up at him, her eyes wet with tears and a relieved, tender, shy smile, cheeks flushed: 'Yes... I'm so happy.' Tender "
              "and restrained, not crying hard. Hajime is only his near shoulder and arm in the black hoodie at a side edge. Behind her: a river "
              "railing and a few distant lights reflected in dark water, simple.",
        no_hookah=True),
    "cg_rio_confession": dict(
        chars=[("rio", "smile", "Rio")], place="outdoor", hajime="pov",
        scene="Confession accepted, after closing time in a Japanese wholesale district at night, metal roller shutters down along a narrow "
              "street. Rio (27; see her sprite: long layered dark hair, white shirt with sleeves rolled to the elbows, black slacks, silver hoop "
              "earrings) has stopped under a street lamp after Hajime said he will come to see her because he likes her, not for the sampling "
              "work. Her cool, teasing expression has softened into a small, vulnerable, happy smile with a slight blush, looking straight at the "
              "viewer. One hand at mid-chest holds a single narrow blank ivory perfume testing strip (flat thin paper, finger length; not a "
              "cigarette, no smoke); the other arm holds a slim dark notebook against her side.",
        no_hookah=True),
    "cg_samechan_confession": dict(
        chars=[("samechan", "smile", "Same-chan")], place="outdoor", hajime="pov",
        scene="Confession accepted, night, a small detour on the way to the station near her shop, a quiet shopping street with warm shop lights. "
              "Same-chan (20; see her sprite: black hair with vivid blue inner color, blue eyes, black hooded jacket with a shark-fin hood) wears "
              "her shark puppet Koro-chan (a blue shark plush with a small gold crown and a navy bowtie with a gold star, toothy grin) on her "
              "right hand, held against her chest, and with her left hand she holds the viewer's hand (Hajime's hand in a black hoodie sleeve "
              "from the lower edge), squeezing it. She blushes, eyes shining, with a delighted smile showing her small fang: 'So the story goes "
              "on tomorrow too, right?'",
        no_hookah=True),
    "cg_tsumugi_confession": dict(
        chars=[("tsumugi", "normal", "Tsumugi"), ("hajime", "normal", "Hajime")], place="outdoor", hajime="back",
        scene="Confession accepted, walking home at night down a narrow Japanese shopping lane with warm amber shop lamps and a dark blue sky. "
              "Tsumugi (21; short straight chestnut bob, brown eyes, purple zip hoodie with small embroidered flowers, black pleated skirt, dark "
              "knee-high socks) has stopped after Hajime's confession: head slightly lowered but her gaze lifted toward him, eyes a little wet, a "
              "tiny relieved smile breaking through her blush ('...Me too'). With one hand she timidly pinches the lower hem of Hajime's black "
              "hoodie at his waist (a small pulled fold of fabric); her other arm holds her dark tablet against her side. Hajime is seen from "
              "behind at a near edge (black cap, back of his head, shoulder), face hidden.",
        no_hookah=True),
    # ── 追加のスチル（VPT10・VPT11）。オーナー「最近追加したシーンはまだスチルがないのもあるので　ヌールとか新目やキャラだったりつむぎのバイトとか」
    #    「恋愛描写でヒロインたちの可愛い姿をあと何枚か見たい」。本編の台本には、まだ show_cg を入れていない（試作のスチルの場面で、出す台詞つきで見る） ──
    "cg_noor_confession": dict(
        new=True, chars=[("noor", "smile", "Noor")], place="outdoor", hajime="pov", no_hookah=True,
        scene="Confession accepted, Dubai, on the crest of a sand dune at sunset. Noor (27; see her sprite: tanned skin, black hair loosely tied "
              "back, a thin beige sand scarf around her neck, khaki outdoor shirt with rolled sleeves, sunglasses pushed up on her head) sits on "
              "the sand beside the viewer, knees drawn up. Her little finger has hooked the viewer's little finger and now she holds his whole "
              "hand (Hajime's hand in a black hoodie sleeve from the lower edge), fingers laced, resting on the sand between them. She leans "
              "toward the viewer with a bright, teary, happy smile and flushed cheeks: 'Not a pinky promise. This. Because from today we're "
              "lovers.' The sun is sinking behind the dunes, long orange light, wind lifting a strand of her hair."),
    "cg_hiyori_lover_shoulder": dict(
        new=True, chars=[("hiyori", "love_blush", "Hiyori"), ("hajime", "normal", "Hajime")], place="indoor",
        palette="dim warm lamp light, soft navy night shadow and a little beige", hajime="back", no_hookah=True,
        scene="Lovers, late at night in Hajime's small apartment after Hiyori's office work. They sit side by side on a low sofa. Hiyori (25; see "
              "her sprite: pink-brown hair in a high ponytail, white short-sleeved blouse with a lace front, black high-waist slacks, gold drop "
              "earrings, a slim wristwatch) has leaned her head on Hajime's shoulder, eyes closed, a small soft contented smile and a faint "
              "blush; the tip of her ponytail brushes his neck ('Hold on to me. Lend me your shoulder for five minutes'). Hajime is only his "
              "shoulder, arm and the side of his black hoodie at a side edge, face out of frame. Her hand rests loosely on his sleeve."),
    "cg_ageha_shaky_hand": dict(
        new=True, chars=[("ageha", "sad", "Ageha")], place="outdoor", hajime="pov", no_hookah=True,
        scene="The night before the tournament, a little away from the lights of a row of festival food stalls (warm lanterns softly blurred "
              "behind). Ageha (22; the same bright, friendly, youthful face as her sprite) holds out her open palm toward the viewer so he "
              "can photograph it with her phone: 'Take a picture of my hand. My shaking hand.' Her fingertips tremble slightly (two or three "
              "tiny motion lines), and she looks at the viewer over her hand with an embarrassed, vulnerable, honest little smile and pink "
              "cheeks. In the lower corner, Hajime's hand holds her pink phone up toward her palm (the screen shows only a blurry shape)."),
    "cg_samechan_theater": dict(
        new=True, chars=[("samechan", "surprise", "Same-chan")], place="indoor",
        palette="dark theater navy with the cold blue-white flicker of a screen", hajime="pov", no_hookah=True,
        scene="An outing, a tiny old cinema showing a marathon of shark movies, in the middle row. During a scary scene where a shark bites, "
              "Same-chan (20; see her sprite) has raised her blue shark plush Koro-chan in front of her face like a shield; only her wide "
              "blue eyes peek over the plush's head, cheeks a little pale, shoulders hunched, while Koro-chan grins at the screen. Seen from "
              "the seat beside her, the viewer's side, lit by the flickering blue-white light of the screen. Cute and funny."),
    "cg_minto_epilogue": dict(
        new=True, chars=[("minto", "ura_smile", "Shiori (Minto, in her private clothes)"), ("hajime", "normal", "Hajime")], place="indoor",
        palette="warm kitchen lamp light, cream and soft green", hajime="back", no_hookah=True,
        scene="Epilogue, late at night in Shiori's small tidy apartment after she closed the café; the two of them are cooking a late dinner "
              "together. Shiori (her private self: long straight black hair with blunt bangs, green eyes, cream cable-knit cardigan over a "
              "simple black top, small green pendant; no horns, no wings) has just handed Hajime a small tasting plate and leans her forehead "
              "on his shoulder, eyes half closed, a soft, sleepy, spoiled smile ('Spoil me a little'). Hajime is only his shoulder and arm "
              "in a black hoodie at a side edge, holding the small plate. A pot gently steams on the stove behind, softly blurred."),
    "cg_tsumugi_epilogue": dict(
        new=True, chars=[("tsumugi", "smile", "Tsumugi")], place="indoor", palette=TONARI + ", soft evening light", hajime="pov", no_hookah=True,
        scene="Epilogue, tonari after closing, quiet. Tsumugi (21; see her sprite: short chestnut bob, brown eyes, purple zip hoodie with "
              "small embroidered flowers) sits across a small table from the viewer. She has closed her sketchbook ('The next page. You can't "
              "look yet') and placed the viewer's hand on top of its cover, her own small hands resting over it. She looks up with a shy, "
              "warm, happy smile and a faint blush: 'Today I'll take a break from drawing.' Hajime's hand (black hoodie sleeve) comes from "
              "the lower edge."),
    "cg_noor_epilogue": dict(
        new=True, chars=[("noor", "smile", "Noor")], place="indoor", palette=TONARI + ", warm evening light", hajime="pov", no_hookah=True,
        scene="Epilogue, evening at tonari in Japan. The door has just opened and a big travel suitcase rolled in first; behind it Noor (27; "
              "see her sprite, with a light travel jacket over her khaki shirt) stands in the doorway, one hand still on the suitcase handle, "
              "the other raised in a little wave, beaming with excitement and a bit of disbelief: 'Hajime! I came. ...I really came.' Her "
              "eyes sparkle, a strand of hair out of place from the long trip."),
    "cg_rio_epilogue": dict(
        new=True, chars=[("rio", "smile", "Rio")], place="indoor", palette="dim cool grey showroom light with a warm desk lamp", hajime="pov",
        no_hookah=True,
        scene="Epilogue, Rio's fragrance showroom after closing. Rio (27; see her sprite: long layered dark hair, white shirt with sleeves "
              "rolled up, black slacks, silver hoop earring) holds out a small folded slip of paper to the viewer between two fingers, a "
              "calm, knowing, slightly shy smile, looking straight at the viewer ('My ring size. I measured it.'). Her other hand rests on "
              "the edge of a desk. The paper shows only a tiny unreadable mark. Intimate and quiet."),
    "cg_hiyori_axe": dict(
        new=True, chars=[("hiyori", "axe_laugh", "Hiyori"), ("maki", "smile", "Maki")], place="indoor",
        palette="warm amber spotlights, dark wood and a little red", hajime="pov", no_hookah=True,
        scene="An axe-throwing bar at night. Hiyori (25; see her sprite) has just thrown and her axe is stuck right at the edge of the small "
              "blue ring of a round wooden target in the background. She stands in the throwing lane with one fist thrown up high, mouth wide "
              "open in a huge, hearty, triumphant shout and laugh ('YESSS! Blue, it went in!! Did you see that!?'), ponytail swinging: the "
              "fragile act completely gone. Behind her, small and softly blurred, Maki (the bar's instructor; see her sprite) grins with her "
              "arms crossed. The axe and target are clean and simple, no blood, no danger."),
    "cg_noor_hagal": dict(
        new=True, chars=[("noor", "normal", "Noor")], place="indoor", palette="warm sandstone, faded turquoise and bright afternoon light",
        hajime="pov", no_hookah=True,
        scene="Chapter 4, early afternoon at Cafe Oasis, Noor's father's cafe. Noor (27; see her sprite) has unwrapped a cloth bundle and "
              "holds out, with both hands, a small, old, darkened unglazed clay shisha bowl (a cup on a slim neck, small enough to sit in her "
              "palms) toward the viewer's open hands at the lower edge. Her face is gentle and a little shy: this was the bowl her father "
              "taught her with when she was fourteen. Only the bowl: no hookah, no coals, no foil."),
    "cg_ch5_tsumugi_chalkboard": dict(
        new=True, chars=[("tsumugi", "baito_smile", "Tsumugi (working)")], place="outdoor", hajime="none", no_hookah=True,
        scene="Chapter 5, the morning before opening, in front of tonari. Tsumugi (21; in her shop work clothes exactly as her sprite: purple "
              "zip hoodie with a plain brown waist apron) crouches in front of a standing chalkboard sign by the shop entrance, chalk in hand, "
              "drawing a cat with leaf-shaped ears whose tail turns into a ribbon of smoke curling around three blank lines (the menu lines are "
              "only wavy chalk strokes, no letters). Her expression is focused with a small proud smile. Behind her, two or three passers-by "
              "have stopped to look, small and soft. Soft morning light on a quiet shopping street."),
    "cg_ch5_tsumugi_sendoff": dict(
        new=True, chars=[("tsumugi", "baito_smile", "Tsumugi (working)")], place="outdoor", hajime="pov", no_hookah=True,
        scene="Chapter 5, the morning of the final match, in front of tonari with its shutter half down for the day off. Tsumugi (in her purple "
              "hoodie and brown apron) crouches beside the chalkboard sign, where a chalk cat with leaf ears holds tongs and faces forward "
              "(no letters on the board, only the drawing and a few blank wavy strokes). She looks up at the viewer with a calm, steady, warm "
              "smile, one hand on her knee: 'See you later, Hajime-san.' Clear morning light."),
    "cg_ending_shutter": dict(
        new=True, chars=[("tsumugi", "baito_normal", "Tsumugi (working)")], place="outdoor", hajime="none", no_hookah=True,
        scene="Ending, night, the front of tonari seen from across the narrow street. Tsumugi, seen from behind (purple hoodie, brown apron "
              "strings, short chestnut bob), pulls the metal shutter down, leaving exactly one warm entrance lamp lit above the door. A ring "
              "of keys hangs from her apron pocket. The street is quiet and dark blue; the single lamp glows. A calm, handed-down feeling."),
    "cg_ch4_camel_watch": dict(
        new=True, chars=[("faris", "smile", "Faris"), ("khalil", "normal", "Khalil")], place="outdoor", hajime="pov", no_hookah=True,
        scene="Chapter 4, early morning at a camel race track in the Dubai desert. The viewer rides in the back seat of a white SUV driving "
              "along the track beside the racing camels (each camel carries a small boxy robot jockey, no human rider). In the front seat, "
              "Faris (24; see his sprite, here in a light grey work jacket over his clothes) turns around and shows a tiny remote control like a "
              "car key in his hand, grinning. At the wheel side, Khalil (56; see his sprite: white kandura, old sand-colored vest, a loosely "
              "wrapped red-and-white checked ghutra) leans his arm out of the open window and shouts toward the camels. Sand dust, golden "
              "low sun, motion."),
    "cg_ch3_yoru_playlist": dict(
        new=True, chars=[("yoru", "normal", "Yoru"), ("mukai_master", "normal", "Mukai")], place="indoor", palette=MUKAI_DAY,
        hajime="none", no_hookah=True,
        scene="Chapter 3, mukai before opening, late morning. At a small table, Yoru (41; see her sprite: black short bob with a silver "
              "streak, big black headphones around her neck, black oversized bomber jacket) sits with her eyes closed, listening, a cup of "
              "sweet tea steaming in front of her. Across from her, Mukai (48; see his sprite: brown fedora, brown suit jacket, trimmed "
              "beard) taps the beat softly on the table with one finger, a sheet of paper with a hand-written song list (unreadable lines) "
              "under his other hand. Quiet, the music drifting from morning toward night."),
    "cg_ch3_steve_timer": dict(
        new=True, chars=[("steve", "serious", "Steve")], place="indoor", palette="warm diner amber, red leather and checkered black-and-white",
        hajime="pov", no_hookah=True,
        scene="Chapter 3, Smoke & Glory, Steve's shisha diner in Tokyo. Behind the counter, Steve (30; see his sprite: round build, vintage "
              "glasses, short dark hair and beard, colorful retro camp shirt, dark work apron) has just turned over the small analog kitchen "
              "timer he kept face-down and looks at its dial once, then lets out a small breath, his eyes soft and a little humbled. The tiny "
              "timer sits in his large hand in the center of the picture. The customer he is watching is only a soft out-of-focus shape at the "
              "far end of the counter."),
    "cg_ch3_volk_jam": dict(
        new=True, chars=[("volk", "normal", "Volk")], place="indoor", palette="cool steel grey, dark slate and a warm table lamp", hajime="pov",
        no_hookah=True,
        scene="Chapter 3, Volk's shop 'Iron Smoke', after hours. Volk (37; see his sprite: short pale blond hair, sharp face, black turtleneck, "
              "dark coat) sits at a small table across from the viewer with two glasses of black tea and a small dish of jam, Russian style. "
              "Without looking at the cloth-covered wall of gauges behind him, he licks a little jam from a teaspoon, his usually cold face "
              "relaxed and almost gentle. The viewer's hand holds the same kind of teaspoon at the lower edge."),
    "cg_ch4_longlong_pipe": dict(
        new=True, chars=[("master_hookah", "normal", "Wang Yanlou")], place="indoor", palette="deep red lacquer, dark wood and warm lantern gold",
        hajime="pov", no_hookah=True,
        scene="Chapter 4, the counter of Longlong's water-pipe house in Dubai. Wang Yanlou (58; see his sprite: long white hair in a single "
              "braid, long white beard, crimson high-collared jacket) holds a small Chinese brass water pipe (a hand-held shuiyandai with a "
              "slim curved stem and a small water chamber, NOT a hookah, no hose) and draws on it with his eyes closed, shoulders slowly "
              "lowering in relaxation. A cup of tea beside him. A thin curl of smoke leaves his lips."),
    "cg_ch3_emil_seal": dict(
        new=True, chars=[("emil", "serious", "Emil")], place="indoor", palette="warm workshop wood, brass and soft daylight", hajime="pov",
        hookah="人物      : エミル（継ぎ目に耳を寄せ、一口だけ空気を吸う）\n"
               "場面      : 準備中（ボウル未装着）。修理した古い台の空気漏れを確かめる\n"
               "台の型    : トルコの古いナルギレ（真鍮のステム・控えめな装飾・ガラスのベース）\n"
               "HMD       : なし\n"
               "炭        : なし\n"
               "ホース    : 1本。側面ポート → エミルが口元に当てる硬いハンドル\n"
               "吸い口    : なし\n"
               "構図      : 作業台越しに、台の上部とエミルの横顔",
        scene="Chapter 3, a repair workshop event in Tokyo. Emil (48; see his sprite: thick mustache, short dark hair with grey temples, a smart "
              "vest and rolled-up shirt sleeves) has just fitted a new rubber seal into an old Turkish narghile on the workbench. He leans his "
              "ear close to the joint below the top of the stem, eyes narrowed in concentration, and takes a single test draw from the hose "
              "handle to check that no air leaks. The viewer's hands rest on the workbench at the lower edge."),
    "cg_ch5_taiyo_chair": dict(
        new=True, chars=[("da_silva", "excited", "Taiyo")], place="outdoor", hajime="pov", no_hookah=True,
        scene="Chapter 5, the courtyard of the Sheikh's mansion by a fountain. Taiyo da Silva (28; see his sprite: tanned, dark curly hair, open "
              "tropical-print shirt) has just spun a single chair around toward the viewer with a flourish, grinning hugely; servants peek from "
              "behind the arcade pillars clapping in rhythm. On the chair seat sit a small unglazed clay shisha bowl and a glass of water (only "
              "the bowl: no hookah, no coals). Bright sun, fountain spray sparkling a little (no glitter particles)."),
    "cg_ch3_kuraudo_live": dict(
        new=True, chars=[("rei", "normal", "Kuraudo")], place="indoor", palette="dark live-house shadow with deep red and violet stage light",
        hajime="pov", no_hookah=True,
        scene="Chapter 3, a packed small live house, at the very back by the wall. The last note of the last song has just faded; the whole "
              "crowd stands silent, nobody clapping yet. Kuraudo (25; see his sprite: layered black hair with deep burgundy streaks, visual-kei "
              "black and red jacket, neck tattoos) stands right next to the viewer, shoulder almost touching, eyes closed, holding his breath, "
              "a faint moved smile. The stage far ahead is a blur of red light; the crowd is dark silhouettes."),
    "cg_outing_rio_beans": dict(
        new=True, chars=[("rio", "normal", "Rio")], place="indoor", palette="warm coffee brown, cream and soft daylight", hajime="pov",
        no_hookah=True,
        scene="Chapter 1, an outing to a small coffee bean shop at noon, the air full of roasted sweetness. Rio (27; see her sprite: long "
              "layered dark hair, white shirt with sleeves rolled up, black slacks) has opened a glass jar of coffee beans and brings it close "
              "to her nose, eyes closed, completely focused, exactly like she tests fragrances. Several jars stand on the counter in front of "
              "her (labels blank). The viewer stands beside her, holding her shopping bag at the lower edge."),
    # ── 好感度イベントの締めくくり（VPT16。オーナー「好感度イベントの最後にみんなスチル欲しい　内容に合わせて」）。
    #    ヴォルク・王煙楼・ヌール・太陽は VPT07 の案（cg_ch3_volk_jam・cg_ch4_longlong_pipe・cg_noor_hagal・cg_ch5_taiyo_chair）がそのまま締めくくり ──
    "cg_bond_sumi": dict(
        new=True, chars=[("sumi", "smile", "Sumi")], place="indoor", palette=TONARI + ", only the warm lamps after closing", hajime="pov", bowl_only=True,
        scene="Sumi's bond finale, tonari after closing, the door locked. Today Hajime made Sumi a hookah and Sumi was the customer. Now Sumi "
              "(46; black flat cap, square black glasses, short beard, dark charcoal shirt with rolled sleeves, brown waist apron) sits on a "
              "counter stool turned toward the viewer and holds out, on his open palm, an old unglazed clay bowl with rounded, worn edges and a "
              "darker color than new ones: the bowl he has smoked cardamom in after closing for years. A small box of cardamom flavor sits "
              "beside it on the counter. His face is gruff but soft, a small rare smile: 'Take it.' The viewer's hand reaches in from the "
              "lower edge toward the bowl."),
    "cg_bond_naru": dict(
        new=True, chars=[("naru", "smile", "Naru")], place="indoor", palette="dark green, warm pendant-lamp amber and dark wood", hajime="pov",
        bowl_only=True,
        scene="Naru's bond finale at KEMURIKUSA, his small shisha shop. Across the counter, Naru (23; see his sprite) bumps his fist against "
              "the viewer's fist (Hajime's fist in a black hoodie sleeve from the lower edge), grinning like an equal, not a teacher: 'We check "
              "each other's smoke from now on.' On the counter between them sits a plain unglazed clay bowl whose rim has turned the color of "
              "baked sweets, with no wrapping. Warm and bright."),
    "cg_bond_adam": dict(
        new=True, chars=[("adam", "smile", "Adam")], place="indoor", palette="warm dark wood, deep red and apple green accents, low warm lamps",
        hajime="pov", bowl_only=True,
        scene="Adam's bond finale at EDEN, his apple-themed shisha shop. Adam (28; see his sprite: hair red on the screen-left side and green "
              "on the screen-right side) theatrically raises, with both hands like a holy grail, a cloth that is falling open to reveal an old "
              "unglazed clay bowl with a chipped rim ('the sacred chalice of a thousand double-apple nights'). His face is grand and proud with "
              "a dramatic glint, but sincere. Under one arm he holds a thick hand-made stapled booklet (its cover blank or unreadable). Funny "
              "and warm."),
    "cg_bond_tsumugi": dict(
        new=True, chars=[("tsumugi", "smile", "Tsumugi")], place="indoor", palette=TONARI + ", near closing time", hajime="pov", bowl_only=True,
        scene="Tsumugi's bond finale, tonari near closing, only Tsumugi left at the last table. Tsumugi (21; see her sprite: chestnut bob, "
              "purple zip hoodie with embroidered flowers) sits with her dark tablet open on the table, showing her finished painting of a cat "
              "with leaf-shaped ears and a smoke tail curled up on tonari's counter (painted loosely, no text). On her lap she has unwrapped a "
              "small amber-toasted unglazed clay bowl and holds it out toward the viewer with both hands, a shy, warm smile and a faint blush: "
              "'The smoke in the picture rose from this bowl.'"),
    "cg_bond_minto": dict(
        new=True, chars=[("minto", "ura_smile", "Shiori (Minto, in her private clothes)")], place="outdoor", hajime="pov", bowl_only=True,
        scene="Minto's bond finale, walking together outside on a quiet tree-lined street in late afternoon light. Shiori (her private self: "
              "long straight black hair with blunt bangs, green eyes, cream cable-knit cardigan over a black lace-trimmed top, small green "
              "pendant, long dark skirt, black shoulder bag with a mint-green heart charm; no horns, no wings) walks beside the viewer and "
              "casually holds out a cloth bundle whose corner is turned back to show a palm-sized unglazed clay bowl ('The one I used at home. "
              "Only mint, ever.'). Her smile is soft and a little shy, eyes on the viewer."),
    "cg_bond_rio": dict(
        new=True, chars=[("rio", "smile", "Rio")], place="indoor", palette="cool grey and white showroom light, black and silver, one warm desk lamp",
        hajime="pov", bowl_only=True,
        scene="Rio's bond finale at the fragrance showroom's work desk. Rio (27; see her sprite) leans on the desk and slides toward the viewer "
              "an unwrapped, well-used unglazed clay bowl stained a deep berry color, with no label or number sticker, one finger still resting "
              "on it ('Not a test sample. A present from me, personally.'). Her usual cool, teasing expression has a little embarrassed warmth "
              "in it. A clipboard and a few blank paper scent strips lie on the desk."),
    "cg_bond_kumicho": dict(
        new=True, chars=[("kumicho", "serious", "Kanzaki")], place="indoor", palette="dark walnut brown, black leather, muted gold leaf and cream marble",
        hajime="pov", bowl_only=True,
        scene="Kanzaki's bond finale at Kanzaki Tobacco Shop. Kanzaki (53; see his sprite) sits on the black leather sofa and, with both hands "
              "and a solemn, formal bow of the head, holds out a clay bowl wrapped in a plain cloth, like offering a ceremonial sake cup between "
              "sworn brothers. The viewer's two hands come from the lower edge to receive it with both hands. On the low table: two small "
              "teacups, one with a dragon pattern. Serious, a little comically dignified, warm underneath."),
    "cg_bond_kuraudo": dict(
        new=True, chars=[("rei", "normal", "Kuraudo")], place="indoor", palette="deep burgundy red, black and a soft warm lamp, a little pale blue",
        hajime="pov", bowl_only=True,
        scene="Kuraudo's bond finale at his visual-kei shisha cafe, at the counter. Kuraudo (25; see his sprite) has just turned over a small "
              "amber-toasted clay bowl that was lying upside down on the counter and slides it toward the viewer with two fingers, eyes "
              "lowered, quietly sincere ('I want to give it to you.'). Beside him a small CD player, and a CD case with a pale dawn-blue cover "
              "(blank, no text) stands propped against it."),
    "cg_bond_samechan": dict(
        new=True, chars=[("samechan", "smile", "Same-chan")], place="indoor", palette="deep ocean blue, aqua and one dim warm lamp, half the lights off",
        hajime="pov", bowl_only=True,
        scene="Same-chan's bond finale at SHISHARK after closing, half the lights turned off. Same-chan (20; see her sprite, her shark puppet "
              "Koro-chan on her right hand) sits in her usual seat and has unwrapped a small cloth bundle on the table: a still pure-white "
              "unglazed clay bowl, never used. She holds it out toward the viewer with her left hand, a shy, earnest smile, while Koro-chan "
              "peeks over her shoulder ('Grow it with your own shisha.')."),
    "cg_bond_ageha": dict(
        new=True, chars=[("ageha", "smile", "Ageha")], place="indoor", palette="candy pink, raspberry red, cream and a little leopard brown",
        hajime="pov", bowl_only=True,
        scene="Ageha's bond finale at MELTY PUFF, her candy-pink shisha shop. Ageha (22; the same bright, friendly, youthful face as her sprite) "
              "has just come back from the back room and holds up, with both hands and a big 'ta-da!' grin, a white unglazed clay bowl with "
              "a single small bear sticker on its rim ('My white-gummy-bear bowl! My partner since opening day.'). A bag of white gummy bears "
              "on the counter. Bright and cute."),
    "cg_bond_mashiro": dict(
        new=True, chars=[("mashiro", "smile", "Mashiro")], place="indoor", palette=MUKAI_NIGHT, hajime="pov", bowl_only=True,
        scene="Mashiro's bond finale at mukai after closing. Mashiro (22; see her sprite) holds a well-used clay bowl upside down in one hand "
              "and traces its bottom with a fingertip, where three small scratch marks are lined up in a row ('A mark for each day I found just "
              "the right ten percent.'). She looks at the viewer with a sleepy, gentle smile: 'The fourth one, make it with your own hand.'"),
    "cg_bond_ayatori": dict(
        new=True, chars=[("saku", "smile", "Ayatori")], place="indoor", palette="warm red-brown, cream, indigo and soft lamp light", hajime="pov",
        bowl_only=True,
        scene="Ayatori's bond finale at Enmaku, his small pop-up shisha shop. Across the counter, Ayatori (23; see his sprite) holds out, with "
              "both hands on a cloth, an amber-toasted clay bowl that smells of citrus and Earl Grey. His indigo notebook lies open on the "
              "counter at its last page, two columns of hand-written lines (unreadable scribbles). A cup of tea steams in front of the viewer. "
              "His smile is a little uneven and openly friendly: 'I want you to have it.'"),
    "cg_bond_steve": dict(
        new=True, chars=[("steve", "smile", "Steve")], place="indoor", palette="warm diner amber, red leather and checkered black-and-white",
        hajime="pov", bowl_only=True,
        scene="Steve's bond finale at Smoke & Glory, his shisha diner. Behind the counter, Steve (30; see his sprite) props a single recipe "
              "card (covered in small unreadable handwriting) upright on the now-empty top shelf, glancing back at the viewer with a "
              "slightly embarrassed grin ('Hey, don't stare. This is my new lookout.'). On the counter in front of the viewer: a small paper "
              "bag, open, with a chipped clay bowl whose inside is stained faintly yellow, and a tiny analog kitchen timer."),
    "cg_bond_sheikh": dict(
        new=True, chars=[("sheikh", "smile", "the Sheikh (travelling incognito)")], place="indoor",
        palette="warm old lamp light, sand-colored plaster and dark old wood", hajime="pov", bowl_only=True,
        scene="The Sheikh's bond finale, at the small old cafe in a Dubai back alley. The Sheikh sits across a small table from the viewer in "
              "his plain sand-colored travel cloak (hood down; see his sprite for the face; no gold, no agal), a little sand on his sleeve, "
              "with a warm, open, kind smile: 'Hajime. You are my friend.' Between them on the table: a clay bowl whose rim is the color of "
              "ripe grape skins, just taken off the hookah and still warm; the viewer's palm rests gently on it. The old cafe hookah is out of "
              "frame."),
    "cg_bond_hiyori": dict(
        new=True, chars=[("hiyori", "normal", "Hiyori")], place="indoor", palette=TONARI + ", night", hajime="pov", bowl_only=True,
        scene="Hiyori's bond finale at a table at tonari at night. Hiyori (25; see her sprite: pink-brown high ponytail, white blouse with a "
              "lace front, black slacks) pushes a small open gift box across the table toward the viewer. Inside, on tissue paper, is a "
              "small clay bowl with a tiny axe and a leaf carved on its side. She plays her 'fragile, distant lady' act with lowered eyes and a "
              "faint sad smile, but the corners of her mouth are fighting a grin and her cheeks are a little pink ('A quiet, modest bowl, "
              "fitting for fragile me.')."),
    # ── 回想（VPT09）。若い人物は立ち絵の本人を若返らせる。tag の a・b・c で DESIGN を替える ──
    "cg_ch4_young_sumi_water": dict(
        new=True, chars=[("sumi", "normal", "Sumi (to be drawn 15 years younger)"), ("sheikh", "normal", "the Sheikh (to be drawn 15 years younger)")],
        place="indoor", palette="warm late-afternoon light, sand-colored plaster and dark old wood", hajime="none", no_hookah=True, memory=True,
        variants=YOUNG_SUMI,
        scene="Chapter 4, a memory from fifteen years ago, told by the Sheikh: a small old cafe in a Dubai back alley, late afternoon. "
              "Behind the old wooden counter stands young Sumi, 31 years old (he was the runner-up of the world tournament yesterday and is "
              "helping at this cafe): he must look clearly YOUNG, a man in his early thirties with smooth skin and no grey hair, not the "
              "46-year-old of his sprite. He wears a plain dark shirt with rolled sleeves and a borrowed, slightly faded cafe apron. Before "
              "any order is taken, he sets a glass of water down in front of a customer with one hand, quiet and attentive, a little worn "
              "himself. The customer sits slumped on a stool in the near foreground, seen from behind and the side (only the back of his "
              "head, a dusty brown travel cloak with the hood down, and one tired hand on the counter): the Sheikh at about 37, his face "
              "not shown. Sumi is the clear focus, waist-up, in the upper half."),
    "cg_ch4_cigar_bar_friend": dict(
        new=True, chars=[("sheikh", "smile", "the Sheikh (to be drawn about 22 years younger)"), ("sumi", "normal", "Sumi (to be drawn about 23 years younger)")],
        place="indoor", palette=CIGAR_BAR, hajime="none", memory=True, variants=MASTER,
        hookah="人物      : 先代のマスター（通訳）、若いシェイク（台を見せる）、若いスミ（奥の席から身を乗り出す）\n"
               "場面      : 準備中（ボウル未装着）。持ち込んだ異国の台をカウンターに出したところ。火は入れていない\n"
               "台の型    : 異国の台（中東の古い真鍮のステム＋丸いガラスのベース。装飾は控えめ）\n"
               "HMD       : なし\n"
               "炭        : なし\n"
               "ホース    : 1本。側面ポートから出て、カウンターに寝かせた硬いハンドルへ\n"
               "吸い口    : なし\n"
               "構図      : カウンター越し。マスターと若いシェイクが並び、奥の席の若いスミが手前で身を乗り出す",
        scene="Chapter 4, a memory about 22 years ago, told by the Sheikh: a small cigar bar in a Japanese town at night, the old wooden "
              "counter (the same counter that later became tonari's). The young Sheikh, " + YOUNG_SHEIKH_30 + ", has set an exotic brass "
              "hookah from his country on the counter and holds its small clay bowl in one hand, explaining with the other. Beside him "
              "behind the counter, the Master, the owner of the bar and his old friend, leans in and translates with a smile. In the near "
              "foreground at the end of the counter, young Sumi at about 23 (clearly young, smooth skin, no grey hair, no beard; a dark "
              "blazer a little too big for him over a white t-shirt, trying to look grown-up) leans forward from the back seat, chin on his "
              "hand, eyes shining with curiosity. A cigar rests in an ashtray. Warm, intimate, a little nostalgic."),
    "cg_ch4_master_keys": dict(
        new=True, chars=[("sumi", "normal", "Sumi (to be drawn about 20 years younger)")],
        place="indoor", palette=CIGAR_BAR + ", the lamps half off", hajime="none", no_hookah=True, memory=True, variants=MASTER,
        scene="Chapter 4, a memory about 20 years ago, told by Sumi: the cigar bar on its last night, closing for good because the Master "
              "is ill. The Master, a little thinner and paler than in better days, a cardigan over his usual clothes, stands behind the "
              "old wooden counter and holds out a worn ring of keys to young Sumi (about 26: clearly young, smooth skin, no grey hair, "
              "short black hair, a plain dark jacket), who reaches out with both hands to take it, his face moved and serious. The Master "
              "smiles gently. Chairs are already up on the tables behind them. Quiet and tender, not tragic."),
    "cg_ch4_sensu_first_shisha": dict(
        new=True, chars=[("sumi", "normal", "Sumi (to be drawn about 22 years younger)"), ("sui", "smile", "Sensu (to be drawn about 22 years younger)")],
        place="indoor", palette=CIGAR_BAR + ", late at night", hajime="none", memory=True, variants=YOUNG_SUMI,
        hookah="人物      : 若いスミ（初めての一台を出す）、若い千須（終電を逃した客）\n"
               "場面      : 完成・喫煙（炭を替える途中で、炭を客の袖に落とした瞬間）\n"
               "台の型    : 異国の台（中東の古い真鍮のステム＋丸いガラスのベース。装飾は控えめ）\n"
               "HMD       : ターキッシュリッド（ボウルの口にかぶせる蓋のような金属）\n"
               "炭        : HMDの中に2個、トングからこぼれた1個が千須の袖の上（指先大・灰色・炎なし）\n"
               "ホース    : 1本。側面ポート → 千須が持つ硬いハンドル\n"
               "吸い口    : なし\n"
               "構図      : カウンター越し。左に慌てる若いスミ、右にむせながら笑う若い千須",
        hookah_note=("Hookah look in this picture: an old foreign brass hookah with a round glass base; on its clay bowl sits a Turkish-lid "
                     "type HMD (a simple metal cap with holes that covers the bowl's mouth), small, about half the height of the nearest face."),
        scene="Chapter 4, a memory about 22 years ago, told by Sensu: late at night in the small cigar bar, after the last train. Young "
              "Sensu at about 23 (the same face design as his sprite but clearly young, smooth skin, black hair slicked back without grey, "
              "a cheap dark suit with the tie loosened) sits at the counter holding the hose handle, coughing out smoke and laughing at the "
              "same time, eyes squeezed shut with tears of laughter. Young Sumi at about 24 (clearly young, smooth skin, no grey hair) "
              "stands behind the counter with tongs in his hand, frozen and flustered: a small grey coal has just dropped from the tongs "
              "onto Sensu's suit sleeve, leaving a tiny scorch mark. The foreign brass hookah stands on the counter between them. Funny "
              "and warm: the start of a friendship."),

}

STYLE_REFS = [("minto", "normal"), ("ageha", "normal"), ("rio", "normal"), ("tsumugi", "normal")]

UNSET_NOTE = (
    "This hookah is NOT set up yet: ignore the bowl, HMD and coal parts of the structure rule above. Each stem ends in a small convex "
    "metal post just above the tray; there is no bowl, no HMD, no foil, no coals and no smoke on any hookah in the picture."
)

# 元の横長のスチル（旧版の立ち絵の頃の絵）と新バージョンの立ち絵で服が違う人。試作で、元のスチルの旧い服に引っぱられた（なる・綾取）
OUTFITS = {
    "naru": "Naru's outfit is exactly his new sprite's: a cropped brown-and-beige zip jacket with white stripes on the sleeves over a dark "
            "brown turtleneck, grey wide trousers; NOT the black-and-white track jacket, black t-shirt or dog-tag chains of IMAGE 1.",
    "adam": "Adam's outfit is exactly his new sprite's: a plain WHITE short-sleeved crew-neck t-shirt, a long BLACK waist apron tied at "
            "the waist, black trousers; NOT a black henley shirt (VPT06).",
    "saku": "Ayatori's outfit is exactly his new sprite's: a red-brown pullover hoodie with an ochre-yellow shoulder panel and a cream hood "
            "lining, khaki trousers, a small brown pouch on his belt; NOT the dark jacket of IMAGE 1.",
}


def sprite(folder, face):
    p = NEW / folder / f"chr_{folder}_{face}.webp"
    if not p.exists() or p.stat().st_size < 1000:
        raise SystemExit(f"立ち絵が無い（LFS未取得？）: {p}")
    return p


def build(cg_id):
    s = SCENES[cg_id]
    if s.get("new"):  # 新しく足すスチル（元の横長の絵が無い。VPT07〜）
        refs, lines = [], [FORMAT]
    else:
        refs = [CG / f"{cg_id}.webp"]
        if refs[0].stat().st_size < 1000:
            raise SystemExit(f"元のスチルが LFS 未取得: {refs[0]}")
        lines = [FORMAT, CONTENT_REF]
    present = {c[0] for c in s["chars"]}
    roles = []
    for folder, face, name in s["chars"]:
        refs.append(sprite(folder, face))
        if "younger" in name:  # 回想: 顔の作りだけを借りて、若く描く
            roles.append(f"IMAGE {len(refs)} is the present-day official sprite of {name}: keep only his face design (eye shape, brows, "
                         "nose, mouth and skin tone) so he is recognizably the same person; do NOT copy his present age, wrinkles, grey "
                         "hair, beard, glasses, cap or outfit unless the scene or the design below asks for them.")
        else:
            roles.append(f"IMAGE {len(refs)} is the official sprite of {name}: draw exactly this person (face, eyes, hair, age, build, outfit, accessories).")
    styles = [r for r in STYLE_REFS if r[0] not in present][:2]
    for folder, face in styles:
        refs.append(sprite(folder, face))
    roles.append(f"IMAGES {len(refs) - 1} and {len(refs)} are other official sprites given ONLY as the style target (line weight, cel shading, "
                 "color handling). Do not put these two characters in the picture.")
    lines.append(" ".join(roles))
    if s.get("from3952"):
        scene = scenes_3952()[cg_id]
        text = ("SCENE (written earlier for the landscape version: keep its people, action, props, mood, light and rules, but FORMAT above "
                "replaces its camera and framing sentences, and the BACKGROUND rule below replaces its room description):\n" + scene["scene"])
        eight = scene["eight"]
    else:
        text, eight = "SCENE:\n" + s["scene"], s.get("hookah", "")
    if s.get("note"):
        text += "\n" + s["note"]
    text += "".join("\n" + OUTFITS[c[0]] for c in s["chars"] if c[0] in OUTFITS and "younger" not in c[2])
    if s.get("memory"):
        text += "\n" + MEMORY
        if any(c[0] == "sumi" for c in s["chars"]) and s.get("variants") is not YOUNG_SUMI:
            text += "\n" + YOUNG_SUMI_LOOK
    lines.append(text)
    lines.append(HAJIME[s["hajime"]])
    lines.append(BG_INDOOR.format(palette=s["palette"]) if s["place"] == "indoor" else BG_OUTDOOR)
    lines.append(STYLE)
    if eight or s.get("hookah"):
        lines.append(hookah_text())
        # 準備前（ボウル未装着）の台に、ロータス型の見た目の補足を足すと組み上がった台が描かれる（試作のシェイク登場）
        lines.append(UNSET_NOTE if "未装着" in eight else s.get("hookah_note", HOOKAH_NOTE))
    elif s.get("bowl_only"):
        lines.append(BOWL_ONLY)
    elif s.get("no_hookah"):
        lines.append(NO_HOOKAH)
    lines.append(TEXT_RULE)
    return "\n\n".join(lines), refs, eight


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


def gen(cg_id, tag="01", extra=""):
    prompt, refs, eight = build(cg_id)
    design = SCENES[cg_id].get("variants", {}).get(tag[:1])
    if design:  # 回想の候補（タグの頭の a・b・c）
        prompt += "\n\nDESIGN FOR THIS CANDIDATE: " + design + "."
    if extra:
        prompt += "\n\nREVISION NOTE: " + extra
    WORK.mkdir(parents=True, exist_ok=True)
    stem = WORK / f"{cg_id}-{tag}"
    stem.with_suffix(".prompt.txt").write_text(prompt + "\n\nREFS:\n" + "\n".join(str(r.relative_to(ROOT)) for r in refs) + "\n", encoding="utf-8")
    body, ctype = multipart({"model": MODEL, "prompt": prompt, "size": "1024x1536", "quality": "high", "n": "1"}, refs)
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
            print(f"{cg_id}-{tag}: HTTP {e.code} {msg}", file=sys.stderr)
            if e.code < 500 and e.code != 429:
                raise SystemExit(1)
            time.sleep(20 * (attempt + 1))
    else:
        raise SystemExit(f"{cg_id}-{tag}: 3回失敗")
    stem.with_suffix(".png").write_bytes(base64.b64decode(res["data"][0]["b64_json"]))
    print(stem.with_suffix(".png"), MODEL)


# 採用した絵の一部だけを直す編集（VPT06〜）。入力は originals/<cg_id>.webp と、直す人の立ち絵
EDITS = {
    # オーナー「スチルはたまにはじめの顔が変なのがあった」（VPT08）
    "hajime_face": ([("hajime", "normal"), ("hajime", "smile")],
        "Edit IMAGE 1 only where needed: redraw ONLY the face of Hajime (the young man in the black cap with the white smoke-line "
        "emblem and the black zip hoodie) so that it is exactly the face of his official sprite in IMAGES 2 and 3: a gentle, youthful, "
        "ordinary 22-year-old face, large round soft dark-brown eyes with a calm gaze, a soft rounded jaw (not sharp or angular), a small "
        "nose, black hair whose bangs fall over one eye from under the cap. {mood} Keep his cap, hair outline, head angle, pose, hands, "
        "hoodie and size exactly as they are. Keep everything else exactly the same as IMAGE 1: every other person, the props, the "
        "background, the composition, the lighting and the colors. Same drawing style as IMAGE 1. No text, no UI."),
}
EDIT_MOOD = {
    "cg_ch1_tournament_battle": "Expression: focused and a little tense, eyes looking down at the hose handle, lips closed; NOT scowling, NOT narrow sharp eyes.",
    "cg_minto_cheki": "Expression: an awkward, shy, slightly embarrassed small smile with closed lips or a small open mouth, a little sweat drop; NOT a confident toothy grin, NOT an older mature face.",
}


def edit(cg_id, kind, tag):
    sprites, text = EDITS[kind]
    refs = [HERE / "originals" / f"{cg_id}.webp"] + [sprite(f, face) for f, face in sprites]
    prompt = text.format(mood=EDIT_MOOD.get(cg_id, ""))
    WORK.mkdir(parents=True, exist_ok=True)
    stem = WORK / f"{cg_id}-{tag}"
    stem.with_suffix(".prompt.txt").write_text(f"## 編集（{kind}）\n\n" + prompt + "\n\nREFS:\n" + "\n".join(str(r.relative_to(ROOT)) for r in refs) + "\n", encoding="utf-8")
    body, ctype = multipart({"model": MODEL, "prompt": prompt, "size": "1024x1536", "quality": "high", "n": "1"}, refs)
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, method="POST")
    req.add_header("Content-Type", ctype)
    if os.environ.get("OPENAI_API_KEY"):
        req.add_header("Authorization", f"Bearer {os.environ['OPENAI_API_KEY']}")
    with urllib.request.urlopen(req, timeout=900) as r:
        res = json.loads(r.read())
    stem.with_suffix(".png").write_bytes(base64.b64decode(res["data"][0]["b64_json"]))
    print(stem.with_suffix(".png"))


def adopt(cg_id, tag, append=False):
    from PIL import Image
    src = WORK / f"{cg_id}-{tag}.png"
    im = Image.open(src).convert("RGB")
    (HERE / "originals").mkdir(exist_ok=True)
    GAME_OUT.mkdir(parents=True, exist_ok=True)
    im.save(HERE / "originals" / f"{cg_id}.webp", "WEBP", quality=95, method=6)
    im.save(GAME_OUT / f"{cg_id}.webp", "WEBP", quality=84, method=6)
    prompts = HERE / "prompts"
    prompts.mkdir(exist_ok=True)
    rec = src.with_suffix(".prompt.txt").read_text(encoding="utf-8")
    old = (prompts / f"{cg_id}.txt").read_text(encoding="utf-8") + "\n\n" if append and (prompts / f"{cg_id}.txt").exists() else ""
    (prompts / f"{cg_id}.txt").write_text(old + rec, encoding="utf-8")
    print("adopted", cg_id, tag, im.size)


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    if cmd == "list":
        for k, s in SCENES.items():
            print(k, s["place"], s["hajime"], "hookah" if (s.get("hookah") or (s.get("from3952") and scenes_3952()[k]["eight"])) else "")
    elif cmd == "prompt":
        p, refs, eight = build(sys.argv[2])
        print(p, "\n\nREFS:", *[str(r.relative_to(ROOT)) for r in refs], "\n\n8行:\n" + eight, sep="\n")
    elif cmd == "gen":
        gen(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "01", os.environ.get("STILLS_EXTRA", ""))
    elif cmd == "adopt":
        adopt(sys.argv[2], sys.argv[3], append="--append" in sys.argv)
    elif cmd == "edit":  # python3 generate.py edit <cg_id> <種類> <タグ>
        edit(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "e1")


if __name__ == "__main__":
    main()
