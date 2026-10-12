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
for path, digest in baseline["files"].items():
    assert sha(ROOT / path) == digest, path
assert {k: v for k, v in manifest["portraits"]["hiyori"].items() if k != "faces"} == {k: v for k, v in baseline["portrait"].items() if k != "faces"}
for record in registration["normalized"]:
    src, png = ROOT / record["source"], ROOT / record["file"]
    assert sha(src) == record["source_sha256"] and sha(png) == record["sha256"]
    im = Image.open(png)
    assert im.size == (896, 1200) and im.mode == "RGBA" and im.getchannel("A").getextrema() == (0, 255)
    rel = png.relative_to(ROOT / "assets")
    assert str(rel) in manifest["webp"] and record["face"] in manifest["portraits"]["hiyori"]["faces"]
    assert im.tobytes() == Image.open(ROOT / "remake/img" / rel.with_suffix(".webp")).convert("RGBA").tobytes()
bg = ROOT / registration["background"]
assert sha(bg) == registration["background_sha256"] == sha(HERE / "raw/axe-background-source.png")
assert bg.name in manifest["backgrounds"]
assert Image.open(ROOT / "remake/img/backgrounds" / bg.with_suffix(".webp").name).size == Image.open(bg).size
print("PASS: 13 adopted files unchanged; 5 lossless poses; original dedicated background; shared framing preserved")
