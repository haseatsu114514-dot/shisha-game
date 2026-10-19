# 序盤の日程とPEPPERMINT配達 (#709)

WORKER: codex-709-20261019-peppermint-0015
BASE: 8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d
CLAIM: [39272409432](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/39272409432) success、実ログ/最新台帳owner/run一致。

## 実装と境界

- DAY1は経費のミント購入→退勤の指示→なるの店で偵察→帰宅/就寝。偵察後の枠を2にし、再勤務/配達のマップを出さない。偵察の料金/体力/読了/成長/抽選は従来の1回。
- C.STATIONはDAY2の配達前に無料見学/参加登録。なるの紹介と参加登録の時制も合わせた。受付・面識・アプリ導入・初回スロット体験・施設成長は削除せず、追加の行動枠/抽選を使わない。既に登録済みなら再実行しない。
- DAY2昼みんと→夜アダム。配達各2000円/体力-10/1行動を維持。みんとの固有会話/自主訪問回数は増やさず、アダムは従来の初回体験。
- みんとの開始背景は呼出し側とmetadataの両方で `peppermint.png`。最初の発話は店内のみんと。路上到着/看板確認/ドア/入店鈴/背景切替の導入を削除。
- DAY1夜/偵察直後の旧保存からも料金を再度引かず帰宅へ。旧DAY1夜の受諾済み約束は保持。先に訪問/配達済みの店は再配達しない。
- 進行中の新日程だけマーカーを保存し、約束/休業/全日休養で遅れても順序通り繰越す。DAY2を過ぎた既存セーブには配達を新規挿入しない。
- #683の通常visitRival gate、#732の炭、#731の予約変更、#736/#550の保留成果は含めない。#699/#691/#705/#706は現在mainの成果を使う。

## 検証

実行中のブラウザ検証/NEW GAME通しはPRで結果を追記。完了前の記録をPASSと読み替えない。

- `node --experimental-vm-modules remake/test/early_deliveries.mjs`: 本番calendarをVMで実行。順序/精算/一度きり/旧保存/約束/休業/休養延期。
- `node --experimental-vm-modules remake/test/illness.mjs`: 既存病気/全日休養/約束/夜イベント延期。
- `node --experimental-vm-modules remake/test/daily_consistency.mjs`: 既存シフト整合/台本。
- `CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/minto_delivery.mjs`: PC/横タッチ×通常/AUTO/SKIP×新規fixture/旧schema13文書再読込。本番タイトルのLOAD/オートセーブからresumeGameで配達へ復帰。通常のモーションを有効にしたまま、rAFで全背景レイヤーを毎フレーム採取し、MutationObserverでも更新を採取。最初の台詞から全行が店内、全記録にstreet背景なしをassert。配達後の精算/保存/LOADで再加算なしも確認。
- `CHROME_BIN=/usr/bin/chromium node remake/test/playthrough.mjs`: NEW GAMEの買い出し/偵察/帰宅/参加登録/配達から第1章大会まで。初回受付の後回しに合わせてguide検査を更新し、既存検査は維持。
- 台詞lint対象3ファイル/links/canon/agent docs/syntax/diff/Git Safety。

フレーム確認はブラウザが提示するrAF/DOMの観測。物理ディスプレイの撮影・実機Safariは未実施。

## 取得量

フルクローンなし。既存checkout/全素材/Playwright/Chromiumを利用。main限定fetchの新規小packは4300 bytes、同時に既存オブジェクトを約4.9GBのローカルpackへ再梱包。実通信量は未計測であり4300 bytesだけと断定しない。追加fetchを停止し、既存2119commitの親を通信なしで検証してshallow境界を復旧、期待旧SHA付きref更新とFFで最新mainへ。API読取は必要文書/Issue/PR/Actionsのテキストのみ。画像/音声/依存の新規downloadなし。high以上への変更なし。
