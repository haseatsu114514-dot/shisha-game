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


def smoke_wisp(layer, x, y, *, up, sway, steps, r0, color=(220, 218, 232)):
    """下から立ちのぼる細い煙。複数本束ねて厚みを出す"""
    for strand in range(2):
        phase = random.uniform(0, math.tau)
        freq = random.uniform(1.0, 2.2)
        ox = random.uniform(-r0 * 0.5, r0 * 0.5)
        for i in range(steps):
            t = i / steps
            px = x + ox + math.sin(phase + t * freq * math.tau) * sway * t
            py = y - up * t
            r = r0 * (1 - t * 0.75) * random.uniform(0.75, 1.25)
            a = int(18 * (1 - t) + 4)
            soft_blob(layer, px, py, r, color, a)


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
    """ハリル・マムーン風の水パイプのシルエットを合成図形で描く。
    cx: 中心 X、base_y: 底面 Y、scale: パイプ全体の高さ目安
    高さは scale 単位で約 1.40 ぶん上に伸びる"""
    d = ImageDraw.Draw(layer)
    s = scale
    col = col_alpha = color + (alpha,)
    # 各パーツの中心 Y（base_y からの相対オフセット）
    # 配置: 底から、フラスコ → 真鍮ボディ → 首 → 皿 → クレイボウル
    foot_cy = base_y - 0.02 * s
    flask_cy = base_y - 0.20 * s
    flask_top = base_y - 0.46 * s
    brass_lower_cy = base_y - 0.58 * s
    brass_mid_cy = base_y - 0.72 * s
    brass_upper_cy = base_y - 0.86 * s
    stem_top = base_y - 1.10 * s
    saucer_cy = base_y - 1.14 * s
    bowl_neck_y = base_y - 1.18 * s
    bowl_cy = base_y - 1.28 * s
    bowl_top = base_y - 1.36 * s

    # ガラスフラスコ（底）
    d.ellipse(
        [cx - 0.24 * s, base_y - 0.40 * s, cx + 0.24 * s, base_y + 0.02 * s],
        fill=col_alpha,
    )
    # フラスコの首（細く立ち上がる）
    d.polygon([
        (cx - 0.07 * s, flask_top + 0.02 * s),
        (cx + 0.07 * s, flask_top + 0.02 * s),
        (cx + 0.18 * s, base_y - 0.30 * s),
        (cx - 0.18 * s, base_y - 0.30 * s),
    ], fill=col_alpha)
    # 台座リム
    d.ellipse(
        [cx - 0.13 * s, foot_cy - 0.018 * s, cx + 0.13 * s, foot_cy + 0.018 * s],
        fill=col_alpha,
    )

    # 中段の真鍮ボディ（3つの楕円で「壺型」を作る）
    d.ellipse(
        [cx - 0.105 * s, brass_lower_cy - 0.06 * s, cx + 0.105 * s, brass_lower_cy + 0.10 * s],
        fill=col_alpha,
    )
    d.ellipse(
        [cx - 0.118 * s, brass_mid_cy - 0.07 * s, cx + 0.118 * s, brass_mid_cy + 0.08 * s],
        fill=col_alpha,
    )
    d.ellipse(
        [cx - 0.090 * s, brass_upper_cy - 0.08 * s, cx + 0.090 * s, brass_upper_cy + 0.07 * s],
        fill=col_alpha,
    )
    # ボディ上下のスプール（飾りリング）
    for y_off in (0.96, 0.88, 0.80, 0.50, 0.42):
        ry = base_y - y_off * s
        d.ellipse(
            [cx - 0.060 * s, ry - 0.015 * s, cx + 0.060 * s, ry + 0.015 * s],
            fill=col_alpha,
        )
        # 飾りの上下の細いリング
        d.ellipse(
            [cx - 0.046 * s, ry - 0.022 * s, cx + 0.046 * s, ry - 0.005 * s],
            fill=col_alpha,
        )
    # 細い首（皿の下まで）
    d.polygon([
        (cx - 0.028 * s, brass_upper_cy - 0.08 * s),
        (cx + 0.028 * s, brass_upper_cy - 0.08 * s),
        (cx + 0.034 * s, stem_top + 0.04 * s),
        (cx - 0.034 * s, stem_top + 0.04 * s),
    ], fill=col_alpha)

    # 真鍮の皿（saucer / ash plate）── 横に大きく広がる
    d.ellipse(
        [cx - 0.30 * s, saucer_cy - 0.022 * s, cx + 0.30 * s, saucer_cy + 0.022 * s],
        fill=col_alpha,
    )
    # 皿の縁（上面）
    d.ellipse(
        [cx - 0.30 * s, saucer_cy - 0.030 * s, cx + 0.30 * s, saucer_cy - 0.005 * s],
        fill=col_alpha,
    )
    # 皿〜ボウルの短い首
    d.polygon([
        (cx - 0.040 * s, saucer_cy - 0.022 * s),
        (cx + 0.040 * s, saucer_cy - 0.022 * s),
        (cx + 0.046 * s, bowl_neck_y),
        (cx - 0.046 * s, bowl_neck_y),
    ], fill=col_alpha)

    # クレイボウル（壺型）
    d.ellipse(
        [cx - 0.115 * s, bowl_cy - 0.07 * s, cx + 0.115 * s, bowl_cy + 0.07 * s],
        fill=col_alpha,
    )
    # ボウル口（上のリム）
    d.ellipse(
        [cx - 0.082 * s, bowl_top - 0.018 * s, cx + 0.082 * s, bowl_top + 0.014 * s],
        fill=col_alpha,
    )
    # ボウル下のすぼまり
    d.polygon([
        (cx - 0.082 * s, bowl_cy + 0.04 * s),
        (cx + 0.082 * s, bowl_cy + 0.04 * s),
        (cx + 0.046 * s, bowl_neck_y),
        (cx - 0.046 * s, bowl_neck_y),
    ], fill=col_alpha)

    # 上に炭（クレイボウルの上に小さく）
    coal_cy = bowl_top - 0.028 * s
    d.ellipse(
        [cx - 0.060 * s, coal_cy - 0.014 * s, cx + 0.060 * s, coal_cy + 0.014 * s],
        fill=(38, 36, 46, alpha),
    )

    # ホース（左の真鍮ボディから出て下にゆるく垂れる）
    hose_pts = [
        (cx - 0.118 * s, brass_mid_cy + 0.02 * s),
        (cx - 0.22 * s, brass_mid_cy + 0.18 * s),
        (cx - 0.33 * s, base_y - 0.40 * s),
        (cx - 0.40 * s, base_y - 0.20 * s),
        (cx - 0.42 * s, base_y - 0.05 * s),
    ]
    smooth_hose = _smooth_profile(hose_pts, steps=14)
    hose_w = int(0.024 * s)
    for i in range(len(smooth_hose) - 1):
        x0, y0 = smooth_hose[i]
        x1, y1 = smooth_hose[i + 1]
        d.line([x0, y0, x1, y1], fill=col_alpha, width=hose_w)
    # ホースの吹き口
    tip = smooth_hose[-1]
    d.ellipse(
        [tip[0] - 0.050 * s, tip[1] - 0.020 * s, tip[0] + 0.010 * s, tip[1] + 0.020 * s],
        fill=col_alpha,
    )


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

    # ---- 1. 文字下を流れる墨の煙のひと吹き（横方向のかすかな帯） ----
    base_smoke = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for i in range(8):
        soft_blob(
            base_smoke,
            W * (0.18 + i * 0.085 + random.uniform(-0.02, 0.02)),
            text_cy + random.uniform(-30, 30),
            random.uniform(220, 320),
            (180, 178, 195),
            random.randint(14, 22),
        )
    base_smoke = base_smoke.filter(ImageFilter.GaussianBlur(60))
    img = Image.alpha_composite(img, base_smoke)

    # ---- 2. 上部の渦巻く墨煙（文字の上にうっすら） ----
    smoke = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    smoke_curl(smoke, W * 0.22, H * 0.17, scale=200, turns=1.6, alpha=46)
    smoke_curl(smoke, W * 0.50, H * 0.11, scale=160, turns=1.3, alpha=42, ccw=True)
    smoke_curl(smoke, W * 0.78, H * 0.18, scale=180, turns=1.5, alpha=46, ccw=True)
    # 文字まわりの薄いもや
    for i in range(14):
        soft_blob(
            smoke,
            random.uniform(W * 0.10, W * 0.90),
            random.uniform(H * 0.14, H * 0.40),
            random.uniform(60, 150),
            (210, 210, 222),
            random.randint(6, 14),
        )
    smoke = smoke.filter(ImageFilter.GaussianBlur(10))
    img = Image.alpha_composite(img, smoke)

    # ---- 3. 両端から立ちのぼる白煙のすじ（青/紫の飛沫の置き換え） ----
    side_smoke = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for sx in (W * 0.10, W * 0.16, W * 0.84, W * 0.90):
        smoke_wisp(side_smoke, sx, H * 0.78, up=H * 0.55, sway=70, steps=40, r0=80,
                   color=(210, 208, 222))
    side_smoke = side_smoke.filter(ImageFilter.GaussianBlur(22))
    img = Image.alpha_composite(img, side_smoke)

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
    # 両脇のダッシュ（片側1本ずつのシンプルな線）
    line_y = sy + (sb[3] - sb[1]) // 2 + 10
    for side in (-1, 1):
        x_in = W / 2 + side * (sw * 0.75)
        x_out = W / 2 + side * (sw * 1.30)
        sd2.line([x_in, line_y, x_out, line_y], fill=col, width=6)
    img = Image.alpha_composite(img, sl)

    # ---- 縮小して書き出し ----
    out = img.resize((OUT_W, int(H * OUT_W / W)), Image.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(out_path)
    print(f"wrote {out_path} ({out_path.stat().st_size:,} bytes, {out.size[0]}x{out.size[1]})")


if __name__ == "__main__":
    main()
