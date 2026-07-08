#!/usr/bin/env python3
"""台詞テキストエディタ（G4）— ブラウザで dialogue JSON を編集し、ビルド反映・Git反映まで行う。

起動:
  python3 tools/text_editor_server.py        # http://127.0.0.1:8321/ を開く
  （必ずリポジトリルートで実行。保存は data/dialogue/*.json へ直接書き戻す）

できること（画面上のボタン）:
  - 検索・編集・保存（本編と同じ autoWrap プレビュー／文字クリックで手動改行）
  - 「ビルド反映」= web/build_data.py（＋任意で build_standalone.py）を実行して data.js/dist を再生成
  - 「コミット & プッシュ」= data/ と生成物を現在のブランチへコミット、任意で push
    （main/master へのコミット・pushは安全のため拒否＝PR運用を壊さない）
    （data/dialogue に変更が無いときはコミットしない＝data.jsのタイムスタンプだけの空コミットを防ぐ）

マニュアル: docs/text_editor_manual.md（アプリ内の「ヘルプ」ボタンからも読める）
"""
import json
import re
import subprocess
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIALOGUE_DIR = ROOT / "data" / "dialogue"
PORT = 8321

# コミットで巻き取る対象（台詞の正本＋生成物）。これ以外は触らない
COMMIT_PATHS = ["data/dialogue", "web/js/data.js", "web/dist/shisha_ch1.html"]
PROTECTED_BRANCHES = {"main", "master"}


def run(cmd, timeout=600):
    """サブプロセスを引数リストで実行（シェルを介さない＝コマンドインジェクション無し）。"""
    p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def git(*args, timeout=180):
    return run(["git", *args], timeout=timeout)


def current_branch() -> str:
    code, out = git("rev-parse", "--abbrev-ref", "HEAD")
    return out.strip() if code == 0 else "?"


def wrap_js() -> str:
    """engine.js から autoWrap 一式（WRAP_* 定数含む）を切り出して配信。ミラーではなく実物。"""
    src = (ROOT / "web" / "js" / "engine.js").read_text()
    start = src.index("const WRAP_LIMIT")
    end = src.index("// [imp]/[warn]/[hint]")
    return src[start:end]


def list_files():
    return sorted(p.name for p in DIALOGUE_DIR.glob("*.json"))


def load_lines(fname: str):
    """ファイル内の全テキスト行を [{path, speaker, text, did}] で返す。path は保存時の逆引き用。"""
    d = json.loads((DIALOGUE_DIR / fname).read_text())
    out = []

    def walk(lines, prefix, did):
        for i, ln in enumerate(lines):
            if isinstance(ln, dict) and isinstance(ln.get("text"), str):
                out.append({"path": f"{prefix}/{i}", "speaker": ln.get("speaker", ""),
                            "text": ln["text"], "did": did})

    for di, dl in enumerate(d.get("dialogues", [])):
        did = dl.get("dialogue_id", f"#{di}")
        walk(dl.get("lines", []), f"{di}/lines", did)
        for bk, br in (dl.get("branches") or {}).items():
            walk(br, f"{di}/branches/{bk}", f"{did}:{bk}")
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


def dialogue_dirty() -> bool:
    """data/dialogue に未コミットの変更があるか。data.js のタイムスタンプだけの空コミットを防ぐ判定。"""
    code, out = git("status", "--porcelain", "--", "data/dialogue")
    return bool(out.strip())


def do_build(standalone: bool):
    log = []
    code, out = run(["python3", "web/build_data.py"])
    log.append("$ python3 web/build_data.py\n" + out)
    if code != 0:
        return False, "\n".join(log)
    if standalone:
        code, out = run(["python3", "web/build_standalone.py"])
        log.append("$ python3 web/build_standalone.py\n" + out)
        if code != 0:
            return False, "\n".join(log)
    return True, "\n".join(log)


def git_status():
    branch = current_branch()
    code, out = git("status", "--porcelain")
    changed = []
    for line in out.splitlines():
        path = line[3:].strip()
        if path.startswith("data/dialogue/") or path in ("web/js/data.js", "web/dist/shisha_ch1.html"):
            changed.append(path)
    return {"branch": branch, "changed": changed, "protected": branch in PROTECTED_BRANCHES,
            "dialogueDirty": dialogue_dirty()}


def git_commit(message: str, push: bool, standalone: bool):
    branch = current_branch()
    if branch in PROTECTED_BRANCHES:
        return False, f"ブランチ '{branch}' は保護されています（PR運用）。作業ブランチに切り替えてください。"
    if not dialogue_dirty():
        return False, "台詞（data/dialogue）に未コミットの変更がありません。保存してから実行してください。"
    log = []
    ok, blog = do_build(standalone)  # コミット前に必ず生成物を最新化
    log.append(blog)
    if not ok:
        return False, "ビルドに失敗したためコミットを中止しました。\n\n" + "\n".join(log)
    code, out = git("add", *COMMIT_PATHS)
    log.append("$ git add " + " ".join(COMMIT_PATHS) + "\n" + out)
    code, out = git("commit", "-m", message)
    log.append("$ git commit\n" + out)
    if code != 0:
        return False, "\n".join(log)
    if push:
        code, out = git("push", "-u", "origin", branch, timeout=180)
        log.append(f"$ git push -u origin {branch}\n" + out)
        if code != 0:
            return False, "コミットは成功、pushに失敗しました（再試行するかネットワークを確認）。\n\n" + "\n".join(log)
    return True, "\n".join(log)


class Handler(BaseHTTPRequestHandler):
    def _send(self, body, ctype="application/json; charset=utf-8", code=200):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self):
        n = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(n)) if n else {}

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        try:
            if u.path in ("/", "/index.html"):
                return self._send((ROOT / "web" / "tools" / "text_editor.html").read_bytes(),
                                   "text/html; charset=utf-8")
            if u.path == "/manual":
                md = (ROOT / "docs" / "text_editor_manual.md").read_text()
                return self._send(md.encode(), "text/markdown; charset=utf-8")
            if u.path == "/wrap.js":
                return self._send(wrap_js().encode(), "text/javascript; charset=utf-8")
            if u.path == "/api/files":
                return self._send(list_files())
            if u.path == "/api/lines":
                return self._send(load_lines(q["file"][0]))
            if u.path == "/api/git/status":
                return self._send(git_status())
        except Exception as e:  # noqa: BLE001 — 開発ツールなので握って表示
            return self._send({"error": str(e)}, code=500)
        return self._send({"error": "not found"}, code=404)

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        try:
            body = self._read_json()
            if u.path == "/api/save":
                fname = body["file"]
                if not re.fullmatch(r"[\w.-]+\.json", fname):
                    return self._send({"error": "bad file"}, code=400)
                save_line(fname, body["path"], body["text"])
                return self._send({"ok": True})
            if u.path == "/api/build":
                ok, log = do_build(bool(body.get("standalone")))
                return self._send({"ok": ok, "log": log})
            if u.path == "/api/git/commit":
                msg = (body.get("message") or "").strip()
                if not msg:
                    return self._send({"ok": False, "log": "コミットメッセージを入力してください。"})
                ok, log = git_commit(msg, bool(body.get("push")), bool(body.get("standalone")))
                return self._send({"ok": ok, "log": log})
        except Exception as e:  # noqa: BLE001
            return self._send({"error": str(e)}, code=500)
        return self._send({"error": "not found"}, code=404)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"台詞エディタ: http://127.0.0.1:{PORT}/ で起動（Ctrl+C で終了）")
    print(f"現在のブランチ: {current_branch()}")
    print("ヘルプ（マニュアル）はアプリ右上の「❓ヘルプ」から。docs/text_editor_manual.md も参照。")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
