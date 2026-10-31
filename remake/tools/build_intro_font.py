"""採用登場カット用のNoto Sans JPを、正本と既存の紹介上書きからサブセット化する。"""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlretrieve

from fontTools.ttLib import TTFont
from fontTools import subset

ROOT = Path(__file__).resolve().parents[2]
SOURCE = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/"
DEST = ROOT / "remake/fonts"


def main():
    # 初遭遇版や会話からの上書きも含める。制作プレビューの文字に依存しない。
    characters = json.loads((ROOT / "data/characters.json").read_text())
    characters.append(json.loads((ROOT / "data/dialogue/samechan.json").read_text())["profile"])
    text = "".join(json.dumps({key: value for key, value in c.items()
                              if key in ("name", "full_name", "display_name", "private_name") or key.startswith("intro_cutin")},
                             ensure_ascii=False) for c in characters)

    def intro_overrides(value):
        if isinstance(value, dict):
            if value.get("type") == "intro":
                return json.dumps(value, ensure_ascii=False)
            return "".join(intro_overrides(child) for child in value.values())
        if isinstance(value, list):
            return "".join(intro_overrides(child) for child in value)
        return ""

    for path in (ROOT / "data/dialogue").glob("*.json"):
        text += intro_overrides(json.loads(path.read_text()))
    # 好きなフレーバーの札（表示名は intro-flavors.js、出典は favorite_flavor）
    text += "好きなフレーバー" + "".join(c.get("favorite_flavor") or "" for c in characters)
    text += (ROOT / "remake/js/vn/intro-flavors.js").read_text()
    with TemporaryDirectory() as tmp:
        path = Path(tmp) / "NotoSansJP.ttf"
        urlretrieve(SOURCE + "NotoSansJP%5Bwght%5D.ttf", path)
        font = TTFont(path)
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        sub = subset.Subsetter(options=options)
        sub.populate(text=text + "「」？？？")
        sub.subset(font)
        font.flavor = "woff2"
        font.save(DEST / "NotoSansJP-Intro.woff2")
    urlretrieve(SOURCE + "OFL.txt", DEST / "OFL-NotoSansJP.txt")
    license_path = DEST / "OFL-NotoSansJP.txt"
    license_path.write_text("\n".join(line.rstrip() for line in license_path.read_text().splitlines()) + "\n")
    print("wrote remake/fonts/NotoSansJP-Intro.woff2 and its OFL license")


if __name__ == "__main__":
    main()
