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

クラウド環境のChromiumで10ケースPASS。PCは1280×720、横持ちタッチは844×390。[10ケースの結果](browser-results.json)。
main `4989bd1`（施設遭遇・EDEN設定）に続き、`e22fece`（自然な関係会話・録音SE）も通常merge。続行の素材追加後はmain `be29f49`（ショップ・斧投げ・TRPG・ハガル資料）まで通常mergeし、他作業の要望台帳を保持。更新後の会話エンジンとデータで再検証した。

| ケース | 確認したこと |
| --- | --- |
| desktop-arbitrary-order-full-run | 到着→5地点を任意順→帰路。昼夜の実画像・押下状態、二重操作防止、全読了・再試遊 |
| touch-arbitrary-order-replay-and-return | 実タップで別順序、4室も見学、ボタンの枠内表示、再視聴で読了数が増えない、夜切替・再読み込みで試遊だけリセット |
| real-click-arrival-and-name-release | SKIP／turboなしで到着とあげは・REI・神崎・ヴォルクを実クリック。名乗る前は「？？？」、後で解禁。各人の室内見学と立ち絵の読込、文字の枠内、神崎の素性を早期公開しない紹介、あげはの県大会出場を確認 |
| partial-safe-ending-and-reset | 会場だけ訪問して途中終了し、最初から再試遊できる |
| room-image-recovery-and-night-return | 店内画像が壊れた時は見学を開始せず、再読込／地図復帰を選べる。復旧後の見学で夜の地図へ戻り、読了を重複加算しない |
| data-failure-retry | JSONが壊れていても再試行ボタンを表示、復旧後に試遊可能 |
| map-image-failure-retry | 昼マップが壊れても行き先を選べる。再読込で地図が復帰、夜も操作可能 |
| return-remembers-only-completed-visits | 0地点／会場のみ／あげはのみの帰路。未訪問の人物を思い出さず、未訪問の会場を確認済みと報告しない |
| station-image-failure-keeps-arrival-playable | 地上の駅前背景が壊れても、俯瞰マップ上で到着会話を続けられる |
| interrupted-dialogue-and-history-reset | 入口会話と室内見学中のpagehide／履歴復帰イベント。途中の名乗り・訪問・見学を完走扱いにせず、試遊が入口へ戻る |

全ケースで、本編オートセーブ・手動3枠・設定・起動時ロード用sessionStorage・無関係な保存値を先に用意して比較。StorageのsetItem/removeItem/clearも監視し、試遊からの書込みは0件。正常起動中のブラウザ例外とHTTP／通信失敗は0件。故障試験はHTTP 200の不正本文・画像を意図的に返す。

10ケースの通し操作は会話高速送りも併用する。実クリックの1ケースは到着・4人の挨拶・4室の見学を通常送りし、各人の紹介とnormal画像を観測。物理スマホ・Safari・ブラウザの実BFcache採用・公開版は未検証。履歴復帰試験はPageTransitionEventを使ったハンドラの検証で、実ブラウザがBFcacheへ格納した証明ではない。

## 実画面

- [入口](desktop-entry.png) / [地上の駅前へ到着](desktop-arrival.png)
- [PC・昼](desktop-map-day.png) / [PC・夜](desktop-map-night.png)
- [横持ちタッチ・昼](touch-map-day.png) / [横持ちタッチ・夜](touch-map-night.png)
- [名乗る前のあげは](desktop-unknown-name.png) / [終了](desktop-end.png)
- 店内と本人：[MELTY PUFF](desktop-room-ageha.png) / [神崎煙草店](desktop-room-kumicho.png) / [零-ZERO-](desktop-room-rei.png) / [鉄の煙の展示室](desktop-room-volk.png)

担当が昼夜の街マップを第1章と比較し、駅ビル・双塔・デッキ・スクランブル・商業街の規模差、昼夜の主要形状、文字とピンの干渉を目視確認した。夜のタッチ画像も、実際のnight状態と画像の切替完了後に撮影。4室の本人立ち絵と会話枠も、表示と文字が落ち着いた状態で目視した。初回の店内記録は人物が出た直後で空の会話枠を撮っていたため、登場と文字の表示完了を待って撮り直した。原画・画像QAは [街](../../../asset_sources/ch2-city/README.md)・[人物](../../../asset_sources/ch2-characters/README.md)・[内装](../../../asset_sources/ch2-interiors/README.md) の制作記録。

## 発見して修正したこと

- 初回bootのinitLayers前にbusy表示へ触れる不具合を修正。
- 地図全面のピン用レイヤーが昼夜ボタンを遮っていたため、ピンのボタンだけを押せるよう修正。
- 駅ピンの長い名称と読了数欄の行高を調整し、文字の枠外表示を修正。
- 帰路を完了した訪問のフラグで分岐し、未訪問の人物・会場の思い出を除外。
- 初期QAの夜画像は切替完了を待たずに撮っていた。実画像・aria状態・会話のフェード完了を検査して撮り直した。

## 残る制作

本編接続、地元との往復・日常、営業中の器具と内装差分、新登場3人の表情差分・専用紹介背景、孤立アーク、県大会、東京行き。神崎／REI／ヴォルクの通常立ち絵と4室の準備中背景は今回追加。あげは・博士は既存の正規立ち絵を使用。新店名はオーナーが選んだMELTY PUFF（メルティパフ）。

## 本編DAY1の接続後

台本を `data/dialogue/ch2_city.json` へ共有化。独立試遊は同じ町と既知／未面識分岐を使い、本編セーブへの書込み0件を維持する。県大会のピンは、C.STATIONと同じビルの「県大会ホール」に統一。main0614327のschema15と新しいOVA予告を統合して10ケースを再検証した。本編の進行と保存は [初日QA](../ch2-main/README.md) を参照。初日より先の自由行動・競技は未実装。

## オーナー追加の内装改修 C2P06

main `2d1dbe1` の制作ミニゲーム改修を通常merge後、素材・台本コミット `252a121` の4室で独立試遊10ケースと本編9ケースを再検証し、全件PASS。今回の [結果](browser-results.json) は実行時refが未指定だったため、`verified_content_commit` に照合した素材・台本のコミットを記録する。既存の本編保存・手動3枠・設定・起動セッションを保持し、独立試遊の書込み0件を維持。追加台詞lintはERROR 0／WARN 0、571場面の接続検査・35 JSONの読込・日常整合性もPASS。

4室のゲーム上のスクリーンショットを更新し、担当が実際に目視した。MELTY PUFFは白・ピンクのクマが棚とソファに見え、プリクラ・デコケータイ・豹柄を維持。神崎は木壁・黒革ソファ・執務机・大理石床・神棚・肖像画・金屏風の事務所で、畳・靴を脱ぐ台詞を除去。REIはCDケース・ギター2本とV系アクセサリーの飾りが見える。ヴォルクは旧開放棚を扉付き収納へ変更。人物が中央の飾りの一部を遮るが、店固有の飾りは両側にも残る。会話枠の文字・各人のnormal・新背景の読込と、タッパーやフレーバー缶を客席へ露出させていないことを確認。背景読込故障時の再試行・地図への復帰と、夜の街への復帰もPASS。

生成原画は改変せず保存し、4室の旧原画・実際の旧指示・配布も履歴として残した。自動検査は人物と新内装17ファイルの寸法・SHA256・WebP・framingを検証、旧8画像も以前のハッシュと一致。画像にタッパーがないことや家具構造は数値検査の結論ではなく目視結果として扱う。営業中の器具・夜用室内・実スマホ／Safariは今回の検査範囲外。

## 日常の続行後

本編にDAY2〜3の日常を追加しても、独立試遊の到着・地図・見学・帰路は同じ範囲に保つ。試遊から通常セーブを読まず書かない。自由日と新しい相談台本は本編の「翌日へ」からのみ読み込む。[自由日QA](../ch2-daily/README.md)を参照。
