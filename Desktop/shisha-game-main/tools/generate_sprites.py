#!/usr/bin/env python3
"""
DALL-E 3 キャラクタースプライト 一括生成スクリプト
煙の向こう側 / シーシャバトル

Usage:
    python3 tools/generate_sprites.py
    OPENAI_API_KEY="sk-..." python3 tools/generate_sprites.py

プロンプトソース: brand/dalle3_sprite_prompts.md
保存先: assets/sprites/characters/
"""

import os
import re
import sys
import time
import urllib.request
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    print("[ERROR] openai パッケージが見つかりません。")
    print("  pip3 install openai  を実行してください。")
    sys.exit(1)

# ─── 設定 ────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent
PROMPT_FILE  = PROJECT_ROOT / "brand" / "dalle3_sprite_prompts.md"
OUTPUT_DIR   = PROJECT_ROOT / "assets" / "sprites" / "characters"

MODEL   = "dall-e-3"
SIZE    = "1024x1792"
QUALITY = "hd"

# 強制再生成（既存ファイルがあっても上書き）するファイル名
FORCE_GENERATE_FILES = {
    "chr_hajime_normal.png",
    "chr_minto_cafe_normal.png",
    "chr_dr_kemuri_normal.png",
}
# ─────────────────────────────────────────────────────────


def parse_prompt_file(path: Path) -> list[dict]:
    """
    brand/dalle3_sprite_prompts.md を解析してキャラクターリストを返す。

    ## chr_xxx_normal | force=true
    [prompt text]
    ---
    """
    text = path.read_text(encoding="utf-8")
    characters = []

    # `## ` で始まるセクションに分割
    sections = re.split(r"\n## ", text)

    for section in sections[1:]:  # 最初のヘッダー前は説明文なのでスキップ
        lines = section.strip().splitlines()
        if not lines:
            continue

        # ヘッダー行の解析: "chr_hajime_normal | force=true"
        header = lines[0].strip()
        header_parts = [p.strip() for p in header.split("|")]
        filename_stem = header_parts[0].strip()
        filename = filename_stem + ".png" if not filename_stem.endswith(".png") else filename_stem

        force = False
        for part in header_parts[1:]:
            if "force=true" in part.lower():
                force = True

        # プロンプト本文（区切り線 `---` の前まで、空行の後から）
        prompt_lines = []
        skip_blank = True
        for line in lines[1:]:
            if line.strip() == "---":
                break
            if skip_blank and line.strip() == "":
                continue
            skip_blank = False
            prompt_lines.append(line)

        prompt = " ".join(prompt_lines).strip()
        if not prompt:
            continue

        characters.append({
            "filename": filename,
            "force":    force,
            "prompt":   prompt,
        })

    return characters


def download_image(url: str, dest: Path) -> None:
    """URL から画像をダウンロードして dest に保存"""
    urllib.request.urlretrieve(url, dest)


def generate_sprites():
    # APIキー確認
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        print("[ERROR] 環境変数 OPENAI_API_KEY が設定されていません。")
        sys.exit(1)

    client = OpenAI(api_key=api_key)

    # 出力ディレクトリ作成
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[INFO] 保存先: {OUTPUT_DIR}")

    # プロンプトファイル読み込み
    if not PROMPT_FILE.exists():
        print(f"[ERROR] プロンプトファイルが見つかりません: {PROMPT_FILE}")
        sys.exit(1)

    characters = parse_prompt_file(PROMPT_FILE)
    print(f"[INFO] {len(characters)} キャラクターのプロンプトを読み込みました\n")

    success_count = 0
    skip_count    = 0
    error_count   = 0

    for i, char in enumerate(characters, 1):
        filename = char["filename"]
        force    = char["force"] or (filename in FORCE_GENERATE_FILES)
        prompt   = char["prompt"]
        dest     = OUTPUT_DIR / filename

        print(f"[{i:02d}/{len(characters):02d}] {filename}")

        # スキップ判定
        if dest.exists() and not force:
            print(f"        → スキップ（既存ファイルあり）\n")
            skip_count += 1
            continue

        if dest.exists() and force:
            print(f"        → 強制再生成（既存ファイルを上書き）")

        # DALL-E 3 API 呼び出し
        try:
            print(f"        → 生成中... ({MODEL} / {SIZE} / {QUALITY})")
            response = client.images.generate(
                model=MODEL,
                prompt=prompt,
                size=SIZE,
                quality=QUALITY,
                n=1,
            )

            image_url = response.data[0].url
            print(f"        → URL: {image_url}")

            # ダウンロード
            download_image(image_url, dest)
            print(f"        → 保存完了: {dest.relative_to(PROJECT_ROOT)}\n")
            success_count += 1

            # レート制限対策（dall-e-3 は 5 img/min が上限）
            if i < len(characters):
                time.sleep(13)

        except Exception as e:
            print(f"        → [ERROR] 生成失敗: {e}\n")
            error_count += 1
            continue

    # サマリー
    print("=" * 50)
    print(f"完了: 生成={success_count} / スキップ={skip_count} / エラー={error_count}")
    print("=" * 50)


if __name__ == "__main__":
    generate_sprites()
