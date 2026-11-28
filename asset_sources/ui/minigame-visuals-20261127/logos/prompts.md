# ミニゲームの題字ロゴのプロンプト（2026-11-27）

オーナー「あと各ミニゲームのタイトルは生成して　今なんかデザートライドとかダサいしロゴ」。`gpt-image-2.6-sunburst`（OpenAI Images API の edits。参照画像つき）で 1 枚ずつ、各 1 回の生成で採用した。

## `logo_desert_ride.png`

- 使う所: 砂丘（DESERT RIDE）の入口の題字 → `remake/img/ui/desert_ride/logo.webp`（900×605）
- 大きさ: 1536x1024・背景透過・quality high
- 参照画像: 砂丘の入口の背景（title_bg）、滑走中の実画面（ブースト）

```
A premium mobile game title logo for a sandboarding race game set in the Dubai desert. The logo text reads exactly DESERT RIDE (two words, spelled D-E-S-E-R-T and R-I-D-E, nothing else), stacked on two lines and set in a heavy, sporty, forward-slanted custom display font with chunky sand-gold to sunset-orange gradient letters, a thick dark chocolate-brown outline, a bright cream inner bevel and a strong 3D extrusion going down-right, like a console extreme-sports game logo. Behind the letters: a big warm setting sun disc, a stylised curved sand dune line, and an orange sandboard slicing diagonally under the letters throwing a dynamic spray of golden sand and speed streaks. Small details: a few sparkles. Must match the warm hand-painted anime palette of the reference desert illustration. Isolated on a fully transparent background, centred, fills most of the canvas. No other words, no subtitles, no small text, no watermark.
```

## `logo_camel_race.png`

- 使う所: ラクダレースの入口の題字 → `remake/img/ui/camel_race/ui/logo.webp`（900×550）
- 大きさ: 1536x1024・背景透過・quality high
- 参照画像: それまでの題字（word-title）、レースのラクダとロボット騎手の絵、並走の車の絵

```
A premium mobile game title logo for a desert camel racing game. The logo text reads exactly CAMEL RACE (two words, spelled C-A-M-E-L and R-A-C-E, nothing else) in a bold brushy hand-lettered display font like the reference word art: cream and warm sand-colored letters with a thick dark navy-brown outline and a slight 3D drop, slightly bouncy baseline. Integrated emblem: a running racing camel silhouette with a small robot jockey and a number cloth, galloping across a wide arched banner of striped red-and-gold racing ribbon under the words, with puffs of sand dust kicked behind, and a small checkered finish flag. Hand-painted cartoon game style matching the camel and SUV reference art. Isolated on a fully transparent background, centred, fills most of the canvas. No other words, no numbers except a single small number 1 on the camel's cloth, no subtitles, no watermark.
```

## `logo_tetsuko.png`

- 使う所: 「てつこといっしょ」の題字 → `remake/img/ui/tetsuko/ui_tk_logo.webp`（820×390）
- 大きさ: 1536x1024・背景透過・quality high
- 参照画像: それまでの題字の札、てつこ（猫）の絵

```
A cute, cosy mobile game title logo for a cat-petting mini game. The logo text is Japanese hiragana and reads exactly てつこといっしょ (eight characters: て、つ、こ、と、い、っ、し、ょ — the っ and ょ are the small kana), written large in a soft, rounded, hand-drawn brush lettering in deep cocoa-brown with a cream inner highlight and a thick creamy outline, slightly bouncy. Decorate it in the same style as the references: a ginger-and-cream tabby Scottish Fold cat (folded ears, round face, tabby stripes like the reference cat) peeking over the top edge of the letters with its paws resting on them, a small paw-print stamp badge, a corrugated cardboard name plate with an orange-and-cream striped edge behind the letters, a little yarn ball. Warm cardboard, cream and orange palette, hand-painted cosy anime game UI style. Isolated on a fully transparent background, centred, fills most of the canvas. No other text, no English, no letters other than the eight kana, no watermark.
```

## `logo_axe_throw.png`・`logo_tabletop_rpg.png`・`logo_dj_mix.png`（2026-11-28・EXT06）

オーナー「今ミニゲームによってロゴがあったりなかったりなのでないのは作って」。上の3つと同じ作り方（`gpt-image-2.6-sunburst` の edits・1536x1024・背景透過・quality high）で、各1回の生成で採用。プロンプトと参照画像は `asset_sources/ui/extra-ui-20261128/generate.py` の `logo_*`（`python3 generate.py logo_axe_throw` などで作り直せる。原画はこのフォルダの `originals/` に出る）。

| 原画（`originals/`） | 使う所 | 参照画像 | ゲームの絵 |
|---|---|---|---|
| `logo_axe_throw.png` | EXTRA の斧投げのスライドの題 | 斧投げの実画面（刺さった斧）・投げ斧の絵・CAMEL RACE のロゴ | `remake/img/ui/axe_throw/logo.webp`（900×597） |
| `logo_tabletop_rpg.png` | EXTRA のボドゲカフェのスライドの題 | ダイスを振る実画面・SUCCESS の題字・CAMEL RACE のロゴ | `remake/img/ui/trpg/logo.webp`（900×602） |
| `logo_dj_mix.png` | EXTRA の DJ のスライドの題 | DJ の実画面・紫のジョグホイール・CAMEL RACE のロゴ | `remake/img/ui/dj/logo.webp`（900×588） |

- 文字はゲームの中の呼び名（斧投げ AXE THROW・TRPG の TABLETOP RPG・DJ MIX）。綴りの誤りが無いことを目で確かめた
- 原画の SHA-256（先頭16桁）: `logo_axe_throw` c5cbe95c11d7314b, `logo_tabletop_rpg` f3417e27249139be, `logo_dj_mix` 94a2c7ce104a548e
