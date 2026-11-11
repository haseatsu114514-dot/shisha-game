# CAMEL RACE のレース画面の絵 ── Codex への依頼（2026-11-11・CR23〜CR25）

Issue: [#3217](https://github.com/haseatsu114514-dot/shisha-game/issues/3217)（同じ依頼文を載せてある）。

オーナー「今でもそれなりにできてはいるけどなんか面白さに欠けるし安っぽく見える」「UIや見た目を整えて、画像生成したい場合はイシューからコーデックスへ依頼を」（2026-11-11）。

遊びの側（群れで走る・風よけ・競り合い）とカメラ・HUD の統一は、コードで直した（[docs/spec/camel_race.md](../../docs/spec/camel_race.md) §10）。
残る「安っぽさ」は、**背景・ラクダ・車が絵なのに、その上に載る物がコードで描いた図形のまま**という落差から来ている。

| いまコードで描いている物 | どう見えるか | この依頼 |
|---|---|---|
| スタートとゴールの門 | 木の柱と布の幕を四角と三角で描いた図形。背景の絵の隣で浮く | CR-WD01 |
| 100mごとの距離板 | 四角3枚 | CR-WD02 |
| 走路の砂・車の道 | 乱数で打った点と線のタイル。広い面積が単調 | CR-WD04（走路の砂は**2026-11-11 採用・組み込み済み**。道は再依頼） |
| 砂煙 | 丸いぼかしの円 | CR-WD03（**2026-11-11 採用・組み込み済み**） |
| 下の2つの操作ボタン | CSS の黒い角丸に SVG の記号 | CR-UI07（[ui-request.md](ui-request.md)。未生成） |
| GO!・3・2・1・LAST SPURT・GOAL・GOOD・MISS | 画面の書体に縁取り（PERFECT だけ手描きの字） | CR-UI14 の残り9語（**2026-11-11 採用・組み込み済み**） |
| 2〜4位のメダル | CSS の円（1位だけ絵） | CR-UI03 の銀・銅・鉄（同上。未生成） |
| 進み具合の横木 | CSS の木の色 | CR-UI06 track-rail（同上。未生成） |
| 競り合いの「VS」 | 画面の書体 | CR-WD09（START・FINISH は**採用済み**。VS は不合格で再依頼） |
| 大会を選ぶ札 | 文字だけの札 | CR-WD08（**2026-11-11 採用・組み込み済み**） |
| 並走する車は自分の1台だけ | 実際のレースは調教師の車が何台も並走する。寂しい | CR-WD05 |

Claude は画像を生成しない。下の「Codex へ渡す文」をそのまま渡す。届くまでは今のコードの描画のまま動く。

## 一覧

保存先（採用後）は `assets/ui/camel_race/world/`、WebP は `remake/img/ui/camel_race/world/`。原画は `asset_sources/ch4-camel-race/world/originals/`。
すべて**透過PNG（実際のアルファ）**。物の外に影を焼き込まない（影はコードで付ける）。文字・数字・擬似文字・ロゴ・透かしなし（CR-WD09 の決まった語だけ例外）。

| 優先 | ID | ファイル名 | サイズ | 何に使うか | 中身 |
|---|---|---|---|---|---|
| A | CR-WD01 | `post-start-near.png` / `post-start-far.png` / `post-finish-near.png` / `post-finish-far.png` | 手前 480×800・奥 240×400（同じ縦横比） | スタートとゴールの柱（2026-11-11 改訂。1枚の門をやめ、**手前の柵の柱と奥の柵の柱を別の絵**にした）。コードが手前の柱を手前の柵に、奥の柱を奥の柵に、**同じ横位置**で立てる。ゴールの線は地面にコードで引く | 1本ずつの柱。日に焼けた木の柱に、縄の縛り・真鍮の頭と足の金具・赤白の布の巻き（2026-11-11 の不合格の門の案と同じ質感）。柱の上の短い腕から、**こちらを向いた**布の幕が柱の左へ垂れる（幕の中央は**無地**。字はコードか CR-WD09）。柱の上に小さな三角の旗。手前は太く高く幕が大きい、奥は細く低く幕が小さい。スタートは深い緑、ゴールは朱で上下の縁が白黒の市松（旗も市松）。柱の根元がキャンバスの下端、柱の中心はキャンバスの右から 1/4 あたり。4枚で描き方をそろえる |
| A | CR-WD02 | `marker-board.png` | 160×240 | 100mごとの距離板（奥の柵の外） | 細い木の杭に、上の縁が朱色のクリーム色の板。板の中央は無地（数字はコード）。杭の根元がキャンバスの下端 |
| A | CR-WD04 | `ground-track.png` / `ground-road.png` | 1280×452 / 1280×152 | 走路の砂と、車が走る道（横に流すタイル） | 走路: ならした砂。蹄の跡がまばらに続き、手前ほど砂粒が大きい。上の辺（奥）は明るく霞み、下の辺（手前）は少し濃い。道: 踏み固めた砂にタイヤの轍が2本。**左右の端がつながる**（横にタイルして継ぎ目が見えない）。影・物・人なし |
| B | CR-WD03 | `dust-1.png` / `dust-2.png` / `dust-3.png` | 各 256×256 | 蹄と車輪の砂煙 | 輪郭のはっきりした2〜3段の塊で描いた砂煙（小・中・大。左へ流れる形）。エアブラシのぼかしにしない。外は透過 |
| B | CR-WD05 | `suv-rival-a.png` / `suv-rival-b.png` | 各 720×360 | 奥の柵の向こうを並走する、ほかの調教師の車 | いまの `assets/ui/camel_race/suv.png` と同じ寸法・同じ向き（右）・同じ車輪の位置（後 153,282・前 583,282）の四角い SUV。a は銀がかった灰、b は砂色。窓は濃い色で中の人は描かない。屋根のアンテナは1本。実在の車種の顔・エンブレムにしない |
| B | CR-WD07 | `howto-tactics.png` | 640×480 | 遊び方の絵（風よけと競り合い） | CR-UI11 と同じ描き方の小さな絵。青い幕のラクダのすぐ後ろに、金の幕（赤い★）のハビーバが付く。前のラクダで割れた風の線が、後ろのラクダの上を流れる。背景は砂と空だけで、外側は透過 |
| B | CR-WD08 | `cup-practice.png` / `cup-rookie.png` / `cup-standard.png` / `cup-expert.png` | 各 256×256 | 大会を選ぶ札の紋章 | 打ち出しの円いブリキの札。練習＝ラクダの足跡、入門＝若いラクダの横顔と星1つ、標準＝走るラクダと星2つ、上級＝ラクダの横顔に月桂の輪と星3つ。練習は鉄、入門は銅、標準は銀、上級は金。文字なし |
| B | CR-WD09 | `word-vs.png` / `word-start.png` / `word-finish.png` | 長辺1024以内 | 競り合いの「VS」、門の幕の字 | CR-UI14 と同じ、ペンキで手描きした看板の字。VS は金に濃い茶の縁、START と FINISH は白にくっきりした濃い影。**綴りが違う案は不採用** |
| C | CR-WD06 | `fg-flagpole.png` | 256×720 | 手前を速く流れる柱（速さの手がかり） | 白い細い柱の上に、金・朱・クリームの三角旗を3枚つないだ紐。柱の根元がキャンバスの下端 |

未生成のまま残っている CR08 の部品（仕様は [ui-request.md](ui-request.md) のまま）: CR-UI03 `medal-{silver,bronze,plain}.png`、CR-UI06 `track-rail.png`、CR-UI07 `remote-{voice,whip}-{normal,pressed}.png`。優先は CR-UI07 → CR-UI03 → CR-UI06（CR-UI14 の9語は 2026-11-11 に採用済み）。

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
CR-WD02 marker-board.png 160x240: a thin wooden stake holding a small cream board with a racing-red strip along its top edge. The board face is plain (the game prints the distance). The base of the stake touches the bottom edge.
CR-WD04（ground-track は 2026-11-11 採用済み。ground-road だけ再依頼） ground-track.png 1280x452: a horizontally seamless tile of a groomed sand racetrack seen from the side at a low angle: raked sand with sparse lines of camel hoof prints, grains larger toward the bottom (near) edge, the top (far) edge lighter and hazier, the bottom edge slightly darker. Opaque, no objects, no shadows of objects, no people. The left and right edges must match perfectly. ground-road.png 1280x152: a horizontally seamless tile of a packed sand service road with two tire ruts running left to right. Opaque. The left and right edges must match perfectly. For ground-road: the previous attempt came back 1402x1122 with wide white margins above and below the strip and was rejected. Make the canvas itself the thin strip (1280x152, about 8.4:1) and fill the whole canvas with road texture edge to edge; no white, empty or transparent margins.
CR-WD03 dust-1.png / dust-2.png / dust-3.png 各256x256: a puff of desert dust kicked up by hooves, drifting to the left, painted as two to three clearly shaped tone steps (not an airbrushed blur). Small, medium and large.
CR-WD05 suv-rival-a.png / suv-rival-b.png 各720x360: a boxy generic desert SUV, side view facing right, the same size, proportions and wheel positions as the attached suv.png (rear wheel center at 153,282 and front wheel center at 583,282, tire diameter about 130). a: silver-grey body. b: sand-beige body. Dark tinted windows with no people visible. One thin antenna on the roof. Do not copy the grille, lights or badge of any real car model.
CR-WD07 howto-tactics.png 640x480: a small spot illustration in the same style as the attached howto-camel.png, transparent outside a soft sand-and-sky vignette. Two racing camels with small box-shaped robot jockeys: the front camel wears a blue saddle blanket; the rear camel wears a gold saddle blanket with a red star and runs tucked right behind it. Wind lines split around the front camel and flow over the back of the rear camel.
CR-WD08 cup-practice.png / cup-rookie.png / cup-standard.png / cup-expert.png 各256x256: a struck round tin racing badge, shallow relief, no ribbon. practice: dull iron, a single camel hoof print. rookie: bronze, a young camel's head in profile and one star. standard: silver, a running camel and two stars. expert: gold, a camel's head in profile inside a laurel ring and three stars. No letters or digits.
CR-WD09 word-vs.png（START・FINISH は 2026-11-11 採用済み。VS だけ再依頼）（長辺1024以内）: hand-painted sign-writer lettering of exactly these words, nothing else on the canvas, transparent outside the letters: "VS" (gold with a dark brown outline), "START" and "FINISH" (white with a crisp dark drop shadow painted as part of the letters). Bold, slightly irregular brush strokes like paint on a racecourse board; not a computer font, no gradients, no glow. Every letter must be spelled exactly as written. (This is the only item where letters are allowed.) For VS: the previous attempts left a dark rectangular panel and a glow behind the letters and were rejected. Draw ONLY the two letters; nothing behind them (no panel, plate, board, box, glow or vignette). Every pixel outside the letter shapes and their painted outline must be fully transparent (alpha 0).
CR-WD06 fg-flagpole.png 256x720: a thin white pole with a string of three triangular pennants (gold, racing red, cream) at the top. The base of the pole touches the bottom edge.

【まだ作っていない CR08 の部品も、この機会に】仕様と英文は asset_sources/ch4-camel-race/ui-request.md のまま: CR-UI07 remote-voice / remote-whip（normal と pressed）、CR-UI03 medal-silver / medal-bronze / medal-plain、CR-UI06 track-rail（CR-UI14 の9語は 2026-11-11 に採用済み）。

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

## 届いた後（Claude の作業）

1. 原画の SHA-256・寸法・アルファを確かめ、部品ごとに選ぶ（理由をこのファイルに追記）。CR-WD04 は左右のつなぎ目を、CR-WD05 は車輪の位置を測る。
2. 縮小だけで `assets/ui/camel_race/world/` へ置き、WebP を `remake/img/ui/camel_race/world/` に作る（Git LFS）。
3. `remake/js/minigames/camel-race.js` の `drawGates`・`drawMarkers`・`groundTiles` を、絵が読めた時だけ絵に替える（読めなければ今の描画。`drawDust`・門の字・旗の柱・紋章・手描きの字・走路の砂・遊び方の絵は 2026-11-11 に済み）。CR-WD01 は奥の柱を奥の柵、手前の柱を手前の柵に同じ横位置で立てる。CR-WD05 は奥の柵の向こうに、群れと同じ速さで2〜3台を走らせる。
4. PC（1280×720）とスマホ横（844×390）で、スタート・中盤・スパート・ゴールを目視し、`node remake/test/browser/ch4_camel_race.mjs` を通す。
