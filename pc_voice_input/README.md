# PC用 音声入力ツール（自作ベース）

`faster-whisper` を使って、OS標準より高精度を狙える音声入力ツールです。  
以下を実装済みです。

- 特定ホットキーで録音開始/停止
- Whisperで文字起こし
- 言い間違い・表記ゆれの自動変換
- フィラー（「えーと」「あの」等）の除外
- 文字起こし結果を自動で貼り付け（またはコピーのみ）

## 1. セットアップ

```bash
cd /Users/hasegawaatsuki/Documents/New\ project/pc_voice_input
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp config.example.toml config.toml
```

## 2. 実行

```bash
python main.py --config config.toml
```

起動後、`config.toml` の `app.hotkey` を押すと録音開始、もう一度押すと停止して文字起こしします。

## 3. 精度を上げるコツ

- `app.model_name` を `large-v3` にする（高精度だが重い）
- 固有名詞が多い場合は `app.initial_prompt` に語彙を入れる
- `app.beam_size` を 6-10 に上げる（遅くなるが精度改善しやすい）
- USBマイクなど入力品質を上げる
- `normalization.replacements` に業務用語の変換辞書を増やす

## 4. 主な設定項目

- `app.hotkey`: 録音の開始/停止キー
- `app.paste_after_transcribe`: `true` で自動貼り付け、`false` でコピーのみ
- `normalization.fillers`: 除外したいフィラー一覧
- `normalization.replacements`: 認識ミスの自動変換辞書

## 5. macOSで必要な権限

- マイクアクセス許可
- キーボード操作（貼り付け）に必要なアクセシビリティ許可

権限未設定だと、録音または自動貼り付けが動作しません。
