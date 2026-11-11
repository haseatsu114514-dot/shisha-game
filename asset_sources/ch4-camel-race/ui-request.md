# CAMEL RACE のUI素材 ── Codex への依頼（2026-11-02・CR08）

オーナー「UIとかがクロード臭いから生成したい」（2026-11-02）。同日「UIがまだクロードで作ったゲーム感あるから専用に作りたい生成で」で、#2422 の画面（ムチを押し続ける操作・速度計・ファーリスの声・はじめの吹き出し）に合わせて一覧を更新し、決まった英語の文字（PERFECT・GO! など）の手描きの字も足した（CR-UI12〜14）。

今のレース画面のUI（#2384）は、CSSのグラデーション・半透明の板・丸い錠剤形・SVGの記号で組んでいて、どのゲームにもある「AIが作った画面」に見える。そこで**枠・札・ボタン・メダル・遊び方の絵を手で描いた素材に置き換える**。数字・名前・ゲージの量・判定の文字は今までどおりコードが描く（素材に焼き込まない）。

Claude は画像を生成しない。下の「Codex へ渡す文」をそのまま渡して生成してもらい、原画をこのフォルダの `ui/originals/` に置いて push してもらう（ギガファイル便でも可。その場合は SHA-256 を添える）。届いたら Claude が選び、`border-image`（九分割）と背景画像で組み込む。届くまでは今のCSSのまま動く。

## 方針（なぜこの見た目か）

- **プレイヤーは調教師の車の中にいる。** ボタンは調教師が握るリモコンの実物のボタン、ゲージと時計は SUV の計器板、順位はレース場の掲示板の札、遊び方とリザルトは出走表（レース・プログラム）の紙。画面の部品すべてに「この場所にある物」という理由を持たせる。
- **画風はゲームの背景・ラクダの絵と同じ手。** 日本のピクセルペインター調のノベルゲーム。光は背景の絵と同じ左上の朝日。影は形のはっきりした2〜3段で、エアブラシのぼかしをしない。
- **AIっぽさを避ける。** グラデーションの光沢・発光・ネオン・すりガラス・プラスチックの立体ボタン・左右対称の過剰な装飾・意味のない宝石や歯車を描かない（`docs/prompts/ai_naturalness_guide.md` の UI の項）。素材は「使い込まれた本物の物」の質感（日に焼けた木・くすんだ真鍮・黒いゴム・クリーム色の紙・赤い朱肉）。
- **文字・数字を描かない。** 擬似文字も含めて一切なし。コードが数字を載せる場所は、模様のない平らな面にしておく。**例外は CR-UI14 の決まった英語の言葉だけ**（PERFECT・GOOD・MISS・GO!・3・2・1・LAST SPURT・GOAL・CAMEL RACE）。いま画面のフォントで出している大きな字を、ペンキで手描きした看板の字に置き換える。綴りが一字でも違う案は使わない。

## 一覧

保存先は `assets/ui/camel_race/ui/`（採用後に Claude が置く）。原画は `asset_sources/ch4-camel-race/ui/originals/`。すべて**透過PNG（実際のアルファ）**、物の外に影を焼き込まない（影はコードで付ける）。

| ID | ファイル名 | サイズ | 九分割の縁 | 何に使うか | 中身 |
|---|---|---|---|---|---|
| CR-UI01 | `rank-plate.png` | 512×160 | 左右48px・上下40px | 見出しの順位の札（4枚） | 日に焼けた白っぽい木の小さな掲示板の札。左端に縦長の溝（毛色の帯をコードが入れる）、その右に丸い窪み（順位の丸を置く）。四隅に小さな真鍮の釘。中央は無地 |
| CR-UI02 | `rank-plate-player.png` | 512×160 | 同上 | 自分の札 | CR-UI01 と同じ形・同じ寸法で、縁に細い真鍮の帯を回した版 |
| CR-UI03 | `medal-{gold,silver,bronze,plain}.png` | 各256×256 | ─ | 順位の丸（小さく）とリザルトのメダル（大きく） | 打ち出しの円いメダル。中央にラクダの横顔を浅く浮き彫り、その外に数字を置ける平らな輪。金・銀・銅・くすんだ鉄の4枚。紐・リボンなし |
| CR-UI04 | `dash-panel.png` | 640×320 | 上下左右56px | 左上の板（題名・時計・速度計 km/h） | SUV の計器板の一部。黒い使い込んだ樹脂の面を、くすんだ真鍮の細い縁が囲む。四隅に小さなネジ。中央は無地の黒（時計と速度の数字をコードが白で描く） |
| CR-UI05 | `gauge-frame.png` / `gauge-fill.png` | 800×96 / 800×64 | 左右48px | スタミナのゲージと速度計の帯 | 枠は真鍮の縁の細長い窓（中は空の暗い溝）。中身は横に伸ばせる液体の帯（明るい緑。橙・赤・水色はコードの色替え）。中身は左右の端まで同じ模様 |
| CR-UI06 | `track-rail.png` / `finish-post.png` | 1600×96 / 128×160 | 左右64px | 上の進み具合のバー / 右端のゴール | バーは日に焼けた木の細い横木に、白いペンキが少し剥げた跡。目盛りはコードが描くので無地。ゴールは白黒の市松の小旗が付いた細い柱 |
| CR-UI07 | `remote-voice.png` / `remote-whip.png`（各 normal と pressed の2枚） | 各960×240 | 左右120px・上下60px（**2026-11-11 採用の remotes-A は左160px**・右120px・上下60px。ムチは押しボタンの窪み・仕切り・右の窓の縁が左から約150pxまであり、120pxに潰すと形が変わるので、コードの九分割の左を160にした。声もそろえて160。下の「採用の記録」。**ボタンを大きくする改訂版の依頼は残す**: 左240px・右60px で横だけ伸ばす。ボタンの直径は高さの約75%。4枚とも同じ筐体。英文は [world-request.md](world-request.md) の CR-UI07 改訂版） | 下の2つの大きなボタン（左＝声、右＝ムチ。ムチは押し続ける） | はじめが借りた調教師のリモコンの黒いゴムの筐体に埋まった大きな押しボタン。声は金色のボタンでスピーカーの網目、ムチは赤橙のボタンにしなったムチの刻印（記号の形だけ・文字なし）。ボタンは左側に寄せ、右側は無地の黒い筐体（説明とゲージをコードが描く）。pressed はボタンが深く沈み、縁の影が浅い（ムチは押している間ずっとこの絵） |
| CR-UI08 | `program-card.png` | 1280×800 | 上下左右96px | 遊び方とリザルトのカード | クリーム色の出走表の紙を、日に焼けた木の板に真鍮の角金具で留めたもの。紙の縁に細い二重線。中央は無地の紙（文字はコード） |
| CR-UI09 | `button-primary.png` / `button-secondary.png` | 各600×160 | 左右64px・上下48px | カードのボタン（もう一度・次へ／終える・とばす） | 主は金色の真鍮の札、副は木の札に真鍮の縁。どちらも中央は無地 |
| CR-UI10 | `stamp-{s,a,b,c}.png` | 各256×256 | ─ | リザルトの評価 | 審判の朱肉の判子を紙に押した跡（角の丸い四角、少しかすれて傾く）。S は朱、A は橙、B は藍、C は灰のインク。中は無地（文字はコード） |
| CR-UI11 | `howto-camel.png` / `howto-voice.png` / `howto-whip.png` | 各640×480 | ─ | 遊び方の3ページの絵 | 1: 金の幕（★）を掛け、背にロボット騎手を乗せて走るラクダ。2: SUV の後ろの窓から身を乗り出し、借りたリモコンに口を寄せて叫ぶはじめ（運転席のハリールはハンドルを握るだけ）。3: リモコンのボタンを押し込むはじめの手と、腕を回してムチを振るロボット騎手。背景は砂と空だけで、外側は透過 |
| CR-UI12 | `call-plate.png` | 720×160 | 左右160px・上下48px | 上の中央の「ファーリスの声」 | 車の無線機の細長い前面。黒い樹脂に真鍮の縁、左端に丸い窓（顔のアイコンをコードが入れる）と、その右に細かいスピーカーの網目の帯。中央から右は無地（台詞はコード） |
| CR-UI13 | `balloon.png` | 384×192 | 上下左右48px | はじめの吹き出し（「ハイッ！」「いけっ！」） | クリーム色の紙に墨の手描きの線で描いた吹き出し。下の左寄りに短い尻尾。線は少し揺れて太さが変わる。中は無地 |
| CR-UI14 | `word-{perfect,good,miss,go,3,2,1,last-spurt,goal,title}.png` | 長辺1024以内・透過 | ─ | 判定・カウントダウン・バナー・題名の大きな字 | ペンキで手描きした看板の字（英字と数字のみ）。PERFECT は金に濃い茶の縁、GOOD は水色、MISS は灰色がかった赤、GO! と 3・2・1 は白にくっきりした影、LAST SPURT は朱、GOAL は金、題名 CAMEL RACE は砂色に藍の縁。字だけを描き、外は透過。**綴りが違う案は不採用** |

## Codex へ渡す文（コピペ用）

```
ラクダレース（第4章ドバイの任意ミニゲーム・PR #2304/#2384/#2422）のUI素材を作ってください。
今のUIはCSSのグラデーションと半透明の板とフォントの字で、AIが作った画面に見えるので、手で描いた素材に置き換えます。
数字・名前・ゲージの量・台詞はゲームのコードが描きます。CR-UI14 の決まった英語の字を除き、素材には文字・数字・擬似文字・ロゴ・透かしを一切描かないでください。
操作: 左のボタン＝声（輪が重なる瞬間に押す）、右のボタン＝ムチ（押し続けている間だけ効く）。リモコンを持っているのは、SUV の後ろの窓から身を乗り出すはじめ（運転席のハリールはハンドルを握るだけ）。

【共通の画風（各画像の指示の先頭にそのまま付ける）】
STYLE: UI parts for a Japanese pixel-painterly visual novel minigame set at a desert camel racetrack in Dubai at sunrise. Paint them as real, used physical objects with honest materials: sun-bleached wood, dull worn brass, black rubber and matte plastic, cream paper, red stamp ink. Same painter's hand and texture as the game's racetrack background (bg_dubai_camel_track_morning) and camel sprites: fine painterly pixel texture, confident dark outlines slightly heavier on the outer silhouette, flat local colors with two to three clearly shaped shadow steps, light from the upper left. Palette: sand #e2c48c, sun-bleached cream #f4ead6, brass #c9963a, deep indigo #1c2236, ink #1a110a, accent amber #e08a2c. NO glossy gradients, NO glow or bloom, NO neon, NO glassmorphism or frosted glass, NO plastic bevel-and-emboss, NO airbrush, NO excessive symmetric ornament, NO gems, gears, ribbons, lace or flowers. Never draw any text, letters, digits, pseudo-writing, logos or watermark. Leave the areas where the game prints numbers and labels plain and flat.
FORMAT: flat, front-facing, no perspective. Transparent background with real alpha. No drop shadow outside the object (the game adds shadows). The object fills the canvas to within about 2% of the edges.
NINE-SLICE: for the parts marked nine-slice, all decoration (screws, corner fittings, border lines) stays inside the stated border band; the straight edges are perfectly parallel to the canvas edges; everything inside the band is plain, even texture that can be stretched without visible repetition.

【作るもの】（ファイル名・サイズ・九分割の縁・中身）
CR-UI01 rank-plate.png 512x160 nine-slice（左右48px・上下40px）: a small sun-bleached white wooden plate from a racecourse results board. A narrow vertical groove at the left end (the game paints a colored stripe in it), a shallow round recess next to it (the game places the rank medal there), tiny brass nails in the four corners, plain wood in the middle.
CR-UI02 rank-plate-player.png 512x160 nine-slice（同じ）: exactly the same plate and size as CR-UI01, with a thin dull brass band around the edge.
CR-UI03 medal-gold.png / medal-silver.png / medal-bronze.png / medal-plain.png 各256x256: a struck round racing medal, a camel head in shallow relief at the center, a flat plain ring around it where the game prints the rank number. Gold, silver, bronze, and dull iron. No ribbon, no string.
CR-UI04 dash-panel.png 640x320 nine-slice（上下左右56px）: a piece of an SUV dashboard instrument panel: worn black matte plastic face framed by a thin dull brass bezel, tiny screws in the corners, the center plain black (the game prints the race clock and the km/h speed in white there).
CR-UI05 gauge-frame.png 800x96 nine-slice（左右48px）: a long narrow gauge window with a thin brass bezel, the inside an empty dark channel. gauge-fill.png 800x64: a stretchable strip of bright green liquid that fills the channel, the same pattern from end to end (the game recolors it amber, red and light blue; it is used for stamina and for the speed bar).
CR-UI06 track-rail.png 1600x96 nine-slice（左右64px）: a thin sun-bleached wooden rail with white paint partly worn off, no tick marks (the game draws them). finish-post.png 128x160: a thin post with a small black-and-white checkered flag.
（2026-11-11 改訂。次の行は古い指定で、ボタンが小さすぎた。Codex には world-request.md の CR-UI07 改訂版を渡す）CR-UI07 remote-voice-normal.png / remote-voice-pressed.png / remote-whip-normal.png / remote-whip-pressed.png 各960x240 nine-slice（左右120px・上下60px）: a large push button set into the black rubber housing of a camel trainer's handheld remote. Voice: a gold button with a small speaker-grille pattern. Whip: a red-amber button with an embossed curved riding-whip symbol (symbol only, no letters); the player holds it down. The button sits in the left part; the right part is plain black housing (the game prints the label and the gauge there). Pressed: the button sunk deep in, with a shallower edge shadow. Keep the button position identical between normal and pressed.
CR-UI08 program-card.png 1280x800 nine-slice（上下左右96px）: a cream race-program sheet pinned to a sun-bleached wooden board with brass corner fittings, a thin double rule near the paper edge, the center plain paper.
CR-UI09 button-primary.png / button-secondary.png 各600x160 nine-slice（左右64px・上下48px）: primary is a dull gold brass tag; secondary is a wooden tag with a thin brass edge. Plain centers.
CR-UI10 stamp-s.png / stamp-a.png / stamp-b.png / stamp-c.png 各256x256: the mark of a racing judge's rubber stamp pressed on paper, a rounded square, slightly faded and tilted. Inks: S vermilion, A amber, B indigo, C grey. Plain inside (the game prints the grade letter).
CR-UI11 howto-camel.png / howto-voice.png / howto-whip.png 各640x480: small spot illustrations for the three how-to pages, transparent outside a soft sand-and-sky vignette. 1: a racing camel wearing a gold saddle blanket with a red star, running with a small box-shaped robot jockey on its back. 2: Hajime (attach assets/sprites/characters/hajime/chr_hajime_normal.png: black baseball cap, black zip hoodie; keep his face and age) leaning out of the rear side window of a white SUV and shouting into a small black key-fob remote; the driver (56-year-old Emirati man, white kandura, red-and-white ghutra, see assets/sprites/characters/rashid/chr_rashid_normal.png) keeps both hands on the steering wheel. 3: Hajime's thumb pressing the remote's button hard, and the robot jockey's arm spinning a short soft whip as the camel surges forward.
CR-UI12 call-plate.png 720x160 nine-slice（左右160px・上下48px）: the long front face of an in-car radio: black matte plastic with a thin brass bezel, a round recessed window at the left end (the game puts a face icon in it) followed by a narrow strip of fine speaker grille; the rest plain (the game prints the line).
CR-UI13 balloon.png 384x192 nine-slice（上下左右48px）: a speech balloon drawn with an ink brush on cream paper, a short tail at the lower left, the line slightly wobbly with varying thickness, plain inside.
CR-UI14 word-perfect.png / word-good.png / word-miss.png / word-go.png / word-3.png / word-2.png / word-1.png / word-last-spurt.png / word-goal.png / word-title.png（長辺1024以内）: hand-painted sign-writer lettering of exactly these words, nothing else on the canvas, transparent outside the letters: "PERFECT" (gold with a dark brown outline), "GOOD" (light blue with a dark outline), "MISS" (greyish red), "GO!", "3", "2", "1" (white with a crisp dark drop shadow painted as part of the letters), "LAST SPURT" (vermilion), "GOAL" (gold), "CAMEL RACE" (sand with a deep indigo outline). Bold, slightly irregular brush strokes like paint on a racecourse board; not a computer font, no gradients, no glow. Every letter must be spelled exactly as written.

【参照】画風は assets/backgrounds/bg_dubai_camel_track_morning.png と assets/ui/camel_race/camel_1.png、jockey.png、suv.png（添付できれば添付）。はじめは assets/sprites/characters/hajime/chr_hajime_normal.png、ハリールは assets/sprites/characters/rashid/chr_rashid_normal.png。
【渡し方】原画をそのまま asset_sources/ch4-camel-race/ui/originals/ に置き、生成の指示と日付を asset_sources/ch4-camel-race/ui/generation.json に書いて push。各ファイルの SHA-256 も添えてください。候補が複数ある部品は -A/-B を付けて全部ください。
```

## 届いた後（Claude の作業）

1. 原画のSHA-256と寸法・アルファを確かめ、各部品を選ぶ（理由はこのファイルに追記）。
2. 縮小だけで `assets/ui/camel_race/ui/` へ置き、WebP を `remake/img/ui/camel_race/ui/` に作る。
3. `remake/css/camel-race.css` の該当部分を `border-image`（九分割）と背景画像に置き換える。数字・名前・ゲージの量・台詞は今のままコードで描く。CR-UI14 の字は判定・カウントダウン・バナー・題名の文字を画像に替え（読み上げ用の文字は残す）、Canvas の吹き出しは CR-UI13 を九分割で描く。絵が読めないときは今のCSSに戻す。
4. PC（1280×720）とスマホ横（844×390）で、遊び方・レース・スパート・リザルトを目視し、`node remake/test/browser/ch4_camel_race.mjs` を通す。

## 採用の記録

### 2026-11-11 CR-UI07 リモコン（remotes-A の4枚を九分割の素材に整えて採用・#3217）

`3217-remotes-A-raw.zip`（Codex）。同梱の生成記録（リポジトリでは `world/generation-remotes-raw-A.json`）の SHA-256 と原画4枚がすべて一致した。Codex 自身は「原画は 3:1 で 960×240（4:1）にならない・ムチの飾りが左 120px を超える」として正寸の候補を出していない（加工もしていない）。見た目（黒いゴムの筐体・左に金のスピーカーのボタン／赤橙のムチのボタン・右は無地）はよいので、2026-11-11 の依頼で、この2点を加工とコードで吸収して採用した。

同じ日に一度は不合格とし（ボタンが小さい・声とムチで筐体が別物・押下の差が見えない。[world-request.md](world-request.md) の採用の記録）、ボタンを大きくした改訂版を依頼している。その依頼は残し、届いたら差し替えを判断する。

- **比率**: 筐体だけを切り出すと声 3.91:1・ムチ 3.58:1。高さ 240 へ均一に縮め、無地の中央だけを横に伸ばして（声 1.03 倍・ムチ 1.17 倍）幅 960 にした。ボタン・ねじ・角の形は変えていない。
- **左の飾り**: ムチは押しボタンの窪み・仕切り・右の窓の縁が左から約 150px まである（声はボタンの影と左の明るい面が約 126px まで）。120px に潰さず、九分割の左を **160px** にした（声もそろえる）。上下は **60px**（ムチの太い縁と窓の内側の縁は上下とも約 57px 以内）、右は **120px**（ねじと縁は約 40px 以内）。
- **正寸の作り方**（各ファイルの倍率・切り出し範囲・SHA-256 は `ui/generation.json`）: アルファ 128 以上を筐体として、外を完全に透明・内側を不透明にした（原画の内側はアルファ 252〜253、外に 1〜15 の薄いもやがあった）。筐体の外接で切り出し、高さ 240 へ均一に縮小（声 545px・ムチ 607px → 240。通常と押下で同じ倍率）。左 160・右 120 はその倍率のまま、間だけ横に伸ばす。3つの部分は原画の連続した座標から標本化したので、継ぎ目に段差はない。通常と押下で筐体の位置は一致（縁の位置合わせでずれ 0px）。押下のボタンの面は沈んだ分だけ 2〜4px 下がる。色の加工はしていない。
- **WebP**: 手描きの字と同じく `remake/tools/build_images.py` の `encode`（可逆と q90 の小さいほう）で作り、4枚とも非可逆 q90（17〜24KB）。透明な所は変わらない。
- **コード**（`camel-race.js`・`camel-race.css`）: 通常と押下の2枚がそろって読めた時だけ、`.camel-game` に `cr-remote-voice`／`cr-remote-whip` を付け、ボタンを `border-image` の九分割で描く（片方だけでは使わない。押した瞬間に絵が消えるため）。帯の幅は高さから決め（左＝高さ×2/3・右＝高さ/2・上下＝高さ/4）、ボタンを丸いまま保つ。ラベル・調子・スタミナ・キーは今までどおりコードが右の無地に描く。ムチは押している間ずっと押下の絵、声は指か Space を押している間（離してから 0.09 秒まで）押下の絵。声の合図はボタンのまわりの金の輪、ムチの間・スパート・競り合いは筐体の形に沿う光。9枚の継ぎ目が端数の画素に来ると後ろの砂色が細い線で透けたので、筐体の内側を筐体の色で裏打ちした。絵が読めなければ今までの CSS のボタンのまま。
- **目視**（PC 1280×720・スマホ横 844×390）: 文字は右の無地に収まり、継ぎ目・欠け・透けはない。ただし、**押すボタンは画面で直径約 25px（PC）・約 19px（スマホ横）と小さく**、通常と押下の差もこの大きさでは小さい（ムチは押している間の赤い光で分かる）。**声（藍・細い縁）とムチ（茶・太い縁と仕切り）で筐体の作りが違う。** どちらも絵そのものの性質で、加工では直していない。
- 比較図: `world/review/remotes-A-comparison.jpg`（正寸の4枚と九分割の線・左端の2倍・ゲームの画面・絵が無い時の CSS のボタン）。

| 原画（`ui/originals/`） | 寸法 | SHA-256 |
|---|---|---|
| `remote-voice-normal-raw-A.png` | 2172×724 | `d2224e4dd06d9cfe092af3cc0c28d3f68bc0abe4f9ebcc10362dd00519d29510` |
| `remote-voice-pressed-raw-A.png` | 2172×724 | `a4849ad9c5c627e8944a1a5432b2288bee1ed56abdfc81440804f1a7ebf625b8` |
| `remote-whip-normal-raw-A.png` | 2172×724 | `a522b7497ed3f17e144daec6ae4d25f0a11ea7afaba8ac8bee312cfb5468bb38` |
| `remote-whip-pressed-raw-A.png` | 2172×724 | `b08c92630a95f42682fb3287cd72aecea03ed1f3f15da65a37e9d2ff0ec6162a` |
