#!/usr/bin/env python3
"""モーション改善案の見本で使う派生画像を、採用済みの絵から作る。
- cards/back.webp          占いの札の裏（Issue #3254 で Codex が作った札の裏。透過の外側を切り落として縮小）
- cards/front-frame.webp   札の表の枠（#3254。窓に入れる札の絵は #3278 で依頼中。相手の絵柄は使わない＝オーナー指示）
- stills/train-streak.webp 新幹線の車窓の「流れ」。車内の絵の窓の中だけを行ごとに横へ引き伸ばしたもの
使い方: python3 remake/previews/motion-direction/make_assets.py   （Pillow・numpy が必要）"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).parent
BG = ROOT / "remake/img/backgrounds"
TAROT = ROOT / "remake/img/ui/transitions/tarot"  # #3254 の札（原画は asset_sources/transitions/motion-props-3254/raw/）
CARD_BOX = (87, 60, 937, 1457)  # 札の外形（1024x1536 の中。裏と表の枠で共通）
W, H = 420, round(420 * (CARD_BOX[3] - CARD_BOX[1]) / (CARD_BOX[2] - CARD_BOX[0]))  # 420x690（index.html の .card の比率と同じ）


def card_back():
    card = Image.open(TAROT / "card-back.webp").convert("RGBA").crop(CARD_BOX)
    return card.resize((W, H), Image.Resampling.LANCZOS)


def card_front():
    """表の枠だけ（窓は生成りの無地）。窓に入れる札の絵は占う相手ごとの大アルカナで、Codex に依頼中（#3278）"""
    return Image.open(TAROT / "card-front-frame.webp").convert("RGBA").crop(CARD_BOX).resize((W, H), Image.Resampling.LANCZOS)


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
    card_back().save(HERE / "cards/back.webp", quality=88, alpha_quality=100, method=6)
    card_front().save(HERE / "cards/front-frame.webp", quality=88, alpha_quality=100, method=6)
    train_streak().save(HERE / "stills/train-streak.webp", quality=82, method=6)
    print("ok")
