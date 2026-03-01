#!/usr/bin/env python3
"""
DALL-E 3 キャラクター立ち絵生成スクリプト

使い方:
  # 環境変数にAPIキーを設定
  export OPENAI_API_KEY="sk-proj-..."

  # 全キャラ生成
  python3 tools/generate_sprites_dalle3.py

  # 特定キャラだけ生成
  python3 tools/generate_sprites_dalle3.py hajime sumi

  # キャラ一覧を表示
  python3 tools/generate_sprites_dalle3.py --list

  # 出力先を変更 (デフォルト: assets/generated/)
  python3 tools/generate_sprites_dalle3.py --output assets/sprites/ hajime

  # サイズ変更 (デフォルト: 1024x1792 = 縦長、立ち絵向き)
  python3 tools/generate_sprites_dalle3.py --size 1024x1024 hajime
"""

import argparse
import os
import re
import sys
import time
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    print("Error: openai パッケージが必要です")
    print("  pip install openai")
    sys.exit(1)


# brand/gemini_sprite_prompts.md からプロンプトを解析
PROMPTS_FILE = Path(__file__).parent.parent / "brand" / "gemini_sprite_prompts.md"


def parse_prompts(filepath: Path) -> dict[str, dict]:
    """gemini_sprite_prompts.md からキャラ名とプロンプトを抽出する"""
    text = filepath.read_text(encoding="utf-8")

    # ベーススタイルプロンプトを抽出 (最初のコードブロック)
    base_match = re.search(
        r"## ベーススタイルプロンプト.*?```\n(.*?)```",
        text,
        re.DOTALL,
    )
    base_prompt = base_match.group(1).strip() if base_match else ""

    # 各キャラのセクションを抽出
    # ### で始まるヘッダーとその後のコードブロックをペアにする
    characters = {}

    # キャラ名→ID のマッピング
    name_to_id = {
        "はじめ": "hajime",
        "スミさん": "sumi",
        "つむぎ": "tsumugi",
        "みんと": "minto",
        "アゲハ": "ageha",
        "ドクターケムリ": "dr_kemuri",
        "アダム": "adam",
        "なる": "naru",
        "南雲": "nagumo",
        "前園": "maezono",
        "サラリーマン": "salaryman",
        "かこ": "kako",
        "りら": "rira",
    }

    # ### ヘッダーを見つけてそれぞれのコードブロックを取得
    sections = re.split(r"(?=^### )", text, flags=re.MULTILINE)

    for section in sections:
        header_match = re.match(r"### (.+?)(?:\n|$)", section)
        if not header_match:
            continue

        header = header_match.group(1).strip()

        # コードブロックを取得
        code_match = re.search(r"```\n(.*?)```", section, re.DOTALL)
        if not code_match:
            continue

        char_prompt = code_match.group(1).strip()

        # ヘッダーからキャラIDを推定
        char_id = None
        suffix = ""
        for name, cid in name_to_id.items():
            if name in header:
                char_id = cid
                # みんとの素の姿を区別
                if "素の姿" in header:
                    suffix = "_casual"
                elif "コンカフェ" in header:
                    suffix = "_concafe"
                break

        if char_id:
            key = f"{char_id}{suffix}"
            characters[key] = {
                "name": header,
                "prompt": char_prompt,
                "base_prompt": base_prompt,
            }

    return characters


def generate_image(
    client: OpenAI,
    char_id: str,
    char_data: dict,
    output_dir: Path,
    size: str = "1024x1792",
) -> Path | None:
    """DALL-E 3 で1キャラの立ち絵を生成する"""

    # DALL-E 3 用にプロンプトを調整
    # (gemini_sprite_prompts.md のプロンプトはそのまま使える)
    full_prompt = char_data["prompt"]

    print(f"\n{'='*60}")
    print(f"生成中: {char_data['name']}")
    print(f"ID: {char_id}")
    print(f"サイズ: {size}")
    print(f"{'='*60}")

    try:
        response = client.images.generate(
            model="dall-e-3",
            prompt=full_prompt,
            size=size,
            quality="hd",
            n=1,
        )

        image_url = response.data[0].url
        revised_prompt = response.data[0].revised_prompt

        # 画像をダウンロード
        import urllib.request

        output_path = output_dir / f"{char_id}_dalle3.png"
        urllib.request.urlretrieve(image_url, str(output_path))

        print(f"保存完了: {output_path}")
        if revised_prompt:
            # DALL-E 3 が書き換えたプロンプトを記録
            log_path = output_dir / f"{char_id}_dalle3_revised.txt"
            log_path.write_text(revised_prompt, encoding="utf-8")
            print(f"修正プロンプト: {log_path}")

        return output_path

    except Exception as e:
        print(f"エラー ({char_id}): {e}")
        # 課金上限エラーの場合は即座に中断
        if "billing_hard_limit_reached" in str(e):
            print("\n⚠ OpenAI の課金上限に達しています。")
            print("  https://platform.openai.com/settings/organization/billing/overview")
            print("  で Usage limits の Hard limit を引き上げてください。")
            sys.exit(1)
        return None


def main():
    parser = argparse.ArgumentParser(
        description="DALL-E 3 キャラクター立ち絵生成"
    )
    parser.add_argument(
        "characters",
        nargs="*",
        help="生成するキャラID (省略時: 全キャラ)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="利用可能なキャラ一覧を表示",
    )
    parser.add_argument(
        "--output",
        default=str(Path.home() / "Desktop" / "shisha_sprites"),
        help="出力ディレクトリ (デフォルト: ~/Desktop/shisha_sprites/)",
    )
    parser.add_argument(
        "--size",
        default="1024x1792",
        choices=["1024x1024", "1024x1792", "1792x1024"],
        help="画像サイズ (デフォルト: 1024x1792 縦長)",
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help="OpenAI API キー (省略時: OPENAI_API_KEY 環境変数)",
    )
    args = parser.parse_args()

    # プロンプト読み込み
    if not PROMPTS_FILE.exists():
        print(f"エラー: {PROMPTS_FILE} が見つかりません")
        sys.exit(1)

    characters = parse_prompts(PROMPTS_FILE)

    if args.list:
        print("利用可能なキャラクター:")
        print(f"{'ID':<20} {'名前'}")
        print("-" * 60)
        for cid, data in characters.items():
            print(f"  {cid:<20} {data['name']}")
        sys.exit(0)

    # APIキー取得
    api_key = args.api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("エラー: OpenAI API キーが設定されていません")
        print("  export OPENAI_API_KEY='sk-proj-...'")
        print("  または --api-key オプションで指定")
        sys.exit(1)

    client = OpenAI(api_key=api_key)

    # 出力ディレクトリ作成
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 生成対象を決定
    if args.characters:
        targets = {}
        for cid in args.characters:
            if cid in characters:
                targets[cid] = characters[cid]
            else:
                print(f"警告: '{cid}' は見つかりません。--list で一覧を確認してください")
        if not targets:
            sys.exit(1)
    else:
        targets = characters

    # 生成実行
    results = []
    total = len(targets)
    for i, (cid, data) in enumerate(targets.items(), 1):
        print(f"\n[{i}/{total}]", end="")
        result = generate_image(client, cid, data, output_dir, args.size)
        results.append((cid, result))

        # レートリミット対策: 連続生成時は少し待つ
        if i < total:
            print("(5秒待機中...)")
            time.sleep(5)

    # 結果サマリー
    print(f"\n{'='*60}")
    print("生成結果サマリー")
    print(f"{'='*60}")
    success = sum(1 for _, r in results if r)
    fail = sum(1 for _, r in results if not r)
    for cid, result in results:
        status = "OK" if result else "FAILED"
        print(f"  [{status}] {cid}")
    print(f"\n成功: {success} / 失敗: {fail} / 合計: {total}")
    print(f"出力先: {output_dir.resolve()}")


if __name__ == "__main__":
    main()
