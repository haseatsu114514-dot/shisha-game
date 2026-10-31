#!/usr/bin/env python3
"""心得の盤「ネオンのラウンジ」の素材を OpenAI の画像APIで生成する（GB03・SBD72）。

- キーはこのコードでは扱わない。クラウド環境のネットワークシークレットがプロキシで Authorization を付ける。
  手元では環境変数 OPENAI_API_KEY があればそれを付ける（ファイル・リポジトリには書かない）。
- 出力はこのフォルダに <名前>.png と、リクエストの記録 <名前>.json。既にある出力は飛ばす。
- ゲーム用 WebP への変換は convert.py（縮小・切り出しだけ。色調整なし）。

使い方:
  python3 asset_sources/ui/growth-board-20261030/neon/gen.py            # 全部
  python3 asset_sources/ui/growth-board-20261030/neon/gen.py hub_body   # 1枚だけ
  python3 asset_sources/ui/growth-board-20261030/neon/gen.py --list     # 一覧だけ
"""
import base64, json, os, sys, time, urllib.error, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2.5-sunburst")

# 共通スタイル指針（docs/asset_gen_prompts.md）＋盤の共通（GB03 5章）を英語で。文字・UI・数字は焼き込まない。
STYLE = (
    "Game UI asset for a visual novel set in a dim after-hours shisha lounge. "
    "Art direction 'neon lounge': black smoked glass, thin neon tubes with a bright core and soft outer bloom, "
    "faint drifting hookah smoke reflected in the glass. Allowed light colors only: board colors "
    "red-orange #ef8a5e, blue #58a6ff, green #7bd36d; gold #f4d27a; warm white-gold #fff1d0; pale white #f6f2ff. "
    "2D pixel-painter style with fine dot texture in shading, not photoreal, not glossy 3D. "
    "Even tube thickness, calm luxurious night-club feel, legible, nothing eye-searing, no full-frame glow. "
    "Strictly no text, no letters, no kanji, no numbers, no logos, no UI widgets, no watermark, no people, no hookah pipes."
)

ASSETS = {
    # name: (prompt, api size, background)
    "board_glass": (
        "A flat, straight-on panel of black smoked glass to be used as the floor of a skill board. Slightly darker toward the edges, "
        "a very faint soft smoke reflection drifting across the middle, a subtle hairline bevel of warm white-gold light along the top edge. "
        "Completely empty surface: no dots, no lines, no grid, no shapes drawn on it.",
        "1536x1024", "opaque"),
    "screen_backdrop": (
        "Deep background of a night shisha lounge far behind the viewer, heavily out of focus: black and deep plum darkness with large "
        "soft bokeh orbs of distant neon, mostly amber and gold with a few blue and violet orbs on the right side. The left two thirds are "
        "almost black so a board can sit on top. No furniture, no people, no objects in focus.",
        "1536x1024", "opaque"),
    "hub_body": (
        "A single round neon sign ring, red-orange #ef8a5e, seen straight on and centered, filling about 80% of the frame. A thick outer tube "
        "and a thin inner tube, both glowing with bright cores and soft bloom; between them six short curling ember-like swirl ornaments in "
        "warm gold. The center 40% is completely empty and transparent. Isolated on a fully transparent background.",
        "1024x1024", "transparent"),
    "hub_sense": (
        "A single round neon sign ring, blue #58a6ff, seen straight on and centered, filling about 80% of the frame. A thick outer tube "
        "and a thin inner tube, both glowing with bright cores and soft bloom; between them six short curling ember-like swirl ornaments in "
        "warm gold. The center 40% is completely empty and transparent. Isolated on a fully transparent background.",
        "1024x1024", "transparent"),
    "hub_wisdom": (
        "A single round neon sign ring, green #7bd36d, seen straight on and centered, filling about 80% of the frame. A thick outer tube "
        "and a thin inner tube, both glowing with bright cores and soft bloom; between them six short curling ember-like swirl ornaments in "
        "warm gold. The center 40% is completely empty and transparent. Isolated on a fully transparent background.",
        "1024x1024", "transparent"),
    "frame_skill": (
        "A single flat hexagon badge with pointed left and right corners (wider than tall, width to height about 40:34), centered, filling "
        "about 85% of the frame. Outline is one neon tube in warm white-gold #fff1d0 with bright core and soft bloom; the inside is dark smoked "
        "glass, empty. Isolated on a fully transparent background.",
        "1024x1024", "transparent"),
    "frame_gate": (
        "A single flat diamond (a square rotated 45 degrees), centered, filling about 80% of the frame. Outline is one neon tube in warm "
        "white-gold #fff1d0 with bright core and soft bloom; the inside is dark smoked glass with a tiny keyhole-like dark notch at the center. "
        "Isolated on a fully transparent background.",
        "1024x1024", "transparent"),
    "frame_peak": (
        "A single flat hexagon badge with pointed left and right corners (wider than tall), centered, filling about 90% of the frame. Outline is a "
        "pale white neon tube #f6f2ff with a second, thinner halo ring of light just outside it, both with soft bloom; the inside is dark smoked glass "
        "with a faint radial shimmer. Isolated on a fully transparent background.",
        "1024x1024", "transparent"),
    "frame_lesson": (
        "A single flat ornate hexagon portrait frame with pointed left and right corners (wider than tall, width to height about 40:34), centered, "
        "filling about 88% of the frame. The frame is a DOUBLE neon tube in rich gold #f4d27a with bright cores and soft bloom, decorated with fine "
        "art-deco filigree between the tubes, a small glowing gem at the top corner and a tiny laurel ornament at the bottom corner, luxurious like a "
        "master's portrait medallion in a premium game UI. The inside is fully transparent and empty (a portrait will be placed behind it by code). "
        "No text. Isolated on a fully transparent background.",
        "1024x1024", "transparent"),
    "wall_seal": (
        "A game icon of a large golden padlock with two thick golden chains crossed behind it in an X shape. Chunky chain links, the padlock has "
        "a rounded shackle and a dark keyhole. Shiny gold metal with dark outlines and a soft warm glow. Centered, bold and simple, readable at "
        "small size. No text. Transparent background.",
        "1024x1024", "transparent"),
    "silhouette_unknown": (
        "A single flat solid black silhouette of an unknown person's head and shoulders bust, facing front, soft rounded shapes, slightly mysterious, "
        "centered, filling about 75% of the frame, crisp edge, no features, no outline, no glow. Isolated on a fully transparent background.",
        "1024x1024", "transparent"),
    "frame_seal": (
        "A single flat hexagon badge with pointed left and right corners (wider than tall), centered, filling about 85% of the frame, but the neon tube "
        "is switched OFF: a dull dark grey glass tube with no glow, and the inside is fogged frosted glass with a small round wax-seal-like dimple at the "
        "center. Muted, dim, mysterious. Isolated on a fully transparent background.",
        "1024x1024", "transparent"),
    "hidane_any": (
        "A single round glowing orb icon, pale warm white-gold color #fff1d0 with a soft white center highlight, like a small ember, centered, filling "
        "about 70% of the frame, crisp clean edge, simple game icon. Isolated on a fully transparent background.",
        "1024x1024", "transparent"),
    "hidane_body": (
        "A single small flame, red-orange #ef8a5e with a pale yellow core, pointed tip, gently wavy silhouette, centered, filling about 70% of the "
        "frame, crisp readable silhouette. Isolated on a fully transparent background.",
        "1024x1024", "transparent"),
    "hidane_sense": (
        "A single small glowing water-drop shape, blue #58a6ff with a white core, pointed top and round bottom, smooth silhouette, centered, filling "
        "about 70% of the frame, crisp readable silhouette. Isolated on a fully transparent background.",
        "1024x1024", "transparent"),
    "hidane_wisdom": (
        "A single small glowing green gem icon shaped like a rounded cube, color #7bd36d with a soft lighter edge glow, seen slightly from above so two faces show, centered, "
        "filling about 70% of the frame, crisp clean silhouette, simple game icon. Isolated on a fully transparent background.",
        "1024x1024", "transparent"),
    "panel_frame": (
        "A square UI frame for 9-slice stretching: a thin gold #f4d27a neon tube running along all four edges with small ornamental gold neon flourishes "
        "at the four corners only, straight plain tubes in the middle of each edge, the whole interior fully transparent and empty. Centered, "
        "filling about 90% of the frame. Isolated on a fully transparent background.",
        "1024x1024", "transparent"),
}


def request(name, prompt, size, background):
    body = {"model": MODEL, "prompt": prompt + " " + STYLE, "size": size, "n": 1, "quality": os.environ.get("IMAGE_QUALITY", "high"),
            "background": background, "output_format": "png"}
    headers = {"Content-Type": "application/json"}
    key = os.environ.get("OPENAI_API_KEY")
    if key:
        headers["Authorization"] = "Bearer " + key
    req = urllib.request.Request("https://api.openai.com/v1/images/generations", json.dumps(body).encode(), headers)
    for attempt in range(5):
        try:
            res = json.load(urllib.request.urlopen(req, timeout=600))
            (HERE / f"{name}.png").write_bytes(base64.b64decode(res["data"][0]["b64_json"]))
            (HERE / f"{name}.json").write_text(json.dumps(body | {"created": res.get("created"), "usage": res.get("usage")},
                                                          ensure_ascii=False, indent=1), encoding="utf-8")
            return "ok"
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            if e.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(10 * (attempt + 1))
                continue
            return f"HTTP {e.code} {msg}"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--list" in sys.argv:
        for k, (_, s, b) in ASSETS.items():
            print(k, s, b)
        return 0
    names = args or list(ASSETS)
    import concurrent.futures as cf
    todo = [n for n in names if not (HERE / f"{n}.png").exists()]
    print(f"generate {len(todo)} (skip {len(names) - len(todo)} existing)")
    with cf.ThreadPoolExecutor(3) as ex:
        for name, result in zip(todo, ex.map(lambda n: request(n, *ASSETS[n]), todo)):
            print(name, result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
