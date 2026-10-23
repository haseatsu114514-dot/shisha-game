# Issue #783 家で練習の廃止・店の練習で店の葉を使う（PLAN）

## 残差の実装

家練習のボタン・calendarの分岐・import・本体をまとめて撤去し、店の配合に店頭葉を追加。私物減算は大会だけに維持する。`visitedDay.home_practice` は無視し、休養にも使う `_home_tonight` と在庫・自己ベストは保持する。

`home_practice_leaves.mjs` は既存CIの入口名を保ち、店の制作本体で在庫ゼロからの選択・完成・中断/再開・SAVE/LOAD、大会の持ち込み上限/支給葉、昼夜と台の有無によらない家練習入口の消失を検証する。表示回帰の `ds_packing` / `game_layout` も店の制作本体を直接呼ぶ。後者は日常の消費行動を伴わないfixtureで、制作記録・保存と画面構成を確認する。

以下はPR #813保存時の経緯・差分案。古いDraft待ちや家練習テストの仕様を現在の未完条件として再採用しない。


- Issue: #783 / Draft PR: #813（branch `agy/783-20261021`、base `origin/main ea0229db`）
- 台帳 owner: `agy-g38fh-20261021-783-7a1c`
- 仕様変更コメント: https://github.com/haseatsu114514-dot/shisha-game/issues/783#issuecomment-6306840779

## 1. 仕様（オーナー最終決定 2026-10-21 11:48 JST）

1. 家での練習（「家で練習する」／自宅の「練習する」）は完全に廃止。練習は店でだけ行う。「寝る前の一服」（`home-shisha.js`）は別機能で変更しない。
2. 店の練習では、自分の在庫だけでなく店のフレーバーを選べる。店の練習は私物の在庫を一切減らさない。価格・在庫定義・採点・店の仕様は変えない。
3. 完了／中断／再開／SAVE／LOAD で在庫の不整合を起こさない。家練習の状態を含む旧セーブも、クラッシュや在庫消失なしで読み込める。

以前の「家で練習を夜だけに限定する」ガード案（f37c6142）は取り下げ、この PR で元に戻した。

## 2. この PR に今入っている変更（他の PR とファイルが重ならないもの）

| ファイル | 内容 |
|---|---|
| `remake/js/daily/home-practice.js` ほかテスト4本 | 夜だけガード（f37c6142）を main の状態へ戻した。`remake/test/home_practice_783.mjs` は削除 |
| `remake/js/chapters/ch1.js:334` | DAY3 の工程選択の案内から「通し練習はマップの家から「家で練習する」を選べます。」を削除 |
| `remake/test/practice_shop_only_783.mjs`（新規） | 家練習の痕跡（`visitedDay.home_practice`・`flags._home_tonight`・工程の自己ベスト）がある旧セーブを、オートセーブ／手動枠の両方から LOAD しても私物在庫と自己ベストが残ること。配合で私物を減らすのは大会だけであること（ソース検査）。第1章の案内に「家で練習する」が無いこと |
| `.github/workflows/remake-smoke.yml` | 上の新テストを実行 |
| `docs/master_spec.md`・`remake/README.md` | 仕様変更を記録 |

旧セーブの扱いは「無視」。家練習の一台は関数内のローカル状態で、セーブには途中経過が残らない（減算は作り終えた後の1回だけ・保存は行動の終わり）。残るのは `visitedDay.home_practice`（撤去後は誰も読まない）と `flags._home_tonight`（休む・寝る前の一服と同じ「家で一日を終える」印で、そのまま有効）だけなので、移行コードは不要。

## 3. 入口がまだ残る理由とマージ順序（Draft 継続）

家練習の入口は `map.js`（ボタン）→ `calendar.js`（`rest:practice` → `runHomePractice`）にある。どちらも他の Draft PR が編集中のため、この PR では触れていない。`home-practice.js` を先に消すと `calendar.js` の import が壊れ、ロジックだけ消すと地図に押しても動かないボタンが残るため、**下の 4-1〜4-3 を同じコミットで当てられるまで #813 は Draft のまま**。

必要な順序:

1. **#796（#780・map.js）** と **#797（#781・calendar.js）** がマージされる → 4-1・4-2 を当てる（入口の撤去）。この2つは同時に当てる。
2. **#793（#791・craft/steps.js・play_feedback.mjs）** がマージされる → 4-3・4-6 を当てる（店の葉・家練習分岐の削除）。
3. **#794（#782・tonari.js・illness.mjs）** がマージされる → 4-5 を当てる（コメントとテストの stub だけ。機能には影響しないので後回し可）。
4. 1 と 2 が揃ったら、4-4 の削除をまとめて当てて CI を通し、Ready for review にする。

## 4. 差分案（他の PR のマージ後の行番号）

### 4-1. `remake/js/daily/map.js`（#796 のブランチ `codex/b-780-map-a62f09` 基準）

```diff
@@ 13
-import { homeRig } from "./home-rig.js";
@@ 197-200
-        // 家ではシーシャ作りの練習もできる（#638・tonari から移した）。休むのは「家に帰る」のまま
-        av.ok && s.kind === "rest" && homeRig()
-          ? el("button.mi-go.mi-go-alt", { dataset: { test: "map-home-practice" }, onclick: () => go(s, "practice") }, [el("span", { text: "家で練習する" })])
-          : null,
@@ 228
-        resolve(mode ? `${s.id}:${mode}` : s.id); // 家で練習は "rest:practice"
+        resolve(mode ? `${s.id}:${mode}` : s.id);
```

`homeRig` は #796 版の map.js ではこのボタンだけが使う（13行目と198行目）。`go(s, mode)` の `mode` 引数は汎用のまま残す（最小差分）。

### 4-2. `remake/js/daily/calendar.js`（#797 のブランチ `codex/b-781-invites-a62f09` 基準）

```diff
@@ 23
-import { runHomePractice } from "./home-practice.js";
@@ 413-425
-  // 家で練習（#638）は地図から "rest:practice" で来る
-  const [baseId, spotMode] = String(spotId).split(":");
-  const homePractice = spotMode === "practice";
+  // 旧い "rest:practice"（家で練習・#783で廃止）が来ても家として扱う
+  const [baseId] = String(spotId).split(":");
   const spot = chapterDef.spotById?.(baseId) || spotById(baseId);
   if (!spot) throw new Error(`行き先が見つかりません: ${spotId}`);
   const facility = ["kannon", "choizap"].includes(spot.id);
-  const { value: { used, exerted, slotsUsed = 1 }, spent } = await paidAction(() => (homePractice && spot.kind === "rest"
-    ? runHomePractice({ staminaGuard }) : performSpotAction(spot)), {
+  const { value: { used, exerted, slotsUsed = 1 }, spent } = await paidAction(() => performSpotAction(spot), {
     ...(facility ? { budget: 1, points: 2, primary: spot.stat } : {}),
     consumed: (result) => result.used && spot.kind === "spot",
   });
   if (!used) return;
-  state.visitedDay[homePractice ? "home_practice" : spot.id] = state.day;
+  state.visitedDay[spot.id] = state.day;
```

`staminaGuard` は他の行動（446行目以降）でも使うので残る。

### 4-3. `remake/js/craft/steps.js`（#793 のブランチ `codex/c-791-mix-no-instant-score` 基準）

```diff
@@ 12
-import { flavorStock, addFlavorStock, ownedFlavorIds, flavorPackageArt } from "../daily/shop.js";
+import { flavorStock, addFlavorStock, ownedFlavorIds, flavorPackageArt, SHOP_FLAVORS } from "../daily/shop.js";
@@ 178-179（fitMixToStock の説明）
- * 配合を手持ちの葉に収める（家で練習・#638）。並んでいない葉は外し、各葉は残量まで・合計は器の量まで。
+ * 配合を使える葉に収める。並んでいない葉は外し、各葉は上限まで・合計は器の量まで。
@@ 205-218
-  // 使えるフレーバー: 在庫のあるもの＋課題フレーバー（主催者支給）。チュートリアルは店の基本形。
-  // 大会は持ち込んだ在庫から詰む（詰んだ分だけ減る・旧版 N3）。練習・リハーサルは店の葉なので減らない
+  // 使えるフレーバー: 大会は持ち込んだ在庫＋課題フレーバー（主催者支給）。詰んだ分だけ減る（旧版 N3）。
+  // 店の練習・リハーサルは店頭の葉も選べ、私物は減らさない（#783）。チュートリアルは店の基本形。
   const consumes = cs.mode === "tournament";
-  // 家で練習（#638）は自分の葉を使う。詰めるのは手持ちの範囲まで。減らすのは一台を作り終えたとき（home-practice.js）
-  const ownLeaves = consumes || cs.venue === "home";
   const supplied = (id) => !!reg && id === reg.flavor;
   let ids = ownedFlavorIds(); // 店の品＋限定サンプル＋もらった葉（贈られたハガルに添えられたカルダモン等）
+  if (!consumes) ids = [...new Set([...SHOP_FLAVORS, ...ids])].filter((id) => DB.flavorById[id]); // 店の練習は店頭の葉も使う（#783）
   if (reg && !ids.includes(reg.flavor)) ids.unshift(reg.flavor);
   if (cs.mode === "tutorial") ids = ["double_apple", "mint"];
   if (cs.orderFlavorIds) ids = cs.orderFlavorIds.filter(id => DB.flavorById[id]);
-  const limit = (id) => (ownLeaves && !supplied(id) ? flavorStock(id) : Infinity);
+  const limit = (id) => (consumes && !supplied(id) ? flavorStock(id) : Infinity);
   const practiceFlavor = cs.mode === "rehearsal" ? state.flags._prep_flavor : null;
   cs.mix = practiceFlavor && ids.includes(practiceFlavor) ? { [practiceFlavor]: 10, mint: 2 } : {};
-  if (cs.venue === "home") cs.mix = fitMixToStock(cs.mix, ids, limit, capacity(cs));
@@ 282
-          : ownLeaves ? el("small.fr-stock", { text: `${consumes ? "持ち込み" : "手持ち"} 残り${flavorStock(id)}g` })
+          : consumes ? el("small.fr-stock", { text: `持ち込み 残り${flavorStock(id)}g` })
@@ 318
-      if (cs.venue === "home") cs.mix = fitMixToStock(cs.mix, ids, limit, cap, 12);
@@ 326-327
-  // 家で練習: 自分の葉として使った分（課題の支給分は除く）。減らすのは作り終えたとき（home-practice.js）
-  if (cs.venue === "home") cs.ownLeavesUsed = Object.fromEntries(Object.entries(cs.mix).filter(([id]) => !supplied(id)));
```

- 価格・在庫定義（`SHOP_FLAVORS`・箱50g）・採点（`evaluateMix`）・店の画面は変えない。`SHOP_FLAVORS` は全てブロンドリーフ（確認済み）。
- 減算は従来どおり `if (consumes) ... addFlavorStock(id, -g)` の1か所だけ＝大会のみ。店の練習（`rehearsal`）・チュートリアル（`tutorial`）・最初の一杯（`orderFlavorIds`）は上限 Infinity・減算なし。
- 影響の確認が要る点: 店の練習の配合リストが最大18種＋私物に増える（DS 表示の縦幅）。`ids` に依存する「ひらめき」ヒントが店頭の葉でも出やすくなる（採点は不変）。

### 4-4. 1・2 の後にこの PR で削除・修正するもの（他の PR と重ならない）

- 削除: `remake/js/daily/home-practice.js`、`remake/test/browser/home_practice_leaves.mjs`
- `.github/workflows/remake-browser.yml:136` の `node remake/test/browser/home_practice_leaves.mjs` を削除（#742 はこのファイルの115〜120行目付近を編集中。行が離れているので衝突しないが、#742 が先にマージされれば行番号だけずれる）。
- `remake/js/craft/practice.js:17-19`: `venue` 引数と `if (venue) cs.venue = venue;` を削除。
- `remake/test/paid_action_growth.mjs:88-100, 128, 145-146`: 家で練習のケース（`homeBefore`・`homePractice`・その assert）を削除。
- `remake/test/home_shisha.mjs:59-63, 68-95`: 「地図の家に『家で練習する』」「家の練習メニュー」「HOME_PRACTICE_*」「consumeHomePracticeLeaves」の assert を削除し、`assert(!src("../js/daily/map.js").includes("map-home-practice"))` と `assert(!fs.existsSync(new URL("../js/daily/home-practice.js", import.meta.url)))` に置き換える。`fitMixToStock` の assert は残す（最初の一杯で使う）。
- `remake/test/browser/ds_packing.mjs:119-120`、`remake/test/browser/game_layout.mjs:134-137`: 作業台へ入る経路を「地図の家 →『家で練習する』」から `page.evaluate(() => import("./js/craft/practice.js").then(m => m.runFullPractice()))` に替える（作業台の表示検査なので経路は問わない）。
- `remake/test/browser/home_rig_backgrounds.mjs:212`: セレクタから `[data-test="map-home-practice"]` を外す。217行目の `venue: "home"` の作業風景は、worker.js を残すなら残してよい。
- `remake/test/practice_shop_only_783.mjs` に追記: `home-practice.js` が無いこと、map.js に `map-home-practice` が無いこと、calendar.js に `runHomePractice` が無いこと、steps.js に `cs.venue === "home"` が無いこと。
- 任意（触らなくても動作は同じ）: `remake/js/craft/worker.js:11-14` の `venue === "home"` 分岐、`remake/js/scenes/game-layout.js:40` のコメント。`remake/js/craft/session.js:413-424` の `runDrill(kind, { venue })` は C 担当との境界なので**触らない**（呼ぶ側が無くなるだけで無害）。

### 4-5. `remake/js/daily/tonari.js`・`remake/test/illness.mjs`（#794 のブランチ `codex/c-782-schedule-f3a71d8c` 基準）

```diff
@@ tonari.js 2
-// シーシャ作りの練習（通しの一台・工程の自主練）は家へ移した（#638・home-practice.js）。工程を選ぶ画面 chooseDrill は第1章の準備イベントで使う。
+// シーシャ作りの練習は店（スミさんの練習イベント）でだけ行う（#783）。工程を選ぶ画面 chooseDrill は第1章の準備イベントで使う。
@@ illness.mjs 49
-  "home-practice.js": { runHomePractice: async () => ({ used: false, exerted: false }) },
```

illness.mjs の stub 行は、home-practice.js 削除後も stub の対象が無いだけなら無害なことを確認してから外す（stub がファイル存在を前提にしているなら 4-4 と同時に外す）。

### 4-6. `remake/test/browser/play_feedback.mjs`（#793 版）

```diff
@@ 10
-      practice: await import('./js/daily/home-practice.js'), vn: await import('./js/vn/engine.js'),
+      vn: await import('./js/vn/engine.js'),
@@ 81
-      assert.deepEqual(await page.evaluate(() => F.practice.runHomePractice({ staminaGuard: () => { throw Error('台なしで消耗確認'); } })), { used: false, exerted: false });
@@ 99
-      await page.locator('[data-test="map-home-practice"]').waitFor();
+      assert.equal(await page.locator('[data-test="map-home-practice"]').count(), 0, '台があっても家で練習の入口は出さない（#783）');
```

## 5. テスト方針

- 今: `node remake/test/practice_shop_only_783.mjs`、`node remake/test/home_shisha.mjs`。家練習の既存テスト（home_practice_leaves・paid_action_growth・ds_packing・game_layout）は main と同じ内容に戻したので、本 PR では再実行のみ。
- 4-1〜4-4 適用時: 上記に加えて `paid_action_growth`、`browser/home_shisha`、`browser/ds_packing`、`browser/game_layout`、`browser/home_rig_backgrounds`、`browser/play_feedback`、`browser/first_brew`、`save_load`。
- main の既知の失敗（新規失敗と区別する）: presentation/recovery/chromium（#793 で修正予定）、play_feedback の touch mix。

## 6. 未決事項

- 家練習の廃止で、第1章の準備イベント以外に「自由行動としての練習」は無くなる。tonari に自由行動の練習を戻すかは仕様に含まれていないため実装しない（戻す場合は tonari.js＝#794 の後）。
- 店の練習の配合リストを「店頭の葉＋私物」にするか「店頭の葉のみ」にするか。案は前者（私物の限定サンプル等も選べるが減らない）。
