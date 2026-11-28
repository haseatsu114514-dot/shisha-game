# タイトルの EXTRA（あそびば）の部品（EXT07）

2026-11-28 オーナー「エクストラはなんかCSS感強いから必要に応じでパーツをAPIで用意」。EXTRA の選ぶ画面（`remake/js/scenes/extra.js`・`remake/css/extra.css`）の部品を、
本編の縦画面の部品（`remake/img/ui/vertical/pad-ring`・`pad-button`。煙の入った紫の大理石と細い金の縁）と同じ画風で生成した。文字は描かない（字は画面の文字で出す）。

- 作り方: `python3 generate.py <id> [連番]`（OpenAI 画像API の edits・quality high・背景透過。背景だけ不透過）。依頼文と参照画像はスクリプトの中
- ゲームの絵: 透明な余白を切り落として WebP にした（`remake/img/ui/extra/parts/`。新しい画像なので Git LFS）
- 同じスクリプトで、ロゴの無いミニゲームの題字ロゴも作った（EXT06。原画は `asset_sources/ui/minigame-visuals-20261127/logos/originals/`、記録は同じフォルダの `prompts.md`）

| 原画（`originals/`） | ゲームの絵（`parts/`） | 使い方 |
|---|---|---|
| `xs_backdrop-01.png` | `backdrop.webp`（1600×1067） | 画面全体の背景（紫の煙と金の粒）。今のスライドの写真のぼかしを上に薄く重ねる |
| `xs_wordmark-01.png` | `wordmark.webp`（1000×332） | 見出しの EXTRA の題字（煙が絡む白金の字と金の線） |
| `xs_frame-01.png` | `frame.webp`（1280×761） | 写真の枠。中は透明で、写真は内側の開口（左右約4.4%・上9%・下8.2%）に収める |
| `xs_panel-01.png` | `panel.webp`（960×606） | 説明の板・段などの札・とじる。四隅の飾りを保って伸ばす（border-image） |
| `xs_button-01.png` | `button.webp`（900×299） | 「あそぶ」の札と、選んだ段の札。両端の飾りを保って伸ばす |
| `xs_arrow-01.png` | `arrow.webp`（256×258） | 左右の矢印（左は反転） |
| `xs_gems-01.png` | `gem-off.webp`・`gem-on.webp`（各 160 幅） | 下の並びの宝石（今の位置が点灯）と、クリアした段の印 |

- 検品: 文字・ロゴ・透かしなし。枠の内側が透明なこと、宝石の左右が消灯・点灯になっていることを確かめた
