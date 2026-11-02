"""Fit these expression sources to their normal portraits without pose dependent scaling."""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).resolve().parent
SPRITES = ROOT / "assets/sprites/characters"
SIZE = (896, 1200)


def metrics(image):
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value >= 24 else 0)
    box = mask.getbbox()
    if box is None:
        raise ValueError("Portrait has no visible pixels")
    band_top = box[3] - max(1, round((box[3] - box[1]) * 0.2))
    feet = mask.crop((0, band_top, image.width, box[3]))
    histogram = [0] * image.width
    for row in range(feet.height):
        for column in range(feet.width):
            if feet.getpixel((column, row)):
                histogram[column] += 1
    foot_x = sum(column * count for column, count in enumerate(histogram)) / sum(histogram)
    return box, foot_x


def main():
    for character_dir in sorted(SOURCE.iterdir()):
        if not character_dir.is_dir():
            continue
        character = character_dir.name
        normal = Image.open(SPRITES / character / f"chr_{character}_normal.png").convert("RGBA")
        normal_box, normal_foot_x = metrics(normal)
        for source in sorted(character_dir.glob("*-source.png")):
            face = source.stem.removesuffix("-source")
            image = Image.open(source).convert("RGBA")
            if image.size != (1084, 1451):
                raise ValueError(f"Unexpected source size: {source}: {image.size}")
            scaled = image.resize((892, 1195), Image.Resampling.LANCZOS)
            centered = Image.new("RGBA", SIZE, (0, 0, 0, 0))
            centered.paste(scaled, (2, 2))
            box, foot_x = metrics(centered)
            dx = round(normal_foot_x - foot_x)
            dy = normal_box[3] - box[3]
            if box[0] + dx < 0 or box[2] + dx > SIZE[0] or box[1] + dy < 0 or box[3] + dy > SIZE[1]:
                raise ValueError(f"Sprite would clip: {character}/{face}")
            output = Image.new("RGBA", SIZE, (0, 0, 0, 0))
            output.paste(centered, (dx, dy))
            target = SPRITES / character / f"chr_{character}_{face}.png"
            output.save(target, optimize=True)
            print(f"{character}/{face}: shift ({dx:+d}, {dy:+d}), bbox {metrics(output)[0]}")


if __name__ == "__main__":
    main()
