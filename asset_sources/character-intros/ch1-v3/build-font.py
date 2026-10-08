"""Generate the licensed WOFF2 text subset used by this editable review."""
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlretrieve
from fontTools.ttLib import TTFont
from fontTools import subset

base = Path(__file__).resolve().parent
source = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/"
with TemporaryDirectory() as tmp:
 path = Path(tmp) / "NotoSansJP.ttf"
 urlretrieve(source + "NotoSansJP%5Bwght%5D.ttf", path)
 font = TTFont(path)
 options = subset.Options()
 options.flavor = "woff2"
 options.layout_features = ["*"]
 sub = subset.Subsetter(options=options)
 text = "".join((base / f).read_text() for f in ("characters.json", "index.html", "preview.js"))
 sub.populate(text=text + "（「」）")
 sub.subset(font)
 font.flavor = "woff2"
 font.save(base / "fonts/NotoSansJP-Intro.woff2")
urlretrieve(source + "OFL.txt", base / "fonts/OFL-NotoSansJP.txt")
