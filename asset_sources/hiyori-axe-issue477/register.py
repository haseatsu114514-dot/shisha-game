"""Register only the authored Hiyori additions; preserve the adopted portrait framing.

Artwork is produced with image_gen. This applies the repository's mechanical
sprite canvas/foot alignment and WebP encoding, without recoloring/removing alpha.
Run from anywhere: python3 asset_sources/hiyori-axe-issue477/register.py
"""
import copy
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
FACES = ["axe_normal", "axe_laugh", "axe_shout", "serious", "love_blush"]
BACKGROUND = "bg_axe_lounge_night.png"


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "remake/tools" / f"{name}.py")
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    builder, encoder = module("build_manifest"), module("build_images")
    manifest_path = ROOT / "remake/data/manifest.json"
    manifest = json.loads(manifest_path.read_text())
    baseline_path = HERE / "baseline.json"
    if not baseline_path.exists():
        existing = list((ROOT / "assets/sprites/characters/hiyori").glob("*.png"))
        existing += list((ROOT / "remake/img/sprites/characters/hiyori").glob("*.webp"))
        existing += [p for p in [ROOT / "assets/ui/face_icons/face_hiyori.png",
                                ROOT / "remake/img/ui/face_icons/face_hiyori.webp"] if p.is_file()]
        baseline = {"portrait": copy.deepcopy(manifest["portraits"]["hiyori"]),
                    "files": {str(p.relative_to(ROOT)): sha(p) for p in existing}}
        baseline_path.write_text(json.dumps(baseline, indent=2) + "\n")
    baseline = json.loads(baseline_path.read_text())
    assert all(sha(ROOT / path) == digest for path, digest in baseline["files"].items()), "Adopted Hiyori files changed"
    original = baseline["portrait"]
    # Fit the measured visible figure inside the existing shared bounds; the
    # normal reference remains the foot anchor for every expression/outfit.
    width, height = 896, 1200
    top = round((1 - original["h"] - original["b"]) * height)
    bottom = round((1 - original["b"]) * height)
    records, additions = [], []
    for face in FACES:
        source = HERE / "raw" / f"{face.replace('_', '-')}-source.png"
        im = Image.open(source)
        assert im.mode == "RGBA" and im.getchannel("A").getextrema() == (0, 255)
        measured = builder.measure(source)
        scale = (bottom - top - 4) / ((measured["bottom"] - measured["top"]) * im.height)
        sized = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
        offset = (round(original["ax"] * width - measured["ax"] * im.width * scale),
                  round(top + 2 - measured["top"] * im.height * scale))
        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        canvas.paste(sized, offset)  # Copy RGBA; using itself as a mask would square alpha.
        rel = f"sprites/characters/hiyori/chr_hiyori_{face}.png"
        destination = ROOT / "assets" / rel
        canvas.save(destination)
        actual = builder.measure(destination)
        assert actual["top"] * height >= top and actual["bottom"] * height <= bottom, (face, actual)
        assert abs(actual["ax"] - original["ax"]) * width < 3, (face, actual)
        records.append({"face": face, "source": str(source.relative_to(ROOT)), "source_sha256": sha(source),
                        "file": "assets/" + rel, "sha256": sha(destination), "scale": scale,
                        "offset": list(offset), "measured": actual})
        additions.append(rel)
    derived = builder.portraits()["hiyori"]
    assert {k: v for k, v in derived.items() if k != "faces"} == {k: v for k, v in original.items() if k != "faces"}, "Existing framing changed"
    assert set(derived["faces"]) == set(original["faces"]) | set(FACES)
    manifest["portraits"]["hiyori"] = derived
    background_path = ROOT / "assets/backgrounds" / BACKGROUND
    background_path.write_bytes((HERE / "raw/axe-background-source.png").read_bytes())
    manifest["backgrounds"] = sorted(set(manifest["backgrounds"]) | {BACKGROUND})
    additions.append("backgrounds/" + BACKGROUND)
    for rel in additions:
        dst = encoder.OUT / Path(rel).with_suffix(".webp")
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(encoder.encode(ROOT / "assets" / rel, rel))
        if rel.startswith("sprites/"):
            assert Image.open(ROOT / "assets" / rel).convert("RGBA").tobytes() == Image.open(dst).convert("RGBA").tobytes()
    manifest["webp"] = sorted(set(manifest.get("webp", [])) | set(additions))
    # This is a scoped registration, not a full manifest rebuild. Keep the
    # shared rebuild timestamp; record this unit's time in its own receipt.
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    assert all(sha(ROOT / path) == digest for path, digest in baseline["files"].items())
    (HERE / "registration.json").write_text(json.dumps({"registered_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "portrait_before": original, "portrait_after": derived,
        "background": "assets/backgrounds/" + BACKGROUND, "background_sha256": sha(background_path),
        "normalized": records, "old_files_unchanged": True, "lossless_portrait_rgba_equal": True}, indent=2) + "\n")
    print(f"Registered {len(FACES)} Hiyori faces and one original background; adopted files/framing unchanged")


if __name__ == "__main__":
    main()
