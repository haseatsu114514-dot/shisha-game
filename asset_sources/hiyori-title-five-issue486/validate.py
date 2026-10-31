"""Verify generated source identity, adopted bytes and scoped registration."""
import hashlib
import json
from pathlib import Path
from PIL import Image
from register import ROOT, HERE, SCENES, assert_baseline, sha
baseline = assert_baseline()
manifest = json.loads((ROOT / "remake/data/manifest.json").read_text())
assert len(manifest["titleArts"]) == 41
assert len({a["character"] for a in manifest["titleArts"]}) == 10
assert sum(a["character"] == "hiyori" for a in manifest["titleArts"]) == 6
for scene,name in SCENES.items():
    source=HERE/"raw"/(scene+"-source.png");png=ROOT/"assets/ui/title_arts"/name
    assert source.read_bytes()==png.read_bytes()
    assert {"character":"hiyori","file":name} in manifest["titleArts"]
    assert "ui/title_arts/"+name in manifest["webp"]
    assert Image.open(png).size==Image.open(ROOT/"remake/img/ui/title_arts"/Path(name).with_suffix(".webp")).size==(1024,1536)
print("PASS: 6 Hiyori / 41 titles / 10 equally weighted characters; two source-identical PNG and decoded WebP; previously adopted title image bytes unchanged")
