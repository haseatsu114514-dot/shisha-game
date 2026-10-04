"""生成PNGの透明余白を整えて、日常UIのWebPを作る（元PNGは変更しない）。"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "assets/ui/lounge"
OUT = ROOT / "remake/img/ui/lounge"

# 生成画像の物体の外接範囲。装飾を含め、画面外の透明余白だけを除く。
# source_sizeも固定して、別サイズの再生成画像へ古いcropを黙って適用しない。
SPRITES = {
    "panel": {"source_size": (1254, 1254), "crop": (28, 30, 1227, 1218), "width": 640},
    "button": {"source_size": (2172, 724), "crop": (48, 166, 2122, 544), "width": 960},
    "map-pin": {"source_size": (1448, 1086), "crop": (19, 165, 1430, 904), "width": 400},
    "heart": {"source_size": (1254, 1254), "crop": (48, 137, 1206, 1188), "width": 96},
    "reward": {"source_size": (2172, 724), "crop": (5, 86, 2168, 633), "width": 800},
    "gauge-frame": {"source": "gauge", "source_size": (1774, 887), "crop": (43, 263, 1733, 373), "width": 440},
    "gauge-fill": {"source": "gauge", "source_size": (1774, 887), "crop": (43, 565, 1733, 638), "width": 440},
}

def main():
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

if __name__ == "__main__":
    main()
