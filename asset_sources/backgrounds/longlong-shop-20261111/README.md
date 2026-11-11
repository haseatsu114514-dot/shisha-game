# 龍龍水煙所 店内背景（Issue #3021）

2026-11-11 にオーナーが候補Aを採用。`original.png` は `work/codex-a-3021redo-1111/presentation/candidate_a.png` の無加工コピー（1920×1080）。制作経緯と候補比較は同フォルダの `CANDIDATES.md` を参照。

龍の柱彫刻と双龍レリーフを中心に、店内にシーシャ機材は置かない。右壁の「龍」の額は絵の一部として使い、正式ロゴ表示は既存の `assets/ui/store_logos/ch4-longlong.webp` が担当する。

ゲーム用PNGは `assets/backgrounds/bg_longlong_shop.png`、表示用WebPは `remake/img/backgrounds/bg_longlong_shop.webp`。表示用は `python3 remake/tools/build_manifest.py --backgrounds-only bg_longlong_shop.png` で生成した。
