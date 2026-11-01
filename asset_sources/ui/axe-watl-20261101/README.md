# 斧投げ WATL 2026式の板（2026-11-01・AXR06・Codex依頼 #2198）

斧投げミニゲームを公式（WATL 2026 Hatchet）の的・採点へ再構成した際（台帳 `docs/owner_requests.md` AXR01〜06、設計 `docs/axe_throw.md`「WATL 2026式への再構成」）、板の新規画像を生成しようとしたが、OpenAI 画像API（`gpt-image-2.5-sunburst`）が **クレジット切れ（HTTP 429 `insufficient_quota`）** で生成できなかった。オーナー指示「新規で画像生成が必要な場合はコーデックスに依頼して作成しても可」に従い、Codex への依頼を [Issue #2198](https://github.com/haseatsu114514-dot/shisha-game/issues/2198) にまとめた（プロンプト・受け入れ条件・組み込み手順）。指示文の正本はこのフォルダの `prompts/board.txt`。

2026-11-01 追記（AXR07）: 見やすさのため、中央6割を明るく均一にし、濃い節・黒い傷・強い木目を置かない指示を加えた。

- 指示文: `prompts/board.txt`（1024×1024・透過背景・5枚の縦板・明るく落ち着いた中央・傷は外周だけ・リングや文字は描かない）。
- 現状のゲームは既存の `remake/img/ui/axe_throw/target_board_display.webp`（正方形の板）の上に、SVG で公式比率のマーキング（20mm 黒線・赤ブル・赤縁の青）を描いている。板の実寸は 46.25×48in（2x10 を5枚）として扱い、画像は `remake/js/minigames/axe.js` の `OPAQUE`（不透明範囲の比率）で板の矩形へ引き伸ばしている。

## 受け取ったあとの組み込み

1. 原画を `raw/board.png` に置き、採用版を `assets/ui/axe_throw/target_board_watl.png`、配信用を `remake/img/ui/axe_throw/target_board_watl_display.webp`（800px・lossy q90）にする。既存の `target_board.png` / `target_board_display.webp` は `asset_sources/hiyori-axe-issue477/validate.py` が SHA を検査するので変更しない。
2. `remake/js/minigames/axe.js` の `ART.board` を新しい WebP にし、`OPAQUE` を新画像の不透明範囲（左・右・上・下の比率）に合わせる。
3. `python3 remake/tools/build_manifest.py` で manifest を更新し、`node tools/ci/run.mjs --kind browser --suites axe-throw` で確認する。
