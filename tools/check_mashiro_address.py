#!/usr/bin/env python3
"""Check Mashiro's voice in dialogue, LIME and lover messages."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ADDRESS = re.compile(r"(?:はじめ|ハジメ|始|蒸野)(?:く[〜～ー]*ん|さん|ちゃん|君|様|さま|っち)?")
FIRST_PERSON = re.compile(r"うち|わたし|私")
# These contain the same characters but are not personal pronouns or addresses.
ORDINARY_WORDS = re.compile(r"はじめまして|はじめて|はじめに|はじめから|始ま|始め|そのうち|今のうち|知らないうち|おうち|うちわ|うちの(?:店|会社|職場)|私服|私物|私生活|私用")
bad = []


def check_text(text, path):
    searchable = ORDINARY_WORDS.sub("", text)
    for match in ADDRESS.finditer(searchable):
        if re.sub(r"[〜～ー]", "", match.group()) != "はじめくん":
            bad.append((path, match.group(), text[:75]))
    for match in FIRST_PERSON.finditer(searchable):
        bad.append((path, "一人称 " + match.group(), text[:75]))


def scan(value, path, active=False):
    if isinstance(value, dict):
        if "speaker" in value:
            active = value["speaker"] == "mashiro"
        for key, child in value.items():
            if key == "text" and isinstance(child, str) and active:
                check_text(child, path)
            elif isinstance(child, (dict, list)):
                scan(child, path, active if key not in ("events", "steps", "dialogues", "choices") else False)
    elif isinstance(value, list):
        for child in value:
            scan(child, path, active)


def scan_lime(value, path, active=False):
    if isinstance(value, dict):
        if "sender" in value:
            active = value["sender"] == "mashiro"
        for key, child in value.items():
            if active and key in ("text", "response", "reminder_text") and isinstance(child, str):
                check_text(child, path)
            elif isinstance(child, (dict, list)):
                scan_lime(child, path, active)
    elif isinstance(value, list):
        for child in value:
            scan_lime(child, path, active)


def scan_lover(value, path, active=False):
    if isinstance(value, dict):
        if "speaker" in value or "sender" in value:
            active = value.get("speaker", value.get("sender")) == "mashiro"
        for key, child in value.items():
            # optA/optB are player replies, not Mashiro's speech.
            scan_lover(child, path, (active or key == "mashiro") and key not in ("optA", "optB"))
    elif isinstance(value, list):
        for child in value:
            scan_lover(child, path, active)
    elif active and isinstance(value, str):
        check_text(value, path)


def main():
    bad.clear()
    sources = [(p, scan) for p in sorted((ROOT / "data/dialogue").glob("*.json"))]
    sources += [(ROOT / "data/lime_messages.json", scan_lime), (ROOT / "remake/data/lover.json", scan_lover)]
    for path, scanner in sources:
        try:
            scanner(json.loads(path.read_text(encoding="utf-8")), str(path.relative_to(ROOT)))
        except (OSError, json.JSONDecodeError) as error:
            bad.append((str(path), "invalid or missing JSON", str(error)))
    for path, word, text in bad:
        print(f"ERROR {path}: Mashiro says {word!r}: {text}", file=sys.stderr)
    if bad:
        return 1
    print("OK: Mashiro's はじめくん / 僕 in dialogue, LIME and lover messages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
