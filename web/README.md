# シーシャバトル 第1章 — ブラウザ版

Godot 本体なしで遊べる、第1章「SMOKE CROWN CUP」のHTML/JS実装。
会話・キャラ・フレーバー・バイトイベントは `data/` のJSONをそのまま使用している。

## 遊び方

`web/index.html` をブラウザで開くだけ（ダブルクリックでOK）。

ローカルサーバー経由で遊ぶ場合はリポジトリルートで:

```bash
python3 -m http.server 8000
# → http://localhost:8000/web/
```

- クリック / Enter / Space で読み進め
- セーブは localStorage に自動保存（タイトルの「つづきから」で再開）

## ゲームの流れ

1. **オープニング** — `ch1_opening`
2. **日常パート（7日間 × 2行動）** — バイト / 練習ミニゲーム / キャラ訪問
   （スミさん・つむぎ・なる・アダム・みんと）/ スポット（チョイザップ・観音堂・カフェ・C.STATION）
   - 2日目夜: サラリーマンの常連イベント / 5日目夜: スミさんの昔話 / 7日目夜: 前夜イベント
3. **8日目: SMOKE CROWN CUP** — テーマ選択 → フレーバーミックス（12g配合）→
   パッキング → 炭配置 → 蒸らし → 引きゲージ → プレゼン → 4人対決の審査結果
4. 1位で章クリア。2位以下は敗北（再挑戦可能）

ステータスは本家仕様どおり5種（技術/センス/根性/魅力/洞察）、表示は★1〜5のみで
数値は見せない。上昇通知も「少し上がった/上がった/大きく上がった」の抽象表現。

## ファイル構成

| ファイル | 内容 |
|---|---|
| `index.html` / `css/style.css` | 画面・スタイル |
| `js/engine.js` | 会話エンジン（dialogue JSONスキーマ互換: choice/condition/branch/show_cg/set_flag/game_over/next_id） |
| `js/game.js` | ゲーム進行（日常ループ・ミニゲーム・大会・採点） |
| `js/data.js` | **自動生成**のデータバンドル |
| `build_data.py` | `data/` から `js/data.js` を再生成するスクリプト |
| `test/playthrough.mjs` | 自動通しプレイテスト（優勝ルート） |
| `test/screenshots.mjs` | スクリーンショット撮影＋敗北→再挑戦ルートのテスト |

## データを更新したら

`data/dialogue/ch1_*.json` などを編集した後は再生成する:

```bash
python3 web/build_data.py
```

## テスト

```bash
npx http-server -p 8123 &          # リポジトリルートで
node web/test/playthrough.mjs      # 通しプレイ（要 playwright）
node web/test/screenshots.mjs      # 敗北ルート＋スクショ
```

## 会話データ内の報酬の扱い

セリフ内の「【技術】が上がった」等の文をエンジンが検出してステータスに反映する
（少し=+2 / 無印=+3 / 大きく=+5）。報酬キューが無い会話でも、訪問・スポットごとの
フォールバック報酬を必ず付与する（CLAUDE.md のイベント報酬ルール準拠）。
