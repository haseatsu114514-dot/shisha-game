# CAMEL RACE のレース画面の絵 ── Codex への依頼（2026-11-11・CR23〜CR25）

Issue: [#3217](https://github.com/haseatsu114514-dot/shisha-game/issues/3217)（同じ依頼文を載せてある）。

オーナー「今でもそれなりにできてはいるけどなんか面白さに欠けるし安っぽく見える」「UIや見た目を整えて、画像生成したい場合はイシューからコーデックスへ依頼を」（2026-11-11）。

遊びの側（群れで走る・風よけ・競り合い）とカメラ・HUD の統一は、コードで直した（[docs/spec/camel_race.md](../../docs/spec/camel_race.md) §10）。
残る「安っぽさ」は、**背景・ラクダ・車が絵なのに、その上に載る物がコードで描いた図形のまま**という落差から来ている。

| いまコードで描いている物 | どう見えるか | この依頼 |
|---|---|---|
| スタートとゴールの門 | 木の柱と布の幕を四角と三角で描いた図形。背景の絵の隣で浮く | CR-WD01 |
| 100mごとの距離板 | 四角3枚 | CR-WD02 |
| 走路の砂・車の道 | 乱数で打った点と線のタイル。広い面積が単調 | CR-WD04 |
| 砂煙 | 丸いぼかしの円 | CR-WD03 |
| 下の2つの操作ボタン | CSS の黒い角丸に SVG の記号 | CR-UI07（[ui-request.md](ui-request.md)。未生成） |
| GO!・3・2・1・LAST SPURT・GOAL・GOOD・MISS | 画面の書体に縁取り（PERFECT だけ手描きの字） | CR-UI14 の残り9語（同上。未生成） |
| 2〜4位のメダル | CSS の円（1位だけ絵） | CR-UI03 の銀・銅・鉄（同上。未生成） |
| 進み具合の横木 | CSS の木の色 | CR-UI06 track-rail（同上。未生成） |
| 競り合いの「VS」 | 画面の書体 | CR-WD09 |
| 大会を選ぶ札 | 文字だけの札 | CR-WD08 |
| 並走する車は自分の1台だけ | 実際のレースは調教師の車が何台も並走する。寂しい | CR-WD05 |

Claude は画像を生成しない。下の「Codex へ渡す文」をそのまま渡す。届くまでは今のコードの描画のまま動く。

## 一覧

保存先（採用後）は `assets/ui/camel_race/world/`、WebP は `remake/img/ui/camel_race/world/`。原画は `asset_sources/ch4-camel-race/world/originals/`。
すべて**透過PNG（実際のアルファ）**。物の外に影を焼き込まない（影はコードで付ける）。文字・数字・擬似文字・ロゴ・透かしなし（CR-WD09 の決まった語だけ例外）。

| 優先 | ID | ファイル名 | サイズ | 何に使うか | 中身 |
|---|---|---|---|---|---|
| A | CR-WD01 | `gate-start.png` / `gate-finish.png` | 各 480×800 | 走路をまたぐ門（0m とゴール）。手前の柱の根元を手前の柵に、奥の柱の根元を奥の柵に合わせて置く | 日に焼けた木の柱2本（手前が太く高い、奥は細く低く、手前の柱の左上にずれて見える）を上の横木でつなぎ、横木から布の幕を垂らす。幕の中央は**無地**（START／FINISH の字はコードか CR-WD09 が載せる）。スタートは深い緑の幕、ゴールは朱の幕で上下の縁が白黒の市松。柱の上に小さな三角の旗。手前の柱の根元がキャンバスの下端、奥の柱の根元は高さの47%あたり |
| A | CR-WD02 | `marker-board.png` | 160×240 | 100mごとの距離板（奥の柵の外） | 細い木の杭に、上の縁が朱色のクリーム色の板。板の中央は無地（数字はコード）。杭の根元がキャンバスの下端 |
| A | CR-WD04 | `ground-track.png` / `ground-road.png` | 1280×452 / 1280×152 | 走路の砂と、車が走る道（横に流すタイル） | 走路: ならした砂。蹄の跡がまばらに続き、手前ほど砂粒が大きい。上の辺（奥）は明るく霞み、下の辺（手前）は少し濃い。道: 踏み固めた砂にタイヤの轍が2本。**左右の端がつながる**（横にタイルして継ぎ目が見えない）。影・物・人なし |
| B | CR-WD03 | `dust-1.png` / `dust-2.png` / `dust-3.png` | 各 256×256 | 蹄と車輪の砂煙 | 輪郭のはっきりした2〜3段の塊で描いた砂煙（小・中・大。左へ流れる形）。エアブラシのぼかしにしない。外は透過 |
| B | CR-WD05 | `suv-rival-a.png` / `suv-rival-b.png` | 各 720×360 | 奥の柵の向こうを並走する、ほかの調教師の車 | いまの `assets/ui/camel_race/suv.png` と同じ寸法・同じ向き（右）・同じ車輪の位置（後 153,282・前 583,282）の四角い SUV。a は銀がかった灰、b は砂色。窓は濃い色で中の人は描かない。屋根のアンテナは1本。実在の車種の顔・エンブレムにしない |
| B | CR-WD07 | `howto-tactics.png` | 640×480 | 遊び方の絵（風よけと競り合い） | CR-UI11 と同じ描き方の小さな絵。青い幕のラクダのすぐ後ろに、金の幕（赤い★）のハビーバが付く。前のラクダで割れた風の線が、後ろのラクダの上を流れる。背景は砂と空だけで、外側は透過 |
| B | CR-WD08 | `cup-practice.png` / `cup-rookie.png` / `cup-standard.png` / `cup-expert.png` | 各 256×256 | 大会を選ぶ札の紋章 | 打ち出しの円いブリキの札。練習＝ラクダの足跡、入門＝若いラクダの横顔と星1つ、標準＝走るラクダと星2つ、上級＝ラクダの横顔に月桂の輪と星3つ。練習は鉄、入門は銅、標準は銀、上級は金。文字なし |
| B | CR-WD09 | `word-vs.png` / `word-start.png` / `word-finish.png` | 長辺1024以内 | 競り合いの「VS」、門の幕の字 | CR-UI14 と同じ、ペンキで手描きした看板の字。VS は金に濃い茶の縁、START と FINISH は白にくっきりした濃い影。**綴りが違う案は不採用** |
| C | CR-WD06 | `fg-flagpole.png` | 256×720 | 手前を速く流れる柱（速さの手がかり） | 白い細い柱の上に、金・朱・クリームの三角旗を3枚つないだ紐。柱の根元がキャンバスの下端 |

未生成のまま残っている CR08 の部品（仕様は [ui-request.md](ui-request.md) のまま）: CR-UI03 `medal-{silver,bronze,plain}.png`、CR-UI06 `track-rail.png`、CR-UI07 `remote-{voice,whip}-{normal,pressed}.png`、CR-UI14 の9語（GOOD・MISS・GO!・3・2・1・LAST SPURT・GOAL・CAMEL RACE）。優先は CR-UI07 → CR-UI14 → CR-UI03 → CR-UI06。

## Codex へ渡す文（コピペ用）

```
ラクダレース（第4章ドバイの任意ミニゲーム）のレース画面の絵を作ってください。
背景・ラクダ・車は絵なのに、門・距離板・走路の砂・砂煙・操作ボタンがコードで描いた図形のままで、安っぽく見えます。同じ手で描いた絵に置き換えます。
数字・名前・ゲージ・台詞はゲームのコードが描きます。CR-WD09 の決まった英語の字を除き、文字・数字・擬似文字・ロゴ・透かしを一切描かないでください。

【共通の画風（各画像の指示の先頭にそのまま付ける）】
STYLE: Game sprites for a Japanese pixel-painterly visual novel minigame set at a desert camel racetrack in Dubai at sunrise. Same painter's hand and texture as the game's racetrack background (bg_dubai_camel_track_morning) and its camel and SUV sprites: fine painterly pixel texture, confident dark outlines slightly heavier on the outer silhouette, flat local colors with two to three clearly shaped shadow steps, warm low light from the upper left. Honest, used materials: sun-bleached wood, faded cloth, packed sand, dull worn brass. Palette: sand #e2c48c, sun-bleached cream #f4ead6, brass #c9963a, deep indigo #1c2236, ink #1a110a, accent amber #e08a2c, racing red #c8302a, deep green #2f8f6b. NO glossy gradients, NO glow or bloom, NO neon, NO airbrush, NO photo realism, NO smooth 3D render. Never draw any text, letters, digits, pseudo-writing, logos or watermark. No people.
FORMAT: side view as seen from the trackside, flat with no strong perspective. Transparent background with real alpha. No drop shadow or ground shadow outside the object (the game adds shadows). The object fills the canvas to within about 2% of the edges.

【作るもの】（ファイル名・サイズ・中身）
CR-WD01 gate-start.png / gate-finish.png 各480x800: a racetrack gate that spans the track, seen from the trackside at a slight angle. Two sun-bleached wooden posts joined by a top beam: the NEAR post is thick and tall and its base touches the bottom edge of the canvas; the FAR post is thinner and shorter, appears up and to the left of the near post, and its base ends at about 47% of the canvas height. A cloth banner hangs from the top beam facing the viewer; the center of the banner is plain flat cloth (the game prints the word there). Small triangular flags on top of the posts. START: deep green banner. FINISH: racing-red banner with a black-and-white checkered strip along its top and bottom edges, and checkered flags. Keep the same post positions in both files.
CR-WD02 marker-board.png 160x240: a thin wooden stake holding a small cream board with a racing-red strip along its top edge. The board face is plain (the game prints the distance). The base of the stake touches the bottom edge.
CR-WD04 ground-track.png 1280x452: a horizontally seamless tile of a groomed sand racetrack seen from the side at a low angle: raked sand with sparse lines of camel hoof prints, grains larger toward the bottom (near) edge, the top (far) edge lighter and hazier, the bottom edge slightly darker. Opaque, no objects, no shadows of objects, no people. The left and right edges must match perfectly. ground-road.png 1280x152: a horizontally seamless tile of a packed sand service road with two tire ruts running left to right. Opaque. The left and right edges must match perfectly.
CR-WD03 dust-1.png / dust-2.png / dust-3.png 各256x256: a puff of desert dust kicked up by hooves, drifting to the left, painted as two to three clearly shaped tone steps (not an airbrushed blur). Small, medium and large.
CR-WD05 suv-rival-a.png / suv-rival-b.png 各720x360: a boxy generic desert SUV, side view facing right, the same size, proportions and wheel positions as the attached suv.png (rear wheel center at 153,282 and front wheel center at 583,282, tire diameter about 130). a: silver-grey body. b: sand-beige body. Dark tinted windows with no people visible. One thin antenna on the roof. Do not copy the grille, lights or badge of any real car model.
CR-WD07 howto-tactics.png 640x480: a small spot illustration in the same style as the attached howto-camel.png, transparent outside a soft sand-and-sky vignette. Two racing camels with small box-shaped robot jockeys: the front camel wears a blue saddle blanket; the rear camel wears a gold saddle blanket with a red star and runs tucked right behind it. Wind lines split around the front camel and flow over the back of the rear camel.
CR-WD08 cup-practice.png / cup-rookie.png / cup-standard.png / cup-expert.png 各256x256: a struck round tin racing badge, shallow relief, no ribbon. practice: dull iron, a single camel hoof print. rookie: bronze, a young camel's head in profile and one star. standard: silver, a running camel and two stars. expert: gold, a camel's head in profile inside a laurel ring and three stars. No letters or digits.
CR-WD09 word-vs.png / word-start.png / word-finish.png（長辺1024以内）: hand-painted sign-writer lettering of exactly these words, nothing else on the canvas, transparent outside the letters: "VS" (gold with a dark brown outline), "START" and "FINISH" (white with a crisp dark drop shadow painted as part of the letters). Bold, slightly irregular brush strokes like paint on a racecourse board; not a computer font, no gradients, no glow. Every letter must be spelled exactly as written. (This is the only item where letters are allowed.)
CR-WD06 fg-flagpole.png 256x720: a thin white pole with a string of three triangular pennants (gold, racing red, cream) at the top. The base of the pole touches the bottom edge.

【まだ作っていない CR08 の部品も、この機会に】仕様と英文は asset_sources/ch4-camel-race/ui-request.md のまま: CR-UI07 remote-voice / remote-whip（normal と pressed）、CR-UI14 の残り9語、CR-UI03 medal-silver / medal-bronze / medal-plain、CR-UI06 track-rail。

【参照（添付できれば添付。役割を書き添える）】画風と光: assets/backgrounds/bg_dubai_camel_track_morning.png。物の描き込みの密度: assets/ui/camel_race/camel_1.png と suv.png。CR-WD05 の寸法と車輪の位置: suv.png。CR-WD07 の描き方: assets/ui/camel_race/ui/howto-camel.png。CR-WD09 の字: assets/ui/camel_race/ui/word-perfect.png。
【渡し方】原画をそのまま asset_sources/ch4-camel-race/world/originals/ に置き、生成の指示と日付を asset_sources/ch4-camel-race/world/generation.json に書いて push。各ファイルの SHA-256・実寸・アルファの有無を添えてください。候補が複数ある部品は -A/-B を付けて全部ください。生成の決まり（開始前のコピーの確認・寸法とアルファの機械確認・文字を描かない）は Issue #3055 と同じです。
```

## 届いた後（Claude の作業）

1. 原画の SHA-256・寸法・アルファを確かめ、部品ごとに選ぶ（理由をこのファイルに追記）。CR-WD04 は左右のつなぎ目を、CR-WD05 は車輪の位置を測る。
2. 縮小だけで `assets/ui/camel_race/world/` へ置き、WebP を `remake/img/ui/camel_race/world/` に作る（Git LFS）。
3. `remake/js/minigames/camel-race.js` の `drawGates`・`drawMarkers`・`groundTiles`・`drawDust` を、絵が読めた時だけ絵に替える（読めなければ今の描画）。CR-WD05 は奥の柵の向こうに、群れと同じ速さで2〜3台を走らせる。
4. PC（1280×720）とスマホ横（844×390）で、スタート・中盤・スパート・ゴールを目視し、`node remake/test/browser/ch4_camel_race.mjs` を通す。
