#!/usr/bin/env python3
"""OpenAI の画像APIで、JSONの指示一覧から素材をまとめて生成する（汎用・#1980 の picker_refill_generate.py の簡易版）。

使い方:
  python3 tools/openai_image_batch.py <prompts.json> <出力フォルダ> [--only id,id] [--force] [--model MODEL]

prompts.json は次の配列:
  [{"id": "stage_backdrop", "size": "1536x1024", "quality": "high", "prompt": "...",
    "background": "transparent" (任意), "refs": ["参照画像の相対パス"] (任意)}]

認証はクラウド環境のプロキシ（api.openai.com・Authorization: Bearer）が付ける。手元で使う場合だけ
環境変数 OPENAI_API_KEY を付ける（ファイル・リポジトリには書かない）。
出力フォルダに <id>.png と generation.json（モデル・寸法・SHA256・指示）を書く。
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

API = "https://api.openai.com/v1"
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2.5-sunburst")


def api_request(path: str, key: str | None, data: bytes, ctype: str, timeout: int = 600) -> dict:
    req = urllib.request.Request(API + path, data=data, method="POST")
    if key:
        req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", ctype)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def multipart(fields: dict, files: list[Path]) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    out = bytearray()
    for k, v in fields.items():
        out += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    for f in files:
        mime = {"png": "image/png", "webp": "image/webp"}.get(f.suffix.lower().lstrip("."), "image/jpeg")
        out += f"--{boundary}\r\nContent-Disposition: form-data; name=\"image[]\"; filename=\"{f.name}\"\r\nContent-Type: {mime}\r\n\r\n".encode()
        out += f.read_bytes() + b"\r\n"
    out += f"--{boundary}--\r\n".encode()
    return bytes(out), f"multipart/form-data; boundary={boundary}"


def api_size(size: str) -> str:
    w, h = (int(x) for x in size.split("x"))
    if abs(w - h) / max(w, h) < 0.1:
        return "1024x1024"
    return "1536x1024" if w > h else "1024x1536"


def generate(key: str | None, model: str, item: dict) -> bytes:
    size = api_size(item.get("size", "1024x1024"))
    fields = {"model": model, "prompt": item["prompt"], "size": size, "quality": item.get("quality", "medium"), "n": 1}
    if item.get("background"):
        fields["background"] = item["background"]
        fields["output_format"] = "png"
    refs = [ROOT / p for p in item.get("refs", [])]
    try:
        if refs:
            body, ctype = multipart({k: str(v) for k, v in fields.items()}, refs)
            res = api_request("/images/edits", key, body, ctype)
        else:
            res = api_request("/images/generations", key, json.dumps(fields).encode(), "application/json")
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        if fields.get("background") and "background" in detail:
            fields.pop("background"); fields.pop("output_format", None)
            res = api_request("/images/generations", key, json.dumps(fields).encode(), "application/json")
        else:
            raise RuntimeError(f"HTTP {e.code}: {detail[:400]}") from e
    return base64.b64decode(res["data"][0]["b64_json"])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("prompts")
    ap.add_argument("out")
    ap.add_argument("--only", default="")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    args = ap.parse_args()
    items = json.loads(Path(args.prompts).read_text())
    only = {s for s in args.only.split(",") if s}
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    log_path = out / "generation.json"
    log = json.loads(log_path.read_text()) if log_path.exists() else []
    key = os.environ.get("OPENAI_API_KEY") or None
    for item in items:
        if only and item["id"] not in only:
            continue
        dest = out / f"{item['id']}.png"
        if dest.exists() and not args.force:
            print(f"skip {item['id']} (exists)"); continue
        t0 = time.time()
        for attempt in range(3):
            try:
                png = generate(key, args.model, item)
                break
            except Exception as e:  # noqa: BLE001
                print(f"{item['id']}: attempt {attempt + 1} failed: {e}", file=sys.stderr)
                if attempt == 2:
                    png = None
                time.sleep(5 * (attempt + 1))
        if not png:
            print(f"FAIL {item['id']}"); continue
        dest.write_bytes(png)
        log = [e for e in log if e.get("id") != item["id"]]
        log.append({"id": item["id"], "file": str(dest.relative_to(ROOT)) if dest.is_relative_to(ROOT) else str(dest), "model": args.model,
                    "size": api_size(item.get("size", "1024x1024")), "quality": item.get("quality", "medium"), "background": item.get("background"),
                    "refs": item.get("refs", []), "sha256": hashlib.sha256(png).hexdigest(), "prompt": item["prompt"],
                    "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "seconds": round(time.time() - t0, 1)})
        log_path.write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n")
        print(f"ok {item['id']} {len(png)//1024}KB {round(time.time()-t0)}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
