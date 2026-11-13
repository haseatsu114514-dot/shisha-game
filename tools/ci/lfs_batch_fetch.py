#!/usr/bin/env python3
"""Download the Git LFS objects behind the given pointer files with a few batch requests.

Used by tools/ci/lfs_images.sh before it replaces each pointer with `git lfs smudge`.
`git lfs smudge` asks the LFS API once per file. CI checks out without credentials, so a
change to hundreds of images (2026-11-13: 320 portraits re-encoded, LD03) made every browser
shard send hundreds of unauthenticated API requests and fail with "LFS: API rate limit
exceeded". Here the API is asked once per 100 objects; the downloads themselves go to the
storage host and do not count against that limit. Objects already in the local LFS store
(restored from the CI cache) are skipped. Anything that fails here is left for the per-file
smudge that follows, so this script never makes the fetch stricter.

usage: python3 tools/ci/lfs_batch_fetch.py <pointer file>...
"""
import concurrent.futures
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

BATCH = 100
WORKERS = 8
LFS_JSON = "application/vnd.git-lfs+json"


def lfs_env():
    out = subprocess.run(["git", "lfs", "env"], capture_output=True, text=True, check=True).stdout
    endpoint = re.search(r"^Endpoint=(\S+)", out, re.M)
    media = re.search(r"^LocalMediaDir=(.+)$", out, re.M)
    if not endpoint or not media:
        raise SystemExit("git lfs env: no Endpoint or LocalMediaDir")
    return endpoint.group(1), media.group(1).strip()


def read_pointer(path):
    with open(path, "rb") as f:
        text = f.read(1024).decode("utf-8", "replace")
    oid = re.search(r"^oid sha256:([0-9a-f]{64})$", text, re.M)
    size = re.search(r"^size (\d+)$", text, re.M)
    return (oid.group(1), int(size.group(1))) if oid and size else None


def stored(media, oid, size):
    path = os.path.join(media, oid[:2], oid[2:4], oid)
    return os.path.isfile(path) and os.path.getsize(path) == size


def request(url, data=None, headers=None, tries=5):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=headers or {}, method="POST" if data else "GET")
            with urllib.request.urlopen(req, timeout=120) as res:
                return res.read()
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == tries - 1:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == tries - 1:
                raise
        time.sleep(2 ** attempt)


def download(media, item):
    oid, size = item["oid"], item["size"]
    action = (item.get("actions") or {}).get("download")
    if not action:
        raise RuntimeError(f"{oid}: {item.get('error', 'no download action')}")
    body = request(action["href"], headers=action.get("header") or {})
    if len(body) != size or hashlib.sha256(body).hexdigest() != oid:
        raise RuntimeError(f"{oid}: content does not match the pointer")
    folder = os.path.join(media, oid[:2], oid[2:4])
    os.makedirs(folder, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=folder)
    with os.fdopen(fd, "wb") as f:
        f.write(body)
    os.replace(tmp, os.path.join(folder, oid))


def main(paths):
    endpoint, media = lfs_env()
    wanted = {}
    for path in paths:
        pointer = read_pointer(path)
        if pointer and not stored(media, *pointer):
            wanted[pointer[0]] = pointer[1]
    print(f"Git LFS batch: {len(wanted)} object(s) to download")
    if not wanted:
        return 0
    headers = {"Accept": LFS_JSON, "Content-Type": LFS_JSON}
    objects = [{"oid": oid, "size": size} for oid, size in wanted.items()]
    items = []
    for start in range(0, len(objects), BATCH):
        payload = json.dumps({"operation": "download", "transfers": ["basic"], "objects": objects[start:start + BATCH]}).encode()
        items += json.loads(request(f"{endpoint}/objects/batch", payload, headers))["objects"]
    failed = 0
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        for future in concurrent.futures.as_completed([pool.submit(download, media, item) for item in items]):
            try:
                future.result()
            except Exception as error:  # left for the per-file smudge that follows
                failed += 1
                print(f"Git LFS batch: {error}", file=sys.stderr)
    print(f"Git LFS batch: {len(items) - failed} downloaded, {failed} left for per-file download")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
