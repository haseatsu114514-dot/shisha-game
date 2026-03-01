#!/usr/bin/env python3
"""
表情差分生成スクリプト

Gemini nanobanana pro (gemini-2.0-flash-preview-image-generation) を使って
assets/ 直下の通常表情参照画像から smile / surprise / sad / serious を生成する。

使い方:
  # 全キャラクター・全表情を生成
  python3 tools/generate_expressions.py --all

  # 特定キャラのみ
  python3 tools/generate_expressions.py --char hajime

  # 特定キャラ・特定表情のみ
  python3 tools/generate_expressions.py --char sumi --expressions smile serious

  # 上書き生成（既存ファイルを無視）
  python3 tools/generate_expressions.py --all --force

環境変数:
  GEMINI_API_KEY  Google AI Studio の API キー（必須）
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SPRITES = ASSETS / "sprites" / "characters"

# ─── モデル設定 ────────────────────────────────────────────────
# nanobanana pro = gemini-2.0-flash-preview-image-generation
# nanobanana2    = gemini-2.0-flash-exp  （テキスト生成用・画像出力非対応）
MODEL = "gemini-2.0-flash-preview-image-generation"

# ─── 通常表情の参照画像（assets/ 直下） ─────────────────────────
REFERENCE_IMAGES: dict[str, Path] = {
    "hajime":  ASSETS / "hazime.png",
    "sumi":    ASSETS / "sumi.png",
    "tsumugi": ASSETS / "tumugi.png",
}

EXPRESSIONS = ["smile", "surprise", "sad", "serious"]

# ─── プロンプト ───────────────────────────────────────────────
# スタイル固定の共通指示
_STYLE = (
    "This is a retro pixel-art anime visual novel character sprite. "
    "The character stands in a relaxed full-body pose against a solid bright green chroma-key background. "
    "The art style uses chunky outlines and a limited color palette typical of retro Japanese RPG sprites. "
    "IMPORTANT: Do NOT change the character's hair style, hair color, eye color, outfit, shoes, pose, "
    "body proportions, background color, or art style in any way. "
    "Only change the facial expression as described below."
)

EXPRESSION_PROMPTS: dict[str, str] = {
    # smile ── 嬉しい・好意的
    "smile": (
        f"{_STYLE} "
        "Change only the facial expression to a warm, genuine anime smile. "
        "The corners of the mouth should be upturned in a soft, friendly smile — not a wide toothy grin. "
        "The eyes should be slightly narrowed or brightened, conveying happiness and warmth. "
        "Eyebrows should be relaxed and slightly raised. "
        "Target emotion: 嬉しい (happy, pleased, friendly)."
    ),

    # surprise ── 驚き・リアクション
    "surprise": (
        f"{_STYLE} "
        "Change only the facial expression to a surprised, startled anime expression. "
        "The eyes should be wide open with visible irises, eyebrows raised high. "
        "The mouth should be slightly open — a small open circle or slightly parted lips — "
        "as if reacting to something unexpected. "
        "Target emotion: 驚き (surprised, startled, caught off guard)."
    ),

    # sad ── 悲しみ・落ち込み
    "sad": (
        f"{_STYLE} "
        "Change only the facial expression to a sad, dejected anime expression. "
        "The inner corners of the eyebrows should be raised slightly (creating a worried arch). "
        "The eyes should droop, with a downward gaze or half-closed lids. "
        "The mouth should be flat or gently downturned at the corners. "
        "No tears are needed — just quiet sadness. "
        "Target emotion: 悲しみ (sad, downcast, dispirited)."
    ),

    # serious ── 真剣・考え事
    "serious": (
        f"{_STYLE} "
        "Change only the facial expression to a serious, focused anime expression. "
        "The eyebrows should be level or very slightly lowered, showing concentration rather than anger. "
        "The eyes should look forward intently with a calm, steady gaze. "
        "The mouth should be closed, lips gently pressed together in a composed line. "
        "Target emotion: 真剣 (serious, focused, deep in thought)."
    ),
}


# ─── 生成処理 ────────────────────────────────────────────────
def generate_expression(
    client,
    char_id: str,
    expression: str,
    ref_path: Path,
    force: bool = False,
) -> bool:
    """1表情を生成して保存。成功したら True を返す。"""
    from google.genai import types  # 遅延インポート（インストール確認後に実行）

    out_path = SPRITES / f"chr_{char_id}_{expression}.png"

    if out_path.exists() and not force:
        print(f"  skip  {out_path.relative_to(ROOT)}  (already exists, use --force to overwrite)")
        return False

    print(f"  generating  {char_id} / {expression} ...", end=" ", flush=True)

    image_bytes = ref_path.read_bytes()

    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
            EXPRESSION_PROMPTS[expression],
        ],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(part.inline_data.data)
            print(f"saved → {out_path.relative_to(ROOT)}")
            return True

    print("WARN: no image in response", file=sys.stderr)
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Gemini nanobanana pro で表情差分を生成")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true", help="全キャラクターを処理")
    group.add_argument("--char", choices=list(REFERENCE_IMAGES), help="対象キャラクター ID")
    parser.add_argument(
        "--expressions",
        nargs="+",
        choices=EXPRESSIONS,
        default=EXPRESSIONS,
        metavar="EXPR",
        help=f"生成する表情 (default: {' '.join(EXPRESSIONS)})",
    )
    parser.add_argument("--force", action="store_true", help="既存ファイルを上書き")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        sys.exit("ERROR: 環境変数 GEMINI_API_KEY が設定されていません。")

    try:
        from google import genai
    except ImportError:
        sys.exit("ERROR: google-genai が未インストールです。\n  pip install google-genai")

    client = genai.Client(api_key=api_key)

    targets = list(REFERENCE_IMAGES) if args.all else [args.char]

    ok = 0
    skip = 0
    fail = 0

    for char_id in targets:
        ref_path = REFERENCE_IMAGES[char_id]
        if not ref_path.exists():
            print(f"[{char_id}] 参照画像が見つかりません: {ref_path.relative_to(ROOT)}")
            fail += 1
            continue

        print(f"\n[{char_id}]  ref: {ref_path.relative_to(ROOT)}")
        for expr in args.expressions:
            result = generate_expression(client, char_id, expr, ref_path, force=args.force)
            if result is True:
                ok += 1
            elif result is False:
                skip += 1
            else:
                fail += 1

    print(f"\n完了: 生成={ok}  スキップ={skip}  失敗={fail}")


if __name__ == "__main__":
    main()
