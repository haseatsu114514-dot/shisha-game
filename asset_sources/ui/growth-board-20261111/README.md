# 心得の盤: 火種の描き直しと、CSS で描いている部品を絵にする（2026-11-11・GB04）

オーナー（2026-11-11・台帳 SBD121・SBD123）:

> 火種全般の見た目を整えたいのと今安っぽいので
> あと盤システム自体まぁCSS感が強いところは生成して見た目を整えたい　コーデックスに依頼をなげて

盤の面（黒いスモークガラス・ネオンの道・札・台座・結界・顔）は 2026-11-02 に確定した最終デザイン（SBD96・[前の指示書](../growth-board-20261030/neon_lounge_brief.md)）で、**作り直さない**。今回作るのは次の2つ。

1. **火種の粒**（白火・紅火・蒼火・翠火）。今の絵は 96px で、真珠・炎・しずく・ゼリーの角と作りがばらばらに見える。4つを同じ作りの一組として描き直す。
2. **盤とレベルアップで、まだ CSS の図形で描いている部品**（タブ・値段の丸・ゲージの枠・丸いボタン・紙の札・レベルアップの札と光）。

依頼は Issue（`[素材・Codex] 心得の盤…`）。この文書が依頼文の正本。原画は `originals/` に置く。

## 1. 今の画面と部品の場所

| 図 | 中身 |
|---|---|
| `reference/parts_board.png` | 盤（マスを仮置きした所）。番号は下の表の ID の数字 |
| `reference/parts_board_summary.png` | 盤（何も選んでいない時の右のパネル） |
| `reference/parts_levelup.png` | 経験値が届いたその場のレベルアップ（画面の上に出る短い札） |

- 外枠（見出し・タブ・右のパネル・下の帯）は「紙×ラベンダー」（DUI17）。盤の面と、レベルアップの札は暗い「ネオンのラウンジ」。火種はその両方の上に出る。
- 文字・数字・「？」「×」「✓」などの記号・ゲージの中身・光の明滅はゲームが描く。絵には入れない。

## 2. 作るもの

優先は A → B → C。A だけ先に届いてもよい。

| ID | ファイル名（`originals/`） | 大きさ | 置き換える所（今） |
|---|---|---|---|
| **A 火種** | | | |
| GBP-01 | `hidane_any_a.png` `hidane_body_a.png` `hidane_sense_a.png` `hidane_wisdom_a.png`（A案）／`…_b.png`（B案） | 各 1024×1024 | 火種の粒 4種。財布・レベルアップの札・値段・色の台座・「？」の見方・HUD（今は 96px の絵）。**2案**作る |
| GBP-02 | `hidane_small_sheet_a.png`／`_b.png` | 1024×256（256 のマスを横に4つ: 白・紅・蒼・翠） | 16〜24px で出す所の小さい版（財布・近い目的地・内訳）。GBP-01 と同じ形を、太い輪郭と少ない面で |
| GBP-03 | `hidane_socket.png` | 512×512 | 火種の受け皿（財布で粒の下に敷く。0個の種類は皿だけが見える。今は何も無い） |
| **B レベルアップ** | | | |
| GBP-04 | `levelup_plate.png` | 1536×384・九分割（左右 160／上下 96） | レベルアップの札の板（今は CSS のグラデーションと金の線） |
| GBP-05 | `burst_rays.png` | 1024×1024・**真っ黒の地** | 札の後ろの放射の光（今は CSS の縞。画面に加算で重ねる） |
| **C 盤の外枠** | | | |
| GBP-06 | `gb_tab_on.png` `gb_tab_off.png` | 各 768×192・九分割（左右 96／上 64／下 0） | 盤を切り替える札。選んでいる札は下の暗い盤とつながる黒いガラス、ほかは紙の見出し札 |
| GBP-07 | `gb_badge_cost.png` `gb_badge_check.png` `gb_badge_unknown.png` | 各 256×256 | マスに付く小さな印の台: 値段（今は黄色の丸）・灯した印（緑の丸）・まだ分からない（黄色の丸）。数字や記号はゲームが書く |
| GBP-08 | `gb_card.png` | 768×192・九分割（64） | 紙の札: 近い目的地の行・✦の札・「灯せる」の札・財布の箱 |
| GBP-09 | `gb_gauge.png` | 1024×96・九分割（左右 48／上下 32） | ゲージの枠: Lv のゲージ・恩恵の横棒。中は空（量はゲームが塗る） |
| GBP-10 | `gb_round_btn.png` | 256×256 | 丸いボタンの台（？・×・−・＋）。記号はゲームが書く |
| GBP-11 | `gb_title_rule.png` | 1024×96 | 見出し「心得の盤」の下の飾り罫 |

## 3. 火種のデザイン（GBP-01〜03）

- 火種は「灯すと力になる小さな火の粒」。4種類は色だけでなく**外形**でも見分ける（SBD62）: **白火＝丸**、**紅火＝炎**（上にとがる）、**蒼火＝しずく**（上にとがる）、**翠火＝角**（角を落とした立方体）。この形の役割は変えない。
- 4つは同じ作りの一組にする: 同じ光源（左上）・同じ輪郭の太さ・同じ質感・同じ大きさの感じ。色と外形だけが違う。
- 色: 白火 白金 `#fff1d0`（芯は白）／紅火 赤橙 `#ef8a5e`（芯 `#fff1b8`）／蒼火 青 `#58a6ff`（芯は白）／翠火 緑 `#7bd36d`（芯は淡い黄緑）。
- **A案「火を封じた玉」**: 磨いた耐熱ガラスの玉の中で、熾火（おきび）の芯が燃えている。ガラスに小さな映り込み。宝石の台や金具は付けない。
- **B案「熾った火の粒」**: 芯まで赤熱した火の粒そのもの。表面に細いひびが走り、ひびから色の火がのぞく。先は小さな炎になってゆらぐ（白火は丸いまま、まわりに白金の火の輪）。
- どちらも: 外側の光のにじみ・後光・影は**描かない**（光はゲームが重ねる。にじみがあると切り抜けない）。輪郭ははっきり閉じる。粒はマスの中央、マスの 70% ほどの大きさ。
- 実物のシーシャの炭や機材には見せない（炭の箱・トング・台・ホースは描かない）。翠火の角は「角ばった火の粒」で、ココナッツ炭の写実にしない。
- 小さい版（GBP-02）は、採った案と同じ外形を、太い輪郭・2〜3色の面・芯の点1つで。16px に縮めても丸・炎・しずく・角が読めること。
- 受け皿（GBP-03）: 浅い黒い皿に細い金の縁。真上から。中は空。

## 4. 参照画像（毎回・役割を書いて渡す）

1. `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` … 盤で使っている絵の一覧（**画風と色の役割の正本**。同じ盤の部品に見えること）
2. `asset_sources/ui/growth-board-20261111/reference/parts_board.png`（C は `parts_board_summary.png` も、B は `parts_levelup.png`）… 今の画面と部品の場所（番号＝ID）。**配置と大きさの比の参考**。図の桃色の番号と線は描かない
3. 火種（A）だけ: `asset_sources/ui/growth-board-20261030/neon/hidane_any.png` ほか3枚 … 今の火種。**外形の役割（丸・炎・しずく・角）だけ**を引き継ぐ。質感・描き方は真似しない
4. 紙の部品（GBP-06 の off・08・09・10・11）だけ: `assets/ui/paper/panel.png` … ゲームの紙の板（**紙・ラベンダーの線・煙の飾りの正本**）

LFS: `git lfs pull --include="asset_sources/ui/growth-board-20261030/neon/contact_sheet.png,asset_sources/ui/growth-board-20261030/neon/hidane_*.png,asset_sources/ui/growth-board-20261111/reference/*,assets/ui/paper/panel.png"`

## 5. Codex へ渡す文（共通の文＋種類の文＋一覧から1つ）

共通（全部の冒頭に付ける）:

```
ノベルゲーム「水煙前線」の成長画面「心得の盤」で使うUI部品を1枚だけ描いてください。
添付①は、この盤ですでに使っている絵の一覧（画風と色の役割の正本）、添付②は今の画面です（桃色の番号と線は場所の印なので描かない）。①と同じ描き手に見えるように描いてください。

スタイル: 薄暗いシーシャラウンジの空気。`assets/backgrounds/bg_eden_shop.png` 程度の2Dドット絵〜ピクセルペインター調で、輪郭・影・質感に細かいドット感を残す。リアル写真調や滑らかすぎる3D調は避ける。シーシャ台の先端は小さい凸型の金属ポストにし、凹んだカップ型・ボウル一体型・大きな先端パーツにしない。手・腕は細身で中性的、明るいピーチ系の同一肌色に統一する。
配色: 黒〜濃紫の闇に、琥珀／金（#f4d27a系）の暖色ネオンが差す。煙のかすみ。
視点: 作りパートは一人称（プレイヤーの手元を上から見下ろす角度）。
出力: PNG・透過指定のものは背景完全透過。@2x（実寸の2倍）で。指定なき限り 1280×720 基準。
NG: 文字/ロゴ/UI/数字の焼き込み（数値はゲーム側UIで出すので画像に入れない）、watermark。
（上は全素材の共通指針。この依頼の部品は真正面の平らな絵で、透過の代わりに下の FORMAT のマゼンタの地を使う。大きさは一覧の値）

Never bake in any text, letters, kanji, digits, question marks, check marks, plus or minus signs, logo, gauge fill or watermark (the game draws all of them). No people, no hands, no hookah, no charcoal box, no tongs, no hose.
FORMAT: one part only, flat and front-facing, centered. Unless the part says otherwise, put it on a plain solid magenta #FF00FF background (the game keys it out); keep the magenta exactly #FF00FF and draw no glow, halo, haze, smoke or drop shadow outside the part's outline. For nine-slice parts, keep every decoration inside the stated border band (corners especially), keep straight edges parallel to the canvas, and keep the center plain and evenly textured.
```

種類の文（暗い部品: GBP-01〜05・GBP-06 の on・GBP-07）:

```
ART DIRECTION "neon lounge": black smoked glass and thin neon tubes with a bright core, as in attachment 1. Light colors are limited to the board colors red-orange #ef8a5e, blue #58a6ff, green #7bd36d, gold #f4d27a, warm white-gold #fff1d0 and pale white #f6f2ff. Pixel-painter shading with fine dot texture, 2 or 3 clean tone steps, light from the upper left. Calm and luxurious, nothing eye-searing.
```

種類の文（紙の部品: GBP-06 の off・GBP-08〜11）。添付④（`assets/ui/paper/panel.png`）を足す:

```
Style: the "paper goods" of a bright daytime shisha shop in a Japanese pixel-painterly visual novel. The same warm cream paper as the game's shop screen (#f7f3ed), with lavender (#69497e) lines and fills, and only a touch of amber (#d8963f). Keep fine hand-drawn paper fiber and faint print grain. Avoid photo realism, 3D rendering, perspective, drop shadows, strong gradients and neon. Decoration is limited to thin lines and small smoke curls; no medieval ornaments, gears, jewels, lace, ribbons or flowers.
Attachment 4 is the game's paper panel: match its paper, its lavender double rule and its small smoke-curl flourish exactly.
```

一覧（1回の生成で1つ。GBP-01 は 4種×2案＝8回、白火を先に描き、残りは描いた白火を「同じ作りの一組にする見本」として添付する）:

```
GBP-01 A / hidane_any_a.png 1024x1024 — "White fire seed", design A "fire sealed in a bead": a perfectly round bead of polished heat-proof glass with a white-hot ember core burning inside, warm white-gold #fff1d0 with a pure white core, a few wisps of white-gold flame curling inside the glass, one small crisp highlight at the upper left. No metal setting, no base. Bold closed outline; the bead fills about 70% of the canvas.
GBP-01 A / hidane_body_a.png 1024x1024 — "Crimson fire seed", same make as the attached white bead: the same glass with an ember core, but the outer shape is a flame (pointed at the top, leaning slightly right, two soft lobes). Red-orange #ef8a5e with a pale gold #fff1b8 core.
GBP-01 A / hidane_sense_a.png 1024x1024 — "Azure fire seed", same make: the outer shape is a smooth teardrop pointed at the top. Blue #58a6ff with a white core.
GBP-01 A / hidane_wisdom_a.png 1024x1024 — "Jade fire seed", same make: the outer shape is a cube with softly rounded corners seen from slightly above (three faces visible). Green #7bd36d with a pale yellow-green core.
GBP-01 B / hidane_any_b.png 1024x1024 — "White fire seed", design B "glowing ember": a round ember glowing white-hot all the way through, fine cracks across its surface with white-gold fire showing in the cracks, and a thin ring of small white-gold flames hugging its edge. Not a pearl, not glass. Bold closed outline; fills about 70% of the canvas.
GBP-01 B / hidane_body_b.png 1024x1024 — same make as the attached white ember, shaped as a flame (pointed top, leaning slightly right): a red-orange #ef8a5e ember body at the bottom rising into a flame, cracks glowing pale gold.
GBP-01 B / hidane_sense_b.png 1024x1024 — same make, shaped as a teardrop pointed at the top: blue #58a6ff ember with white-hot cracks and a small steady blue flame tip.
GBP-01 B / hidane_wisdom_b.png 1024x1024 — same make, shaped as a cube with softly rounded corners seen from slightly above: green #7bd36d ember with pale yellow-green fire in the cracks along its edges. A fantasy fire seed, not a realistic charcoal cube.
GBP-02 / hidane_small_sheet_a.png (and _b.png) 1024x256 — Four small icons in a row, one centered in each 256x256 cell, left to right: white round, crimson flame, azure teardrop, jade cube. The same shapes as the attached large seeds, simplified for 16 px display: thick dark outline, two or three flat tones, one bright core dot, one highlight. Equal visual size, nothing touching the cell edges.
GBP-03 / hidane_socket.png 512x512 — A shallow round dish seen from directly above: matte black smoked glass with a thin gold #f4d27a neon rim, slightly darker in the middle, empty.
GBP-04 / levelup_plate.png 1536x384, nine-slice (160 px left and right, 96 px top and bottom) — A long plaque of black smoked glass with softly rounded corners, edged by one thin gold neon tube; a second fainter inner line; at the left and right ends, inside the border band, a small ornament of two ember sparks. Center plain dark glass with a very faint purple sheen. The background outside the plaque is magenta.
GBP-05 / burst_rays.png 1024x1024, on a pure black #000000 background instead of magenta — A radial burst of thin warm gold light rays from the exact center, uneven lengths, brightest near the center and fading to black before the edges, with a few tiny ember sparks between the rays. No object in the middle, no lens-flare rings, no text. The game adds it to the screen as light.
GBP-06 on / gb_tab_on.png 768x192, nine-slice (96 px left and right, 64 px top, 0 px bottom) — The selected index tab of the board: black smoked glass with rounded top corners and a flat bottom edge that runs off the bottom of the canvas, a thin white-gold neon tube along the top and both sides (no line at the bottom). Center plain dark glass.
GBP-06 off / gb_tab_off.png 768x192, same nine-slice — An unselected paper index tab: cream paper with rounded top corners and a flat bottom, a lavender hairline along the top and both sides, a fainter second rule inside, one tiny smoke-curl flourish in the top left corner. Center plain paper.
GBP-07 / gb_badge_cost.png 256x256 — A small round token like a tiny coin of dark glass with a gold neon rim and a warm amber #ffb43c face, plain face (the game writes a number on it).
GBP-07 / gb_badge_check.png 256x256 — The same token with a mint green #9fe6c0 face and a dark green rim, plain face (the game draws a check mark on it).
GBP-07 / gb_badge_unknown.png 256x256 — The same token with a dim, clouded smoky face and a faint gold rim, plain face.
GBP-08 / gb_card.png 768x192, nine-slice (64 px) — A small card of cream paper with slightly rounded corners, a lavender hairline border, a slightly darker paper edge on the bottom and right as if it lies on the panel (no cast shadow), and a thicker lavender band 12 px wide along the left edge. Center plain paper.
GBP-09 / gb_gauge.png 1024x96, nine-slice (48 px left and right, 32 px top and bottom) — A long empty gauge frame: a rounded tube outline in lavender ink on cream paper, with a pale lavender #e6dcea trough inside. Completely empty (the game fills it).
GBP-10 / gb_round_btn.png 256x256 — A round paper button: a cream paper disc with a lavender double rule around the rim, plain center (the game writes a symbol on it).
GBP-11 / gb_title_rule.png 1024x96 — A horizontal ornamental rule: a thin lavender line with a small smoke curl at each end and one tiny amber ember dot at the center. Nothing else.
```

- 文字・数字・記号・擬似文字・ロゴ・人物・シーシャ機材は描かない。
- 九分割の部品は、飾りを縁の帯の中に収める（伸ばすと飾りがゆがむ）。
- A の8枚は、同じ案の4枚が一組に見えることを最優先にする（白火を見本に添付して残りを描く）。

## 6. 納品（Codex）

- 原画を `asset_sources/ui/growth-board-20261111/originals/` に置き、PR にする（Draft でよい）。生成の指示と参照画像のパス・SHA-256・各 PNG の画素寸法と SHA-256 を `originals/GENERATION.md` に書く。
- **透過・切り分け・縮小・ゲームへの組み込みはしない**（Claude が行う）。この PR では `originals/` と `GENERATION.md` だけを変える。
- 画像は Git LFS（`asset_sources/` の png は `.gitattributes` で LFS）。

## 7. 検品と組み込み（Claude・受け取り後）

- 検品: 文字・数字・記号が無い／マゼンタが `#FF00FF` の単色で、にじみ・影が外に出ていない（GBP-05 は真っ黒の地）／同じ案の火種4つが一組に見える／16px で丸・炎・しずく・角が読める／九分割の角に飾りが収まっている／盤の一覧（参照①）と並べて浮かない。
- A案・B案を並べた確認用の画像（暗い地と紙の地、実寸 16・24・48・96px）を作り、**オーナーが案を選ぶ**。
- 変換: マゼンタを抜いて WebP に。ゲームが読むのは `remake/img/ui/growth_board/`。火種は今と同じ名前 `hidane_<any|body|sense|wisdom>.webp`（256px）で差し替え、小さい版は `hidane_s_<…>.webp`（64px）。ほかは `socket.webp`・`levelup_plate.webp`・`burst_rays.webp`・`tab_on.webp`・`tab_off.webp`・`badge_<cost|check|unknown>.webp`・`card.webp`・`gauge.webp`・`round_btn.webp`・`title_rule.webp`。
- 組み込み: `remake/css/daily.css`（`.hidane-icon`・`.lvup-*`・`.gb-tab`・`.gb-cost`・`.gb-goal`・`.gb-bar-line`・`.gb-gauge`・`.gb-icon`）と `remake/css/ui-paper.css`。絵が読めない時は今の CSS の形のまま動くようにする（今の `has-art` と同じ考え方）。`python3 remake/tools/build_manifest.py`。
- 確認: `remake/test/browser/growth_fx.mjs`・`growth_levelup.mjs`・`board_tutorial.mjs`、PC 1280×720 とスマホ横 844×390 の画面。
