# 久世朔・通常立ち絵

第3章の「余白」店主、久世朔の初回 normal 立ち絵。正本は `data/characters.json` と `brand/character_profiles.md`。現行採用のヴォルクや零の立ち絵に合わせ、成人向けの2Dノベル絵として制作した。旧ピクセルアート用の `docs/prompts/portrait_prompts_pending.md` の人物要件を踏まえつつ、採用済みの表示画風を優先した。

- `normal-first-pass.png`: image_gen.imagegen による初回原画。指示は `normal-prompt.txt`。
- `normal-source.png`: 初回原画を参照して、同ツールで輪郭と透過を整えた原画。指示は `cleanup-prompt.txt`。
- `assets/sprites/characters/kuze/chr_kuze_normal.png`: 配布用。最終原画の透過アルファを最大連結の人物領域に限定し、輪郭を2px内側へ整えた。輪郭付近の高彩度ノイズと、左腕・エプロン間に残った赤い点のアルファを除去。縦横比を保って 896×1160 内へ縮小、透過 896×1200 キャンバスに中央配置した。人物・衣装の描き足しは行っていない。

目視で顔、髪、両足、左手、右手の親指・手帳・ペン、エプロンと衣服を確認。2回目の原画にも離れた微小な透過ノイズと赤黄の縁色があったため、配布用のみ機械的に除去した。背景色を敷いた配布PNGを再確認した。シーシャの器具や喫煙は描かれていない。

表情差分は未制作。既存の normal フォールバックを使う。
