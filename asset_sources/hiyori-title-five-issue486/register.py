"""Copy the two authored originals and encode only their distribution WebP.
No image editing, old image regeneration or shared manifest timestamp update.
"""
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SCENES = {"bookshop": "title_art_hiyori_04_daylight_bookshop.png", "ramen": "title_art_hiyori_05_ramen_break.png"}
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def assert_baseline():
    baseline = json.loads((HERE / "baseline.json").read_text())
    for sub, suffix, key in [("assets/ui/title_arts", "png", "title_source_sha256"), ("remake/img/ui/title_arts", "webp", "title_webp_sha256")]:
        actual = {sha(p) for p in (ROOT / sub).glob("title_art_*." + suffix)}
        assert set(baseline[key]) <= actual, "Previously adopted image bytes changed"
    assert all(sha(ROOT / p) == digest for p, digest in baseline["hiyori_files"].items()), "Hiyori portrait bytes changed"
    return baseline
if __name__ == "__main__":
    baseline = assert_baseline()
    manifest_path = ROOT / "remake/data/manifest.json"
    before = json.loads(manifest_path.read_text())
    spec = importlib.util.spec_from_file_location("encode_new_title", ROOT / "remake/tools/build_images.py")
    encoder = importlib.util.module_from_spec(spec); spec.loader.exec_module(encoder)
    manifest = json.loads(json.dumps(before))
    receipts = []
    for scene, name in SCENES.items():
        source = HERE / "raw" / (scene + "-source.png")
        im = Image.open(source); assert im.size == (1024,1536) and im.mode in ["RGB","RGBA"]
        if im.mode == "RGBA": assert im.getchannel("A").getextrema() == (255,255)
        destination = ROOT / "assets/ui/title_arts" / name
        destination.write_bytes(source.read_bytes())
        rel = "ui/title_arts/" + name
        webp = ROOT / "remake/img" / Path(rel).with_suffix(".webp")
        webp.write_bytes(encoder.encode(destination, rel))
        assert Image.open(webp).size == im.size
        entry = {"character": "hiyori", "file": name}
        if entry not in manifest["titleArts"]: manifest["titleArts"].append(entry)
        manifest["webp"] = sorted(set(manifest["webp"]) | {rel})
        receipts.append({"scene":scene,"source":str(source.relative_to(ROOT)),"png":str(destination.relative_to(ROOT)),"png_sha256":sha(destination),"source_sha256":sha(source),"webp":str(webp.relative_to(ROOT)),"webp_sha256":sha(webp),"size":list(im.size)})
    manifest["titleArts"].sort(key=lambda entry:entry["file"])
    assert {k:v for k,v in before.items() if k not in ["titleArts","webp"]} == {k:v for k,v in manifest.items() if k not in ["titleArts","webp"]}
    assert len(manifest["titleArts"]) == 23 and sum(a["character"]=="hiyori" for a in manifest["titleArts"]) == 5
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=1)+"\n")
    assert_baseline()
    (HERE / "registration.json").write_text(json.dumps({"registered_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"old_bytes_unchanged":True,"manifest_other_fields_unchanged":True,"title_count":23,"hiyori_title_count":5,"outputs":receipts},indent=2)+"\n")
    print("Registered two Hiyori CGs: 5 Hiyori / 23 total; previous image bytes and other manifest fields preserved")
