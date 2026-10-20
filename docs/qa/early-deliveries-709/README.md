# 序盤の日程とPEPPERMINT配達 (#709)

WORKER: codex-709-20261019-peppermint-0015
BASE: 8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d
CLAIM: [39272409432](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/39272409432) success、実ログ/最新台帳owner/run一致。

## 実装と境界

- DAY1は経費のミント購入→退勤の指示→なるの店で偵察→帰宅/就寝。偵察後の枠を2にし、再勤務/配達のマップを出さない。偵察の料金/体力/読了と行動後処理は従来の1回。支給・配達では成長や追加抽選を付けない。
- C.STATIONはDAY2の配達前に無料見学/参加登録。なるの紹介と参加登録の時制も合わせた。受付・面識・アプリ導入・初回スロット体験・既存の無成長処理は削除せず、追加の行動枠/抽選を使わない。既に登録済みなら再実行しない。
- DAY2昼みんと→夜アダム。配達各2000円/体力-10/1行動を維持。みんとの固有会話/自主訪問回数は増やさず、アダムは従来の初回体験。
- みんとの開始背景は呼出し側とmetadataの両方で `peppermint.png`。最初の発話は店内のみんと。路上到着/看板確認/ドア/入店鈴/背景切替の導入を削除。
- DAY1夜/偵察直後の旧保存からも料金を再度引かず帰宅へ。旧DAY1夜の受諾済み約束は保持。先に訪問/配達済みの店は再配達しない。
- 進行中の新日程だけマーカーを保存し、約束/休業/全日休養で遅れても順序通り繰越す。DAY2を過ぎた既存セーブには配達を新規挿入しない。
- #683の通常visitRival gate、#732の炭、#731の予約変更、#736/#550の保留成果は含めない。#699/#691/#705/#706は現在mainの成果を使う。

## 検証

通常モーション有効の最終12ケースが全PASS。PC/横タッチ × 通常/AUTO/SKIP × 新規fixture/旧schema13本番LOAD再開の **11,946フレーム、street背景0**。全12ケースとも最初のみんとの発話から9行すべて `peppermint` 背景。手当2000円・体力-10・1行動、固有話/好感度/能力/経験値不変、配達済みの保存・LOADで再加算なしもPASS。

[集計JSON](frame-summary.json)・[全フレーム/背景更新のgzip JSON](frames/)・[PC新規](pc-new-first-line.webp)・[PC旧保存](pc-legacy-first-line.webp)・[横タッチ新規](touch-new-first-line.webp)・[横タッチ旧保存](touch-legacy-first-line.webp)。証跡全体は約323KB。映像全量のアップロードを避け、再現可能なフレーム観測と開始画面を保存。

NEW GAMEから第1章クリアまでPASS。DAY1/2の案内、初回登録、配達2件、SAVE/LOAD、DAY14の敗北→再挑戦→優勝、未演出スロット0を確認。[通しログ](playthrough.log.gz)。

- `node --experimental-vm-modules remake/test/early_deliveries.mjs`: 本番calendarをVMで実行。順序/精算/一度きり/旧保存/約束/休業/休養延期。
- `node --experimental-vm-modules remake/test/illness.mjs`: 既存病気/全日休養/約束/夜イベント延期。
- `node --experimental-vm-modules remake/test/daily_consistency.mjs`: 既存シフト整合/台本。
- `CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/minto_delivery.mjs`: PC/横タッチ×通常/AUTO/SKIP×新規fixture/旧schema13文書再読込。本番タイトルのLOAD/オートセーブからresumeGameで配達へ復帰。通常のモーションを有効にしたまま、rAFで全背景レイヤーを毎フレーム採取し、MutationObserverでも更新を採取。最初の台詞から全行が店内、全記録にstreet背景なしをassert。配達後の精算/保存/LOADで再加算なしも確認。
- `CHROME_BIN=/usr/bin/chromium node remake/test/playthrough.mjs`: NEW GAMEの買い出し/偵察/帰宅/参加登録/配達から第1章大会まで。初回受付の後回しに合わせてguide検査を更新し、既存検査は維持。
- 台詞lint対象3ファイル/links/canon/agent docs/syntax/diff/Git Safety。

フレーム確認はブラウザが提示するrAF/DOMの観測。物理ディスプレイの撮影・実機Safariは未実施。

## 取得量

フルクローンなし。既存checkout/全素材/Playwright/Chromiumを利用。main限定fetchの新規小packは4300 bytes、同時に既存オブジェクトを約4.9GBのローカルpackへ再梱包。実通信量は未計測であり4300 bytesだけと断定しない。追加fetchを停止し、既存2119commitの親を通信なしで検証してshallow境界を復旧、期待旧SHA付きref更新とFFで最新mainへ。API読取は必要文書/Issue/PR/Actionsのテキストのみ。画像/音声/依存の新規downloadなし。high以上への変更なし。

## 差分レビュー（自己レビュー）

- 呼出し元/metadata/制御行/最初の発話を照合。どちらの開始指定にもstreetがなく、途中に屋外の導入も残らない。エンジンの素材待ちと幕は変更しない。
- DAY1終了、DAY2各配達のslot更新と保存、先訪問/済みflags、旧保存の遡及抑止を追跡。料金/体力の二重引き・手当の二重付与・新しい能力加算を追加しない。
- なるの紹介/翌朝の登録の時制、無料受付/アプリ/初回スロット、約束と全日休養の経路を照合。遅れたみんとをアダムが追い越さない。
- Open #683の通常来店変更と本件の変更行は重ならない。最新mainを再確認してCI/レビュー/未完了を解消するまでマージしない。独立した第三者のAPPROVEを得たという記録ではない。

旧head6962e5ddのCIは25成功/6失敗。selection/ch2_daily/rest/contexts/chromium/venuesの失敗ログを確認。最新main7ce32bdには#683のfixture/アクセス/リール修正が統合済み。main統合後の新headで再検証するまでマージしない。

## 最新mainの統合

main `7ce32bd83481d76ab1591709e71843907692558e` のtreeを親に、保存head `b88cc2804274b96e6827e8107bfc42c9884951a6` の#709ファイル28件を重ねるAPI統合。重複するcalendarの通常来店gateとplaythroughのpageerror記録はmain側を保持。画像等の無関係なmainのtreeは変更せず、新しい画像downloadなし。両headを親にしたmerge commitを同じ作業branchへ期待旧SHA付きFF更新する。ローカルの統合後ゲームテストは未実施で、統合headのCIを別途確認する。元の実装/証跡は先行headの検証として維持する。

旧headのrest失敗は、配達2件完了済みで登録flagだけないDAY2旧保存にも登録案内を挿入したことが原因。完了済み配達を両方確認して登録案内を出さず、登録flagを推測で立てない条件へ修正。統合済みcalendarを使うVMの新回帰PASS。モックのopeningStatusを実際の戻り値に合わせ、無進行時はfixtureを明示失敗させる。新headの実ブラウザrest CIは別途確認する。
