# Issue #563 — 採用会話の接続 QA（画像組込みは未完）

環境: クラウド `/workspace/shisha-game`、Node 24 / `/usr/bin/chromium`。基準main `6c05ae31`。実装・出典・採用済み2表情の取得障害は [素材記録](../../../asset_sources/ch2-followups-issue563/README.md) を参照。

## 確認する変更

3人それぞれの既存chatを終えた次の有料訪問で、新しいfollowupを一度だけ読む。新キーなしの旧保存は、実相談回数0ならchat、1以上なら未読followup。新しい明示読了後は既存repeatへ戻る。料金3,000円・体力補正・1行動・再訪好感度呼出5・通常成長候補を保持し、新台本に追加報酬や新設定の制御行はない。

続編は正常終端・state所有者一致後に課金と読了を確定し、既存calendarのvisitedDay/slot/成長精算/保存へ戻す。既存6台本の内容とnormal画像2枚は基準mainと一致。保存schemaの変更や既存関係・在庫・思い出の移行はない。

## コマンドと結果

```sh
node --experimental-vm-modules remake/test/ch2_followups.mjs
node remake/test/ch2_progress.mjs
node --experimental-vm-modules remake/test/lime_consistency.mjs
python3 tools/lint_dialogue.py ch2_preparation
python3 tools/tidy_dialogue_text.py --dry-run
node remake/test/text_wrap.mjs
python3 tools/check_agent_docs.py
python3 remake/tools/serve_preview.py --port 8123
CHROME_EXECUTABLE_PATH=/usr/bin/chromium ARTIFACT_DIR=docs/qa/ch2-followups node remake/test/browser/ch2_followups.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium ARTIFACT_DIR=docs/qa/ch2-followups/regression CASE_FILTER=paid-city-talk-repeat-and-contact node remake/test/browser/ch2_daily.mjs
```

- 実prepare/loaderモジュールの隔離検査: 3人×相談回数未定義/0/1/17、初回→続編→repeat、欠落/不正台本、画像失敗、体力確認取消、明示cancelled、戻り値なし、例外、完走待ち、別stateへLOAD、早期saveなし、原子的な台本読込みをPASS。mockだけの表示合格とは扱わない。
- 章境界・LIME回帰PASS。対象台詞lint ERROR0/WARN0、tidy dry-runの対象ファイル変更提案0、text_wrapは全6780テキストPASS、agent docs/Git Safety/diff check PASS。legacy検査はERRORなし・既存WARN1。
- 実ブラウザ9ケースは [結果JSON](ch2-followups.json)。3人の高訪問回数・新キーなし保存からの正常完走、保存再開、同日再訪抑止、資源/旧記録保持、途中と最終行からのreload・再試行を確認。REIの完走は844×390タッチ。他は1280×720。
- 初回chat→新続編→既存repeatの実地図・費用・連絡先・保存の回帰は [結果JSON](regression/ch2-daily.json)。既存のassertを削除せず、2回目期待をfollowupへ更新し3回目repeatを追加した。

画像は現行採用背景・既存立ち絵で確認。代表画面は [あげは末尾](ageha-line-14-current-art.png)、[神崎末尾](kumicho-line-12-current-art.png)、[REIの会話](rei-line-7-current-art.png)。あげはの既存smile、名前欄、本文・会話枠を目視する。神崎・REIの新faceはnormalへ代替されており、新表情の成功証跡ではない。

## 失敗・訂正と未実施

- 最初の隔離検査はfixtureのdefault引数が明示undefinedを1へ置き換え、旧保存の期待に失敗。fixtureを訂正し、未定義の相談回数も実モジュールで検査した。
- 最初の新規台詞lintは採用稿のREI句読点にWARN1。意味を変えず現行規約に合わせて「。……」を「、……」へ直し、新規WARN0を確認。
- 既存回帰の拡張初回は、LOAD後にテスト用`__dailyTrace`フックが消えたためTypeError。全assertを保持し、再読込後に観測フックを再登録して再検証しPASS。失敗ログは [初回ログ](regression-initial-failure.log) に保持し、修正前を成功扱いしない。
- Library正規転送と取得情報更新後の再試行は4件ともdownload failed。配信先への接続が403。採用画像の実bytes・hash・RGBA/alpha・顔領域差分・本人性・足元・WebP/manifest・新表情のゲーム表示は未検証／未実装。採用済みの画像を再生成して代用していない。
- 物理スマホ/Safari、公開版、NEW GAMEから全章通し、AUTO/SKIP全組合せは未実施。今回の新会話はテキストのみだが、現行normalで読めたことを完成した2表情のQAへ流用しない。
- 前回棚卸しの全体`check_speakers.py`失敗は今回修正していない。今回の対象台本lint成功と区別する。

最終head・CI・Draft PR・予約・次の具体手順はPRとIssue引き継ぎに記録する。画像取得待ちを残したDraftとして保存し、マージ・公開・Issue終了・予約解除は行わない。
