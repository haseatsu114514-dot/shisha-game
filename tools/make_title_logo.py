#!/usr/bin/env python3
"""タイトルロゴ「水煙前線 -EN:CODE-」のPNGを生成する。

ユーザー製の正式ロゴ（黒地・墨筆・水パイプのシルエット・青/紫のインク飛沫）を
参考に、同じ構図をプログラム描画で再現する。
正式ロゴ画像が届いたら assets/ui/ui_title_logo.png に同名で上書きすればよい。

使い方:
    python3 tools/make_title_logo.py [出力パス]

フォント（Noto Serif CJK JP Black）が無ければ自動ダウンロードする。
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
LATIN_FONT = "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"

# 2倍で描いて縮小（アンチエイリアス）
W, H = 2400, 1500
OUT_W = 1200

random.seed(20260611)


def ensure_font() -> None:
    if FONT_PATH.exists():
        return
    print("downloading Noto Serif CJK JP Black ...")
    urllib.request.urlretrieve(FONT_URL, FONT_PATH)


def soft_blob(layer, cx, cy, r, color, alpha):
    d = ImageDraw.Draw(layer)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (alpha,))


def smoke_curl(layer, x, y, *, scale, turns, color=(225, 225, 232), alpha=30, ccw=False):
    """渦を巻く濃い煙。参考ロゴの上部の煙のかたまり"""
    steps = 90
    for i in range(steps):
        t = i / steps
        ang = (t * turns * math.tau) * (-1 if ccw else 1)
        rad = scale * (0.18 + 0.82 * t)
        px = x + math.cos(ang) * rad
        py = y + math.sin(ang) * rad * 0.55 - t * scale * 0.9
        r = scale * (0.34 - 0.20 * t) * random.uniform(0.7, 1.3)
        soft_blob(layer, px, py, r, color, int(alpha * (1 - t * 0.5)))


def ink_splash(layer, x, y, *, r, color, alpha, n=26):
    """インクの飛沫: 中心のしみ + 周囲に飛び散る点と尾"""
    d = ImageDraw.Draw(layer)
    for i in range(n):
        ang = random.uniform(0, math.tau)
        dist = r * random.uniform(0.05, 1.4) * random.random()
        rr = r * random.uniform(0.04, 0.30) * (1.2 - dist / (r * 1.5))
        px, py = x + math.cos(ang) * dist, y + math.sin(ang) * dist * 0.8
        d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=color + (alpha,))
        # 尾を引く飛沫
        if random.random() < 0.3:
            ex = px + math.cos(ang) * rr * 6
            ey = py + math.sin(ang) * rr * 6
            d.line([px, py, ex, ey], fill=color + (alpha // 2,), width=max(2, int(rr * 0.5)))


def _smooth_profile(points, steps=8):
    """制御点列をCatmull-Rom補間してなめらかな輪郭にする"""
    if len(points) < 3:
        return points
    pts = [points[0]] + points + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for j in range(steps):
            t = j / steps
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t
                       + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                       + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t
                       + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                       + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(points[-1])
    return out


def hookah_silhouette(layer, cx, base_y, scale, color=(52, 50, 64), alpha=255):
    """水パイプのシルエット。半輪郭をスプライン補間して左右対称に描く"""
    d = ImageDraw.Draw(layer)
    s = scale
    col = color + (alpha,)
    top = base_y - 2.0 * s
    # (半幅x/s, 上からのy/s): ボウル → くびれ → ステム → ベース → 脚
    profile = [
        (0.090, 0.00),   # ボウルのリム
        (0.115, 0.04),   # リムの張り出し
        (0.095, 0.12),   # ボウルの膨らみ
        (0.052, 0.22),   # ボウル下のくびれ
        (0.040, 0.27),
        (0.028, 0.34),   # ステム上部
        (0.024, 0.55),   # ステム（細く長く）
        (0.026, 0.80),
        (0.034, 0.95),   # ステム下部の広がり
        (0.060, 1.18),   # ベースの首
        (0.150, 1.38),   # ベースの肩
        (0.215, 1.58),   # ベース最大径
        (0.205, 1.74),
        (0.150, 1.88),   # ベースのすぼまり
        (0.110, 1.95),
        (0.130, 2.00),   # 脚の小さな広がり
    ]
    right = [(cx + x * s, top + y * s) for x, y in _smooth_profile(profile)]
    left = [(cx - x * s, top + y * s) for x, y in _smooth_profile(profile)]
    d.polygon(right + left[::-1], fill=col)
    # 皿（ボウル下の薄いディスク）
    tray_y = top + 0.255 * s
    d.ellipse([cx - 0.165 * s, tray_y - 0.020 * s, cx + 0.165 * s, tray_y + 0.020 * s], fill=col)
    # ステム中央の飾りリング
    ring_y = top + 0.62 * s
    d.ellipse([cx - 0.045 * s, ring_y - 0.016 * s, cx + 0.045 * s, ring_y + 0.016 * s], fill=col)
    # ベースのハイライト（左肩にわずかな抜き）
    hl = Image.new("L", layer.size, 0)
    hd = ImageDraw.Draw(hl)
    hd.ellipse([cx - 0.16 * s, top + 1.42 * s, cx - 0.05 * s, top + 1.72 * s], fill=40)
    hl = hl.filter(ImageFilter.GaussianBlur(int(0.03 * s)))
    layer.putalpha(ImageChops.subtract(layer.getchannel("A"), hl))


def radial_arcs(layer, cx, cy, *, r0, n, color=(120, 118, 132), alpha=26):
    """背景の薄い放射円弧（参考ロゴの上部にある幾何ライン）"""
    d = ImageDraw.Draw(layer)
    for i in range(n):
        r = r0 * (0.55 + 0.45 * i / max(n - 1, 1))
        box = [cx - r, cy - r * 0.62, cx + r, cy + r * 0.62]
        a0 = random.uniform(180, 240)
        a1 = a0 + random.uniform(50, 140)
        d.arc(box, a0, a1, fill=color + (alpha,), width=3)


def main() -> None:
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO_ROOT / "assets" / "ui" / "ui_title_logo.png"
    ensure_font()

    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    text_cy = int(H * 0.46)  # 文字の中心

    # ---- 1. 背景の幾何ライン + 水パイプのシルエット ----
    back = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    radial_arcs(back, W * 0.5, H * 0.28, r0=W * 0.22, n=4)
    hookah_silhouette(back, W * 0.5, H * 0.94, H * 0.40, color=(50, 48, 62), alpha=255)
    back = back.filter(ImageFilter.GaussianBlur(3))
    img = Image.alpha_composite(img, back)

    # ---- 2. 上部の渦巻く墨煙（左に大きく、右にもう一つ） ----
    smoke = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    smoke_curl(smoke, W * 0.20, H * 0.21, scale=220, turns=1.7, alpha=62)
    smoke_curl(smoke, W * 0.30, H * 0.14, scale=130, turns=1.2, alpha=44, ccw=True)
    smoke_curl(smoke, W * 0.57, H * 0.09, scale=140, turns=1.3, alpha=46, ccw=True)
    smoke_curl(smoke, W * 0.81, H * 0.22, scale=180, turns=1.5, alpha=52, ccw=True)
    # 文字まわりの薄いもや
    for i in range(16):
        soft_blob(
            smoke,
            random.uniform(W * 0.10, W * 0.90),
            random.uniform(H * 0.18, H * 0.70),
            random.uniform(60, 150),
            (210, 210, 222),
            random.randint(6, 14),
        )
    smoke = smoke.filter(ImageFilter.GaussianBlur(10))
    img = Image.alpha_composite(img, smoke)

    # ---- 3. インクの飛沫（左下: 青 / 右: 紫） ----
    splash = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ink_splash(splash, W * 0.135, H * 0.62, r=150, color=(40, 90, 190), alpha=200)
    ink_splash(splash, W * 0.10, H * 0.70, r=90, color=(70, 130, 220), alpha=150)
    ink_splash(splash, W * 0.885, H * 0.60, r=160, color=(140, 70, 200), alpha=190)
    ink_splash(splash, W * 0.92, H * 0.40, r=100, color=(110, 60, 170), alpha=150)
    ink_splash(splash, W * 0.83, H * 0.22, r=80, color=(90, 70, 130), alpha=120)
    splash = splash.filter(ImageFilter.GaussianBlur(2.5))
    img = Image.alpha_composite(img, splash)

    # ---- 4. 「水煙前線」本体（白の墨文字＋かすれ） ----
    font = ImageFont.truetype(str(FONT_PATH), 470)
    text = "水煙前線"
    tl = Image.new("L", (W, H), 0)
    td = ImageDraw.Draw(tl)
    bbox = td.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx, ty = (W - tw) // 2 - bbox[0], text_cy - th // 2 - bbox[1]
    td.text((tx, ty), text, font=font, fill=255)

    # 墨のかすれ: 粗いノイズと細かいノイズの2層（白さを保つため浅めに）
    n1 = Image.effect_noise((W, H), 70).filter(ImageFilter.GaussianBlur(1.4))
    n1 = n1.point(lambda v: 233 + (v - 128) // 5)
    n2 = Image.effect_noise((W // 4, H // 4), 90).resize((W, H)).filter(ImageFilter.GaussianBlur(4))
    n2 = n2.point(lambda v: 242 + (v - 128) // 6)
    text_alpha = ImageChops.multiply(ImageChops.multiply(tl, n1), n2)

    # 文字色: 白 → 下端がごくわずかに沈む
    grad = Image.new("L", (1, H), 0)
    for yy in range(H):
        t = min(max((yy - ty) / max(th, 1), 0), 1)
        grad.putpixel((0, yy), int(255 - t * 14))
    grad = grad.resize((W, H))
    text_rgb = Image.merge(
        "RGBA",
        (grad, grad, grad.point(lambda v: min(255, int(v * 1.015))), text_alpha),
    )

    # 文字の発光は控えめ（参考ロゴはマットな白）
    glow_a = tl.filter(ImageFilter.GaussianBlur(30)).point(lambda v: v * 56 // 255)
    glow = Image.new("RGBA", (W, H), (200, 195, 220, 0))
    glow.putalpha(glow_a)
    img = Image.alpha_composite(img, glow)
    img = Image.alpha_composite(img, text_rgb)

    # 文字の角から飛ぶ細かい飛沫
    spark = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(spark)
    edge = tl.filter(ImageFilter.FIND_EDGES)
    edge_px = edge.load()
    cnt = 0
    while cnt < 130:
        x = random.randint(int(W * 0.1), int(W * 0.9))
        y = random.randint(int(text_cy - th * 0.7), int(text_cy + th * 0.7))
        if edge_px[x, y] > 100 and random.random() < 0.6:
            ang = random.uniform(0, math.tau)
            dist = random.uniform(8, 90)
            px, py = x + math.cos(ang) * dist, y + math.sin(ang) * dist
            r = random.uniform(1.5, 5)
            sd.ellipse([px - r, py - r, px + r, py + r], fill=(235, 233, 240, random.randint(90, 200)))
            cnt += 1
    img = Image.alpha_composite(img, spark)

    # ---- 5. -EN:CODE-（両脇に長いダッシュ） ----
    lf = ImageFont.truetype(LATIN_FONT, 104)
    sub = "-EN:CODE-"
    sl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd2 = ImageDraw.Draw(sl)
    sb = sd2.textbbox((0, 0), sub, font=lf)
    sw = sb[2] - sb[0]
    sy = text_cy + th // 2 + 86
    sx = (W - sw) // 2 - sb[0]
    col = (216, 212, 222, 240)
    # 文字間を空けて描く（レタースペーシング）
    cx_cursor = (W - sw * 1.28) / 2
    for ch in sub:
        cb = sd2.textbbox((0, 0), ch, font=lf)
        sd2.text((cx_cursor - cb[0], sy), ch, font=lf, fill=col)
        cx_cursor += (cb[2] - cb[0]) * 1.28 + 14
    # 両脇のダッシュ（2本ずつ・段差）
    line_y = sy + (sb[3] - sb[1]) // 2 + 10
    for side in (-1, 1):
        x_in = W / 2 + side * (sw * 0.75)
        x_out = W / 2 + side * (sw * 1.55)
        x_mid = W / 2 + side * (sw * 1.12)
        sd2.line([x_in, line_y, x_mid - side * 20, line_y], fill=col, width=8)
        sd2.line([x_mid + side * 20, line_y, x_out, line_y], fill=col, width=8)
    img = Image.alpha_composite(img, sl)

    # ---- 縮小して書き出し ----
    out = img.resize((OUT_W, int(H * OUT_W / W)), Image.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(out_path)
    print(f"wrote {out_path} ({out_path.stat().st_size:,} bytes, {out.size[0]}x{out.size[1]})")


if __name__ == "__main__":
    main()
