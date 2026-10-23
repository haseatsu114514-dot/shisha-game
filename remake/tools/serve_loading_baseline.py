#!/usr/bin/env python3
"""#609 comparison only: serve the three changed modules from an explicit Git base.

Other resources come from the same checkout. No working file or Git ref is changed.
Use only when the compared runtime diff is exactly these modules. This is a local
gzip/Range/cache model, not a claim about GitHub Pages response timing.
"""
import argparse
import gzip
import io
import subprocess
from functools import partial
from pathlib import Path
from urllib.parse import urlsplit

from serve_load_audit import AuditHandler, AuditServer

MODULES = ("remake/js/core/ui.js", "remake/js/vn/engine.js", "remake/js/craft/session.js")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ref", required=True)
    parser.add_argument("--port", type=int, default=8610)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    ref = subprocess.check_output(["git", "rev-parse", "--verify", args.ref + "^{commit}"], cwd=root, text=True).strip()
    changed = subprocess.check_output(["git", "diff", "--name-only", ref, "--", "remake/js", "remake/css", "data", "assets"], cwd=root, text=True).splitlines()
    if set(changed) - set(MODULES):
        parser.error("Additional runtime differences require a new baseline: " + ", ".join(changed))
    bodies = {"/" + name: subprocess.check_output(["git", "show", f"{ref}:{name}"], cwd=root) for name in MODULES}

    class BaselineHandler(AuditHandler):
        def send_head(self):
            body = bodies.get(urlsplit(self.path).path)
            if body is None:
                return super().send_head()
            self.remaining = None
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript")
            self.send_header("X-Loading-Baseline", ref)
            if "gzip" in self.headers.get("Accept-Encoding", ""):
                body = gzip.compress(body, mtime=0)
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Vary", "Accept-Encoding")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return io.BytesIO(body)

    with AuditServer(("127.0.0.1", args.port), partial(BaselineHandler, directory=str(root))) as server:
        print(f"Baseline {ref}: http://127.0.0.1:{args.port}/remake/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
