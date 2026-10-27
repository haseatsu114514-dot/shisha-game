# TEST_REQUEST.md

コーディネーター様へ:
以下の局所テストコマンドの実行をお願いいたします。

## 実行要求コマンド

```bash
# 1. 新規テスト: Issue #783 自宅練習の寝る前限定ガード・私物在庫消費・SAVE/LOAD互換テスト
node remake/test/home_practice_783.mjs

# 2. 関連回帰テスト: Issue #638 家シーシャ・自宅練習関連の既存テスト
node remake/test/home_shisha.mjs

# 3. 追従テスト: 自宅練習を含む成長テスト（slot 1 追従）
node remake/test/paid_action_growth.mjs
```

### ブラウザテスト（ブラウザ環境が利用可能な場合）
```bash
# 自宅練習の葉消費テスト（slot 1 追従 ＋ 昼の直接呼出しガード検証）
node remake/test/browser/home_practice_leaves.mjs

# DSパッキング表示テスト（slot 1 追従）
node remake/test/browser/ds_packing.mjs

# ゲームレイアウト・セーブロードテスト（slot 1 追従）
node remake/test/browser/game_layout.mjs
```

## テスト内容の概要
1. `remake/test/home_practice_783.mjs`:
   - `isHomePracticeTime`: `state.slot === 0` (昼) で `false`、`state.slot >= 1` (夜/終了) で `true` を判定。
   - `chooseHomePractice()` / `runHomePractice()`: `state.slot < 1` の直接呼出し時に即座に `null` / `{ used: false, exerted: false }` でガードされ、スタミナ消費や `_home_tonight` の設定が行われないことを確認。
   - `homeLeavesEnough()`: 12g境界値の確認。
   - `consumeHomePracticeLeaves()`: 正の量のみ安全に減算、0g未満クランプ、不正値耐性、中断時には消費されないことを確認。
   - SAVE/LOAD互換性（slot, flavorStock, 台の所持）の確認。
   - （レビュー指摘に基づき、範囲外のブランド表記・台名称・コード文字列検査を削除し、コア挙動に限定）。
2. `remake/test/home_shisha.mjs`:
   - 既存の家シーシャ（寝る前の一服）および自宅練習の機能が回帰なく正常に動作することを確認。
3. `remake/test/paid_action_growth.mjs`:
   - 自宅練習の呼び出し前の状態を夜（`slot: 1`）に設定し、体力消費および成長なしの既存アサートが正しく通ることを確認。
