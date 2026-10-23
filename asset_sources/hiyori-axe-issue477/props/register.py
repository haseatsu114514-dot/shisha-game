"""Copy generated prop cutouts and encode lossless WebP; no creative image edits."""
import hashlib
import importlib.util
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
records = []
spec = importlib.util.spec_from_file_location("build_images", ROOT / "remake/tools/build_images.py")
encoder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(encoder)
for key, raw in [("target_board", "target-board-source.png"), ("throwing_axe", "throwing-axe-clean-source.png")]:
    source = HERE / "raw" / raw
    im = Image.open(source)
    assert im.mode == "RGBA" and im.getchannel("A").getextrema()[0] == 0
    png = ROOT / "assets/ui/axe_throw" / (key + ".png")
    webp = ROOT / "remake/img/ui/axe_throw" / (key + ".webp")
    png.parent.mkdir(parents=True, exist_ok=True)
    webp.parent.mkdir(parents=True, exist_ok=True)
    png.write_bytes(source.read_bytes())
    webp.write_bytes(encoder.encode(png, f"ui/axe_throw/{key}.png"))
    assert im.tobytes() == Image.open(webp).convert("RGBA").tobytes()
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    records.append({"key": key, "source": str(source.relative_to(ROOT)), "png": str(png.relative_to(ROOT)),
                    "webp": str(webp.relative_to(ROOT)), "size": im.size, "source_sha256": sha(source),
                    "png_sha256": sha(png), "webp_sha256": sha(webp), "rgba_equal": True,
                    "alpha_range": im.getchannel("A").getextrema()})
    if key == "target_board":
        # In-game display derivative (#785): RGBA LANCZOS downscale, lossy WebP with exact transparent colour.
        display = webp.with_name(key + "_display.webp")
        size = (800, 800)
        Image.open(png).convert("RGBA").resize(size, Image.Resampling.LANCZOS).save(
            display, format="WEBP", quality=90, method=6, exact=True, lossless=False)
        records[-1]["derivatives"] = [{
            "file": display.relative_to(ROOT).as_posix(), "source": records[-1]["png"], "source_sha256": sha(png),
            "size": list(size), "format": "WEBP", "mode": "RGBA", "resample": "LANCZOS", "quality": 90, "method": 6,
            "lossless": False, "sha256": sha(display), "bytes": display.stat().st_size,
            "purpose": "#785 ゲーム内表示用（表示約390pxの約2倍）", "max_mean_abs_diff": 3.0}]
(HERE / "registration.json").write_text(json.dumps({"props": records, "minigame_connected": False}, ensure_ascii=False, indent=2) + "\n")
print("PASS: generated board/axe copied unchanged; lossless RGBA WebP; game connection belongs to #480")
