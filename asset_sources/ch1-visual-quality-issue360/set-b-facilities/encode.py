"""Adopt the seven generated paintings under eight established IDs; preserve manifest."""
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "remake/tools"))
import build_images

records = json.loads((HERE / "prompts.json").read_text())["records"]
records += json.loads((HERE / "weather-prompts.json").read_text())["records"]
names = [r["id"] for r in records] + ["bg_c_station_lobby"]
rows = []
for name in names:
    native = HERE / "generated" / (("bg_c_station_day" if name == "bg_c_station_lobby" else name) + ".png")
    source = ROOT / "assets/backgrounds" / (name + ".png")
    runtime = ROOT / "remake/img/backgrounds" / (name + ".webp")
    image = Image.open(native).convert("RGB")
    image.resize((1920, 1080), Image.Resampling.LANCZOS).save(source, optimize=True)
    runtime.write_bytes(build_images.encode(source, "backgrounds/" + source.name))
    rows.append({"id": name, "native": list(image.size), "delivery": [1920, 1080],
                 "beforeBytes": (HERE / "previous" / runtime.name).stat().st_size if (HERE / "previous" / runtime.name).exists() else 0,
                 "afterBytes": runtime.stat().st_size,
                 "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                 "runtimeSha256": hashlib.sha256(runtime.read_bytes()).hexdigest()})
(HERE / "encoding.json").write_text(json.dumps({"quality": 62, "method": 6, "rows": rows}, indent=2) + "\n")
print("Encoded", len(rows), "background IDs; bytes", sum(x["beforeBytes"] for x in rows), "->", sum(x["afterBytes"] for x in rows))
