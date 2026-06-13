# 【実装指示書】MOKU!MOKU!パッキー（日常リール）の本編組み込み

> ✅ **2026-06-13 実行済み**（ブラウザ版に接続・全テスト通過）。
> 以降は再組み込み手順の記録／別環境(Godot版等)への移植リファレンスとして残す。

**この文書は、AI実装者にそのまま渡して実行させるための作業指示書です。**
設計の理由・確率の根拠などの正典は `docs/pakki_slot_spec.md`（以下「仕様書」）。
本指示書と仕様書が食い違う場合は、**コード（web/js/reel.js）と仕様書を正**とする。

---

## 0. 概要

- **何を作るか**: 日常パートの「1行動=1回転」で回るジャグラー型スロット
  （Aタイプ＋天井・完全告知・お助けガチャ）を本編に接続する
- **本体は実装済み**。`web/js/reel.js`（抽選＋演出）・`web/css/reel.css`・
  `web/test/reel.mjs`（コアテスト）はリポジトリに入っており、**触る必要はない**
- 今回やるのは**接続のみ**: 既存5ファイルへの小さなフック追加＋既存テスト3本の対応
- 想定規模: 変更約60行。1セッションで完了する

### 変更してよいファイル（これ以外は触らない）

| ファイル | 変更内容 |
|---|---|
| `web/index.html` | script タグ1行追加 |
| `web/css/style.css` | reel.css の内容を末尾に連結 |
| `web/js/game.js` | フック6箇所 |
| `web/js/sfx.js` | サウンド7種追加（推奨。無くても動く） |
| `web/build_standalone.py` | reel.js の同梱 |
| `web/test/playthrough.mjs` `web/test/ch2.mjs` `web/test/screenshots.mjs` | 初回説明オーバーレイの対応 |
| `docs/web_version_plan.md` | 完了後にステータス更新 |

### してはいけないこと

- ❌ `web/js/reel.js` の確率定数（ROLES / CHERRY_OVERLAP / FREEZE_CONTROL / RESCUE /
  JUG_REN / CEILING / EFFECTS）を変える——数値はオーナーが詰めた決定事項
- ❌ 報酬に現金・アイテムを足す（ステのみ、が決定事項）
- ❌ 上乗せ・AT・ハラキリ系演出の追加（Aタイプ純化が決定事項）
- ❌ スクリプト読み込み順の変更（**engine.js → reel.js → game.js** の順が必須。
  game.js の `newState()` が `REEL` グローバルを参照するため）
- ❌ main への直接 push

---

## 1. 事前準備

1. `docs/web_version_plan.md` の「次回セッションへの引き継ぎ」を読み、
   現在の開発ブランチを確認してチェックアウトする（main 未マージの最新があればそれ）
2. CLAUDE.md の Git Safety を実行:
   `git rev-parse --show-toplevel` → `./tools/check_git_safety.sh` →
   hooksPath 未設定なら `./tools/enable_git_hooks.sh`
3. 健全性確認: `node web/test/reel.mjs` が `ALL PASSED ✅` で終わること（接続前から通る）

---

## 2. 実装手順

### STEP 1: index.html — スクリプト追加

`</body>` 直前のスクリプト群を以下のとおりにする（reel.js の行を追加）:

```html
<script src="js/data.js"></script>
<script src="js/sfx.js"></script>
<script src="js/engine.js"></script>
<script src="js/reel.js"></script>
<script src="js/game.js"></script>
```

### STEP 2: CSS — style.css へ連結

```bash
cat web/css/reel.css >> web/css/style.css
```

- 実行は**1回だけ**（`#reel-widget` で `grep -c` し、style.css 内に既にあれば実行しない）
- `web/css/reel.css` は原本として残す（削除しない）

### STEP 3: game.js — フック6箇所

> アンカーの行が他の開発で変わっている場合は、各フックの「目的」を満たす
> 同等の位置に入れること。

**(a) `newState()` — リール状態の追加**
目的: 新規ゲームにリール状態（シード等）を持たせる。
`practiceBest: {},` の行の直後に追加:

```js
    reel: (typeof REEL !== "undefined" ? REEL.newReelState() : null), // MOKU!MOKU!パッキー（日常リール）
```

**(b) `gainStat()` — アンコール抽選の対象記録**
目的: 「直前の行動で伸びたステ」をリールに教える。
`state.stats[en] = Math.max(0, Math.min(100, state.stats[en] + amount));` の直後に追加:

```js
  // 日常リール用に「この行動で伸びたステ」を記録（リールのアンコール抽選の対象になる）
  if (typeof REEL !== "undefined") REEL.noteStat(en, amount);
```

**(c) `endAction()` — 1行動=1回転のコミット**
目的: 行動消費の瞬間に抽選を確定し、直後の `save()` に乗せる（リセマラ不可の要）。
関数先頭、`state.ap -= 1;` の**前**に追加:

```js
  // 1行動=1回転: 結果と報酬はこの場で確定して直後の save() に乗る（ロードしても同じ＝引き直し不可）
  if (typeof REEL !== "undefined") REEL.onAction();
```

**(d) `showMap()` — 演出の再生**
目的: マップに戻ったタイミングで未演出の回転を流す（夜の分は翌朝に再生）。
関数末尾の `save();` の直後に追加:

```js
  // 日常リール: 未演出の回転（夜に回した分など）をここで流す
  if (typeof REEL !== "undefined") REEL.onMapShown();
```

**(e) `continueGame()` — 旧セーブ互換**
目的: リール導入前のセーブをロードしても壊れない。
既存の互換ブロック（`if (typeof state.guilt !== "number") state.guilt = 0;` の直後）に追加:

```js
  // 日常リール（MOKU!MOKU!パッキー）導入前のセーブ互換
  if (!state.reel && typeof REEL !== "undefined") state.reel = REEL.newReelState();
```

**(f) CONFIG — 演出カット設定**
目的: テンポ最優先の思想（フル/簡易/OFF。OFFでも抽選・報酬は生きる）。
`const config = { textSpeed: 2, autoSpeed: 2, bgmVol: 100, sfxVol: 100 };` に
`reelFx: "full"` を追加して:

```js
const config = { textSpeed: 2, autoSpeed: 2, bgmVol: 100, sfxVol: 100, reelFx: "full" };
```

`showConfig()` 内の `seg("オート速度", ...)` の行の直後に追加:

```js
  seg("スロット演出", "reelFx", [["full", "フル"], ["lite", "簡易"], ["off", "OFF"]]);
```

### STEP 4: sfx.js — リール用サウンドパック

reel.js は存在しないSFX名を黙ってスキップするため省略可能だが、**入れることを推奨**。
api オブジェクト内、`pageTurn: ...},` の直後・`setMuted(m) {` の前に貼り付け:

```js
    // ---------- 日常リール（MOKU!MOKU!パッキー） ----------
    reelLever: () => {
      blip({ freq: 900, type: "square", a: 0.001, d: 0.03, r: 0.05, peak: 0.10, filterFreq: 3200, wet: 0.15 });
      blip({ freq: 240, type: "triangle", a: 0.001, d: 0.05, r: 0.08, peak: 0.12, filterFreq: 1200, wet: 0.2, when: 0.01 });
    },
    reelStop: () => {
      blip({ freq: 1400, type: "triangle", a: 0.001, d: 0.03, r: 0.06, peak: 0.12, filterFreq: 4000, wet: 0.15 });
      blip({ freq: 320, type: "sine", a: 0.001, d: 0.04, r: 0.06, peak: 0.08, filterFreq: 1500, wet: 0.15, when: 0.005 });
    },
    puka: () => {
      // 告知「プカッ」: キュイン系の上昇音 + ベルの重なり + きらめき
      blip({ freq: 600, type: "sawtooth", a: 0.01, d: 0.30, r: 0.25, peak: 0.16, filterFreq: 5200, q: 2,
             wet: 0.5, slide: [520, 1860, 0.34] });
      [1175, 1568, 2093].forEach((f, i) =>
        blip({ freq: f, type: "sine", a: 0.003, d: 0.18, r: 0.45, peak: 0.16 - i * 0.03, filterFreq: 7000, wet: 0.55, when: 0.20 + i * 0.06 }));
      hiss({ dur: 0.4, a: 0.005, peak: 0.06, filterType: "highpass", filterFreq: 5000, wet: 0.6, when: 0.26 });
    },
    pugo: () => {
      // 遅れ「……プゴッ」: ガコッ系の低い衝撃音
      blip({ freq: 110, type: "square", a: 0.002, d: 0.14, r: 0.12, peak: 0.30, filterFreq: 600, q: 2, wet: 0.3,
             slide: [150, 78, 0.16] });
      hiss({ dur: 0.12, a: 0.002, peak: 0.16, filterType: "lowpass", filterFreq: 900, wet: 0.3 });
    },
    reelWin: () => {
      blip({ freq: 1319, type: "sine", a: 0.002, d: 0.10, r: 0.22, peak: 0.14, filterFreq: 6000, wet: 0.4 });
      blip({ freq: 1760, type: "sine", a: 0.002, d: 0.12, r: 0.26, peak: 0.10, filterFreq: 6000, wet: 0.45, when: 0.05 });
    },
    glitch: () => {
      for (let i = 0; i < 5; i++) {
        hiss({ dur: 0.05 + Math.random() * 0.06, a: 0.001, peak: 0.12, filterType: "bandpass",
               filterFreq: 800 + Math.random() * 4000, q: 4, wet: 0.25, when: i * 0.12 + Math.random() * 0.04 });
        blip({ freq: 300 + Math.random() * 2400, type: "square", a: 0.001, d: 0.02, r: 0.03, peak: 0.07,
               filterFreq: 6000, wet: 0.2, when: i * 0.12 });
      }
    },
    freezeBoom: () => {
      blip({ freq: 60, type: "sine", a: 0.003, d: 0.30, r: 0.40, peak: 0.32, filterFreq: 300, wet: 0.35,
             slide: [110, 48, 0.45] });
      hiss({ dur: 0.5, a: 0.003, peak: 0.14, filterType: "lowpass", filterFreq: 700, wet: 0.5 });
      blip({ freq: 880, type: "sine", a: 0.01, d: 0.4, r: 0.6, peak: 0.07, filterFreq: 5000, wet: 0.8, when: 0.15 });
    },
```

### STEP 5: build_standalone.py — スタンドアロン版への同梱

`main()` 内の `engine_js = ...` の行の直後に追加:

```python
    reel_js = (WEB_DIR / "js" / "reel.js").read_text(encoding="utf-8")
```

スクリプト置換ブロックを次のとおり書き換える（検索文字列・置換文字列の両方に
reel.js を追加。**検索側が STEP 1 の index.html と一致していないと置換に失敗する**）:

```python
    html = html.replace(
        '<script src="js/data.js"></script>\n'
        '<script src="js/sfx.js"></script>\n'
        '<script src="js/engine.js"></script>\n'
        '<script src="js/reel.js"></script>\n'
        '<script src="js/game.js"></script>',
        "<script>\n" + asset_js + "\n" + bgm_js + "\n" + data_js + "\n</script>\n"
        "<script>\n" + sfx_js + "\n</script>\n"
        "<script>\n" + engine_js + "\n</script>\n"
        "<script>\n" + reel_js + "\n</script>\n"
        "<script>\n" + game_js + "\n</script>",
    )
```

ビルド後、`grep -c "MOKU!MOKU!パッキー" web/dist/shisha_ch1.html` が 1 以上であることを確認。

### STEP 6: 既存playwrightテストの対応（必須）

初回のアプリ説明 `#reel-intro` はモーダル（タップで読み進める）なので、
放置するとテストのマップ操作がブロックされる。

**(a) `web/test/playthrough.mjs`** — 最初のメインループ（`while (guard++ < 5000)`）内、
`#phone-overlay.show` を処理する if ブロックの**直後**に追加:

```js
  // 日常リールの初回説明（パッキーのアプリ紹介）はタップで読み進める
  if (await page.locator("#reel-intro.show").count()) {
    await page.click("#reel-intro");
    await page.waitForTimeout(60);
    continue;
  }
```

さらに、大会到達後の検証（`log("reached tournament", ...)` 付近）に回転の発生確認を追加:

```js
const reelSpins = await page.evaluate(() => state.reel && state.reel.count);
if (!reelSpins) throw new Error("daily reel never spun");
log("daily reel OK:", reelSpins, "spins");
```

**(b) `web/test/ch2.mjs`** — メインループ（`while (guard++ < 8000)`）内、
LIME処理の if ブロックの直後に (a) と同じ `#reel-intro` ブロックを追加。

**(c) `web/test/screenshots.mjs`** — 「マップまで進める」ループの直後・
練習ピンをクリックする行（`page.locator(".spot-btn", { hasText: "シーシャの練習" })`）の
**前**に追加:

```js
// 日常リールの初回説明が出ていたら読み進める（この経路では通常出ないが防御的に）
while (await page.locator("#reel-intro.show").count()) {
  await page.click("#reel-intro");
  await page.waitForTimeout(60);
}
```

※ ランプ点灯・カットインは非ブロッキング（放置で次の回転前に自動精算）なので対応不要。
※ マップのスクリーンショットに左下のミニ筐体が写るようになるのは正常。

### STEP 7: ビルド＆テスト

```bash
node web/test/reel.mjs                                        # コア（接続と無関係に通ること）
python3 web/build_data.py && python3 web/build_standalone.py # 再ビルド
npx http-server -p 8123 &                                     # リポジトリルートで
node web/test/playthrough.mjs
node web/test/screenshots.mjs
node web/test/ch2.mjs
```

4本すべて成功するまで直す。よくある失敗は §4 トラブルシュート参照。

---

## 3. 受け入れ基準（全部 YES になったら完了）

ブラウザで `web/index.html`（または dist 版）を開いて確認:

1. NEW GAME → チュートリアル後の**最初の行動の後**、マップで
   パッキーのアプリ説明（4行・タップ送り）が**1回だけ**出る
2. 以後、行動のたびにマップ左下のミニ筐体が回る。ハズレは約0.3秒で終わり操作を妨げない
3. 何回か行動するとランプが光る（「ぷぷぷっ！」）。**タップで「赤7を狙えっ！」→3コマ点灯→
   ファンファーレ→ステUPバナー**。放置して次の行動をしても報酬は取りこぼされない
4. コンソールで `__reelDebug.force("freeze")` → フリーズ演出
   （回転停止→EN:CODEグリッチ→FREEZE BONUS→7揃い）が最後まで再生される。
   `force("rare")` → プゴッ→虹ランプ。`force("cherry")` → 角チェリー＋「チェリー！」
5. CONFIG に「スロット演出 フル/簡易/OFF」があり、OFF でウィジェットが消えても
   行動後にステUPバナー（ペカ時）は出る
6. セーブ→リロード→同じ行動をしても**リールの結果が変わらない**
   （`__reelDebug.state().count` とロール結果で確認）
7. 旧セーブ（あれば）をロードしてもエラーが出ない
8. playwright テスト3本＋ reel.mjs が全て成功

---

## 4. トラブルシュート

| 症状 | 原因と対処 |
|---|---|
| `REEL is not defined` | index.html の読み込み順が違う。engine.js → reel.js → game.js |
| ウィジェットが出ない | `config.reelFx` が "off" ／ STEP 2 の CSS 連結漏れ ／ phase が daily 以外（チュートリアル・大会中は回らない仕様） |
| ランプ画像が「ぷ」の文字 | `D.face_icons.packii` 不在時のフォールバック。正常（立ち絵差し替え後に `tools/make_face_icons.py` を再実行すれば顔になる） |
| playwright がマップで固まる | STEP 6 の `#reel-intro` 対応漏れ |
| standalone に反映されない | STEP 5 の検索文字列が index.html と不一致（STEP 1 を先に行うこと） |
| 音が鳴らない | STEP 4 未実施なら正常（無音で動く）。実施済みなら blip/hiss のスコープ内（api オブジェクト内）に貼ったか確認 |

---

## 5. 仕上げ

1. `docs/web_version_plan.md` の
   「2026-06-12 設計完了・実装待ちパッケージ: MOKU!MOKU!パッキー」の節を
   **実装済み**に書き換え（日付・やったこと1〜3行）、新しいセッション節を追加する
2. コミットを分ける必要はない。コミットメッセージ例:
   `日常リール「MOKU!MOKU!パッキー」を本編に接続（docs/pakki_slot_spec.md §10 実施）`
3. 現在の開発ブランチに push（main 直 push 禁止。PR はオーナーの指示があるときのみ）
4. 完了報告には以下を含める: テスト4本の結果／受け入れ基準のチェック結果／
   raw.githack の確認URL（`docs/web_version_plan.md` の公開URL節参照）

## 6. 実装後の調整・拡張（参考）

- バランス調整: `web/js/reel.js` 冒頭の定数を変更 → `node web/test/reel.mjs` で分布検算。
  シミュレータ: コンソールで `__reelDebug.simulate(100000)`
- 甘さの調整ノブ（優先順）: `JUG_REN.mult`（1.5→1.3でジャグ連を控えめに）→
  reg/big weight → `EFFECTS` の exp
- Phase 2 候補（別タスク。今回は実装しない）: 設定1〜6＋示唆／スロノート画面
  （記録は `state.reel.note` に蓄積済み）／フリーズでギャラリーCG解放
