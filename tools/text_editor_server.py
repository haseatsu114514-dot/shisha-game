#!/usr/bin/env python3
"""台詞テキストエディタ（G4・2026-07-07）— ブラウザで dialogue JSON を直接編集する。

使い方:
  python3 tools/text_editor_server.py        # http://127.0.0.1:8321/ が開く
  （リポジトリルートで実行。保存すると data/dialogue/*.json に直接書き戻す）

- 画面: web/tools/text_editor.html（ファイル選択→行一覧→編集＋本編と同じ改行プレビュー）
- 改行規則はミラーではなく web/js/engine.js から autoWrap をそのまま切り出して配信する
  （/wrap.js）。engine.js を変えてもエディタが古い規則でプレビューする事故を防ぐ。
- 保存後は `python3 web/build_data.py && python3 web/build_standalone.py` を忘れずに。
"""
import json
import re
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIALOGUE_DIR = ROOT / "data" / "dialogue"
PORT = 8321


def wrap_js() -> str:
    """engine.js から autoWrap 一式（WRAP_* 定数含む）を切り出す。"""
    src = (ROOT / "web" / "js" / "engine.js").read_text()
    start = src.index("const WRAP_LIMIT")
    end = src.index("// [imp]/[warn]/[hint]")
    return src[start:end]


def list_files():
    return sorted(p.name for p in DIALOGUE_DIR.glob("*.json"))


def load_lines(fname: str):
    """ファイル内の全テキスト行を [{path, speaker, text}] で返す。path は保存時の逆引き用。"""
    d = json.loads((DIALOGUE_DIR / fname).read_text())
    out = []

    def walk(lines, prefix):
        for i, ln in enumerate(lines):
            if isinstance(ln, dict) and isinstance(ln.get("text"), str):
                out.append({"path": f"{prefix}/{i}", "speaker": ln.get("speaker", ""), "text": ln["text"]})

    for di, dl in enumerate(d.get("dialogues", [])):
        walk(dl.get("lines", []), f"{di}/lines")
        for bk, br in (dl.get("branches") or {}).items():
            walk(br, f"{di}/branches/{bk}")
    return out


def save_line(fname: str, path: str, text: str):
    p = DIALOGUE_DIR / fname
    d = json.loads(p.read_text())
    parts = path.split("/")
    di = int(parts[0])
    dl = d["dialogues"][di]
    if parts[1] == "lines":
        target = dl["lines"][int(parts[2])]
    else:
        target = dl["branches"][parts[2]][int(parts[3])]
    target["text"] = text
    with open(p, "w") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")


class Handler(BaseHTTPRequestHandler):
    def _send(self, body, ctype="application/json; charset=utf-8", code=200):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        if u.path in ("/", "/index.html"):
            html = (ROOT / "web" / "tools" / "text_editor.html").read_bytes()
            return self._send(html, "text/html; charset=utf-8")
        if u.path == "/wrap.js":
            return self._send(wrap_js().encode(), "text/javascript; charset=utf-8")
        if u.path == "/api/files":
            return self._send(list_files())
        if u.path == "/api/lines":
            return self._send(load_lines(q["file"][0]))
        return self._send({"error": "not found"}, code=404)

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if u.path == "/api/save":
            fname = body["file"]
            if not re.fullmatch(r"[\w.-]+\.json", fname):
                return self._send({"error": "bad file"}, code=400)
            save_line(fname, body["path"], body["text"])
            return self._send({"ok": True})
        return self._send({"error": "not found"}, code=404)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"台詞エディタ: http://127.0.0.1:{PORT}/ で起動（Ctrl+C で終了）")
    print("保存後は python3 web/build_data.py && python3 web/build_standalone.py を実行してください")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
