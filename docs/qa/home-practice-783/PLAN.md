# Issue #783 実装・調査計画書 (PLAN.md)

## 1. 概要
- **Issue**: #783 店支給フレーバーと私物在庫の分離・自宅練習を寝る前に限定
- **Worktree**: `（worktree）`
- **Branch**: `agy/783-20261021` (base `origin/main ea0229db`)
- **予約台帳**: owner `agy-g38fh-20261021-783-7a1c` / claim run `39513678984`
- **目的**:
  1. 自宅の「家で練習する」を寝る前（夜・slot 1以上）限定にする。直接呼出しガードを `home-practice.js` に実装し、マップのボタン表示条件パッチ案を作成。
  2. スミの「店のフレーバーで練習」場面における私物在庫の使用／消費の不整合を調査・特定し、店在庫と私物の分離案を策定。
  3. 自宅練習での私物在庫の適正消費（完成時のみ1回、二重消費なし、SAVE/LOAD安全性）を確認。

> [!IMPORTANT]
> **マージ順序の制約（Draft 運用必須）**:
> `home-practice.js` の寝る前ガードは、`map.js` のボタン表示ガードパッチ（PR #796 マージ後）と同時に導入する必要があります。
> 先行してガードのみを入れると、昼にボタンが表示されたまま押しても反応しない UI 不整合が生じるため、**PR #796 マージ後に `map.js` パッチを適用するまで、本 PR は Draft（マージ不可）** として管理します。

---

## 2. 「店のフレーバーで練習」場面のコード経路調査

### 調査結果サマリ
- **消費に関して**:
  スミの店練習（`early`, `midcheck`, `rehearsal`）では、コード上 `consumes = cs.mode === "tournament"`（`steps.js:207`）が `false` であり、また `cs.venue === "home"` でもないため、**内部データ上は私物在庫（`flavorStock`）は一切消費（減少）していません**。
- **使用・表示（選択肢）に関して**:
  一方で、`steps.js:211` のフレーバー選択肢リストが `let ids = ownedFlavorIds();` と私物在庫（`flavorStock(id) > 0`）に依存しているため、**「店のフレーバーで練習する」と会話で言われているにもかかわらず、プレイヤーが所持している私物しか配合画面に並ばない** という使用・表示上の不整合が存在します。
- **自宅練習の二重消費経路に関して**:
  `home-practice.js` の `cs`（クラフトセッション）は `runHomePractice` 内のローカル変数であり、`consumeHomePracticeLeaves(cs.ownLeavesUsed)` は完成時に一度だけ同期的に呼び出されるため、外部からの多重呼び出しや二重消費の実経路は存在しません。

### 詳細経路特定（ファイル:行）

1. **チュートリアル・最初の一杯（DAY 1）**
   - **台詞**: `data/dialogue/remake_ch1.json:2617` (`remake_first_brew_order`)
     > スミ「店のレモン、オレンジ、ミントを使え。単体でも混ぜてもいい。まずはあの人の好みに応えてみろ」
   - **コード経路**:
     - `remake/js/chapters/first-brew.js:13-19` (`configureFirstBrew`): `cs.orderFlavorIds = ["lemon", "orange", "mint"]`
     - `remake/js/craft/steps.js:214`: `if (cs.orderFlavorIds) ids = cs.orderFlavorIds.filter(...)`
   - **判定**: 店支給の3種が選択肢として強制され、`consumes: false` / `limit: Infinity`。私物在庫は使用・消費されず整合。

2. **基礎練習（DAY 3 `earlyPractice`）**
   - **台詞**: `data/dialogue/remake_ch1.json:2293-2301` (`remake_preparation_first`), `2444-2453` (`remake_preparation_review`)
     > スミ「大会じゃ、最初から最後まで自分で作る。今日は一台、俺と通してやるぞ」
   - **コード経路**:
     - `remake/js/chapters/ch1.js:339`: `runFullPractice({ coached: true, adjustments: false, kind: "early" })`
     - `remake/js/craft/practice.js:18`: `coached: true` により `cs.mode = "tutorial"`
     - `remake/js/craft/steps.js:213`: `if (cs.mode === "tutorial") ids = ["double_apple", "mint"]`
   - **判定**: スミの基本形（アルファーヘブンのダブルアップル・ミント）が支給され、`consumes: false` / `limit: Infinity`。私物在庫は消費されない。

3. **中間準備（DAY 7 `midPreparation`）**
   - **台詞・案内**:
     - `data/dialogue/remake_ch1.json:2324-2333` (`remake_midcheck_intro`):
       > スミ「今日は俺が用意した一台を使う。炭交換と、吸われた後の調整を2回やるぞ」
     - `remake/js/daily/preparation.js:30`:
       > 「仕入れた材料を作業台で試そう。練習の葉は店で用意するので、本番用の在庫は減りません。」
   - **コード経路**:
     - `remake/js/chapters/ch1.js:370`: `runFullPractice({ kind: "midcheck" })`
     - `remake/js/craft/practice.js:18`: `cs.mode = "rehearsal"`
     - `remake/js/craft/steps.js:207-217`:
       - `consumes`: `false`（大会モード以外は消費しない）
       - `ownLeaves`: `false`（`cs.venue !== "home"`）
       - `limit(id)`: `Infinity`
       - `ids`: `let ids = ownedFlavorIds();` ★不整合箇所
   - **判定**:
     - **消費**: 減らない（正常）。
     - **使用・表示**: 私物在庫のみが選択可能となっており、「店の葉で練習する」という台詞と乖離している。所持していないフレーバーは調合できない。

4. **前日リハーサル（DAY 13 `rehearsal`）**
   - **台詞**: `data/dialogue/remake_ch1.json:967-986` (`remake_rehearsal_intro`)
     > スミ「明日が本番だ。今夜は通しでやるぞ。店の作業台を本番だと思え」
   - **コード経路**:
     - `remake/js/chapters/ch1.js:394`: `runFullPractice({ kind: "rehearsal" })`
     - `remake/js/craft/steps.js:211`: `ids = ownedFlavorIds();`
   - **判定**: 中間準備と同様。消費はされないが、選択肢が私物在庫に制限される不整合。

5. **大会当日・スミの救済支給（DAY 14）**
   - **台詞**: `data/dialogue/remake_ch1.json:1145-1163` (`remake_flavor_rescue`)
     > スミ「ダブルアップル、１回分だ。足りる範囲でやりくりしろ」
   - **コード経路**:
     - `remake/js/chapters/ch1.js:447`:
       `if (!stocked && flavorStock("double_apple") < 12) addFlavorStock("double_apple", 12 - flavorStock("double_apple"));`
     - `remake/js/craft/steps.js:207, 325`: 本番は `cs.mode === "tournament"` で `consumes = true` となり、私物在庫から消費。
   - **判定**: 本番用フレーバーを未所持の場合の救済として、私物在庫に直接12gまで補充して本番で消費する仕様。

6. **自宅練習（`home-practice.js`）**
   - **コード経路**:
     - `remake/js/daily/home-practice.js:65-68`: `runFullPractice({ venue: "home" })`
     - `remake/js/craft/steps.js:209`: `ownLeaves = true`（手持ち残量までしか詰められない）
     - `remake/js/daily/home-practice.js:67`: 一台を作り終えた後、`consumeHomePracticeLeaves(cs.ownLeavesUsed)` で一度だけ私物を消費。
   - **判定**: 二重消費は発生しない。

---

## 3. 要ユーザー確認事項

### 1) 「寝る前」の定義について
「寝る前」の定義は現行仕様から確定していないため、推測で確定せず以下の選択肢を提示します。

- **選択肢A（現実装・最小案）**: 夜の行動枠（`state.slot === 1`）でのみ選べる1行動。
  - **影響**: 日常パートの昼（slot 0）では選べず、夜の1行動枠を消費して行う。既存の行動枠管理・体力バランス・日程進行に最小の変更で収まる。
- **選択肢B**: 「寝る前の一服」（`home-shisha.js`）と同じく、昼と夜の全行動後（`state.slot === 2` 相当）に行動枠を使わずに選ぶ。
  - **影響**: `calendar.js`（PR #797 後）の `endDay()` 前後への改修が必要。一日に昼・夜の2行動に加えてさらに練習が可能になるため、体力消費や成長バランス、大会までの総練習回数に大きな影響を与える。

### 2) 店練習（`midcheck` / `rehearsal`）時のフレーバー選択仕様について
- **現状**:
  私物在庫（`ownedFlavorIds()`）のみが配合画面に表示される。消費はされない。
- **最小改善案（推奨）**:
  店練習（`!ownLeaves && cs.mode !== "tournament"`）時は、店の全フレーバー（`SHOP_FLAVORS`）を店支給として選択可能にする（`steps.js` パッチ案参照）。
- **影響とショップ・スコアへの確認**:
  事前のショップ購入がなくても、店での練習で自由に各種フレーバーの配合や調整を試行できるようになり、台詞（「店の葉を用意する」「俺が用意した一台」）と整合します。
  なお、ショップの価格・在庫定義（`SHOP_FLAVORS` 定義や販売在庫）には一切触れず、配合評価（`evaluateMix`）の採点ロジックも同一であるため、ショップ仕様やスコア計算への副作用はありません。本セッションでは `steps.js` が PR #793 待機中のため、要ユーザー確認のままパッチ案として提示します。

### 3) スミさんの救済支給（DAY 14 447行）の扱いについて
- **現状**:
  大会当日にダブルアップルの在庫が12g未満の場合、私物在庫（`flavorStock`）に直接差分を補充する（スミの「一回分」支給）。
- **方針確認**:
  この救済支給は大会本番で即消費されるため、既存の挙動（私物在庫への一時補充）をそのまま維持します。

---

## 4. 編集禁止ファイルへのパッチ案

### 1) `remake/js/daily/map.js`（PR #796 待機中）
「家で練習する」ボタンの表示を寝る前（夜・`state.slot >= 1`）限定にする1行パッチ。

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
店練習（`!ownLeaves`）時に、私物在庫ではなく店支給フレーバー（`SHOP_FLAVORS`）を選択できるようにするパッチ。

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
`runHomePractice` 側のガードがあるため必須ではないが、防御的確認としてのパッチ案。

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
