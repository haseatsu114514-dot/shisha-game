# Kuji gacha art source record（GCH・シーシャくじの演出の絵）

シーシャくじの演出（ガラガラ → 賞の札。台帳 GCH）で使う、描いた絵の原画と記録。依頼文は [prompts.md](prompts.md)。
画風は採用済みのショップ背景 `assets/backgrounds/bg_shop.png` と同じ（倉庫のような問屋の、くるみ材・黒い鉄・くすんだ真鍮・クラフト紙）。

コードは絵が無くても動く。道具は1つずつ別の部品になっていて、絵が無いあいだはコードで描いた下絵が出る（`remake/js/motions/garagara-stage.js` の `*Sketch`、札は `remake/css/motions/garagara.css`）。
絵を採用したら、同じ場所へ同じ大きさで差し替える。

## 原画の記録

原画は `raw/` に置く。生成の記録（ファイル名・ピクセル数・bytes・SHA-256・CHECK の結果・参照画像）は Codex が `raw/GENERATION.md` に書く（依頼は GitHub の Issue #3228「[素材・Codex] シーシャくじの演出の絵」）。
採用した絵は、下の表に1枚1行で書く。

| 採用した絵 | 元の原画 | 切り出し後のサイズ | 置き場所 |
|---|---|---:|---|
| （未採用） | | | |

## 受け取った後の手順（実装側）

1. 原寸で CHECK と[納品前「AIっぽさ」排除チェック](../../../docs/asset_ai_guidance.md)（テカリ・擬似文字・小物の崩れ・採用済み素材と並べて同じ描き手に見えるか）を確かめる。実画面に置いて、店の背景と並べて浮かないかを見る。
2. 透過の画像は alpha≥8 の外接範囲で切り出す（玉5種・札5種は、同じ切り出し枠を全種に使う）。背景がマゼンタ #FF00FF で届いた絵は、先にマゼンタを抜く。黒地の `burst`・`sparkle` は切り出さない。土台・受け皿・玉置き・包みの接地の影は絵に入れていないので、CSS で付ける。
3. 採用画像を `assets/ui/kuji/<名前>.png` に置き、上の表へ切り出し後のサイズを追記する。配信用は `remake/img/ui/kuji/<名前>.webp`（`remake/tools/build_ui_skin.py` に表を足す）。新規画像は Git LFS（`git lfs ls-files` で確認）。
4. 差し込む。
   - **抽選器の道具と玉・カウンター・黒板・玉置き・鐘**: `remake/js/motions/kuji-art.js` の `KUJI_ART` に `名前: { url }` を足す。絵は下の枠いっぱいに表示される。枠を変えるときだけ `box: [left, top, width, height]` を添える。差し替えた部品の下絵（`*Sketch`）は消す。
   - **札の地・光・包み・帯**: `remake/css/motions/garagara.css` の該当の背景を絵に替える（下の表）。
5. `node remake/test/browser/kuji_gacha.mjs` と `shop_ui.mjs` のくじのケースを通し、PC とスマホ横持ちで目視する（`__remake.dev.motion("garagara-S")`・`"garagara-10S"`・`"garagara-LAST"`）。

### 部品の枠（ステージ 1280×720 の座標。抽選器の軸は x540・y292）

| 部品（`KUJI_ART` の名前） | 原画 | 枠（left, top, 幅×高さ） | 合わせる点 |
|---|---|---|---|
| `drum` | `garagara-drum` | 軸を中心に 308×308 | 六角の外接半径が150（左右の角が枠の端から4内側）。軸頭が枠の中心。回すのは CSS の回転。厚みは同じ六角を右上へ7枚ずらして重ねて出している（`.kj-drum-side`） |
| `frame` | `garagara-frame` | 375, 274, 330×330 | 軸受けの中心が枠の上から18・左右の中央。足の先が枠の下端近く。奥の脚は同じ絵を暗くして右上へずらす（`.kj-frame-far`） |
| `base` | `garagara-base` | 320, 560, 440×64 | 板の幅が約424。原画は3:2なので、切り出してから枠に合わせる |
| `handle` | `garagara-handle` | 400, 152, 280×280（中心が軸） | 軸の円の中心が枠の中心、握りの中心が軸から右へ104。切り出し後に軸が中心へ来るよう余白を足す |
| `tray` | `garagara-tray` | 762, 562, 220×84 | 皿の外周の楕円が約192×54、中心が枠の (110, 36) |
| `ball-s` `ball-a` `ball-b` `ball-c` `ball-last` | `ball-*` | 34×34（位置はコード） | 玉の直径が32。黒板と札の上の玉（`.kj-ball`）にも同じ絵を使う |
| `counter` | `counter` | -60, 478, 1400×420 | 奥の縁が枠の上端（y478）。手前の縁が y694 付近に来る（原画の78%の線） |
| `sign` | `sign` | 100, 250, 196×340 | 板の面に字（`.kj-sign-text`）が収まるよう、字の内側の余白を絵に合わせて直す |
| `rail` | `rail` | 玉の数で幅が変わる（高さ48） | 中ほどを横に伸ばす（九分割）。くぼみは描かない |
| `bell` | `bell` | 140×300（上端の中央が手首） | 柄が上端まで届く。振るのは CSS の回転 |

### CSS で差し替えるもの

| 原画 | 差し替える所（`css/motions/garagara.css`） |
|---|---|
| `card-s` `card-a` `card-b` `card-c` `card-last` | `.kuji-card:not(.kuji-short)`（884×372）の背景を絵に（`.rank-S` など賞ごと）。左の窓（`.kj-art`）は絵に含まれるので、CSS の窓の地と縁は消す。連続の小さい札（`.kuji-short`）は、同じ絵の縁を九分割（`border-image`）で使う |
| `burst` | `.kj-rays`（札の後ろで回る光）。黒地の絵を `mix-blend-mode: screen` で重ね、賞の色は上に `multiply` の色を重ねて付ける。今の `repeating-conic-gradient` とぼかしは消す |
| `gift` | `.kj-gift`（絵の無い景品の包み）。中の `<i>` 3つは消す |
| `banner` | `.kj-banner`（S賞の「大当たり」の帯の地）。字はそのまま |
| `sparkle` | `motions/kuji-fx.js` の `star`（十字のきらめき）を、この絵の加算描画に替える |
