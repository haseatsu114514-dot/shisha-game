# CAMEL RACE のUI素材 ── Codex への依頼（2026-11-02・CR08）

オーナー「UIとかがクロード臭いから生成したい」（2026-11-02）。

今のレース画面のUI（#2384）は、CSSのグラデーション・半透明の板・丸い錠剤形・SVGの記号で組んでいて、どのゲームにもある「AIが作った画面」に見える。そこで**枠・札・ボタン・メダル・遊び方の絵を手で描いた素材に置き換える**。数字・名前・ゲージの量・判定の文字は今までどおりコードが描く（素材に焼き込まない）。

Claude は画像を生成しない。下の「Codex へ渡す文」をそのまま渡して生成してもらい、原画をこのフォルダの `ui/originals/` に置いて push してもらう（ギガファイル便でも可。その場合は SHA-256 を添える）。届いたら Claude が選び、`border-image`（九分割）と背景画像で組み込む。届くまでは今のCSSのまま動く。

## 方針（なぜこの見た目か）

- **プレイヤーは調教師の車の中にいる。** ボタンは調教師が握るリモコンの実物のボタン、ゲージと時計は SUV の計器板、順位はレース場の掲示板の札、遊び方とリザルトは出走表（レース・プログラム）の紙。画面の部品すべてに「この場所にある物」という理由を持たせる。
- **画風はゲームの背景・ラクダの絵と同じ手。** 日本のピクセルペインター調のノベルゲーム。光は背景の絵と同じ左上の朝日。影は形のはっきりした2〜3段で、エアブラシのぼかしをしない。
- **AIっぽさを避ける。** グラデーションの光沢・発光・ネオン・すりガラス・プラスチックの立体ボタン・左右対称の過剰な装飾・意味のない宝石や歯車を描かない（`docs/prompts/ai_naturalness_guide.md` の UI の項）。素材は「使い込まれた本物の物」の質感（日に焼けた木・くすんだ真鍮・黒いゴム・クリーム色の紙・赤い朱肉）。
- **文字・数字を描かない。** 擬似文字も含めて一切なし。コードが数字を載せる場所は、模様のない平らな面にしておく。

## 一覧

保存先は `assets/ui/camel_race/ui/`（採用後に Claude が置く）。原画は `asset_sources/ch4-camel-race/ui/originals/`。すべて**透過PNG（実際のアルファ）**、物の外に影を焼き込まない（影はコードで付ける）。

| ID | ファイル名 | サイズ | 九分割の縁 | 何に使うか | 中身 |
|---|---|---|---|---|---|
| CR-UI01 | `rank-plate.png` | 512×160 | 左右48px・上下40px | 見出しの順位の札（4枚） | 日に焼けた白っぽい木の小さな掲示板の札。左端に縦長の溝（毛色の帯をコードが入れる）、その右に丸い窪み（順位の丸を置く）。四隅に小さな真鍮の釘。中央は無地 |
| CR-UI02 | `rank-plate-player.png` | 512×160 | 同上 | 自分の札 | CR-UI01 と同じ形・同じ寸法で、縁に細い真鍮の帯を回した版 |
| CR-UI03 | `medal-{gold,silver,bronze,plain}.png` | 各256×256 | ─ | 順位の丸（小さく）とリザルトのメダル（大きく） | 打ち出しの円いメダル。中央にラクダの横顔を浅く浮き彫り、その外に数字を置ける平らな輪。金・銀・銅・くすんだ鉄の4枚。紐・リボンなし |
| CR-UI04 | `dash-panel.png` | 640×256 | 上下左右56px | 時計と調子・スタミナの板 | SUV の計器板の一部。黒い使い込んだ樹脂の面を、くすんだ真鍮の細い縁が囲む。四隅に小さなネジ。中央は無地の黒（数字をコードが白で描く） |
| CR-UI05 | `gauge-frame.png` / `gauge-fill.png` | 800×96 / 800×64 | 左右48px | スタミナのゲージ | 枠は真鍮の縁の細長い窓（中は空の暗い溝）。中身は横に伸ばせる液体の帯（明るい緑。橙・赤はコードの色替え）。中身は左右の端まで同じ模様 |
| CR-UI06 | `track-rail.png` / `finish-post.png` | 1600×96 / 128×160 | 左右64px | 上の進み具合のバー / 右端のゴール | バーは日に焼けた木の細い横木に、白いペンキが少し剥げた跡。目盛りはコードが描くので無地。ゴールは白黒の市松の小旗が付いた細い柱 |
| CR-UI07 | `remote-voice.png` / `remote-signal.png`（各 normal と pressed の2枚） | 各960×240 | 左右120px・上下60px | 下の2つの大きなボタン | 調教師のリモコンの黒いゴムの筐体に埋まった大きな押しボタン。声は金色のボタンでスピーカーの網目、合図は橙のボタンで稲妻の刻印（記号の形だけ・文字なし）。ボタンは左側に寄せ、右側は無地の黒い筐体（説明とキーをコードが描く）。pressed はボタンが沈み、縁の影が浅い |
| CR-UI08 | `program-card.png` | 1280×800 | 上下左右96px | 遊び方とリザルトのカード | クリーム色の出走表の紙を、日に焼けた木の板に真鍮の角金具で留めたもの。紙の縁に細い二重線。中央は無地の紙（文字はコード） |
| CR-UI09 | `button-primary.png` / `button-secondary.png` | 各600×160 | 左右64px・上下48px | カードのボタン（もう一度・次へ／終える・とばす） | 主は金色の真鍮の札、副は木の札に真鍮の縁。どちらも中央は無地 |
| CR-UI10 | `stamp-{s,a,b,c}.png` | 各256×256 | ─ | リザルトの評価 | 審判の朱肉の判子を紙に押した跡（角の丸い四角、少しかすれて傾く）。S は朱、A は橙、B は藍、C は灰のインク。中は無地（文字はコード） |
| CR-UI11 | `howto-camel.png` / `howto-voice.png` / `howto-signal.png` | 各640×480 | ─ | 遊び方の3ページの絵 | 1: 背にロボット騎手を乗せて一頭で走るラクダ。2: SUV の窓から小さなリモコンに口を寄せて声をかける調教師（ラシード）。3: ロボット騎手の腕がムチを振り、ラクダが加速する瞬間。背景は砂と空だけで、外側は透過 |

## Codex へ渡す文（コピペ用）

```
ラクダレース（第4章ドバイの任意ミニゲーム・PR #2304/#2384）のUI素材を作ってください。
今のUIはCSSのグラデーションと半透明の板で、AIが作った画面に見えるので、手で描いた素材に置き換えます。
数字・名前・ゲージの量・判定の文字はゲームのコードが描きます。素材には文字・数字・擬似文字・ロゴ・透かしを一切描かないでください。

【共通の画風（各画像の指示の先頭にそのまま付ける）】
STYLE: UI parts for a Japanese pixel-painterly visual novel minigame set at a desert camel racetrack in Dubai at sunrise. Paint them as real, used physical objects with honest materials: sun-bleached wood, dull worn brass, black rubber and matte plastic, cream paper, red stamp ink. Same painter's hand and texture as the game's racetrack background (bg_dubai_camel_track_morning) and camel sprites: fine painterly pixel texture, confident dark outlines slightly heavier on the outer silhouette, flat local colors with two to three clearly shaped shadow steps, light from the upper left. Palette: sand #e2c48c, sun-bleached cream #f4ead6, brass #c9963a, deep indigo #1c2236, ink #1a110a, accent amber #e08a2c. NO glossy gradients, NO glow or bloom, NO neon, NO glassmorphism or frosted glass, NO plastic bevel-and-emboss, NO airbrush, NO excessive symmetric ornament, NO gems, gears, ribbons, lace or flowers. Never draw any text, letters, digits, pseudo-writing, logos or watermark. Leave the areas where the game prints numbers and labels plain and flat.
FORMAT: flat, front-facing, no perspective. Transparent background with real alpha. No drop shadow outside the object (the game adds shadows). The object fills the canvas to within about 2% of the edges.
NINE-SLICE: for the parts marked nine-slice, all decoration (screws, corner fittings, border lines) stays inside the stated border band; the straight edges are perfectly parallel to the canvas edges; everything inside the band is plain, even texture that can be stretched without visible repetition.

【作るもの】（ファイル名・サイズ・九分割の縁・中身）
CR-UI01 rank-plate.png 512x160 nine-slice（左右48px・上下40px）: a small sun-bleached white wooden plate from a racecourse results board. A narrow vertical groove at the left end (the game paints a colored stripe in it), a shallow round recess next to it (the game places the rank medal there), tiny brass nails in the four corners, plain wood in the middle.
CR-UI02 rank-plate-player.png 512x160 nine-slice（同じ）: exactly the same plate and size as CR-UI01, with a thin dull brass band around the edge.
CR-UI03 medal-gold.png / medal-silver.png / medal-bronze.png / medal-plain.png 各256x256: a struck round racing medal, a camel head in shallow relief at the center, a flat plain ring around it where the game prints the rank number. Gold, silver, bronze, and dull iron. No ribbon, no string.
CR-UI04 dash-panel.png 640x256 nine-slice（上下左右56px）: a piece of an SUV dashboard instrument panel: worn black matte plastic face framed by a thin dull brass bezel, tiny screws in the corners, the center plain black (the game prints white digits there).
CR-UI05 gauge-frame.png 800x96 nine-slice（左右48px）: a long narrow gauge window with a thin brass bezel, the inside an empty dark channel. gauge-fill.png 800x64: a stretchable strip of bright green liquid that fills the channel, the same pattern from end to end (the game recolors it amber and red).
CR-UI06 track-rail.png 1600x96 nine-slice（左右64px）: a thin sun-bleached wooden rail with white paint partly worn off, no tick marks (the game draws them). finish-post.png 128x160: a thin post with a small black-and-white checkered flag.
CR-UI07 remote-voice-normal.png / remote-voice-pressed.png / remote-signal-normal.png / remote-signal-pressed.png 各960x240 nine-slice（左右120px・上下60px）: a large push button set into the black rubber housing of a camel trainer's handheld remote. Voice: a gold button with a small speaker-grille pattern. Signal: an amber button with a lightning-bolt emboss (symbol only, no letters). The button sits in the left part; the right part is plain black housing (the game prints the label and key there). Pressed: the button sunk in, with a shallower edge shadow. Keep the button position identical between normal and pressed.
CR-UI08 program-card.png 1280x800 nine-slice（上下左右96px）: a cream race-program sheet pinned to a sun-bleached wooden board with brass corner fittings, a thin double rule near the paper edge, the center plain paper.
CR-UI09 button-primary.png / button-secondary.png 各600x160 nine-slice（左右64px・上下48px）: primary is a dull gold brass tag; secondary is a wooden tag with a thin brass edge. Plain centers.
CR-UI10 stamp-s.png / stamp-a.png / stamp-b.png / stamp-c.png 各256x256: the mark of a racing judge's rubber stamp pressed on paper, a rounded square, slightly faded and tilted. Inks: S vermilion, A amber, B indigo, C grey. Plain inside (the game prints the grade letter).
CR-UI11 howto-camel.png / howto-voice.png / howto-signal.png 各640x480: small spot illustrations for the three how-to pages, transparent outside a soft sand-and-sky vignette. 1: a racing camel running alone with a small box-shaped robot jockey on its back. 2: a trainer (56-year-old Emirati man, white kandura, sand-colored vest, red-and-white ghutra, see data/characters.json "rashid") leaning out of a white SUV window and speaking into a small handheld remote. 3: the robot jockey's arm swinging a short soft whip as the camel surges forward.

【参照】画風は assets/backgrounds/bg_dubai_camel_track_morning.png と assets/ui/camel_race/camel_1.png、jockey.png、suv.png（添付できれば添付）。ラシードは assets/sprites/characters/rashid/chr_rashid_normal.png。
【渡し方】原画をそのまま asset_sources/ch4-camel-race/ui/originals/ に置き、生成の指示と日付を asset_sources/ch4-camel-race/ui/generation.json に書いて push。各ファイルの SHA-256 も添えてください。候補が複数ある部品は -A/-B を付けて全部ください。
```

## 届いた後（Claude の作業）

1. 原画のSHA-256と寸法・アルファを確かめ、各部品を選ぶ（理由はこのファイルに追記）。
2. 縮小だけで `assets/ui/camel_race/ui/` へ置き、WebP を `remake/img/ui/camel_race/ui/` に作る。
3. `remake/css/camel-race.css` の該当部分を `border-image`（九分割）と背景画像に置き換える。数字・名前・ゲージの量・判定の文字は今のままコードで描く。絵が読めないときは今のCSSに戻す。
4. PC（1280×720）とスマホ横（844×390）で、遊び方・レース・スパート・リザルトを目視し、`node remake/test/browser/ch4_camel_race.mjs` を通す。
