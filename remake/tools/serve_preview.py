#!/usr/bin/env python3
"""Serve the remake locally with room for simultaneous module requests."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128


class PreviewHandler(SimpleHTTPRequestHandler):
    def is_game_code(self):
        path = urlsplit(self.path).path
        return path.endswith("/") or Path(path).suffix.lower() in {
            ".html", ".js", ".css", ".json",
        }

    def send_head(self):
        if self.is_game_code():
            # A preview update must not combine old cached modules with new ones.
            for header in ("If-Modified-Since", "If-None-Match"):
                if header in self.headers:
                    del self.headers[header]
        return super().send_head()

    def end_headers(self):
        if self.is_game_code():
            self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8767)
    parser.add_argument("--directory", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    directory = args.directory.resolve()
    if not directory.is_dir():
        parser.error(f"Directory does not exist: {directory}")
    handler = partial(PreviewHandler, directory=str(directory))
    with PreviewServer(("127.0.0.1", args.port), handler) as server:
        print(f"Remake preview: http://127.0.0.1:{args.port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
