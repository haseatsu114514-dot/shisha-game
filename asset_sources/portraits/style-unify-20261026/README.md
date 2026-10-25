# 立ち絵の画風整理（2026-10-26 採用分）

REI、組長、路上占い師、ヴォルク、ひより、チャコール博士の候補を比較し、オーナー確認後に25枚を正式素材へ反映した。みんと・アゲハのドット感を強めた別試作は見送り、現行素材を維持した。

![採用前の比較。各組の左が旧版、右が採用候補](normal-lineup.jpg)

| 人物 | 採用した枚数 | 正式素材 |
|---|---:|---|
| REI | 1 | `assets/sprites/characters/rei/` |
| 組長 | 5 | `assets/sprites/characters/kumicho/` |
| 路上占い師 | 1 | `assets/sprites/characters/uranaishi/` |
| ヴォルク | 1 | `assets/sprites/characters/volk/` |
| ひより | 12 | `assets/sprites/characters/hiyori/` |
| チャコール博士 | 5 | `assets/sprites/characters/dr_kemuri/` |

ひよりの `student_smile` だけは候補原画の靴底が下端で切れていた。補完案も画質と本人性に問題があったため、オーナー判断で旧版を維持した。

このフォルダには採用した25枚の無加工原画と生成指示、[生成・寸法記録](generation.json)を保存する。正式素材は各原画を896×1200へ位置合わせしたPNGで、表示用WebPは `remake/img/sprites/characters/` にある。全身の高さ・靴底位置は従来に合わせた。試作の比較・未採用案は [`art/portrait-style-trials-20261026` の確定時点](https://github.com/haseatsu114514-dot/shisha-game/tree/ef4a3f8fc84f2b350c6505a2e1d66373df2c4b49/asset_sources/portraits/style-unify-20261026)に残る。
