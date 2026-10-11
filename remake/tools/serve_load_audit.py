#!/usr/bin/env python3
"""計測用の配信モデル: Range、gzip、600秒キャッシュ（実ホストの実測とは区別する）。"""
import argparse
import gzip
import io
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class AuditServer(ThreadingHTTPServer):
    request_queue_size = 128


class AuditHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "public, max-age=600")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        self.remaining = None
        file = Path(self.translate_path(self.path))
        if file.is_dir():
            file /= "index.html"
        if not file.is_file():
            return super().send_head()
        stat = file.stat()
        byte_range = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
        if byte_range:
            first, last = byte_range.groups()
            if not first and not last:
                self.send_error(416)
                return None
            start = int(first) if first else max(0, stat.st_size - int(last))
            end = min(int(last), stat.st_size - 1) if first and last else stat.st_size - 1
            if start > end or start >= stat.st_size:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{stat.st_size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return None
            self.send_response(206)
            self.send_header("Content-Type", self.guess_type(str(file)))
            self.send_header("Content-Range", f"bytes {start}-{end}/{stat.st_size}")
            self.send_header("Content-Length", str(end - start + 1))
            self.send_header("Last-Modified", self.date_time_string(stat.st_mtime))
            self.end_headers()
            handle = file.open("rb")
            handle.seek(start)
            self.remaining = end - start + 1
            return handle
        if file.suffix in {".html", ".js", ".css", ".json", ".svg"} and "gzip" in self.headers.get("Accept-Encoding", ""):
            if self.headers.get("If-Modified-Since") == self.date_time_string(stat.st_mtime):
                self.send_response(304)
                self.end_headers()
                return None
            body = gzip.compress(file.read_bytes(), mtime=0)
            self.send_response(200)
            self.send_header("Content-Type", self.guess_type(str(file)))
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Last-Modified", self.date_time_string(stat.st_mtime))
            self.end_headers()
            return io.BytesIO(body)
        return super().send_head()

    def copyfile(self, source, output):
        if self.remaining is None:
            return super().copyfile(source, output)
        while self.remaining:
            block = source.read(min(65536, self.remaining))
            if not block:
                break
            output.write(block)
            self.remaining -= len(block)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8124)
    parser.add_argument("--directory", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    handler = partial(AuditHandler, directory=str(args.directory.resolve()))
    with AuditServer(("127.0.0.1", args.port), handler) as server:
        print(f"Load audit model: http://127.0.0.1:{args.port}/remake/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
