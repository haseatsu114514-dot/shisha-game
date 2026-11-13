"""Fit Rio's approved originals to the shared 896x1200 portrait canvas."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).resolve().parent / "originals"
FACES = ("normal", "sad", "serious", "shock", "smile", "smug", "surprise")


def alpha_bbox(image):
    return image.getchannel("A").point(lambda a: 255 if a >= 16 else 0).getbbox()


for style in ("new", "nanami"):
    for face in FACES:
        source = SOURCE / style / f"chr_rio_{face}.png"
        target = ROOT / "assets/sprites/character_variants" / style / "rio" / source.name
        image = Image.open(source).convert("RGBA")
        bounds = alpha_bbox(image)
        assert bounds is not None, source
        figure = image.crop(bounds)
        assert figure.height >= 1300, (source, figure.height)
        width = round(figure.width * 1080 / figure.height)
        figure = figure.resize((width, 1080), Image.Resampling.LANCZOS)
        x = round((896 - width) / 2)
        assert x > 0 and x + width < 896, (source, x, width)
        canvas = Image.new("RGBA", (896, 1200), (0, 0, 0, 0))
        canvas.alpha_composite(figure, (x, 60))
        target.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(target, optimize=True)
        print(f"{style}/{face}: source={bounds} output={alpha_bbox(canvas)}")
