# DJミニゲームのUI素材（Issue #2071）

2026-10-31、Grok BotがOpenAI画像API（`gpt-image-2.5-sunburst`、quality high）で生成。プロンプトと設定は`gen.py`、各出力のリクエスト記録は`*.json`。元PNGはこのフォルダ（LFS）。

ゲームが読むのは`remake/img/ui/dj/`のWebP（Pillowで縮小のみ、色調整なし）:

| ファイル | 元 | 表示先 |
|---|---|---|
| platter.webp 384² 透過 | platter.png 1024² | `.platter`（94/78/70/68px） |
| deck-panel.webp 512×768 | deck-panel.png 1024×1536 | `.deck` 背景 cover |
| mixer-panel.webp 512×768 | mixer-panel.png 1024×1536 | `.mixer` 背景 cover |
| fader-cap.webp 114×128 透過 | fader-cap.png（外接矩形で切り出し） | `#crossfader` のつまみ 30×34px |

CSSは`remake/previews/dj/style.css`末尾。画像が読めなくても従来のCSSグラデーションが下に残る。判定・タイミング・音声処理は変更していない。
