# CONTINUE V5「頭の中の呼びかけ」（#2524・2026-11-06）

オーナー指示（2026-11-06）: 自問の要素は不要、「浮かんだのは〜」等は書かない。恋人はプレミアではなく通常枠（スミさんか恋人だけ）。キャラも新バージョンで。既存のコンティニューUIと違う見た目も見たい。必要なら画像生成プロンプトを。

## 入っているもの

- [prompts.md](prompts.md): Codex用プロンプト。A = 新版に足りない表情10点（あげは4・ましろ3・凛想3）、B = 新案専用の背景（任意）。
- `screens/`: 実画面の確認用スクリーンショット（1280×720・横持ちスマホ844×390）。
  - `neon-new-sumi.jpg` / `neon-new-tsumugi.jpg` / `neon-new-samechan.jpg`: 採用中のneon配置で新版立ち絵を使った状態。
  - `inner-pc-sumi.jpg` / `inner-pc-tsumugi.jpg` / `inner-pc-samechan.jpg` / `inner-pc-hiyori.jpg`: 既定の「記憶の暗室」（inner）で新版立ち絵を使った状態。`inner-pc-retry.jpg` / `inner-pc-gameover.jpg` / `inner-phone-sumi.jpg`: 反応・時間切れ・スマホ横持ち（現行立ち絵で撮影した初回の記録）。

## 新版立ち絵の使い分け

`remake/js/chapters/continue-view.js` の `continuePortraitStyle()`: 台本の全表情が `portraitVariants.new` にあり、顔の枠 `continuePortraitVariants.new` が測ってある人物だけ新版。1表情でも欠ける人物は現行で統一する（表情ごとに画風が混ざらない）。

| 人物 | 2026-11-06 | 備考 |
|---|---|---|
| スミさん・つむぎ・栞・サメちゃん・ひより | **新版** | 顔の枠は `data/portrait_metrics.json` の `styles.new`（新版の絵で測った目・あご・頬。FIC01〜07）から `tools/make_face_icons.py continue_portraits(style)` が出す |
| あげは・ましろ・凛想 | 現行 | 新版の表情が不足。prompts.md の A を生成して組み込むと自動で新版になる |

## 新版表情を受け取った後の組み込み

1. 原画を `asset_sources/portraits/<id>-new-expressions-20261106/<face>-untouched.png` に保存（prompts.md の保存先）。
2. 合格済みの新版通常と同じ足元・倍率で 896×1200 RGBA に配置し `assets/sprites/character_variants/new/<id>/chr_<id>_<face>.png` へ（手順は `asset_sources/portraits/sumi-A-v1-20261105/README.md` と `character-portrait-remaster` スキル）。
3. `python3 tools/portrait_metrics.py set <id> --style new ...` で新版の通常の目・あご・頭頂・頬を測り（`docs/portrait_standard.md` 2節）、`python3 remake/tools/build_manifest.py --portrait-variants-only <id>` と `python3 tools/make_face_icons.py <id>` で `portraitVariants.new`・`continuePortraitVariants.new` を更新。
4. `continue-preview.html` でその人物を再生し、目が y≈270〜300 に来るか確認。
5. `node remake/test/continue_lovers.mjs` の新版カバレッジの期待値（4人→5人…）を更新。

## 新案「記憶の暗室」（`data-layout="inner"`）

2026-11-06 オーナー決定で本編の既定（#2713・PR #2722）。旧既定の neon は `continue-preview.html?layout=neon` で比較できる。neon の見た目を測るテストは `layout: "neon"` を明示し、実画面の通し（`burnt_gameover`）は inner で確認する。

- 筆文字・円形HUD・鋭角ボタンを使わず、細い活字の見出し（コンティニューする？／CONTINUE?）、上端の時計バー、文字だけの縦積み2択（▸と差し色の下線）。
- 人物は顔中心 X=400 で左へ寄せ、縁を暗がりへ溶かす（頭の中に浮かぶ像）。顔の大きさ・中心Yは採用Cと同じ。
- 台詞は左寄せ1行、左端に人物の差し色の縦線。GAME OVER は同じ活字を中央に大きく。
- 新規素材なし（背景は既存の暗いステージを落として使用）。専用背景を作るなら prompts.md の B。

## Issue #2712 の生成状況（2026-11-06、Codex A）

内蔵 image_gen で表情9点と背景候補1枚を生成し、全点を目視確認。原画は prompts.md の指定先に無加工で保存した。[検品記録](generated/inspection.json)に寸法・SHA-256・未完条件を記載。

- あげは: surprise / serious / smile の3点。excited は正本が指定する現行参照PNGが main に存在せず未生成。
- ましろ: sad / smile / sleep の3点。
- 凛想: normal / serious / smile の3点。通常絵を検品した後、同じ通常絵を表情差分の参照に使用。
- 背景: `generated/backdrop-inner.png`。構図は確認済みだが1672×941で、正本の2048×1152以上を満たさず採用保留。再生成でも寸法指定が反映されなかった。

表情はRGBA透過、alpha>128の人物高1408〜1461px。原画のキャンバス・余白は一致せず、組み込み時の通常基準への同比縮小・足元合わせは未実施。本作業は原画納品のみで、本編画像・manifest・実装は変更していない。現状は11点完成ではない。
