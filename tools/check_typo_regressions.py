#!/usr/bin/env python3
"""Reject known typo phrases in player-visible dialogue JSON fields."""

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

TEXT_FIELDS = {
    "text", "inner", "label", "line", "title", "description", "smallTableText", "role",
}
AUTHOR_FIELDS = {"_comment", "comment", "implementation_notes"}
# These data shapes supplement the common dialogue and choice fields.
EXTRA_COPY = {
    "spot": {"area", "glyph", "sub", "unknownSub", "desc"},
    "builder": {"intro", "name", "trait", "eye", "hand", "talk", "nerve"},
    "cast": {"ability", "abilityText", "name", "trait", "likes"},
    "companionBuilds": {"name", "trait", "likes"},
    "checks": {"hint", "detail"},
    "interview": {"prompt"},
    "pictureBook": {"alt"},
    "profiles": {"arrival"},
    "spots": {"short"},
}


def visible_field(keys):
    group, field = keys[0], keys[-1]
    if "metadata" in keys:
        return keys[-2:] in {("metadata", "panel_alt"), ("lime_history", "call")}
    if len(keys) == 1 and group in {"subtitle", "premise", "collection", "author", "duration"}:
        return True
    if group == "presentation":
        return field not in {"theme", "image", "src"}
    if group == "fiction":
        return True
    if keys in {("campaign", "aftermath", "true"), ("campaign", "aftermath", "bad")}:
        return True
    return field in TEXT_FIELDS or field in EXTRA_COPY.get(group, ())


def visible_texts(node, path=()):
    """Yield player-visible strings and their JSON paths, retaining array indices."""
    if isinstance(node, dict):
        for key, value in node.items():
            if key not in AUTHOR_FIELDS:
                yield from visible_texts(value, (*path, key))
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from visible_texts(value, (*path, index))
    elif isinstance(node, str) and node.strip():
        keys = tuple(part for part in path if isinstance(part, str))
        if keys and visible_field(keys):
            yield path, node


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise ValueError(f"{path}: {exc}") from exc


def load_cases(path):
    cases = read_json(path)
    if not isinstance(cases, list) or not cases:
        raise ValueError(f"{path}: expected a non-empty array of typo cases")

    seen = set()
    fields = ("detect", "after", "type", "file", "note")
    for index, case in enumerate(cases):
        if (
            not isinstance(case, dict)
            or not all(isinstance(case.get(key), str) and case[key].strip() for key in fields)
            or type(case.get("pr")) is not int
            or case["pr"] <= 0
        ):
            raise ValueError(f"{path}: invalid typo case at index {index}")
        if case["detect"] in seen or case["detect"] in case["after"]:
            raise ValueError(f"{path}: duplicate detect phrase or detect contained in after at index {index}")
        seen.add(case["detect"])
    return cases


def regressions(text, cases):
    return (case for case in cases if case["detect"] in text)


def json_pointer(path):
    return "/" + "/".join(str(part).replace("~", "~0").replace("/", "~1") for part in path)


def main(root=ROOT):
    files = sorted((root / "data/dialogue").rglob("*.json"))
    count = 0
    hits = 0
    try:
        if not files:
            raise ValueError(f"{root / 'data/dialogue'}: no dialogue JSON files found")
        cases = load_cases(root / "tools/typo_cases.json")
        for file in files:
            for path, text in visible_texts(read_json(file)):
                count += 1
                for case in regressions(text, cases):
                    hits += 1
                    print(f"{file.relative_to(root)}#{json_pointer(path)}: "
                          f"{case['detect']!r} → {case['after']!r} (PR #{case['pr']})")
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 2

    if hits:
        print(f"NG: 誤字の再出現 {hits} 件")
        return 1
    print(f"OK: 誤字の再出現 0 件（{len(files)} JSON、表示文字列 {count} 件、登録 {len(cases)} 事例）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
