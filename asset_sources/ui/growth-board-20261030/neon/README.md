# 心得の盤「ネオンのラウンジ」の生成素材（GB03 第1段・SBD72）

2026-10-31、Claude が OpenAI 画像 API（`gpt-image-2.5-sunburst`・quality high）で生成した。プロンプトと設定は `gen.py`、各出力のリクエスト記録は `<名前>.json`、原画はこのフォルダの PNG（Git LFS）。一覧は `contact_sheet.png`。

- キーはコードに書かない。クラウド環境ではプロキシのネットワークシークレットが Authorization を付ける。手元では環境変数 `OPENAI_API_KEY`。
- 再生成: `python3 asset_sources/ui/growth-board-20261030/neon/gen.py <名前>`（既にある PNG は飛ばす。作り直す時はその PNG を消す）。
- 変換: `python3 asset_sources/ui/growth-board-20261030/neon/convert.py --sheet`。縮小・外接矩形の切り出しだけで、色は触らない。

ゲームが読むのは `remake/img/ui/growth_board/*.webp`（合計約 206KB。GB03 の目安 1.5MB 以内）:

| ファイル | 大きさ | 使う所（`remake/css/daily.css` の `.gboard.has-art`） |
|---|---|---|
| board_glass.webp | 1520×976 | `.gb-board` の地（スモークガラス） |
| screen_backdrop.webp | 1920×1080 | `.gboard` の背景（ラウンジの奥のぼけ） |
| hub_body / hub_sense / hub_wisdom.webp | 256² 透過 | 紋の輪（`growth-board-screen.js` が SVG の `<image>` で置く。漢字はコード） |
| frame_skill / frame_lesson（2026-10-31 に飾り枠へ作り直し。前の版は `frame_lesson_v1.png`） / frame_gate / frame_peak / frame_seal.webp | 192² / 160² / 208² 透過 | スキル・授業・関門・極み・封の札（`.gb-face` の背景。文字・顔はコード） |
| hidane_any / body / sense / wisdom.webp | 96² 透過 | 火種の粒（下の帯 `.gb-hidane i`） |
| panel_frame.webp | 192² 透過 | 右のパネルの縁（9スライス `border-image`） |
| wall_seal.webp | 192×64 透過 | 開いた所とまだの所の境の結界（SVG の `<image>`。縦の道は90°回す） |
| silhouette_unknown.webp | 160² 透過 | 正体を伏せる授業・顔の無い人の影絵 |

画面の組み立て: `growth-board-screen.js` の `loadBoardArt()` が17枚を先読みし、**全部読めた時だけ** `.gboard` に `has-art` を付ける。読めない時は今までの図形（CSS/SVG）のまま動く。規則・データ・`data-test` は変えていない。
