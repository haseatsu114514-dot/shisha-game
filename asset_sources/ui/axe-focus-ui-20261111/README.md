# 斧投げ 的に集中する配置のUI部品（2026-11-11・AXR14）

オーナー「ゲージの見た目とか整えたいかも ボタンとか」「コーデックスで画像生成とかして見た目を整えたい」。
配置は `docs/spec/axe_throw.md` の「的に集中する配置」。今はCSSだけで描いている回転ゲージ・投げる札・狙いの札を、絵の部品に置き換える。

- 指示文: `prompts/parts.txt`（共通の冒頭＋6枚）。参照に `assets/ui/axe_throw/target_board_watl_c.png` と `assets/ui/axe_throw/menu-walnut-panel.webp` を添付する。
- 画像に入れないもの: 文字・数字・印・目盛り・色の帯・針の位置。全部ゲーム側が上に描く（緑の適正帯・茶の刺さる帯・％・「構える」などの文字・チェックの印）。
- 原画は `raw/` に置く（この資料の画像は Git LFS）。

| 原画 | 使う場所 | 画面上の大きさ（ステージ 1280×720） |
|---|---|---|
| `gauge-frame.png` | 的の右の回転ゲージの枠（`.axe-gauge`）。中の帯と針はコード | 幅 約56 × 高さ 516〜594（縦に伸ばす） |
| `gauge-needle.png` | ゲージの針（`.axe-needle`） | 幅 約72 × 高さ 約16 |
| `button-throw-orange.png` | 投げる札（`.axe-throw-button`）。9分割で伸ばす | 約288×100 |
| `button-throw-green.png` | 同じ札の「いま放す！」 | 約288×100 |
| `tag-slate.png` | 狙いの札・「構え直す」「息を整える」。青・橙はコードで色を乗せる | 148×82／288×82 |
| `tag-selected.png` | 選んだ狙いの札 | 約163×90 |

## 受け取ったあとの組み込み

1. 原画を `raw/` に置き、採用版を `assets/ui/axe_throw/`、配信用の WebP を `remake/img/ui/axe_throw/` に置く（新規画像は Git LFS。`git lfs ls-files` で確認）。
2. `remake/css/axe-throw.css` の「的に集中する配置」の節で `border-image`（9分割）か背景として当てる。文字・帯・針の位置・押せる範囲は変えない。
3. `python3 remake/tools/build_manifest.py` → `node tools/ci/run.mjs --kind browser --suites axe-throw`。PC とスマホ横持ちの画面で、文字が読めること（札の中央が平らで明るさが一定）を目で確認する。

## 受領と採用（2026-11-11）

Codex がオーナー経由で受け渡しZIP（`axe-focus-ui-3207-candidates.zip`）を届けた。生成は Codex の組み込み画像生成、参照は上の2枚。Codex 自身の説明・検品・SHA・書き出しスクリプトは `codex/` にそのまま置いた。

- **原画** `raw/` の6枚: 受け渡しZIPの `raw/` のまま（SHA-256 は `codex/codex-SHA256.json` と一致を確認）。ZIPの `canvas-candidates/`（指定キャンバスへ縮めた版）と `rejected/`（Codex が不採用にした3案。緑の穴あき案を含む）はゲームで使わないので保存していない。
- **加工** `tools/make_axe_ui.py`（結果は `tools/make_axe_ui.report.json`）。原画から再現できる。

| 部品 | 原画の検品 | 採用の形 |
|---|---|---|
| ゲージの枠 | きれい。上下の端に真鍮のねじ、溝の内側に真鍮の線 | 原画のまま切り抜き |
| 針 | きれい。右向きの矢じり＋真鍮の棒 | 原画のまま切り抜き |
| 投げる札（橙） | きれい。中央が平らで明るさ一定（標準偏差 1.3） | 原画のまま切り抜き |
| 投げる札（緑） | **不採用**: 中央の透過に穴（alpha 最小153）と色むら。Codex の README も同じ欠陥で別案を不採用にしている | 橙の札の面だけを #b8e5aa 系へ塗り替えて作った（形は橙とピクセル単位で同じ） |
| 札（黒板） | きれい | 原画のまま切り抜き。青（キルショット）の札は面だけを濃紺 #153a5c 系へずらした版も作った（`focus-tag-slate-blue`） |
| 選んだ札（青） | 中央の青い面に四角い透過の穴（alpha 最小126）と右の白い点2つ | 面の内側を、左右の端のきれいな青から左右へなだらかに塗り直した（ふちの真鍮と白い線は原画のまま）。「通常」を選んだ時用に、面だけを橙 #ff8c3a 系にした版も作った（`focus-tag-selected-amber`。青はキルショットの意味なので通常は橙） |

- 板の外の微小な alpha（8以下）は0にした。板の画素は変えていない（上の修正を除く）。
- Codex の README にある「指定の縦横比と違う」点（ボタンは約4.3:1、札は約2.2:1、ゲージは約0.11:1）は、9分割（`border-image`）で伸ばすので問題にならない。角と端は伸ばさない。

### 置き場所

- 採用版PNG: `assets/ui/axe_throw/focus-*.png`（原画の大きさまで）
- 表示用WebP（lossy q90・method 6・alpha 保持）: `remake/img/ui/axe_throw/focus-*.webp`

| 表示用 | 寸法 | SHA-256 |
|---|---|---|
| `focus-gauge-frame.webp` | 160×1425 | `73f3f623a43c7a98119377f0c70c17167857afb0ff01eacb2c8fed27675dd106` |
| `focus-needle.webp` | 260×27 | `0cb1900aefa6fe3c155b70b4a652cbe446649e90669c60209148f1441a68e5d4` |
| `focus-tag-selected-amber.webp` | 498×224 | `ec1be4baed3c2129ad5466131aca2ad5ff2baff5c1b2c418c9ae5c3bc8c86edd` |
| `focus-tag-selected.webp` | 498×224 | `ddaa5b83dba0948ddd88c7955b18a435f3f9e0d12a9298805263fcd2e39611f7` |
| `focus-tag-slate-blue.webp` | 499×224 | `0ffafe60e648a2933004cb62b8a90a815c46b42be54686cfe399e6ae9b349151` |
| `focus-tag-slate.webp` | 499×224 | `d6acbf626546a775827135e14aab8045f9f0b45bd85ae36d10f3c1d6dbed3b61` |
| `focus-throw-green.webp` | 1295×300 | `20f276a1ce37c8012f144fd284a1f7e7ec580cc41c3b26db3ebbbdcfc079d925` |
| `focus-throw-orange.webp` | 1295×300 | `9f264ae6d5f72a1bea1062b5c1e7209c42682c2decd89815de5151c054a47db9` |

### 組み込み（`remake/css/axe-throw.css` の「絵の部品」節）

- ゲージの枠: `.axe-timing::before` に `border-image: … 48 40 fill / 18px 15px`。列の幅を 46→60px にし、色の帯（`.axe-gauge`）は枠の溝（左右 13.5px・上 14px・下 14.6px の内側）に入れる。溝の位置は表示用画像で測った値（`gauge-slot`）。
- 針: `.axe-needle::before` に `border-image: … 0 8 0 32 fill`（矢じりは伸ばさず、棒だけ伸ばす）。高さ 14px。
- 投げる札: `::before` に橙、`::after` に緑（`130 150 fill / 43px 50px`）。「いま放す！」の間だけ緑の opacity を1にする。
- 黒板の札（狙いの札・構え直す・息を整える・もう一度）: `::after` に `40 fill / 15px`。狙いの札の `::before` はチェックの印のまま。
- 8枚とも `axe.js` の読み込み中（`UI_ART`）に先に解いておく。構えた瞬間にゲージの枠が遅れて出ない。
- 検査: `remake/test/browser/axe_polish.mjs` の `*-focus-layout`（どの札・枠にどの絵が当たっているか、8枚が最初の投の前に読み込まれていること、「いま放す！」で緑になること、色の帯が枠の溝の中にあること）。
