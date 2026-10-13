# 第2章・隣町の街歩き試遊 QA

Issue [#514](https://github.com/haseatsu114514-dot/shisha-game/issues/514)。第2章制作の最初の試遊単位の検証で、日常14日・県大会の本編完走とは区別する。

## 起動・再現

```sh
python3 remake/tools/serve_preview.py --port 8123
# http://127.0.0.1:8123/remake/chapter2-preview.html
cd remake/test/browser
npm ci
cd ../../..
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/ch2_preview.mjs
```

PlaywrightとChromiumが必要。システムChromiumを使わない場合は `remake/test/browser` で `npx playwright install chromium` を実行し、実行ファイル指定を省く。

## 検証結果

クラウド環境のChromiumで9ケースPASS。PCは1280×720、横持ちタッチは844×390。
main `4989bd1`（施設遭遇・EDEN設定）に続き、`e22fece`（自然な関係会話・録音SE）も通常merge。双方の要望台帳を保持し、更新後の会話エンジンで9ケース・データ読込・日常整合性・指示資料・追加台詞を再確認した。

| ケース | 確認したこと |
| --- | --- |
| desktop-arbitrary-order-full-run | 到着→5地点を任意順→帰路。昼夜の実画像・押下状態、二重操作防止、全読了・再試遊 |
| touch-arbitrary-order-replay-and-return | 実タップで別順序、再視聴で読了数が増えない、夜切替・再読み込みで試遊だけリセット |
| real-click-arrival-and-name-release | SKIP／turboなしで到着とあげは・REIを実クリック。名乗る前は「？？？」、後で解禁。会話の文字が枠内に収まる |
| partial-safe-ending-and-reset | 会場だけ訪問して途中終了し、最初から再試遊できる |
| data-failure-retry | JSONが壊れていても再試行ボタンを表示、復旧後に試遊可能 |
| map-image-failure-retry | 昼マップが壊れても行き先を選べる。再読込で地図が復帰、夜も操作可能 |
| return-remembers-only-completed-visits | 0地点／会場のみ／あげはのみの帰路。未訪問の人物を思い出さず、未訪問の会場を確認済みと報告しない |
| station-image-failure-keeps-arrival-playable | 地上の駅前背景が壊れても、俯瞰マップ上で到着会話を続けられる |
| interrupted-dialogue-and-history-reset | 会話中のpagehideと履歴復帰イベント。途中の名乗り・訪問を完走扱いにせず、試遊が入口へ戻る |

全ケースで、本編オートセーブ・手動3枠・設定・起動時ロード用sessionStorage・無関係な保存値を先に用意して比較。StorageのsetItem/removeItem/clearも監視し、試遊からの書込みは0件。正常起動中のブラウザ例外とHTTP／通信失敗は0件。故障試験はHTTP 200の不正本文・画像を意図的に返す。

9ケースの到着以外の通し操作は会話高速送りも併用する。実クリックの1ケースは通常の文字送りとあげはの正規紹介を観測。物理スマホ・Safari・ブラウザの実BFcache採用・公開版は未検証。履歴復帰試験はPageTransitionEventを使ったハンドラの検証で、実ブラウザがBFcacheへ格納した証明ではない。

## 実画面

- [入口](desktop-entry.png) / [地上の駅前へ到着](desktop-arrival.png)
- [PC・昼](desktop-map-day.png) / [PC・夜](desktop-map-night.png)
- [横持ちタッチ・昼](touch-map-day.png) / [横持ちタッチ・夜](touch-map-night.png)
- [名乗る前のあげは](desktop-unknown-name.png) / [終了](desktop-end.png)

親担当が昼夜の街マップを第1章と比較し、駅ビル・双塔・デッキ・スクランブル・商業街の規模差、昼夜の主要形状、文字とピンの干渉を目視確認した。夜のタッチ画像も、実際のnight状態と画像の切替完了後に撮影。原画・画像QAは [素材制作記録](../../../asset_sources/ch2-city/README.md)。

## 発見して修正したこと

- 初回bootのinitLayers前にbusy表示へ触れる不具合を修正。
- 地図全面のピン用レイヤーが昼夜ボタンを遮っていたため、ピンのボタンだけを押せるよう修正。
- 駅ピンの長い名称と読了数欄の行高を調整し、文字の枠外表示を修正。
- 帰路を完了した訪問のフラグで分岐し、未訪問の人物・会場の思い出を除外。
- 初期QAの夜画像は切替完了を待たずに撮っていた。実画像・aria状態・会話のフェード完了を検査して撮り直した。

## 残る制作

本編接続、地元との往復・日常・店内背景、神崎／REI／ヴォルクの正規立ち絵、孤立アーク、県大会、東京行き。今回の試遊にない人物絵を他人の画像で代用していない。あげは・博士は既存の正規立ち絵を使用。
