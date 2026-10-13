# 制作ミニゲームのアルミ表面（Issue #533）

人物      : なし。既存の `hajime_craft_holes.webp` は質感・光の参照のみ。
場面      : アルミを張り終え、穴を開ける前。ハガルの口に張ったアルミだけ。
台の型    : 真上の近接。口以外のハガル・台は画角外。
HMD       : なし（穴あけ工程）。
炭        : 0個。
ホース    : 画角外。
吸い口    : なし。
構図      : 真上90度、正円、透過背景。右上から暖色光、左下に冷たい銀の影。縁で折り込み、中央は張った面。

参照したルール：`asset_sources/shisha-hardware-reference/drawing-sheet/README.md`、基本README、近接・使用設置・AI誤描写・ボウル内部の資料、`docs/asset_ai_guidance.md`。図解は生成ツールに添付しない。

生成参照：
- 質感・照明：既存ゲームの `remake/img/ui/making/hajime_craft_holes.webp`。
- 実物の張り面と縁：Hookah.org, [Tangiers hole pattern](https://www.hookah.org/tangiers-hookah-hole-pattern/), [工程写真](https://www.hookah.org/wp-content/uploads/2014/12/tangiers-hookah-bowl-hole-pattern.png), 2026-10-13閲覧。写真は参照のみ。穴配置・手・製品・背景を転載せず、生成素材に既存の穴を焼き込まない。

出力先：`assets/ui/making/foil_interactive_top.png`。WebP配信版とmanifestは `python3 remake/tools/build_manifest.py --making-only foil_interactive_top.png` で更新。

ゲームで針穴・凹み・短い傷を同じ位置に重ねる。目標マーク、移動光、リングは画像に焼き込まない。穴数・判定・時間は変更しない。

生成後検品：正円に近い真上の張り面、縁の細かい折り込み、右側の暖色反射と左側の銀色の影を確認。中央の既存穴・規則的な放射模様・文字・炭・HMD・人物はない。ゲームではmanifestのbboxに合わせて余白を除き、既存の円座標に重ねる。

原画SHA-256：`4211cc5f4808f772152eb401ff5f0a1584b4cb59319ccee651b2f533303487c5`（1254×1254 RGBA）。原画とWebP配信版をGitHubに保存。
