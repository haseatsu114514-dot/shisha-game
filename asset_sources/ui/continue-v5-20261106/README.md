# CONTINUE V5「頭の中の呼びかけ」（#2524・2026-11-06）

オーナー指示（2026-11-06）: 自問の要素は不要、「浮かんだのは〜」等は書かない。恋人はプレミアではなく通常枠（スミさんか恋人だけ）。キャラも新バージョンで。既存のコンティニューUIと違う見た目も見たい。必要なら画像生成プロンプトを。

## 入っているもの

- [prompts.md](prompts.md): Codex用プロンプト。A = 新版に足りない表情10点（あげは4・ましろ3・凛想3）、B = 新案専用の背景（任意）。
- `screens/`: 実画面の確認用スクリーンショット（1280×720・横持ちスマホ844×390）。
  - `neon-new-sumi.jpg` / `neon-new-tsumugi.jpg` / `neon-new-samechan.jpg`: 採用中のneon配置で新版立ち絵を使った状態。
  - `inner-pc-sumi.jpg` / `inner-pc-hiyori.jpg` / `inner-pc-retry.jpg` / `inner-pc-gameover.jpg` / `inner-phone-sumi.jpg`: 新案「記憶の暗室」。

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

`continue-preview.html?layout=inner` で見られる。本編の既定は従来の neon のまま（採用はオーナー判断）。採用するときは `buildGameOver` の `layout` 既定値を `"inner"` にし、neon前提のブラウザテスト（`continue_neon` / `continue_closeup` / `continue_keyboard` / `continue_lifecycle` / `gameover_title_center`）を inner の座標へ更新する。

- 筆文字・円形HUD・鋭角ボタンを使わず、細い活字の見出し（コンティニューする？／CONTINUE?）、上端の時計バー、文字だけの縦積み2択（▸と差し色の下線）。
- 人物は顔中心 X=400 で左へ寄せ、縁を暗がりへ溶かす（頭の中に浮かぶ像）。顔の大きさ・中心Yは採用Cと同じ。
- 台詞は左寄せ1行、左端に人物の差し色の縦線。GAME OVER は同じ活字を中央に大きく。
- 新規素材なし（背景は既存の暗いステージを落として使用）。専用背景を作るなら prompts.md の B。
