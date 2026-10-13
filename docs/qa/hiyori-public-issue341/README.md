# #341 ひより・公開版の序盤QA

## 正式引き継ぎと最新公開版（2026-10-12）

新worker `codex-romance-20261012-c9053659` が既存PR #410とブランチを正式に継承。
[管理者承認6131313521](https://github.com/haseatsu114514-dot/shisha-game/issues/341#issuecomment-6131313521)、[transfer38298981423](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38298981423)、[status38299135629](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38299135629) はSUCCESSで、実CLAIMED/TRANSFERRED/CLAIM_VALIDATED noticeを確認した。旧workerの停止は#404の停止記録、成果回収は#411の引き継ぎで確認し、元のhead `7570fb27` の成果を保持した。予約復旧は独立PR #476で対応した。

最新main `e40664019ea79c0c18a2acf29cdbf44d2df17404` を通常merge。一時の自動publisher workflowとtriggerだけを撤去し、ゲーム・台本・素材を変更していない。現在の公開[Pages deployment38297027528](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38297027528)（`4c897e66dff8882a0860b199ab26ef99e2c4f6a2`）はSUCCESS。[9ファイルのSHA256照合](latest-public-20261012/public-hashes.json)で最新mainのゲームデータと一致する。e4066401は予約基盤だけの差分で、公開ゲームの対象commitは4c897e66として記録する。

| 最新公開版の再検証 | 件数・結果 | 証拠 |
|---|---|---|
| ♥3停止・救済・旧セーブ・LIME予約/料金 | 4 PASS | [gate](latest-public-20261012/gate/hiyori-gate.json) |
| 5店・報告・伝言・再会・支払・画像/保存 | 8 PASS | [encounters](latest-public-20261012/encounters/hiyori-encounters.json) |
| ひよりの実カットイン・PC/タッチ/動きを減らす | 3 PASS | [intro](latest-public-20261012/intro/hiyori-intro.json) |
| オート/手動・旧スキーマ・破損・PC/タッチ/回転 | 6 PASS | [save/load](latest-public-20261012/save/save-load.json) |
| 再会の中断・実SKIP・旧schema5と未読保持 | 2 PASS | [reunion](latest-public-20261012/reunion-schema12/reunion-readiness.json) |

追加2件は旧QAの期待値schema11だけで初回FAILした。現行 `state.js` の正式SCHEMAは12（当日休養と夜予定延期）なので、QAの期待値を12へ更新して再実行した。ゲームの移行処理は変更せず、未読の33点保持→読了で最大15点救済、旧66点保持、素顔/仕事相談の未発火などの厳密な確認は維持する。[初回の期待値不一致](latest-public-20261012/reunion-schema11-expectation/reunion-readiness.json)も履歴として残す。

新規ゲームからの通常操作は、**PC/タッチともDAY9・好感度51・実救済1点でPASS**。既存23件と合わせ、最新公開版の計25件が成功した。日付・好感度・既読を注入しない既存runnerを使い、初対面→報告/学生時代→伝言→仕事疲れ→LIME→tonari再会→三人→仕事入口と、実キャッシュ再利用を記録する。ひよりのPC初登場画像も実画面で確認した。[通常操作の結果・最終保存状態](latest-public-20261012/walkthrough/results.json)、[PC最終マップ](latest-public-20261012/walkthrough/pc-complete-map.png)、[タッチ最終マップ](latest-public-20261012/walkthrough/mobile-complete-map.png)を保存。実キャッシュはPC/タッチとも冷起動0件・温キャッシュで再利用を確認し、リソース欠落とブラウザ例外は0件。LIME返信だけでは日付/行動/料金/好感度を変えず、実際の再会を経て救済を一度だけ反映した。検証後の9ファイルも途中の照合と同じSHA256を保持する。

最新結果の再実行は前掲コマンドの`TEST_REF`を公開配信commitへ、`ARTIFACT_DIR`を新しい保存先へ更新する。自然な新規2件は`walkthrough.mjs`、追加の中断2件は現行schema12期待値の`reunion.mjs`を使う。ChromiumのPC/横持ちタッチでのQAであり、実機Safariや未制作後半・全旧スキーマ全組合せの確認とは扱わない。

### 旧workerの実行履歴（保持）

公開URLの既存修正を実ブラウザで確認する。ひよりのシナリオ・素材・共通のLIME/マップ/関係APIは変更しない。

WORKER: `codex-set2-20261012-1ad27b34`。claim [run 38201903908](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38201903908) の coordinate job SUCCESS と同workerのbot予約記録を確認済み。検証開始時mainは `134b1a5a327cf25ddab94b6ab4ed18d604735bbf`、公開 [Pages run 38199885108](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38199885108) はSUCCESS。

[公開ファイル照合](public-hashes.json) の10ファイルは開始時mainとSHA256一致。既存回帰の公開版23ケースはPASS。一方、日付・好感度・既読を注入しない新規プレイはPC/タッチとも再会の連絡へ到達せずFAIL。この不足を隠さず、独立した修正Issue [#411](https://github.com/haseatsu114514-dot/shisha-game/issues/411) に記録した。

## 再現

リポジトリルートで、固定Playwright依存とChromiumを使う。管理クラウドでは `/home/agent/.pki/nssdb` の書込みがNSS初期化に必要。TLS検証を無効化せず、既存の環境CAを使用する。検証ブラウザは専用contextで、通常のプレイヤーの保存領域を開かない。

```bash
export BASE_URL=https://haseatsu114514-dot.github.io/shisha-game/remake/
export CHROME_EXECUTABLE_PATH=/usr/bin/chromium
export NODE_PATH="$PWD/remake/test/browser/node_modules"
export TEST_REF=134b1a5a327cf25ddab94b6ab4ed18d604735bbf
ARTIFACT_DIR="$PWD/docs/qa/hiyori-public-issue341/existing-gate" node remake/test/browser/hiyori_gate.mjs
ARTIFACT_DIR="$PWD/docs/qa/hiyori-public-issue341/existing-encounters" node remake/test/hiyori_encounters.mjs
ARTIFACT_DIR="$PWD/docs/qa/hiyori-public-issue341/existing-intro" node remake/test/hiyori_intro.mjs
ARTIFACT_DIR="$PWD/docs/qa/hiyori-public-issue341/existing-save" node remake/test/browser/save_load.mjs
ARTIFACT_DIR="$PWD/docs/qa/hiyori-public-issue341/reunion" node docs/qa/hiyori-public-issue341/reunion.mjs
node docs/qa/hiyori-public-issue341/walkthrough.mjs
```

`TEST_REF`は自己検出ではないため、再実行時には対象の公開ファイルと配信runを照合して更新する。`walkthrough.mjs` は新規ゲームを選び、seed/weatherSeed/reel.seedのみ固定。日付・好感度・既読フラグは注入せず、実際のマップ・会話・LIMEを操作する。章の範囲外の大会プレイを増やさない。`reunion.mjs` は再会前の専用fixtureを使い、中断リロード・実SKIP・既読再生・schema5の高い旧好感度を検証する。既存回帰の内部fixtureと、新規プレイの結果を区別する。

## 現時点の結果

| 公開版の検証 | 実行数 | 結果ファイル |
|---|---:|---|
| ♥3停止・最大15点救済・倍率/占い/端数・旧47/66点・LIME予約/料金 | 4 | [gate](existing-gate/hiyori-gate.json) |
| 対象店・有料行動・実対面報告・伝言・再送・保存・6表情 | 8 | [encounters](existing-encounters/hiyori-encounters.json) |
| 名乗り後の一度限りの紹介・PC/タッチ・動きを減らす | 3 | [intro](existing-intro/hiyori-intro.json) |
| オート/手動3枠・schema5・破損・PC/タッチ/回転 | 6 | [save/load](existing-save/save-load.json) |
| 読了前中断で33点保持・実SKIP読了後に一度だけ15点救済・schema5から未読推測なし | 2 | [reunion](reunion/reunion-readiness.json) |

現行は `_hiyori_tonari_return_done` 読了まで♥3で停止する。followup/afterworkや正体発覚フラグを解除条件に代用しない。再会の救済は待機分から最大15点を一度だけ反映し、既存の再会報酬はその後に従来どおり加算する。再会前の33点・待機40点fixtureは読了後56点（救済15＋既存報酬8）となり、再読/ロードでは増えなかった。

tonari再会・学生時代回想・仕事の入口を読んでも `_hiyori_real_self_known` と `_hiyori_work_talk_done` は立たない。正式 `hiyori_axe_reveal` と `hiyori_work_talk` は未制作で `missing_script`。これは#342/#343/#344の残作業で、序盤のQA成功から完成扱いしない。

初回の実行失敗はクラウドNSSの読取り専用によるTLS初期化、および検証ランナーの初回LIME案内操作とload APIの戻り型の取り違え。原因を修正して該当チェックを再実行した。ゲームコードや検証条件を緩めてPASSにしていない。

PR #379のLIME/calendar/map、PR #406のタイトル/manifest、他セットの関係API、背景刷新#360を変更しない。実機Safari・全旧スキーマの全組合せ・未制作後半の動作を検証済みとはしない。

## 新規プレイで再現した導線不足（#411）

[PC/タッチの結果と最終保存状態](walkthrough-before-sumi-contact/results.json)。チュートリアルを断り、客席でスミさんへの報告を読む通常ルート。2件とも出会い→報告→伝言→仕事疲れ→交流2回まで進み、♥3（33点）・待機9点・再会readyとなったが、スミさんの連絡先がなく、DAY14までLIMEは届かなかった。温キャッシュの実利用はPC162件、タッチ160件、冷起動は両方0件。

オーナーは「すみさんとは上司だし元々LIMEは交換してるはずです」と訂正した。正しい仕様は開始時から交換済みであり、バイト後の会話を回避策として要求しない。新規/旧セーブでの初期連絡先の不足は#411の独立ブランチ/PRで修正し、公開後にこの通常ルートを再実行する。既存23ケースはスミさんの連絡先を明示したfixtureを含むため、この新規プレイの欠落を検出しなかった。

#341のQA資料を本ブランチへ保全して正式返却し、修正は#411の予約成功後に行う。#411の公開確認まで本PRをDraftで維持し、#342/#343へ進まない。今回の資料は修正前の履歴であり、後続の修正結果は#411/PRと#341コメントに紐付ける。
