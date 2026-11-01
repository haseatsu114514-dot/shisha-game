#!/usr/bin/env python3
"""Export a self-contained tabletop preview from one immutable Git commit.

No credentials or Site identity are read, written or changed. The destination
contains static game files plus SOURCE.json, and can be hosted by any web server.
"""
import argparse
import hashlib
import json
import posixpath
from pathlib import Path
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, help="Directory for static files")
    parser.add_argument("--commit", default="HEAD", help="Committed source revision")
    parser.add_argument("--pr", type=int, default=None, help="Source pull request number")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]

    def git(*parts):
        return subprocess.check_output(["git", *parts], cwd=repo)

    commit = git("rev-parse", args.commit + "^{commit}").decode().strip()

    def read(path):
        if path.startswith("/") or path.startswith("../"):
            raise ValueError("Asset path escaped the source repository")
        data = git("show", commit + ":" + path)
        if data.startswith(b"version https://git-lfs.github.com/spec/v1\n"):
            data = subprocess.check_output(["git", "lfs", "smudge", "--", path], input=data, cwd=repo)
            if data.startswith(b"version https://git-lfs.github.com/spec/v1\n"):
                raise RuntimeError("LFS image is unavailable: " + path)
        return data

    catalog = json.loads(read("data/trpg_catalog.json"))
    manifest = json.loads(read("remake/data/manifest.json"))
    webp = set(manifest["webp"])
    files = {"icon.svg", "data/characters.json", "data/trpg_catalog.json", "remake/data/manifest.json",
             "remake/trpg-preview.html", "remake/css/base.css", "remake/css/trpg.css", "remake/js/core/util.js",
             "remake/js/core/chapter-clock.js", "remake/js/core/rules.js", "remake/js/core/venue-host.js", "remake/css/venue-host.css"}
    files.update(git("ls-tree", "-r", "--name-only", commit, "--", "remake/js/trpg").decode().splitlines())
    files.update(git("ls-tree", "-r", "--name-only", commit, "--", "remake/css/trpg-stage.css", "remake/img/ui/trpg").decode().splitlines())
    files.update(git("ls-tree", "-r", "--name-only", commit, "--", "remake/css/trpg-paper.css", "remake/css/ui-paper.css",
                     "remake/img/ui/paper").decode().splitlines())
    files.update("data/" + file for file in catalog.get("characterProfiles", []))
    if catalog.get("club", {}).get("file"):
        files.add("data/" + catalog["club"]["file"])
    files.update("remake/fonts/ZenKakuGothicNew-" + weight + ".woff2" for weight in ["Medium", "Bold", "Black"])

    def portrait(actor, face="normal"):
        meta = manifest["portraits"][actor]
        face = face if face in meta["faces"] else "normal"
        rel = f"sprites/characters/{actor}/chr_{actor}_{face}.png"
        files.add("remake/img/" + rel.removesuffix(".png") + ".webp" if rel in webp else "assets/" + rel)

    portrait("sai")

    if catalog.get("tableTalk"):
        files.add("data/" + catalog["tableTalk"])
        for block in json.loads(read("data/" + catalog["tableTalk"])).get("dialogues", []):
            for line in block["lines"]:
                portrait(line["speaker"], line.get("face", "normal"))

    for entry in catalog["scenarios"]:
        path = "data/" + entry["file"]
        files.add(path)
        scenario = json.loads(read(path))
        files.add(posixpath.normpath("remake/js/trpg/" + scenario["presentation"]["image"]))
        for actor in scenario["cast"]:
            portrait(actor["id"])
        for script in scenario["dialogues"]:
            for line in script["lines"]:
                portrait(line["speaker"], line.get("face", "normal"))

    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    previous = output / "SOURCE.json"
    if previous.is_file():
        old_paths = json.loads(previous.read_text(encoding="utf-8")).get("sha256", {})
        for path in set(old_paths) - files:
            target = output / path
            target.resolve().relative_to(output)
            target.unlink(missing_ok=True)
    hashes, total = {}, 0
    for path in sorted(files):
        data = read(path)
        target = output / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        hashes[path] = hashlib.sha256(data).hexdigest()
        total += len(data)
    (output / "index.html").write_text(
        '<!doctype html><html lang="ja"><meta charset="UTF-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>小さな卓の冒険</title>'
        '<meta http-equiv="refresh" content="0;url=./remake/trpg-preview.html">'
        '<script>location.replace("./remake/trpg-preview.html"+location.search+location.hash)</script>'
        '<body style="background:#172c31;color:#eae4d4">'
        '<a href="./remake/trpg-preview.html">小さな卓を開く</a></body></html>\n', encoding="utf-8")
    provenance = {"repository": "https://github.com/haseatsu114514-dot/shisha-game", "commit": commit,
                  "pull_request": args.pr, "entry": "remake/trpg-preview.html",
                  "note": "Deployment snapshot only. The GitHub game repository is the source of truth.", "sha256": hashes}
    (output / "SOURCE.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"game_commit": commit, "files": len(files), "bytes": total, "output": str(output)}))


if __name__ == "__main__":
    main()
