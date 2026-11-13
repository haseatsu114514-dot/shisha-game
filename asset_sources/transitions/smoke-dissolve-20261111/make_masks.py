#!/usr/bin/env python3
"""標準の場面の切り替え「煙のにじみ」（TMG44・A）で使う画像を作る。生成AIは使わず、ノイズから計算する。

- wipe-a.webp / wipe-b.webp  前の背景に掛けるマスク（縦3画面ぶん）。上の1/3は不透明＝前の絵が見える、
  真ん中に煙の形の境目、下の1/3は透明＝次の絵が見える。ゲームはこれを下から上へ送り、2枚を重ねて境目の形を変える。
- haze.webp                  境目と一緒に昇る煙（白。透明度だけの絵）。横に長い帯で、上下は消える。

使い方: python3 asset_sources/transitions/smoke-dissolve-20261111/make_masks.py   （Pillow・numpy が必要）"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "remake/img/ui/transitions/smoke"


def value_noise(h, w, cells_y, cells_x, rng):
    """格子の乱数を滑らかに補間したノイズ（0〜1）。横は端でつながる"""
    grid = rng.random((cells_y + 2, cells_x + 1))
    grid[:, -1] = grid[:, 0]
    y = np.linspace(0, cells_y, h, endpoint=False)
    x = np.linspace(0, cells_x, w, endpoint=False)
    y0 = y.astype(int); x0 = x.astype(int)
    fy = y - y0; fx = x - x0
    fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    a = grid[y0][:, x0]; b = grid[y0][:, x0 + 1]
    c = grid[y0 + 1][:, x0]; d = grid[y0 + 1][:, x0 + 1]
    top = a + (b - a) * fx[None, :]
    bot = c + (d - c) * fx[None, :]
    return top + (bot - top) * fy[:, None]


def fbm(h, w, cells_y, cells_x, seed, octaves=5):
    rng = np.random.default_rng(seed)
    total = np.zeros((h, w)); amp = 0.5; norm = 0
    for o in range(octaves):
        total += amp * value_noise(h, w, cells_y * 2 ** o, cells_x * 2 ** o, rng)
        norm += amp; amp *= 0.5
    return total / norm


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def wipe(seed, cells, amp, soft):
    """縦3画面ぶんのマスク。1画面＝512x288（16:9）"""
    w, h = 512, 288 * 3
    y = (np.arange(h) / h)[:, None]
    n = fbm(h, w, cells[0] * 3, cells[1], seed)
    v = y + (n - 0.5) * amp
    alpha = 1 - smoothstep(0.5 - soft, 0.5 + soft, v)
    alpha[: h // 3 - 4] = 1  # 上の1/3は必ず不透明（始まりで前の絵が欠けない）
    alpha[h * 2 // 3 + 4:] = 0  # 下の1/3は必ず透明（終わりに前の絵が残らない）
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = (alpha * 255).round().astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def haze(seed):
    """境目と一緒に昇る煙。512x288。真ん中の帯に濃く、上下は消える"""
    w, h = 512, 288
    y = (np.arange(h) / h)[:, None]
    band = np.exp(-((y - 0.5) / 0.2) ** 2)
    wisps = fbm(h, w, 3, 6, seed)
    fine = fbm(h, w, 8, 16, seed + 1, octaves=3)
    a = np.clip((wisps - 0.35) * 2.2, 0, 1) * (0.65 + 0.35 * fine) * band
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = (np.clip(a, 0, 1) * 255).round().astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, img in {
        "wipe-a": wipe(20261111, (3, 5), amp=0.16, soft=0.035),
        "wipe-b": wipe(20261112, (2, 3), amp=0.22, soft=0.05),
        "haze": haze(20261113),
    }.items():
        path = OUT / f"{name}.webp"
        img.save(path, "WEBP", quality=82, alpha_quality=90, method=6)
        print(path.relative_to(ROOT), img.size, path.stat().st_size // 1024, "KB")
