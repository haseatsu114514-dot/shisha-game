#!/usr/bin/env python3
"""心得の盤のマスのアイコンを OpenAI の画像APIで生成する（SBD73「マスに漢字が多いのでアイコンを入れたい」）。

- 恩恵12（能力のマスの一文字の代わり）、スキル24、極み、関門。各1枚・透過・白いネオン線のシンボル。
- 盤の色は CSS で重ねるので、絵は白〜薄い金の線だけ。文字・数字は入れない。
- キーはコードに書かない（クラウドではプロキシが付ける。手元は OPENAI_API_KEY）。既にある PNG は飛ばす。

  python3 asset_sources/ui/growth-board-20261030/icons/gen.py            # 全部
  python3 asset_sources/ui/growth-board-20261030/icons/gen.py perk_sleep # 1枚
"""
import base64, json, os, sys, time, urllib.error, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2.5-sunburst")

STYLE = (
    "A single flat game UI icon for a skill board in a dim shisha lounge visual novel. Drawn as a clean monoline pictogram, "
    "one continuous stroke weight, warm white #fff1d0 lines with a faint soft glow, on a FULLY TRANSPARENT background. "
    "Centered, filling about 70% of the frame, simple silhouette readable at 24 pixels, no shading gradients inside shapes, "
    "no frame, no circle around it, no background plate. Strictly no text, no letters, no kanji, no numbers, no logos, no watermark."
)

ICONS = {
    # 恩恵（能力のマス）
    "perk_stamina": "a flexed arm muscle outline",
    "perk_sleep": "a crescent moon with three small z-shaped sleep marks",
    "perk_charm": "two overlapping hearts",
    "perk_stage": "a four-point sparkle star with two tiny stars",
    "perk_heat": "a small flame above a glowing coal cube",
    "perk_pull": "a hookah hose mouthpiece with two curved inhale lines",
    "perk_dodge": "a curved arrow swerving around a small dot",
    "perk_breath": "three soft wavy smoke lines rising",
    "perk_gauge": "a half-circle gauge dial with a needle",
    "perk_leaf": "a single tobacco leaf with a center vein",
    "perk_tongue": "a stylised tongue with a small taste droplet",
    "perk_coal": "a glowing charcoal cube with heat lines",
    # スキル
    "skill_K03": "a pillow with a crescent moon (early sleeper)",
    "skill_K04": "two speech bubbles overlapping (talking to strangers)",
    "skill_K07": "an eye with a small wave line beneath (reading the room)",
    "skill_K08": "a heart with a lightning bolt (tireless)",
    "skill_K12": "a shield with a small flame inside (nerve of steel)",
    "skill_K13": "a megaphone with sound lines (cheering)",
    "skill_K15": "a hookah hose with a starburst at the tip (perfect puff)",
    "skill_K06": "two concentric ripple rings (second refresh)",
    "skill_K10": "an open eye inside a laurel wreath (judge's eye)",
    "skill_K16": "an upward arrow with a flame tail (momentum)",
    "skill_K11": "a pair of coal tongs holding a coal (fire keeper)",
    "skill_K14": "a coal cube with sound wave lines (voice of coal)",
    "skill_K01": "a checklist clipboard with three ticks (preparation)",
    "skill_K02": "a nose with a curling scent line (scent memory)",
    "skill_K05": "a cloud with a sun peeking out (weather sense)",
    "skill_K17": "a leaf inside a protective circle (leaf endurance)",
    "skill_K09": "a tongue with a small crown above (master palate)",
    "skill_K18": "a tightly packed bowl seen from above with dense dots (dense pack)",
    "skill_K19": "a street map pin with three small people dots (well connected)",
    "skill_K20": "a gift box with a ribbon (gift giving)",
    "skill_K21": "a perfect smoke ring, a torus seen slightly from the side",
    "skill_K22": "a smoke trail fading into three dots (lingering scent)",
    "skill_K23": "a magnifying glass over a leaf (appraisal)",
    "skill_K24": "a small notebook with a pencil (note taker)",
    # 種類
    "peak": "a crown made of three flame tips",
    "gate": "a keyhole inside a diamond outline",
}


def request(name, subject):
    body = {"model": MODEL, "prompt": subject + ". " + STYLE, "size": "1024x1024", "n": 1, "quality": "medium",
            "background": "transparent", "output_format": "png"}
    headers = {"Content-Type": "application/json"}
    key = os.environ.get("OPENAI_API_KEY")
    if key:
        headers["Authorization"] = "Bearer " + key
    req = urllib.request.Request("https://api.openai.com/v1/images/generations", json.dumps(body).encode(), headers)
    for attempt in range(5):
        try:
            res = json.load(urllib.request.urlopen(req, timeout=600))
            (HERE / f"{name}.png").write_bytes(base64.b64decode(res["data"][0]["b64_json"]))
            (HERE / f"{name}.json").write_text(json.dumps(body | {"created": res.get("created"), "usage": res.get("usage")}, ensure_ascii=False, indent=1), encoding="utf-8")
            return "ok"
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:200]
            if e.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(10 * (attempt + 1))
                continue
            return f"HTTP {e.code} {msg}"


def main():
    names = [a for a in sys.argv[1:] if not a.startswith("--")] or list(ICONS)
    todo = [n for n in names if not (HERE / f"{n}.png").exists()]
    print(f"generate {len(todo)} (skip {len(names) - len(todo)} existing)")
    import concurrent.futures as cf
    with cf.ThreadPoolExecutor(4) as ex:
        for name, result in zip(todo, ex.map(lambda n: request(n, ICONS[n]), todo)):
            print(name, result, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
