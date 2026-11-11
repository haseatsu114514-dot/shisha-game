#!/usr/bin/env python3
"""公式サイトの「質感パーツ」を作る（紙・木目の地、ちぎった紙の縁、マスキングテープ、OGP画像、ファビコン）。

リポジトリのルートで実行する:
    python3 promo/tools/build_parts.py [--textures <CC0テクスチャを展開したフォルダ>]

- 紙と木目は ambientCG の CC0 テクスチャ（写真から作られた実物の質感）を使う。出典は promo/README.md。
  --textures を省くと、すでに書き出してある promo/img/tex/ の地をそのまま使う（縁とテープは作り直せる）。
- ちぎった縁とテープは、その実物の紙の地から切り出して形を付ける。乱数の種は固定なので、何度作っても同じ絵になる。
- 人物・シーシャ機材は描かない。絵はすべてゲームの採用済み素材を使う（build_images.py）。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "promo" / "img"
GAME = ROOT / "remake" / "img"

PAPER = (246, 242, 233)     # 生成りの紙
LAVENDER = (112, 84, 140)   # ゲームのUI「紙とラベンダー」の紫
AMBER = (222, 164, 62)      # ボタンの琥珀
INK = (28, 24, 36)


def save(image: Image.Image, rel: str, quality: int = 82, lossless: bool = False) -> None:
    target = OUT / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", quality=quality, method=6, lossless=lossless)
    print(f"{rel:36s} {image.size[0]:5d}x{image.size[1]:<5d} {target.stat().st_size / 1024:7.1f} KB")


def periodic_noise(rng: np.random.Generator, length: int, octaves: list[tuple[int, float]]) -> np.ndarray:
    """左右がつながる一次元のゆらぎ（横に並べても継ぎ目が出ない）。octaves は (波の数, 振れ幅)。"""
    x = np.arange(length) / length * 2 * np.pi
    out = np.zeros(length)
    for waves, amp in octaves:
        for k in range(waves, waves * 2):
            out += amp / waves * rng.normal() * np.sin(k * x + rng.uniform(0, 2 * np.pi))
    return out


def tile_to(texture: np.ndarray, width: int, height: int) -> np.ndarray:
    reps = (height // texture.shape[0] + 1, width // texture.shape[1] + 1)
    return np.tile(texture, reps)[:height, :width]


def grain_of(texture: Image.Image) -> np.ndarray:
    """紙の地の明暗だけを取り出す（平均0）。色は後から乗せる。"""
    grey = np.asarray(texture.convert("L")).astype(np.float32)
    return grey - grey.mean()


def clean_grain(texture: Image.Image, box: tuple[int, int, int, int], blend: int = 72) -> np.ndarray:
    """テクスチャのきれいな部分だけを切り出し、大きな明るさのむらを除いて、上下左右がつながる地にする。

    元のテクスチャは右端に継ぎ合わせの乱れがあり、強調すると並べた境目が見える。そこを避けて使う。
    """
    crop = texture.convert("L").crop(box)
    grey = np.asarray(crop).astype(np.float32)
    grey -= np.asarray(crop.filter(ImageFilter.GaussianBlur(20))).astype(np.float32)
    h, w = grey.shape
    # 端の blend 幅を、反対側の端と少しずつ混ぜて継ぎ目を消す
    ramp = np.linspace(0, 1, blend, dtype=np.float32)
    keep = np.sqrt(ramp**2 + (1 - ramp) ** 2)  # 混ぜた帯だけ目が眠くならないよう、振れ幅を戻す
    out = grey[:, : w - blend].copy()
    out[:, :blend] = (grey[:, :blend] * ramp + grey[:, w - blend :] * (1 - ramp)) / keep
    grey = out
    out = grey[: h - blend].copy()
    out[:blend] = (grey[:blend] * ramp[:, None] + grey[h - blend :] * (1 - ramp[:, None])) / keep[:, None]
    return out - out.mean()


def tinted(grain: np.ndarray, colour: tuple[int, int, int], strength: float) -> np.ndarray:
    base = np.empty(grain.shape + (3,), dtype=np.float32)
    base[...] = colour
    return np.clip(base + grain[..., None] * strength, 0, 255)


def build_textures(source: Path) -> None:
    paper = Image.open(source / "Paper001" / "Paper001_1K-JPG_Color.jpg")
    relief = Image.open(source / "Paper001" / "Paper001_1K-JPG_Displacement.jpg")
    # 白い紙は色の差が小さいので、凹凸の地図を少し足して繊維の目を見せる
    box = (24, 24, 880, 584)
    grain = clean_grain(paper, box) * 1.7 + clean_grain(relief, box) * 0.14
    save(Image.fromarray(tinted(grain, PAPER, 1.0).astype(np.uint8)), "tex/paper.webp", quality=84)
    save(Image.fromarray(tinted(grain, LAVENDER, 1.25).astype(np.uint8)), "tex/paper-lavender.webp", quality=84)
    save(Image.fromarray(tinted(grain, (36, 27, 46), 0.9).astype(np.uint8)), "tex/paper-night.webp", quality=84)

    kraft = Image.open(source / "Paper006" / "Paper006_1K-JPG_Color.jpg").resize((512, 512), Image.LANCZOS)
    save(kraft, "tex/kraft.webp", quality=80)

    # カウンターの天板。夜の店なので暗く、少しだけ紫へ寄せる
    wood = np.asarray(Image.open(source / "Wood067" / "Wood067_1K-JPG_Color.jpg").convert("RGB")).astype(np.float32)
    wood = wood * np.array([0.62, 0.60, 0.74]) + np.array([10, 6, 14])
    save(Image.fromarray(np.clip(wood, 0, 255).astype(np.uint8)), "tex/counter.webp", quality=72)


def paper_grain() -> np.ndarray:
    path = OUT / "tex" / "paper.webp"
    if not path.exists():
        sys.exit("promo/img/tex/paper.webp がありません。--textures を付けて一度実行してください。")
    return grain_of(Image.open(path))


def torn_strip(rng: np.random.Generator, grain: np.ndarray, colour, width=2048, height=96, flip=False) -> Image.Image:
    """横にくり返せる、ちぎった紙の縁。上が紙、下が透明（flip で上下を返す）。"""
    surface = 34 + periodic_noise(rng, width, [(2, 9.0), (7, 5.0), (23, 3.2), (71, 1.6), (190, 0.9)])
    # 紙は表の層と中の繊維でちぎれる位置がずれる。繊維の白い帯を表より下に出す
    fringe = surface + 7 + np.abs(periodic_noise(rng, width, [(5, 6.0), (19, 4.0), (60, 2.2)])) + rng.random(width) * 2.5
    yy = np.arange(height)[:, None]
    body = np.clip(surface[None, :] - yy + 0.5, 0, 1)
    fibre = np.clip(fringe[None, :] - yy + 0.5, 0, 1)

    tex = tile_to(grain, width, height)
    rgb = tinted(tex, colour, 1.0)
    white = tinted(tex, tuple(min(255, c + 9) for c in colour), 0.6)
    speckle = 0.55 + 0.45 * (rng.random((height, width)) > 0.35)
    fibre_alpha = (fibre - body) * speckle * np.clip(1 - (yy - surface[None, :]) / 18.0, 0.25, 1)
    alpha = np.clip(body + fibre_alpha, 0, 1)
    mix = np.clip(fibre_alpha / np.maximum(alpha, 1e-6), 0, 1)[..., None]
    out = np.dstack([rgb * (1 - mix) + white * mix, alpha[..., None] * 255]).astype(np.uint8)
    image = Image.fromarray(out, "RGBA")
    return image.transpose(Image.FLIP_TOP_BOTTOM) if flip else image


def tape(rng: np.random.Generator, grain: np.ndarray, colour, width=420, height=92, opacity=0.86) -> Image.Image:
    """和紙のマスキングテープ1枚。両端は手でちぎった形、面は少し透ける。"""
    pad = 10
    w, h = width + pad * 2, height + pad * 2
    xx, yy = np.meshgrid(np.arange(w), np.arange(h))
    left = pad + 6 + np.abs(rng.normal(0, 1, h)).cumsum() % 9 + rng.random(h) * 3
    right = w - pad - 6 - (np.abs(rng.normal(0, 1, h)).cumsum() % 9) - rng.random(h) * 3
    left = np.convolve(left, np.ones(3) / 3, mode="same")
    right = np.convolve(right, np.ones(3) / 3, mode="same")
    inside = np.clip(xx - left[:, None] + 0.5, 0, 1) * np.clip(right[:, None] - xx + 0.5, 0, 1)
    inside *= np.clip(yy - pad + 0.5, 0, 1) * np.clip(h - pad - yy + 0.5, 0, 1)

    tex = tile_to(grain, w, h)
    # テープの長手方向に走る繊維の筋と、貼ったときの薄いむら
    streaks = np.convolve(rng.normal(0, 1, h), np.ones(5) / 5, mode="same")[:, None] * 3.0
    blotch = Image.fromarray((rng.random((h // 8 + 1, w // 8 + 1)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    blotch = (np.asarray(blotch).astype(np.float32) - 127) / 127 * 5.0
    rgb = tinted(tex * 1.4 + streaks + blotch, colour, 1.0)
    edge_fade = np.clip((yy - pad) / 5.0, 0.82, 1) * np.clip((h - pad - yy) / 5.0, 0.82, 1)
    alpha = inside * opacity * edge_fade * (0.94 + 0.06 * rng.random((h, w)))
    return Image.fromarray(np.dstack([rgb, alpha[..., None] * 255]).astype(np.uint8), "RGBA")


def build_parts() -> None:
    grain = paper_grain()
    rng = np.random.default_rng(20261111)
    save(torn_strip(rng, grain, PAPER), "parts/torn-paper-down.webp", quality=90)
    save(torn_strip(rng, grain, PAPER, flip=True), "parts/torn-paper-up.webp", quality=90)
    save(torn_strip(rng, grain, LAVENDER), "parts/torn-lavender-down.webp", quality=90)
    save(torn_strip(rng, grain, LAVENDER, flip=True), "parts/torn-lavender-up.webp", quality=90)
    save(tape(rng, grain, (150, 122, 178)), "parts/tape-lavender.webp", quality=90)
    save(tape(rng, grain, AMBER, width=360), "parts/tape-amber.webp", quality=90)
    save(tape(rng, grain, (226, 214, 190), width=300, opacity=0.74), "parts/tape-cream.webp", quality=90)


def build_ogp() -> None:
    """SNSで共有されたときの絵（1200x630）。タイトル画面と同じ組み立て: 夜のラウンジ＋キービジュアル＋ロゴ。"""
    canvas = Image.open(GAME / "backgrounds" / "bg_title.webp").convert("RGB")
    canvas = canvas.resize((1200, 675), Image.NEAREST).crop((0, 22, 1200, 652))
    canvas = Image.eval(canvas, lambda v: int(v * 0.72))
    art = Image.open(GAME / "ui" / "title_arts" / "title_art_tsumugi_04_painting_studio.webp").convert("RGB")
    art = art.resize((560, 840), Image.LANCZOS).crop((0, 60, 560, 690))
    fade = np.clip((np.arange(560) - 20) / 200.0, 0, 1)
    mask = Image.fromarray((np.tile(fade, (630, 1)) * 255).astype(np.uint8))
    canvas.paste(art, (640, 0), mask)
    logo = Image.open(GAME / "ui" / "ui_title_logo_rich.webp").convert("RGBA")
    logo = logo.resize((620, round(620 * logo.height / logo.width)), Image.LANCZOS)
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow.paste((10, 6, 18, 150), (58, 216), logo.split()[3])
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow.filter(ImageFilter.GaussianBlur(14)))
    canvas.alpha_composite(logo, (50, 204))
    target = ROOT / "promo" / "ogp.jpg"
    canvas.convert("RGB").save(target, "JPEG", quality=86, optimize=True, progressive=True)
    print(f"{'ogp.jpg':36s} 1200x630   {target.stat().st_size / 1024:7.1f} KB")


def build_icons() -> None:
    """ロゴの「煙」の字を夜の色の地にのせたアイコン。"""
    logo = Image.open(GAME / "ui" / "ui_title_logo_rich.webp").convert("RGBA")
    alpha = np.asarray(logo.split()[3]).astype(np.float32)
    cols = (alpha[:400].sum(axis=0) > 255 * 3).astype(int)
    # 字の切れ目（透明な列が続くところ）で4文字に分け、2文字目を取り出す
    gaps, start = [], None
    for x, filled in enumerate(cols):
        if filled and start is None:
            start = x
        if not filled and start is not None:
            if x - start > 120:
                gaps.append((start, x))
            start = None
    if len(gaps) < 2:
        sys.exit("ロゴの字の切れ目を見つけられませんでした。")
    x0, x1 = gaps[1]
    rows = np.where(alpha[:400, x0:x1].sum(axis=1) > 255 * 3)[0]
    glyph = logo.crop((x0, rows[0], x1, rows[-1]))
    for size, name in ((180, "apple-touch-icon.png"), (64, "favicon.png")):
        tile = Image.new("RGBA", (size, size), (26, 17, 36, 255))
        scale = size * 0.7 / max(glyph.size)
        g = glyph.resize((round(glyph.width * scale), round(glyph.height * scale)), Image.LANCZOS)
        tile.alpha_composite(g, ((size - g.width) // 2, (size - g.height) // 2))
        tile.convert("RGB").save(ROOT / "promo" / name, optimize=True)
        print(f"{name:36s} {size}x{size}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--textures", type=Path, help="ambientCG の Paper001 / Paper006 / Wood067（1K-JPG）を展開したフォルダ")
    args = parser.parse_args()
    if args.textures:
        build_textures(args.textures)
    build_parts()
    build_ogp()
    build_icons()


if __name__ == "__main__":
    main()
