#!/usr/bin/env python3
"""モーション改善案の見本で使う派生画像を、採用済みの絵から作る（新しい絵は生成しない）。
- cards/back.webp          占い師の登場カットインの背景に描かれた札（月と草花）を正面へ起こしたもの
- cards/front-tsumugi.webp 札の金の縁はそのまま、中だけ占う相手（つむぎ）の登場カットインの絵柄
- stills/train-streak.webp 新幹線の車窓の「流れ」。車内の絵の窓の中だけを行ごとに横へ引き伸ばしたもの
使い方: python3 remake/previews/motion-direction/make_assets.py   （Pillow・numpy が必要）"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).parent
INTRO = ROOT / "remake/img/ui/character_intros/graphic"
BG = ROOT / "remake/img/backgrounds"
W, H = 420, 700  # 札の大きさ（3:5）


def coeffs(dst, src):
    """dst の4点（出力）→ src の4点（元の絵）へ写す射影変換の係数"""
    rows = []
    for (x, y), (u, v) in zip(dst, src):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    return np.linalg.solve(np.array(rows, dtype=float), np.array(src, dtype=float).reshape(8)).tolist()


def card_back():
    art = Image.open(INTRO / "bg_uranaishi.webp").convert("RGB")
    # 手前の札の四隅（左上・右上・右下・左下）。丸い角の外側の交点
    quad = [(1366.0, 141.5), (1518.5, 186.5), (1431.0, 446.0), (1258.5, 380.5)]
    card = art.transform((W, H), Image.Transform.PERSPECTIVE, coeffs([(0, 0), (W, 0), (W, H), (0, H)], quad), Image.Resampling.BICUBIC)
    return card.filter(ImageFilter.UnsharpMask(radius=1.4, percent=60, threshold=2))


def card_front(back):
    art = Image.open(INTRO / "bg_tsumugi.webp").convert("RGB")
    out = back.copy()
    ix, iy = round(W * 0.118), round(H * 0.072)  # 金の縁と細い内枠の内側
    iw, ih = W - ix * 2, H - iy * 2
    # 藤棚と遠景の縦長の一角（左側）を、内側と同じ縦横比で切る
    ch = 880
    cw = round(ch * iw / ih)
    scene = art.crop((60, 30, 60 + cw, 30 + ch)).resize((iw, ih), Image.Resampling.LANCZOS)
    # 角を丸く抜き、札の金と同じ色の細い内枠で継ぎ目を締める
    k = 3
    mask = Image.new("L", (iw * k, ih * k), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, iw * k - 1, ih * k - 1], radius=15 * k, fill=255)
    out.paste(scene, (ix, iy), mask.resize((iw, ih), Image.Resampling.LANCZOS))
    line = Image.new("RGBA", (W * k, H * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(line)
    d.rounded_rectangle([(ix - 2) * k, (iy - 2) * k, (ix + iw + 2) * k, (iy + ih + 2) * k], radius=17 * k, outline=(38, 20, 52, 255), width=3 * k)
    d.rounded_rectangle([(ix - 1) * k, (iy - 1) * k, (ix + iw + 1) * k, (iy + ih + 1) * k], radius=16 * k, outline=(214, 178, 106, 255), width=2 * k)
    out = out.convert("RGBA")
    out.alpha_composite(line.resize((W, H), Image.Resampling.LANCZOS))
    return out.convert("RGB")


def window_left(y):
    """車内の絵の窓の、高さ y（％）での左端（％）。index.html の .win の clip-path と同じ形（高さ, 左端）"""
    edge = [(0, 33.4), (30, 33.6), (43, 34.2), (47.6, 35.6), (50.6, 39), (54.4, 46), (60.6, 58), (68, 72), (75.5, 86), (83, 100)]
    for (y0, x0), (y1, x1) in zip(edge, edge[1:]):
        if y0 <= y <= y1:
            return x0 + (x1 - x0) * (y - y0) / (y1 - y0)
    return 100.0


def wrap_blur(arr, size, axis):
    """端を回り込ませた移動平均（横に並べても継ぎ目が出ない）"""
    pad = size // 2
    n = arr.shape[axis]
    padded = np.concatenate([np.take(arr, range(n - pad, n), axis=axis), arr, np.take(arr, range(pad), axis=axis)], axis=axis)
    csum = np.cumsum(padded, axis=axis, dtype=np.float64)
    csum = np.concatenate([np.zeros_like(np.take(csum, [0], axis=axis)), csum], axis=axis)
    return ((np.take(csum, range(size, size + n), axis=axis) - np.take(csum, range(n), axis=axis)) / size).astype(np.float32)


def train_streak():
    """行ごとに、窓の中の景色の平均の色へ横の筋を乗せる（形は残さず、色と速さだけを残す）"""
    art = Image.open(BG / "bg_ch3_train_arrival.webp").convert("RGB")
    a = np.asarray(art, dtype=np.float32)
    ah, aw = a.shape[:2]
    oh, ow = 360, 512
    base = np.zeros((oh, 1, 3), dtype=np.float32)
    content = np.zeros((oh, ow, 3), dtype=np.float32)
    for row in range(oh):
        y = (row + 0.5) / oh * 100
        if y > 82:
            base[row] = base[row - 1]
            content[row] = content[row - 1]
            continue
        left = min(97.0, window_left(y) + 2.5)  # 窓枠を避けて少し内側から
        seg = a[min(ah - 1, int(y / 100 * ah)), int(left / 100 * aw):aw]
        base[row, 0] = seg.mean(axis=0)
        xs = np.linspace(0, len(seg) - 1, ow // 2)
        line = np.stack([np.interp(xs, np.arange(len(seg)), seg[:, c]) for c in range(3)], axis=1)
        content[row] = np.concatenate([line, line[::-1]])
    content = wrap_blur(content, 151, axis=1)
    rng = np.random.default_rng(20261111)
    noise = wrap_blur(rng.standard_normal((oh, ow)).astype(np.float32), 71, axis=1)
    noise = (noise[:-2] + noise[1:-1] + noise[2:]) / 3
    noise = np.pad(noise, ((1, 1), (0, 0)), mode="edge")
    noise = noise / np.abs(noise).max()
    out = (0.55 * base + 0.45 * content) * (1 + 0.2 * noise[:, :, None])
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


if __name__ == "__main__":
    (HERE / "cards").mkdir(exist_ok=True)
    (HERE / "stills").mkdir(exist_ok=True)
    back = card_back()
    back.save(HERE / "cards/back.webp", quality=90, method=6)
    card_front(back).save(HERE / "cards/front-tsumugi.webp", quality=90, method=6)
    train_streak().save(HERE / "stills/train-streak.webp", quality=82, method=6)
    print("ok")
