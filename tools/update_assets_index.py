#!/usr/bin/env python3
"""
Generate a machine-friendly asset index for the Godot project.

The output is intended to help AI tools locate runtime assets quickly without
rescanning the tree every time. It also cross-references the progress sheet so
missing files and untracked assets are visible in one place.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from PIL import Image

    PIL_AVAILABLE = True
except ImportError:
    Image = None
    PIL_AVAILABLE = False


CANONICAL_ROOTS = (
    "assets/backgrounds",
    "assets/cgs",
    "assets/sprites",
    "assets/ui",
    "assets/audio",
    "assets/fonts",
)

IGNORED_SUFFIXES = {
    ".import",
    ".md",
}

IGNORED_FILENAMES = {
    ".DS_Store",
}

IMAGE_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".bmp",
    ".svg",
}

AUDIO_SUFFIXES = {
    ".mp3",
    ".ogg",
    ".wav",
}

FONT_SUFFIXES = {
    ".ttf",
    ".otf",
}

RESOURCE_SUFFIXES = {
    ".tres",
    ".res",
}


@dataclass(frozen=True)
class ProgressRow:
    ai_judgement: bool
    human_judgement: bool
    category: str
    directory: str
    filename: str
    usage: str
    status: str
    owner: str
    notes: str


def parse_args() -> argparse.Namespace:
    script_path = Path(__file__).resolve()
    project_root = script_path.parent.parent
    parser = argparse.ArgumentParser(description="Generate assets_index.json")
    parser.add_argument(
        "--project-root",
        default=str(project_root),
        help="Absolute or relative path to the project root.",
    )
    parser.add_argument(
        "--output",
        default="assets_index.json",
        help="Output path. Relative paths are resolved from the project root.",
    )
    return parser.parse_args()


def load_progress_rows(progress_path: Path) -> list[ProgressRow]:
    if not progress_path.exists():
        return []

    rows: list[ProgressRow] = []
    with progress_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append(
                ProgressRow(
                    ai_judgement=row.get("AI判断", "").strip().upper() == "TRUE",
                    human_judgement=row.get("人間判断", "").strip().upper() == "TRUE",
                    category=row.get("カテゴリ", "").strip(),
                    directory=row.get("ディレクトリ", "").strip(),
                    filename=row.get("ファイル名", "").strip(),
                    usage=row.get("用途", "").strip(),
                    status=row.get("ステータス", "").strip(),
                    owner=row.get("担当者", "").strip(),
                    notes=row.get("備考", "").strip(),
                )
            )
    return rows


def should_index(path: Path) -> bool:
    if path.name in IGNORED_FILENAMES:
        return False
    if path.suffix.lower() in IGNORED_SUFFIXES:
        return False
    return True


def split_asset_sets(project_root: Path) -> tuple[list[Path], list[Path]]:
    runtime_files: list[Path] = []
    extra_files: list[Path] = []

    assets_root = project_root / "assets"
    if not assets_root.exists():
        return runtime_files, extra_files

    canonical_roots = tuple(project_root / root for root in CANONICAL_ROOTS)

    for path in sorted(assets_root.rglob("*")):
        if not path.is_file() or not should_index(path):
            continue

        if any(path.is_relative_to(root) for root in canonical_roots):
            runtime_files.append(path)
        else:
            extra_files.append(path)

    return runtime_files, extra_files


def asset_type_from_suffix(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in IMAGE_SUFFIXES:
        return "image"
    if suffix in AUDIO_SUFFIXES:
        return "audio"
    if suffix in FONT_SUFFIXES:
        return "font"
    if suffix in RESOURCE_SUFFIXES:
        return "resource"
    return "file"


def normalize_asset_id(relative_path: Path) -> str:
    without_suffix = relative_path.with_suffix("")
    return ".".join(without_suffix.parts)


def parse_character_metadata(relative_path: Path) -> tuple[str | None, str | None]:
    parts = relative_path.parts
    if len(parts) >= 4 and parts[0:3] == ("assets", "sprites", "characters"):
        character = parts[3]
        stem = relative_path.stem
        prefix = f"chr_{character}_"
        if stem.startswith(prefix):
            return character, stem[len(prefix) :]
        return character, None

    if len(parts) >= 3 and parts[0:3] == ("assets", "sprites", "faces"):
        stem = relative_path.stem
        if stem.startswith("face_"):
            return stem[len("face_") :], "face"
    return None, None


def classify_asset(relative_path: Path) -> dict[str, Any]:
    parts = relative_path.parts
    category = "other"
    subcategory = ""
    logical_name = relative_path.stem

    if len(parts) >= 2 and parts[0] == "assets":
        if parts[1] == "backgrounds":
            category = "background"
            logical_name = relative_path.stem.removeprefix("bg_")
        elif parts[1] == "cgs":
            category = "cg"
            logical_name = relative_path.stem.removeprefix("cg_")
        elif parts[1] == "ui":
            category = "ui"
            logical_name = relative_path.stem.removeprefix("ui_")
        elif parts[1] == "fonts":
            category = "font"
        elif parts[1] == "audio":
            category = "audio"
            if len(parts) >= 3:
                subcategory = parts[2]
        elif parts[1] == "sprites":
            if len(parts) >= 3 and parts[2] == "characters":
                category = "character_portrait"
                if len(parts) >= 4:
                    subcategory = parts[3]
            elif len(parts) >= 3 and parts[2] == "faces":
                category = "face_icon"
                subcategory = "faces"

    character, expression = parse_character_metadata(relative_path)

    return {
        "category": category,
        "subcategory": subcategory,
        "logical_name": logical_name,
        "character": character,
        "expression": expression,
    }


def image_metadata(path: Path) -> dict[str, Any]:
    if not PIL_AVAILABLE or Image is None:
        return {}

    try:
        with Image.open(path) as image:
            bands = image.getbands()
            alpha_band = "A" in bands
            has_alpha = False
            if alpha_band:
                extrema = image.getchannel("A").getextrema()
                has_alpha = extrema[0] < 255

            frame_count = getattr(image, "n_frames", 1)
            return {
                "width": image.width,
                "height": image.height,
                "mode": image.mode,
                "frame_count": frame_count,
                "is_animated": frame_count > 1,
                "has_alpha": has_alpha,
            }
    except Exception as exc:
        return {"inspection_error": str(exc)}


def basic_metadata(path: Path) -> dict[str, Any]:
    stat = path.stat()
    metadata = {
        "file_size_bytes": stat.st_size,
        "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "type": asset_type_from_suffix(path),
    }
    if metadata["type"] == "image":
        metadata.update(image_metadata(path))
    return metadata


def find_progress_match(relative_path: Path, rows: list[ProgressRow]) -> ProgressRow | None:
    rel_parent = str(relative_path.parent).replace("\\", "/")
    filename = relative_path.name

    candidates: list[ProgressRow] = []
    for row in rows:
        if row.filename != filename:
            continue
        row_dir = row.directory.rstrip("/")
        if rel_parent == row_dir or rel_parent.startswith(f"{row_dir}/"):
            candidates.append(row)

    if not candidates:
        return None

    candidates.sort(key=lambda row: len(row.directory), reverse=True)
    return candidates[0]


def progress_payload(row: ProgressRow | None) -> dict[str, Any]:
    if row is None:
        return {
            "tracked": False,
            "ai_judgement": None,
            "human_judgement": None,
            "status": "",
            "usage": "",
            "directory": "",
            "owner": "",
            "notes": "",
        }

    return {
        "tracked": True,
        "ai_judgement": row.ai_judgement,
        "human_judgement": row.human_judgement,
        "status": row.status,
        "usage": row.usage,
        "directory": row.directory,
        "owner": row.owner,
        "notes": row.notes,
    }


def build_asset_entry(project_root: Path, path: Path, rows: list[ProgressRow]) -> dict[str, Any]:
    relative_path = path.relative_to(project_root)
    classification = classify_asset(relative_path)
    matched_row = find_progress_match(relative_path, rows)

    entry = {
        "asset_id": normalize_asset_id(relative_path),
        "path": str(relative_path).replace("\\", "/"),
        "filename": path.name,
        **classification,
        **basic_metadata(path),
        "progress": progress_payload(matched_row),
    }
    return entry


def build_character_lookup(entries: list[dict[str, Any]]) -> dict[str, Any]:
    lookup: dict[str, Any] = {}
    for entry in entries:
        character = entry.get("character")
        if not character:
            continue

        bucket = lookup.setdefault(
            character,
            {
                "portraits": {},
                "faces": {},
            },
        )

        if entry["category"] == "character_portrait" and entry.get("expression"):
            bucket["portraits"][entry["expression"]] = entry["path"]
        elif entry["category"] == "face_icon":
            bucket["faces"]["default"] = entry["path"]

    return dict(sorted(lookup.items()))


def build_lookup_maps(entries: list[dict[str, Any]]) -> dict[str, Any]:
    backgrounds: dict[str, str] = {}
    ui_assets: dict[str, str] = {}
    cgs: dict[str, str] = {}
    audio: dict[str, str] = {}

    for entry in entries:
        category = entry["category"]
        name = entry["logical_name"]
        if category == "background":
            backgrounds[name] = entry["path"]
        elif category == "ui":
            ui_assets[name] = entry["path"]
        elif category == "cg":
            cgs[name] = entry["path"]
        elif category == "audio":
            audio[name] = entry["path"]

    return {
        "characters": build_character_lookup(entries),
        "backgrounds": dict(sorted(backgrounds.items())),
        "ui": dict(sorted(ui_assets.items())),
        "cgs": dict(sorted(cgs.items())),
        "audio": dict(sorted(audio.items())),
    }


def build_duplicate_report(entries: list[dict[str, Any]]) -> dict[str, list[str]]:
    buckets: dict[str, list[str]] = defaultdict(list)
    for entry in entries:
        buckets[entry["filename"]].append(entry["path"])
    duplicates = {
        filename: sorted(paths)
        for filename, paths in buckets.items()
        if len(paths) > 1
    }
    return dict(sorted(duplicates.items()))


def build_progress_summary(entries: list[dict[str, Any]], rows: list[ProgressRow]) -> dict[str, Any]:
    matched_rows: set[tuple[str, str]] = set()
    for entry in entries:
        progress = entry["progress"]
        if not progress["tracked"]:
            continue
        matched_rows.add((progress["directory"], entry["filename"]))

    missing_rows = []
    for row in rows:
        key = (row.directory, row.filename)
        if key not in matched_rows:
            missing_rows.append(
                {
                    "directory": row.directory,
                    "filename": row.filename,
                    "category": row.category,
                    "usage": row.usage,
                    "status": row.status,
                    "notes": row.notes,
                }
            )

    untracked_assets = [
        {
            "path": entry["path"],
            "filename": entry["filename"],
            "category": entry["category"],
        }
        for entry in entries
        if not entry["progress"]["tracked"]
    ]

    return {
        "sheet_path": "アセット差し替え進捗管理表.csv",
        "total_rows": len(rows),
        "matched_rows": len(rows) - len(missing_rows),
        "missing_rows": missing_rows,
        "untracked_runtime_assets": untracked_assets,
    }


def build_summary(entries: list[dict[str, Any]], extra_files: list[Path], rows: list[ProgressRow]) -> dict[str, Any]:
    type_counts = Counter(entry["type"] for entry in entries)
    category_counts = Counter(entry["category"] for entry in entries)
    ai_checked = sum(1 for entry in entries if entry["progress"]["ai_judgement"])
    human_checked = sum(1 for entry in entries if entry["progress"]["human_judgement"])
    tracked = sum(1 for entry in entries if entry["progress"]["tracked"])

    return {
        "runtime_asset_count": len(entries),
        "tracked_runtime_assets": tracked,
        "ai_checked_assets": ai_checked,
        "human_checked_assets": human_checked,
        "extra_asset_file_count": len(extra_files),
        "progress_sheet_rows": len(rows),
        "counts_by_type": dict(sorted(type_counts.items())),
        "counts_by_category": dict(sorted(category_counts.items())),
    }


def serialize_extra_files(project_root: Path, paths: list[Path]) -> list[dict[str, Any]]:
    items = []
    for path in paths:
        relative_path = path.relative_to(project_root)
        items.append(
            {
                "path": str(relative_path).replace("\\", "/"),
                "filename": path.name,
                **basic_metadata(path),
            }
        )
    return items


def generate_index(project_root: Path) -> dict[str, Any]:
    progress_path = project_root / "アセット差し替え進捗管理表.csv"
    progress_rows = load_progress_rows(progress_path)
    runtime_files, extra_files = split_asset_sets(project_root)

    runtime_entries = [
        build_asset_entry(project_root, path, progress_rows)
        for path in runtime_files
    ]

    runtime_entries.sort(key=lambda entry: entry["path"])

    payload = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "project_root": str(project_root),
        "canonical_roots": list(CANONICAL_ROOTS),
        "summary": build_summary(runtime_entries, extra_files, progress_rows),
        "progress_sheet": build_progress_summary(runtime_entries, progress_rows),
        "duplicate_filenames": build_duplicate_report(runtime_entries),
        "lookups": build_lookup_maps(runtime_entries),
        "assets": runtime_entries,
        "extra_files": serialize_extra_files(project_root, extra_files),
    }
    return payload


def main() -> int:
    args = parse_args()
    project_root = Path(args.project_root).resolve()
    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = project_root / output_path

    payload = generate_index(project_root)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    summary = payload["summary"]
    print(f"Wrote {output_path}")
    print(
        "runtime_assets={runtime_asset_count} tracked={tracked_runtime_assets} "
        "ai_checked={ai_checked_assets} extra_files={extra_asset_file_count}".format(
            **summary
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
