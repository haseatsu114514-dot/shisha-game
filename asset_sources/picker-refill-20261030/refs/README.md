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
| t-trailer-ch3-02 | base-pattern2.webp | pattern2.webp | 9c299649cbe842569e86482258353018a883223eba6fcf9e8036ac03a0faae8b |
| t-trailer-ch3-03 | base-r7.webp | r7.webp | 79d2e52350973a7a2368cbf6e1035b651e76bc859db252b64d1a1679245d24ef |
| t-trailer-ch4-02 | base-r9.webp | r9.webp | 60e7064ab775ab435f15e4a375cd086e5dd0f1ac071d481d6f29ff7bb79e6426 |
| t-trailer-ch4-04 | base-pattern2.webp | pattern2.webp | ce4b004c41a6880fba52383e3cf9a443fe716c0875cd776358b34bd6d2e9a223 |
| t-trailer-ch4-05 | base-r2.webp | r2.webp | 2883919bc370467ecdf19c4e80018695eb613ea0df5d38419b110afe33319865 |
| t-trailer-ch4-06 | base-r6.webp | r6.webp | 811bb75b0e13c6596348ee9583af70680620e550bd760e9be3f91fc9b1058b94 |
| t-trailer-ch5-01 | base-pattern2.webp | pattern2.webp | 054267b77a17e80c81a8a699ac2a1e1f601f289a958c68f19afeb9b3b0079b42 |
| t-trailer-ch5-06 | base-r9.webp | r9.webp | 7c3e73c6e7bfc9d2f3fe1191975924028cba8ebab6981d20730cc8ca52816831 |
