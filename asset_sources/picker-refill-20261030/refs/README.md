# 補充の修正版で添付する元画像（2026-10-31）

画像選別（#1768）で「残す」になり、その画像を元に修正版を作る13対象の元画像。
`tools/picker_refill_generate.py` が対象ごとに参照画像として自動で添付する。

- 出典は選別画面に保存されていた表示用のプレビュー（長辺1600px以下のWebPに作り直したもの）。原寸の原画はオーナーのPC（`work/picker-migrate/`）にある。
- 下の sha256 は元の原画のもの。プレビュー自体のハッシュではない。

| 対象 | ファイル | 元のファイル名 | 元の sha256 |
|---|---|---|---|
| t-ext-hiyori | base-title_art_hiyori_new33_parts_wash_rack.webp | title_art_hiyori_new33_parts_wash_rack.png | 060dc96c7a5e91c5596c053bade545d1b9679c139ee1d29a0300411ac8943471 |
| t-map-ch3 | base-ref-decided-ch3.webp | ref-decided-ch3.webp | 5321a49fe5e8eec4b3ce9f7f76db56369727508bf7297940f6ab52d52a638a88 |
| t-map-ch4 | base-ref-decided-ch4.webp | ref-decided-ch4.webp | e171ff3e06bf0d5504cb4de4ef47d4a17f2bc9fdfa652835d9e6710ce86d0e06 |
| t-title-minto | base-title_art_minto_new02_mint_cloud.webp | title_art_minto_new02_mint_cloud.webp | 10242cad790f8751ece95f10d5b81beaa77f6187d67e5beba5c65734d0d2831e |
| t-title-samechan | base-title_art_samechan_new05_rainy_puddle.webp | title_art_samechan_new05_rainy_puddle.webp | 44eeaf747e7aa3a49e9710094aa7c72377aba0ab28a58e446a18196c8a7e1007 |
