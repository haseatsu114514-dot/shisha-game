# #341 ひより・公開版の序盤QA

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
