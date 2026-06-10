#!/usr/bin/env python3
"""タイトルロゴ「水煙前線 -EN:CODE-」のPNGを生成する。

ユーザー製の正式ロゴが届くまでのプログラム生成版。
正式ロゴが来たら assets/ui/ui_title_logo.png に同名で上書きすればよい。

使い方:
    python3 tools/make_title_logo.py [出力パス]

フォント（Noto Serif CJK JP Black）が無ければ自動ダウンロードする:
    https://github.com/notofonts/noto-cjk/raw/main/Serif/OTF/Japanese/NotoSerifCJKjp-Black.otf
"""

import math
import random
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

REPO_ROOT = Path(__file__).resolve().parent.parent
FONT_PATH = Path("/tmp/NotoSerifJP-Black.otf")
FONT_URL = "https://github.com/notofonts/noto-cjk/raw/main/Serif/OTF/Japanese/NotoSerifCJKjp-Black.otf"
LATIN_FONT = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"

# 2倍で描いて縮小（アンチエイリアス）
W, H = 3200, 1500
OUT_W = 1600

random.seed(20260610)


def ensure_font() -> None:
    if FONT_PATH.exists():
        return
    print("downloading Noto Serif CJK JP Black ...")
    urllib.request.urlretrieve(FONT_URL, FONT_PATH)


def soft_blob(layer: Image.Image, cx: float, cy: float, r: float, color, alpha: int):
    """ぼかし円を1つ置く（あとで全体をブラーするので輪郭は気にしない）"""
    d = ImageDraw.Draw(layer)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (alpha,))


def smoke_wisp(layer: Image.Image, x: float, y: float, *, up: float, sway: float,
               steps: int, r0: float, color=(235, 235, 245)):
    """下から上へ、揺れながら細くなる煙。3本の束で厚みを出す"""
    for strand in range(3):
        phase = random.uniform(0, math.tau)
        freq = random.uniform(1.0, 2.2)
        ox = random.uniform(-r0 * 0.6, r0 * 0.6)
        for i in range(steps):
            t = i / steps
            px = x + ox + math.sin(phase + t * freq * math.tau) * sway * t
            py = y - up * t
            r = r0 * (1 - t * 0.78) * random.uniform(0.75, 1.25)
            a = int(20 * (1 - t) + 5)
            soft_blob(layer, px, py, r, color, a)


def main() -> None:
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO_ROOT / "assets" / "ui" / "ui_title_logo.png"
    ensure_font()

    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # ---- 1. 色つきの煙雲（参考ロゴ: 左下に青、右に紫） ----
    clouds = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for cx, cy, r, col, a in [
        (W * 0.13, H * 0.74, 360, (70, 110, 205), 96),
        (W * 0.06, H * 0.55, 250, (90, 140, 225), 66),
        (W * 0.89, H * 0.28, 400, (145, 80, 205), 96),
        (W * 0.94, H * 0.64, 320, (175, 90, 195), 76),
        (W * 0.52, H * 0.08, 330, (125, 110, 170), 52),
        (W * 0.32, H * 0.16, 240, (150, 100, 195), 44),
    ]:
        soft_blob(clouds, cx, cy, r, col, a)
    clouds = clouds.filter(ImageFilter.GaussianBlur(95))
    img = Image.alpha_composite(img, clouds)

    # ---- 2. 白い煙（文字の天面から立ちのぼる + 周囲に渦） ----
    smoke = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    text_top = H * 0.40 - 280  # 文字の上端あたり
    for sx, up, sway, r0 in [
        (W * 0.18, H * 0.46, 150, 58),
        (W * 0.31, H * 0.58, 210, 74),
        (W * 0.44, H * 0.64, 180, 86),
        (W * 0.57, H * 0.60, 200, 78),
        (W * 0.70, H * 0.54, 170, 68),
        (W * 0.83, H * 0.44, 140, 56),
    ]:
        smoke_wisp(smoke, sx, text_top + 200, up=up, sway=sway, steps=52, r0=r0)
    # 下側にもたゆたう煙
    for sx in (W * 0.26, W * 0.5, W * 0.74):
        smoke_wisp(smoke, sx, H * 0.86, up=H * 0.22, sway=120, steps=30, r0=70)
    # 横たわる薄煙
    for i in range(18):
        soft_blob(
            smoke,
            random.uniform(W * 0.06, W * 0.94),
            random.uniform(H * 0.14, H * 0.82),
            random.uniform(70, 180),
            (228, 228, 240),
            random.randint(7, 18),
        )
    smoke = smoke.filter(ImageFilter.GaussianBlur(34))
    img = Image.alpha_composite(img, smoke)

    # ---- 3. 「水煙前線」本体（白の墨文字＋ムラ） ----
    font = ImageFont.truetype(str(FONT_PATH), 560)
    text = "水煙前線"
    tl = Image.new("L", (W, H), 0)
    td = ImageDraw.Draw(tl)
    bbox = td.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx, ty = (W - tw) // 2 - bbox[0], int(H * 0.40) - th // 2 - bbox[1]
    td.text((tx, ty), text, font=font, fill=255)

    # 墨のかすれ: ノイズを2段階ブラーして文字のアルファに重ねる
    noise = Image.effect_noise((W, H), 60).filter(ImageFilter.GaussianBlur(2))
    noise = noise.point(lambda v: 215 + (v - 128) // 3)  # 215±α のムラ
    text_alpha = ImageChops.multiply(tl, noise)

    # 文字色: 上が白、下がわずかに灰青（金属感を消して墨らしく）
    grad = Image.new("L", (1, H), 0)
    for yy in range(H):
        t = min(max((yy - ty) / max(th, 1), 0), 1)
        grad.putpixel((0, yy), int(255 - t * 38))
    grad = grad.resize((W, H))
    text_rgb = Image.merge(
        "RGBA",
        (
            grad,
            grad.point(lambda v: int(v * 0.985)),
            grad.point(lambda v: min(255, int(v * 1.01))),
            text_alpha,
        ),
    )

    # 文字の発光（うしろにぼかした白を2層）
    for blur, alpha in [(48, 90), (16, 70)]:
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        glow.putalpha(tl.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: v * alpha // 255))
        white = Image.new("RGBA", (W, H), (210, 200, 235, 0))
        white.putalpha(glow.getchannel("A"))
        img = Image.alpha_composite(img, white)
    img = Image.alpha_composite(img, text_rgb)

    # ---- 4. 文字の縁から立つ細い煙（文字と煙の一体感） ----
    edge = tl.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(3))
    edge_smoke = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    es = edge.point(lambda v: min(60, v))
    tinted = Image.new("RGBA", (W, H), (220, 215, 240, 0))
    tinted.putalpha(es)
    edge_smoke = Image.alpha_composite(edge_smoke, tinted)
    edge_smoke = edge_smoke.transform(
        (W, H), Image.AFFINE, (1, 0.012, -8, 0, 1, -16), resample=Image.BILINEAR
    ).filter(ImageFilter.GaussianBlur(7))
    img = Image.alpha_composite(img, edge_smoke)

    # ---- 5. — EN : CODE — ----
    lf = ImageFont.truetype(LATIN_FONT, 110)
    sub = "E N : C O D E"
    sl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sl)
    sb = sd.textbbox((0, 0), sub, font=lf)
    sw = sb[2] - sb[0]
    sy = int(H * 0.40) + th // 2 + 120
    sx = (W - sw) // 2 - sb[0]
    col = (208, 198, 178, 235)
    sd.text((sx, sy), sub, font=lf, fill=col)
    # 両脇の長いダッシュ
    line_y = sy + (sb[3] - sb[1]) // 2 + 8
    sd.line([W * 0.20, line_y, sx - 90, line_y], fill=col, width=7)
    sd.line([sx + sw + 90, line_y, W * 0.80, line_y], fill=col, width=7)
    img = Image.alpha_composite(img, sl)

    # ---- 縮小して書き出し ----
    out = img.resize((OUT_W, int(H * OUT_W / W)), Image.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(out_path)
    print(f"wrote {out_path} ({out_path.stat().st_size:,} bytes, {out.size[0]}x{out.size[1]})")


if __name__ == "__main__":
    main()
