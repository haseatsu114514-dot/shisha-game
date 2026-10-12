"""Copy generated prop cutouts and encode lossless WebP; no creative image edits."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
records = []
for key, raw in [("target_board", "target-board-source.png"), ("throwing_axe", "throwing-axe-clean-source.png")]:
    source = HERE / "raw" / raw
    im = Image.open(source)
    assert im.mode == "RGBA" and im.getchannel("A").getextrema()[0] == 0
    png = ROOT / "assets/ui/axe_throw" / (key + ".png")
    webp = ROOT / "remake/img/ui/axe_throw" / (key + ".webp")
    png.parent.mkdir(parents=True, exist_ok=True)
    webp.parent.mkdir(parents=True, exist_ok=True)
    png.write_bytes(source.read_bytes())
    im.save(webp, format="WEBP", lossless=True, exact=True, method=6)
    assert im.tobytes() == Image.open(webp).convert("RGBA").tobytes()
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    records.append({"key": key, "source": str(source.relative_to(ROOT)), "png": str(png.relative_to(ROOT)),
                    "webp": str(webp.relative_to(ROOT)), "size": im.size, "source_sha256": sha(source),
                    "png_sha256": sha(png), "webp_sha256": sha(webp), "rgba_equal": True,
                    "alpha_range": im.getchannel("A").getextrema()})
(HERE / "registration.json").write_text(json.dumps({"props": records, "minigame_connected": False}, indent=2) + "\n")
print("PASS: generated board/axe copied unchanged; lossless RGBA WebP; game connection belongs to #480")
