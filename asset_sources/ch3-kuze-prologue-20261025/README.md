# 第3章冒頭スチル

2026-10-25。第三章の匿名の幼少期、公表された県大会映像を見る匿名の出場者、新幹線のはじめに使う。

| 実装素材 | 原画 | 用途 |
| --- | --- | --- |
| `assets/cgs/cg_ch3_childhood_offered_hand.png` | `childhood-offered-hand-original.png` | いじめられた少年へ少女が手を差し出す。既存の `cg_kuze_mashiro_childhood` を顔・服・公園の参照に編集生成。後の二人で座る既存CGも再利用 |
| `assets/backgrounds/bg_ch3_kuze_video.png` | `anonymous-video-desk-original.png` | 顔を見せない成人の机。現行表示版は `../ch3-kuze-research-redesign-20261026/README.md` で久世の現行立ち絵に合わせて編集 |
| `assets/backgrounds/bg_ch3_train_arrival.png` | `shinkansen-arrival-original.png` | 東京到着前の新幹線。はじめ視点 |

原画は `/workspace/generated_images/` のこのセッションの出力を無加工で複製した。幼少期CGの現行表示版は `../ch3-prologue-soft-focus-20261026/README.md` の編集履歴を参照。WebPは `python3 remake/tools/build_manifest.py --cgs-only cg_ch3_childhood_offered_hand.png` と `--backgrounds-only bg_ch3_kuze_video.png bg_ch3_train_arrival.png` で生成。画像内に動画サービス名や字幕を焼き込まない。生成した成人の顔は映さず、本人の立ち絵も出さない。

生成指示の要点: 1600×900のアニメ調。幼少期は既存CGの六歳の少年・五歳の少女・秋の公園を保持し、少年が茶とケーキの絵を抱えて落ち込み、少女がしゃがんで開いた手を伸ばす。机は夜、背面と手元だけ、文字のないノートPC画面と半分の絵・茶。列車は車窓から東京へ近づく明るい昼、顔や読める文字なし。どの絵にもシーシャ器具・実在ロゴを入れない。
