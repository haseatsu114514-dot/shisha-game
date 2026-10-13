#!/usr/bin/env python3
"""第2章の初回人物・入口内装の配布前検査。目視QAの代わりではない。"""
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("manifest_builder", ROOT / "remake/tools/build_manifest.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
manifest = json.loads((ROOT / "remake/data/manifest.json").read_text())
results = []

for family in ("ch2-characters", "ch2-interiors"):
    metadata = json.loads((ROOT / "asset_sources" / family / "metadata.json").read_text())
    for item in metadata["items"]:
        cid = item["character"]
        for key in ("source", "runtime", "runtime_webp"):
            if key not in item:
                continue
            record = item[key]
            path = ROOT / record["path"]
            assert hashlib.sha256(path.read_bytes()).hexdigest() == record["sha256"], path
            image = Image.open(path)
            assert list(image.size) == record["size"] and image.mode == record["mode"], path
            if family == "ch2-characters":
                assert image.mode == "RGBA", path
                alpha = np.asarray(image.getchannel("A"))
                assert alpha.min() == 0 and alpha.max() == 255, path
                assert not (alpha[0] >= 24).any() and not (alpha[-1] >= 24).any(), path
                assert not (alpha[:, 0] >= 24).any() and not (alpha[:, -1] >= 24).any(), path
                if key != "source":
                    assert image.size == (896, 1200), path
            elif key == "runtime":
                assert image.size == (1280, 720) and image.format == "WEBP" and image.mode == "RGB", path
            results.append({"path": record["path"], "status": "PASS", "size": list(image.size), "mode": image.mode})
        if family == "ch2-characters":
            png = ROOT / item["runtime"]["path"]
            webp = ROOT / item["runtime_webp"]["path"]
            # Transparent RGB is irrelevant; compare alpha and composited visible content.
            a, b = np.asarray(Image.open(png)), np.asarray(Image.open(webp))
            assert np.array_equal(a[..., 3], b[..., 3]), cid
            visible = a[..., 3] > 0
            assert np.array_equal(a[visible], b[visible]), cid
            measured = builder.measure(png)
            entry = manifest["portraits"][cid]
            assert entry == item["framing"] and entry["faces"] == ["normal"], cid
            expected = {"h": round(measured["bottom"] - measured["top"], 4), "b": round(1 - measured["bottom"], 4), "ax": round(measured["ax"], 4), "aspect": round(measured["aspect"], 4)}
            assert all(entry[key] == value for key, value in expected.items()), cid
            assert f"sprites/characters/{cid}/chr_{cid}_normal.png" in manifest["webp"], cid

output = {"status": "PASS", "files_checked": len(results), "checks": results, "limits": "Dimensions, hashes, alpha borders, lossless visible pixels and framing only; anatomy, identity, room structure and in-game visibility require visual QA."}
(HERE / "validation.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
print(f"PASS: {len(results)} chapter-two character/interior files; alpha, hashes, dimensions, WebP and portrait framing")
