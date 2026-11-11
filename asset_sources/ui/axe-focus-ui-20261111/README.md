# 斧投げ 的に集中する配置のUI部品（2026-11-11・AXR14・#3207）

オーナー「ゲージの見た目とか整えたいかも ボタンとか」「コーデックスで画像生成とかして見た目を整えたい」。
配置は `docs/spec/axe_throw.md` の「的に集中する配置」。CSSだけで描いていた回転ゲージ・投げる札・狙いの札を、絵の部品に置き換えた。

- 指示文: `prompts/parts.txt`（共通の冒頭＋6枚）。参照に `assets/ui/axe_throw/target_board_watl_c.png` と `assets/ui/axe_throw/menu-walnut-panel.webp` を添付。
- 画像に入れないもの: 文字・数字・印・目盛り・色の帯・針の位置。全部ゲーム側が上に描く。

## 採用した部品（PR #3210）

Codex が #3207 の指示で6枚を作り、PR #3210 で main に入った（原画 `raw/`、採用版PNG `assets/ui/axe_throw/`、表示用WebP `remake/img/ui/axe_throw/`）。PR #3210 の検品: 指定寸法・RGBA・外周 alpha=0、橙／緑と黒板／選択札は alpha の形が完全に一致、文字・目盛り・色の帯なし。選択札の最初の案は外側に色片があったので `raw/tag-selected-rejected-top-artifact.png` として残し、採用版では除いた。

| 表示用 | 寸法 | 使う場所 |
|---|---|---|
| `gauge-frame.webp` | 320×2048 | 的の右の回転ゲージの枠。中の色の帯と針の位置はコード |
| `gauge-needle.webp` | 512×160 | ゲージの針（矢じりは伸ばさず、棒だけ伸ばす） |
| `button-throw-orange.webp` | 1280×448 | 投げる札（構える／横を止める／…／次の投へ） |
| `button-throw-green.webp` | 1280×448 | 同じ札の「いま放す！」の間 |
| `tag-slate.webp` | 896×512 | 狙いの札「通常」・構え直す・息を整える・もう一度 |
| `tag-selected.webp` | 896×512 | 選んだ青の札 |
| `tag-slate-blue.webp` | 896×512 | **色違い（このフォルダの `tools/` で作成）**: 選んでいない青の札。黒板の面だけを濃紺 #153a5c 系へずらした |
| `tag-selected-amber.webp` | 896×512 | **色違い（同上）**: 選んだ「通常」の札。真鍮の枠の札の青い面だけを、レーンの橙 #ff8c3a 系へ。青はキルショットの意味なので、通常は橙にした |

- 色違い2枚は `tools/make_axe_ui.py` で作る（リポジトリの直下で `python3 -I asset_sources/ui/axe-focus-ui-20261111/tools/make_axe_ui.py`）。元の絵と同じ寸法・同じ形のまま、面の色だけを変える（ふちの木・真鍮・光は元のまま）。採用版PNGも同じ名前で `assets/ui/axe_throw/` にある。
- 同じスクリプトが、CSS に要る寸法（各画像の絵の外接範囲・ゲージの溝・針の棒の太さ）を `tools/geometry.json` に書く。

## 組み込み（`remake/css/axe-throw.css` の「絵の部品」節）

どの画像も絵の周りに透明な余白がある。9分割（`border-image`）で当て、余白の分は `border-image-outset` で外へ出して描く（はみ出しは描くだけで、ボタンの大きさや押せる範囲は変わらない）。

- ゲージの枠: 幅60pxに絵の幅255を合わせる（0.235倍）。`.axe-timing::before` に `140 95 fill / 25.1px 14.6px / 7.8px`。色の帯（`.axe-gauge`）は枠の溝の内側（左 12.9px・右 13.2px・上 21.2px・下 20.9px。溝は `geometry.json` の `slot`）。
- 針: 高さ14pxに絵の高さ96を合わせる。`0 42 0 100 fill / 0 6px 0 14.6px / 4.7px`（左の100pxが矢じり）。
- 投げる札: 高さ100pxに絵の高さ383を合わせる（0.261倍）。`::before` に橙、`::after` に緑（`150 200 fill / 30.5px 39.7px / 8.6px 12.5px`）。「いま放す！」の間だけ緑の opacity を1にする。
- 黒板の札: 高さ82pxに絵の高さ432を合わせる（0.19倍）。`::after` に `115 123 fill / 14.2px / 7.6px 9.1px`。狙いの札の `::before` はチェックの印のまま。
- 8枚とも `remake/js/minigames/axe.js` の読み込み中（`UI_ART`）に先に解いておく。構えた瞬間にゲージの枠が遅れて出ない。
- 検査: `remake/test/browser/axe_polish.mjs` の `*-focus-layout`（どの札・枠にどの絵が当たっているか、8枚が最初の投の前に読み込まれていること、「いま放す！」で緑になること、色の帯が枠の溝の中にあること）。

## 使わなかった別の生成（記録）

オーナーがチャットで別の受け渡しZIP（`axe-focus-ui-3207-candidates.zip`、同じ指示文での別の生成）も渡した。PR #3204 に一度それを組み込んだが（コミット `e5bdae12`）、緑の札と選択札の中央に透過の穴があり、寸法も指定と違ったため直して使っていた。そのあとオーナーが PR #3210（穴のない、寸法どおりの6枚）を main へマージしたので、こちらへ切り替え、ZIP の画像はリポジトリから外した（履歴には残る）。
