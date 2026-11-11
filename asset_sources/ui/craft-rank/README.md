# 制作ランクの絵（D〜SSS）

オーナーが以前に選んだ7枚（#2473「⑩路線・密着①」）。2026-11-10 にオーナーが原画を渡した（`shisha-rank-D-to-SSS-originals.zip`）。CSL10。

- 原画（無加工）: `raw/rank-*.png`（1536×1024・RGBA）
- 採用: `assets/ui/craft-rank/rank-*.png`（alpha≥8 の外接範囲＋余白12pxで切り出し、完全透明画素のRGBを黒に）
- 配信: `remake/img/ui/craft-rank/rank-*.webp`（幅512）

| ランク | 補助名（絵の中の文字） | 原画 bytes | SHA-256 | 切り出し範囲（x0,y0,x1,y1） |
|---|---|---:|---|---|
| D | Dull | 1374210 | `b40e0d1481225152053595d06d003998cf7c715aa4e57e6eb13f95a5b615a99f` | 414,137,1140,896 |
| C | Chill | 1082883 | `3169ccf4430c9249a7981b8cfe8a78fece0eedf56ed70249035a92183e53bb04` | 488,197,1028,859 |
| B | Balanced | 1425802 | `e6d910ef986af92f2adb1cb9fb208978673c2ed01555394113b711ffa0456afa` | 412,168,1118,849 |
| A | Aromatic | 1629817 | `bded3c750a5c0ba9b942bf07badf5624f5f4c37146f5674eefb31a81cdc0eb0a` | 337,93,1219,926 |
| S | Smokin' | 1813058 | `ecc289aea2c4a8a441289855af61efb2250156eaa0675f172443b7ec0dd0def4` | 327,71,1215,947 |
| SS | Smooth Smokin' | 1762888 | `6ddba3e87616434ea948efffe5ff1fd5aaf6567fc6e3dc68fb791089ad0759b3` | 324,83,1239,940 |
| SSS | Super Smooth Smokin' | 2097385 | `3aa838177313c56c3dd0a8d663691728bc60b51aa2e8eeec16fdf235a3607dc6` | 199,47,1352,973 |

見せ方（オーナー「結構あれ文字細かいから上手く見せ方考えて」）: 制作中の上の帯では大きな文字だけが読める大きさの小さな絵、ランクが上がった瞬間だけ大きく出して補助名まで読ませる。
