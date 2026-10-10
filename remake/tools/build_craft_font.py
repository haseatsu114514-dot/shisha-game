"""モックアップの制作見出し・操作ボタン用に、Zen Old Minchoを必要な字へ絞る。"""
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlretrieve

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = "https://raw.githubusercontent.com/google/fonts/main/ofl/zenoldmincho/"
DEST = ROOT / "remake/fonts"


def main():
    with TemporaryDirectory() as tmp:
        source = Path(tmp) / "ZenOldMincho-Bold.ttf"
        urlretrieve(SOURCE + source.name, source)
        font = TTFont(source)
        options = subset.Options()
        options.name_IDs = ["*"]
        sub = subset.Subsetter(options=options)
        sub.populate(text="吸い出し熱管理吸う（針を止める）提供する整え終える吸っている…")
        sub.subset(font)
        names = {1: "Craft Mincho", 3: "CraftMincho-Bold-1.0", 4: "Craft Mincho Bold",
                 6: "CraftMincho-Bold", 16: "Craft Mincho"}
        for name in font["name"].names:
            if name.nameID in names:
                name.string = names[name.nameID].encode(name.getEncoding())
        font.save(DEST / "ZenOldMincho-Craft.ttf")
    urlretrieve(SOURCE + "OFL.txt", DEST / "OFL-ZenOldMincho.txt")
    print("wrote Craft Mincho subset and its OFL license")


if __name__ == "__main__":
    main()
