#!/usr/bin/env python3
"""Validate and derive a non-runtime appearance catalog from the candidate source.

No generated catalog is committed: candidates.json remains the only metadata
source. PNG checks cover bytes, IHDR dimensions and color mode, not visual fit.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import sys
import zlib


ROOT = Path(__file__).resolve().parents[1]
SOURCE = "asset_sources/shisha-hardware-reference/skin-candidates-issue374/candidates.json"
CATEGORIES = {"handle", "mouthpiece"}
CATALOG_FIELDS = (
    "id", "name", "category", "original_path", "sha256", "size", "mode",
    "alpha_extrema", "approved", "approval_scope", "runtime_integrated",
    "runtime_paths", "status", "integration_issue", "concept_length_cm",
    "dimensional_status",
)
# These are deliberately unknown. Approval of a design is not a rendering contract.
UNVERIFIED_RENDER_FIELDS = (
    "crop", "bbox", "anchor", "relative_scale", "connection_position",
    "connection_diameter", "compatible_ids", "distribution_path",
    "transparency_processing",
)


class CatalogError(ValueError):
    pass


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise CatalogError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def repository_path(root, value):
    if not isinstance(value, str) or not value:
        raise CatalogError("path must be a nonempty string")
    path = (root / value).resolve()
    if not path.is_relative_to(root.resolve()):
        raise CatalogError(f"path is outside repository: {value}")
    return path


def png_header(data):
    if len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise CatalogError("invalid PNG signature or truncated IHDR")
    if data[8:16] != struct.pack(">I", 13) + b"IHDR":
        raise CatalogError("invalid PNG IHDR")
    if zlib.crc32(data[12:29]) != struct.unpack(">I", data[29:33])[0]:
        raise CatalogError("PNG IHDR CRC mismatch")
    width, height, depth, color, compression, filtering, interlace = struct.unpack(
        ">IIBBBBB", data[16:29])
    if not width or not height or depth != 8 or color != 6 or compression or filtering or interlace not in (0, 1):
        raise CatalogError("expected an 8-bit RGBA PNG header")
    return [width, height], "RGBA"


def load_catalog(root=ROOT, source=SOURCE):
    root = Path(root).resolve()
    try:
        source_path = repository_path(root, source)
        raw = source_path.read_bytes()
        document = json.loads(raw, object_pairs_hook=unique_object)
    except (OSError, UnicodeError, ValueError) as exc:
        raise CatalogError(f"source {source}: {exc}") from exc
    if not isinstance(document, dict) or not isinstance(document.get("items"), list) or not document["items"]:
        raise CatalogError("source must contain a nonempty items array")
    adoption = document.get("adoption")
    if not isinstance(adoption, dict) or not isinstance(adoption.get("scope"), str) or not adoption["scope"]:
        raise CatalogError("source adoption.scope is missing or invalid")
    for field in ("runtime_integrated", "distribution_assets_ready"):
        if type(adoption.get(field)) is not bool:
            raise CatalogError(f"adoption.{field} must be boolean")

    errors, items, seen = [], [], set()
    for index, item in enumerate(document["items"]):
        label = f"items[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{label}: expected object")
            continue
        identifier = item.get("id")
        label += f" ({identifier!r})"
        for field in CATALOG_FIELDS:
            if field not in item:
                errors.append(f"{label}: missing {field}")
        if not isinstance(identifier, str) or not identifier.strip():
            errors.append(f"{label}: missing or invalid id")
        elif identifier in seen:
            errors.append(f"{label}: duplicate id")
        else:
            seen.add(identifier)
        for field in ("name", "status", "dimensional_status"):
            if not isinstance(item.get(field), str) or not item[field].strip():
                errors.append(f"{label}: missing or invalid {field}")
        if not isinstance(item.get("category"), str) or item["category"] not in CATEGORIES:
            errors.append(f"{label}: invalid category {item.get('category')!r}; expected handle or mouthpiece")
        for field in ("approved", "runtime_integrated"):
            if type(item.get(field)) is not bool:
                errors.append(f"{label}: {field} must be boolean")
        if item.get("approval_scope") != "design_only":
            errors.append(f"{label}: expected approval_scope design_only")
        paths = item.get("runtime_paths")
        if not isinstance(paths, list) or any(not isinstance(p, str) or not p for p in paths):
            errors.append(f"{label}: runtime_paths must be an array of paths")
        elif item.get("runtime_integrated") is False and paths:
            errors.append(f"{label}: runtime_paths contradict runtime_integrated=false")
        size = item.get("size")
        if not isinstance(size, list) or len(size) != 2 or any(type(v) is not int or v <= 0 for v in size):
            errors.append(f"{label}: size must contain two positive integers")
        alpha = item.get("alpha_extrema")
        if not isinstance(alpha, list) or len(alpha) != 2 or any(type(v) is not int for v in alpha) or not 0 <= alpha[0] <= alpha[1] <= 255:
            errors.append(f"{label}: alpha_extrema must be an ordered range within 0..255 (source metadata only)")
        digest = item.get("sha256")
        if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            errors.append(f"{label}: invalid sha256")
        try:
            original = repository_path(root, item.get("original_path"))
            data = original.read_bytes()
            actual_digest = hashlib.sha256(data).hexdigest()
            if actual_digest != digest:
                errors.append(f"{label}: SHA256 mismatch for {item.get('original_path')}")
            actual_size, mode = png_header(data)
            if actual_size != size:
                errors.append(f"{label}: dimensions mismatch: source={size!r}, PNG={actual_size}")
            if item.get("mode") != mode:
                errors.append(f"{label}: mode mismatch: source={item.get('mode')!r}, PNG={mode}")
        except (OSError, CatalogError) as exc:
            errors.append(f"{label}: original {item.get('original_path')!r}: {exc}")
        items.append({**{key: item.get(key) for key in CATALOG_FIELDS},
                      "render_contract": {key: None for key in UNVERIFIED_RENDER_FIELDS}})
    if errors:
        raise CatalogError("\n".join(errors))
    return {
        "source": source_path.relative_to(root).as_posix(),
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "adoption": adoption,
        "verification": "original SHA256 and PNG IHDR dimensions/mode; not runtime or visual-fit QA",
        "items": items,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default=SOURCE, help="source JSON path within this repository")
    parser.add_argument("--json", action="store_true", help="print the derived catalog; never writes files")
    args = parser.parse_args(argv)
    try:
        catalog = load_catalog(source=args.source)
    except CatalogError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(catalog, ensure_ascii=False, indent=2))
    else:
        print(f"PASS: {len(catalog['items'])} originals validated from {catalog['source']}")
        for item in catalog["items"]:
            print(f"{item['id']} | {item['name']} | {item['category']} | {item['size']} | "
                  f"approval={item['approval_scope']} | runtime_integrated={item['runtime_integrated']}")
        print("Rendering/crop/anchor/connection/transparency processing are unverified (null).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
