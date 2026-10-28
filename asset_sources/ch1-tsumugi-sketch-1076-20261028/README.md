# cg_ch1_tsumugi_sketch_wip（#1076 DAY3 下描き素材, #896 台帳）

- 用途：第1章 DAY3 `ch1_tsumugi_work_in_progress` でつむぎが見せる「描きかけの下描き」（タブレットの中の絵そのもの）。DAY1 research の「LIMEで届く下描き」にも流用可。
- 構図：完成CG `cg_ch1_tsumugi_heart_art` のタブレット内の絵と同じ並び（左に窓辺＋猫＋煙、中央に後ろ姿のはじめ、右に空のガラスボトルの棚、手前に空いた席）。
  焦点化できる2か所：(a) 窓辺＋猫＋煙（画面左・おおよそ x 140–660, y 20–560 / 1920×1080基準）、(b) カウンター＋はじめの手元＋トング（中央右・おおよそ x 1150–1400, y 440–760）。座標は目安。実装時に実画像で確認すること。
- 状態：線画＋一部だけ塗り（窓・猫・ランタン・カウンター一部は着色、壁・棚などは線のまま）。完成CGを灰色にした偽の下描きではない。文字・UI・ロゴなし。組んだシーシャ・ホース・燃えた炭は描かない。
- 生成：2026-10-28 JST、Grok Bot の画像生成（GenerateImage, 16:9）。参照画像＝`remake/img/cgs/cg_ch1_tsumugi_heart_art.webp` 全体と、そのタブレット内の絵の切り出し。原寸 1280×720（`cg_ch1_tsumugi_sketch_wip_raw_1280x720.jpg`）→ LANCZOS で 1920×1080 に拡大して `assets/cgs/cg_ch1_tsumugi_sketch_wip.png`、`remake/img/cgs/*.webp` は build_images.py と同じ規則（lossless と q90 の小さい方）で作成。
- 制作許可：オーナー 2026-10-28 10:32 JST「1076は生成して」。採用の最終判断は実表示確認後。
- 注意：画面への接続（DAY3 の表示・焦点・DAY11 手元焦点）は未実装。ギャラリーの収集スチルには出さない（gallery-catalog.js で除外）。

## プロンプト（要約）
Full-frame 16:9 refined pixel art matching the game's style; a work-in-progress digital sketch with the same composition as the tablet painting in the reference: cozy wooden shisha cafe at night, window with night city and a small calico cat on the ledge with a wisp of smoke, young man from behind (black cap, black hoodie) behind the counter with his right hand visible holding long metal charcoal tongs, shelves of empty glass bases, hanging mosaic lanterns, empty stools; sepia construction line art on warm off-white canvas, flat colour only on parts; no faces, no other people, no text/logos, no assembled hookah/hose/burning coals.
