# CAMEL RACE のレース画面の絵 ── Codex への依頼（2026-11-11・CR23〜CR25）

Issue: [#3217](https://github.com/haseatsu114514-dot/shisha-game/issues/3217)（同じ依頼文を載せてある）。

オーナー「今でもそれなりにできてはいるけどなんか面白さに欠けるし安っぽく見える」「UIや見た目を整えて、画像生成したい場合はイシューからコーデックスへ依頼を」（2026-11-11）。

遊びの側（群れで走る・風よけ・競り合い）とカメラ・HUD の統一は、コードで直した（[docs/spec/camel_race.md](../../docs/spec/camel_race.md) §10）。
残る「安っぽさ」は、**背景・ラクダ・車が絵なのに、その上に載る物がコードで描いた図形のまま**という落差から来ている。

| いまコードで描いている物 | どう見えるか | この依頼 |
|---|---|---|
| スタートとゴールの門 | 木の柱と布の幕を四角と三角で描いた図形。背景の絵の隣で浮く | CR-WD01（**2026-11-11 手前の柱2枚を採用・組み込み済み**。奥の柱は同じ絵を半分の大きさで描く） |
| 100mごとの距離板 | 四角3枚 | CR-WD02（**2026-11-11 採用・組み込み済み**。#3227） |
| 走路の砂・車の道 | 乱数で打った点と線のタイル。広い面積が単調 | CR-WD04（走路の砂・道とも**2026-11-11 採用・組み込み済み**。道は #3227） |
| 砂煙 | 丸いぼかしの円 | CR-WD03（**2026-11-11 採用・組み込み済み**） |
| 下の2つの操作ボタン | CSS の黒い角丸に SVG の記号 | CR-UI07（[ui-request.md](ui-request.md)。最初の4枚は不合格 → 指定を改訂した版を**2026-11-11 採用・組み込み済み**。#3227） |
| GO!・3・2・1・LAST SPURT・GOAL・GOOD・MISS | 画面の書体に縁取り（PERFECT だけ手描きの字） | CR-UI14 の残り9語（**2026-11-11 採用・組み込み済み**） |
| 2〜4位のメダル | CSS の円（1位だけ絵） | CR-UI03 の銀・銅・鉄（**2026-11-11 採用・組み込み済み**。#3328） |
| 進み具合の横木 | CSS の木の色 | CR-UI06 track-rail（**2026-11-11 採用・組み込み済み**。#3328） |
| 競り合いの「VS」 | 画面の書体 | CR-WD09（START・FINISH・VS とも**採用・組み込み済み**。VS は 2026-11-11 の #3328） |
| 大会を選ぶ札 | 文字だけの札 | CR-WD08（**2026-11-11 採用・組み込み済み**） |
| 並走する車は自分の1台だけ | 実際のレースは調教師の車が何台も並走する。寂しい | CR-WD05（**2026-11-11 採用・組み込み済み**。#3328。奥の柵の向こうを3台） |

Claude は画像を生成しない。下の「Codex へ渡す文」をそのまま渡す。届くまでは今のコードの描画のまま動く。

**2026-11-11 の #3227 の組み込みで、この依頼の部品はすべて採用・組み込み済み**（下の依頼文は記録として残す）。

## 一覧

保存先（採用後）は `assets/ui/camel_race/world/`、WebP は `remake/img/ui/camel_race/world/`。原画は `asset_sources/ch4-camel-race/world/originals/`。
すべて**透過PNG（実際のアルファ）**。物の外に影を焼き込まない（影はコードで付ける）。文字・数字・擬似文字・ロゴ・透かしなし（CR-WD09 の決まった語だけ例外）。

| 優先 | ID | ファイル名 | サイズ | 何に使うか | 中身 |
|---|---|---|---|---|---|
| A | CR-WD01 | `post-start-near.png` / `post-start-far.png` / `post-finish-near.png` / `post-finish-far.png` | 手前 480×800・奥 240×400（同じ縦横比） | **2026-11-11 手前の2枚を採用。奥の2枚は作らなくてよい**（手前の絵を半分の大きさで描く）。スタートとゴールの柱（2026-11-11 改訂。1枚の門をやめ、**手前の柵の柱と奥の柵の柱を別の絵**にした）。コードが手前の柱を手前の柵に、奥の柱を奥の柵に、**同じ横位置**で立てる。ゴールの線は地面にコードで引く | 1本ずつの柱。日に焼けた木の柱に、縄の縛り・真鍮の頭と足の金具・赤白の布の巻き（2026-11-11 の不合格の門の案と同じ質感）。柱の上の短い腕から、**こちらを向いた**布の幕が柱の左へ垂れる（幕の中央は**無地**。字はコードか CR-WD09）。柱の上に小さな三角の旗。手前は太く高く幕が大きい、奥は細く低く幕が小さい。スタートは深い緑、ゴールは朱で上下の縁が白黒の市松（旗も市松）。柱の根元がキャンバスの下端、柱の中心はキャンバスの右から 1/4 あたり。4枚で描き方をそろえる |
| A | CR-WD02 | `marker-board.png` | 160×240 | **2026-11-11 採用（#3227）**。100mごとの距離板（奥の柵の外） | 細い木の杭に、上の縁が朱色のクリーム色の板。板の中央は無地（数字はコード）。杭の根元がキャンバスの下端 |
| A | CR-WD04 | `ground-track.png` / `ground-road.png` | 1280×452 / 1280×152 | **2026-11-11 2枚とも採用**（道は #3227）。走路の砂と、車が走る道（横に流すタイル） | 走路: ならした砂。蹄の跡がまばらに続き、手前ほど砂粒が大きい。上の辺（奥）は明るく霞み、下の辺（手前）は少し濃い。道: 踏み固めた砂にタイヤの轍が2本。**左右の端がつながる**（横にタイルして継ぎ目が見えない）。影・物・人なし |
| B | CR-WD03 | `dust-1.png` / `dust-2.png` / `dust-3.png` | 各 256×256 | 蹄と車輪の砂煙 | 輪郭のはっきりした2〜3段の塊で描いた砂煙（小・中・大。左へ流れる形）。エアブラシのぼかしにしない。外は透過 |
| B | CR-WD05 | `suv-rival-a.png` / `suv-rival-b.png` | 各 720×360 | **2026-11-11 採用（#3328）**。奥の柵の向こうを並走する、ほかの調教師の車 | いまの `assets/ui/camel_race/suv.png` と同じ寸法・同じ向き（右）・同じ車輪の位置（後 153,282・前 583,282）の四角い SUV。a は銀がかった灰、b は砂色。窓は濃い色で中の人は描かない。屋根のアンテナは無し（2026-11-11 オーナー指示。初めの指定の「1本」より優先）。実在の車種の顔・エンブレムにしない |
| B | CR-WD07 | `howto-tactics.png` | 640×480 | 遊び方の絵（風よけと競り合い） | CR-UI11 と同じ描き方の小さな絵。青い幕のラクダのすぐ後ろに、金の幕（赤い★）のハビーバが付く。前のラクダで割れた風の線が、後ろのラクダの上を流れる。背景は砂と空だけで、外側は透過 |
| B | CR-WD08 | `cup-practice.png` / `cup-rookie.png` / `cup-standard.png` / `cup-expert.png` | 各 256×256 | 大会を選ぶ札の紋章 | 打ち出しの円いブリキの札。練習＝ラクダの足跡、入門＝若いラクダの横顔と星1つ、標準＝走るラクダと星2つ、上級＝ラクダの横顔に月桂の輪と星3つ。練習は鉄、入門は銅、標準は銀、上級は金。文字なし |
| B | CR-WD09 | `word-vs.png` / `word-start.png` / `word-finish.png` | 長辺1024以内 | **2026-11-11 3語とも採用**（VS は #3328）。競り合いの「VS」、門の幕の字 | CR-UI14 と同じ、ペンキで手描きした看板の字。VS は金に濃い茶の縁、START と FINISH は白にくっきりした濃い影。**綴りが違う案は不採用** |
| C | CR-WD06 | `fg-flagpole.png` | 256×720 | 手前を速く流れる柱（速さの手がかり） | 白い細い柱の上に、金・朱・クリームの三角旗を3枚つないだ紐。柱の根元がキャンバスの下端 |

CR08 の部品（仕様は [ui-request.md](ui-request.md)）も、すべて採用済み: CR-UI07 `remote-{voice,whip}-{normal,pressed}.png` は改訂版を 2026-11-11 に採用（#3227）。CR-UI03 の銀・銅・鉄と CR-UI06 の横木は 2026-11-11 に採用（#3328）、CR-UI14 の9語も採用済み。

## Codex へ渡す文（コピペ用）

```
ラクダレース（第4章ドバイの任意ミニゲーム）のレース画面の絵を作ってください。
背景・ラクダ・車は絵なのに、門・距離板・走路の砂・砂煙・操作ボタンがコードで描いた図形のままで、安っぽく見えます。同じ手で描いた絵に置き換えます。
数字・名前・ゲージ・台詞はゲームのコードが描きます。CR-WD09 の決まった英語の字を除き、文字・数字・擬似文字・ロゴ・透かしを一切描かないでください。

【共通の画風（各画像の指示の先頭にそのまま付ける）】
STYLE: Game sprites for a Japanese pixel-painterly visual novel minigame set at a desert camel racetrack in Dubai at sunrise. Same painter's hand and texture as the game's racetrack background (bg_dubai_camel_track_morning) and its camel and SUV sprites: fine painterly pixel texture, confident dark outlines slightly heavier on the outer silhouette, flat local colors with two to three clearly shaped shadow steps, warm low light from the upper left. Honest, used materials: sun-bleached wood, faded cloth, packed sand, dull worn brass. Palette: sand #e2c48c, sun-bleached cream #f4ead6, brass #c9963a, deep indigo #1c2236, ink #1a110a, accent amber #e08a2c, racing red #c8302a, deep green #2f8f6b. NO glossy gradients, NO glow or bloom, NO neon, NO airbrush, NO photo realism, NO smooth 3D render. Never draw any text, letters, digits, pseudo-writing, logos or watermark. No people.
FORMAT: side view as seen from the trackside, flat with no strong perspective. Transparent background with real alpha. No drop shadow or ground shadow outside the object (the game adds shadows). The object fills the canvas to within about 2% of the edges.

【作るもの】（ファイル名・サイズ・中身）
CR-WD01（2026-11-11 改訂。1枚の門ではなく、柱を1本ずつ4枚） post-start-near.png / post-finish-near.png 各480x800、post-start-far.png / post-finish-far.png 各240x400: ONE single upright trackside post per image, seen straight from the side (no perspective, no beam spanning the track, no second post). A sun-bleached wooden post with rope lashing, a dull brass cap and brass foot plate, and a red-and-white cloth wrap around its middle, the same materials and painting as the attached gate attempt. From a short arm near the top hangs a cloth banner that FACES THE VIEWER and extends to the LEFT of the post; the center of the banner is plain flat cloth (the game prints the word there). A small triangular flag on top. The base of the post touches the bottom edge of the canvas; the post's center line is about one quarter of the canvas width from the right edge. NEAR (480x800): thick, tall post with a large banner about two thirds of the canvas wide. FAR (240x400): the same design at half the size (same proportions), so it reads as the matching post on the far rail. START: deep green banner and flag. FINISH: racing-red banner with a black-and-white checkered strip along its top and bottom edges and a checkered flag. Draw all four in exactly the same hand and lighting.
CR-WD02（2026-11-11 採用済み。作らなくてよい） marker-board.png 160x240: a thin wooden stake holding a small cream board with a racing-red strip along its top edge. The board face is plain (the game prints the distance). The base of the stake touches the bottom edge.
CR-WD04（ground-track・ground-road とも 2026-11-11 採用済み。作らなくてよい） ground-track.png 1280x452: a horizontally seamless tile of a groomed sand racetrack seen from the side at a low angle: raked sand with sparse lines of camel hoof prints, grains larger toward the bottom (near) edge, the top (far) edge lighter and hazier, the bottom edge slightly darker. Opaque, no objects, no shadows of objects, no people. The left and right edges must match perfectly. ground-road.png 1280x152: a horizontally seamless tile of a packed sand service road with two tire ruts running left to right. Opaque. The left and right edges must match perfectly. For ground-road: the previous attempt came back 1402x1122 with wide white margins above and below the strip and was rejected. Make the canvas itself the thin strip (1280x152, about 8.4:1) and fill the whole canvas with road texture edge to edge; no white, empty or transparent margins.
CR-WD03 dust-1.png / dust-2.png / dust-3.png 各256x256: a puff of desert dust kicked up by hooves, drifting to the left, painted as two to three clearly shaped tone steps (not an airbrushed blur). Small, medium and large.
CR-WD05（2026-11-11 採用済み。作らなくてよい） suv-rival-a.png / suv-rival-b.png 各720x360: a boxy generic desert SUV, side view facing right, the same size, proportions and wheel positions as the attached suv.png (rear wheel center at 153,282 and front wheel center at 583,282, tire diameter about 130). a: silver-grey body. b: sand-beige body. Dark tinted windows with no people visible. One thin antenna on the roof. Do not copy the grille, lights or badge of any real car model.
CR-WD07 howto-tactics.png 640x480: a small spot illustration in the same style as the attached howto-camel.png, transparent outside a soft sand-and-sky vignette. Two racing camels with small box-shaped robot jockeys: the front camel wears a blue saddle blanket; the rear camel wears a gold saddle blanket with a red star and runs tucked right behind it. Wind lines split around the front camel and flow over the back of the rear camel.
CR-WD08 cup-practice.png / cup-rookie.png / cup-standard.png / cup-expert.png 各256x256: a struck round tin racing badge, shallow relief, no ribbon. practice: dull iron, a single camel hoof print. rookie: bronze, a young camel's head in profile and one star. standard: silver, a running camel and two stars. expert: gold, a camel's head in profile inside a laurel ring and three stars. No letters or digits.
CR-WD09（VS・START・FINISH とも 2026-11-11 採用済み。作らなくてよい） word-vs.png（長辺1024以内）: hand-painted sign-writer lettering of exactly these words, nothing else on the canvas, transparent outside the letters: "VS" (gold with a dark brown outline), "START" and "FINISH" (white with a crisp dark drop shadow painted as part of the letters). Bold, slightly irregular brush strokes like paint on a racecourse board; not a computer font, no gradients, no glow. Every letter must be spelled exactly as written. (This is the only item where letters are allowed.) For VS: the previous attempts left a dark rectangular panel and a glow behind the letters and were rejected. Draw ONLY the two letters; nothing behind them (no panel, plate, board, box, glow or vignette). Every pixel outside the letter shapes and their painted outline must be fully transparent (alpha 0).
CR-WD06 fg-flagpole.png 256x720: a thin white pole with a string of three triangular pennants (gold, racing red, cream) at the top. The base of the pole touches the bottom edge.

CR-UI07（2026-11-11 改訂。前の指定より優先。改訂版を 2026-11-11 採用済み。作らなくてよい） remote-voice-normal.png / remote-voice-pressed.png / remote-whip-normal.png / remote-whip-pressed.png 各960x240: the black rubber housing of ONE camel trainer's handheld remote with ONE big round push button, seen straight from the front. The game shows it about 70px tall and stretches only the plain middle horizontally; the left part (the button) and the right edge keep their scale, and the height is never stretched. So: (1) The housing fills the whole canvas, top to bottom and left to right, within 2%; no empty or transparent margins above or below it. (2) The button is BIG: its diameter is about 75% of the canvas height (about 180px at 960x240), centered vertically, with its left edge about 20px inside the housing's left edge. Keep the button and every other decoration inside the leftmost 240px; the rightmost 60px holds only the frame and two small screws; everything between x=240 and x=900 is plain, even matte black rubber with no seams, inner panels, symbols or screws (the game prints the label and the gauge there). (3) Paint remote-voice-normal first, then make the other three by editing that exact image: the housing, frame, screws, color and lighting stay identical in all four; only the button changes. Voice: a gold (dull brass) button with a speaker-grille pattern of dark holes. Whip: a red-amber button with an embossed curved riding-whip symbol (symbol only, no letters). (4) Pressed: the button face sinks deep into its socket: the raised rim disappears, the face is clearly darker, and a dark ring of shadow shows around it, so normal and pressed are easy to tell apart at 70px tall. If 960x240 cannot be made exactly, a canvas between 3:1 and 4:1 is acceptable as long as (1) to (4) hold.

【CR08 の部品】CR-UI03 の銀・銅・鉄と CR-UI06 の横木、CR-UI14 の9語、CR-UI07 の改訂版は 2026-11-11 に採用済み（作らなくてよい）。残りはない。

【参照（添付できれば添付。役割を書き添える）】CR-WD01 の柱の質感（形は真似しない。横木と奥の柱は描かない）: asset_sources/ch4-camel-race/world/review/gate-start-attempts-rejected.jpg。画風と光: assets/backgrounds/bg_dubai_camel_track_morning.png。物の描き込みの密度: assets/ui/camel_race/camel_1.png と suv.png。CR-WD05 の寸法と車輪の位置: suv.png。CR-WD07 の描き方: assets/ui/camel_race/ui/howto-camel.png。CR-WD09 の字: assets/ui/camel_race/ui/word-perfect.png。
【渡し方】原画をそのまま asset_sources/ch4-camel-race/world/originals/ に置き、生成の指示と日付を asset_sources/ch4-camel-race/world/generation.json に書いて push。各ファイルの SHA-256・実寸・アルファの有無を添えてください。候補が複数ある部品は -A/-B を付けて全部ください。生成の決まり（開始前のコピーの確認・寸法とアルファの機械確認・文字を描かない）は Issue #3055 と同じです。
```

## 採用の記録

### 2026-11-11 CR-WD03 砂煙（A を採用）

Codex がオーナー経由で渡した `3217-dust-A-production.zip`（SHA-256 `4415af29…`）。同梱の `generation-dust-A.json` の SHA-256 と原画・候補の全ファイルが一致した。

| 部品 | 採用 | 理由 | ゲーム用 |
|---|---|---|---|
| dust-1（小） | **A** | 輪郭のはっきりした2〜3段の塊で、左へ流れる尾と粒。外周は完全に透明（縁のアルファ 0）。砂色・暗い茶・市松・道の色のどれに置いても読める | `assets/ui/camel_race/world/dust-1.png`（256×256） |
| dust-2（中） | **A** | 同上。右のふくらみと左の尾の形が小・大とそろう | `dust-2.png` |
| dust-3（大） | **A** | 同上。ムチの砂の爆発・スタートの砂に使う | `dust-3.png` |

- 3枚とも本体が半透明（不透明な画素は 1%未満）。砂煙なのでそのまま使う。ゲーム用は Codex の正寸の候補（均一の縮小だけ）そのもの。WebP は輪郭がにじまないよう**可逆**（3枚で約48KB。非可逆 q90 だと見える画素で色が最大45ずれた）。
- コード（`camel-race.js`）: 絵が読めた時だけ、ぼかしの円をこの絵に替える（読めなければ従来の描画。画面の `data-dust` が `sprites`／`canvas`）。輪郭のある絵を毎フレーム重ねると線がつぶれるので、**蹄が地面を蹴る間隔（3.4m、ムチの間は 2.6m）ごとに1つ**出す。塊の右端を蹄の位置に、下の縁を地面に合わせ、**列ごとにそのラクダの直前に描く**（ぼかしの円の頃は全部をラクダの上に描いていて、絵にすると胴や前の列に重なった）。車の砂煙は車の直前。出た時の大きさで小・中・大を決め、消えるまで同じ絵のまま膨らませる。スタートとムチの砂の爆発は、数を 1/3.5 に減らす。
- 原画は `world/originals/dust-{1,2,3}-A.png`（1254×1254）、生成記録は `world/generation-dust-A.json`、比較図は `world/review/dust-A-comparison.png`。

| 原画（`world/originals/`） | 寸法 | SHA-256 |
|---|---|---|
| `dust-1-A.png` | 1254×1254 | `e2cd17862948ed6562bcf2504df81ca0d2860f6b6347d16d600f467621792bf4` |
| `dust-2-A.png` | 1254×1254 | `e41fb39ae311cc587bd95b9e37c04c86e2e89e4bf9452d33bd597b2f68de1d10` |
| `dust-3-A.png` | 1254×1254 | `8e20ebcb2b68331e2708300817c6b2770e52221ff7b79c674d3ae76470940af1` |

### 2026-11-11 手描きの字（CR-UI14 の9語・CR-WD09 の START／FINISH を採用。VS は不合格）

`3217-words-A-production.zip`（SHA-256 `a0c9ea3a…`）。同梱の `generation-words-A.json` の SHA-256 と原画・候補の24ファイルがすべて一致した。

| 語 | 採用 | 理由 | 使う所 |
|---|---|---|---|
| GOOD・MISS・GO!・3・2・1・LAST SPURT・GOAL・CAMEL RACE | **A**（9語とも） | 綴りが正しく、色が指定どおり（GOOD 水色・MISS 灰がかった赤・GO! と数字は白に濃い影・LAST SPURT 朱・GOAL 金・題名は砂色に濃い縁）。採用済みの PERFECT とレース場の背景の上で並べ、同じ手に見えた。透明度は本体が 240〜254（ほぼ不透明）で、PERFECT と同じ作り | 声の判定（GOOD、輪を見送った時の MISS）、カウントダウン、LAST SPURT と GOAL のバナー、左上の計器と試遊ページの題名 |
| START・FINISH | **A** | 同上（白に濃い影） | スタートとゴールの門の幕の字（Canvas） |
| VS | 不合格（Codex の判定と同じ） | 字の後ろに四角い暗い背景と光が残る。2案とも | 競り合いの「VS」は書体のまま。再依頼 |

- ゲーム用は Codex の正寸の候補（長辺1024への均一の縮小だけ）。CR-UI14 は `assets/ui/camel_race/ui/word-*.png`（PERFECT と同じ場所）、START／FINISH は `world/word-*.png`。WebP は PERFECT と同じく非可逆（1024×341 で約70KB）。数字と GO! は表示に足りる高さ 512 まで縮めて作った（約25〜80KB）。
- 「無駄な声」「連打はダメ」は、何がいけなかったかを伝えるので日本語のまま。MISS は、輪を見送った時（これまでの「見送った……」）に使う。読み上げ用の文字は残る。
- 原画は CR-UI14 が `ui/originals/`、START／FINISH が `world/originals/`。生成記録は `world/generation-words-A.json`、比較図は `world/review/words-A-comparison.jpg`。

### 2026-11-11 大会の紋章（CR-WD08）・旗の柱（CR-WD06）を採用

`3217-cups-flag-A-production.zip`（SHA-256 `a337f229…`）。同梱の `generation-cups-flag-A.json` の SHA-256 と原画・候補の10ファイルがすべて一致した。

| 部品 | 採用 | 理由 | 使う所 |
|---|---|---|---|
| 紋章 練習・入門・標準・上級 | **A**（4枚とも） | 練習＝鉄・ラクダの2つに割れた足跡、入門＝銅・若いラクダの横顔と星1つ、標準＝銀・走るラクダと星2つ、上級＝くすんだ金・月桂の輪の中の横顔と星3つで、指定どおり。文字なし。64px でも見分けられる | 大会を選ぶ札の右上（未解放は色を抜く） |
| 旗の柱 | **A** | 白い細い柱の上に、金・朱・クリームの三角旗3枚。柱がまっすぐで（中心 x=43）、置く位置を決めやすい | 手前の旗の柱（スタートの14m手前とゴールの26m先。走路の1.35倍の速さで流れる） |

- Codex は紋章を「不透明さの修正が必要」としていたが、これは本体の透明度が 240〜254（95%以上）という意味だった。紙・暗い茶・市松のどれに置いても透けは見えないので、**手を加えずに採用**した（アルファの加工はしていない）。入門の紋章は縁がキャンバスの上端に触れているが、欠けて見えない。
- 不合格: 金属の色を取り違えた入門・標準の2案（Codex の判定と同じ）。VS とあわせて縮小図だけ `world/review/rejected-vs-and-wrong-metal.jpg` に残した。
- ゲーム用は `world/cup-*.png`（256×256）・`world/fg-flagpole.png`（256×720）。原画は `world/originals/`、生成記録は `world/generation-cups-flag-A.json`、比較図は `world/review/cups-flag-A-comparison.jpg`。

| 原画 | 寸法 | SHA-256 |
|---|---|---|
| `word-good-A.png` | 2172×724 | `bcac5aac6a34a0c361e9150cbdf2b943116df24fbdfd3a58cd31aa3d79b446de` |
| `word-miss-A.png` | 2172×724 | `08b830c9a83654c7d1171ff9baccbf634c6c5cbc853af822e7e91e092949871f` |
| `word-go-A.png` | 1774×887 | `18cd32901139d8108c3ec95e4539a883d0d0a45ba84ce6dd58edf3fa0b41e506` |
| `word-3-A.png` | 1230×1278 | `6875435ed54a3e599324bc99d171c3711261ea9c805b37684590dad337f48349` |
| `word-2-A.png` | 1210×1300 | `8483bb5b739ab06c5afe23ad33d77bed183944faa5281ff1382beba5883c2849` |
| `word-1-A.png` | 1199×1312 | `14b02fb7b3589b547eb6b1f2cb1f17d79179868bdda43ee46c6e9a0730d46cce` |
| `word-last-spurt-A.png` | 2172×724 | `36811b3c7e794f37b3899ca6f284cf099c01f212971a906579abeffaf50fb8da` |
| `word-goal-A.png` | 2172×724 | `70cb0df589005fe2487b53238fb6be0acddd0f2b9c25a102c6827ed7f77381fd` |
| `word-title-A.png` | 2172×724 | `381218bbdd26dd4b4a6d1248672a14d45ac39e9a9f1fdfe99cba0b6334e36a16` |
| `word-start-A.png` | 2172×724 | `99a57ad8a752923e099d20cbdbc7425e24d559504c8af7704f385d70a488ee87` |
| `word-finish-A.png` | 2172×724 | `c4e26cf9c0e4c3b8c5bcee4ff5c29dcb62fb27e17704ce496c00bea40c659743` |
| `cup-practice-A.png` | 1254×1254 | `06ea73bb60c8ac54db74ef8f1ad6a15570c8ddd019071f85748b08de5b826723` |
| `cup-rookie-A.png` | 1254×1254 | `f83ce62e9473524d8b2408a9a3edaafabcaa132076b848e30b44f49443f59901` |
| `cup-standard-A.png` | 1254×1254 | `db42aabc96c151b16b27706482f3cf9de20596123bf2945585894fa01ada76d4` |
| `cup-expert-A.png` | 1254×1254 | `9ecf8b7fbbae40fd3f2aecb4e2b0b7796cb60860f7b338e13e5ec83216bb5450` |
| `fg-flagpole-A.png` | 748×2103 | `23016a56879ef0cd317375419bd1158e4bb910de07f1097424915eff428edbe8` |

### 2026-11-11 遊び方の絵（CR-WD07）・走路の砂（CR-WD04）を採用

`3217-tactics-and-production-QA.zip`（SHA-256 `a9af4a8c…`）。同梱の `generation-latest.json`（リポジトリでは `world/generation-tactics-track-A.json`）の SHA-256 と、原画・候補の8ファイルがすべて一致した。原画は Codex の `*-raw.png` を `*-A.png` の名前で保存した。

| 部品 | 判定 | 理由 | 使う所 |
|---|---|---|---|
| 遊び方の絵（風よけと競り合い） | **A を採用** | 青い幕のラクダのすぐ後ろに金の幕（赤い★）のハビーバ、前のラクダで割れた風が後ろの背を流れる、で指定どおり。既存の遊び方の絵（howto-camel）と同じ手。小さくしても読める | 遊び方の4ページ目「前のラクダを使う」（新設。1ページ目は元の短い文に戻した） |
| 走路の砂 | **A を採用（加工なし）** | 背景の絵と同じ手の、ならした砂と蹄の跡。Codex の判定は「継ぎ目の修正が必要」（継ぎ目の段差 6.9、中の段差 3.9）だったが、ゲームで描く大きさ（640×226、半分）にすると継ぎ目の段差 6.6 が中の段差（最大 6.9）の範囲に収まり、拡大しても走行中の画面でも見えなかった。手は加えていない | 走路の砂（`groundTiles()` の砂のタイル）。道はコードのまま |
| 道（ground-road） | 不合格（Codex の判定と同じ） | 1402×1122 で上下に白い余白があり、1280×152 にできない | 再依頼 |
| リモコン（声・通常） | 不合格（Codex の判定と同じ） | 3:1 で、指定の 4:1 にできない | 再依頼 |
| VS（B） | 不合格（Codex の判定と同じ） | 字の後ろに四角い背景と光が残る（2回目） | 再依頼 |
| 門（スタート・B） | 不合格（Codex の判定と同じ） | 改訂前の指定（1枚の門）で作られていた。奥の柱の根元が 52% | 改訂した指定（柱を別の絵に）で再依頼 |

- ゲーム用は Codex の正寸の候補（均一の縮小だけ）: `ui/howto-tactics.png`（640×480）・`world/ground-track.png`（1280×452）。WebP は、遊び方の絵が 640×480（約95KB）、走路の砂は Canvas で描く大きさの 640×226 に均一に縮めて作った（約45KB）。
- 画面の `data-sand` が `sprites`／`canvas`（読めなければコードで描く砂）。
- 不合格の4枚は、縮小図だけ `world/review/rejected-gate-road-remote-vs-B.jpg` に残した。Codex の比較図は `world/review/track-tile-A-comparison.jpg`・`words-perfect-reference-comparison.jpg`。

| 原画 | 寸法 | SHA-256 |
|---|---|---|
| `howto-tactics-A.png` | 1448×1086 | `1154d66fd023cb213fd364a595bb2f7adf05213fcbbcda1de9ec51bdada02578` |
| `ground-track-A.png` | 2109×745 | `bb1f9c35a8a10943fdd4e08264ca3f8eb49a3ffce980093d2bc1e436e3c4645f` |

### 2026-11-11 CR-WD01 門（2案とも不合格 → 指定を改訂）

同じ ZIP の `rejected/gate-start-attempt-{A,B}.png`（971×1619）。Codex の判定は「奥の柱の根元が高さの54%で、指定の47%に届かない。ゴールの門が無い」。確認して同意し、もう一つ理由を足した:

- **レース画面は、同じ距離のラクダが列によらず同じ横位置に並ぶ描き方**（奥行きを斜めにずらさない）。この案は奥の柱が手前の柱の左へ約 45°（画面で約 225px）ずれているので、門を置くと、奥の列のラクダが同じ距離でもう門を越えて見える。
- そもそも走路をまたぐ門の幕はラクダの進む方向を向くので、横から見ると薄い線になる。今のコードの門も、手前と奥の柵に柱を立てて幕をこちらへ向ける描き方で、それなら柱は別の絵で足りる。
- そこで CR-WD01 を「手前の柱・奥の柱を別の絵（スタートとゴールで計4枚）」に改訂した（上の一覧と依頼文）。2案の質感（縄・真鍮の金具・赤白の巻き）はよいので、参照に `world/review/gate-start-attempts-rejected.jpg` を付ける。原画の2枚は容量を節約するためリポジトリには入れず、並べた縮小図だけ残した。

### 2026-11-11 CR-WD01 柱（手前の2枚を採用）・CR-UI07 リモコン（4枚とも不合格 → 指定を改訂）

`3217-revised-posts-A-raw.zip` と `3217-remotes-A-raw.zip`。同梱の `generation-revised-posts-A.json`・`generation-remotes-raw-A.json`（どちらも `world/` に保存）の SHA-256 と原画がすべて一致した。どちらも Codex 自身が「原画候補・寸法未達」としていた納品。

| 部品 | 判定 | 理由 | 使う所 |
|---|---|---|---|
| 手前の柱（スタート・ゴール） | **A を採用** | 柱1本で、幕は柱の左へこちらを向いて垂れ、中央は無地。上に小旗。柱の中心は幅の 74.5%（指定 75%）、根元はキャンバスの下端。スタートとゴールで形が同じで、幕と旗の色・市松だけが違う。縄・真鍮の金具・赤白の巻きが不合格の門の案と同じ質感。原画 971×1619 は 3:5 なので、**480×800 へ均一に縮小しただけ**（Codex の正寸の候補は無い。切り抜き・色・アルファの加工なし） | スタートとゴールの柱 |
| 奥の柱（スタート・ゴール） | 不合格（Codex の判定と同じ）・**作り直さない** | スタートは背景に市松の汚れ、ゴールは余白と形の違い。もともと「手前と同じ絵の半分」の指定なので、手前の絵を半分の大きさで描けば足りる | ─ |
| リモコン（声・ムチの通常と押下） | 不合格 | Codex の判定（3:1 で 4:1 にできない・ムチの飾りが左 120px を超える）に加え、ゲームのボタンに当てて見た（`world/review/remotes-A-rejected.jpg`）。① 比率は問題にならない（横だけ伸ばす九分割にすれば 3:1 でも使える）。② **押すボタンが小さい**: 筐体の高さの約4割で、画面（高さ 68px）では直径約25px。今の CSS の丸（46px）より小さく、押す所に見えない。前の指定（960×240 の左 120px に直径 80px）がそもそも小さかった。③ **声とムチで筐体が別物**（声は藍色で細い縁、ムチは茶色で太い縁と内側の仕切り）。並べると別の機械に見える。④ 押下の差がゲームの大きさではほとんど見えない（特に声）。⑤ 声は筐体の上下に、高さの 25% ずつ透明な余白がある | 操作ボタンは CSS のまま。上の依頼文の CR-UI07 を改訂して再依頼（大きなボタン・4枚とも同じ筐体・押下は暗く沈む・横だけ伸ばす前提） |

- 置き方（`camel-race.js` の `drawGates`・`drawNearPosts`・`POST_ART`）: 柱の絵は 480×800（柱の中心 x=357、字を置く無地の所はスタート y 170〜370・ゴール y 198〜350）。手前の柱は手前の柵（y=606）に 0.45 倍、奥の柱は奥の柵（y=398）にその半分の 0.225 倍で立てる。横の位置は、スタートが発馬の柵（自分のラクダの中心から 118px 先。柵の奥の端に奥の柱）、ゴールが自分のラクダの鼻先がゴールした瞬間に柱に届く所（中心から 90px 先）。幕の字は採用済みの START／FINISH（CR-WD09）。
- **スタートは奥の柱だけ**: 手前の柱も立てると、幕が並んだラクダの頭と「あなたのラクダ」の札にかぶった（比較図の左下）。発馬の柵が奥の柱の根元から手前の柵まで渡るので、スタートの線は読める。ゴールは手前と奥の柱を立て、地面に白黒の市松の線を引く（手前の端は手前の柱のすぐ左で、柱に隠れない）。手前の柱はラクダより前・車より奥に描くので、ゴールの瞬間にラクダの鼻先が柱の向こうを通る。
- 画面の `data-gate` が `sprites`／`canvas`（2枚そろって読めた時だけ絵。読めなければ従来の木の柱2本と布の幕）。WebP は約50KB ずつ。
- 原画は `world/originals/post-{start,finish}-near-A.png`、比較図は `world/review/posts-A-comparison.jpg`。不合格の奥の柱2枚とリモコン4枚は、容量を節約するためリポジトリに入れず、縮小図だけ残した。

| 原画 | 寸法 | SHA-256 |
|---|---|---|
| `post-start-near-A.png`（採用） | 971×1619 | `af2ffbb6cdd5445d87edc805a95ea5742862adedb402b9c31946f406d202b2a8` |
| `post-finish-near-A.png`（採用） | 971×1619 | `40209475c9c377ec0e38eae26a95ff5488b04df146ef6dd9307448a8a8cc914c` |
| `post-start-far-A.png`（不合格・保存せず） | 971×1620 | `e453ae336afe10a559dab89ffd08aa053e5f2b8cffd41fc8402165700728bfd9` |
| `post-finish-far-A.png`（不合格・保存せず） | 971×1619 | `e6e411272e8b0df337d0346d544ff0f664c124cec6d96c475987155d8c8c9dae` |
| `remote-voice-normal-raw-A.png`（不合格・保存せず） | 2172×724 | `d2224e4dd06d9cfe092af3cc0c28d3f68bc0abe4f9ebcc10362dd00519d29510` |
| `remote-voice-pressed-raw-A.png`（不合格・保存せず） | 2172×724 | `a4849ad9c5c627e8944a1a5432b2288bee1ed56abdfc81440804f1a7ebf625b8` |
| `remote-whip-normal-raw-A.png`（不合格・保存せず） | 2172×724 | `a522b7497ed3f17e144daec6ae4d25f0a11ea7afaba8ac8bee312cfb5468bb38` |
| `remote-whip-pressed-raw-A.png`（不合格・保存せず） | 2172×724 | `b08c92630a95f42682fb3287cd72aecea03ed1f3f15da65a37e9d2ff0ec6162a` |

### 2026-11-11 #3328 並走車2色・銀銅鉄のメダル・横木・VS（7点とも採用）

Codex の Draft PR [#3328](https://github.com/haseatsu114514-dot/shisha-game/pull/3328)（`codex/camel-missing-art-3217-20261111` の `f71a226b`）。オーナー「3328の実装をお願い」（2026-11-11）。原画7枚・正寸の候補7枚・不採用の途中版6枚・生成記録は、Codex が置いた `world/originals/`・`world/candidates/`・`world/remaining-20261111/` のまま取り込んだ。`remaining-20261111/SHA256SUMS` の21ファイルはすべて一致。

| 部品 | 判定 | 理由 | ゲーム用 |
|---|---|---|---|
| CR-WD05 suv-rival-a（銀がかった灰） | **採用** | 右向きの四角い SUV。自分の車の絵に重ねて測ると、寸法・車輪の位置（後 153,282・前 583,282）のずれは数 px 以内。窓は濃い色で人なし。実在の車の顔・文字なし。オーナー指示でアンテナなし | `assets/ui/camel_race/world/suv-rival-a.png`（720×360） |
| CR-WD05 suv-rival-b（砂色） | **採用** | a と同じ形で、車体の色だけ砂色 | `assets/ui/camel_race/world/suv-rival-b.png`（720×360） |
| CR-UI03 medal-silver・medal-bronze・medal-plain | **採用** | 金と同じ型（ラクダの横顔の浮き彫りと、数字を置く無地の輪）。銀・赤みの銅・暗いくすんだ鉄がはっきり分かれる。全周が入り、紐・文字なし | `assets/ui/camel_race/ui/medal-{silver,bronze,plain}.png`（256×256） |
| CR-UI06 track-rail | **採用** | 上下の辺が平行な、白いペンキの剥げた木の横木。真鍮の金具は左右の端（各約50px）だけで、64px の帯に収まる | `assets/ui/camel_race/ui/track-rail.png`（1600×96） |
| CR-WD09 word-vs | **採用** | 綴りは VS。金の字に濃い茶の縁で、PERFECT と同じ手。前回の不合格の理由（字の後ろの四角い板・光）が無い | `assets/ui/camel_race/world/word-vs.png`（1024×834） |

- 透過の留保（Codex の記録どおり）: 物の外にごく薄い画素（アルファ1〜15。画面の0.3〜0.8%）が散り、本体も主にアルファ 250〜254。灰・濃紺・砂色の上に置き、ゲームの大きさで見ると、薄い画素は見えず本体の透けも分からないので、**加工せずにそのまま使う**（アルファの二値化・背景の切り抜きはしていない）。
- ゲーム用は Codex の正寸の候補そのもの。車・メダル・VS は均一の縮小だけ。横木は原画（1672×941）の中央の帯から、本体の外接範囲（アルファ16以上）を切り出して均一に縮小した（透明な余白を落としただけで、横木の絵は縮小だけ）。WebP は `build_images.py` の `encode()`（可逆と非可逆 q90 の小さい方）。
- 置き方:
  - 並走車（`camel-race.js` の `drawRivalSuvs`・`RIVAL_SUV_ART`）: 奥の柵の向こうに3台（灰・砂色・灰を少し暗くした1台）を、自分の車の半分の 0.2 倍で走らせる（背景の絵に停めてある車と同じくらいの大きさ）。相手の3頭の平均の位置から 12m ずつずらして並べるので、群れと同じ速さで走り、群れが画面の外へ離れると車も外へ出る。台ごとに ±1m だけ前後に揺れる。タイヤの下端は奥の柵の手すりに少し隠れる高さ（y=388）。車輪は車体の絵の車輪を半径 61px の円で切り抜いて回す（自分の車の回る車輪とはホイールの色が違うため）。柵・大会の飾り・距離板・奥の柱より奥に描く。2枚そろって読めた時だけ走らせる（画面の `data-convoy` が `sprites`／`none`）。
  - VS（`drawDuel`・`VS_ART`）: 競り合いの火花の間に、幅 72px で描く（字の幅が書体の時の約1.4倍）。読めなければ書体に縁取り。
  - メダル（`camel-race.css`）: 結果画面の2位＝銀・3位＝銅・4位＝鉄。円が金より約11%小さく描かれているので、背景を 112.6% に拡大して金と同じ大きさに見せる（絵は加工しない）。数字は金と同じく上の輪に、地の色に合う色で置く。
  - 横木（`camel-race.css`）: 上の進み具合のバーを `border-image` の九分割にした（左右 64px の金具は縦横比を保ち、中の木だけ横へ伸ばす）。溝・目盛り・SPURT の帯・ゴールの柱は今のまま。剥げたペンキの上でも SPURT が読めるよう、字にクリーム色の縁を付けた。
  - メダルと横木は、画像が読めた時だけ付くクラス（`cr-medal-silver`・`cr-medal-bronze`・`cr-medal-plain`・`cr-rail`）で切り替える。読めなければ今の CSS のまま。
- 不採用の途中版（Codex が `remaining-20261111/history/` に保存）: アンテナ付きの車2色（オーナー「車にアンテナはいらなかった」）、上端が切れた銀メダル、細すぎた横木、光が残った VS 2枚。

| ゲーム用（`assets/ui/camel_race/`） | 寸法 | SHA-256 |
|---|---|---|
| `world/suv-rival-a.png` | 720×360 | `2c11de271ece691947d360bf16a60a1bc94cc2b97ca333dd489eae63010db208` |
| `world/suv-rival-b.png` | 720×360 | `ec6a27e56a2a5f618f62a3ce4ee9d667e59dd5b162fd1c4f942fe19b13f8cb8c` |
| `world/word-vs.png` | 1024×834 | `8328056ee974bb2f12a6021eb966b3c7b878a15feb13f02f3942d81c869f42e3` |
| `ui/medal-silver.png` | 256×256 | `7a527eb2703a5155befa6072364d3039e90fca5263725ed68009823666e349f8` |
| `ui/medal-bronze.png` | 256×256 | `00f85d89911aa8c778a5b9627d32f56c5eaa0cb871765c06db99bbec8935ef48` |
| `ui/medal-plain.png` | 256×256 | `55451b148e2db906e04aaec0d90fc46a3eed1aad2b3b9d18bf9fc93859da503d` |
| `ui/track-rail.png` | 1600×96 | `cd902fa11f6934f6f7fc277e3bc969ff882c3b9a49e85f564055d16e96d8fa8f` |

原画の SHA-256 は [remaining-20261111/README.md](world/remaining-20261111/README.md) の表。

### 2026-11-11 #3227 道・距離板・リモコン4枚（オーナー決定で全採用）

Codex の PR [#3227](https://github.com/haseatsu114514-dot/shisha-game/pull/3227)（`codex/3217-camel-world`。2026-11-11 にマージして main に保存済み）。オーナー決定（2026-11-11・#3217 のコメント）で候補を全部採用し、ここで組み込んだ。`world/SHA256SUMS-B.txt` と `world/generation.json` の SHA-256 は、使った候補6枚・比較図とも一致。

| 部品 | 判定 | 確かめたこと | ゲーム用 |
|---|---|---|---|
| CR-WD02 marker-board | **採用**（オーナー決定） | 160×240・透過。杭の中心 x=79、根元が下端。板は y 24〜100（上の朱色の帯が y 26〜39、その下の無地が y 40〜96）。文字・数字なし | `assets/ui/camel_race/world/marker-board.png`（160×240） |
| CR-WD04 ground-road-B | **採用**（オーナー決定） | 1280×152・不透過・上下の余白なし。左右の端の列は完全に一致。轍は高さの約1/3と2/3の2本。色は走路の砂とほぼ同じ（平均 RGB 240,164,96。走路は 235,164,99） | `assets/ui/camel_race/world/ground-road.png`（1280×152） |
| CR-UI07 remote-{voice,whip}-{normal,pressed}-B | **採用**（オーナー決定。「ラクダはボタン大きいのがいい」に合う版） | 720×240（3:1）。4枚とも同じ筐体で、ボタンだけが違う（x=205 から右は4枚で画素が一致）。ボタンは中心 (102,118)・直径約180（高さの75%）。右の 32px に縁とネジ、その間は無地の黒いゴム。押下は面が暗く沈み、周りに太い影の輪 | `assets/ui/camel_race/ui/remote-{voice,whip}-{normal,pressed}.png`（各720×240） |

- ゲーム用は Codex の正寸の候補そのもの（こちらでは加工していない）。Codex 側の加工は `generation.json` の記録どおり。
  - リモコン: 原画 2172×724 を均一に 720×240 へ縮小。声の押下・ムチの2枚は、ボタンの楕円の内側だけを声の通常の筐体に重ねた。
  - 道: 原画 2172×724 を 640×152 に縮め（縦横の比率は変わる）、左右反転した写しを右に並べた。
- WebP は `build_images.py` の `encode()`（可逆と非可逆 q90 の小さい方）。
- 置き方:
  - 距離板（`camel-race.js` の `drawMarkers`・`MARKER_ART`）: 奥の柵の根元（y=397）に 0.36 倍で立てる（板の幅は約52px で、コードで描いていた板と同じくらい）。無地の中央に数字を 15px で書く。根元の右下の短い影は今のまま。
  - 道（`groundTiles`）: 半分の 640×76 にして、走路の砂と同じく横に流すタイルにした。走路と道の間は手前の柵が分ける。轍は車輪の高さを通る。
  - リモコン（`camel-race.css` の `cr-remote`）: 操作ボタンを `border-image` の九分割にした。
    - 左 205px（ボタン）と右 32px（縁とネジ）は縦横比を保ち、間の無地だけを横に伸ばす。そのためボタンの高さを `--rh` に固定し、左右の幅を高さから決める。
    - SVG の記号は隠す。絵のボタンの上に透明な丸を重ね、声の合図の光る輪をそこに出す。
    - 押下（声は押した瞬間・ムチは押している間）は押下の絵に替える。声には押した瞬間だけ `held` を付けるようにした（キーの Space でも沈む）。
    - 前は枠の色で示していた状態（声の合図＝金・スパート＝橙・ムチ＝朱・息が少ない＝黄・息が空＝点滅）は、絵の縁の細い線で示す。
  - どれも読めなければ今の描画に戻る。距離板と道は画面の `data-marker`・`data-road`（`sprites`／`canvas`）で切り替わる。リモコンは4枚そろって読めた時だけ付くクラス `cr-remote` で切り替わる。
- これで #3217 の部品はすべて採用・組み込み済み。

| ゲーム用（`assets/ui/camel_race/`） | 寸法 | SHA-256 |
|---|---|---|
| `world/marker-board.png` | 160×240 | `2f3852c9060c1d68c6fc3216cc402ee66c1874c1570c4fa9e0354752ed486d2d` |
| `world/ground-road.png` | 1280×152 | `aeb26826608e1cb42d6c0e3270724b417c3b7be72eab7113485a86a6e8548939` |
| `ui/remote-voice-normal.png` | 720×240 | `cc98218a9a551adf2cb23329a839f56edcf6b1f1151c7427ec86bd2a686cbb57` |
| `ui/remote-voice-pressed.png` | 720×240 | `1149e10d0628c6873405f7b1ac97bfea51716309112170b5a2447a75ab317cd4` |
| `ui/remote-whip-normal.png` | 720×240 | `7c7c9f79f51c8885d9bcb3d9263bebf16563fdb4650a390d314781363cf3e583` |
| `ui/remote-whip-pressed.png` | 720×240 | `26dc919bbb9269f53f76f870e260891bf37e92046519429df1b9616cb8f91177` |

原画の SHA-256 は [world/SHA256SUMS-B.txt](world/SHA256SUMS-B.txt)（距離板の原画は [world/generation.json](world/generation.json)）。

## 届いた後（Claude の作業）

1. 原画の SHA-256・寸法・アルファを確かめ、部品ごとに選ぶ（理由をこのファイルに追記）。CR-WD04 は左右のつなぎ目を、CR-WD05 は車輪の位置を測る。
2. 縮小だけで `assets/ui/camel_race/world/` へ置き、WebP を `remake/img/ui/camel_race/world/` に作る（Git LFS）。
3. `remake/js/minigames/camel-race.js` の描画を、絵が読めた時だけ絵に替える（読めなければ今の描画）。2026-11-11 までに全部品が済んだ: 砂煙・門の柱と字・旗の柱・紋章・手描きの字・走路の砂と道・遊び方の絵・並走車・VS・メダル・横木・距離板・リモコン（操作ボタンの枠を横だけ伸ばす九分割）。
4. PC（1280×720）とスマホ横（844×390）で、スタート・中盤・スパート・ゴールを目視し、`node remake/test/browser/ch4_camel_race.mjs` を通す。
