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
