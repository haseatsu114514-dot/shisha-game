"""Encode only adopted Issue 360 CGs and preserve unrelated generated manifest fields."""
import datetime
import hashlib
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
records = json.loads((HERE / "prompts.json").read_text())["records"]
manifest_path = ROOT / "remake/data/manifest.json"
manifest = json.loads(manifest_path.read_text())
rows = []
for record in records:
    if not record["accepted"]:
        continue
    name = record["id"] + ".png"
    native = HERE / "generated" / name
    source = ROOT / "assets/cgs" / name
    runtime = ROOT / "remake/img/cgs" / (record["id"] + ".webp")
    source.parent.mkdir(parents=True, exist_ok=True)
    runtime.parent.mkdir(parents=True, exist_ok=True)
    image = Image.open(native).convert("RGB")
    image.resize((1920, 1080), Image.Resampling.LANCZOS).save(source, optimize=True)
    Image.open(source).save(runtime, "WEBP", quality=74, method=6)
    manifest["cgs"] = sorted(set(manifest["cgs"]) | {name})
    manifest["webp"] = sorted(set(manifest["webp"]) | {"cgs/" + name})
    previous = HERE / "previous" / runtime.name
    rows.append({"id": record["id"], "native": list(image.size), "delivery": [1920, 1080],
                 "beforeBytes": previous.stat().st_size if previous.exists() else 0,
                 "afterBytes": runtime.stat().st_size,
                 "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                 "runtimeSha256": hashlib.sha256(runtime.read_bytes()).hexdigest()})
manifest["generated"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
(HERE / "encoding.json").write_text(json.dumps({"quality": 74, "method": 6, "rows": rows}, indent=2) + "\n")
print("Encoded", len(rows), "CGs; runtime bytes", sum(r["afterBytes"] for r in rows))
