# 心得の盤のマスのアイコン（SBD73）

2026-10-31、Claude が OpenAI 画像 API（`gpt-image-2.5-sunburst`・quality medium・透過）で生成した。プロンプトは `gen.py`、各出力の記録は `<名前>.json`、原画はこのフォルダの PNG（Git LFS）。一覧は `contact_sheet.png`。

- 38点: 恩恵12（`perk_<キー>`）、スキル24（`skill_<ID>`）、`peak`（極み）、`gate`（関門）。
- 絵は白〜薄い金のモノライン。盤の色は CSS の `drop-shadow` で重ねる。文字・数字は入れない。
- 変換: `python3 asset_sources/ui/growth-board-20261030/icons/convert.py --sheet` → `remake/img/ui/growth_board/icons/*.webp`（64×64、合計約137KB）。
- 画面: `growth-board-screen.js` の `iconOf(node)` が名前を決め、`.gb-icon-img` として `.gb-face` に入れる。`has-art` の時だけ表示し、漢字（`.gb-glyph`）は下に残す。
- 作り直し: その PNG を消して `gen.py <名前>`。
