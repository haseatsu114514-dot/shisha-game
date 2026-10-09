#!/usr/bin/env python3
"""公式配布音源をゲーム専用 .bgm へ変換。元MP3は公開リポジトリへ置かない。

python3 remake/tools/pack_bgm.py /path/to/source.mp3 assets/audio/bgm/<key>.bgm
依存: cryptography。形式と利用条件は asset_sources/music/confirmed-tournament-bgm-20261009.md。
"""
import argparse
import hashlib
import secrets
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC = b"SUIENBGM1"
# audio.js の読み込み処理と同じ形式キー。秘密鍵・DRMとしては扱わない。
KEY = bytes.fromhex("ac0152dff6217d519198cfba347e25d5dc5d853aaee8252f72da0bbdc626b8f2")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.source.suffix.lower() != ".mp3" or args.output.suffix != ".bgm":
        parser.error("source must be .mp3; output must be .bgm")
    source = args.source.read_bytes()
    if not source:
        parser.error("empty source")
    nonce = secrets.token_bytes(12)
    encrypted = AESGCM(KEY).encrypt(nonce, source, MAGIC)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(MAGIC + nonce + encrypted)
    print(f"packed {args.output}: {len(source)} source bytes; SHA-256 {hashlib.sha256(source).hexdigest()}")


if __name__ == "__main__":
    main()
