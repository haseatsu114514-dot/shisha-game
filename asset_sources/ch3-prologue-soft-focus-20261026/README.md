# 第3章冒頭・幼少期の記憶

このぼかし版は2026-10-26のオーナー指示で不採用。現行本編はぼかす前の二枚絵を使用する。以下は制作履歴として保存する。

2026-10-26。章頭の公園の二枚絵で、少女の顔立ちだけを記憶越しに柔らかく見せる。短いボブ、小さな片編み、ふわふわの上着、差し出す手と少年の表情は残す。

| 実装PNG | 編集生成した原画 | 元絵 |
| --- | --- | --- |
| `assets/cgs/cg_ch3_childhood_offered_hand.png` | `childhood-offered-hand-soft-focus.png` | `asset_sources/ch3-kuze-prologue-20261025/childhood-offered-hand-original.png` |
| `assets/cgs/cg_kuze_mashiro_childhood.png` | `childhood-together-soft-focus.png` | `asset_sources/kuze-portrait-expression-20261025/childhood-flashback-source.png` |

既存の二枚を参照して画像編集生成した。少女の目・鼻・口の細部のみ焦点を柔らかくし、顔を無地の楕円にせず、人の顔として自然な陰影を残すよう指定。WebPは `python3 remake/tools/build_manifest.py --cgs-only cg_ch3_childhood_offered_hand.png cg_kuze_mashiro_childhood.png` で生成する。元絵は上記の既存原画に残す。
