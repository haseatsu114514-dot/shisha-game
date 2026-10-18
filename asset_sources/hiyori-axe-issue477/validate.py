"""Check adopted binaries, lossless additions and shared framing without regenerating art."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
baseline = json.loads((HERE / "baseline.json").read_text())
registration = json.loads((HERE / "registration.json").read_text())
manifest = json.loads((ROOT / "remake/data/manifest.json").read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
# baseline["files"] records the portraits before the approved issue #664 redraw.
# Keep that historical receipt; current portrait bytes are checked below by
# size, manifest registration and lossless PNG/WebP equality.
assert manifest["portraits"]["hiyori"]["h"] == 0.8333  # 1000 / 1200 after #664
assert manifest["portraits"]["hiyori"]["aspect"] == baseline["portrait"]["aspect"]
for record in registration["normalized"]:
    src, png = ROOT / record["source"], ROOT / record["file"]
    assert sha(src) == record["source_sha256"]
    im = Image.open(png)
    assert im.size == (896, 1200) and im.mode == "RGBA" and im.getchannel("A").getextrema() == (0, 255)
    rel = png.relative_to(ROOT / "assets")
    assert str(rel) in manifest["webp"] and record["face"] in manifest["portraits"]["hiyori"]["faces"]
    assert im.tobytes() == Image.open(ROOT / "remake/img" / rel.with_suffix(".webp")).convert("RGBA").tobytes()
bg = ROOT / registration["background"]
assert sha(bg) == registration["background_sha256"] == sha(HERE / "raw/axe-background-source.png")
assert bg.name in manifest["backgrounds"]
assert Image.open(ROOT / "remake/img/backgrounds" / bg.with_suffix(".webp").name).size == Image.open(bg).size
print("PASS: 5 registered lossless poses; original dedicated background; shared framing preserved")
props = json.loads((HERE / "props/registration.json").read_text())["props"]
for record in props:
    source, png, webp = [ROOT / record[key] for key in ["source", "png", "webp"]]
    assert sha(source) == record["source_sha256"] == sha(png) == record["png_sha256"]
    assert sha(webp) == record["webp_sha256"]
    im = Image.open(png)
    assert im.mode == "RGBA" and im.getchannel("A").getextrema()[0] == 0
    assert im.tobytes() == Image.open(webp).convert("RGBA").tobytes()
    alpha = im.getchannel("A")
    assert all(alpha.crop(box).getextrema()[1] == 0 for box in [
        (0, 0, im.width, 1), (0, im.height - 1, im.width, im.height),
        (0, 0, 1, im.height), (im.width - 1, 0, im.width, im.height)])
print("PASS: two generated transparent props, clear perimeter and lossless RGBA WebP")
