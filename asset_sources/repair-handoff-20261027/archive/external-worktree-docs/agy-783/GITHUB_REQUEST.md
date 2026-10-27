# GITHUB_REQUEST.md

コーディネーター様へ:
本作業の commit / push / PR 作成をお願いいたします。

## 作業情報
- **対象Issue**: #783 店支給フレーバーと私物在庫の分離・自宅練習を寝る前に限定
- **作業Worktree**: `[local path omitted]`
- **作業ブランチ**: `agy/783-20261021`
- **ベースブランチ**: `origin/main` (`ea0229db`)
- **予約情報**: owner `agy-g38fh-20261021-783-7a1c` / claim run `39513678984`
- **PR 状態**: **Draft**（`map.js` パッチと同時マージ必須のため、PR #796 マージまでマージ不可）

## 変更ファイル一覧
- `remake/js/daily/home-practice.js` (自宅練習の寝る前限定ガード `isHomePracticeTime` 追加)
- `remake/test/home_practice_783.mjs` (Issue #783 局所テストの新規作成・コア挙動に整理)
- `remake/test/paid_action_growth.mjs` (自宅練習の夜フィクスチャ追従)
- `remake/test/browser/home_practice_leaves.mjs` (夜フィクスチャ追従および昼ガードテスト追加)
- `remake/test/browser/ds_packing.mjs` (夜フィクスチャ追従)
- `remake/test/browser/game_layout.mjs` (夜フィクスチャ追従および Day 7 slot 0 遷移整合)
- `PLAN.md` (コード経路調査結果、要確認事項、Draft運用制約、編集禁止ファイルへのパッチ案)
- `TEST_REQUEST.md` (コーディネーター向けテスト実行依頼)
- `REPORT.md` (作業完了報告書)

## コミットメッセージ案
```
feat(daily): 自宅練習を寝る前に限定し夜フィクスチャ追従 (#783)

- home-practice.js に寝る前（夜・slot 1以上）限定ガード isHomePracticeTime を追加
- chooseHomePractice, runHomePractice の直接呼出し時に昼（slot 0）なら即座に終了するようガード
- 新規局所テスト home_practice_783.mjs を追加（寝る前ガード・完成時消費・中断非消費・SAVE/LOAD互換）
- 既存テスト4ファイル（paid_action_growth, home_practice_leaves, ds_packing, game_layout）を夜フィクスチャに追従
- 店支給フレーバーと私物在庫の調査結果および map.js/steps.js/calendar.js/play_feedback.mjs へのパッチ案を PLAN.md に記載
```

## PR タイトル・本文案
- **Title**: `[Draft] 店支給フレーバーと私物在庫の分離調査・自宅練習を寝る前に限定 (#783)`
- **Body**:
  ```markdown
  ## 概要
  Issue #783 に対応し、自宅でのシーシャ練習を寝る前（夜・slot 1以上）限定に制限しました。
  また「店のフレーバーで練習」場面における私物在庫の使用／消費のコード経路を調査し、パッチ案をまとめました。

  ※本 PR は `map.js` のボタン表示ガードパッチ（PR #796 マージ後）と同時に導入する必要があるため、PR #796 マージまで **Draft（マージ不可）** として管理します。

  ## 変更点
  - `remake/js/daily/home-practice.js`:
    - `isHomePracticeTime`: `state.slot >= 1` の判定関数を追加
    - `chooseHomePractice`, `runHomePractice`: 昼（slot 0）での直接呼出しをガード（最小差分）
  - `remake/test/home_practice_783.mjs`:
    - 寝る前限定ガード、完成時一度だけの消費、中断時に消費しないこと、SAVE/LOAD互換性の新規局所テストを追加
  - 既存テストの夜フィクスチャ追従:
    - `remake/test/paid_action_growth.mjs`
    - `remake/test/browser/home_practice_leaves.mjs`（昼ガード確認テストも追加）
    - `remake/test/browser/ds_packing.mjs`
    - `remake/test/browser/game_layout.mjs`
  - `PLAN.md`:
    - 店練習（early, midcheck, rehearsal）におけるコード経路（ファイル:行）の特定と不整合分析
    - 「寝る前」の定義についての選択肢整理（要確認）
    - 編集禁止ファイル（`map.js`, `steps.js`, `calendar.js`, `play_feedback.mjs`）へのパッチ案
  ```
