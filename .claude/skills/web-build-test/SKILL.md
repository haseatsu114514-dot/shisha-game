---
name: web-build-test
description: web/ または data/ を変更した後のビルドとヘッドレステストの実行手順。変更内容ごとに走らせるべきテストの対応表、重いテストの直列実行ルール、テストフックを壊さないための注意。Use after changing any file under web/ or data/, or when asked to run/verify the browser game tests.
---

# ビルド＆ヘッドレステスト手順

## ビルド（data/ か web/ を変えたら必ず両方）

```bash
pip install Pillow numpy scipy    # 初回のみ。scipy欠落だと立ち絵の横位置(ax)が黙ってズレる
python3 web/build_data.py         # data/*.json → web/js/data.js
python3 web/build_standalone.py   # → web/dist/shisha_ch1.html（1ファイル配布版）
```

- `web/js/data.js`・`web/dist/*.html` は**生成物**。直接編集禁止・レビュー対象外。
- ビルドを忘れると「直したのに変わらない」が起きる。コミット前に生成物の差分があるか確認。

## テスト実行

```bash
python3 -m http.server 8123 &     # リポジトリルートで起動して放置（全テストの前提）
node web/test/<name>.mjs
```

- **重い3本（playthrough / ch2 / screenshots）は絶対に同時に走らせない**。
  CPU枯渇でタイムアウトして偽の失敗になる。1本ずつ直列で。playthrough は約6分かかる。
- playwright 依存（`/opt/node22/lib/node_modules/playwright` にある。`playwright install` 不要）。
- 基準は**全緑**。`web/test/` に新しいテストが増えていることがあるので `ls web/test/` で確認する。

## 変更内容 → 実行テスト対応表

| 変更したもの | 最低限走らせるテスト |
|---|---|
| ch1 の台詞・イベント・大会 | `playthrough.mjs`（優勝ルート通し） |
| ch2 の台詞・イベント・大会 | `ch2.mjs` |
| 敗北・リトライ・GAME OVER 周り | `screenshots.mjs` |
| スロット（確率・天井・文言） | `reel.mjs`（純ロジック・速い） |
| くじ | `kuji.mjs` |
| 経済・バイト報酬・体力バランス | `balance.mjs` |
| マップ・スポットUI | `map_hover.mjs` |
| 立ち絵・spriteScale・画像処理 | `portraits.mjs`（身長比の回帰。速い） |
| フレーバー所持・ショップ | `flavor_ownership.mjs` / `fookah.mjs` |
| ゲーム全体に波及するリファクタ | 速い純ロジック系を全部 → 重い3本を1本ずつ |

## 壊してはいけないテストフック（変更前に必ず確認）

`web/js/game.js` を触るとき、以下はテストが依存している。リネーム・削除・挙動変更しない:

- `__pullDebug` / `__heatDebug` / `__steamDebug().end()`（蒸らし弾幕の即終了）
- 調整(R2)の「このままでいく」選択肢
- 審査の `.trial-appeal[data-backed][data-cat]` ＋ `#trial-doubt[data-need]`
- 結果カウントの `pointer-events:none`
- タイミング系ミニゲームの `miniCountdown()`（3・2・1）

## テストが落ちたとき

1. まず**同時実行・サーバ未起動・playwright 経路**の環境要因を疑う（偽の失敗が多い）。
2. 本物の失敗なら、テストを緩めて通すのではなく**仕様（CLAUDE.md・master_spec）側に照らして**
   コードを直す。テストの期待値を変えるのはオーナー指定の仕様変更があった場合のみ。
3. 落ちたまま「たぶん大丈夫」でコミットしない。落ちた事実と原因を報告する。
