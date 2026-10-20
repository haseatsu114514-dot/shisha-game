# Issue #774 / PR #778 — 再開時の検証と未完事項

担当: `codex-b-lime-20261021-774`。2026-10-21 JST。

## 保存済み修正と予約

既存ブランチ `codex/b-774-lime-fit-4c70` の保存HEAD
`4b863d9d9618d8b93c3c9fbdad62f0a40fb9bb30` を継続する。
今回、製品コードは変更していない。採用済み1280×720の交換演出を
stage全体へfitする既存修正を保持する。

再開直前の公開APIでPRの現HEAD一致、pickup run `39500193768` の
completed/success、最新bot comment `6301843686` のowner/run一致を確認。
handoff `39486565024` / comment `6299967812` の stopped/pushed=true を確認済み。
予約の再取得・解放・他workerのowner流用なし。

## 確認した経路と限界

なる／アダムの初回交換会話は `data/dialogue/ch1_naru.json` と
`ch1_adam.json` の `early_lime_exchange` から `_lime_contact_*` を設定する。
`vn/engine.js` は既存contacts/フラグで未交換なら
`core/scene-motions.js` → `motions/lime.js` を呼ぶ。
SKIP・動き軽減・既存contacts・既読演出は既存仕様による抑止。

DS横844×390で上64pxを除くstage高326pxに対し、修正前の見出しtopは
510px。この固定座標の欠陥は既存修正の根拠であり、報告者が実際に
この経路を通った証拠ではない。相手・場面・画面方向・設定・セーブ状態を
質問したが、本記録作成時点では回答未受領。原因を特定済みとは扱わない。

## 検証

- 保存HEADの既存 `lime_fit_774.mjs` 成功結果と独立レビュー記録を再利用。
  製品motion/test blobを変更していないため同じfit検証は再実行していない。
- 新規 `node --experimental-vm-modules remake/test/lime_save_774.mjs`: PASS。
  本番state/save/load/saveToSlot/loadFromSlot/migrateと本番engineのset_flag分岐を使用。
  なる・アダムについて交換前SAVE/LOAD後の初回1回、交換後の手動枠SAVE/LOADと
  全state復元（savedAt除外）、再演出0回を確認。schema17のcontactsあり旧セーブ、
  SKIPを模した演出省略後のSAVE/LOADで再演出0回も確認。
  localStorageはMap、演出は代替。visitChar終了後のcontacts登録はfixtureで行う。
  ブラウザUI・実visitChar・描画の検証ではない。
- 新規test構文検査とdiff whitespace: PASS。
- 既存ChromeをPlaywrightからsandbox有効で起動: SIGABRTで失敗、UNCLASSIFIED。
  ブラウザ起動前のためスクリーンショット・実画面・実SAVE/LOAD操作は未確認。
  sandbox無効化・権限拡大・再試行・ブラウザ導入なし。

## checkout・並行作業

初期未展開のindexを `git read-tree -mu HEAD` で展開し、必要な
AGENTS/protocol、Git Safety、hooksをsparse対象に保持した。
独立root・origin・canonicalRoot一致、clean status、Git Safety PASS、
core.hooksPath=.githooksを確認。merge-baseは
`625f197ca6f06d47073f3a1734cdd49edd99220c`。
確認したorigin/mainは `ea0229dbd6635299b78faba04c4956f28a9e0577`、14 commits先。
最新main取込は未実施。Git Safetyのbehind WARNを残し、ERRORなしを確認した。

PR738/794/793/761の取得済み変更一覧、Issue790/804/760の範囲に対し、
既存lime.js/fit test・今回の保存test/QA記録の重複なし。
spots.js等の並行作業ファイルは変更していない。
PR794・#775・他担当フォルダ・明示保留Issueの変更なし。

## 通信上限超過・停止

本担当累計のAPI応答本文は1,329,196 bytes、保存された受信Git packは
17,064,490 bytes、合計18,393,686 bytes。前回報告4,019,404 bytesからの
増分は14,374,282 bytes。今回残枠約8MBを超過したため追加取得を停止。
これは保存本文/packサイズの実測で、HTTP/TLS等を含む回線総量は未計測。
他担当約7.5MBは司令塔の申告値であり、本担当の実測ではない。

想定外pack `9b70a26820cd24ecd81a3c229c6ae74aa9c4db5c` は13,225,567 bytes。
ローカルverify-pack/ls-treeによりmainの動画参考シートPNG等を含む20 blobsと確認。
`--track`切替失敗時にindexだけ旧PRへ変わった後、mainに対するstatusの
rename検出がlazy fetchを誘発した可能性があるが、原因は推測。
対象外画像を意図せず取得した事実と、事前見積もり・取得監視の不足を記録する。
以後、追加取得とGitHub書込みは行わない。

## 次の作業

ローカルcommitは保存・引継ぎ用。完成・Ready・CI成功ではない。
司令塔へのpush/Issue/PR記録依頼は作業フォルダ直下 `GITHUB_REQUEST.md` に記載する。
報告者経路の特定、実画面と実SAVE/LOAD、最新main統合と競合再確認、
提出HEADの必須CI、公開確認が残る。追加取得は通信枠の再指示後のみ。
mainへのmergeは禁止。未完Draftと予約を維持する。
