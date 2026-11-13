# 心得の盤: 新版でまだ図形のままの部品を絵にする・第2弾（2026-11-12・GB05）

オーナー（2026-11-12・台帳 SBD124）:

> 他に成長システム周りで気になったのとかある？後成長システム自体見た目が気になるものはコーデックス頼っていい

第1弾（[GB04](../growth-board-20261111/README.md)・#3396）で、火種4種・レベルアップの札・盤の札・マスの印の台・丸いボタンは絵になった。
見直して、**新版（既定の見た目）でまだ CSS の図形のまま残っている所**を、同じ「ネオンのラウンジ」の絵にする。第1弾の紙の部品は旧版の見た目にしか合わず、新版の右側は夜紫の平らな面のままになっている。

依頼は [Issue #3408](https://github.com/haseatsu114514-dot/shisha-game/issues/3408)。この文書が依頼文の正本。原画は `originals/` に置く。盤の面（#2129 の最終デザイン）と第1弾の絵は作り直さない。

## 1. 今の画面と部品の場所

| 図 | 中身 |
|---|---|
| `reference/parts2_board.png` | 新版の盤（何も選んでいない時）。桃色の番号は下の表の ID の数字 |
| `reference/parts2_board_selected.png` | 新版の盤（マスを選んだ時の右のパネル） |
| `reference/parts2_help_flow.png` | 「？」の見方の1ページ目「ながれ」（番号の丸が並ぶ所） |
| `reference/parts2_levelup_milestone.png` | 節目（Lv.10 ごと）のレベルアップ |

- 文字・数字・記号・ゲージの中身・左の帯の色（盤ごとの色）はゲームが描く。絵には入れない。
- 第1弾の絵（同じ作り手に見えること）: `../growth-board-20261111/contact_sheet.png`

## 2. 作るもの

優先は A → B → C。A だけ先に届いてもよい。

| ID | ファイル名（`originals/`） | 大きさ | 置き換える所（今） |
|---|---|---|---|
| **A 板と行** | | | |
| GBP-12 | `gb_panel_dark.png` | 1024×1024・九分割（各辺 128） | 右のパネルの板（今は夜紫の平らな面・枠なし） |
| GBP-13 | `gb_row_dark.png` | 768×192・九分割（各辺 64） | 近い目的地の行・財布の箱（今は紫の四角。左の帯の色はゲームが重ねる） |
| **B 小さな札** | | | |
| GBP-14 | `gb_chip_gold.png` | 512×192・九分割（左右 96／上下 0。高さいっぱいの丸い端） | 「灯せる」の金の札（今は金色のグラデーションの丸い札） |
| GBP-15 | `gb_pill_dark.png` | 512×192・九分割（左右 96／上下 0） | 盤の倍率の札（−・全体・＋）と ✦ の札（今は細い線の丸い札） |
| **C 絵** | | | |
| GBP-16 | `flow_1.png` `flow_2.png` `flow_3.png` `flow_4.png` | 各 512×512 | 「ながれ」の4手順の絵（今は 1〜4 の番号の丸だけ）。1 経験値をためる／2 その場でレベルアップ／3 観音堂などで振り返る／4 灯した分だけ力が伸びる |
| GBP-17 | `levelup_crest.png` | 1024×1024・**真っ黒の地** | 節目のレベルアップで、札の後ろに重ねる紋（今は放射の光を大きくするだけ） |

## 3. デザイン

- どれも第1弾の暗い部品（レベルアップの札の板・選んでいる札・印の台）と同じ作り: **黒いスモークガラスに、細い金のネオンの線**。面は静かに（上に文字が載る）。
- GBP-12 板: 角を少し丸めた大きな板。外側に細い金の線1本、内側にもう1本うすい線。四隅の縁の帯の中に、火の粉の小さな飾り。中央は一様に暗く、ごく淡い紫の照り。**第1弾の `levelup_plate.png` を大きな板にしたもの**。
- GBP-13 行: 板の上に載る細長い行。板より少し明るい濃紫のガラス、髪の毛ほどの金の縁、飾りなし（表示は高さ 48px ほど）。左端は帯を重ねるので平らに。
- GBP-14 金の札: 磨いた金の小さな札（両端が丸い）。暗い細い縁と、内側に彫った細い線1本。面は平らな金（濃い文字が載る）。宝石・鋲は付けない。
- GBP-15 暗い札: 両端が丸い黒いガラスの小さな札に、細い金の縁。面は平ら。
- GBP-16 ながれの絵: **第1弾の印の台（`gb_badge_unknown.png`）と同じ丸い黒いガラスの台**の中に、白金のネオンの線で描いた絵文字を1つ。4枚は同じ台・同じ線の太さ。人物・シーシャ機材・文字は描かない。
  1. 経験値をためる … 小さな火の粉が3つ、上の大きな星へ集まっていく
  2. その場でレベルアップ … 上向きの山形が2つ重なり、その上に小さな火の玉
  3. 観音堂などで振り返る … お堂の屋根（反った瓦屋根の線）と、その下に小さな灯
  4. 灯した分だけ力が伸びる … 線でつながった丸が3つ、左から順に明るく灯っていく
- GBP-17 節目の紋: 真っ黒の地に、細い金のネオンの炎でできた輪（葉冠のように左右から上へ伸びる）。中央は空（Lv の数字と札が載る）。外へ向かって黒に消える。物・文字・レンズフレアの輪は描かない。画面には光として足す（第1弾の `burst_rays.png` と同じ扱い）。

## 4. 参照画像（毎回・役割を書いて渡す）

1. `asset_sources/ui/growth-board-20261111/contact_sheet.png` … 第1弾でゲームに入った絵の一覧（**作りと色の正本**。同じ作り手に見えること）
2. `asset_sources/ui/growth-board-20261112/reference/parts2_board.png`（GBP-12 は `parts2_board_selected.png` も、GBP-16 は `parts2_help_flow.png`、GBP-17 は `parts2_levelup_milestone.png`）… 今の画面と部品の場所（番号＝ID）。**配置と大きさの比の参考**。桃色の番号と線は描かない
3. GBP-12・13 だけ: `asset_sources/ui/growth-board-20261111/originals/levelup_plate.png` … 板の作りの見本（黒いガラス・金の線・火の粉の飾り）
4. GBP-16 だけ: `asset_sources/ui/growth-board-20261111/originals/gb_badge_unknown.png` … 丸い台の見本

LFS: `git lfs pull --include="asset_sources/ui/growth-board-20261111/contact_sheet.png,asset_sources/ui/growth-board-20261111/originals/levelup_plate.png,asset_sources/ui/growth-board-20261111/originals/gb_badge_unknown.png,asset_sources/ui/growth-board-20261112/reference/*"`

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

種類の文（今回の部品は全部これ）:

```
ART DIRECTION "neon lounge": black smoked glass and thin neon tubes with a bright core, as in attachment 1. Light colors are limited to the board colors red-orange #ef8a5e, blue #58a6ff, green #7bd36d, gold #f4d27a, warm white-gold #fff1d0 and pale white #f6f2ff. Pixel-painter shading with fine dot texture, 2 or 3 clean tone steps, light from the upper left. Calm and luxurious, nothing eye-searing.
```

一覧（1回の生成で1つ。GBP-16 は flow_1 を先に描き、残りは描いた flow_1 を「同じ台・同じ線の見本」として添付する）:

```
GBP-12 / gb_panel_dark.png 1024x1024, nine-slice (128 px on every side) — A large panel of black smoked glass with softly rounded corners, edged by one thin gold neon tube and a second fainter inner line; inside the border band at each corner, a tiny ornament of two ember sparks. The whole center is plain, evenly dark glass with a very faint purple sheen (text will sit on it). Same make as the attached level-up plaque, as a big square panel. The background outside the panel is magenta.
GBP-13 / gb_row_dark.png 768x192, nine-slice (64 px on every side) — A long row strip that lies on that panel: dark plum smoked glass, slightly lighter than the panel so it reads as raised, softly rounded corners, a hairline gold rim, no ornaments at all. Keep the left 32 px plain (the game overlays a colored band there). Center plain.
GBP-14 / gb_chip_gold.png 512x192, nine-slice (96 px left and right) — A small pill-shaped tag of polished gold with fully round ends: a thin dark outline, one fine engraved line just inside the rim, a flat calm gold face from #f3d48d at the top to #d9a94f at the bottom (dark text will sit on it). No gems, no rivets, no shine streak across the face.
GBP-15 / gb_pill_dark.png 512x192, nine-slice (96 px left and right) — A small pill-shaped tag of black smoked glass with fully round ends and a thin gold neon rim, flat plain face (light text will sit on it).
GBP-16 / flow_1.png 512x512 — A round token of dark smoked glass with a faint gold rim, exactly like the attached token, with ONE pictogram drawn inside in a thin warm white-gold neon line: three small sparks rising and gathering toward one larger four-point star at the top. No text.
GBP-16 / flow_2.png 512x512 — The same token and line as the attached flow_1: two upward chevrons stacked, with a small round flame bead above them.
GBP-16 / flow_3.png 512x512 — The same token and line: the curved tiled roof of a small Japanese temple hall drawn as a simple line, with a tiny flame glowing beneath it. No people, no text.
GBP-16 / flow_4.png 512x512 — The same token and line: three circles joined by a line, lit one after another from the left (the left one bright, the middle one half bright, the right one dim).
GBP-17 / levelup_crest.png 1024x1024, on a pure black #000000 background instead of magenta — A circular wreath made of thin gold neon flames, rising from the bottom up both sides like a laurel and almost meeting at the top; brightest at the bottom, fading to black outward and before the edges; the center is completely empty and black. No object in the middle, no ring of lens flare, no text. The game adds it to the screen as light.
```

- 文字・数字・記号・擬似文字・ロゴ・人物・シーシャ機材は描かない。
- 九分割の部品は、飾りを縁の帯の中に収め、中央は一様にする（伸ばすと飾りがゆがむ）。**絵は枠いっぱいに描く**（第1弾は枠の中に余白があり、切ってから縁を測り直した）。

## 6. 納品（Codex）

- 原画を `asset_sources/ui/growth-board-20261112/originals/` に置き、PR にする（Draft でよい）。生成の指示と参照画像のパス・SHA-256・各 PNG の画素寸法と SHA-256 を `originals/GENERATION.md` に書く。
- **透過・切り分け・縮小・ゲームへの組み込みはしない**（Claude が行う。第1弾と同じ `convert.py` の方法）。この PR では `originals/` と `GENERATION.md` だけを変える。
- 画像は Git LFS（`asset_sources/` の png は `.gitattributes` で LFS）。

## 7. 受け取り後（Claude）

- 検品: 文字・数字・記号が無い／マゼンタが `#FF00FF` の単色で、にじみ・影が外に出ていない（GBP-17 は真っ黒の地）／第1弾の絵と並べて同じ作りに見える／九分割の中央が一様。
- 変換して `remake/img/ui/growth_board/` へ（`panel_dark.webp`・`row_dark.webp`・`chip_gold.webp`・`pill_dark.webp`・`flow_1〜4.webp`・`levelup_crest.webp`）。CSS は新版（`look-neo-board.css`・`look-neo.css`）と「？」の見方（`daily.css`）。絵が読めない時は今の形のまま動くようにする。
- 新版の検査（`look_neo_more.mjs`）は「暗い面で、紙の絵を使わない」を見ているので、面の色は絵の下に敷いたままにする（第1弾と同じ）。

## 8. 組み込み（2026-11-12・Claude・PR #3455）

9枚とも採用（原画は無加工のまま `originals/`）。`convert.py`（第1弾の `../growth-board-20261111/convert.py` の関数をそのまま使う）で、マゼンタを抜いて切り、`remake/img/ui/growth_board/` へ（合計約200KB）。確認用の一覧は `contact_sheet.png`。

| 表示用 | 寸法 | 使う場所 |
|---|---|---|
| `panel_dark.webp` | 512×512・縁 64 | 新版の右のパネル（`.gb-side::before`・縁の幅 24px） |
| `row_dark.webp` | 384×95・縁 32 | 近い目的地の行（`.gb-goal::after`。左の盤の色の帯は `::before` で絵の上）と財布の箱（`.gb-wallet::before`）。縁の幅 12px |
| `chip_gold.webp` | 384×78 | 「灯せる」（灯せる時）と、付いている ✦ の札（`.gb-feat.on`） |
| `pill_dark.webp` | 384×82 | 盤の倍率（−・全体・＋）と ✦ の札。両端の丸の幅は高さの半分（倍率はスマホで 23px、`daily.css` の `--pill-cap`） |
| `flow_1〜4.webp` | 128×128 | 「？」の見方「ながれ」の手順の丸（`.gh-step`）。番号は右下の小さな札。絵が読めない時は今までの番号の丸 |
| `levelup_crest.webp` | 512×512 | 節目のレベルアップの札の後ろ（`.lvup.has-art.milestone::before`・560px）。回る光（`lvup-rays`）とは別に動かさない |

- 盤の4枚（panel・row・chip・pill）は `growth-board-screen.js` の `ART_FILES` に足した。全部読めた時だけ `.gboard.has-art` になり、その時だけ絵を当てる。紋は `levelup.js` の `ART` に足した。
- 新版の面の色（夜紫のグラデーション）は絵の下に敷いたまま（`look_neo_more.mjs` の「暗い面で紙の絵を使わない」）。CSS は `look-neo-board.css` の「第2弾の絵」節。
- 検査: `look_neo_more.mjs`（盤の PC・スマホ・テーマ7種・旧版へ戻す）、`growth_fx.mjs`（節目のレベルアップ・「？」のながれ）で確認。
