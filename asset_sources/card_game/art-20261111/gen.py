#!/usr/bin/env python3
"""カードゲーム「一台勝負」の絵を画像生成で作る（gpt-image-2.5-sunburst・/v1/images/generations）。

使い方:
  python3 asset_sources/card_game/art-20261111/gen.py --list                        # id の一覧（種類・サイズ）
  python3 asset_sources/card_game/art-20261111/gen.py --print read                  # その絵の文をそのまま出す（Codex 内蔵の画像生成に貼る用）
  OPENAI_API_KEY=... python3 asset_sources/card_game/art-20261111/gen.py            # まだ無いものを全部
  OPENAI_API_KEY=... python3 asset_sources/card_game/art-20261111/gen.py read fan   # 指定した id だけ作り直す

2026-11-11 に API で実行したが残高が無く（「credit_balance_exhausted」）、card の24枚は同じ日に Codex の内蔵画像生成で
この文のまま作った（#3221。記録は asset_sources/card_game/README.md の「原画の記録」）。卓と裏面は #3257 の担当。
ここの文が第2弾の依頼文の正本。Codex 内蔵の画像生成で作るときも --print の文をそのまま使う。

- 出力は raw/<種類>/<id>.png（生成したまま・加工しない）。作り直すと raw/<種類>/<id>.v2.png のように番号を足す。
- 文は「画風の段落」＋「その絵の段落」。画風は、卓と裏面が夜紫UIの style.txt（STYLE-UI）、カードの絵が下の STYLE_ART。
- 絵に文字・数字・枠は描かせない（カードの枠・名前・数字はコードが描く）。
- シーシャ台・ハガル・HMD・炭・ホースが写る絵はここでは作らない（docs/shisha_reference.md 4 の手順が要る。本編の正規の絵を使う）。
- 採用するときは assets/ui/ichidai/<種類>/<id>.png に写して python3 remake/tools/build_ichidai_art.py。
"""
import base64, concurrent.futures, json, os, sys, urllib.error, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
MODEL = "gpt-image-2.5-sunburst"
STYLE_UI = (ROOT / "asset_sources/ui/craft-night-20261102/prompts/style.txt").read_text(encoding="utf-8").strip()
STYLE_ART = (
    "Style: a small illustration for a playing card in a pixel-painterly visual novel set in a stylish Japanese shisha bar at night. "
    "Painterly with a subtle pixel grain, soft shading in three or four tones and a clean readable silhouette; not photorealistic, not 3D, "
    "not anime line art. Deep night purple (#150d22 to #2e1d45) fills the whole background, with a soft one-directional lavender light "
    "(#c9a7e6) from the upper left and a faint warm ember glow from below; warm white (#f6f1fa) only for small highlights, muted gold "
    "(#e3bd6e) only as a thin rim accent. Calm, chill, dim indirect lighting, a subtle smoke haze drifting behind the subject. The subject "
    "sits exactly centred, fills about 70% of the square frame and reads clearly even when the image is shrunk to 100 pixels; use the same "
    "light and finish for every image in this set. Plain background: no table edge, no frame, no border, no vignette ring. No people, no "
    "hands, no faces. No shisha pipe, bowl, heat-management device, charcoal block or hose. Square 1024x1024. Never bake in any text, "
    "letters, logo, digits, icons or watermark."
)
BACK = (
    "Create ONE playing-CARD BACK, upright portrait rectangle with aspect 5:7, filling the whole image edge to edge with square corners "
    "(the game rounds the corners). {face} A thin double rule border (muted gold outside, lavender inside) runs all the way round, inset "
    "about 5% from the edge. In the exact centre sits one small emblem drawn only with thin gold hairlines: {emblem} The design is "
    "symmetric so it reads the same upside down. Faint velvet weave on the face, a soft light gradient from the upper left. No text, no "
    "letters, no digits, no suit marks."
)

def art(subject):
    return ("card", "1024x1024", STYLE_ART + "\n\nSUBJECT: " + subject)

ITEMS = {
    # 卓と裏面（STYLE-UI）
    "mat": ("table", "1536x1024", STYLE_UI + "\n\nCreate ONE card-game PLAYMAT seen straight from above, landscape 3:2, filling the whole image "
            "edge to edge with no frame and no background outside it. A dark stone bar counter with a very faint purple cast and an even fine "
            "grain. The upper third is slightly cooler and darker, the lower third holds a soft pool of warmer ember-tinted light in its middle, "
            "and the four corners fall off to near black. A few very faint smoke curls only near the corners. The surface must stay quiet and "
            "low-contrast, because game cards and white text are drawn on top of it. Nothing on the counter: no objects, no cards, no lines, "
            "no symbols, no shadows of objects, no reflections of lamps."),
    "deck": ("back", "1024x1536", STYLE_UI + "\n\n" + BACK.format(
        face="The face is deep night purple velvet (#221534) that darkens slightly toward the edges.",
        emblem="a plain ring with a single curl of smoke rising through it.")),
    "judge": ("back", "1024x1536", STYLE_UI + "\n\n" + BACK.format(
        face="The face is a dusky lavender-grey satin (#3a2a55) that darkens slightly toward the edges.",
        emblem="a plain ring that holds three short parallel wisps of smoke, like a breath being drawn in.")),
    # 技（手番・一口）
    "heat_in": art("a rising swirl of warm amber smoke that curls upward and glows brighter at its core, with a few tiny orange sparks."),
    "heat_out": art("a cool lavender-blue wisp of smoke that drifts sideways to the right and thins out, with a few tiny pale sparkles."),
    "blow": art("a strong straight jet of pale smoke blown in from the left edge that scatters a small cluster of orange sparks at its tip."),
    "show_smoke": art("one perfect thick smoke ring floating in the air, with a second smaller smoke ring passing through its centre."),
    "all_in": art("one huge dense billowing cloud of white smoke, lit from inside by a warm golden glow."),
    "duel": art("two streams of smoke, one warm amber from the left and one cool lavender from the right, colliding in the centre in a bright burst."),
    "read": art("a single face-down playing card with a plain purple back, one corner lifted by a thin curl of smoke, a small glint of light under the lifted corner."),
    "ash_tap": art("a small soft heap of pale grey ash with a few fine flakes falling onto it and one fading orange spark."),
    "add_coal": art("a single bright orange spark falling straight down, leaving a short glowing trail, with tiny embers drifting around it."),
    "tongs": art("a pair of slim stainless-steel tongs, closed, lying diagonally, with a sharp glint of light on the metal and two tiny sparks near the tips."),
    "fan": art("a small burst of orange-red flames and sparks fanning upward from the bottom edge, like a fire just being kindled."),
    "inner": art("three thin arcs of warm amber light converging inward to one bright point in the centre."),
    "outer": art("three thin arcs of cool lavender light spreading outward from a dim centre."),
    "loosen": art("a small loose mound of moist dark reddish-brown shredded leaves, fluffed up, with a few strands lifted and glistening."),
    "breath": art("a small plain ceramic cup of hot tea seen from slightly above, with a single thin line of steam rising."),
    "reset": art("an hourglass with a dark brass frame and lavender sand, half run through."),
    # イベント
    "hype": art("a vintage stage microphone on a short stand, with three arcs of light radiating from it like sound waves."),
    "draft": art("a thin stream of cold bluish wind slipping through a narrow vertical gap and bending a wisp of smoke sideways."),
    "venue_heat": art("several warm stage spotlight beams crossing each other through thick warm haze, seen from below, with no people."),
    "go_second": art("two comet-like wisps of smoke chasing each other in a closed loop, one warm amber and one cool lavender."),
    "buyout": art("a neat stack of three plain unlabelled rectangular cardboard cartons tied together with a thin gold string."),
    "repack": art("a small two-pronged metal fork lifting a tuft of moist dark reddish-brown shredded leaves."),
    "encore": art("two crossing spotlight beams over a swirl of smoke, with a burst of small golden sparks falling like confetti."),
    # 器具のうち、シーシャの機材ではないもの
    "timer": art("a small round mechanical kitchen timer, matte black, with a plain blank dial that has tick marks but no numerals, seen in a three-quarter view."),
}

def call(prompt, size):
    body = json.dumps({"model": MODEL, "prompt": prompt, "size": size, "quality": "high", "n": 1}).encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/generations", data=body,
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}", "Content-Type": "application/json"})
    try:
        data = json.load(urllib.request.urlopen(req, timeout=900))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:400]}") from None
    return base64.b64decode(data["data"][0]["b64_json"])

def run(item_id, redo):
    kind, size, prompt = ITEMS[item_id]
    out = HERE / "raw" / kind / f"{item_id}.png"
    if out.exists():
        if not redo:
            return f"{item_id}: あり（とばす）"
        n = 2
        while (out.with_name(f"{item_id}.v{n}.png")).exists():
            n += 1
        out = out.with_name(f"{item_id}.v{n}.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(call(prompt, size))
    return f"{item_id}: {out.relative_to(HERE)} {out.stat().st_size} bytes"

if __name__ == "__main__":
    if sys.argv[1:2] == ["--list"]:
        for item_id, (kind, size, _prompt) in ITEMS.items():
            print(f"{kind}/{item_id}\t{size}")
        sys.exit(0)
    if sys.argv[1:2] == ["--print"]:
        for item_id in sys.argv[2:] or list(ITEMS):
            print(f"--- {ITEMS[item_id][0]}/{item_id}（{ITEMS[item_id][1]}）---\n{ITEMS[item_id][2]}\n")
        sys.exit(0)
    ids = sys.argv[1:] or list(ITEMS)
    unknown = [i for i in ids if i not in ITEMS]
    if unknown:
        sys.exit("知らない id: " + " ".join(unknown))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(run, i, bool(sys.argv[1:])): i for i in ids}
        failed = 0
        for f in concurrent.futures.as_completed(futures):
            try:
                print(f.result(), flush=True)
            except Exception as e:  # 1 枚の失敗でほかを止めない
                failed += 1
                print(f"{futures[f]}: 失敗 {e}", flush=True)
    sys.exit(1 if failed else 0)
