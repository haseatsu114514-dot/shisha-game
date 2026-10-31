#!/usr/bin/env python3
"""画像選別の補充画像を OpenAI の画像APIで生成する（#1980）。

asset_sources/picker-refill-20261030/PROMPTS.md の各ブロックを読み、
共通部分＋1枚分の差分を1回の呼び出しに組み立てて、1枚ずつ生成する。

- キーは環境変数 OPENAI_API_KEY から読む（ファイル・リポジトリには書かない）。
- 添付指定のうちリポジトリに実在する画像と、refs/<対象ID>/ の参照画像を
  参照画像として images/edits に渡す。参照画像が無いときは generations。
- 出力: asset_sources/picker-refill-20261030/out/<対象ID>/refill1030-<対象ID>-NN.png
- 既にある出力は飛ばす（途中で止まっても続きから）。

使い方:
  python3 tools/picker_refill_generate.py --dry-run            # キー不要。組み立てと添付の確認だけ
  python3 tools/picker_refill_generate.py --check              # キーとモデルの疎通だけ確認
  python3 tools/picker_refill_generate.py --only t-city-ch5    # 1対象だけ生成
  python3 tools/picker_refill_generate.py                      # 全28対象×5枚
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "asset_sources" / "picker-refill-20261030"
PROMPTS = BASE / "PROMPTS.md"
OUT = BASE / "out"
REFS = BASE / "refs"
API = "https://api.openai.com/v1"
DEFAULT_MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
IMG_EXT = (".png", ".jpg", ".jpeg", ".webp")


def parse_blocks(text: str) -> list[dict]:
    blocks = []
    for m in re.finditer(r"^## \d+\. `([^`]+)`[^\n]*\n+```text\n(.*?)\n```", text, re.S | re.M):
        tid, body = m.group(1), m.group(2)
        parts = re.split(r"^--- (\d+)/(\d+): (\S+) ---\n", body, flags=re.M)
        header = parts[0].strip()
        variations = []
        for i in range(1, len(parts), 4):
            n, total, fname, chunk = parts[i], parts[i + 1], parts[i + 2], parts[i + 3]
            # 最後の差分の後ろにある「生成後チェック」は人の確認用なのでプロンプトに入れない
            chunk = re.split(r"^【生成後チェック", chunk, flags=re.M)[0].strip()
            variations.append({"n": int(n), "file": fname, "text": chunk})
        size = re.search(r"(\d{3,4})x(\d{3,4})", header)
        blocks.append({
            "targetId": tid,
            "header": header,
            "variations": variations,
            "size": f"{size.group(1)}x{size.group(2)}" if size else "1024x1024",
        })
    return blocks


def attachment_paths(block: dict) -> list[str]:
    sec = re.search(r"【添付する画像[^】]*】(.*?)(?:\n【|\Z)", block["header"], re.S)
    out: list[str] = []
    if sec:
        for p in re.findall(r"((?:assets|asset_sources|remake/img)/[^\s（）()、，,]+?\.(?:png|jpg|jpeg|webp))", sec.group(1)):
            if p not in out and (ROOT / p).is_file():
                out.append(p)
    return out


def is_lfs_pointer(fp: Path) -> bool:
    return fp.stat().st_size < 1024 and fp.read_bytes()[:40].startswith(b"version https://git-lfs")


def attachments(block: dict) -> list[Path]:
    """添付指定のうちリポジトリに実在する画像と、refs/<対象ID>/ の画像。"""
    found: list[Path] = []
    for p in attachment_paths(block):
        fp = ROOT / p
        if not is_lfs_pointer(fp) and fp not in found:  # LFSの実体が未取得のものは除く（--fetch-lfs で取得）
            found.append(fp)
    rdir = REFS / block["targetId"]
    if rdir.is_dir():
        found += sorted(f for f in rdir.iterdir() if f.suffix.lower() in IMG_EXT)
    return found[:16]


def api_request(path: str, key: str, data: bytes | None = None, ctype: str | None = None, timeout: int = 300) -> dict:
    req = urllib.request.Request(API + path, data=data, method="POST" if data else "GET")
    req.add_header("Authorization", f"Bearer {key}")
    if ctype:
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
    """APIが受け付けるサイズへ寄せる（縦横比で選ぶ）。"""
    w, h = (int(x) for x in size.split("x"))
    if abs(w - h) / max(w, h) < 0.1:
        return "1024x1024"
    return "1536x1024" if w > h else "1024x1536"


def fit_size(png: bytes, size: str) -> bytes:
    """受け取った画像を指定サイズに中央合わせで切り抜き・縮小する。"""
    w, h = (int(x) for x in size.split("x"))
    try:
        import io
        from PIL import Image
    except ImportError:
        return png
    im = Image.open(io.BytesIO(png)).convert("RGB")
    if im.size == (w, h):
        return png
    scale = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left, top = (im.width - w) // 2, (im.height - h) // 2
    im = im.crop((left, top, left + w, top + h))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def generate_one(key: str, model: str, prompt: str, size: str, refs: list[Path], quality: str) -> bytes:
    req_size = api_size(size)
    if refs:
        body, ctype = multipart({"model": model, "prompt": prompt, "size": req_size, "quality": quality, "n": "1"}, refs)
        res = api_request("/images/edits", key, body, ctype)
    else:
        body = json.dumps({"model": model, "prompt": prompt, "size": req_size, "quality": quality, "n": 1}).encode()
        res = api_request("/images/generations", key, body, "application/json")
    return fit_size(base64.b64decode(res["data"][0]["b64_json"]), size)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--check", action="store_true", help="キーとモデルの疎通だけ確認（モデル一覧を1回取得）")
    ap.add_argument("--only", nargs="*", help="対象IDを限定")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--quality", default="high")
    ap.add_argument("--per-target", type=int, default=5)
    ap.add_argument("--fetch-lfs", action="store_true", help="添付に必要なLFS画像の実体だけを git lfs pull で取得する")
    args = ap.parse_args()

    blocks = parse_blocks(PROMPTS.read_text(encoding="utf-8"))
    if args.only:
        blocks = [b for b in blocks if b["targetId"] in args.only]
    if args.fetch_lfs:
        need = sorted({p for b in blocks for p in attachment_paths(b) if is_lfs_pointer(ROOT / p)})
        print(f"LFS実体を取得: {len(need)}件")
        if need:
            import subprocess
            subprocess.run(["git", "lfs", "pull", "--include", ",".join(need)], cwd=ROOT, check=True)
    if args.dry_run:
        for b in blocks:
            refs = attachments(b)
            pend = [p for p in attachment_paths(b) if is_lfs_pointer(ROOT / p)]
            print(f"{b['targetId']}: {len(b['variations'])}枚 size={b['size']} 参照画像{len(refs)}枚"
                  f"{f'（LFS未取得{len(pend)}件）' if pend else ''} "
                  f"プロンプト長≈{len(b['header']) + max((len(v['text']) for v in b['variations']), default=0)}字")
            for r in refs:
                print(f"    - {r.relative_to(ROOT)}")
        print(f"合計 {len(blocks)}対象 / {sum(len(b['variations']) for b in blocks)}枚")
        return 0

    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        print("OPENAI_API_KEY が設定されていません（環境設定の Network secrets に追加し、新しいセッションで実行）", file=sys.stderr)
        return 2
    if args.check:
        res = api_request("/models", key)
        ids = sorted(m["id"] for m in res.get("data", []))
        img = [i for i in ids if "image" in i or "dall" in i]
        print(f"疎通OK: モデル{len(ids)}件。画像系: {', '.join(img) or '（なし）'}")
        print(f"使う予定のモデル {args.model}: {'あり' if args.model in ids else '一覧に無い'}")
        return 0

    log = OUT / "generation-log.jsonl"
    OUT.mkdir(parents=True, exist_ok=True)
    ok = skip = fail = 0
    for b in blocks:
        refs = attachments(b)
        tdir = OUT / b["targetId"]
        tdir.mkdir(parents=True, exist_ok=True)
        for v in b["variations"][: args.per_target]:
            dest = tdir / v["file"]
            if dest.exists():
                skip += 1
                continue
            prompt = b["header"] + "\n\n" + v["text"]
            for attempt in range(3):
                try:
                    png = generate_one(key, args.model, prompt, b["size"], refs, args.quality)
                    dest.write_bytes(png)
                    ok += 1
                    with log.open("a", encoding="utf-8") as f:
                        f.write(json.dumps({"file": str(dest.relative_to(ROOT)), "model": args.model, "size": b["size"],
                                            "refs": [str(r.relative_to(ROOT)) for r in refs],
                                            "at": time.strftime("%Y-%m-%dT%H:%M:%S")}, ensure_ascii=False) + "\n")
                    print(f"OK  {dest.relative_to(ROOT)}")
                    break
                except urllib.error.HTTPError as e:
                    msg = e.read().decode(errors="replace")[:300]
                    if e.code in (429, 500, 502, 503) and attempt < 2:
                        time.sleep(20 * (attempt + 1))
                        continue
                    print(f"NG  {v['file']}: HTTP {e.code} {msg}", file=sys.stderr)
                    fail += 1
                    break
                except Exception as e:  # noqa: BLE001
                    print(f"NG  {v['file']}: {e}", file=sys.stderr)
                    fail += 1
                    break
    print(f"生成 {ok}・既存のため省略 {skip}・失敗 {fail}")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
