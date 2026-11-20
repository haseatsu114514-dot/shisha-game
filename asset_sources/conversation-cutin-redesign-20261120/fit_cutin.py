#!/usr/bin/env python3
"""会話カットインの原画（全面マゼンタ背景）を、ゲーム用の透過 WebP にする。原画は編集しない。

  python3 asset_sources/conversation-cutin-redesign-20261120/fit_cutin.py

- マゼンタらしさ（min(R,B)-G）から透過を作り、半透明の縁はマゼンタを差し引いて元の色へ戻す。
- 不透明な部分に残るマゼンタのかぶり（R と B だけが G より高い）を弱める。肌（B<G）や黒い服は変わらない。
- 人物の外接箱で切り抜き、SCALE 倍に縮めて remake/img/ui/conversation_cutin/hajime_<名前>.webp に書く。
- 測った値（原画の px）: 帽子のてっぺん・あごの y と両目の中心。ここから ART の face・head を出して表示する。
"""
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "remake/img/ui/conversation_cutin"
MAGENTA = np.array([252, 3, 252], np.float32)
SCALE = 0.6
# 原画（1254×1254）で測った値。cap・chin は y、eyes は左右の黒目の中心
MEASURE = {
    "flustered": {"cap": 40, "chin": 735, "eyes": [(620, 475), (805, 525)]},
    "downcast": {"cap": 40, "chin": 790, "eyes": [(650, 560), (830, 610)]},
    "grateful": {"cap": 30, "chin": 690, "eyes": [(655, 450), (820, 510)]},
}
# 仮の絵（#3962）の置き方に合わせる換算: 顔の中心は両目の中点から (-0.02H, +0.119H)、head は 0.932H（H は帽子〜あご）
FACE_DX, FACE_DY, HEAD_K = -0.02, 0.119, 0.932


def key(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    m = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    alpha = np.clip((200 - m) / 110, 0, 1)
    safe = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.where(alpha[..., None] < 1, (a - (1 - alpha[..., None]) * MAGENTA) / safe, a)
    rgb = np.clip(rgb, 0, 255)
    excess = np.clip(np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1] - 12, 0, None)
    rgb[..., 0] -= excess
    rgb[..., 2] -= excess
    alpha[alpha < 0.04] = 0
    return np.dstack([rgb, alpha * 255]).astype(np.uint8)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, m in MEASURE.items():
        im = Image.fromarray(key(HERE / "originals" / f"hajime_cutin_{name}.png"), "RGBA")
        l, t, r, b = im.getchannel("A").getbbox()
        im = im.crop((l, t, r, b))
        w, h = round(im.width * SCALE), round(im.height * SCALE)
        im = im.resize((w, h), Image.LANCZOS)
        im.save(OUT / f"hajime_{name}.webp", quality=90, method=6)
        H = m["chin"] - m["cap"]
        ex = (m["eyes"][0][0] + m["eyes"][1][0]) / 2 + FACE_DX * H
        ey = (m["eyes"][0][1] + m["eyes"][1][1]) / 2 + FACE_DY * H
        face = [round((ex - l) * SCALE), round((ey - t) * SCALE)]
        print(f'{name}: {{ file: "hajime_{name}.webp", w: {w}, h: {h}, face: {face}, head: {round(HEAD_K * H * SCALE)} }}')


if __name__ == "__main__":
    main()
