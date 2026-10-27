# REPORT.md

## 1. DONE
- **指摘1の反映（`home-practice.js` の最小差分化）**:
  - `consumeHomePracticeLeaves` の `Number(g)` 化、`runHomePractice` の `= {}` および staminaGuard 省略可、`cs.ownLeavesUsed = null` を元に戻し、依頼範囲（寝る前ガード）のみの最小差分に整理。
  - `cs` は `runHomePractice` 内のローカル変数であり、外部からの多重呼び出しによる二重消費経路が存在しないことを確認。
- **指摘2の反映（`home_practice_783.mjs` の範囲外アサート削除・整理）**:
  - メーカーブランド表記、台の名称、ソースコード文字列の `fs.readFileSync` 検査をすべて削除。
  - 寝る前限定ガード（slot 0 は不可、slot 1/2 は可、直接呼出し時の安全性）、完成時一度だけの消費、中断時に消費しないこと、SAVE/LOAD互換性の検証に絞り込み。
- **指摘3の反映（既存テスト4ファイルの夜フィクスチャ追従と昼ガード確認追加）**:
  - `remake/test/paid_action_growth.mjs`: line 88 で `core.state.slot = 1;` を設定。
  - `remake/test/browser/home_practice_leaves.mjs`: lines 15, 59, 96, 119 の `slot: 0` を `slot: 1` に変更し、昼に練習を開始できない確認テストを1点追加。
  - `remake/test/browser/ds_packing.mjs`: line 107 の `slot: 0` を `slot: 1` に変更。
  - `remake/test/browser/game_layout.mjs`: line 104 の `slot: 0` を `slot: 1` に、line 119 の `before.slot` を `1` に変更し、練習完了後の遷移（Day 6 slot 1 → Day 7 slot 0）およびセーブ・ロード検証を追従。
  - 編集禁止ファイル `remake/test/browser/play_feedback.mjs` のパッチ案（line 74-76）を `PLAN.md` に記載。
- **指摘4の反映（Draft 運用の明記）**:
  - `home-practice.js` のガードは `map.js` のパッチ（PR #796 マージ後）と同時に適用する必要があり、それまで本 PR は Draft・マージ不可である旨を `PLAN.md` に明記。
- **指摘5の反映（「寝る前」の定義についての選択肢整理）**:
  - 選択肢A（夜の行動枠 slot 1 での1行動・現実装最小案）と選択肢B（寝る前の一服と同様の一日の全行動後・枠なし）の影響を `PLAN.md` の要確認に明記。
- **指摘6の反映（店練習フレーバー案のショップ仕様・得点影響確認）**:
  - `steps.js` パッチ案（`SHOP_FLAVORS` 選択肢化）がショップの価格・在庫定義や配合評価ロジックに影響を与えないことを確認し、要確認事項として記載。

---

## 2. 変更ファイルと関数

### 1) `remake/js/daily/home-practice.js`
- `isHomePracticeTime(s = state)`: 自宅練習が可能な時間帯（夜・`slot >= 1`）か判定する関数を新規追加・エクスポート。
- `chooseHomePractice()`: `!isHomePracticeTime()` 時に即座に `Promise.resolve(null)` を返すガードを追加。
- `runHomePractice({ staminaGuard })`: 冒頭に `if (!isHomePracticeTime()) return { used: false, exerted: false };` を追加。

### 2) `remake/test/home_practice_783.mjs`（新規作成）
- 自宅練習の寝る前限定ガードの検証（slot 0 は不可、slot 1/2 は可、直接呼出しの安全性）。
- 私物在庫の12g判定、安全な減算、0gクランプ、不正値耐性、中断時に消費しないことの確認。
- SAVE/LOAD互換性（slot, flavorStock, 台の所持）の検証。

### 3) 既存テストファイル（夜フィクスチャ追従）
- `remake/test/paid_action_growth.mjs`: 自宅練習前の状態に `core.state.slot = 1;` を設定。
- `remake/test/browser/home_practice_leaves.mjs`: `slot: 1` への変更および昼ガードテスト（`daytime-slot0-cannot-start-practice`）の追加。
- `remake/test/browser/ds_packing.mjs`: 初期フィクスチャの `slot: 1` への変更。
- `remake/test/browser/game_layout.mjs`: 初期フィクスチャ `slot: 1`、フラグ `_home_shisha_day: "1:6"`、および練習後の Day 7 slot 0 遷移アサートへの整合。

### 4) 文書ファイル
- `PLAN.md`: 調査結果、要確認事項、Draft運用制約、編集禁止ファイルへのパッチ案（`map.js`, `steps.js`, `calendar.js`, `play_feedback.mjs`）。
- `TEST_REQUEST.md`: 局所テスト実行依頼。
- `GITHUB_REQUEST.md`: コミットメッセージ・PR作成依頼。

---

## 3. TODO
- 他workerの依存PR（PR #793 `steps.js`, PR #796 `map.js`, PR #797 `calendar.js`）のマージ完了を待つ。
- PR #796 マージ後、`map.js`（ボタン表示条件）のパッチ案を適用し、本 PR を Ready for Review に移行する。
- コーディネーターによるテスト実行（`node remake/test/home_practice_783.mjs` など）の確認。

---

## 4. TEST_REQUEST
コーディネーター様へ、以下のコマンドの実行をお願いいたします。

```bash
# 1. 新規テスト: Issue #783 自宅練習の寝る前限定ガード・私物在庫消費・SAVE/LOAD互換テスト
node remake/test/home_practice_783.mjs

# 2. 関連回帰テスト: Issue #638 家シーシャ・自宅練習関連の既存テスト
node remake/test/home_shisha.mjs

# 3. 追従テスト: 自宅練習を含む成長テスト（slot 1 追従）
node remake/test/paid_action_growth.mjs
```

---

## 5. 要確認

1. **「寝る前」の定義について**:
   - **選択肢A（現実装・最小案）**: 夜の行動枠（`state.slot === 1`）でのみ選べる1行動。
     - 影響: 日常パートの昼（slot 0）では選べず、夜の1行動枠を消費して行う。既存の行動枠管理・体力バランス・日程進行に最小の変更で収まる。
   - **選択肢B**: 「寝る前の一服」（`home-shisha.js`）と同じく、昼と夜の全行動後（`state.slot === 2` 相当）に行動枠を使わずに選ぶ。
     - 影響: `calendar.js`（PR #797 後）の改修が必要。一日に昼・夜の2行動に加えてさらに練習が可能になるため、体力消費や成長バランス、大会までの総練習回数に大きな影響を与える。
2. **店練習（`midcheck` / `rehearsal`）におけるフレーバー選択肢の仕様**:
   - **現状**: 内部データ上、店練習で私物在庫が減衰（消費）するバグはありません。ただし `steps.js:211` の選択肢リストが `ownedFlavorIds()`（私物在庫）に限定されているため、プレイヤーが所持しているフレーバーしか練習に持ち込めない表示上の不整合があります。
   - **最小改善案（推奨）**: 店練習（`!ownLeaves && cs.mode !== "tournament"`）時は、私物在庫の有無にかかわらず店の全フレーバー（`SHOP_FLAVORS`）を店支給として選択可能にする（`steps.js` パッチ案）。
   - **ショップ・スコアへの影響**: ショップの価格・在庫定義や配合評価（`evaluateMix`）の採点ロジックには一切影響しません。
3. **スミさんの救済支給（DAY 14 447行）**:
   - 大会当日に手持ち在庫が12g未満の場合、私物在庫（`flavorStock.double_apple`）に直接差分を補充する既存仕様をそのまま維持しています。

---

## 6. 編集禁止ファイルへのパッチ案

### 1) `remake/js/daily/map.js`（PR #796 待機中）
「家で練習する」ボタンを夜（`state.slot >= 1`）のみ表示する1行修正。

```diff
--- a/remake/js/daily/map.js
+++ b/remake/js/daily/map.js
@@ -194,3 +194,3 @@
         // 家ではシーシャ作りの練習もできる（#638・tonari から移した）。休むのは「家に帰る」のまま
-        av.ok && s.kind === "rest" && homeRig()
+        av.ok && s.kind === "rest" && homeRig() && state.slot >= 1
           ? el("button.mi-go.mi-go-alt", { dataset: { test: "map-home-practice" }, onclick: () => go(s, "practice") }, [el("span", { text: "家で練習する" })])
```

### 2) `remake/js/craft/steps.js`（PR #793 待機中）
店練習（`!ownLeaves`）時に、私物在庫ではなく店支給フレーバー（`SHOP_FLAVORS`）を選択可能にする修正。

```diff
--- a/remake/js/craft/steps.js
+++ b/remake/js/craft/steps.js
@@ -210,3 +210,3 @@
   const supplied = (id) => !!reg && id === reg.flavor;
-  let ids = ownedFlavorIds(); // 店の品＋限定サンプル＋もらった葉（贈られたハガルに添えられたカルダモン等）
+  let ids = ownLeaves ? ownedFlavorIds() : [...new Set([...SHOP_FLAVORS, ...ownedFlavorIds()])];
   if (reg && !ids.includes(reg.flavor)) ids.unshift(reg.flavor);
```

### 3) `remake/js/daily/calendar.js`（PR #797 待機中）
防御的ガードとしてのオプションパッチ。

```diff
--- a/remake/js/daily/calendar.js
+++ b/remake/js/daily/calendar.js
@@ -405,3 +405,3 @@
   const facility = ["kannon", "choizap"].includes(spot.id);
+  if (homePractice && state.slot < 1) return;
   const { value: { used, exerted, slotsUsed = 1 }, spent } = await paidAction(() => (homePractice && spot.kind === "rest"
```

### 4) `remake/test/browser/play_feedback.mjs`（PR #793 共有・編集禁止）
夜（`slot: 1`）の状態でマップを開いて「家で練習する」ボタンの表示を確認するパッチ。

```diff
--- a/remake/test/browser/play_feedback.mjs
+++ b/remake/test/browser/play_feedback.mjs
@@ -74,3 +74,3 @@
-      await page.evaluate(() => { F.map.interruptMap(null); F.core.state.owned.push(F.rig.SUMI_RIG); F.openMap(); });
+      await page.evaluate(() => { F.map.interruptMap(null); F.core.state.slot = 1; F.core.state.owned.push(F.rig.SUMI_RIG); F.openMap(); });
       await page.locator('.map:not(.done)').waitFor(); await press(page, '[data-spot="rest"]');
```
