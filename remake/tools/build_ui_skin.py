"""生成PNGの透明余白を整えて、日常UIのWebPを作る（元PNGは変更しない）。

パッキースロットの図柄・枠（remake/img/ui/pakki-slot/*.png）も、同じフォルダへ軽いWebPを作る。
元のPNGは1254px・約1MBあり、初めて筐体が出たときに読み込みが間に合わず図柄が欠けていた（GUI20）。
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "assets/ui/lounge"
OUT = ROOT / "remake/img/ui/lounge"
SLOT_DIR = ROOT / "remake/img/ui/pakki-slot"

# 拡大筐体（コマ高66px）を3倍密度の画面で表示しても足りる幅。図柄の切り出し矩形は
# reel.css が元の1254px基準で持ち、background-size で合わせるので縮小しても変えなくてよい。
SLOT = {
    "symbols": {"source_size": (1254, 1254), "width": 627},
    "symbols-premium": {"source_size": (1254, 1254), "width": 627},
    "bezel": {"source_size": (1536, 1024), "width": 1024},
}

# 生成画像の物体の外接範囲。装飾を含め、画面外の透明余白だけを除く。
# source_sizeも固定して、別サイズの再生成画像へ古いcropを黙って適用しない。
SPRITES = {
    "panel": {"source_size": (1254, 1254), "crop": (28, 30, 1227, 1218), "width": 640},
    "button": {"source_size": (2172, 724), "crop": (48, 166, 2122, 544), "width": 960},
    "map-pin": {"source_size": (1448, 1086), "crop": (19, 165, 1430, 904), "width": 400},
    "heart": {"source_size": (1254, 1254), "crop": (48, 137, 1206, 1188), "width": 96},
    "reward-clean": {"source_size": (2172, 724), "crop": (5, 86, 2168, 633), "width": 800},
    "gauge-frame": {"source": "gauge", "source_size": (1774, 887), "crop": (43, 263, 1733, 373), "width": 440},
    "gauge-fill": {"source": "gauge", "source_size": (1774, 887), "crop": (43, 565, 1733, 638), "width": 440},
}

# 紙×ラベンダー（日常UI・DUI09）。原画は assets/ui/paper/（生成記録は asset_sources/ui/paper-20261031/）。
PAPER_SOURCES = ROOT / "assets/ui/paper"
PAPER_OUT = ROOT / "remake/img/ui/paper"
# 会話窓は ::before で窓（1216×176）＋上下左右8pxへ 100% 100% に引き伸ばされる。
# 線や煙が縦に潰れないよう、表示と同じ縦横比（1232×192）の @2x に九分割で組んでおく。
PAPER_DIALOGUE = {"source_size": (1536, 1024), "size": (2464, 384),
                  # 原画の切り分け（左, 上, 右, 下）。右下の煙と上の罫線を角の領域に含める。
                  "slice": (120, 230, 280, 440), "scale": 0.5, "radius": 16}


def nine_slice(source, size, slice_, scale):
    """九分割で size に組む。角は scale 倍で保ち、辺と中央だけを伸ばす。"""
    w, h = source.size
    left, top, right, bottom = slice_
    dl, dt, dr, db = (round(v * scale) for v in slice_)
    W, H = size
    xs, dxs = (0, left, w - right, w), (0, dl, W - dr, W)
    ys, dys = (0, top, h - bottom, h), (0, dt, H - db, H)
    out = Image.new("RGBA", size)
    for i in range(3):
        for j in range(3):
            box = (xs[i], ys[j], xs[i + 1], ys[j + 1])
            dest = (dxs[i + 1] - dxs[i], dys[j + 1] - dys[j])
            out.paste(source.crop(box).resize(dest, Image.Resampling.LANCZOS), (dxs[i], dys[j]))
    return out


def rounded(image, radius):
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width - 1, image.height - 1), radius=radius, fill=255)
    image.putalpha(mask)
    return image


def build_paper():
    PAPER_OUT.mkdir(parents=True, exist_ok=True)
    with Image.open(PAPER_SOURCES / "dialogue.png") as source:
        spec = PAPER_DIALOGUE
        if source.size != spec["source_size"]:
            raise ValueError(f"paper dialogue: update PAPER_DIALOGUE for new source size {source.size}")
        frame = rounded(nine_slice(source.convert("RGBA"), spec["size"], spec["slice"], spec["scale"]), spec["radius"])
        frame.save(PAPER_OUT / "dialogue.webp", "WEBP", quality=88, alpha_quality=100, method=6)
    # 板は CSS の border-image で九分割する（切り分けは 72/512px）。
    with Image.open(PAPER_SOURCES / "panel.png") as source:
        source.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS).save(PAPER_OUT / "panel.webp", "WEBP", quality=88, method=6)
    with Image.open(PAPER_SOURCES / "lavender.png") as source:
        source.convert("RGB").resize((256, 256), Image.Resampling.LANCZOS).save(PAPER_OUT / "lavender.webp", "WEBP", quality=88, method=6)
    for path in sorted(PAPER_OUT.glob("*.webp")):
        print(f"{path.relative_to(ROOT)}: {path.stat().st_size:,} bytes")


def main():
    build_paper()
    OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in SPRITES.items():
        with Image.open(SOURCES / f"{spec.get('source', name)}.png") as source:
            if source.size != spec["source_size"]:
                raise ValueError(f"{name}: update crop for new source size {source.size}")
            sprite = source.convert("RGBA").crop(spec["crop"])
            width = spec["width"]
            sprite = sprite.resize((width, round(width * sprite.height / sprite.width)), Image.Resampling.LANCZOS)
            path = OUT / f"{name}.webp"
            sprite.save(path, "WEBP", lossless=True, quality=100, method=6, exact=True)
            print(f"{path.relative_to(ROOT)}: {sprite.width}×{sprite.height}, {path.stat().st_size:,} bytes")
    for name, spec in SLOT.items():
        with Image.open(SLOT_DIR / f"{name}.png") as source:
            if source.size != spec["source_size"]:
                raise ValueError(f"{name}: update reel.css and SLOT for new source size {source.size}")
            width = spec["width"]
            sprite = source.convert("RGBA").resize((width, round(width * source.height / source.width)), Image.Resampling.LANCZOS)
            path = SLOT_DIR / f"{name}.webp"
            # 図柄はドット絵ではないので非可逆（アルファは可逆）。PNGの1/10以下になる
            sprite.save(path, "WEBP", quality=90, alpha_quality=100, method=6)
            print(f"{path.relative_to(ROOT)}: {sprite.width}×{sprite.height}, {path.stat().st_size:,} bytes")

if __name__ == "__main__":
    main()
